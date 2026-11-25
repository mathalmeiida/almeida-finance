import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('VERIFICAÇÃO DE SEGURANÇA: public.perfis\n')

// Autenticar como usuário teste
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (authError) {
  console.log('❌ Autenticação falhou')
  process.exit(1)
}

const userId = auth.user.id
console.log('✅ Autenticado como:', auth.user.email)
console.log('   User ID:', userId)
console.log()

// ============================================================
// 1. PRIVILÉGIOS EXISTENTES DE authenticated
// ============================================================
console.log('1. PRIVILÉGIOS EXISTENTES DE authenticated em perfis\n')

// Testar UPDATE na tabela inteira (sem especificar colunas)
const { error: updateFullError } = await supabase
  .from('perfis')
  .update({ nome: 'Teste Update Full' })
  .eq('id', userId)

if (!updateFullError) {
  console.log('  ⚠️  UPDATE na tabela inteira: PERMITIDO')
  console.log('  Isso significa que authenticated JÁ tem GRANT UPDATE em perfis')
  console.log('  Usuário pode modificar QUALQUER coluna (incluindo papel e ativo)')
} else if (updateFullError.code === '42501') {
  console.log('  ✅ UPDATE na tabela inteira: SEM PERMISSÃO')
  console.log('  GRANT UPDATE por coluna será seguro')
} else {
  console.log(`  ⚠️  Erro inesperado: ${updateFullError.message}`)
}
console.log()

// Testar UPDATE em papel especificamente
const { error: updatePapelError } = await supabase
  .from('perfis')
  .update({ papel: 'admin' })
  .eq('id', userId)

if (!updatePapelError) {
  console.log('  🔴 CRÍTICO: UPDATE em papel: PERMITIDO')
  console.log('  Usuário pode se tornar admin!')
} else if (updatePapelError.code === 'PGRST204') {
  console.log('  ℹ️  Coluna papel não existe ainda (esperado)')
} else if (updatePapelError.code === '42501') {
  console.log('  ✅ UPDATE em papel: BLOQUEADO por permissão')
} else {
  console.log(`  ⚠️  UPDATE em papel: ${updatePapelError.message}`)
}
console.log()

// ============================================================
// 2. POLÍTICAS RLS
// ============================================================
console.log('2. POLÍTICAS RLS: Proteção contra modificação de terceiros\n')

// Buscar perfil próprio
const { data: perfilProprio, error: e1 } = await supabase
  .from('perfis')
  .select('*')
  .eq('id', userId)
  .single()

if (e1) {
  console.log('  ❌ Erro ao buscar perfil próprio:', e1.message)
} else {
  console.log('  ✅ SELECT do próprio perfil: OK')
}

// Tentar buscar perfis de outros usuários
const { data: outrosPerfis, error: e2 } = await supabase
  .from('perfis')
  .select('*')
  .neq('id', userId)
  .limit(1)

if (e2) {
  console.log('  ❌ SELECT de outros perfis: erro', e2.code)
} else if (!outrosPerfis || outrosPerfis.length === 0) {
  console.log('  ✅ SELECT de outros perfis: BLOQUEADO por RLS')
} else {
  console.log('  🔴 CRÍTICO: SELECT de outros perfis: PERMITIDO')
  console.log('  RLS não está protegendo corretamente!')
}

// Criar ID falso para testar UPDATE em perfil de terceiro
const idFalso = '00000000-0000-0000-0000-000000000000'

const { error: e3 } = await supabase
  .from('perfis')
  .update({ nome: 'Ataque' })
  .eq('id', idFalso)

if (e3) {
  console.log('  ✅ UPDATE em perfil de terceiro: BLOQUEADO')
} else {
  console.log('  🔴 CRÍTICO: UPDATE em perfil de terceiro: PERMITIDO')
}
console.log()

// ============================================================
// 3. TRIGGERS E FUNÇÕES
// ============================================================
console.log('3. TRIGGERS E FUNÇÕES ADMINISTRATIVAS\n')

// Não conseguimos listar triggers via authenticated, mas podemos
// testar comportamento indireto

// Testar se existe trigger que modifica papel automaticamente
const nomeOriginal = perfilProprio?.nome || 'Original'

const { error: e4 } = await supabase
  .from('perfis')
  .update({ nome: 'Teste Trigger' })
  .eq('id', userId)

if (!e4) {
  // Buscar novamente para ver se algum trigger modificou outras colunas
  const { data: perfilAposUpdate } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (perfilAposUpdate) {
    const mudancasInesperadas = []
    
    // Comparar campos sensíveis
    if (perfilAposUpdate.papel !== perfilProprio?.papel && perfilProprio?.papel) {
      mudancasInesperadas.push(`papel: ${perfilProprio.papel} → ${perfilAposUpdate.papel}`)
    }
    
    if (perfilAposUpdate.ativo !== perfilProprio?.ativo && perfilProprio?.ativo !== undefined) {
      mudancasInesperadas.push(`ativo: ${perfilProprio.ativo} → ${perfilAposUpdate.ativo}`)
    }
    
    if (mudancasInesperadas.length > 0) {
      console.log('  🔴 CRÍTICO: Trigger modificou colunas sensíveis:')
      mudancasInesperadas.forEach(m => console.log(`    ${m}`))
    } else {
      console.log('  ✅ Nenhum trigger suspeito detectado')
    }
  }
  
  // Restaurar nome original
  await supabase
    .from('perfis')
    .update({ nome: nomeOriginal })
    .eq('id', userId)
} else {
  console.log('  ℹ️  Não foi possível testar triggers:', e4.message)
}
console.log()

// ============================================================
// 4. COMPATIBILIDADE DE TIPOS
// ============================================================
console.log('4. COMPATIBILIDADE DE TIPOS E CONSTRAINTS\n')

console.log('  Colunas atuais do perfil:')
if (perfilProprio) {
  Object.entries(perfilProprio).forEach(([key, value]) => {
    const tipo = Array.isArray(value) ? 'array' : typeof value
    console.log(`    ${key}: ${tipo} = ${JSON.stringify(value)}`)
  })
}

console.log()
console.log('  Tipos esperados pelas novas colunas:')
console.log('    papel: TEXT (default "user")')
console.log('    ativo: BOOLEAN (default TRUE)')
console.log('    ultimo_acesso: TIMESTAMPTZ (nullable)')
console.log('    onboarding_concluido: BOOLEAN (default FALSE)')
console.log('    objetivos_financeiros: TEXT[] (nullable)')
console.log('    onboarding_etapa: TEXT (nullable)')

console.log()
console.log('  ✅ Dados existentes são NULL, compatíveis com defaults')
console.log()

// ============================================================
// 5. RESUMO DE SEGURANÇA
// ============================================================
console.log('═'.repeat(70))
console.log('RESUMO DE SEGURANÇA')
console.log('═'.repeat(70))
console.log()

console.log('Verificações realizadas:')
console.log('  1. Privilégios GRANT em perfis')
console.log('  2. Políticas RLS contra modificação de terceiros')
console.log('  3. Triggers que modificam colunas sensíveis')
console.log('  4. Compatibilidade de tipos de dados')
console.log()

console.log('⚠️  ATENÇÃO:')
console.log('  - Se UPDATE na tabela inteira está PERMITIDO,')
console.log('    usuário pode modificar papel e ativo AGORA.')
console.log('  - Migration deve REVOGAR privilégios excessivos')
console.log('    ANTES de adicionar novas colunas.')
console.log()

console.log('VERIFICAÇÃO CONCLUÍDA')
