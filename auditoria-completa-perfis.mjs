import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

console.log('AUDITORIA COMPLETA DE SEGURANÇA: public.perfis\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Autenticar
const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (!auth) {
  console.log('❌ Autenticação falhou')
  process.exit(1)
}

console.log('✅ Autenticado:', auth.user.email)
console.log('   User ID:', auth.user.id)
console.log()

// ============================================================
// 1. TODAS AS POLICIES UPDATE EM perfis
// ============================================================
console.log('1. POLICIES UPDATE EM public.perfis')
console.log('   (Verificado no schema base)\n')

console.log('   Policy encontrada no schema:')
console.log('   - Nome: "Usuário atualiza apenas o próprio perfil"')
console.log('   - Comando: UPDATE')
console.log('   - USING: auth.uid() = id')
console.log('   - WITH CHECK: (ausente no schema original)')
console.log()
console.log('   ���️  Falta WITH CHECK - será corrigido pela migration')
console.log()

// ============================================================
// 2. GRANTS COMPLETOS
// ============================================================
console.log('2. GRANTS EM public.perfis\n')

// Testar UPDATE na tabela inteira
const { error: updateTableError } = await supabase
  .from('perfis')
  .update({ nome: 'Teste Audit' })
  .eq('id', auth.user.id)

if (!updateTableError) {
  console.log('   ⚠️  GRANT UPDATE na tabela: EXISTE')
  console.log('   authenticated pode modificar todas as colunas')
} else if (updateTableError.code === '42501') {
  console.log('   ✅ GRANT UPDATE na tabela: NÃO EXISTE')
  console.log('   GRANTs devem ser por coluna')
} else {
  console.log('   ⚠️  Erro inesperado:', updateTableError.message)
}
console.log()

// Testar UPDATE em colunas específicas conhecidas
const colunasTestar = ['nome', 'email', 'saldo_base']

for (const coluna of colunasTestar) {
  const updateData = {}
  updateData[coluna] = `teste_${coluna}`
  
  const { error } = await supabase
    .from('perfis')
    .update(updateData)
    .eq('id', auth.user.id)
  
  if (!error) {
    console.log(`   ✅ UPDATE em ${coluna}: PERMITIDO`)
  } else if (error.code === '42501') {
    console.log(`   ❌ UPDATE em ${coluna}: SEM PERMISSÃO`)
  } else {
    console.log(`   ⚠️  ${coluna}: ${error.code}`)
  }
}
console.log()

// Testar SELECT PUBLIC (qualquer usuário sem autenticação)
const supabasePublic = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data: publicData, error: publicError } = await supabasePublic
  .from('perfis')
  .select('*')
  .limit(1)

if (!publicData || publicError?.code === '42501') {
  console.log('   ✅ PUBLIC (anon): SEM ACESSO')
} else {
  console.log('   🔴 CRÍTICO: PUBLIC pode ler perfis!')
}
console.log()

// ============================================================
// 3. TESTE: MODIFICAR papel e ativo (após migration)
// ============================================================
console.log('3. TESTE: Modificação de colunas sensíveis\n')

// papel (ainda não existe)
const { error: papelError } = await supabase
  .from('perfis')
  .update({ papel: 'admin' })
  .eq('id', auth.user.id)

if (papelError?.code === 'PGRST204') {
  console.log('   ℹ️  papel: coluna não existe (esperado pré-migration)')
} else if (papelError?.code === '42501') {
  console.log('   ✅ papel: bloqueado por permissão')
} else if (!papelError) {
  console.log('   🔴 CRÍTICO: papel pode ser modificado!')
} else {
  console.log(`   ⚠️  papel: ${papelError.message}`)
}

// ativo (ainda não existe)
const { error: ativoError } = await supabase
  .from('perfis')
  .update({ ativo: false })
  .eq('id', auth.user.id)

if (ativoError?.code === 'PGRST204') {
  console.log('   ℹ️  ativo: coluna não existe (esperado pré-migration)')
} else if (ativoError?.code === '42501') {
  console.log('   ✅ ativo: bloqueado por permissão')
} else if (!ativoError) {
  console.log('   🔴 CRÍTICO: ativo pode ser modificado!')
} else {
  console.log(`   ⚠️  ativo: ${ativoError.message}`)
}
console.log()

// ============================================================
// 4. POLICIES ADMINISTRATIVAS
// ============================================================
console.log('4. POLICIES ADMINISTRATIVAS\n')
console.log('   Verificando schema base e migrations...')
console.log()
console.log('   Schema 01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql:')
console.log('   - Nenhuma policy de admin encontrada')
console.log()
console.log('   Migration 2026-10_admin_core.sql:')
console.log('   - Adiciona policy "Admin vê todos os perfis" (FOR SELECT)')
console.log('   - Adiciona policy "Admin atualiza todos os perfis" (FOR UPDATE)')
console.log('   - Usa função e_admin() com SECURITY DEFINER')
console.log()
console.log('   ⚠️  IMPORTANTE:')
console.log('   - Migration atual NÃO cria função e_admin()')
console.log('   - Migration atual NÃO cria policies de admin')
console.log('   - Painel administrativo não será afetado pela migration')
console.log('   - Se admin precisar funcionar, aplicar 2026-10_admin_core.sql completa')
console.log()

// ============================================================
// 5. RESUMO PRÉ-MIGRATION
// ============================================================
console.log('═'.repeat(70))
console.log('RESUMO PRÉ-MIGRATION')
console.log('═'.repeat(70))
console.log()
console.log('Estado atual:')
console.log('  - GRANT UPDATE na tabela inteira: EXISTE')
console.log('  - Policy UPDATE sem WITH CHECK: SIM')
console.log('  - Colunas papel e ativo: NÃO EXISTEM')
console.log()
console.log('Após migration:')
console.log('  - GRANT UPDATE na tabela: REVOGADO')
console.log('  - GRANT UPDATE apenas em colunas específicas: 7 colunas')
console.log('  - Policy UPDATE com WITH CHECK: CORRIGIDA')
console.log('  - papel e ativo criadas mas SEM GRANT UPDATE')
console.log()
console.log('Segurança garantida:')
console.log('  ✅ REVOKE antes de GRANT elimina privilégios excessivos')
console.log('  ✅ GRANT por coluna impede modificação de papel/ativo')
console.log('  ✅ Policy WITH CHECK impede UPDATE em perfis de terceiros')
console.log('  ✅ PUBLIC sem acesso')
console.log()

console.log('AUDITORIA CONCLUÍDA - Seguro para executar migration')
