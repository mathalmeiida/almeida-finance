// ─── Leitura de dados tabulares (CSV, tabelas HTML ".xls" e planilhas) ───────
// Converte linhas (array de células) em registros brutos, identificando o
// cabeçalho por sinônimos. Não presume layout fixo: cada banco usa nomes e
// ordens de colunas diferentes.

import { normalizarDescricao, parseValor, parseData, parseQuantidade, serialExcelParaISO } from './normalizar.js'
import { MAXIMO_LINHAS } from './limites.js'

// ─── CSV ─────────────────────────────────────────────────────────────────────

function detectarDelimitador(texto) {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 30)
  const candidatos = [';', ',', '\t', '|']
  let melhor = ','
  let melhorPontuacao = -1
  for (const d of candidatos) {
    const contagens = linhas.map(l => {
      let n = 0, aspas = false
      for (const c of l) {
        if (c === '"') aspas = !aspas
        else if (c === d && !aspas) n++
      }
      return n
    }).filter(n => n > 0)
    if (contagens.length === 0) continue
    // Pontua pela consistência (moda) e pela quantidade de linhas com o separador.
    const freq = {}
    for (const n of contagens) freq[n] = (freq[n] || 0) + 1
    const moda = Math.max(...Object.values(freq))
    const pontuacao = moda * 10 + contagens.length
    if (pontuacao > melhorPontuacao) { melhorPontuacao = pontuacao; melhor = d }
  }
  return melhor
}

export function parseCsv(texto) {
  const delim = detectarDelimitador(texto)
  const linhas = []
  let linha = []
  let campo = ''
  let aspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (aspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
      continue
    }
    if (c === '"' && campo.trim() === '') { aspas = true; campo = ''; continue }
    if (c === delim) { linha.push(campo.trim()); campo = ''; continue }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      linha.push(campo.trim()); campo = ''
      if (linha.some(v => v !== '')) linhas.push(linha)
      linha = []
      if (linhas.length > MAXIMO_LINHAS + 50) break
      continue
    }
    campo += c
  }
  linha.push(campo.trim())
  if (linha.some(v => v !== '')) linhas.push(linha)
  return linhas
}

// ─── Tabela HTML (exportação ".xls" de alguns bancos) ───────────────────────

function decodificarEntidades(t) {
  return t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

export function parseTabelaHtml(html) {
  const linhas = []
  const reLinha = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let m
  while ((m = reLinha.exec(html)) && linhas.length <= MAXIMO_LINHAS + 50) {
    const celulas = []
    const reCel = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let c
    while ((c = reCel.exec(m[1]))) {
      celulas.push(decodificarEntidades(c[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    }
    if (celulas.some(v => v !== '')) linhas.push(celulas)
  }
  return linhas
}

// ─── Mapeamento de colunas ───────────────────────────────────────────────────

const SINONIMOS = {
  vencimento: ['DATA DE VENCIMENTO', 'VENCIMENTO', 'DATA VENCIMENTO'],
  data: ['DATA', 'DATE', 'DT', 'DATA LANCAMENTO', 'DATA DO LANCAMENTO', 'DATA MOVIMENTO', 'DATA DA COMPRA',
    'DATA DO NEGOCIO', 'DATA OPERACAO', 'DATA DA OPERACAO', 'DATA MOV', 'DATA DA TRANSACAO', 'DATA DE LIQUIDACAO',
    'DATA LIQUIDACAO', 'DATA DE PAGAMENTO'],
  tipoMov: ['MOVIMENTACAO', 'TIPO DE MOVIMENTACAO', 'TIPO MOVIMENTACAO', 'OPERACAO', 'TIPO DE OPERACAO', 'EVENTO'],
  descricao: ['DESCRICAO', 'HISTORICO', 'LANCAMENTO', 'TITLE', 'ESTABELECIMENTO', 'DETALHES', 'MEMO',
    'NOME', 'TRANSACAO', 'IDENTIFICACAO', 'DESCRICAO DO LANCAMENTO', 'HISTORICO DO LANCAMENTO', 'COMPLEMENTO'],
  credito: ['CREDITO', 'CREDITOS', 'ENTRADAS', 'VALOR CREDITO', 'CREDITO R'],
  debito: ['DEBITO', 'DEBITOS', 'SAIDA', 'SAIDAS', 'VALOR DEBITO', 'DEBITO R'],
  natureza: ['TIPO', 'NATUREZA', 'D C', 'DC', 'C D', 'ENTRADA SAIDA', 'TIPO TRANSACAO', 'TIPO DE LANCAMENTO'],
  valorAtual: ['VALOR ATUALIZADO', 'SALDO BRUTO', 'VALOR BRUTO', 'POSICAO', 'VALOR ATUAL', 'SALDO ATUAL',
    'VALOR DE MERCADO', 'VALOR LIQUIDO ATUAL', 'SALDO LIQUIDO', 'VALOR POSICAO'],
  valorAplicado: ['VALOR APLICADO', 'VALOR INVESTIDO', 'VALOR DE COMPRA', 'CUSTO', 'VALOR INICIAL', 'CUSTO TOTAL'],
  valor: ['VALOR', 'AMOUNT', 'VALOR R', 'VALOR RS', 'VALOR DA OPERACAO', 'VALOR LIQUIDO', 'VALOR TOTAL',
    'MONTANTE', 'VALOR EM R', 'VALOR BRL', 'VALOR LANCAMENTO'],
  saldo: ['SALDO', 'SALDO R', 'SALDO DO DIA'],
  id: ['ID', 'IDENTIFICADOR', 'DOCUMENTO', 'N DOCUMENTO', 'NUMERO DOCUMENTO', 'NUM DOCUMENTO', 'FITID',
    'AUTENTICACAO', 'CODIGO TRANSACAO', 'NR DOC', 'DOC'],
  parcela: ['PARCELA', 'PARCELAS', 'N PARCELA'],
  ativo: ['PRODUTO', 'ATIVO', 'PAPEL', 'CODIGO DE NEGOCIACAO', 'TICKER', 'TITULO', 'NOME DO ATIVO', 'CODIGO',
    'INVESTIMENTO', 'APLICACAO', 'NOME DO PRODUTO'],
  quantidade: ['QUANTIDADE', 'QTD', 'QTDE', 'COTAS', 'QUANTIDADE DISPONIVEL'],
  preco: ['PRECO', 'PRECO UNITARIO', 'PRECO MEDIO', 'COTACAO', 'PRECO DE FECHAMENTO', 'PU', 'VALOR UNITARIO'],
  instituicao: ['INSTITUICAO', 'CORRETORA', 'BANCO'],
  tipoAtivo: ['TIPO DE ATIVO', 'CLASSE', 'CLASSE DE ATIVO', 'CATEGORIA', 'TIPO DE INVESTIMENTO', 'MERCADO'],
  entradaSaida: ['ENTRADA SAIDA'],
}

function campoDoCabecalho(celula) {
  const n = normalizarDescricao(celula)
  if (!n || n.length > 60) return null
  // 1) Igualdade exata (mais confiável)
  for (const [campo, lista] of Object.entries(SINONIMOS)) {
    if (lista.includes(n)) return campo === 'entradaSaida' ? 'natureza' : campo
  }
  // 2) Prefixo mais longo ("VALOR R$" → "VALOR R")
  let melhor = null, tamanho = 0
  for (const [campo, lista] of Object.entries(SINONIMOS)) {
    for (const s of lista) {
      if ((n.startsWith(s + ' ') || n === s) && s.length > tamanho) { melhor = campo; tamanho = s.length }
    }
  }
  return melhor === 'entradaSaida' ? 'natureza' : melhor
}

export function encontrarCabecalho(linhas) {
  let melhor = { indice: -1, mapa: {}, pontos: 0 }
  const limite = Math.min(linhas.length, 40)
  for (let i = 0; i < limite; i++) {
    const mapa = {}
    let pontos = 0
    linhas[i].forEach((cel, j) => {
      if (typeof cel !== 'string') return
      const campo = campoDoCabecalho(cel)
      if (campo && mapa[campo] == null) { mapa[campo] = j; pontos++ }
    })
    const util = mapa.data != null || (mapa.ativo != null && (mapa.valorAtual != null || mapa.quantidade != null))
    if (util && pontos >= 2 && pontos > melhor.pontos) melhor = { indice: i, mapa, pontos }
  }
  return melhor.indice >= 0 ? melhor : null
}

// Sem cabeçalho reconhecível: deduz colunas pelo conteúdo (datas, valores e
// texto). O resultado é marcado como "inferido" para conferência.
function inferirColunas(linhas) {
  const amostra = linhas.slice(0, 50)
  const nCol = Math.max(...amostra.map(l => l.length))
  const stats = []
  for (let j = 0; j < nCol; j++) {
    let datas = 0, valores = 0, textoTam = 0, preenchidas = 0
    for (const l of amostra) {
      const v = l[j]
      if (v == null || v === '') continue
      preenchidas++
      if (parseData(v, { referencia: '2026-12-31' })) datas++
      else if (parseValor(v) != null) valores++
      else textoTam += String(v).length
    }
    stats.push({ j, datas, valores, textoTam, preenchidas })
  }
  const minimo = Math.max(2, amostra.length * 0.5)
  const colData = stats.filter(s => s.datas >= minimo).sort((a, b) => b.datas - a.datas)[0]
  const colValores = stats.filter(s => s.valores >= minimo && s.j !== colData?.j)
  const colDesc = stats.filter(s => s.j !== colData?.j).sort((a, b) => b.textoTam - a.textoTam)[0]
  if (!colData || colValores.length === 0 || !colDesc || colDesc.textoTam === 0) return null
  // Primeiro número após a descrição = valor; se houver outro depois, é saldo.
  const depoisDesc = colValores.filter(s => s.j > colDesc.j)
  const lista = depoisDesc.length ? depoisDesc : colValores
  const mapa = { data: colData.j, descricao: colDesc.j, valor: lista[0].j }
  if (lista.length > 1) mapa.saldo = lista[lista.length - 1].j
  return { indice: -1, mapa, pontos: 0, inferido: true }
}

function celula(linha, mapa, campo) {
  const j = mapa[campo]
  return j == null ? null : linha[j] ?? null
}

function textoCel(v) {
  return v == null ? '' : String(v).trim()
}

function dataCel(v, referencia) {
  if (typeof v === 'number') return serialExcelParaISO(v)
  if (v instanceof Date) return parseData(v.toISOString().slice(0, 10))
  return parseData(textoCel(v), { referencia })
}

function sinalPorNatureza(texto) {
  const n = normalizarDescricao(texto)
  if (!n) return 0
  if (/^(D|DEBITO|SAIDA|DEB|DESPESA|PAGAMENTO|-)$/.test(n) || n.startsWith('DEBITO') || n === 'SAIDA') return -1
  if (/^(C|CREDITO|ENTRADA|CRED|RECEITA|\+)$/.test(n) || n.startsWith('CREDITO') || n === 'ENTRADA') return 1
  return 0
}

/**
 * Converte linhas tabulares em registros brutos.
 * @returns {{ registros: object[], inferido: boolean, colunas: object } | null}
 */
export function tabelaParaRegistros(linhas, opcoes = {}) {
  if (!Array.isArray(linhas) || linhas.length === 0) return null
  const cab = encontrarCabecalho(linhas) || inferirColunas(linhas)
  if (!cab) return null
  const { mapa } = cab
  const referencia = opcoes.referencia
  const registros = []
  const inicio = cab.indice + 1
  for (let i = inicio; i < linhas.length && registros.length < (opcoes.maxLinhas || 5000); i++) {
    const l = linhas[i]
    if (!l || l.every(v => v == null || v === '')) continue
    const descricao = textoCel(celula(l, mapa, 'descricao'))
    const tipoMov = textoCel(celula(l, mapa, 'tipoMov'))
    const ativo = textoCel(celula(l, mapa, 'ativo'))
    const data = dataCel(celula(l, mapa, 'data'), referencia)

    let valor = null
    const vValor = celula(l, mapa, 'valor')
    if (vValor != null && vValor !== '') valor = parseValor(vValor)
    if (valor == null) {
      const cred = parseValor(celula(l, mapa, 'credito'))
      const deb = parseValor(celula(l, mapa, 'debito'))
      if (cred) valor = Math.abs(cred)
      else if (deb) valor = -Math.abs(deb)
    }
    const sinal = sinalPorNatureza(celula(l, mapa, 'natureza'))
    if (valor != null && sinal !== 0) valor = sinal * Math.abs(valor)

    const registro = {
      linha: i + 1,
      data,
      dataTexto: textoCel(celula(l, mapa, 'data')),
      descricao,
      tipoMov,
      naturezaTexto: textoCel(celula(l, mapa, 'natureza')),
      valor,
      saldo: parseValor(celula(l, mapa, 'saldo')),
      idExterno: textoCel(celula(l, mapa, 'id')) || null,
      parcelaTexto: textoCel(celula(l, mapa, 'parcela')) || null,
      ativo,
      quantidade: parseQuantidade(celula(l, mapa, 'quantidade')),
      preco: parseValor(celula(l, mapa, 'preco')),
      valorAtual: parseValor(celula(l, mapa, 'valorAtual')),
      valorAplicado: parseValor(celula(l, mapa, 'valorAplicado')),
      instituicao: textoCel(celula(l, mapa, 'instituicao')) || null,
      tipoAtivo: textoCel(celula(l, mapa, 'tipoAtivo')) || null,
      vencimento: dataCel(celula(l, mapa, 'vencimento'), referencia),
    }
    // Linha sem nenhum dado aproveitável (ex.: rodapé, subtotal vazio).
    const temConteudo = registro.descricao || registro.tipoMov || registro.ativo
    const temNumero = registro.valor != null || registro.valorAtual != null || registro.quantidade != null
    if (!temConteudo || !temNumero) continue
    registros.push(registro)
  }
  return { registros, inferido: Boolean(cab.inferido), colunas: mapa }
}
