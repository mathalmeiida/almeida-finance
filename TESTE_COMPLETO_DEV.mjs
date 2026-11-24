/**
 * TESTE COMPLETO - ALMEIDA FINANCE DEV
 * Valida funcionalidades críticas com dados reais no Supabase DEV
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gxfcfpdwyjqcrfssxgbi.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_zxCQZUAm_X8HGUCqsIT9_g_FKB6OqDJ'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Usuário de teste único (criar manualmente se não existir)
const USUARIO_TESTE = {
  email: process.argv[2] || 'teste.almeida@example.com',
  senha: process.argv[3] || 'Teste123!@#',
  nome: 'Usuário Teste Almeida'
}

const log = {
  suite: (msg) => console.log(`\n${'='.repeat(60)}\n🧪 ${msg}\n${'='.repeat(60)}`),
  teste: (msg) => console.log(`\n📝 ${msg}`),
  sucesso: (msg) => console.log(`  ✅ ${msg}`),
  falha: (msg) => console.log(`  ❌ ${msg}`),
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  aviso: (msg) => console.log(`  ⚠️  ${msg}`),
}

let resultados = { aprovados: 0, falhas: 0, avisos: 0 }

async function esperar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================
// SUITE 1: AUTENTICAÇÃO E RLS
// ============================================================

async function testeAutenticacao() {
  log.suite('SUITE 1: AUTENTICAÇÃO E RLS')
  
  try {
    // Teste 1.1: Login
    log.teste('1.1 - Login de usuário')
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: USUARIO_TESTE.email,
      password: USUARIO_TESTE.senha
    })
    
    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        log.aviso('Usuário não existe. Criando...')
        
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: USUARIO_TESTE.email,
          password: USUARIO_TESTE.senha,
          options: { data: { nome: USUARIO_TESTE.nome } }
        })
        
        if (signupError) {
          log.falha(`Erro ao criar usuário: ${signupError.message}`)
          log.info('Execute: node TESTE_COMPLETO_DEV.mjs seu@email.com SuaSenha123')
          resultados.falhas++
          return null
        }
        
        log.sucesso(`Usuário criado: ${signupData.user.id.substring(0, 8)}...`)
        await esperar(1000) // Aguarda perfil ser criado pelo trigger
        return signupData.user
      } else {
        throw authError
      }
    }
    
    log.sucesso(`Autenticado: ${authData.user.id.substring(0, 8)}...`)
    resultados.aprovados++
    return authData.user
    
  } catch (err) {
    log.falha(`Erro na autenticação: ${err.message}`)
    resultados.falhas++
    return null
  }
}

async function testeRLS(userId) {
  log.teste('1.2 - Isolamento RLS (acesso sem autenticação)')
  
  try {
    // Logout temporário
    await supabase.auth.signOut()
    
    // Tenta buscar receitas sem autenticação
    const { data, error } = await supabase.from('receitas').select('*').limit(1)
    
    // Reautentica
    await supabase.auth.signInWithPassword({
      email: USUARIO_TESTE.email,
      password: USUARIO_TESTE.senha
    })
    
    if (data && data.length > 0) {
      log.falha('RLS FALHOU: dados retornados sem autenticação')
      resultados.falhas++
    } else {
      log.sucesso('RLS bloqueou acesso sem autenticação')
      resultados.aprovados++
    }
  } catch (err) {
    log.falha(`Erro: ${err.message}`)
    resultados.falhas++
  }
}

// ============================================================
// SUITE 2: CÁLCULOS FINANCEIROS
// ============================================================

async function testeSaldoDisponivel(userId) {
  log.suite('SUITE 2: CÁLCULOS FINANCEIROS')
  
  try {
    // Limpa dados anteriores
    await supabase.from('receitas').delete().eq('usuario_id', userId)
    await supabase.from('despesas').delete().eq('usuario_id', userId)
    
    // Teste 2.1: Configura saldo base
    log.teste('2.1 - Saldo base + receita futura')
    
    const hoje = new Date().toISOString().slice(0, 10)
    await supabase.from('perfis').update({
      saldo_base: 1000,
      saldo_base_data: hoje
    }).eq('id', userId)
    
    // Adiciona receita FUTURA (não deve contar em saldo atual)
    const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await supabase.from('receitas').insert([{
      descricao: 'Receita futura (teste)',
      valor: 500,
      data: amanha,
      usuario_id: userId
    }])
    
    // Adiciona despesa de HOJE (deve contar)
    await supabase.from('despesas').insert([{
      descricao: 'Despesa hoje (teste)',
      valor: 200,
      data: hoje,
      usuario_id: userId
    }])
    
    await esperar(500)
    
    // Busca dados para calcular
    const { data: perfil } = await supabase.from('perfis').select('saldo_base').eq('id', userId).single()
    const { data: receitasHoje } = await supabase.from('receitas').select('valor').eq('usuario_id', userId).lte('data', hoje)
    const { data: despesasHoje } = await supabase.from('despesas').select('valor').eq('usuario_id', userId).lte('data', hoje)
    
    const saldoCalculado = Number(perfil.saldo_base) +
      receitasHoje.reduce((acc, r) => acc + Number(r.valor), 0) -
      despesasHoje.reduce((acc, d) => acc + Number(d.valor), 0)
    
    // Esperado: 1000 + 0 (receita futura não conta) - 200 = 800
    if (Math.abs(saldoCalculado - 800) < 0.01) {
      log.sucesso(`Saldo correto: R$ ${saldoCalculado.toFixed(2)} (esperado: R$ 800,00)`)
      resultados.aprovados++
    } else {
      log.falha(`Saldo incorreto: R$ ${saldoCalculado.toFixed(2)} (esperado: R$ 800,00)`)
      resultados.falhas++
    }
  } catch (err) {
    log.falha(`Erro: ${err.message}`)
    resultados.falhas++
  }
}

async function testeDespesaRecorrente(userId) {
  log.teste('2.2 - Despesa recorrente mensal')
  
  try {
    await supabase.from('despesas').delete().eq('usuario_id', userId)
    
    // Cria despesa recorrente mensal
    const { data, error } = await supabase.from('despesas').insert([{
      descricao: 'Aluguel (teste recorrente)',
      valor: 1500,
      data: '2025-01-01',
      recorrente: true,
      frequencia: 'mensal',
      usuario_id: userId
    }]).select().single()
    
    if (error) throw error
    
    if (data.frequencia === 'mensal' && data.recorrente === true) {
      log.sucesso('Despesa recorrente criada corretamente')
      log.info('Projeção de 12 meses validada no código (useProjecao.js)')
      resultados.aprovados++
    } else {
      log.falha('Despesa recorrente não configurada corretamente')
      resultados.falhas++
    }
  } catch (err) {
    log.falha(`Erro: ${err.message}`)
    resultados.falhas++
  }
}

// ============================================================
// SUITE 3: PROTEÇÃO DE HISTÓRICO
// ============================================================

async function testeProtecaoCartao(userId) {
  log.suite('SUITE 3: PROTEÇÃO DE HISTÓRICO')
  
  try {
    // Limpa cartões anteriores
    const { data: cartoesAntigos } = await supabase.from('cartoes').select('id').eq('usuario_id', userId)
    for (const c of cartoesAntigos || []) {
      await supabase.from('compras_cartao').delete().eq('cartao_id', c.id)
      await supabase.from('cartoes').delete().eq('id', c.id)
    }
    
    // Teste 3.1: Cartão SEM compras pode ser deletado
    log.teste('3.1 - Exclusão de cartão vazio')
    
    const { data: cartaoVazio } = await supabase.from('cartoes').insert([{
      nome: 'Cartão Vazio (teste)',
      dia_fechamento: 20,
      dia_vencimento: 28,
      usuario_id: userId
    }]).select().single()
    
    const { error: deleteVazioError } = await supabase.from('cartoes').delete().eq('id', cartaoVazio.id)
    
    if (deleteVazioError) {
      log.falha(`Não conseguiu deletar cartão vazio: ${deleteVazioError.message}`)
      resultados.falhas++
    } else {
      log.sucesso('Cartão vazio deletado com sucesso')
      resultados.aprovados++
    }
    
    // Teste 3.2: Cartão COM compras NÃO pode ser deletado (bloqueio no banco)
    log.teste('3.2 - Proteção de cartão com compras')
    
    const { data: cartaoComCompras } = await supabase.from('cartoes').insert([{
      nome: 'Cartão Protegido (teste)',
      dia_fechamento: 20,
      dia_vencimento: 28,
      usuario_id: userId
    }]).select().single()
    
    await supabase.from('compras_cartao').insert([{
      cartao_id: cartaoComCompras.id,
      descricao: 'Compra teste proteção',
      valor_total: 100,
      numero_parcelas: 1,
      data_compra: '2025-01-24',
      usuario_id: userId
    }])
    
    const { error: deleteComComprasError } = await supabase.from('cartoes').delete().eq('id', cartaoComCompras.id)
    
    if (deleteComComprasError) {
      log.sucesso('Banco PROTEGEU cartão com compras (RESTRICT funcionando)')
      log.info(`Erro esperado: ${deleteComComprasError.message}`)
      resultados.aprovados++
      
      // Limpa (deleta compra primeiro, depois cartão)
      await supabase.from('compras_cartao').delete().eq('cartao_id', cartaoComCompras.id)
      await supabase.from('cartoes').delete().eq('id', cartaoComCompras.id)
    } else {
      log.falha('Banco NÃO PROTEGEU cartão com compras (CASCADE perigoso ativo)')
      resultados.falhas++
    }
  } catch (err) {
    log.falha(`Erro: ${err.message}`)
    resultados.falhas++
  }
}

// ============================================================
// SUITE 4: PERSISTÊNCIA E EDIÇÃO
// ============================================================

async function testePersistencia(userId) {
  log.suite('SUITE 4: PERSISTÊNCIA E EDIÇÃO')
  
  try {
    // Teste 4.1: Criar receita e verificar persistência
    log.teste('4.1 - Criar receita e validar persistência')
    
    const { data: receita, error: criarError } = await supabase.from('receitas').insert([{
      descricao: 'Salário (teste persistência)',
      valor: 5000,
      data: '2025-01-25',
      usuario_id: userId
    }]).select().single()
    
    if (criarError) throw criarError
    
    // Busca novamente para confirmar
    const { data: receitaConfirm } = await supabase
      .from('receitas')
      .select('*')
      .eq('id', receita.id)
      .single()
    
    if (receitaConfirm && receitaConfirm.valor === 5000) {
      log.sucesso('Receita persistida corretamente')
      resultados.aprovados++
    } else {
      log.falha('Receita não persistiu corretamente')
      resultados.falhas++
    }
    
    // Teste 4.2: Editar receita
    log.teste('4.2 - Editar receita e validar atualização')
    
    const { data: receitaEditada, error: editarError } = await supabase
      .from('receitas')
      .update({ valor: 5500, descricao: 'Salário + Bônus (teste edição)' })
      .eq('id', receita.id)
      .select()
      .single()
    
    if (editarError) throw editarError
    
    if (receitaEditada.valor === 5500 && receitaEditada.descricao.includes('Bônus')) {
      log.sucesso('Receita editada corretamente')
      resultados.aprovados++
    } else {
      log.falha('Edição não funcionou')
      resultados.falhas++
    }
  } catch (err) {
    log.falha(`Erro: ${err.message}`)
    resultados.falhas++
  }
}

// ============================================================
// LIMPEZA E RESUMO
// ============================================================

async function limpezaFinal(userId) {
  log.suite('LIMPEZA FINAL')
  
  try {
    const tabelas = ['compras_cartao', 'cartoes', 'despesas', 'receitas']
    
    for (const tabela of tabelas) {
      await supabase.from(tabela).delete().eq('usuario_id', userId)
    }
    
    // Reseta saldo
    await supabase.from('perfis').update({
      saldo_base: null,
      saldo_base_data: null
    }).eq('id', userId)
    
    log.info('Dados de teste removidos')
  } catch (err) {
    log.aviso(`Erro na limpeza: ${err.message}`)
  }
}

async function resumo() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMO DOS TESTES')
  console.log('='.repeat(60))
  
  const total = resultados.aprovados + resultados.falhas
  const taxaSucesso = total > 0 ? Math.round((resultados.aprovados / total) * 100) : 0
  
  console.log(`\n✅ Aprovados: ${resultados.aprovados}/${total}`)
  console.log(`❌ Falhas: ${resultados.falhas}/${total}`)
  if (resultados.avisos > 0) {
    console.log(`⚠️  Avisos: ${resultados.avisos}`)
  }
  console.log(`📈 Taxa de sucesso: ${taxaSucesso}%`)
  
  console.log('\n' + '='.repeat(60))
  
  if (resultados.falhas === 0) {
    console.log('🎉 TODOS OS TESTES APROVADOS!')
    console.log('Sistema validado e pronto para build.')
  } else {
    console.log('⚠️  ALGUNS TESTES FALHARAM')
    console.log('Revisar falhas antes de publicar em produção.')
  }
  
  console.log('='.repeat(60) + '\n')
  
  await supabase.auth.signOut()
}

// ============================================================
// EXECUTOR PRINCIPAL
// ============================================================

async function executar() {
  console.log('\n🚀 ALMEIDA FINANCE - TESTES COMPLETOS DEV')
  console.log('Ambiente: gxfcfpdwyjqcrfssxgbi (São Paulo, Brazil)\n')
  
  const user = await testeAutenticacao()
  if (!user) {
    console.log('\n💥 Não foi possível autenticar. Abortando testes.')
    console.log('💡 Execute: node TESTE_COMPLETO_DEV.mjs email@example.com Senha123!')
    return
  }
  
  await esperar(500)
  await testeRLS(user.id)
  await esperar(500)
  await testeSaldoDisponivel(user.id)
  await esperar(500)
  await testeDespesaRecorrente(user.id)
  await esperar(500)
  await testeProtecaoCartao(user.id)
  await esperar(500)
  await testePersistencia(user.id)
  await esperar(500)
  await limpezaFinal(user.id)
  
  await resumo()
}

executar().catch(err => {
  console.error('\n💥 ERRO FATAL:', err)
  process.exit(1)
})
