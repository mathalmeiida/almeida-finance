import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

console.log('TESTE DE ISOLAMENTO: Dois Usuários Autenticados\n')

// ============================================================
// USUÁRIO 1: teste.onboarding@almeida.dev
// ============================================================
const supabase1 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const { data: auth1 } = await supabase1.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (!auth1) {
  console.log('❌ Usuário 1 falhou ao autenticar')
  process.exit(1)
}

console.log('✅ Usuário 1:', auth1.user.email)
console.log('   ID:', auth1.user.id)
console.log()

// Buscar perfil próprio
const { data: perfil1 } = await supabase1
  .from('perfis')
  .select('id, nome, email')
  .eq('id', auth1.user.id)
  .single()

console.log('   Perfil próprio:', perfil1?.nome || '(sem nome)')
console.log()

// ============================================================
// USUÁRIO 2: alice@example.com (já existe no banco)
// ============================================================
console.log('Preparando Usuário 2...')

const supabase2 = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Tentar senha comum de teste
let auth2 = null
const senhasTeste = ['senha123', 'Senha123', 'alice123', 'Alice123']

for (const senha of senhasTeste) {
  const { data, error } = await supabase2.auth.signInWithPassword({
    email: 'alice@example.com',
    password: senha
  })
  
  if (data?.user) {
    auth2 = data
    break
  }
}

if (!auth2) {
  console.log('❌ Não foi possível autenticar Usuário 2 (alice@example.com)')
  console.log('   Senhas testadas: senha123, Senha123, alice123, Alice123')
  console.log('   Execute teste manualmente com credenciais corretas')
  process.exit(0)
}

console.log('✅ Usuário 2: alice@example.com')
console.log('   ID:', auth2.user.id)
console.log()

// Buscar perfil do usuário 2
const { data: perfil2 } = await supabase2
  .from('perfis')
  .select('id, nome, email')
  .eq('id', auth2.user.id)
  .single()

console.log('   Perfil próprio:', perfil2?.nome || '(sem nome)')
console.log()
  
// TESTE 1: Usuário 1 tenta modificar perfil do Usuário 2
// ============================================================
console.log('TESTE 1: Usuário 1 tenta modificar Usuário 2\n')

const { data: resultado1, error: erro1 } = await supabase1
  .from('perfis')
  .update({ nome: 'ATACADO pelo Usuário 1' })
  .eq('id', auth2.user.id)
  .select()

if (erro1) {
  console.log('   ⚠️  Erro ao tentar UPDATE:', erro1.message)
} else if (!resultado1 || resultado1.length === 0) {
  console.log('   ✅ UPDATE bloqueado por RLS (0 rows)')
} else {
  console.log('   🔴 CRÍTICO: UPDATE permitido!')
  console.log('   Rows afetadas:', resultado1.length)
}

// Verificar se perfil do Usuário 2 foi alterado
const { data: perfilVerif } = await supabase2
  .from('perfis')
  .select('nome')
  .eq('id', auth2.user.id)
  .single()

if (perfilVerif?.nome === 'ATACADO pelo Usuário 1') {
  console.log('   🔴 CRÍTICO: Perfil foi MODIFICADO!')
} else {
  console.log('   ✅ Perfil preservado:', perfilVerif?.nome)
}
console.log()

// ============================================================
// TESTE 2: Usuário 2 tenta modificar perfil do Usuário 1
// ============================================================
console.log('TESTE 2: Usuário 2 tenta modificar Usuário 1\n')

const { data: resultado2, error: erro2 } = await supabase2
  .from('perfis')
  .update({ nome: 'ATACADO pelo Usuário 2' })
  .eq('id', auth1.user.id)
  .select()

if (erro2) {
  console.log('   ⚠️  Erro ao tentar UPDATE:', erro2.message)
} else if (!resultado2 || resultado2.length === 0) {
  console.log('   ✅ UPDATE bloqueado por RLS (0 rows)')
} else {
  console.log('   🔴 CRÍTICO: UPDATE permitido!')
  console.log('   Rows afetadas:', resultado2.length)
}

// Verificar se perfil do Usuário 1 foi alterado
const { data: perfilVerif1 } = await supabase1
  .from('perfis')
  .select('nome')
  .eq('id', auth1.user.id)
  .single()

if (perfilVerif1?.nome === 'ATACADO pelo Usuário 2') {
  console.log('   🔴 CRÍTICO: Perfil foi MODIFICADO!')
} else {
  console.log('   ✅ Perfil preservado:', perfilVerif1?.nome)
}
console.log()

// ============================================================
// TESTE 3: Cada usuário modifica o próprio perfil
// ============================================================
console.log('TESTE 3: Cada usuário modifica o próprio perfil\n')

const { error: proprio1 } = await supabase1
  .from('perfis')
  .update({ nome: 'Usuário 1 Modificado' })
  .eq('id', auth1.user.id)

console.log('   Usuário 1 modifica próprio perfil:', proprio1 ? '❌' : '✅')

const { error: proprio2 } = await supabase2
  .from('perfis')
  .update({ nome: 'Usuário 2 Modificado' })
  .eq('id', auth2.user.id)

console.log('   Usuário 2 modifica próprio perfil:', proprio2 ? '❌' : '✅')
console.log()

console.log('═'.repeat(70))
console.log('CONCLUSÃO')
console.log('═'.repeat(70))
console.log()
console.log('Se ambos os testes 1 e 2 mostraram "✅ UPDATE bloqueado",')
console.log('RLS está funcionando ANTES da migration.')
console.log()
console.log('Se algum teste mostrou "🔴 CRÍTICO", a migration com')
console.log('WITH CHECK corrigirá o problema.')
