// ─── Interpretação dos registros brutos ──────────────────────────────────────
// Transforma cada linha lida (data, descrição, valor) em um item com natureza
// (receita, despesa, transferência, compra, estorno, aporte, dividendo...),
// meio de pagamento, parcelamento e destino no app. Regras determinísticas;
// quando a evidência é fraca, o item recebe uma PENDÊNCIA para conferência.

import { normalizarDescricao, arred2, tokensSignificativos } from './normalizar.js'

// ═══ Extrato bancário ════════════════════════════════════════════════════════

const RE_PAG_FATURA = /\b(PAGAMENTO (DE )?FATURA|PAG FATURA|PGTO FATURA|PAGTO FATURA|FATURA CARTAO|PAGTO CARTAO|PAGAMENTO CARTAO|PAG CARTAO|PGTO CARTAO|CARTAO DE CREDITO|DEB CARTAO CREDITO|PAG CC|FATURA NUBANK|FATURA ITAUCARD)\b/
const RE_APLICACAO = /\b(APLICACAO|APLIC|APL|INVESTIMENTO|INVEST|CDB|RDB|LCI|LCA|TESOURO|COMPRA TITULO|POUPANCA|CAIXINHA|GUARDADO|COFRINHO)\b/
const RE_RESGATE = /\b(RESGATE|RESG|RESGATADO|RESGATE AUTOMATICO|DINHEIRO RESGATADO)\b/
const RE_INTERNA = /\b(MESMA TITULARIDADE|ENTRE CONTAS|CONTA PROPRIA|TRANSF PROPRIA|MESMO TITULAR|TRANSFERENCIA PROPRIA|ENTRE MINHAS CONTAS)\b/
const RE_TRANSF = /\b(PIX|TED|DOC|TEF|TRANSF|TRANSFERENCIA)\b/

function meioPagamento(n) {
  if (/\bPIX\b/.test(n)) return 'pix'
  if (/\b(DEB AUT|DEBITO AUTOMATICO|DEB AUTOMATICO|DEBITO AUT)\b/.test(n)) return 'debito_automatico'
  if (/\b(BOLETO|PAG TITULO|PAGTO TITULO|PAGAMENTO DE TITULO|PAGTO COBRANCA|COBRANCA)\b/.test(n)) return 'boleto'
  if (/\b(COMPRA CARTAO|CARTAO DEBITO|DEBITO VISA|COMPRA DEB|ELO DEBITO|VISA ELECTRON|MAESTRO|COMPRA NO DEBITO|COMPRA COM CARTAO|DEBITO MASTER)\b/.test(n)) return 'cartao_debito'
  if (/\b(TED|DOC|TEF|TRANSF|TRANSFERENCIA)\b/.test(n)) return 'transferencia'
  return null
}

function contemNomeTitular(n, nomeTitular) {
  if (!nomeTitular) return false
  const partes = tokensSignificativos(nomeTitular).filter(t => t.length >= 3)
  if (partes.length < 2) return false
  const presentes = partes.filter(p => new RegExp(`\\b${p}\\b`).test(n)).length
  return presentes >= Math.min(2, partes.length) && presentes / partes.length >= 0.5
}

export const NATUREZAS_BANCO = {
  receita: 'Receita',
  despesa: 'Despesa',
  transferencia: 'Transferência interna',
  pagamento_fatura: 'Pagamento de fatura',
  aplicacao: 'Aplicação em investimento',
  resgate_investimento: 'Resgate de investimento',
}

function interpretarBanco(r, ctx) {
  const n = normalizarDescricao(r.descricao)
  const pendencias = []
  const valor = r.valor
  const entrada = valor > 0
  let natureza
  let motivoNaoImportar = null

  if (!entrada && RE_PAG_FATURA.test(n)) {
    natureza = 'pagamento_fatura'
    motivoNaoImportar = 'Pagamento de fatura: as compras já são contadas no cartão. Importar como despesa contaria o gasto duas vezes.'
  } else if (!entrada && RE_APLICACAO.test(n) && !RE_RESGATE.test(n)) {
    natureza = 'aplicacao'
    motivoNaoImportar = 'Transferência para investimento não é despesa de consumo. Registre o aporte em Investimentos, se desejar.'
  } else if (entrada && RE_RESGATE.test(n)) {
    natureza = 'resgate_investimento'
    motivoNaoImportar = 'Resgate de investimento não é receita nova. Registre o resgate em Investimentos, se desejar.'
  } else if (RE_INTERNA.test(n) || (RE_TRANSF.test(n) && contemNomeTitular(n, ctx.nomeTitular))) {
    natureza = 'transferencia'
    motivoNaoImportar = 'Transferência entre contas próprias não altera seu patrimônio.'
  } else {
    natureza = entrada ? 'receita' : 'despesa'
  }

  if (r.sinalIncerto) pendencias.push('Não foi possível confirmar se é entrada ou saída. Confira o tipo.')
  if (r.moedaEstrangeira) pendencias.push('Valor em moeda estrangeira identificado na linha. Confira o valor em reais.')

  return {
    natureza,
    meio: meioPagamento(n),
    tarifa: /\b(TARIFA|TAR|CESTA|PACOTE SERVICOS|PACOTE DE SERVICOS)\b/.test(n),
    encargo: !entrada && /\b(JUROS|IOF|MULTA|MORA|ENCARGOS)\b/.test(n),
    destino: natureza === 'receita' ? 'receitas' : natureza === 'despesa' ? 'despesas' : null,
    motivoNaoImportar,
    pendencias,
  }
}

// ═══ Fatura de cartão ════════════════════════════════════════════════════════

const RE_PAGAMENTO_CARTAO = /\b(PAGAMENTO (RECEBIDO|EFETUADO|DA FATURA|DE FATURA|FATURA|ONLINE|EM DEBITO|DEBITO AUTOMATICO)|PAGTO (RECEBIDO|FATURA|DEBITO)|PAGAMENTO OBRIGADO|PAGAMENTO|PGTO DEBITO AUT|PAG BOLETO|PAGAMENTO VIA PIX|INCLUSAO DE PAGAMENTO)\b/
const RE_ESTORNO = /\b(ESTORNO|ESTORNADO|CREDITO DE|CREDITO EM|CANCELAMENTO|CANCELADA|REEMBOLSO|DEVOLUCAO|CASHBACK|AJUSTE A CREDITO|CREDITO ROTATIVO)\b/
const RE_ENCARGO = /\b(IOF|JUROS|MULTA|ANUIDADE|ENCARGO|ENCARGOS|TARIFA|ROTATIVO|MORA|SEGURO FATURA|PROTECAO FATURA|AVAL EMERG)\b/

export const NATUREZAS_CARTAO = {
  compra: 'Compra',
  encargo: 'Encargo / tarifa',
  estorno: 'Estorno / crédito',
  pagamento: 'Pagamento da fatura',
}

/**
 * Detecta "PARC 03/10", "Parcela 3/10", "3 DE 10" ou "03/10" no fim da descrição.
 * @returns {{ atual: number, total: number|null, explicito: boolean, limpa: string } | null}
 */
export function detectarParcela(descricao, parcelaTexto = null) {
  const original = String(descricao || '')
  const n = normalizarDescricao(original)
  const daColuna = parcelaTexto ? normalizarDescricao(parcelaTexto).match(/(\d{1,2})\s*(?:DE)?\s*(\d{1,3})?/) : null
  if (daColuna && daColuna[1]) {
    const atual = Number(daColuna[1])
    const total = daColuna[2] ? Number(daColuna[2]) : null
    if (atual >= 1 && (!total || (total >= atual && total <= 120))) {
      return { atual, total: total && total >= 2 ? total : (total === 1 ? 1 : null), explicito: true, limpa: original.trim() }
    }
  }
  const explicito = original.match(/\b(?:PARC(?:ELA)?|PARCELA|PCL|PRC)\.?\s*(\d{1,2})\s*(?:\/|DE|-)\s*(\d{1,3})\b/i)
  if (explicito) {
    const atual = Number(explicito[1]), total = Number(explicito[2])
    if (atual >= 1 && total >= atual && total <= 120) {
      return { atual, total, explicito: true, limpa: original.replace(explicito[0], '').replace(/[\s\-–]+$/, '').trim() }
    }
  }
  const soAtual = original.match(/\b(?:PARC(?:ELA)?|PARCELA)\.?\s*(\d{1,2})\b(?!\s*(?:\/|DE))/i)
  if (soAtual) return { atual: Number(soAtual[1]), total: null, explicito: true, limpa: original.replace(soAtual[0], '').trim() }
  const implicito = original.match(/(?:^|\s)(\d{1,2})\s?\/\s?(\d{1,2})\s*$/)
  if (implicito) {
    const atual = Number(implicito[1]), total = Number(implicito[2])
    if (atual >= 1 && total >= 2 && total >= atual && total <= 48) {
      return { atual, total, explicito: false, limpa: original.slice(0, implicito.index).trim() }
    }
  }
  if (/\b\d{1,2} DE \d{1,2}$/.test(n)) {
    const [, a, t] = n.match(/\b(\d{1,2}) DE (\d{1,2})$/)
    if (Number(a) <= Number(t) && Number(t) >= 2) {
      return { atual: Number(a), total: Number(t), explicito: false, limpa: original.replace(/\s*\d{1,2}\s+de\s+\d{1,2}\s*$/i, '').trim() }
    }
  }
  return null
}

function interpretarCartao(r, ctx) {
  const n = normalizarDescricao(r.descricao)
  const pendencias = []
  // Convenção de sinal normalizada antes (compras positivas, créditos negativos).
  const valor = r.valor * ctx.sinalCompra
  let natureza
  let motivoNaoImportar = null

  if (RE_PAGAMENTO_CARTAO.test(n) && (valor < 0 || /PAGAMENTO (RECEBIDO|EFETUADO)|PAGTO RECEBIDO/.test(n))) {
    natureza = 'pagamento'
    motivoNaoImportar = 'Pagamento da fatura identificado. Não é uma compra; não entra como despesa.'
  } else if (valor < 0 || RE_ESTORNO.test(n)) {
    natureza = 'estorno'
    motivoNaoImportar = 'Estorno/crédito: o módulo Cartões não registra créditos. Se a compra original estiver cadastrada, revise-a em Cartões.'
  } else if (RE_ENCARGO.test(n)) {
    natureza = 'encargo'
  } else {
    natureza = 'compra'
  }

  const parcela = natureza === 'compra' ? detectarParcela(r.descricao, r.parcelaTexto) : null
  let numeroParcelas = 1
  let valorTotal = Math.abs(valor)
  let descricao = r.descricao
  if (parcela) {
    descricao = parcela.limpa || r.descricao
    if (parcela.total && parcela.total >= 2) {
      numeroParcelas = parcela.total
      valorTotal = arred2(Math.abs(valor) * parcela.total)
      if (!parcela.explicito) pendencias.push(`Parcelamento ${parcela.atual}/${parcela.total} deduzido da descrição. Confirme.`)
    } else if (!parcela.total) {
      pendencias.push(`Parcela ${parcela.atual} sem o total de parcelas no documento. Registrada como valor único; ajuste se necessário.`)
    }
  }
  if (r.moedaEstrangeira) pendencias.push('Compra em moeda estrangeira. Confira o valor convertido em reais.')

  return {
    natureza,
    destino: natureza === 'compra' || natureza === 'encargo' ? 'compras_cartao' : null,
    motivoNaoImportar,
    pendencias,
    descricao,
    parcelaAtual: parcela?.atual ?? null,
    numeroParcelas,
    valorParcela: Math.abs(valor),
    valorTotal,
    valorAbs: Math.abs(valor),
  }
}

// ═══ Extrato de investimentos ════════════════════════════════════════════════

export const NATUREZAS_INVESTIMENTO = {
  aporte: 'Aplicação / compra',
  resgate: 'Resgate / venda',
  dividendo: 'Dividendo',
  juros: 'Juros / JCP',
  rendimento: 'Rendimento',
  amortizacao: 'Amortização',
  posicao: 'Posição na data',
  evento: 'Evento sem valor financeiro',
  indefinido: 'Não identificado',
}

export function extrairAtivo(texto) {
  const original = String(texto || '').trim()
  const n = normalizarDescricao(original)
  const ticker = n.match(/\b([A-Z]{4}(?:3|4|5|6|7|8|11|12|13|33|34|35|39)[BF]?)\b/)
  const tesouro = n.match(/\bTESOURO (SELIC|IPCA|PREFIXADO|RENDA|EDUCA|IGPM)[A-Z ]*?(?: COM JUROS SEMESTRAIS)?(?: (20\d{2}))?\b/)
  if (tesouro) {
    const nome = `Tesouro ${tesouro[1][0]}${tesouro[1].slice(1).toLowerCase()}${/IPCA|RENDA|EDUCA/.test(tesouro[1]) ? '+' : ''}${tesouro[2] ? ` ${tesouro[2]}` : ''}`
      .replace('Tesouro Ipca+', 'Tesouro IPCA+').replace('Tesouro Igpm', 'Tesouro IGP-M')
    return { codigo: null, nome, chave: normalizarDescricao(nome) }
  }
  if (ticker) {
    // B3: "PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS"
    const partes = original.split(/\s+-\s+/)
    const nome = partes.length > 1 && normalizarDescricao(partes[0]) === ticker[1] ? partes.slice(1).join(' - ').trim() : null
    return { codigo: ticker[1], nome: nome ? `${ticker[1]} · ${nome}` : ticker[1], chave: ticker[1] }
  }
  const rf = n.match(/\b(CDB|LCI|LCA|LC|CRI|CRA|DEBENTURE|RDB|LIG|LF)\b(.*)/)
  if (rf) {
    const nome = original.replace(/^\s*(APLICACAO|APLICAÇÃO|RESGATE|COMPRA|VENDA|APORTE)\s*(DE|EM)?\s*/i, '').trim().slice(0, 80)
    return { codigo: null, nome: nome || rf[1], chave: normalizarDescricao(nome || rf[1]) }
  }
  const limpo = original.replace(/^\s*(APLICACAO|APLICAÇÃO|RESGATE|COMPRA|VENDA|APORTE|DIVIDENDOS?|RENDIMENTOS?|JUROS)\s*(DE|EM|SOBRE)?\s*/i, '').trim()
  if (!limpo) return null
  return { codigo: null, nome: limpo.slice(0, 80), chave: normalizarDescricao(limpo).slice(0, 80) }
}

export function categoriaDoAtivo(ativo, tipoAtivo = '') {
  const n = normalizarDescricao(`${ativo?.nome || ''} ${tipoAtivo || ''}`)
  if (/\bTESOURO\b/.test(n)) return { categoria: 'tesouro', certa: true }
  if (/\bCDB|RDB\b/.test(n)) return { categoria: 'cdb', certa: true }
  if (/\bLCI\b/.test(n)) return { categoria: 'lci', certa: true }
  if (/\bLCA\b/.test(n)) return { categoria: 'lca', certa: true }
  if (/\b(PREVIDENCIA|PGBL|VGBL)\b/.test(n)) return { categoria: 'previdencia', certa: true }
  if (/\b(FII|FUNDO DE INVESTIMENTO IMOBILIARIO|FDO INV IMOB|IMOBILIARIO|FUNDO IMOBILIARIO)\b/.test(n)) return { categoria: 'fii', certa: true }
  if (/\b(ETF|ISHARES|INDEX FUND|IT NOW)\b/.test(n)) return { categoria: 'etf', certa: true }
  if (/\b(FUNDO|FIC|FIM|FIA|FIDC|MULTIMERCADO|RENDA FIXA REF)\b/.test(n)) return { categoria: 'fundo', certa: true }
  const cod = ativo?.codigo
  if (cod) {
    if (/[A-Z](33|34|35|39)$/.test(cod)) return { categoria: 'outro', certa: false } // BDR
    if (/[A-Z](3|4|5|6|7|8)[BF]?$/.test(cod)) return { categoria: 'acoes', certa: true }
    if (/11[BF]?$/.test(cod)) return { categoria: 'fii', certa: false }               // FII, ETF ou unit
  }
  return { categoria: 'outro', certa: false }
}

function naturezaInvestimento(r) {
  const n = normalizarDescricao(`${r.tipoMov || ''} ${r.descricao || ''}`)
  const es = normalizarDescricao(r.naturezaTexto || '')
  if (r.posicao || /^POSICAO$/.test(normalizarDescricao(r.tipoMov || ''))) return 'posicao'
  // Planilha de posição (B3 "Posição", corretoras): valor atualizado sem tipo
  // de movimentação = saldo patrimonial na data, NÃO movimentação financeira.
  if (r.valorAtual != null && !r.tipoMov && (r.valor == null || !r.data)) return 'posicao'
  if (/\b(JUROS SOBRE CAPITAL|JCP|JRS CAP|JUROS S CAPITAL)\b/.test(n)) return 'juros'
  if (/\b(DIVIDENDO|DIVIDENDOS|DIV)\b/.test(n)) return 'dividendo'
  if (/\b(AMORTIZACAO|AMORT)\b/.test(n)) return 'amortizacao'
  if (/\b(RENDIMENTO|RENDIMENTOS|INCOME|CUPOM|PROVENTO)\b/.test(n)) return 'rendimento'
  if (/\b(JUROS|INTEREST)\b/.test(n)) return 'juros'
  if (/\bTRANSFERENCIA LIQUIDACAO\b/.test(n)) return es.startsWith('SAIDA') || es.startsWith('DEBITO') ? 'resgate' : 'aporte'
  if (/\b(ATUALIZACAO|DESDOBRO|DESDOBRAMENTO|GRUPAMENTO|BONIFICACAO|TRANSFERENCIA|CESSAO|DIREITO|DIREITOS|FRACAO|LEILAO|INCORPORACAO|EMPRESTIMO|SUBSCRICAO DE DIREITO|RECIBO)\b/.test(n)) return 'evento'
  if (/\b(RESGATE|VENDA|SELL|SELLSTOCK|SELLMF|SELLDEBT|SELLOTHER|VENCIMENTO|LIQUIDACAO)\b/.test(n)) return 'resgate'
  if (/\b(APLICACAO|APORTE|COMPRA|BUY|BUYSTOCK|BUYMF|BUYDEBT|BUYOTHER|SUBSCRICAO|REINVEST|INVESTIMENTO)\b/.test(n)) return 'aporte'
  return 'indefinido'
}

function interpretarInvestimento(r) {
  const pendencias = []
  const natureza = naturezaInvestimento(r)
  const ativo = extrairAtivo(r.ativo || r.descricao)
  const cat = categoriaDoAtivo(ativo, r.tipoAtivo)
  let valor = r.valor != null ? Math.abs(r.valor) : null
  let valorCalculado = false

  if (natureza === 'posicao') {
    valor = r.valorAtual != null ? Math.abs(r.valorAtual) : null
    if (valor == null && r.quantidade != null && r.preco != null) {
      valor = arred2(Math.abs(r.quantidade * r.preco))
      valorCalculado = true
      pendencias.push('Valor da posição calculado por quantidade × preço. Confira.')
    }
  } else if (valor == null && r.quantidade != null && r.preco != null) {
    valor = arred2(Math.abs(r.quantidade * r.preco))
    valorCalculado = true
    pendencias.push('Valor calculado por quantidade × preço unitário. Confira.')
  }

  let motivoNaoImportar = null
  if (natureza === 'evento') motivoNaoImportar = 'Evento corporativo ou de custódia sem valor financeiro a registrar.'
  if (natureza === 'indefinido') {
    motivoNaoImportar = 'Tipo de movimentação não identificado. Escolha o tipo para importar.'
    pendencias.push('Tipo de movimentação não identificado.')
  }
  if (!ativo) pendencias.push('Ativo não identificado. Escolha ou informe o investimento.')
  if (!cat.certa && ativo) pendencias.push('Tipo do ativo incerto. Confira a categoria do investimento.')
  if (valor == null || valor <= 0) pendencias.push('Valor ausente no documento.')

  return {
    natureza,
    destino: natureza === 'posicao' ? 'investimentos' : (['evento', 'indefinido'].includes(natureza) ? null : 'investimentos_movimentacoes'),
    motivoNaoImportar,
    pendencias,
    ativo,
    categoriaAtivo: cat.categoria,
    quantidade: r.quantidade != null ? Math.abs(r.quantidade) : null,
    preco: r.preco != null ? Math.abs(r.preco) : null,
    valorAplicadoDoc: r.valorAplicado != null ? Math.abs(r.valorAplicado) : null,
    valorAbs: valor,
    valorCalculado,
    instituicaoLinha: r.instituicao || null,
  }
}

// ═══ Orquestração ════════════════════════════════════════════════════════════

/**
 * @param {object[]} registros
 * @param {'extrato_bancario'|'fatura_cartao'|'extrato_investimentos'} tipoDocumento
 * @param {{ nomeTitular?: string, inverterSinalCartao?: boolean }} ctx
 */
export function interpretarRegistros(registros, tipoDocumento, ctx = {}) {
  // Faturas: descobre a convenção de sinal do arquivo. Na maioria das linhas
  // de uma fatura há compras; se a maioria é negativa, o arquivo usa
  // "negativo = compra" (ex.: OFX de cartão) e invertemos.
  let sinalCompra = 1
  if (tipoDocumento === 'fatura_cartao') {
    const validos = registros.filter(r => r.valor != null && r.valor !== 0 && !RE_PAGAMENTO_CARTAO.test(normalizarDescricao(r.descricao)))
    const negativos = validos.filter(r => r.valor < 0).length
    if (ctx.inverterSinalCartao || negativos > validos.length / 2) sinalCompra = -1
  }

  const itens = []
  registros.forEach((r, idx) => {
    const base = {
      id: `${tipoDocumento}-${idx + 1}`,
      origemLinha: r.linha,
      documento: tipoDocumento,
      data: r.data,
      dataTexto: r.dataTexto || null,
      descricaoOriginal: String(r.descricao || r.ativo || '').trim().slice(0, 200),
      idExterno: r.idExterno || null,
      saldoLinha: r.saldo ?? null,
    }
    let det
    if (tipoDocumento === 'extrato_bancario') {
      if (r.valor == null || r.valor === 0) return
      det = interpretarBanco(r, ctx)
      det.valorAbs = Math.abs(r.valor)
      det.descricao = base.descricaoOriginal
    } else if (tipoDocumento === 'fatura_cartao') {
      if (r.valor == null || r.valor === 0) return
      det = interpretarCartao(r, { sinalCompra })
    } else {
      det = interpretarInvestimento(r)
      det.descricao = det.ativo?.nome || base.descricaoOriginal
    }
    const pendencias = [...(det.pendencias || [])]
    if (!r.data && det.natureza !== 'posicao') pendencias.push('Data não identificada. Informe a data.')
    itens.push({
      ...base,
      ...det,
      descricao: String(det.descricao || base.descricaoOriginal).trim().slice(0, 200),
      valor: det.valorAbs,
      pendencias,
    })
  })
  return itens
}
