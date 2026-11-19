#!/usr/bin/env node
/**
 * Script para criar usuário de teste no Supabase DEV
 * 
 * ATENÇÃO: 
 * - Executar APENAS contra ambiente DEV
 * - NÃO executar em produção
 * - Usuário criado: e2e.test@almeidafinance.local
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://fzawugbiojmtrthmshcc.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zKM96GEot5gE0r9zBTVPfg_4PwtZVO8'

const TEST_EMAIL = 'e2e.test@almeidafinance.local'
const TEST_PASSWORD = 'TestE2E2024!Secure'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('🔧 CRIAR USUÁRIO DE TESTE NO SUPABASE DEV\n')
console.log(`📍 Ambiente: ${SUPABASE_URL}`)
console.log(`📧 Email: ${TEST_EMAIL}\n`)

// 1. Tentar fazer signup
console.log('1. Tentando criar usuário...')

const { data: signupData, error: signupError } = await supabase.auth.signUp({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  options: {
    data: {
      nome: 'E2E Test User',
    },
  },
})

if (signupError) {
  if (signupError.message.includes('already registered')) {
    console.log('   ℹ️  Usuário já existe\n')
    
    // Tentar fazer login para confirmar
    console.log('2. Fazendo login para confirmar...')
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    
    if (loginError) {
      console.log('   ❌ Erro no login:', loginError.message)
      console.log('\n⚠️  AÇÃO NECESSÁRIA:')
      console.log('   1. Acesse https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc')
      console.log('   2. Vá em Authentication > Users')
      console.log('   3. Delete o usuário e2e.test@almeidafinance.local (se existir)')
      console.log('   4. Execute este script novamente\n')
      process.exit(1)
    }
    
    console.log('   ✅ Login bem-sucedido')
    console.log(`   User ID: ${loginData.user.id}\n`)
    
    // Verificar perfil
    console.log('3. Verificando perfil...')
    const { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', loginData.user.id)
      .single()
    
    if (perfilError || !perfil) {
      console.log('   ⚠️  Perfil não encontrado, criando...')
      
      // Criar perfil
      const { error: insertError } = await supabase
        .from('perfis')
        .insert({
          id: loginData.user.id,
          nome: 'E2E Test User',
          email: TEST_EMAIL,
          onboarding_concluido: false,
          saldo_base: null,
        })
      
      if (insertError) {
        console.log('   ❌ Erro ao criar perfil:', insertError.message)
        process.exit(1)
      }
      
      console.log('   ✅ Perfil criado\n')
    } else {
      console.log('   ✅ Perfil existe')
      console.log(`   - Nome: ${perfil.nome}`)
      console.log(`   - Onboarding concluído: ${perfil.onboarding_concluido}`)
      console.log(`   - Saldo base: ${perfil.saldo_base}\n`)
      
      // Se onboarding já foi concluído, resetar para teste
      if (perfil.onboarding_concluido) {
        console.log('4. Resetando onboarding para teste...')
        const { error: updateError } = await supabase
          .from('perfis')
          .update({
            onboarding_concluido: false,
            saldo_base: null,
          })
          .eq('id', loginData.user.id)
        
        if (updateError) {
          console.log('   ❌ Erro ao resetar:', updateError.message)
          process.exit(1)
        }
        
        console.log('   ✅ Onboarding resetado\n')
      }
    }
    
    console.log('✅ USUÁRIO DE TESTE PRONTO\n')
    console.log('Credenciais salvas em: .env.test')
    console.log('Execute: npx playwright test e2e/onboarding-real.spec.js\n')
    
  } else {
    console.log('   ❌ Erro no signup:', signupError.message)
    process.exit(1)
  }
} else {
  console.log('   ✅ Usuário criado com sucesso')
  console.log(`   User ID: ${signupData.user.id}\n`)
  
  console.log('2. Criando perfil...')
  
  const { error: perfilError } = await supabase
    .from('perfis')
    .insert({
      id: signupData.user.id,
      nome: 'E2E Test User',
      email: TEST_EMAIL,
      onboarding_concluido: false,
      saldo_base: null,
    })
  
  if (perfilError) {
    console.log('   ❌ Erro ao criar perfil:', perfilError.message)
    console.log('   ℹ️  O usuário foi criado mas o perfil falhou')
    console.log('   Execute o script novamente para corrigir\n')
    process.exit(1)
  }
  
  console.log('   ✅ Perfil criado\n')
  console.log('✅ USUÁRIO DE TESTE PRONTO\n')
  console.log('Credenciais salvas em: .env.test')
  console.log('Execute: npx playwright test e2e/onboarding-real.spec.js\n')
}
