import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('=== CONSULTANDO ESTRUTURA DA TABELA perfis ===\n')

// Autenticar primeiro para evitar erro de permissão
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (authError) {
  console.error('❌ Erro na autenticação:', authError.message)
  process.exit(1)
}

console.log('✅ Autenticado como:', authData.user.email)

// Tentar consultar a tabela com SELECT *
console.log('\n📋 Consultando perfil do usuário...')
const { data: perfil, error: perfilError } = await supabase
  .from('perfis')
  .select('*')
  .eq('id', authData.user.id)
  .single()

if (perfilError) {
  console.error('❌ Erro ao consultar perfil:', perfilError.message)
  console.error('Código:', perfilError.code)
  console.error('Detalhes:', perfilError.details)
  
  // Se erro de permissão, não adianta continuar
  if (perfilError.code === '42501') {
    console.log('\n⚠️  GRANT SELECT ainda não foi aplicado')
    process.exit(1)
  }
} else {
  console.log('\n✅ Perfil encontrado:')
  console.log(JSON.stringify(perfil, null, 2))
  
  console.log('\n📊 Colunas retornadas pela query:')
  const colunasRetornadas = Object.keys(perfil)
  colunasRetornadas.forEach(col => console.log(`  - ${col}`))
  
  const temSaldoBase = colunasRetornadas.includes('saldo_base')
  const temSaldoBaseData = colunasRetornadas.includes('saldo_base_data')
  
  console.log('\n📊 Status das colunas necessárias:')
  console.log(`  saldo_base: ${temSaldoBase ? '✅ EXISTS' : '❌ MISSING'}`)
  console.log(`  saldo_base_data: ${temSaldoBaseData ? '✅ EXISTS' : '❌ MISSING'}`)
  
  if (!temSaldoBase || !temSaldoBaseData) {
    console.log('\n⚠️  AÇÃO NECESSÁRIA: Executar migration para adicionar colunas faltantes')
  }
}

console.log('\n=== FIM DA CONSULTA ===')
