// VERIFICAR USUÁRIOS EXISTENTES NO SUPABASE
// Usa service_role APENAS para listar usuários (admin), não para queries como usuário
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('# VERIFICAÇÃO DE USUÁRIOS NO SUPABASE\n')

if (!SUPABASE_SERVICE_KEY) {
  console.log('❌ SUPABASE_SERVICE_ROLE_KEY não configurada')
  console.log('\nPara listar usuários, é necessário:')
  console.log('1. Acessar: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/settings/api')
  console.log('2. Copiar "service_role" key (secret)')
  console.log('3. Exportar: set SUPABASE_SERVICE_ROLE_KEY=seu_service_role_key')
  console.log('4. Executar novamente este script')
  console.log('\n⚠️  Service role será usado APENAS para listar usuários (admin)')
  console.log('    NÃO será usado para executar queries como usuário comum')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function listarUsuarios() {
  console.log('## Listando usuários cadastrados...\n')
  
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      console.log(`❌ Erro ao listar usuários: ${error.message}`)
      return []
    }
    
    if (!users || users.length === 0) {
      console.log('⚠️  Nenhum usuário encontrado')
      return []
    }
    
    console.log(`✅ Encontrados ${users.length} usuário(s):\n`)
    
    users.forEach((user, idx) => {
      console.log(`${idx + 1}. Email: ${user.email}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Confirmado: ${user.email_confirmed_at ? '✅ Sim' : '❌ Não'}`)
      console.log(`   Criado em: ${new Date(user.created_at).toLocaleString('pt-BR')}`)
      console.log('')
    })
    
    return users
  } catch (err) {
    console.error(`❌ Erro fatal: ${err.message}`)
    return []
  }
}

async function verificarUsuariosParaTeste(users) {
  console.log('## Verificando usuários para teste RLS...\n')
  
  const confirmados = users.filter(u => u.email_confirmed_at)
  
  if (confirmados.length === 0) {
    console.log('❌ Nenhum usuário confirmado encontrado')
    console.log('\n📋 AÇÃO NECESSÁRIA:')
    console.log('1. Criar 2 contas via interface: https://almeida-finance.vercel.app/cadastro')
    console.log('2. Confirmar emails recebidos')
    console.log('3. Executar novamente este script')
    return null
  }
  
  if (confirmados.length === 1) {
    console.log(`⚠️  Apenas 1 usuário confirmado: ${confirmados[0].email}`)
    console.log('\n📋 AÇÃO NECESSÁRIA:')
    console.log('1. Criar mais 1 conta via interface: https://almeida-finance.vercel.app/cadastro')
    console.log('2. Confirmar email recebido')
    console.log('3. Executar novamente este script')
    return null
  }
  
  // Usar os 2 primeiros usuários confirmados
  const alice = confirmados[0]
  const bob = confirmados[1]
  
  console.log('✅ Usuários disponíveis para teste:\n')
  console.log(`Alice: ${alice.email} (ID: ${alice.id})`)
  console.log(`Bob:   ${bob.email} (ID: ${bob.id})`)
  console.log('')
  
  return { alice, bob }
}

async function main() {
  const users = await listarUsuarios()
  
  const usuariosTeste = await verificarUsuariosParaTeste(users)
  
  if (usuariosTeste) {
    console.log('═══════════════════════════════════════════════')
    console.log('✅ PRONTO PARA EXECUTAR TESTE RLS')
    console.log('═══════════════════════════════════════════════')
    console.log('\nPróximo passo:')
    console.log('  node tests/teste-rls-real-autenticado.mjs')
    console.log('\n⚠️  Você precisará informar as senhas de Alice e Bob')
  } else {
    console.log('═══════════════════════════════════════════════')
    console.log('⚠️  AÇÃO HUMANA NECESSÁRIA')
    console.log('═══════════════════════════════════════════════')
  }
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err)
  process.exit(1)
})
