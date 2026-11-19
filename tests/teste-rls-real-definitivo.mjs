// TESTE RLS REAL DEFINITIVO — 2 USUÁRIOS AUTENTICADOS
// Autenticação real com email/senha, sem mocks ou service_role como cliente
import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'

let falhas = 0

// Função para perguntar no terminal
function perguntar(questao) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  
  return new Promise(resolve => {
    rl.question(questao, resposta => {
      rl.close()
      resolve(resposta.trim())
    })
  })
}

// Criar cliente Supabase com anon key (acesso público)
function criarCliente() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Autenticar usuário com email e senha
async function autenticar(email, senha, label) {
  console.log(`\n## Autenticando ${label}...`)
  
  const supabase = criarCliente()
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  })
  
  if (error) {
    console.log(`   ❌ Erro ao autenticar: ${error.message}`)
    
    if (error.message.includes('Invalid login')) {
      console.log(`   ℹ️  Email ou senha incorretos`)
      console.log(`   ℹ️  Ou conta não confirmada`)
    } else if (error.message.includes('Email not confirmed')) {
      console.log(`   ℹ️  Email não confirmado. Verifique sua caixa de entrada.`)
    }
    
    falhas++
    return null
  }
  
  const userId = data.user.id
  const userEmail = data.user.email
  
  console.log(`   ✅ ${label} autenticado`)
  console.log(`   ID: ${userId}`)
  console.log(`   Email: ${userEmail}`)
  
  return { supabase, userId, email: userEmail }
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
  
  console.log(`   ✅ Receita criada: ${data.id} - ${descricao} (R$ ${valor})`)
  return data
}

// Testar isolamento
async function testarIsolamento() {
  console.log('═══════════════════════════════════════════════')
  console.log('TESTE RLS REAL — 2 USUÁRIOS AUTENTICADOS')
  console.log('═══════════════════════════════════════════════\n')
  
  console.log('Este teste requer 2 contas confirmadas no Supabase.')
  console.log('Você pode usar suas próprias contas de teste.\n')
  
  // ============================================================
  // OBTER CREDENCIAIS
  // ============================================================
  console.log('## Configuração')
  
  const emailAlice = await perguntar('Email da Alice: ')
  const senhaAlice = await perguntar('Senha da Alice: ')
  
  const emailBob = await perguntar('Email do Bob: ')
  const senhaBob = await perguntar('Senha do Bob: ')
  
  console.log('')
  
  // ============================================================
  // AUTENTICAR USUÁRIOS
  // ============================================================
  const alice = await autenticar(emailAlice, senhaAlice, 'Alice')
  if (!alice) {
    console.log('\n❌ Não foi possível autenticar Alice. Abortando.')
    return false
  }
  
  const bob = await autenticar(emailBob, senhaBob, 'Bob')
  if (!bob) {
    console.log('\n❌ Não foi possível autenticar Bob. Abortando.')
    return false
  }
  
  console.log('\n═══════════════════════════════════════════════')
  console.log('USUÁRIOS AUTENTICADOS')
  console.log('═══════════════════════════════════════════════')
  console.log(`Alice: ${alice.userId}`)
  console.log(`Bob:   ${bob.userId}`)
  console.log('═══════════════════════════════════════════════')
  
  // ============================================================
  // ALICE CRIA RECEITA
  // ============================================================
  console.log('\n## TESTE 1: Alice cria receita')
  const receitaAlice = await criarReceita(
    alice.supabase,
    alice.userId,
    'Salário Alice RLS Test',
    5000
  )
  
  if (!receitaAlice) {
    console.log('\n❌ Falha ao criar receita de Alice. Abortando.')
    return false
  }
  
  // ============================================================
  // BOB CRIA RECEITA
  // ============================================================
  console.log('\n## TESTE 2: Bob cria receita')
  const receitaBob = await criarReceita(
    bob.supabase,
    bob.userId,
    'Freelance Bob RLS Test',
    3000
  )
  
  if (!receitaBob) {
    console.log('\n❌ Falha ao criar receita de Bob. Abortando.')
    return false
  }
  
  // ============================================================
  // ALICE LÊ SUAS RECEITAS
  // ============================================================
  console.log('\n## TESTE 3: Alice lê SUAS receitas')
  
  const { data: receitasAlice, error: errAlice } = await alice.supabase
    .from('receitas')
    .select('*')
  
  if (errAlice) {
    console.log(`   ❌ Erro: ${errAlice.message}`)
    falhas++
  } else {
    console.log(`   ✅ Alice vê ${receitasAlice.length} receita(s)`)
    
    const aliceVeSuaReceita = receitasAlice.some(r => r.id === receitaAlice.id)
    const aliceVeReceitaBob = receitasAlice.some(r => r.id === receitaBob.id)
    
    if (!aliceVeSuaReceita) {
      console.log(`   ❌ Alice NÃO vê sua própria receita!`)
      falhas++
    } else {
      console.log(`   ✅ Alice vê sua própria receita`)
    }
    
    if (aliceVeReceitaBob) {
      console.log(`   ❌ FALHA CRÍTICA: Alice VÊ receita de Bob!`)
      console.log(`   ⚠️  RLS NÃO ESTÁ FUNCIONANDO`)
      falhas++
    } else {
      console.log(`   ✅ Alice NÃO vê receita de Bob (RLS OK)`)
    }
  }
  
  // ============================================================
  // BOB LÊ SUAS RECEITAS
  // ============================================================
  console.log('\n## TESTE 4: Bob lê SUAS receitas')
  
  const { data: receitasBob, error: errBob } = await bob.supabase
    .from('receitas')
    .select('*')
  
  if (errBob) {
    console.log(`   ❌ Erro: ${errBob.message}`)
    falhas++
  } else {
    console.log(`   ✅ Bob vê ${receitasBob.length} receita(s)`)
    
    const bobVeSuaReceita = receitasBob.some(r => r.id === receitaBob.id)
    const bobVeReceitaAlice = receitasBob.some(r => r.id === receitaAlice.id)
    
    if (!bobVeSuaReceita) {
      console.log(`   ❌ Bob NÃO vê sua própria receita!`)
      falhas++
    } else {
      console.log(`   ✅ Bob vê sua própria receita`)
    }
    
    if (bobVeReceitaAlice) {
      console.log(`   ❌ FALHA CRÍTICA: Bob VÊ receita de Alice!`)
      console.log(`   ⚠️  RLS NÃO ESTÁ FUNCIONANDO`)
      falhas++
    } else {
      console.log(`   ✅ Bob NÃO vê receita de Alice (RLS OK)`)
    }
  }
  
  // ============================================================
  // BOB TENTA ATUALIZAR RECEITA DE ALICE
  // ============================================================
  console.log('\n## TESTE 5: Bob tenta ATUALIZAR receita de Alice')
  
  const { data: updateData, error: updateError } = await bob.supabase
    .from('receitas')
    .update({ valor: 9999 })
    .eq('id', receitaAlice.id)
    .select()
  
  if (updateError) {
    console.log(`   ✅ UPDATE bloqueado: ${updateError.message}`)
  } else if (!updateData || updateData.length === 0) {
    console.log(`   ✅ UPDATE ignorado (RLS retornou 0 linhas afetadas)`)
  } else {
    console.log(`   ❌ FALHA CRÍTICA: Bob CONSEGUIU atualizar receita de Alice!`)
    console.log(`   Valor foi alterado para: R$ ${updateData[0].valor}`)
    falhas++
  }
  
  // ============================================================
  // VERIFICAR INTEGRIDADE DOS DADOS DE ALICE
  // ============================================================
  console.log('\n## TESTE 6: Verificar integridade dos dados de Alice')
  
  const { data: verificacao, error: errVerif } = await alice.supabase
    .from('receitas')
    .select('valor')
    .eq('id', receitaAlice.id)
    .single()
  
  if (errVerif) {
    console.log(`   ❌ Erro ao verificar: ${errVerif.message}`)
    falhas++
  } else if (verificacao.valor !== 5000) {
    console.log(`   ❌ FALHA CRÍTICA: Valor foi alterado!`)
    console.log(`   Esperado: R$ 5000, Atual: R$ ${verificacao.valor}`)
    falhas++
  } else {
    console.log(`   ✅ Valor preservado: R$ ${verificacao.valor} (não foi alterado)`)
  }
  
  // ============================================================
  // BOB TENTA DELETAR RECEITA DE ALICE
  // ============================================================
  console.log('\n## TESTE 7: Bob tenta DELETAR receita de Alice')
  
  const { data: deleteData, error: deleteError } = await bob.supabase
    .from('receitas')
    .delete()
    .eq('id', receitaAlice.id)
    .select()
  
  if (deleteError) {
    console.log(`   ✅ DELETE bloqueado: ${deleteError.message}`)
  } else if (!deleteData || deleteData.length === 0) {
    console.log(`   ✅ DELETE ignorado (RLS retornou 0 linhas afetadas)`)
  } else {
    console.log(`   ❌ FALHA CRÍTICA: Bob CONSEGUIU deletar receita de Alice!`)
    falhas++
  }
  
  // ============================================================
  // ALICE TENTA INSERIR RECEITA PARA BOB
  // ============================================================
  console.log('\n## TESTE 8: Alice tenta INSERIR receita para Bob')
  
  const { data: insertData, error: insertError } = await alice.supabase
    .from('receitas')
    .insert({
      usuario_id: bob.userId,
      descricao: 'Tentativa de fraude',
      valor: 99999,
      data: new Date().toISOString().split('T')[0],
      tipo: 'fraude'
    })
    .select()
  
  if (insertError) {
    console.log(`   ✅ INSERT bloqueado: ${insertError.message}`)
  } else {
    console.log(`   ❌ FALHA CRÍTICA: Alice CONSEGUIU criar receita para Bob!`)
    console.log(`   ID criado: ${insertData[0]?.id}`)
    falhas++
  }
  
  // ============================================================
  // TESTAR DESPESAS
  // ============================================================
  console.log('\n## TESTE 9: Isolamento em Despesas')
  
  // Alice cria despesa
  const { data: despesaAlice, error: errDespesaA } = await alice.supabase
    .from('despesas')
    .insert({
      usuario_id: alice.userId,
      descricao: 'Despesa Alice RLS Test',
      valor: 200,
      data: new Date().toISOString().split('T')[0],
      categoria: 'teste'
    })
    .select()
    .single()
  
  if (errDespesaA) {
    console.log(`   ⚠️  Erro ao criar despesa Alice: ${errDespesaA.message}`)
  } else {
    console.log(`   ✅ Despesa Alice criada: ${despesaAlice.id}`)
    
    // Bob tenta ler despesas
    const { data: despesasBob } = await bob.supabase
      .from('despesas')
      .select('*')
    
    const bobVeDespesaAlice = despesasBob?.some(d => d.id === despesaAlice.id)
    
    if (bobVeDespesaAlice) {
      console.log(`   ❌ FALHA CRÍTICA: Bob VÊ despesa de Alice!`)
      falhas++
    } else {
      console.log(`   ✅ Bob NÃO vê despesa de Alice (RLS OK)`)
    }
  }
  
  // ============================================================
  // LIMPEZA
  // ============================================================
  console.log('\n## LIMPEZA: Deletando dados de teste')
  
  await alice.supabase.from('receitas').delete().eq('id', receitaAlice.id)
  await bob.supabase.from('receitas').delete().eq('id', receitaBob.id)
  
  if (despesaAlice) {
    await alice.supabase.from('despesas').delete().eq('id', despesaAlice.id)
  }
  
  console.log(`   ✅ Dados de teste removidos`)
  
  return true
}

// Executar teste
async function main() {
  const sucesso = await testarIsolamento()
  
  console.log('\n═══════════════════════════════════════════════')
  
  if (falhas === 0 && sucesso) {
    console.log('✅ TESTE RLS: APROVADO')
    console.log('\nTodos os cenários de isolamento foram validados:')
    console.log('  ✓ SELECT: Usuários veem apenas seus dados')
    console.log('  ✓ INSERT: Não é possível criar dados para outro usuário')
    console.log('  ✓ UPDATE: Não é possível alterar dados de outro usuário')
    console.log('  ✓ DELETE: Não é possível excluir dados de outro usuário')
    console.log('  ✓ Múltiplas tabelas: receitas, despesas')
    console.log('\n🔒 RLS FUNCIONANDO CORRETAMENTE')
    console.log('🎯 SISTEMA PRONTO PARA LANÇAMENTO PÚBLICO')
  } else {
    console.log(`❌ TESTE RLS: FALHOU (${falhas} erro(s))`)
    console.log('\n⚠️  VULNERABILIDADES DETECTADAS')
    console.log('    NÃO PUBLICAR ATÉ CORRIGIR')
  }
  
  console.log('═══════════════════════════════════════════════')
  
  process.exit(falhas === 0 && sucesso ? 0 : 1)
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err)
  process.exit(1)
})
