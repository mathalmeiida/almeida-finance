/**
 * VERIFICAR USUÁRIO DE TESTE NO SUPABASE DEV
 * Verifica se teste.onboarding@almeida.dev existe e está configurado
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const TEST_EMAIL = 'teste.onboarding@almeida.dev'

async function verificarUsuario() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  
  console.log('🔍 Verificando usuário de teste...')
  console.log('Email:', TEST_EMAIL)
  console.log('Ambiente: DEV (gxfcfpdwyjqcrfssxgbi)')
  console.log()
  
  // Tentar autenticar com senha de teste padrão
  const senhasTeste = [
    'Teste123!@#',
    'teste123456',
    'Teste@2024',
    'AlmeidaTest123'
  ]
  
  let autenticado = false
  let senhaCorreta = null
  
  for (const senha of senhasTeste) {
    console.log(`Tentando senha padrão ${senhasTeste.indexOf(senha) + 1}/${senhasTeste.length}...`)
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: senha
    })
    
    if (data?.user) {
      autenticado = true
      senhaCorreta = senha
      console.log('✅ AUTENTICADO com senha padrão')
      console.log()
      console.log('Dados do usuário:')
      console.log('- ID:', data.user.id)
      console.log('- Email:', data.user.email)
      console.log('- Email confirmado:', data.user.email_confirmed_at ? 'Sim' : 'Não')
      console.log('- Criado em:', data.user.created_at)
      console.log()
      
      // Verificar perfil
      const { data: perfil, error: perfilError } = await supabase
        .from('perfis')
        .select('*')
        .eq('id', data.user.id)
        .single()
      
      if (perfil) {
        console.log('Perfil:')
        console.log('- Nome:', perfil.nome || '(não definido)')
        console.log('- Onboarding concluído:', perfil.onboarding_concluido)
        console.log('- Saldo base:', perfil.saldo_base || 0)
        console.log()
        
        if (perfil.onboarding_concluido) {
          console.log('⚠️  Onboarding já foi concluído')
          console.log('   Precisa resetar para executar os testes')
          console.log()
          console.log('SQL para resetar:')
          console.log(`UPDATE perfis SET onboarding_concluido = false WHERE id = '${data.user.id}';`)
        } else {
          console.log('✅ Onboarding não concluído - pronto para testes')
        }
      } else {
        console.log('❌ Perfil não encontrado')
        if (perfilError) console.log('   Erro:', perfilError.message)
      }
      
      console.log()
      console.log('═'.repeat(70))
      console.log('✅ USUÁRIO VALIDADO E PRONTO PARA TESTES')
      console.log('═'.repeat(70))
      console.log()
      console.log('Para executar os testes:')
      console.log(`set TEST_PASSWORD=${senhaCorreta}`)
      console.log('npm run test:e2e -- onboarding-completo.spec.js --headed')
      
      break
    }
    
    if (error && !error.message.includes('Invalid login credentials')) {
      console.log('❌ Erro:', error.message)
    }
  }
  
  if (!autenticado) {
    console.log()
    console.log('═'.repeat(70))
    console.log('❌ NÃO FOI POSSÍVEL AUTENTICAR COM SENHAS PADRÃO')
    console.log('═'.repeat(70))
    console.log()
    console.log('Para redefinir a senha do usuário de teste:')
    console.log()
    console.log('1. Acesse o Supabase Dashboard DEV:')
    console.log('   https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi')
    console.log()
    console.log('2. Vá em Authentication > Users')
    console.log()
    console.log('3. Localize: teste.onboarding@almeida.dev')
    console.log()
    console.log('4. Clique nos 3 pontos > Reset Password')
    console.log()
    console.log('5. Defina nova senha: Teste123!@#')
    console.log()
    console.log('6. Execute novamente este script para validar')
    console.log()
    
    return false
  }
  
  return true
}

verificarUsuario().then(success => {
  process.exit(success ? 0 : 1)
})
