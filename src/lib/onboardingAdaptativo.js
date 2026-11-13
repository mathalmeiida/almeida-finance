/**
 * onboardingAdaptativo.js
 * Lógica de análise e mapeamento de dados importados para etapas do onboarding.
 * 
 * REGRAS PRINCIPAIS:
 * - Dados importados PRÉ-PREENCHEM formulários
 * - Campos identificados com confiança PULAM solicitação manual
 * - Etapas parciais solicitam APENAS campos ausentes
 * - Nunca inventar dados (saldo, limite, vencimento, categoria recorrente)
 * - Diferenciar "não informado" de "valor zero"
 * - Detectar duplicidades entre importação e dados já confirmados
 */

/**
 * Analisa itens importados e retorna sugestões de preenchimento por etapa.
 * 
 * @param {Array} itensImportados - Itens processados pela importação inteligente
 * @param {Object} dadosExistentes - Dados já confirmados no banco
 * @returns {Object} Mapeamento { etapa: { status, dados, camposFaltantes } }
 */
export function analisarDadosImportados(itensImportados, dadosExistentes = {}) {
  const analise = {
    saldo: { status: null, dados: {}, camposFaltantes: [] },
    renda: { status: null, dados: [], camposFaltantes: [] },
    despesas: { status: null, dados: [], camposFaltantes: [] },
    cartoes: { status: null, dados: [], camposFaltantes: [] },
    investimentos: { status: null, dados: [], camposFaltantes: [] }
  }

  if (!itensImportados || itensImportados.length === 0) {
    return analise
  }

  // RECEITAS: mapeia tipos "receita" não duplicadas
  const receitas = itensImportados
    .filter(i => i.tipo === 'receita' && i.incluir && !i.status?.includes('duplicat'))
    .map(r => ({
      descricao: r.descricao,
      valor: Math.abs(r.valor),
      data: r.data,
      categoria: r.categoriaNome || 'Outras receitas',
      _importado: true,
      _revisar: r.revisar || false,
      // Não assume recorrência automaticamente
      recorrente: false,
      frequencia: 'nao_repete'
    }))

  if (receitas.length > 0) {
    analise.renda.dados = receitas
    analise.renda.status = 'importado'
    // Sugere revisar recorrência se houver múltiplos lançamentos similares
    const descricoesDuplicadas = contarDescricoesSimilares(receitas)
    if (descricoesDuplicadas.length > 0) {
      analise.renda.camposFaltantes.push('recorrencia')
      analise.renda.status = 'parcial'
    }
  }

  // DESPESAS: mapeia tipos "despesa" não duplicadas
  const despesas = itensImportados
    .filter(i => i.tipo === 'despesa' && i.incluir && !i.status?.includes('duplicat'))
    .map(d => ({
      descricao: d.descricao,
      valor: Math.abs(d.valor),
      data: d.data,
      categoria_id: d.categoriaId || null,
      subcategoria_id: null,
      tipo_despesa: null, // Não assume fixa/variável/ocasional
      forma_pagamento: null, // Não assume forma de pagamento
      _importado: true,
      _revisar: d.revisar || false,
      recorrente: false,
      frequencia: 'nao_repete'
    }))

  if (despesas.length > 0) {
    analise.despesas.dados = despesas
    analise.despesas.camposFaltantes = ['tipo_despesa', 'forma_pagamento']
    analise.despesas.status = 'parcial'
  }

  // CARTÕES: extrai cartões únicos de compras
  const comprasCartao = itensImportados
    .filter(i => i.tipo === 'compra_cartao' && i.incluir)

  if (comprasCartao.length > 0) {
    const cartoesMap = new Map()

    comprasCartao.forEach(compra => {
      if (compra.cartaoNome && !cartoesMap.has(compra.cartaoNome)) {
        cartoesMap.set(compra.cartaoNome, {
          nome: compra.cartaoNome,
          banco: compra.banco || null,
          limite_total: null, // NUNCA inventar limite
          dia_fechamento: null, // NUNCA inventar vencimento
          dia_vencimento: null,
          cor: null,
          _importado: true,
          _revisar: true,
          _compras: []
        })
      }

      const cartao = cartoesMap.get(compra.cartaoNome)
      if (cartao) {
        cartao._compras.push({
          descricao: compra.descricao,
          valor: Math.abs(compra.valor),
          data: compra.data,
          parcelas: compra.parcela ? `${compra.parcela.atual}/${compra.parcela.total}` : null
        })
      }
    })

    if (cartoesMap.size > 0) {
      analise.cartoes.dados = Array.from(cartoesMap.values())
      analise.cartoes.camposFaltantes = ['limite_total', 'dia_fechamento', 'dia_vencimento']
      analise.cartoes.status = 'parcial'
    }
  }

  // INVESTIMENTOS: extrai ativos únicos de movimentações
  const movInvestimentos = itensImportados
    .filter(i => ['aporte', 'resgate', 'rendimento', 'dividendo'].includes(i.tipo) && i.incluir)

  if (movInvestimentos.length > 0) {
    const investimentosMap = new Map()

    movInvestimentos.forEach(mov => {
      if (mov.investimentoNome && !investimentosMap.has(mov.investimentoNome)) {
        investimentosMap.set(mov.investimentoNome, {
          nome: mov.investimentoNome,
          categoria: mov.categoriaInvestimento || 'outros',
          valor_aplicado: 0,
          valor_atual: 0,
          data_aplicacao: mov.data,
          _importado: true,
          _revisar: true,
          _movimentacoes: []
        })
      }

      const inv = investimentosMap.get(mov.investimentoNome)
      if (inv) {
        inv._movimentacoes.push({
          tipo: mov.tipo,
          valor: Math.abs(mov.valor),
          data: mov.data
        })

        // Calcula saldos aproximados (soma aportes - resgates + rendimentos)
        if (mov.tipo === 'aporte') inv.valor_aplicado += Math.abs(mov.valor)
        if (mov.tipo === 'resgate') inv.valor_aplicado -= Math.abs(mov.valor)
        if (['rendimento', 'dividendo'].includes(mov.tipo)) {
          inv.valor_atual += Math.abs(mov.valor)
        }
      }
    })

    if (investimentosMap.size > 0) {
      analise.investimentos.dados = Array.from(investimentosMap.values())
      analise.investimentos.camposFaltantes = ['valor_atual'] // Precisa confirmar saldos
      analise.investimentos.status = 'parcial'

      // Se houver investimentos, também marca saldo como parcial
      analise.saldo.status = 'parcial'
      analise.saldo.camposFaltantes = ['patrimonio_confirmado']
    }
  }

  // SALDO: NÃO tenta deduzir saldo_base automaticamente
  // Apenas marca como pendente se não houver saldo informado
  if (!dadosExistentes.saldo_base) {
    analise.saldo.status = analise.saldo.status || 'pendente'
    analise.saldo.camposFaltantes.push('saldo_base', 'saldo_base_data')
  }

  return analise
}

/**
 * Identifica descrições similares que podem ser recorrentes.
 * Retorna array de grupos com 2+ ocorrências.
 */
function contarDescricoesSimilares(itens) {
  const grupos = {}

  itens.forEach(item => {
    const normalizada = normalizarTexto(item.descricao)
    grupos[normalizada] = (grupos[normalizada] || 0) + 1
  })

  return Object.entries(grupos)
    .filter(([_, qtd]) => qtd >= 2)
    .map(([desc, qtd]) => ({ descricao: desc, ocorrencias: qtd }))
}

/**
 * Normaliza texto para comparação (remove acentos, minúsculas, espaços).
 */
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta se um item importado é duplicata de um item confirmado.
 * Usa mesma lógica de similaridade da importação (data±3 dias + Jaccard).
 */
export function ehDuplicataConfirmado(itemImportado, itensConfirmados) {
  if (!itensConfirmados || itensConfirmados.length === 0) return false

  const dataImportada = new Date(itemImportado.data)
  const valorImportado = Math.abs(itemImportado.valor)

  return itensConfirmados.some(confirmado => {
    const dataConfirmada = new Date(confirmado.data)
    const valorConfirmado = Math.abs(confirmado.valor)

    // Diferença de data <= 3 dias
    const diffDias = Math.abs(dataImportada - dataConfirmada) / (1000 * 60 * 60 * 24)
    if (diffDias > 3) return false

    // Diferença de valor <= 1%
    const diffValor = Math.abs(valorImportado - valorConfirmado) / Math.max(valorImportado, valorConfirmado)
    if (diffValor > 0.01) return false

    // Similaridade de texto (Jaccard) >= 0.6
    const sim = calcularSimilaridade(itemImportado.descricao, confirmado.descricao)
    return sim >= 0.6
  })
}

/**
 * Calcula similaridade de Jaccard entre dois textos.
 */
function calcularSimilaridade(texto1, texto2) {
  const tokens1 = new Set(normalizarTexto(texto1).split(/\s+/))
  const tokens2 = new Set(normalizarTexto(texto2).split(/\s+/))

  const intersecao = new Set([...tokens1].filter(t => tokens2.has(t)))
  const uniao = new Set([...tokens1, ...tokens2])

  return uniao.size === 0 ? 0 : intersecao.size / uniao.size
}

/**
 * Determina próxima etapa a solicitar com base no status.
 * Pula etapas confirmadas, prioriza parciais sobre pendentes.
 */
export function determinarProximaEtapa(statusEtapas, etapaAtual) {
  const ordem = ['perfil', 'importacao', 'saldo', 'renda', 'despesas', 'cartoes', 'metas', 'reserva']
  
  // Após etapa atual, busca primeira que precisa ação
  const indiceAtual = ordem.indexOf(etapaAtual)
  
  for (let i = indiceAtual + 1; i < ordem.length; i++) {
    const etapa = ordem[i]
    const status = statusEtapas[etapa]
    
    // Pula confirmadas
    if (status === 'confirmado') continue
    
    // Prioriza parciais (precisa complementar)
    if (status === 'parcial') return etapa
    
    // Depois pendentes
    if (status === 'pendente') return etapa
    
    // Etapas sem status (não preenchidas) também precisam ação
    if (!status) return etapa
  }
  
  // Se todas estão confirmadas, retorna 'final'
  return 'final'
}

/**
 * Valida se uma etapa pode ser pulada automaticamente.
 * Critérios:
 * - Status 'confirmado' ou 'importado' (sem campos faltantes)
 * - Não é etapa obrigatória sem dados (perfil, saldo)
 */
export function podePularEtapa(etapa, statusEtapas, camposFaltantes) {
  const status = statusEtapas[etapa]
  
  // Perfil nunca pode ser pulado (sempre obrigatório)
  if (etapa === 'perfil') return false
  
  // Confirmadas podem ser puladas
  if (status === 'confirmado') return true
  
  // Importadas SEM campos faltantes podem ser puladas
  if (status === 'importado' && (!camposFaltantes || camposFaltantes.length === 0)) {
    return true
  }
  
  // Demais casos: não pular
  return false
}

/**
 * Gera mensagem de resumo para tela final.
 */
export function gerarResumoImportacao(estatisticas) {
  if (!estatisticas || estatisticas.total === 0) {
    return 'Cadastro realizado manualmente'
  }

  const partes = []
  
  if (estatisticas.importados.receitas > 0) {
    partes.push(`${estatisticas.importados.receitas} receita${estatisticas.importados.receitas > 1 ? 's' : ''}`)
  }
  
  if (estatisticas.importados.despesas > 0) {
    partes.push(`${estatisticas.importados.despesas} despesa${estatisticas.importados.despesas > 1 ? 's' : ''}`)
  }
  
  if (estatisticas.importados.cartoes > 0) {
    partes.push(`${estatisticas.importados.cartoes} cartão${estatisticas.importados.cartoes > 1 ? 'ões' : ''}`)
  }
  
  if (estatisticas.importados.investimentos > 0) {
    partes.push(`${estatisticas.importados.investimentos} investimento${estatisticas.importados.investimentos > 1 ? 's' : ''}`)
  }

  if (partes.length === 0) return 'Cadastro realizado manualmente'
  
  if (partes.length === 1) return `Importados: ${partes[0]}`
  
  const ultimas = partes.slice(-2).join(' e ')
  const anteriores = partes.slice(0, -2)
  
  if (anteriores.length === 0) {
    return `Importados: ${ultimas}`
  }
  
  return `Importados: ${anteriores.join(', ')}, ${ultimas}`
}
