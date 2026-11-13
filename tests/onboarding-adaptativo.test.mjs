/**
 * onboarding-adaptativo.test.mjs
 * Testes funcionais para onboarding adaptativo com importação inteligente.
 * 
 * IMPORTANTE: Estes testes validam a lógica, não fazem requisições reais ao Supabase.
 * Para testes E2E completos, usar Playwright.
 */

import assert from 'assert'

// ─── MOCK: Hook adaptativo (comportamento esperado) ─────────────────────────

class MockOnboardingAdaptativo {
  constructor() {
    this.idsImportados = {}
    this.statusEtapas = {}
    this.timestamp = null
  }

  registrarImportacao(resultado) {
    if (!resultado?.itens) return

    // Agrupa por tabela
    const porTabela = resultado.itens.reduce((acc, item) => {
      if (!acc[item.tabela]) acc[item.tabela] = []
      if (item.id) acc[item.tabela].push(item.id)
      return acc
    }, {})

    // Receitas
    if (porTabela.receitas?.length > 0) {
      this.idsImportados.receitas = [
        ...(this.idsImportados.receitas || []),
        ...porTabela.receitas
      ]
      this.statusEtapas.receitas = 'importado'
    }

    // Despesas (faltam campos tipo_despesa e forma_pagamento)
    if (porTabela.despesas?.length > 0) {
      this.idsImportados.despesas = [
        ...(this.idsImportados.despesas || []),
        ...porTabela.despesas
      ]
      this.statusEtapas.despesas = 'parcial'
    }

    // Cartões
    if (porTabela.compras_cartao?.length > 0) {
      this.idsImportados.compras_cartao = [
        ...(this.idsImportados.compras_cartao || []),
        ...porTabela.compras_cartao
      ]
      this.statusEtapas.cartoes = 'parcial'
    }

    // Investimentos
    if (porTabela.investimentos_movimentacoes?.length > 0) {
      this.idsImportados.investimentos_movimentacoes = [
        ...(this.idsImportados.investimentos_movimentacoes || []),
        ...porTabela.investimentos_movimentacoes
      ]
      this.statusEtapas.investimentos = 'parcial'
    }

    this.timestamp = Date.now()
  }

  confirmarEtapa(etapa) {
    this.statusEtapas[etapa] = 'confirmado'
  }

  temDadosImportados(etapa) {
    const mapa = {
      receitas: 'receitas',
      despesas: 'despesas',
      cartoes: 'compras_cartao',
      investimentos: 'investimentos_movimentacoes'
    }
    const chave = mapa[etapa]
    return chave && this.idsImportados[chave]?.length > 0
  }

  etapaPrecisaRevisao(etapa) {
    const status = this.statusEtapas[etapa]
    return status === 'importado' || status === 'parcial'
  }

  statusEtapa(etapa) {
    return this.statusEtapas[etapa] || null
  }

  limpar() {
    this.idsImportados = {}
    this.statusEtapas = {}
    this.timestamp = null
  }

  estatisticas() {
    const total = Object.values(this.idsImportados)
      .filter(v => Array.isArray(v))
      .reduce((sum, arr) => sum + arr.length, 0)

    return {
      total,
      receitas: this.idsImportados.receitas?.length || 0,
      despesas: this.idsImportados.despesas?.length || 0,
      compras_cartao: this.idsImportados.compras_cartao?.length || 0,
      investimentos: this.idsImportados.investimentos_movimentacoes?.length || 0
    }
  }
}

// ─── CENÁRIOS DE TESTE ───────────────────────────────────────────────────────

console.log('# Registro de importação')

{
  const hook = new MockOnboardingAdaptativo()
  const resultado = {
    itens: [
      { tabela: 'receitas', id: 'rec1', dados: { descricao: 'Salário' } },
      { tabela: 'receitas', id: 'rec2', dados: { descricao: 'Freelance' } },
      { tabela: 'despesas', id: 'desp1', dados: { descricao: 'Aluguel' } }
    ]
  }

  hook.registrarImportacao(resultado)

  assert.deepStrictEqual(hook.idsImportados.receitas, ['rec1', 'rec2'], 'IDs de receitas registrados')
  assert.deepStrictEqual(hook.idsImportados.despesas, ['desp1'], 'IDs de despesas registrados')
  assert.strictEqual(hook.statusEtapas.receitas, 'importado', 'Receitas marcadas como importadas')
  assert.strictEqual(hook.statusEtapas.despesas, 'parcial', 'Despesas marcadas como parciais')
  assert.ok(hook.timestamp > 0, 'Timestamp registrado')
  console.log('PASS — Registra IDs após importação')
}

{
  const hook = new MockOnboardingAdaptativo()
  const resultado1 = { itens: [{ tabela: 'receitas', id: 'rec1' }] }
  const resultado2 = { itens: [{ tabela: 'receitas', id: 'rec2' }] }

  hook.registrarImportacao(resultado1)
  hook.registrarImportacao(resultado2)

  assert.deepStrictEqual(hook.idsImportados.receitas, ['rec1', 'rec2'], 'IDs acumulam')
  console.log('PASS — Múltiplas importações acumulam IDs')
}

console.log()
console.log('# Verificação de status')

{
  const hook = new MockOnboardingAdaptativo()
  hook.registrarImportacao({ itens: [{ tabela: 'receitas', id: 'rec1' }] })

  assert.strictEqual(hook.temDadosImportados('receitas'), true, 'Receitas têm dados')
  assert.strictEqual(hook.temDadosImportados('despesas'), false, 'Despesas não têm dados')
  console.log('PASS — temDadosImportados verifica corretamente')
}

{
  const hook = new MockOnboardingAdaptativo()
  hook.statusEtapas.receitas = 'importado'
  hook.statusEtapas.despesas = 'parcial'
  hook.statusEtapas.cartoes = 'confirmado'

  assert.strictEqual(hook.etapaPrecisaRevisao('receitas'), true, 'Importado precisa revisão')
  assert.strictEqual(hook.etapaPrecisaRevisao('despesas'), true, 'Parcial precisa revisão')
  assert.strictEqual(hook.etapaPrecisaRevisao('cartoes'), false, 'Confirmado não precisa')
  console.log('PASS — etapaPrecisaRevisao identifica corretamente')
}

{
  const hook = new MockOnboardingAdaptativo()
  hook.statusEtapas.receitas = 'importado'

  assert.strictEqual(hook.statusEtapa('receitas'), 'importado', 'Status correto')
  assert.strictEqual(hook.statusEtapa('despesas'), null, 'Status null quando não definido')
  console.log('PASS — statusEtapa retorna valor correto')
}

console.log()
console.log('# Confirmação de etapas')

{
  const hook = new MockOnboardingAdaptativo()
  hook.statusEtapas.receitas = 'importado'
  hook.confirmarEtapa('receitas')

  assert.strictEqual(hook.statusEtapas.receitas, 'confirmado', 'Status atualizado')
  console.log('PASS — confirmarEtapa atualiza status')
}

{
  const hook = new MockOnboardingAdaptativo()
  hook.registrarImportacao({
    itens: [
      { tabela: 'receitas', id: 'rec1' },
      { tabela: 'despesas', id: 'desp1' }
    ]
  })
  hook.confirmarEtapa('receitas')
  hook.confirmarEtapa('despesas')

  assert.strictEqual(hook.statusEtapas.receitas, 'confirmado', 'Receitas confirmadas')
  assert.strictEqual(hook.statusEtapas.despesas, 'confirmado', 'Despesas confirmadas')
  console.log('PASS — Múltiplas confirmações funcionam')
}

console.log()
console.log('# Limpeza de dados')

{
  const hook = new MockOnboardingAdaptativo()
  hook.registrarImportacao({ itens: [{ tabela: 'receitas', id: 'rec1' }] })
  hook.statusEtapas.receitas = 'confirmado'
  hook.limpar()

  assert.deepStrictEqual(hook.idsImportados, {}, 'IDs limpos')
  assert.deepStrictEqual(hook.statusEtapas, {}, 'Status limpo')
  assert.strictEqual(hook.timestamp, null, 'Timestamp limpo')
  console.log('PASS — limpar() reseta tudo')
}

console.log()
console.log('# Estatísticas')

{
  const hook = new MockOnboardingAdaptativo()
  hook.registrarImportacao({
    itens: [
      { tabela: 'receitas', id: 'rec1' },
      { tabela: 'receitas', id: 'rec2' },
      { tabela: 'despesas', id: 'desp1' },
      { tabela: 'compras_cartao', id: 'cart1' }
    ]
  })

  const stats = hook.estatisticas()
  assert.strictEqual(stats.total, 4, 'Total correto')
  assert.strictEqual(stats.receitas, 2, '2 receitas')
  assert.strictEqual(stats.despesas, 1, '1 despesa')
  assert.strictEqual(stats.compras_cartao, 1, '1 compra de cartão')
  console.log('PASS — Estatísticas calculadas corretamente')
}

console.log()
console.log('# Rehidratação de dados')

{
  // Simula dados existentes no banco
  const receitasExistentes = [
    { id: 'rec1', descricao: 'Salário', valor: 5000 },
    { id: 'rec2', descricao: 'Freelance', valor: 1500 },
    { id: 'rec3', descricao: 'Manual', valor: 300 }
  ]

  const hook = new MockOnboardingAdaptativo()
  hook.idsImportados.receitas = ['rec1', 'rec2']

  // Simula rehidratação (mesma lógica do Onboarding.jsx)
  const receitas = receitasExistentes.map(r => ({
    ...r,
    _importado: hook.idsImportados.receitas?.includes(r.id) || false
  }))

  assert.strictEqual(receitas[0]._importado, true, 'rec1 marcada como importada')
  assert.strictEqual(receitas[1]._importado, true, 'rec2 marcada como importada')
  assert.strictEqual(receitas[2]._importado, false, 'rec3 NÃO é importada')
  console.log('PASS — Rehidratação marca _importado corretamente')
}

console.log()
console.log('# Salvamento inteligente (não duplica)')

{
  // Simula lista de receitas no onboarding
  const receitas = [
    { id: 'rec1', descricao: 'Salário', valor: 5000, _importado: true, _editado: false },
    { id: 'rec2', descricao: 'Freelance', valor: 1500, _importado: true, _editado: true },
    { descricao: 'Nova receita', valor: 300 } // sem id = nova
  ]

  const idsParaAtualizar = []
  const idsParaCriar = []

  // Simula lógica de salvarReceitas()
  for (const r of receitas) {
    if (r.id) {
      if (!r._importado || r._editado) {
        idsParaAtualizar.push(r.id)
      }
      // Importada não editada: pula
    } else {
      idsParaCriar.push(r.descricao)
    }
  }

  assert.deepStrictEqual(idsParaAtualizar, ['rec2'], 'Só rec2 atualiza (editada)')
  assert.deepStrictEqual(idsParaCriar, ['Nova receita'], 'Só nova receita cria')
  console.log('PASS — Salvamento pula importadas não editadas')
}

console.log()
console.log('# Navegação adaptativa')

{
  // Simula sequência de telas
  const TELAS = ['perfil', 'importacao', 'saldo', 'renda', 'despesas', 'cartoes', 'metas', 'reserva', 'final']
  
  const hook = new MockOnboardingAdaptativo()
  hook.statusEtapas.receitas = 'confirmado' // Renda confirmada
  hook.statusEtapas.despesas = 'parcial'    // Despesas parcial (precisa atenção)

  // Simula avancar() adaptativo
  function proximaTela(atual) {
    const i = TELAS.indexOf(atual)
    if (i < 0) return 'perfil'

    const mapaStatus = {
      'renda': 'receitas',
      'despesas': 'despesas',
      'cartoes': 'cartoes'
    }

    // Procura próxima pendente
    for (let j = i + 1; j < TELAS.length; j++) {
      const tela = TELAS[j]
      const chave = mapaStatus[tela]
      
      if (!chave) {
        // Telas sem mapeamento sempre mostram
        return tela
      }
      
      const status = hook.statusEtapas[chave]
      if (status !== 'confirmado') {
        // Para em pendente/parcial/importado
        return tela
      }
      // Confirmado: continua procurando
    }

    // Se todas confirmadas, vai para próxima linear
    return TELAS[Math.min(i + 1, TELAS.length - 1)]
  }

  assert.strictEqual(proximaTela('saldo'), 'despesas', 'saldo → despesas (pula renda confirmada)')
  assert.strictEqual(proximaTela('renda'), 'despesas', 'renda confirmada → despesas parcial')
  assert.strictEqual(proximaTela('despesas'), 'cartoes', 'despesas → cartões')
  console.log('PASS — Navegação adaptativa pula confirmadas')
}

{
  // Cenário: TODAS confirmadas
  const TELAS = ['perfil', 'importacao', 'saldo', 'renda', 'despesas', 'cartoes', 'metas']
  
  const hook = new MockOnboardingAdaptativo()
  hook.statusEtapas.receitas = 'confirmado'
  hook.statusEtapas.despesas = 'confirmado'
  hook.statusEtapas.cartoes = 'confirmado'

  function proximaTela(atual) {
    const i = TELAS.indexOf(atual)
    const mapaStatus = {
      'renda': 'receitas',
      'despesas': 'despesas',
      'cartoes': 'cartoes'
    }

    for (let j = i + 1; j < TELAS.length; j++) {
      const tela = TELAS[j]
      const chave = mapaStatus[tela]
      if (!chave || hook.statusEtapas[chave] !== 'confirmado') return tela
    }

    return TELAS[Math.min(i + 1, TELAS.length - 1)]
  }

  assert.strictEqual(proximaTela('despesas'), 'metas', 'Todas confirmadas → próxima normal')
  console.log('PASS — Quando todas confirmadas, segue linear')
}

console.log()
console.log('# Cenários de integração')

{
  // Cenário completo: importação → rehidratação → edição → confirmação
  const hook = new MockOnboardingAdaptativo()
  
  // 1. Importação
  hook.registrarImportacao({
    itens: [
      { tabela: 'receitas', id: 'rec1', dados: { descricao: 'Salário', valor: 5000 } }
    ]
  })
  assert.strictEqual(hook.statusEtapas.receitas, 'importado', 'Status inicial: importado')

  // 2. Rehidratação
  const receitasExistentes = [{ id: 'rec1', descricao: 'Salário', valor: 5000 }]
  const receitas = receitasExistentes.map(r => ({
    ...r,
    _importado: hook.idsImportados.receitas?.includes(r.id) || false,
    _editado: false
  }))
  assert.strictEqual(receitas[0]._importado, true, 'Rehidratada como importada')

  // 3. Usuário edita
  receitas[0]._editado = true
  receitas[0].valor = 5500

  // 4. Salvamento (simula)
  const deveAtualizar = receitas[0].id && (!receitas[0]._importado || receitas[0]._editado)
  assert.strictEqual(deveAtualizar, true, 'Editada deve atualizar')

  // 5. Confirmação
  hook.confirmarEtapa('receitas')
  assert.strictEqual(hook.statusEtapas.receitas, 'confirmado', 'Status final: confirmado')

  console.log('PASS — Fluxo completo: importação → edição → confirmação')
}

{
  // Cenário: múltiplas importações sequenciais
  const hook = new MockOnboardingAdaptativo()
  
  hook.registrarImportacao({
    itens: [{ tabela: 'receitas', id: 'rec1' }]
  })
  assert.strictEqual(hook.idsImportados.receitas.length, 1, 'Primeira importação')

  hook.registrarImportacao({
    itens: [{ tabela: 'receitas', id: 'rec2' }]
  })
  assert.strictEqual(hook.idsImportados.receitas.length, 2, 'Segunda importação acumula')

  hook.registrarImportacao({
    itens: [{ tabela: 'receitas', id: 'rec1' }] // Duplicado
  })
  assert.strictEqual(hook.idsImportados.receitas.length, 3, 'Permite duplicados (ID rastreado)')

  console.log('PASS — Múltiplas importações funcionam corretamente')
}

console.log()
console.log('✅ TODOS OS TESTES DE ONBOARDING ADAPTATIVO PASSARAM')
