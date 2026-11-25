/**
 * CRIAR PERFIL DE TESTE
 * Usa service_role APENAS para criar perfil de teste no DEV
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

// ⚠️  SERVICE_ROLE KEY - NÃO COMMITAR!
// Esta key bypassa RLS e deve ser usada APENAS para setup de testes
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = 'teste.onboarding@almeida.dev'
const TEST_PASSWORD = 'Teste123!@#'

async function criarPerfil() {
  console.log('═'.repeat(70))
  console.log('CRIAR PERFIL DE TESTE')
  console.log('═'.repeat(70))
  console.log()
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ SERVICE_ROLE_KEY não configurada')
    console.log()
    console.log('Para criar o perfil via script, execute:')
    console.log('  set SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key')
    console.log('  node criar-perfil-teste.mjs')
    console.log()
    console.log('OU execute o SQL diretamente no Supabase:')
    console.log('  Ver arquivo: CORRIGIR_GRANT_PERFIS.sql')
    console.log()
    return false
  }
  
  // Cliente com service_role para bypassar RLS temporariamente
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  // 1. Autenticar para pegar user ID
  console.log('1. Autenticando usuário...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  })
  
  if (authError) {
    console.log('❌ Erro na autenticação:', authError.message)
    return false
  }
  
  const userId = authData.user.id
  console.log('✅ User ID:', userId)
  console.log()
  
  // 2. Verificar se perfil já existe
  console.log('2. Verificando se perfil existe...')
  const { data: perfilExiste } = await supabaseAdmin
    .from('perfis')
    .select('id')
    .eq('id', userId)
    .single()
  
  if (perfilExiste) {
    console.log('⚠️  Perfil já existe!')
    console.log()
    console.log('Para resetar o onboarding, execute:')
    console.log(`UPDATE perfis SET onboarding_concluido = false WHERE id = '${userId}';`)
    console.log()
    return true
  }
  
  console.log('Perfil não existe, criando...')
  console.log()
  
  // 3. Criar perfil
  console.log('3. Criando perfil...')
  const { data: novoPerfil, error: insertError } = await supabaseAdmin
    .from('perfis')
    .insert({
      id: userId,
      email: TEST_EMAIL,
      nome: 'Teste Onboarding',
      onboarding_concluido: false
    })
    .select()
  
  if (insertError) {
    console.log('❌ Erro ao criar perfil:', insertError.message)
    console.log('   Código:', insertError.code)
    console.log('   Details:', insertError.details)
    return false
  }
  
  console.log('✅ Perfil criado com sucesso!')
  console.log('   ID:', novoPerfil[0].id)
  console.log('   Email:', novoPerfil[0].email)
  console.log('   Nome:', novoPerfil[0].nome)
  console.log()
  
  // 4. Verificar se usuário consegue ler próprio perfil
  console.log('4. Testando leitura do perfil pelo usuário...')
  const { data: perfilLeitura, error: leituraError } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (leituraError) {
    console.log('❌ Usuário NÃO consegue ler próprio perfil:', leituraError.message)
    console.log('   Código:', leituraError.code)
    console.log()
    console.log('⚠️  PROBLEMA DE GRANT OU RLS!')
    console.log('   Execute: CORRIGIR_GRANT_PERFIS.sql')
    return false
  }
  
  console.log('✅ Usuário consegue ler próprio perfil!')
  console.log()
  
  console.log('═'.repeat(70))
  console.log('✅ SETUP COMPLETO - Pronto para testes')
  console.log('═'.repeat(70))
  
  return true
}

criarPerfil().then(success => {
  process.exit(success ? 0 : 1)
})
