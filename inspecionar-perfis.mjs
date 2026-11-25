/**
 * INSPECIONAR ESTRUTURA DA TABELA perfis
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

async function inspecionar() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('═'.repeat(70))
  console.log('INSPECIONAR TABELA perfis')
  console.log('Projeto DEV:', SUPABASE_URL.match(/\/\/(.+)\.supabase/)[1])
  console.log('═'.repeat(70))
  console.log()
  
  // 1. Autenticar
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'teste.onboarding@almeida.dev',
    password: 'Teste123!@#'
  })
  
  if (authError) {
    console.log('❌ Erro na autenticação:', authError.message)
    return
  }
  
  console.log('✅ Autenticado como:', authData.user.email)
  console.log()
  
  // 2. Buscar estrutura via information_schema (requer permissão ou rpc)
  console.log('1. ESTRUTURA VIA QUERY')
  
  // Tentar buscar um perfil vazio para ver os campos retornados
  const { data: perfilVazio, error: errVazio } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000000')
    .maybeSingle()
  
  console.log('Campos disponíveis via SELECT *:')
  console.log('Error:', errVazio?.message || 'nenhum')
  console.log('Data:', perfilVazio || 'null (esperado - ID inexistente)')
  console.log()
  
  // 3. Buscar perfil real do usuário
  console.log('2. PERFIL REAL DO USUÁRIO')
  const { data: perfil, error: errPerfil } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', authData.user.id)
    .single()
  
  if (errPerfil) {
    console.log('❌ Erro:', errPerfil.message)
    console.log('   Código:', errPerfil.code)
  } else {
    console.log('✅ Perfil encontrado')
    console.log('Campos presentes:', Object.keys(perfil).join(', '))
    console.log()
    console.log('Dados:')
    Object.entries(perfil).forEach(([key, value]) => {
      console.log(`  ${key}:`, value)
    })
  }
  console.log()
  
  // 4. Testar UPDATE com saldo_base
  console.log('3. TESTAR UPDATE com saldo_base')
  const { data: updateData, error: updateError } = await supabase
    .from('perfis')
    .update({ 
      saldo_base: 5000,
      saldo_base_data: new Date().toISOString().split('T')[0]
    })
    .eq('id', authData.user.id)
    .select()
  
  if (updateError) {
    console.log('❌ Erro no UPDATE:', updateError.message)
    console.log('   Código:', updateError.code)
    console.log('   Details:', updateError.details)
    console.log('   Hint:', updateError.hint)
  } else {
    console.log('✅ UPDATE executado')
    if (updateData && updateData.length > 0) {
      console.log('Campos retornados:', Object.keys(updateData[0]).join(', '))
    }
  }
  console.log()
  
  // 5. Verificar se existe via RPC (se houver função)
  console.log('4. INFORMAÇÕES ADICIONAIS')
  console.log('Schema cache error indica que o PostgREST não conhece a coluna')
  console.log('Possíveis causas:')
  console.log('  1. Coluna não existe na tabela')
  console.log('  2. Schema cache do PostgREST está desatualizado')
  console.log('  3. Coluna foi adicionada mas PostgREST não foi reiniciado')
  console.log()
  
  console.log('═'.repeat(70))
  console.log('Para confirmar a estrutura real da tabela, execute no SQL Editor:')
  console.log()
  console.log(`SELECT column_name, data_type, is_nullable`)
  console.log(`FROM information_schema.columns`)
  console.log(`WHERE table_schema = 'public'`)
  console.log(`  AND table_name = 'perfis'`)
  console.log(`ORDER BY ordinal_position;`)
  console.log('═'.repeat(70))
}

inspecionar().catch(err => {
  console.error('ERRO:', err.message)
  process.exit(1)
})
