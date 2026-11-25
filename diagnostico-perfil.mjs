/**
 * DIAGNÓSTICO COMPLETO - ERRO DE PERFIL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'
const TEST_EMAIL = 'teste.onboarding@almeida.dev'
const TEST_PASSWORD = 'Teste123!@#'

async function diagnosticar() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('═'.repeat(70))
  console.log('DIAGNÓSTICO: Erro de Permissão do Perfil')
  console.log('═'.repeat(70))
  console.log()
  
  // 1. Autenticar
  console.log('1. AUTENTICAÇÃO')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  })
  
  if (authError) {
    console.log('❌ Falha na autenticação:', authError.message)
    return
  }
  
  console.log('✅ Autenticado')
  console.log('   User ID:', authData.user.id)
  console.log('   Email:', authData.user.email)
  console.log()
  
  // 2. Verificar se perfil existe
  console.log('2. VERIFICAR REGISTRO EM perfis')
  const { data: perfil, error: perfilError } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', authData.user.id)
    .single()
  
  if (perfilError) {
    console.log('❌ Erro ao buscar perfil:', perfilError.message)
    console.log('   Código:', perfilError.code)
    console.log('   Details:', perfilError.details)
    console.log('   Hint:', perfilError.hint)
    console.log()
    
    // Verificar se registro existe via count
    const { count, error: countError } = await supabase
      .from('perfis')
      .select('id', { count: 'exact', head: true })
      .eq('id', authData.user.id)
    
    if (countError) {
      console.log('❌ Erro ao contar:', countError.message)
    } else {
      console.log(`   Registros encontrados: ${count}`)
      if (count === 0) {
        console.log('   ⚠️  PERFIL NÃO EXISTE!')
      }
    }
  } else {
    console.log('✅ Perfil encontrado')
    console.log('   ID:', perfil.id)
    console.log('   Email:', perfil.email)
    console.log('   Nome:', perfil.nome || '(null)')
    console.log('   Onboarding:', perfil.onboarding_concluido)
    console.log('   Criado em:', perfil.criado_em)
  }
  console.log()
  
  // 3. Verificar políticas RLS
  console.log('3. POLÍTICAS RLS DA TABELA perfis')
  const { data: policies, error: policiesError } = await supabase.rpc('get_table_policies', {
    table_name: 'perfis'
  }).catch(() => null)
  
  if (policies) {
    console.log('Políticas encontradas:', policies.length)
    policies.forEach(p => {
      console.log(`   - ${p.policyname} (${p.cmd}): ${p.qual}`)
    })
  } else {
    console.log('⚠️  Não foi possível listar políticas (função inexistente)')
  }
  console.log()
  
  // 4. Testar SELECT direto
  console.log('4. TESTAR SELECT DIRETO')
  const { data: selectTest, error: selectError } = await supabase
    .from('perfis')
    .select('id, email, nome')
    .eq('id', authData.user.id)
  
  if (selectError) {
    console.log('❌ SELECT falhou:', selectError.message)
    console.log('   Código:', selectError.code)
  } else {
    console.log('✅ SELECT funcionou')
    console.log('   Registros retornados:', selectTest?.length || 0)
    if (selectTest?.length > 0) {
      console.log('   Dados:', JSON.stringify(selectTest[0], null, 2))
    }
  }
  console.log()
  
  // 5. Verificar auth.uid()
  console.log('5. VERIFICAR auth.uid()')
  const { data: uidTest, error: uidError } = await supabase.rpc('get_current_user_id').catch(() => null)
  
  if (uidTest) {
    console.log('✅ auth.uid():', uidTest)
    console.log('   Match com user.id:', uidTest === authData.user.id ? '✅ SIM' : '❌ NÃO')
  } else {
    console.log('⚠️  Função get_current_user_id não existe (normal)')
  }
  console.log()
  
  // 6. Testar criação de perfil se não existir
  if (perfilError && perfilError.code === 'PGRST116') {
    console.log('6. PERFIL NÃO EXISTE - TESTANDO CRIAÇÃO')
    
    const { data: insertData, error: insertError } = await supabase
      .from('perfis')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        nome: 'Teste Onboarding',
        onboarding_concluido: false
      })
      .select()
    
    if (insertError) {
      console.log('❌ INSERT falhou:', insertError.message)
      console.log('   Código:', insertError.code)
      console.log('   Details:', insertError.details)
    } else {
      console.log('✅ Perfil criado com sucesso!')
      console.log('   ID:', insertData[0]?.id)
    }
  }
  
  console.log()
  console.log('═'.repeat(70))
  console.log('DIAGNÓSTICO COMPLETO')
  console.log('═'.repeat(70))
}

diagnosticar().catch(err => {
  console.error('ERRO CRÍTICO:', err.message)
  process.exit(1)
})
