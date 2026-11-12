// ─── Importação Inteligente: classificação, duplicidade e gravação (puras) ───
// Regras determinísticas e conservadoras. Sem IA, sem rede.
//
// Tipos de lançamento por contexto:
//   extrato:       receita | despesa | transferencia | pagamento_fatura | investimento | estorno
//   fatura:        compra | pagamento_fatura | estorno
//   investimentos: aporte | resgate | rendimento | dividendo | juros | amortizacao | indefinido
// Só os tipos "importáveis" geram gravação. Transferências, pagamentos de
// fatura, movimentos de investimento no extrato e estornos ficam FORA por
// padrão (evitam renda falsa e gasto em dobro); o usuário pode reclassificar.

import { semAcentos } from './importacaoLeitura.js'
import { classificarDespesa } from './classificarDespesa.js'

export const CONTEXTOS = ['extrato', 'fatura', 'investimentos']

export const ROTULOS_TIPO = {
  receita: 'Receita',
  despesa: 'Despesa',
  transferencia: 'Transferência entre contas',
  pagamento_fatura: 'Pagamento de fatura',
  investimento: 'Aplicação/resgate (investimento)',
  estorno: 'Estorno/devolução',
  compra: 'Compra no cartão',
  aporte: 'Aporte',
  resgate: 'Resgate',
  rendimento: 'Rendimento',
  dividendo: 'Dividendo',
  juros: 'Juros/JCP',
  amortizacao: 'Amortização',
  taxa: 'Taxa/imposto',
  indefinido: 'Definir tipo',
}

export const TIPOS_POR_CONTEXTO = {
  extrato: ['receita', 'despesa', 'transferencia', 'pagamento_fatura', 'investimento', 'estorno'],
  fatura: ['compra', 'pagamento_fatura', 'estorno'],
  investimentos: ['aporte', 'resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao', 'taxa', 'indefinido'],
}

const TIPOS_MOV = ['aporte', 'resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao']
export const TIPOS_IMPORTAVEIS = ['receita', 'despesa', 'compra', ...TIPOS_MOV]

export function destinoDoTipo(tipo) {
  if (tipo === 'receita') return 'receitas'
  if (tipo === 'despesa') return 'despesas'
  if (tipo === 'compra') return 'compras_cartao'
  if (TIPOS_MOV.includes(tipo)) return 'investimentos_movimentacoes'
  return null
}

export const MOTIVO_NAO_IMPORTAVEL = {
  transferencia: 'Transferência entre suas contas não é receita nem despesa.',
  pagamento_fatura: 'As compras do cartão já entram pela fatura; importar o pagamento contaria o gasto duas vezes.',
  investimento: 'Aplicações e resgates ficam no módulo Investimentos, separados do saldo disponível.',
  estorno: 'Estorno não é renda. Se precisar, reclassifique ou ajuste a compra original.',
  taxa: 'O módulo Investimentos não registra taxas e impostos como movimentação. Se o valor atual da posição mudou, ajuste-o em Investimentos.',
  indefinido: 'Escolha o tipo da movimentação para poder importar.',
}

export const normalizar = s => semAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

// Descrição para comparação: sem números longos (documentos, datas, parcelas).
export function descricaoComparavel(s) {
  return normalizar(s).split(' ').filter(t => t && !/^\d+$/.test(t)).join(' ')
}

// ── Classificação ────────────────────────────────────────────────────────────
const RE = {
  pagamentoFatura: /\b(pagamento|pgto|pagto|pag)( de| da| do)? (fatura|cartao)\b|\bfatura (do )?cartao\b|\bpagamento recebido\b|\bcredito de pagamento\b|\bpagamento efetuado\b/,
  transferenciaPropria: /mesma titularidade|entre contas|conta propria|transferencia propria|\bpara (minha|mesma) conta\b|transf(erencia)? entre/,
  rendimento: /\brendimento|\brend pago|\bremuneracao (da )?(poupanca|aplicacao)/,
  investimento: /\baplicacao|\baplic\b|\bresgate|\bcdb\b|\blci\b|\blca\b|tesouro direto|\bcorretora\b|\binvest/,
  estorno: /\bestorno|\bdevolucao|\bchargeback|\bcancelamento de compra/,
  salario: /\bsalario|\bfolha( de)? pagamento|\bproventos?\b|\bpagto salario|\bvencimentos\b/,
  transferencia: /\bpix\b|\bted\b|\bdoc\b|\btransf/,
  reembolso: /\breembolso|\bcashback/,
}

const RE_INV = [
  ['taxa', /\btaxa|\btarifa|\bimposto|\bir\b|\birrf\b|\biof\b|custodia|corretagem|emolumento/],
  ['dividendo', /dividendo/],
  ['juros', /\bjcp\b|juros sobre capital|juros/],
  ['amortizacao', /amortizacao/],
  ['rendimento', /rendimento|remuneracao|cupom|provento/],
  ['resgate', /resgate|venda|retirada|vencimento/],
  ['aporte', /aplicacao|aporte|compra|deposito|subscricao/],
]

// Sinal que representa COMPRA numa fatura (cada banco usa uma convenção):
// o sinal mais comum entre as linhas que não são pagamento.
export function sinalDeCompraNaFatura(transacoes) {
  let pos = 0, neg = 0
  for (const t of transacoes) {
    if (RE.pagamentoFatura.test(normalizar(t.descricao))) continue
    if (t.valor > 0) pos++; else if (t.valor < 0) neg++
  }
  return neg > pos ? -1 : 1
}

// Devolve { tipo, incluir, revisar, avisos[] }
export function classificar(t, contexto, { sinalCompra = 1 } = {}) {
  const d = normalizar(`${t.descricao} ${t.tipoInformado || ''}`)
  const avisos = []
  if (contexto === 'fatura') {
    if (RE.pagamentoFatura.test(d)) return { tipo: 'pagamento_fatura', incluir: false, revisar: false, avisos }
    if (Math.sign(t.valor) !== sinalCompra) return { tipo: 'estorno', incluir: false, revisar: false, avisos: ['Crédito na fatura (estorno ou ajuste), não é compra'] }
    const revisar = !!t.parcelaTotal
    if (revisar) avisos.push(`Parcela ${t.parcelaAtual}/${t.parcelaTotal}: confirme se a data é a da compra original`)
    return { tipo: 'compra', incluir: true, revisar, avisos }
  }
  if (contexto === 'investimentos') {
    for (const [tipo, re] of RE_INV) {
      if (!re.test(d)) continue
      if (tipo === 'taxa') return { tipo, incluir: false, revisar: false, avisos }
      // Compra/venda de cotas: registramos só o valor. Quantidade e preço
      // médio não são inventados.
      if (/\bcompra\b|\bvenda\b/.test(d)) avisos.push('Compra/venda: só o valor é registrado; quantidade e preço médio não são alterados')
      return { tipo, incluir: true, revisar: false, avisos }
    }
    return { tipo: 'indefinido', incluir: false, revisar: true, avisos: ['Não identificamos o tipo da movimentação'] }
  }
  // extrato bancário
  if (RE.pagamentoFatura.test(d)) return { tipo: 'pagamento_fatura', incluir: false, revisar: false, avisos }
  if (RE.transferenciaPropria.test(d)) return { tipo: 'transferencia', incluir: false, revisar: false, avisos }
  if (t.valor > 0 && RE.rendimento.test(d)) return { tipo: 'receita', incluir: true, revisar: false, avisos }
  if (RE.investimento.test(d)) return { tipo: 'investimento', incluir: false, revisar: false, avisos }
  // PDF sem sinal e sem saldo para deduzir: não presumimos entrada ou saída.
  if (t.sinalIncerto) return { tipo: t.valor > 0 ? 'receita' : 'despesa', incluir: false, revisar: true, avisos: ['O PDF não indica se é entrada ou saída: escolha o tipo e marque para importar'] }
  if (t.valor > 0 && RE.estorno.test(d)) return { tipo: 'estorno', incluir: false, revisar: false, avisos }
  if (t.valor > 0) {
    if (RE.salario.test(d) || RE.reembolso.test(d)) return { tipo: 'receita', incluir: true, revisar: false, avisos }
    if (RE.transferencia.test(d)) {
      return { tipo: 'receita', incluir: false, revisar: true, avisos: ['Transferência recebida: marque para incluir só se não veio de outra conta sua'] }
    }
    return { tipo: 'receita', incluir: true, revisar: false, avisos }
  }
  if (RE.transferencia.test(d)) {
    return { tipo: 'despesa', incluir: true, revisar: true, avisos: ['Se foi para uma conta sua, mude para "Transferência entre contas"'] }
  }
  return { tipo: 'despesa', incluir: true, revisar: false, avisos }
}

// ── Categorias (só quando não há ambiguidade) ───────────────────────────────
const REGRAS_DESPESA = [
  [/supermercado|\bmercado\b|atacad|padaria|restaurante|ifood|lanchonete|acougue|hortifruti|pizzaria|burger|mc ?donald|rappi/, ['Alimentação']],
  [/\buber\b|\b99 ?(app|pop|taxi)?\b|\bposto\b|combustivel|gasolina|estacionamento|pedagio|sem parar|\bmetro\b|onibus|bilhete unico/, ['Transporte']],
  [/farmacia|drogaria|droga ?raia|drogasil|pague menos|hospital|clinica|laboratorio|unimed|odonto|dentista/, ['Saúde']],
  [/aluguel|condominio|\benel\b|cemig|copel|\blight\b|sabesp|celesc|energia eletrica|conta de luz|agua e esgoto|comgas/, ['Moradia']],
  [/internet|vivo fibra|claro net|net virtua|oi fibra|tim live/, ['Internet']],
  [/netflix|spotify|amazon prime|prime video|disney|\bhbo\b|youtube premium|apple com|deezer|globoplay|paramount/, ['Serviços']],
  [/\bescola\b|faculdade|universidade|\bcurso\b|udemy|alura/, ['Educação']],
  [/cinema|ingresso|teatro|steam|playstation|xbox/, ['Lazer']],
  [/petshop|pet shop|veterinari|cobasi|\bpetz\b/, ['Pets']],
  [/renner|riachuelo|\bc a\b|\bzara\b|shein|calcados|netshoes/, ['Vestuário']],
  [/\btarifa|\biof\b|anuidade|cesta de servicos|\bencargos?\b/, ['Serviços']],
]
const REGRAS_RECEITA = [
  [RE.salario, ['Salário']],
  [RE.rendimento, ['Rendimentos']],
  [/dividendo|\bjcp\b/, ['Dividendos / JCP']],
  [RE.reembolso, ['Reembolso']],
]

function acharCategoria(nomes, categorias) {
  for (const nome of nomes) {
    const c = categorias.find(x => normalizar(x.nome) === normalizar(nome))
    if (c) return c
  }
  return null
}

// Devolve a categoria sugerida ou null. Se duas regras diferentes casam,
// é ambíguo e não sugerimos nada.
export function sugerirCategoria(descricao, tipo, categorias = []) {
  const regras = tipo === 'receita' ? REGRAS_RECEITA : (tipo === 'despesa' || tipo === 'compra') ? REGRAS_DESPESA : null
  if (!regras) return null
  const d = normalizar(descricao)
  const encontradas = new Map()
  for (const [re, nomes] of regras) {
    if (!re.test(d)) continue
    const c = acharCategoria(nomes, categorias)
    if (c) encontradas.set(c.id, c)
  }
  return encontradas.size === 1 ? [...encontradas.values()][0] : null
}

// ── Chave de duplicidade ─────────────────────────────────────────────────────
// Hash determinístico (cyrb53): o histórico guarda só o hash, não a descrição.
export function hash53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export const centavos = v => Math.round(Math.abs(Number(v) || 0) * 100)

// Origem: conta informada (extrato), cartão (fatura) ou investimento padrão.
export function chavesDosItens(transacoes, origem) {
  const ocorrencias = new Map()
  return transacoes.map(t => {
    const base = t.idOrigem
      ? `${origem}|id:${t.idOrigem}`
      : `${origem}|${t.data}|${centavos(t.valor)}|${t.valor < 0 ? 's' : 'e'}|${descricaoComparavel(t.descricao)}`
    // Sem identificador do banco, duas linhas idênticas são lançamentos
    // distintos (ex.: dois cafés no mesmo dia): numera as ocorrências.
    const n = (ocorrencias.get(base) || 0) + 1
    ocorrencias.set(base, n)
    return { chave: hash53(t.idOrigem ? base : `${base}#${n}`), repetidoPorId: !!t.idOrigem && n > 1, repetidoSemId: !t.idOrigem && n > 1 }
  })
}

function tokens(s) { return new Set(descricaoComparavel(s).split(' ').filter(t => t.length >= 3)) }
export function similaridade(a, b) {
  const ta = tokens(a), tb = tokens(b)
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  if (inter === Math.min(ta.size, tb.size)) return 1 // uma contém a outra
  return inter / (ta.size + tb.size - inter)
}

function diasEntre(a, b) {
  return Math.abs((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000)
}

// Converte registros já gravados em uma lista comparável.
// receitas/despesas: { data, valor, descricao } | compras_cartao: { data_compra,
// valor_total, numero_parcelas, cartao_id } | movimentações: { data, valor, tipo, investimento_id }
export function normalizarExistentes(tabela, linhas = []) {
  return linhas.map(r => {
    if (tabela === 'compras_cartao') {
      const n = Math.max(1, Number(r.numero_parcelas) || 1)
      return { id: r.id, tabela, data: r.data_compra, valores: [centavos(r.valor_total), centavos((Number(r.valor_total) || 0) / n)], descricao: r.descricao, cartaoId: r.cartao_id }
    }
    if (tabela === 'investimentos_movimentacoes') {
      return { id: r.id, tabela, data: r.data, valores: [centavos(r.valor)], descricao: r.descricao || r.tipo, investimentoId: r.investimento_id, tipo: r.tipo }
    }
    return { id: r.id, tabela, data: r.data, valores: [centavos(r.valor)], descricao: r.descricao }
  })
}

// Marca cada item como novo, já importado (histórico), duplicado no arquivo
// ou possível duplicidade de um lançamento existente (forte/fraca).
// Cada registro existente casa com no máximo UM item.
export function marcarDuplicidades(itens, { existentes = [], chavesImportadas = new Set() } = {}) {
  const usados = new Set()
  return itens.map(it => {
    const avisos = [...(it.avisos || [])]
    if (it.repetidoPorId) {
      return { ...it, status: 'duplicado_no_arquivo', incluir: false, avisos: [...avisos, 'Mesmo identificador bancário repetido no arquivo'] }
    }
    if (chavesImportadas.has(it.chave)) {
      return { ...it, status: 'ja_importado', incluir: false, avisos: [...avisos, 'Já importado anteriormente'] }
    }
    const destino = destinoDoTipo(it.tipo)
    if (!destino) return { ...it, status: 'novo', avisos }
    const cents = centavos(it.valor)
    let melhor = null, melhorPontos = 0
    for (const e of existentes) {
      if (usados.has(e.id) || e.tabela !== destino) continue
      if (e.cartaoId && it.cartaoId && e.cartaoId !== it.cartaoId) continue
      if (e.investimentoId && it.investimentoId && e.investimentoId !== it.investimentoId) continue
      if (!e.valores.includes(cents)) continue
      const dias = diasEntre(e.data, it.data)
      if (dias > 3) continue
      const sim = similaridade(e.descricao, it.descricao)
      const pontos = (dias === 0 ? 2 : 1) + sim * 2
      if (dias === 0 || sim >= 0.6) {
        if (pontos > melhorPontos) { melhor = { e, sim, dias }; melhorPontos = pontos }
      }
    }
    if (!melhor) {
      const extra = it.repetidoSemId ? ['Lançamento igual a outro do arquivo: mantido, pois pode ser uma segunda compra'] : []
      return { ...it, status: 'novo', avisos: [...avisos, ...extra] }
    }
    usados.add(melhor.e.id)
    const forte = melhor.sim >= 0.34
    return {
      ...it,
      status: forte ? 'possivel_duplicata' : 'possivel_duplicata_fraca',
      incluir: forte ? false : it.incluir,
      duplicataDe: melhor.e.id,
      avisos: [...avisos, forte
        ? 'Parece já estar cadastrado (mesma data, valor e descrição semelhante)'
        : 'Há um lançamento com mesma data e valor, mas descrição diferente: confira'],
    }
  })
}

// ── Preparação completa ──────────────────────────────────────────────────────
// Arquivo com coluna de ativo: associa cada linha ao investimento de mesmo
// nome. Sem correspondência única, usa o padrão escolhido e pede revisão.
export function investimentoDoAtivo(ativo, investimentos, padrao) {
  if (!ativo || !investimentos?.length) return { id: padrao, incerto: false }
  const a = normalizar(ativo)
  const achados = investimentos.filter(i => { const n = normalizar(i.nome); return n && (n === a || n.includes(a) || a.includes(n)) })
  if (achados.length === 1) return { id: achados[0].id, incerto: false }
  return { id: padrao, incerto: true }
}

export function prepararItens(transacoes, { contexto, origem, categorias = [], existentes = [], chavesImportadas = new Set(), cartaoId = null, investimentoId = null, investimentos = [] }) {
  const sinalCompra = contexto === 'fatura' ? sinalDeCompraNaFatura(transacoes) : 1
  const chaves = chavesDosItens(transacoes, origem)
  const itens = transacoes.map((t, i) => {
    const c = classificar(t, contexto, { sinalCompra })
    const cat = sugerirCategoria(t.descricao, c.tipo, categorias)
    const inv = contexto === 'investimentos' ? investimentoDoAtivo(t.ativo, investimentos, investimentoId) : { id: investimentoId, incerto: false }
    if (inv.incerto) { c.revisar = true; c.avisos.push(`Ativo "${t.ativo}" não corresponde a um investimento cadastrado: confira o investimento`) }
    return {
      uid: `i${i + 1}`,
      linha: t.linha,
      data: t.data,
      descricao: t.descricao,
      valor: Math.abs(t.valor),
      entrada: contexto === 'fatura' ? Math.sign(t.valor) !== sinalCompra : t.valor > 0,
      idOrigem: t.idOrigem,
      parcelaAtual: t.parcelaAtual,
      parcelaTotal: t.parcelaTotal,
      ativo: t.ativo,
      tipo: c.tipo,
      incluir: c.incluir,
      revisar: c.revisar || !!t.revisar,
      avisos: [...(t.avisos || []), ...c.avisos],
      categoriaId: cat && c.tipo !== 'receita' ? cat.id : null,
      categoriaNome: cat && c.tipo === 'receita' ? cat.nome : null,
      cartaoId,
      investimentoId: inv.id,
      ...chaves[i],
    }
  })
  return marcarDuplicidades(itens, { existentes, chavesImportadas })
}

// Ao reclassificar um item na prévia: tipos não importáveis saem da gravação.
export function alterarTipo(item, tipo) {
  const importavel = TIPOS_IMPORTAVEIS.includes(tipo)
  return { ...item, tipo, incluir: importavel ? item.incluir || item.tipo === 'indefinido' : false, categoriaId: tipo === 'receita' ? null : item.categoriaId, categoriaNome: tipo === 'receita' ? item.categoriaNome : null }
}

// ── Validação e montagem dos registros (formato das tabelas existentes) ─────
export function validarItem(it) {
  if (!it.incluir) return null
  if (!TIPOS_IMPORTAVEIS.includes(it.tipo)) return 'Tipo não importável'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.data || '')) return 'Data inválida'
  if (!(Number(it.valor) > 0)) return 'Valor deve ser maior que zero'
  if (!String(it.descricao || '').trim()) return 'Descrição obrigatória'
  if (it.tipo === 'compra' && !it.cartaoId) return 'Escolha o cartão'
  if (TIPOS_MOV.includes(it.tipo) && !it.investimentoId) return 'Escolha o investimento'
  return null
}

const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100

export function montarRegistros(itens, { categorias = [] } = {}) {
  const porId = Object.fromEntries(categorias.map(c => [c.id, c]))
  const out = { receitas: [], despesas: [], compras_cartao: [], investimentos_movimentacoes: [], erros: [] }
  for (const it of itens) {
    if (!it.incluir) continue
    const problema = validarItem(it)
    if (problema) { out.erros.push({ uid: it.uid, problema }); continue }
    const descricao = String(it.descricao).trim().slice(0, 200)
    const valor = r2(it.valor)
    const ref = { uid: it.uid, chave: it.chave }
    if (it.tipo === 'receita') {
      out.receitas.push({ ref, dados: { descricao, valor, data: it.data, recorrente: false, frequencia: 'nao_repete', recorrencia_meses: null, categoria: it.categoriaNome || null } })
    } else if (it.tipo === 'despesa') {
      const cat = porId[it.categoriaId]
      out.despesas.push({ ref, dados: {
        descricao, valor, data: it.data, recorrente: false, frequencia: 'nao_repete', recorrencia_meses: null,
        categoria_id: it.categoriaId || null, subcategoria_id: null,
        tipo_despesa: classificarDespesa({ descricao, categoria: cat?.nome || '' }),
        forma_pagamento: null, cartao_id: null,
      } })
    } else if (it.tipo === 'compra') {
      const n = it.parcelaTotal && it.parcelaTotal > 1 ? it.parcelaTotal : 1
      out.compras_cartao.push({ ref, dados: {
        cartao_id: it.cartaoId, descricao, data_compra: it.data,
        valor_total: r2(valor * n), numero_parcelas: n, categoria_id: it.categoriaId || null,
      } })
    } else {
      out.investimentos_movimentacoes.push({ ref, dados: { investimento_id: it.investimentoId, tipo: it.tipo, valor, data: it.data, descricao } })
    }
  }
  return out
}

// ── Resumo e impacto no saldo (mesma regra da Home) ─────────────────────────
// A Home calcula: saldo = saldo_base + receitas − despesas com data entre
// saldo_base_data (exclusive) e hoje. Lançamentos anteriores à data-base são
// histórico e NÃO mudam o saldo. Compras de cartão entram na fatura, e
// movimentações de investimento só mudam o patrimônio.
export function impactoNoSaldo(itens, { saldoBaseData = null, hoje }) {
  let delta = 0, noPeriodo = 0, antesDaBase = 0, futuros = 0
  for (const it of itens) {
    if (!it.incluir || validarItem(it)) continue
    if (it.tipo !== 'receita' && it.tipo !== 'despesa') continue
    if (it.data > hoje) { futuros++; continue }
    if (!saldoBaseData) continue
    if (it.data <= saldoBaseData) { antesDaBase++; continue }
    noPeriodo++
    delta += it.tipo === 'receita' ? it.valor : -it.valor
  }
  return { delta: r2(delta), noPeriodo, antesDaBase, futuros, saldoConfigurado: !!saldoBaseData }
}

export function resumoImportacao(itens) {
  const r = { total: itens.length, incluidos: 0, porTipo: {}, entradas: 0, saidas: 0, duplicidades: 0, revisar: 0, ignorados: 0, comErro: 0 }
  for (const it of itens) {
    r.porTipo[it.tipo] = (r.porTipo[it.tipo] || 0) + 1
    if (['possivel_duplicata', 'possivel_duplicata_fraca', 'ja_importado', 'duplicado_no_arquivo'].includes(it.status)) r.duplicidades++
    if (it.revisar) r.revisar++
    if (!it.incluir) { r.ignorados++; continue }
    if (validarItem(it)) { r.comErro++; continue }
    r.incluidos++
    if (it.tipo === 'receita' || ['resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao'].includes(it.tipo)) r.entradas = r2(r.entradas + it.valor)
    else r.saidas = r2(r.saidas + it.valor)
  }
  return r
}

export function intervaloDatas(transacoes) {
  const datas = transacoes.map(t => t.data).filter(Boolean).sort()
  return datas.length ? { inicio: datas[0], fim: datas[datas.length - 1] } : null
}
