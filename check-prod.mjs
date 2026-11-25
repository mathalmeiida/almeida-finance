import { createClient } from '@supabase/supabase-js'

// Verificar com usuário autenticado real
const supabase = createClient(
  'https://ievccupeijzuzhomphwn.supabase.co',
  'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'
)

// Listar usuários existentes (via auth admin - não funciona com anon)
const { data: users } = await supabase.auth.admin.listUsers().catch(() => ({ data: null }))

if (users) {
  console.log('ADMIN ACCESS')
} else {
  console.log('NO ADMIN - Testando com auth comum...')
  
  // Criar sessão temporária
  const { data: session } = await supabase.auth.signUp({
    email: `test-${Date.now()}@test.com`,
    password: 'Test123456!'
  }).catch(() => ({ data: null }))
  
  if (session?.user) {
    console.log('User criado:', session.user.id)
    
    // Tentar ler próprio perfil
    const { data: perfil, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', session.user.id)
      .single()
    
    if (perfil) {
      console.log('Colunas:', Object.keys(perfil).length)
      console.log('Tem onboarding_concluido:', 'onboarding_concluido' in perfil)
      console.log('Tem saldo_base:', 'saldo_base' in perfil)
    } else {
      console.log('Erro:', error?.message)
    }
  } else {
    console.log('Signup bloqueado - normal em prod')
  }
}
