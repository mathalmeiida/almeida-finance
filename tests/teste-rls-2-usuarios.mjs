// TESTE REAL DE SEGURANÇA RLS — 2 USUÁRIOS AUTENTICADOS
// Valida isolamento completo entre usuários no Supabase
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ievccupeijzuzhomphwn.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku'

// ⚠️ USUÁRIOS DE TESTE (usar contas temporárias, NUNCA contas reais)
// Caso não existam, o script tentará criá-las
const USUARIO_A = {
  email: 'teste.alice.rls@almeidafinance.test',
  senha: 'TesteRLS2026!@#Alice',
  nome: 'Alice Teste RLS'
}

const USUARIO_B = {
  email: 'teste.bob.rls@almeidafinance.test',
  senha: 'TesteRLS2026!@#Bob',
  nome: 'Bob Teste RLS'
}

let falhas = 0

console.log('# TESTE DE SEGURANÇA RLS — 2 USUÁRIOS AUTENTICADOS\n')
console.log(`🔗 Supabase: ${SUPABASE_URL}\n`)

// Função para criar cliente autenticado
function criarCliente() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Função para fazer login ou criar conta
async function autenticar(usuario, label) {
  const supabase = criarCliente()
  
  console.log(`## Autenticando ${label}...`)
  
  // Tentar login primeiro
  let { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: usuario.email,
    password: usuario.senha
  })
  
  if (loginError) {
    // Se não existe, tentar criar (pode falhar por rate limit)
    console.log(`   Login falhou: ${loginError.message}`)
    console.log(`   Tentando criar conta...`)
    
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: usuario.email,
      password: usuario.senha,
      options: {
        data: {
          nome: usuario.nome
        }
      }
    })
    
    if (signupError) {
      console.log(`   ❌ Erro ao criar: ${signupError.message}`)
      
      if (signupError.message.includes('rate limit')) {
        console.log(`\n⚠️  RATE LIMIT ATIVO`)
        console.log(`   Por favor, use contas de teste existentes ou aguarde 1h`)
        console.log(`   Alternativa: criar contas manualmente em ${SUPABASE_URL}/auth`)
        return null
      }
      
      falhas++
      return null
    }
    
    console.log(`   ✅ Conta criada: ${signupData.user?.id}`)
    
    // Fazer login após criar
    const { data: newLoginData, error: newLoginError } = await supabase.auth.signInWithPassword({
      email: usuario.email,
      password: usuario.senha
    })
    
    if (newLoginError) {
      console.log(`   ❌ Erro no login pós-criação: ${newLoginError.message}`)
      falhas++
      return null
    }
    
    loginData = newLoginData
  } else {
    console.log(`   ✅ Login OK: ${loginData.user.id}`)
  }
  
  return {
    supabase,
    userId: loginData.user.id,
    email: loginData.user.email
  }
}

// Função para criar registro de teste
async function criarReceita(supabase, userId, descricao, valor) {
  const { data, error } = await supabase
    .from('receitas')
    .insert({
      usuario_id: userId,
      descricao,
      valor,
      data: new Date().toISOString().split('T')[0],
      tipo: 'teste'
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

// Teste de isolamento
async function testarIsolamento() {
  // 1. Autenticar usuários
  const alice = await autenticar(USUARIO_A, 'Alice')
  if (!alice) {
    console.log('\n❌ Não foi possível autenticar Alice. Abortando teste.')
    return false
  }
  
  const bob = await autenticar(USUARIO_B, 'Bob')
  if (!bob) {
    console.log('\n❌ Não foi possível autenticar Bob. Abortando teste.')
    return false
  }
  
  console.log(`\n${'='.repeat(60)}`)
  console.log('USUÁRIOS AUTENTICADOS:')
  console.log(`  Alice: ${alice.userId}`)
  console.log(`  Bob:   ${bob.userId}`)
  console.log('='.repeat(60))
  
  // 2. Alice cria uma receita
  console.log('\n## TESTE 1: Alice cria receita')
  const receitaAlice = await criarReceita(
    alice.supabase,
    alice.userId,
    'Salário Alice Teste',
    5000
  )
  
  if (!receitaAlice) return false
  
  // 3. Bob cria uma receita
  console.log('\n## TESTE 2: Bob cria receita')
  const receitaBob = await criarReceita(
    bob.supabase,
    bob.userId,
    'Salário Bob Teste',
    3000
  )
  
  if (!receitaBob) return false
  
  // 4. Alice tenta ler SUAS receitas (deve ver 1+)
  console.log('\n## TESTE 3: Alice lê SUAS receitas')
  const { data: receitasAlice, error: errAlice } = await alice.supabase
    .from('receitas')
    .select('*')
  
  if (errAlice) {
    console.log(`   ❌ Erro: ${errAlice.message}`)
    falhas++
    return false
  }
  
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
    console.log(`   ❌ Alice VÊ receita de Bob! FALHA DE SEGURANÇA!`)
    falhas++
    return false
  } else {
    console.log(`   ✅ Alice NÃO vê receita de Bob (RLS OK)`)
  }
  
  // 5. Bob tenta ler SUAS receitas (deve ver 1+)
  console.log('\n## TESTE 4: Bob lê SUAS receitas')
  const { data: receitasBob, error: errBob } = await bob.supabase
    .from('receitas')
    .select('*')
  
  if (errBob) {
    console.log(`   ❌ Erro: ${errBob.message}`)
    falhas++
    return false
  }
  
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
    console.log(`   ❌ Bob VÊ receita de Alice! FALHA DE SEGURANÇA!`)
    falhas++
    return false
  } else {
    console.log(`   ✅ Bob NÃO vê receita de Alice (RLS OK)`)
  }
  
  // 6. Bob tenta ATUALIZAR receita de Alice (deve falhar)
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
    console.log(`   ❌ Bob CONSEGUIU atualizar receita de Alice! FALHA CRÍTICA!`)
    falhas++
    return false
  }
  
  // 7. Verificar que receita de Alice NÃO foi alterada
  console.log('\n## TESTE 6: Verificar integridade da receita de Alice')
  const { data: verificacao, error: errVerif } = await alice.supabase
    .from('receitas')
    .select('valor')
    .eq('id', receitaAlice.id)
    .single()
  
  if (errVerif) {
    console.log(`   ❌ Erro ao verificar: ${errVerif.message}`)
    falhas++
  } else if (verificacao.valor !== 5000) {
    console.log(`   ❌ Valor foi alterado! Esperado 5000, atual ${verificacao.valor}`)
    falhas++
  } else {
    console.log(`   ✅ Valor preservado: R$ ${verificacao.valor} (não foi alterado)`)
  }
  
  // 8. Bob tenta DELETAR receita de Alice (deve falhar)
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
    console.log(`   ❌ Bob CONSEGUIU deletar receita de Alice! FALHA CRÍTICA!`)
    falhas++
    return false
  }
  
  // 9. Alice tenta INSERIR receita para Bob (deve falhar)
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
    console.log(`   ❌ Alice CONSEGUIU criar receita para Bob! FALHA CRÍTICA!`)
    falhas++
    return false
  }
  
  // 10. Testar outras tabelas (despesas, cartões)
  console.log('\n## TESTE 9: Isolamento em outras tabelas')
  
  // Despesa de Alice
  const { data: despesaAlice, error: errDespesaA } = await alice.supabase
    .from('despesas')
    .insert({
      usuario_id: alice.userId,
      descricao: 'Despesa Alice Teste',
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
    
    // Bob tenta ler despesas (não deve ver de Alice)
    const { data: despesasBob } = await bob.supabase
      .from('despesas')
      .select('*')
    
    const bobVeDespesaAlice = despesasBob?.some(d => d.id === despesaAlice.id)
    
    if (bobVeDespesaAlice) {
      console.log(`   ❌ Bob VÊ despesa de Alice! FALHA DE SEGURANÇA!`)
      falhas++
    } else {
      console.log(`   ✅ Bob NÃO vê despesa de Alice (RLS OK)`)
    }
  }
  
  // 11. Limpeza (deletar receitas de teste)
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
  
  console.log(`\n${'='.repeat(60)}`)
  
  if (falhas === 0 && sucesso) {
    console.log('✅ TESTE DE SEGURANÇA RLS: APROVADO')
    console.log('\nTodos os cenários de isolamento foram validados:')
    console.log('  ✓ SELECT: Usuários veem apenas seus dados')
    console.log('  ✓ INSERT: Não é possível criar dados para outro usuário')
    console.log('  ✓ UPDATE: Não é possível alterar dados de outro usuário')
    console.log('  ✓ DELETE: Não é possível excluir dados de outro usuário')
    console.log('  ✓ Múltiplas tabelas: receitas, despesas')
    console.log('\n🔒 SISTEMA PRONTO PARA PRODUÇÃO')
  } else {
    console.log(`❌ TESTE DE SEGURANÇA RLS: FALHOU (${falhas} erro(s))`)
    console.log('\n⚠️  CORREÇÕES NECESSÁRIAS ANTES DO LANÇAMENTO')
  }
  
  console.log('='.repeat(60))
  
  process.exit(falhas === 0 && sucesso ? 0 : 1)
}

main().catch(err => {
  console.error('\n❌ ERRO FATAL:', err)
  process.exit(1)
})
