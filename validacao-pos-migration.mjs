import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('VALIDAÇÃO PÓS-MIGRATION\n')

const { data: auth } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (!auth) {
  console.log('❌ Autenticação falhou')
  process.exit(1)
}

console.log('✅ Autenticado:', auth.user.email, '\n')

let erros = 0

// 1. Verificar 12 colunas
console.log('1. COLUNAS DA TABELA perfis')
const { data: perfil } = await supabase
  .from('perfis')
  .select('*')
  .eq('id', auth.user.id)
  .single()

const colunasEsperadas = [
  'id', 'nome', 'email', 'criado_em',
  'papel', 'ativo', 'ultimo_acesso', 'onboarding_concluido',
  'objetivos_financeiros', 'onboarding_etapa',
  'saldo_base', 'saldo_base_data'
]

const colunasAtuais = Object.keys(perfil || {})
const faltam = colunasEsperadas.filter(c => !colunasAtuais.includes(c))

if (faltam.length === 0) {
  console.log('   ✅ 12 colunas presentes')
} else {
  console.log('   ❌ Faltam:', faltam.join(', '))
  erros++
}
console.log()

// 2. Testar UPDATE no próprio perfil
console.log('2. UPDATE NO PRÓPRIO PERFIL')
const { error: e1 } = await supabase
  .from('perfis')
  .update({
    onboarding_concluido: true,
    onboarding_etapa: 'saldo',
    objetivos_financeiros: ['organizar']
  })
  .eq('id', auth.user.id)

if (e1) {
  console.log('   ❌ Erro:', e1.message)
  erros++
} else {
  console.log('   ✅ UPDATE permitido')
}
console.log()

// 3. Testar bloqueio de papel
console.log('3. BLOQUEIO DE papel')
const { error: e2 } = await supabase
  .from('perfis')
  .update({ papel: 'admin' })
  .eq('id', auth.user.id)

if (e2?.code === '42501') {
  console.log('   ✅ UPDATE em papel: BLOQUEADO')
} else if (!e2) {
  console.log('   ❌ UPDATE em papel: PERMITIDO')
  erros++
} else {
  console.log('   ⚠️  Erro:', e2.message)
}
console.log()

// 4. Testar bloqueio de ativo
console.log('4. BLOQUEIO DE ativo')
const { error: e3 } = await supabase
  .from('perfis')
  .update({ ativo: false })
  .eq('id', auth.user.id)

if (e3?.code === '42501') {
  console.log('   ✅ UPDATE em ativo: BLOQUEADO')
} else if (!e3) {
  console.log('   ❌ UPDATE em ativo: PERMITIDO')
  erros++
} else {
  console.log('   ⚠️  Erro:', e3.message)
}
console.log()

// 5. Testar isolamento (tentativa de UPDATE em ID inexistente)
console.log('5. ISOLAMENTO RLS')
const { data: isolamento, error: e4 } = await supabase
  .from('perfis')
  .update({ nome: 'Ataque' })
  .eq('id', '00000000-0000-0000-0000-000000000000')
  .select()

if (!isolamento || isolamento.length === 0) {
  console.log('   ✅ RLS bloqueou UPDATE em terceiro')
} else {
  console.log('   ❌ RLS permitiu UPDATE em terceiro')
  erros++
}
console.log()

// 6. Testar acesso a receitas, despesas, categorias
console.log('6. ACESSO A OUTRAS TABELAS')

const { error: receitasErr } = await supabase.from('receitas').select('id').limit(1)
const { error: despesasErr } = await supabase.from('despesas').select('id').limit(1)
const { error: categoriasErr } = await supabase.from('categorias').select('id').limit(1)

console.log('   receitas:', receitasErr?.code === '42501' ? '❌ SEM PERMISSÃO' : '✅ OK')
console.log('   despesas:', despesasErr?.code === '42501' ? '❌ SEM PERMISSÃO' : '✅ OK')
console.log('   categorias:', categoriasErr?.code === '42501' ? '❌ SEM PERMISSÃO' : '✅ OK')

if (receitasErr?.code === '42501' || despesasErr?.code === '42501' || categoriasErr?.code === '42501') {
  erros++
}
console.log()

console.log('═'.repeat(70))
if (erros === 0) {
  console.log('✅ TODAS AS VALIDAÇÕES PASSARAM')
} else {
  console.log(`❌ ${erros} VALIDAÇÕES FALHARAM`)
}
console.log('═'.repeat(70))

process.exit(erros > 0 ? 1 : 0)
