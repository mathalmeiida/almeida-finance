// TESTE RLS REAL — MODO AUTOMÁTICO
// Lê credenciais de variáveis de ambiente para execução não-interativa
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'

// Credenciais de variáveis de ambiente
const EMAIL_ALICE = process.env.RLS_TEST_EMAIL_ALICE
const SENHA_ALICE = process.env.RLS_TEST_SENHA_ALICE
const EMAIL_BOB = process.env.RLS_TEST_EMAIL_BOB
const SENHA_BOB = process.env.RLS_TEST_SENHA_BOB

let falhas = 0

console.log('═══════════════════════════════════════════════')
console.log('TESTE RLS REAL — 2 USUÁRIOS AUTENTICADOS')
console.log('═══════════════════════════════════════════════\n')

// Verificar se credenciais foram fornecidas
if (!EMAIL_ALICE || !SENHA_ALICE || !EMAIL_BOB || !SENHA_BOB) {
  console.log('❌ CREDENCIAIS NÃO FORNECIDAS\n')
  console.log('Para executar este teste, defina as variáveis de ambiente:')
  console.log('')
  console.log('  $env:RLS_TEST_EMAIL_ALICE="email-alice@exemplo.com"')
  console.log('  $env:RLS_TEST_SENHA_ALICE="senha_alice"')
  console.log('  $env:RLS_TEST_EMAIL_BOB="email-bob@exemplo.com"')
  console.log('  $env:RLS_TEST_SENHA_BOB="senha_bob"')
  console.log('')
  console.log('Depois execute:')
  console.log('  node tests/teste-rls-auto.mjs')
  console.log('')
  console.log('ℹ️  Para teste interativo, use:')
  console.log('  node tests/teste-rls-real-definitivo.mjs')
  console.log('')
  process.exit(1)
}

console.log('✅ Credenciais carregadas das variáveis de ambiente')
console.log(`   Alice: ${EMAIL_ALICE}`)
console.log(`   Bob:   ${EMAIL_BOB}`)
console.log('')

// Criar cliente Supabase
function criarCliente() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Autenticar usuário
async function autenticar(email, senha, label) {
  console.log(`## Autenticando ${label}...`)
  
  const supabase = criarCliente()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  })
  
  if (error) {
    console.log(`   ❌ Erro ao autenticar: ${error.message}`)
    falhas++
    return null
  }
  
  console.log(`   ✅ ${label} autenticado`)
  console.log(`   ID: ${data.user.id}`)
  console.log('')
  
  return { supabase, userId: data.user.id, email: data.user.email }
}

// Criar receita
async function criarReceita(supabase, userId, descricao, valor) {
  const { data, error } = await supabase
    .from('receitas')
    .insert({
      usuario_id: userId,
      descricao,
      valor,
      data: new Date().toISOString().split('T')[0],
      tipo: 'teste_rls'
    })
    .select()
    .single()
  
  if (error) {
    console.log(`   ❌ Erro ao criar receita: ${error.message}`)
    falhas++
    return null
  }
  
  console.log(`   ✅ Receita criada: ${data.id}`)
  return data
}

// Teste principal
async function executarTeste() {
  // Autenticar
  const alice = await autenticar(EMAIL_ALICE, SENHA_ALICE, 'Alice')
  if (!alice) return false
  
  const bob = await autenticar(EMAIL_BOB, SENHA_BOB, 'Bob')
  if (!bob) return false
  
  console.log('═══════════════════════════════════════════════')
  console.log('USUÁRIOS AUTENTICADOS')
  console.log('═══════════════════════════════════════════════')
  console.log(`Alice: ${alice.userId}`)
  console.log(`Bob:   ${bob.userId}`)
  console.log('═══════════════════════════════════════════════\n')
  
  // Alice cria receita
  console.log('## TESTE 1: Alice cria receita')
  const receitaAlice = await criarReceita(alice.supabase, alice.userId, 'Receita Alice RLS', 5000)
  if (!receitaAlice) return false
  console.log('')
  
  // Bob cria receita
  console.log('## TESTE 2: Bob cria receita')
  const receitaBob = await criarReceita(bob.supabase, bob.userId, 'Receita Bob RLS', 3000)
  if (!receitaBob) return false
  console.log('')
  
  // Alice lê receitas
  console.log('## TESTE 3: Alice lê receitas')
  const { data: receitasAlice } = await alice.supabase.from('receitas').select('*')
  
  const aliceVeSua = receitasAlice?.some(r => r.id === receitaAlice.id)
  const aliceVeBob = receitasAlice?.some(r => r.id === receitaBob.id)
  
  console.log(`   Receitas visíveis: ${receitasAlice?.length || 0}`)
  console.log(`   ${aliceVeSua ? '✅' : '❌'} Alice vê sua própria receita`)
  console.log(`   ${!aliceVeBob ? '✅' : '❌'} Alice NÃO vê receita de Bob`)
  
  if (!aliceVeSua || aliceVeBob) falhas++
  console.log('')
  
  // Bob lê receitas
  console.log('## TESTE 4: Bob lê receitas')
  const { data: receitasBob } = await bob.supabase.from('receitas').select('*')
  
  const bobVeSua = receitasBob?.some(r => r.id === receitaBob.id)
  const bobVeAlice = receitasBob?.some(r => r.id === receitaAlice.id)
  
  console.log(`   Receitas visíveis: ${receitasBob?.length || 0}`)
  console.log(`   ${bobVeSua ? '✅' : '❌'} Bob vê sua própria receita`)
  console.log(`   ${!bobVeAlice ? '✅' : '❌'} Bob NÃO vê receita de Alice`)
  
  if (!bobVeSua || bobVeAlice) falhas++
  console.log('')
  
  // Bob tenta UPDATE
  console.log('## TESTE 5: Bob tenta UPDATE receita de Alice')
  const { data: updateData } = await bob.supabase
    .from('receitas')
    .update({ valor: 9999 })
    .eq('id', receitaAlice.id)
    .select()
  
  const updateBloqueado = !updateData || updateData.length === 0
  console.log(`   ${updateBloqueado ? '✅' : '❌'} UPDATE ${updateBloqueado ? 'bloqueado' : 'PERMITIDO!'}`)
  if (!updateBloqueado) falhas++
  console.log('')
  
  // Verificar integridade
  console.log('## TESTE 6: Verificar integridade de Alice')
  const { data: verif } = await alice.supabase
    .from('receitas')
    .select('valor')
    .eq('id', receitaAlice.id)
    .single()
  
  const integro = verif?.valor === 5000
  console.log(`   ${integro ? '✅' : '❌'} Valor ${integro ? 'preservado' : 'ALTERADO!'} (R$ ${verif?.valor})`)
  if (!integro) falhas++
  console.log('')
  
  // Bob tenta DELETE
  console.log('## TESTE 7: Bob tenta DELETE receita de Alice')
  const { data: deleteData } = await bob.supabase
    .from('receitas')
    .delete()
    .eq('id', receitaAlice.id)
    .select()
  
  const deleteBloqueado = !deleteData || deleteData.length === 0
  console.log(`   ${deleteBloqueado ? '✅' : '❌'} DELETE ${deleteBloqueado ? 'bloqueado' : 'PERMITIDO!'}`)
  if (!deleteBloqueado) falhas++
  console.log('')
  
  // Alice tenta INSERT para Bob
  console.log('## TESTE 8: Alice tenta INSERT para Bob')
  const { error: insertError } = await alice.supabase
    .from('receitas')
    .insert({
      usuario_id: bob.userId,
      descricao: 'Fraude',
      valor: 99999,
      data: new Date().toISOString().split('T')[0],
      tipo: 'teste'
    })
  
  const insertBloqueado = !!insertError
  console.log(`   ${insertBloqueado ? '✅' : '❌'} INSERT ${insertBloqueado ? 'bloqueado' : 'PERMITIDO!'}`)
  if (!insertBloqueado) falhas++
  console.log('')
  
  // Limpeza
  console.log('## LIMPEZA')
  await alice.supabase.from('receitas').delete().eq('id', receitaAlice.id)
  await bob.supabase.from('receitas').delete().eq('id', receitaBob.id)
  console.log('   ✅ Dados de teste removidos\n')
  
  return true
}

// Executar
executarTeste().then(sucesso => {
  console.log('═══════════════════════════════════════════════')
  
  if (falhas === 0 && sucesso) {
    console.log('✅ TESTE RLS: APROVADO')
    console.log('\nTodos os cenários validados:')
    console.log('  ✓ SELECT: Isolamento OK')
    console.log('  ✓ INSERT: Bloqueado')
    console.log('  ✓ UPDATE: Bloqueado')
    console.log('  ✓ DELETE: Bloqueado')
    console.log('\n🔒 RLS FUNCIONANDO CORRETAMENTE')
    console.log('🎯 SISTEMA PRONTO PARA LANÇAMENTO')
  } else {
    console.log(`❌ TESTE RLS: FALHOU (${falhas} erro(s))`)
    console.log('\n⚠️  VULNERABILIDADES DETECTADAS')
    console.log('    NÃO PUBLICAR ATÉ CORRIGIR')
  }
  
  console.log('═══════════════════════════════════════════════\n')
  
  process.exit(falhas === 0 && sucesso ? 0 : 1)
}).catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message)
  process.exit(1)
})
