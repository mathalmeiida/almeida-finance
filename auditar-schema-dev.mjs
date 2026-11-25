import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const TABELAS = [
  'perfis',
  'receitas', 
  'despesas',
  'categorias',
  'cartoes',
  'parcelamentos',
  'compras_cartao',
  'faturas_cartao'
]

console.log('AUDITORIA: Schema DEV vs Código-Fonte\n')

// Autenticar
const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email: 'teste.onboarding@almeida.dev',
  password: 'Teste123!@#'
})

if (authError) {
  console.log('❌ Autenticação falhou:', authError.message)
  process.exit(1)
}

console.log('✅ Autenticado\n')

for (const tabela of TABELAS) {
  console.log(`━━━ ${tabela.toUpperCase()} ━━━`)
  
  const { data, error } = await supabase
    .from(tabela)
    .select('*')
    .limit(1)
  
  if (error) {
    if (error.code === '42P01') {
      console.log('❌ TABELA NÃO EXISTE\n')
    } else if (error.code === '42501') {
      console.log('⚠️  SEM PERMISSÃO (tabela existe mas sem GRANT)\n')
    } else {
      console.log(`❌ ERRO: ${error.message} (${error.code})\n`)
    }
  } else {
    if (data && data.length > 0) {
      const colunas = Object.keys(data[0])
      console.log(`✅ ${colunas.length} colunas:`)
      colunas.forEach(col => console.log(`   - ${col}`))
    } else {
      // Tabela existe mas está vazia, tentar INSERT para descobrir colunas
      const { error: insertError } = await supabase
        .from(tabela)
        .insert({})
      
      if (insertError) {
        // Parser erro para extrair colunas esperadas
        console.log('✅ TABELA EXISTE (vazia)')
        console.log(`   Erro de insert: ${insertError.message}`)
      } else {
        console.log('✅ TABELA EXISTE (vazia, aceita insert vazio)')
      }
    }
    console.log()
  }
}
