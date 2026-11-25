/**
 * SETUP PARA TESTES DE ONBOARDING
 * Cria ou reseta usuário de teste no Supabase DEV
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const TEST_USER = {
  email: 'teste.onboarding@almeida.dev',
  senha: 'Teste123!@#',
  nome: 'Teste Onboarding'
}

async function setupUsuarioTeste() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('🔧 Configurando usuário de teste...')
  console.log('Email:', TEST_USER.email)
  console.log('Ambiente: DEV (gxfcfpdwyjqcrfssxgbi)')
  console.log()
  
  try {
    // Tentar fazer login primeiro para ver se já existe
    console.log('1. Verificando se usuário já existe...')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.senha
    })
    
    if (loginData?.user) {
      console.log('✅ Usuário já existe:', loginData.user.id)
      
      // Resetar onboarding
      console.log('2. Resetando onboarding_concluido...')
      const { error: updateError } = await supabase
        .from('perfis')
        .update({ onboarding_concluido: false })
        .eq('id', loginData.user.id)
      
      if (updateError) {
        console.error('❌ Erro ao resetar onboarding:', updateError.message)
        return false
      }
      
      console.log('✅ Onboarding resetado')
      console.log()
      console.log('✅ SETUP COMPLETO - Usuário pronto para testes')
      return true
    }
    
    // Se não existir, criar
    if (loginError?.message.includes('Invalid login credentials')) {
      console.log('❌ Usuário não existe, tentando criar...')
      
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: TEST_USER.email,
        password: TEST_USER.senha,
        options: {
          data: {
            nome: TEST_USER.nome
          }
        }
      })
      
      if (signupError) {
        console.error('❌ Erro ao criar usuário:', signupError.message)
        return false
      }
      
      if (!signupData?.user) {
        console.error('❌ Usuário não foi criado (confirmação de email pode ser necessária)')
        return false
      }
      
      console.log('✅ Usuário criado:', signupData.user.id)
      console.log('⚠️  Se confirmação de email for necessária, você precisará confirmar manualmente')
      console.log()
      console.log('✅ SETUP COMPLETO - Usuário pronto para testes')
      return true
    }
    
    console.error('❌ Erro inesperado:', loginError?.message)
    return false
    
  } catch (err) {
    console.error('❌ Erro crítico:', err.message)
    return false
  }
}

// Executar setup
setupUsuarioTeste().then(success => {
  process.exit(success ? 0 : 1)
})
