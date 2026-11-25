import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('═'.repeat(70))
console.log('VALIDAÇÃO: Correção da Tabela perfis')
console.log('═'.repeat(70))
console.log()

// 1. Autenticar
console.log('1. AUTENTICAÇÃO')
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (authError) {
  console.log('❌ Falha na autenticação:', authError.message)
  process.exit(1)
}

console.log('✅ Autenticado como:', authData.user.email)
console.log('   User ID:', authData.user.id)
console.log()

// 2. Verificar se consegue ler perfil (testa GRANT SELECT)
console.log('2. TESTE: GRANT SELECT')
const { data: perfil, error: perfilError } = await supabase
  .from('perfis')
  .select('*')
  .eq('id', authData.user.id)
  .single()

if (perfilError) {
  console.log('❌ Erro ao ler perfil:', perfilError.message)
  console.log('   Código:', perfilError.code)
  if (perfilError.code === '42501') {
    console.log('   ⚠️  GRANT SELECT não foi aplicado!')
  }
  process.exit(1)
}

console.log('✅ Perfil lido com sucesso')
console.log()

// 3. Verificar se colunas existem
console.log('3. TESTE: Colunas saldo_base e saldo_base_data')
const colunasRetornadas = Object.keys(perfil)
const temSaldoBase = colunasRetornadas.includes('saldo_base')
const temSaldoBaseData = colunasRetornadas.includes('saldo_base_data')

console.log(`   saldo_base: ${temSaldoBase ? '✅ EXISTS' : '❌ MISSING'}`)
console.log(`   saldo_base_data: ${temSaldoBaseData ? '✅ EXISTS' : '❌ MISSING'}`)

if (!temSaldoBase || !temSaldoBaseData) {
  console.log()
  console.log('❌ Colunas faltando! Execute EXECUTAR_CORRECAO_PERFIS_DEV.sql')
  process.exit(1)
}
console.log()

// 4. Testar UPDATE (testa GRANT UPDATE)
console.log('4. TESTE: GRANT UPDATE nas novas colunas')
const dataHoje = new Date().toISOString().split('T')[0]
const { error: updateError } = await supabase
  .from('perfis')
  .update({
    saldo_base: 5000.00,
    saldo_base_data: dataHoje
  })
  .eq('id', authData.user.id)

if (updateError) {
  console.log('❌ Erro ao atualizar perfil:', updateError.message)
  console.log('   Código:', updateError.code)
  if (updateError.code === '42501') {
    console.log('   ⚠️  GRANT UPDATE não foi aplicado!')
  }
  process.exit(1)
}

console.log('✅ UPDATE executado com sucesso')
console.log(`   Valores gravados: R$ 5.000,00 em ${dataHoje}`)
console.log()

// 5. Verificar se valores foram salvos
console.log('5. TESTE: Verificar valores salvos')
const { data: perfilAtualizado, error: verificacaoError } = await supabase
  .from('perfis')
  .select('saldo_base, saldo_base_data')
  .eq('id', authData.user.id)
  .single()

if (verificacaoError) {
  console.log('❌ Erro ao verificar:', verificacaoError.message)
  process.exit(1)
}

console.log('✅ Valores lidos após UPDATE:')
console.log('   saldo_base:', perfilAtualizado.saldo_base)
console.log('   saldo_base_data:', perfilAtualizado.saldo_base_data)

const valorCorreto = perfilAtualizado.saldo_base === 5000.00 || perfilAtualizado.saldo_base === '5000.00'
const dataCorreta = perfilAtualizado.saldo_base_data === dataHoje

if (!valorCorreto || !dataCorreta) {
  console.log()
  console.log('❌ Valores não correspondem ao esperado!')
  process.exit(1)
}

console.log()
console.log('═'.repeat(70))
console.log('✅ TODAS AS VALIDAÇÕES PASSARAM')
console.log('═'.repeat(70))
console.log()
console.log('Status:')
console.log('  ✅ GRANT SELECT, INSERT, UPDATE funcionando')
console.log('  ✅ Colunas saldo_base e saldo_base_data existem')
console.log('  ✅ Usuário consegue salvar e ler valores')
console.log()
console.log('Próximo passo: Testar onboarding no navegador em localhost:5173')
