import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gxfcfpdwyjqcrfssxgbi.supabase.co',
  'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'
)

console.log('VALIDAÇÃO RÁPIDA\n')

const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (!auth) {
  console.log('❌ Auth falhou')
  process.exit(1)
}

console.log('✅ Auth OK\n')

// 1. Colunas
const { data: perfil } = await supabase
  .from('perfis')
  .select('*')
  .eq('id', auth.user.id)
  .single()

const esperadas = ['papel', 'ativo', 'ultimo_acesso', 'onboarding_concluido', 'objetivos_financeiros', 'onboarding_etapa']
const faltam = esperadas.filter(c => !Object.keys(perfil).includes(c))

console.log('1. COLUNAS:', faltam.length === 0 ? '✅ 12 OK' : `❌ Faltam: ${faltam.join(', ')}`)

// 2. UPDATE próprio
const { error: e1 } = await supabase
  .from('perfis')
  .update({ onboarding_etapa: 'saldo' })
  .eq('id', auth.user.id)

console.log('2. UPDATE PRÓPRIO:', e1 ? `❌ ${e1.message}` : '✅ OK')

// 3. Bloqueio papel
const { error: e2 } = await supabase
  .from('perfis')
  .update({ papel: 'admin' })
  .eq('id', auth.user.id)

console.log('3. BLOQUEIO papel:', e2?.code === '42501' ? '✅ BLOQUEADO' : '❌ PERMITIDO')

// 4. Bloqueio ativo
const { error: e3 } = await supabase
  .from('perfis')
  .update({ ativo: false })
  .eq('id', auth.user.id)

console.log('4. BLOQUEIO ativo:', e3?.code === '42501' ? '✅ BLOQUEADO' : '❌ PERMITIDO')

// 5. Tabelas
const { error: recErr } = await supabase.from('receitas').select('id').limit(1)
const { error: despErr } = await supabase.from('despesas').select('id').limit(1)
const { error: catErr } = await supabase.from('categorias').select('id').limit(1)

console.log('5. RECEITAS:', recErr?.code === '42501' ? '❌ SEM GRANT' : '✅ OK')
console.log('6. DESPESAS:', despErr?.code === '42501' ? '❌ SEM GRANT' : '✅ OK')
console.log('7. CATEGORIAS:', catErr?.code === '42501' ? '❌ SEM GRANT' : '✅ OK')

console.log('\nFIM')
