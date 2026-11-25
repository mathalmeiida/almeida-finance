/**
 * CRIA USUÁRIOS DE TESTE NO DEV
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const usuarios = [
  { email: 'alice.teste@example.com', senha: 'AliceTest2024!', nome: 'Alice Teste' },
  { email: 'bob.teste@example.com', senha: 'BobTest2024!', nome: 'Bob Teste' },
]

async function criar() {
  for (const u of usuarios) {
    console.log(`\nCriando ${u.nome} (${u.email})...`)
    
    const { data, error } = await supabase.auth.signUp({
      email: u.email,
      password: u.senha,
      options: {
        data: { nome: u.nome },
        emailRedirectTo: 'http://localhost:5173/auth/callback'
      }
    })
    
    if (error) {
      if (error.message.includes('already registered')) {
        console.log(`✅ ${u.email} já existe`)
      } else {
        console.log(`❌ Erro: ${error.message}`)
      }
    } else {
      console.log(`✅ ${u.email} criado: ${data.user.id}`)
    }
  }
  
  console.log('\n✅ Usuários de teste prontos!')
}

criar()
