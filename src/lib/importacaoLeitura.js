
/**
 * ALMEIDA FINANCE — IMPORTAÇÃO INTELIGENTE
 * Leitura e interpretação de CSV, OFX, XLS/XLSX e PDF.
 *
 * Processamento local, sem React e sem Supabase.
 * Nenhum registro é gravado por este arquivo.
 *
 * Suporte especial para faturas Bradesco:
 * - Datas divididas entre dia e mês
 * - Compras que reutilizam a última data
 * - Valores brasileiros
 * - Parcelamentos
 * - Estornos e créditos
 * - Cabeçalhos e totais ignorados
 */

export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024
export const MAXIMO_TRANSACOES = 2000
export const FORMATOS_SUPORTADOS = [
  'csv', 'ofx', 'xlsx', 'xls', 'pdf'
]

// ============================================================
// NORMALIZAÇÃO
// ============================================================

export function semAcentos(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const norm = valor =>
  semAcentos(valor).toLowerCase().replace(/\s+/g, ' ').trim()

export function decodificarTexto(bytes) {
  const u8 = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes)

  try {
    return new TextDecoder('utf-8', {
      fatal: true
    }).decode(u8).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(u8)
  }
}

// ============================================================
// VALORES MONETÁRIOS
// ============================================================

export function numeroBR(entrada) {
  if (typeof entrada === 'number') {
    return Number.isFinite(entrada)
      ? Math.round(entrada * 100) / 100
      : null
  }

  let s = String(entrada ?? '').trim()
  if (!s) return null

  let negativo = false

  if (/^\(.*\)$/.test(s)) {
    negativo = true
    s = s.slice(1, -1)
  }

  if (/\s*D$/i.test(s)) {
    negativo = true
    s = s.replace(/\s*D$/i, '')
  } else {
    s = s.replace(/\s*C$/i, '')
  }

  s = s.replace(/R\$/gi, '').replace(/\s/g, '')

  if (/-$/.test(s)) {
    negativo = true
    s = s.slice(0, -1)
  }

  if (/^[-−]/.test(s)) {
    negativo = !negativo
    s = s.slice(1)
  }

  s = s.replace(/^\+/, '')

  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) {
    return null
  }

  const ponto = s.lastIndexOf('.')
  const virgula = s.lastIndexOf(',')

  if (ponto >= 0 && virgula >= 0) {
    s = virgula > ponto
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '')
  } else if (virgula >= 0) {
    if ((s.match(/,/g) || []).length > 1) return null
    s = s.replace(',', '.')
  } else if (ponto >= 0) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, '')
    } else if ((s.match(/\./g) || []).length > 1) {
      return null
    }
  }

  const n = Number(s)
  return Number.isFinite(n)
    ? Math.round((negativo ? -n : n) * 100) / 100
    : null
}

// ============================================================
// DATAS
// ============================================================

function isoValida(ano, mes, dia) {
  const dt = new Date(Date.UTC(ano, mes - 1, dia))

  if (
    dt.getUTCFullYear() !== ano ||
    dt.getUTCMonth() + 1 !== mes ||
    dt.getUTCDate() !== dia ||
    ano < 1990 ||
    ano > 2100
  ) {
    return null
  }

  return [
    String(ano).padStart(4, '0'),
    String(mes).padStart(2, '0'),
    String(dia).padStart(2, '0')
  ].join('-')
}

export function dataBR(entrada, anoPadrao = null) {
  if (entrada instanceof Date) {
    if (Number.isNaN(entrada.getTime())) return null
    return isoValida(
      entrada.getFullYear(),
      entrada.getMonth() + 1,
      entrada.getDate()
    )
  }

  const s = String(entrada ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (m) return isoValida(+m[1], +m[2], +m[3])

  m = s.match(/^(\d{4})(\d{2})(\d{2})/)

  if (m) return isoValida(+m[1], +m[2], +m[3])

  m = s.match(
    /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/
  )

  if (m) {
    const ano = m[3].length === 2
      ? 2000 + Number(m[3])
      : Number(m[3])

    return isoValida(ano, +m[2], +m[1])
  }

  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/)

  if (m && anoPadrao) {
    return isoValida(+anoPadrao, +m[2], +m[1])
  }

  return null
}

// ============================================================
// PARCELAMENTOS
// ============================================================

export function extrairParcela(descricao) {
  const s = norm(descricao)

  const m = s.match(
    /(?:parc(?:ela)?\.?\s*)?\(?\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b\)?/i
  )

  if (!m) return null

  const atual = Number(m[1])
  const total = Number(m[2])

  if (
    total < 2 ||
    total > 72 ||
    atual < 1 ||
    atual > total
  ) {
    return null
  }

  const prefixo = /parc/i.test(m[0])
  const posicaoFinal = m.index + m[0].length
  const resto = s.slice(posicaoFinal).trim()

  if (!prefixo && resto && resto !== ')') {
    return null
  }

  return {
    atual,
    total,
    texto: m[0]
  }
}

// ============================================================
// CSV
// ============================================================

function detectarDelimitador(texto) {
  const linhas = String(texto)
    .split(/\r?\n/)
    .filter(l => l.trim())
    .slice(0, 10)

  let melhor = ';'
  let pontuacao = -1

  for (const separador of [';', ',', '\t', '|']) {
    const contagens = linhas.map(linha => {
      let total = 0
      let aspas = false

      for (let i = 0; i < linha.length; i++) {
        const c = linha[i]

        if (c === '"') {
          if (aspas && linha[i + 1] === '"') {
            i++
          } else {
            aspas = !aspas
          }
        } else if (c === separador && !aspas) {
          total++
        }
      }

      return total
    })

    const positivos = contagens.filter(n => n > 0)
    if (!positivos.length) continue

    const frequencias = new Map()
    for (const n of positivos) {
      frequencias.set(n, (frequencias.get(n) || 0) + 1)
    }

    const consistente = Math.max(...frequencias.values())
    const pontos = consistente * 1000 +
      positivos.reduce((a, b) => a + b, 0)

    if (pontos > pontuacao) {
      melhor = separador
      pontuacao = pontos
    }
  }

  return melhor
}

export function parseCSV(texto) {
  const t = String(texto ?? '').replace(/^\uFEFF/, '')
  const delimitador = detectarDelimitador(t)

  const linhas = []
  let campo = ''
  let linha = []
  let aspas = false

  for (let i = 0; i < t.length; i++) {
    const c = t[i]

    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          aspas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      aspas = true
    } else if (c === delimitador) {
      linha.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++

      linha.push(campo)
      campo = ''

      if (linha.some(v => v.trim())) linhas.push(linha)
      linha = []
    } else {
      campo += c
    }
  }

  linha.push(campo)
  if (linha.some(v => v.trim())) linhas.push(linha)

  return linhas.map(l => l.map(v => v.trim()))
}

// ============================================================
// PLANILHAS / TABELAS
// ============================================================

const SINONIMOS = {
  data: [
    'data', 'date', 'dt', 'data lancamento',
    'data do lancamento', 'data da compra',
    'data movimento', 'data mov', 'data da transacao',
    'data operacao'
  ],
  descricao: [
    'descricao', 'historico', 'lancamento',
    'estabelecimento', 'memo', 'title', 'titulo',
    'detalhes', 'descricao do lancamento',
    'local', 'identificacao'
  ],
  valor: [
    'valor', 'amount', 'valor (r$)', 'valor r$',
    'quantia', 'valor em r$', 'valor da transacao',
    'valor liquido'
  ],
  debito: ['debito', 'saida', 'saidas', 'debitos', 'valor debito'],
  credito: ['credito', 'entrada', 'entradas', 'creditos', 'valor credito'],
  id: [
    'id', 'identificador', 'documento', 'fitid',
    'codigo da transacao', 'id transacao',
    'nr documento', 'numero documento', 'n documento'
  ],
  parcela: ['parcela', 'parcelas', 'parcelamento'],
  tipo: ['tipo', 'movimentacao', 'tipo de movimentacao', 'operacao', 'evento'],
  ativo: ['ativo', 'produto', 'papel', 'codigo', 'ticker', 'investimento']
}

export function detectarColunas(cabecalho) {
  const nomes = cabecalho.map(c =>
    norm(c).replace(/[:*]/g, '').trim()
  )

  const mapa = {}

  for (const [chave, sinonimos] of Object.entries(SINONIMOS)) {
    let indice = nomes.findIndex(n => sinonimos.includes(n))

    if (indice < 0) {
      indice = nomes.findIndex(n =>
        n && sinonimos.some(s => s.length >= 4 && n.startsWith(s))
      )
    }

    if (indice >= 0 && !Object.values(mapa).includes(indice)) {
      mapa[chave] = indice
    }
  }

  return mapa
}

function colunasValidas(m) {
  return m.data != null &&
    (m.descricao != null || m.tipo != null || m.ativo != null) &&
    (m.valor != null || m.debito != null || m.credito != null)
}

const LINHA_INFORMATIVA =
  /^(saldo( anterior| do dia| final| inicial| disponivel| em conta)?|s a l d o|total( da fatura| geral)?|subtotal|limite)\b/

export function tabelaParaTransacoes(
  linhas,
  { anoPadrao = null } = {}
) {
  const descartadas = []
  let inicio = -1
  let mapa = null

  for (let i = 0; i < Math.min(linhas.length, 25); i++) {
    const candidato = detectarColunas(linhas[i] || [])

    if (colunasValidas(candidato)) {
      inicio = i
      mapa = candidato
      break
    }
  }

  if (!mapa) {
    return {
      transacoes: [],
      descartadas,
      erro: 'Não encontramos as colunas de data, descrição e valor.'
    }
  }

  const tipoDocumento = detectarTipoDocumento(
    linhas.slice(0, Math.max(inicio, 25))
      .map(l => Array.isArray(l) ? l.join(' ') : String(l))
  )

  const transacoes = []

  for (let i = inicio + 1; i < linhas.length; i++) {
    const linha = linhas[i] || []
    const celula = chave =>
      mapa[chave] != null ? linha[mapa[chave]] : undefined

    const descricao = (
      mapa.descricao != null
        ? String(celula('descricao') ?? '')
        : [celula('tipo'), celula('ativo')]
          .filter(v => String(v ?? '').trim())
          .join(' - ')
    ).trim()

    const data = dataBR(celula('data'), anoPadrao)

    const semAno = /^\s*\d{1,2}[/.-]\d{1,2}\s*$/.test(
      String(celula('data') ?? '')
    )

    let valor = mapa.valor != null
      ? numeroBR(celula('valor'))
      : null

    if (valor == null) {
      const debito = numeroBR(celula('debito'))
      const credito = numeroBR(celula('credito'))

      if (debito != null && debito !== 0) {
        valor = -Math.abs(debito)
      } else if (credito != null && credito !== 0) {
        valor = Math.abs(credito)
      }
    }

    if (!descricao && data == null && valor == null) continue

    if (LINHA_INFORMATIVA.test(norm(descricao))) {
      descartadas.push({
        linha: i + 1,
        motivo: 'Linha de saldo ou total'
      })
      continue
    }

    if (!data || valor == null || valor === 0) {
      descartadas.push({
        linha: i + 1,
        motivo: !data ? 'Data inválida' : 'Valor inválido'
      })
      continue
    }

    const parcelaColuna = String(celula('parcela') ?? '')
    const parcela = extrairParcela(parcelaColuna) ||
      extrairParcela(descricao)

    transacoes.push({
      linha: i + 1,
      data,
      descricao: descricao || '(sem descrição)',
      valor,
      idOrigem: celula('id')
        ? String(celula('id')).trim()
        : null,
      parcelaAtual: parcela?.atual ?? null,
      parcelaTotal: parcela?.total ?? null,
      tipoInformado: celula('tipo')
        ? String(celula('tipo')).trim()
        : null,
      ativo: celula('ativo')
        ? String(celula('ativo')).trim()
        : null,
      revisar: !descricao || semAno,
      avisos: semAno
        ? ['Data sem ano: confira o ano utilizado']
        : []
    })
  }

  return {
    transacoes,
    descartadas,
    tipoDocumento,
    erro: null
  }
}

// ============================================================
// OFX
// ============================================================

function tagOFX(bloco, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*([^<\\r\\n]*)`,
    'i'
  )

  return bloco.match(re)?.[1]?.trim() || null
}

export function parseOFX(texto) {
  const t = String(texto ?? '')

  if (!/<OFX(?:\s[^>]*)?>/i.test(t)) {
    return {
      transacoes: [],
      descartadas: [],
      erro: 'Arquivo OFX inválido.'
    }
  }

  const ehCartao = /<CCSTMTRS>/i.test(t)
  const conta = {
    banco: tagOFX(t, 'ORG') || tagOFX(t, 'BANKID'),
    conta: tagOFX(t, 'ACCTID')
  }

  const blocos = t.split(/<STMTTRN>/i)
    .slice(1)
    .map(b => b.split(/<\/STMTTRN>/i)[0])

  const transacoes = []
  const descartadas = []

  blocos.forEach((bloco, i) => {
    const data = dataBR(
      tagOFX(bloco, 'DTPOSTED') ||
      tagOFX(bloco, 'DTUSER')
    )

    const valor = numeroBR(tagOFX(bloco, 'TRNAMT'))

    const descricao = [
      tagOFX(bloco, 'NAME'),
      tagOFX(bloco, 'MEMO')
    ].filter(Boolean).filter((v, j, a) =>
      a.indexOf(v) === j
    ).join(' - ')

    if (!data || valor == null || valor === 0) {
      descartadas.push({
        linha: i + 1,
        motivo: !data ? 'Data inválida' : 'Valor inválido'
      })
      return
    }

    const parcela = extrairParcela(descricao)

    transacoes.push({
      linha: i + 1,
      data,
      descricao: descricao || '(sem descrição)',
      valor,
      idOrigem: tagOFX(bloco, 'FITID'),
      parcelaAtual: parcela?.atual ?? null,
      parcelaTotal: parcela?.total ?? null,
      tipoInformado: tagOFX(bloco, 'TRNTYPE'),
      ativo: null,
      revisar: !descricao,
      avisos: descricao ? [] : ['Descrição ausente']
    })
  })

  return {
    transacoes,
    descartadas,
    erro: blocos.length ? null : 'Nenhuma transação encontrada no OFX.',
    conta,
    ehCartao
  }
}

// ============================================================
// IDENTIFICAÇÃO DE INSTITUIÇÃO E TIPO
// ============================================================

const INSTITUICOES = [
  ['Bradesco', /bradesco/i],
  ['Nubank', /nubank|nu pagamentos/i],
  ['Itaú', /ita[uú]/i],
  ['Santander', /santander/i],
  ['Banco do Brasil', /banco do brasil/i],
  ['Caixa', /caixa economica/i],
  ['Inter', /banco inter/i],
  ['C6 Bank', /c6 bank/i],
  ['XP Investimentos', /xp investimentos/i],
  ['BTG Pactual', /btg pactual/i],
  ['Mercado Pago', /mercado pago/i],
  ['PicPay', /picpay/i],
  ['Sicredi', /sicredi/i],
  ['Sicoob', /sicoob/i],
  ['Neon', /\bneon\b/i],
  ['BS2', /\bbs2\b/i]
]

export function detectarInstituicao(linhas) {
  const topo = (linhas || []).slice(0, 80).join(' ')
  return INSTITUICOES.find(([, re]) =>
    re.test(topo)
  )?.[0] || null
}

export function detectarTipoDocumento(linhas) {
  const t = norm((linhas || []).slice(0, 80).join(' '))

  // Investimentos primeiro, pois pode conter "extrato" no nome
  if (
    /carteira de investimentos|extrato de investimentos|nota de negociacao|posicao consolidada/.test(t)
  ) {
    return 'investimentos'
  }

  // Extrato bancário
  if (/extrato/.test(t)) return 'extrato'

  // Fatura de cartão
  if (
    /\bfatura\b/.test(t) &&
    /cartao|vencimento|limite|fechamento/.test(t)
  ) {
    return 'fatura'
  }

  return null
}

// ============================================================
// RECONHECIMENTO DE PDF
// ============================================================

const MESES = {
  jan: 1, fev: 2, mar: 3, abr: 4,
  mai: 5, jun: 6, jul: 7, ago: 8,
  set: 9, out: 10, nov: 11, dez: 12
}

const DATA_PDF =
  String.raw`(?:\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s*(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?(?:\s*(?:de\s+)?\d{2,4})?)`

const RE_DATA_INICIO = new RegExp(
  String.raw`^(${DATA_PDF})(?=\s|\||$)`,
  'i'
)

const RE_DATA_COMPLETA =
  /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g

const RE_VALOR_FINAL =
  /(?:\s+|\s*\|\s*)(\(?[-+−]?\s*(?:R\$\s*)?\d[\d.]*,\d{2}(?:\s*[DC])?\)?-?)\s*$/i

const RE_INFORMATIVA =
  /^(?:saldo\b|total\b|subtotal\b|limite\b|vencimento\b|fechamento\b|valor da fatura\b|pagamento minimo\b|melhor data\b|data de\b|resumo das despesas\b|taxas mensais\b)/i

const RE_PAGAMENTO_FATURA =
  /^(?:pagto\.?\s+por\s+deb|pagamento\s+(?:da\s+)?fatura|pagamento\s+recebido)/i

function referenciaDocumento(linhas, anoPadrao) {
  let maior = null

  for (const l of linhas) {
    for (const m of String(l).matchAll(RE_DATA_COMPLETA)) {
      const iso = dataBR(`${m[1]}/${m[2]}/${m[3]}`)
      if (iso && (!maior || iso > maior)) maior = iso
    }
  }

  return maior
    ? {
        ano: +maior.slice(0, 4),
        mes: +maior.slice(5, 7),
        deduzida: true
      }
    : {
        ano: anoPadrao || new Date().getFullYear(),
        mes: 12,
        deduzida: false
      }
}

function interpretarDataPDF(texto, ref) {
  const t = norm(texto)
  let m = t.match(
    /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/
  )

  let dia, mes, ano

  if (m) {
    dia = +m[1]
    mes = +m[2]
    ano = m[3]
      ? (m[3].length === 2 ? 2000 + +m[3] : +m[3])
      : null
  } else {
    m = t.match(
      /^(\d{1,2})\s*(?:de\s+)?([a-z]{3})[a-z]*\.?(?:\s*(?:de\s+)?(\d{2}|\d{4}))?$/
    )

    if (!m || !MESES[m[2]]) return null

    dia = +m[1]
    mes = MESES[m[2]]
    ano = m[3]
      ? (m[3].length === 2 ? 2000 + +m[3] : +m[3])
      : null
  }

  const semAno = ano == null
  if (semAno) ano = mes > ref.mes ? ref.ano - 1 : ref.ano

  const iso = isoValida(ano, mes, dia)

  return iso ? { iso, semAno, ano } : null
}

function extrairValoresFinais(texto) {
  let restante = texto
  const valores = []

  for (let i = 0; i < 2; i++) {
    const m = restante.match(RE_VALOR_FINAL)
    if (!m) break

    const valor = numeroBR(m[1])
    if (valor == null) break

    valores.unshift({
      valor,
      original: m[1]
    })

    restante = restante.slice(0, m.index).trimEnd()
  }

  let descricao = restante.replace(/[|;\s]+$/, '').trim()
  
  // Remove padrões de final do cartão (•••• 1234, Final 1234, etc)
  descricao = descricao.replace(/[•*]{4,}\s*\d{4}/g, '').trim()
  descricao = descricao.replace(/\bfinal\s*\d{4}\b/gi, '').trim()

  return {
    descricao,
    valores
  }
}

function linhaIgnoravel(texto) {
  const s = norm(texto)

  return !s ||
    RE_INFORMATIVA.test(s) ||
    /^data lancamentos/.test(s) ||
    /^moeda de origem/.test(s) ||
    /^gastos referentes ao cartao/.test(s) ||
    /^cartao selecionado/.test(s) ||
    /^fatura\b/.test(s) ||
    /^resumo das despesas/.test(s) ||
    /^extrato em aberto/.test(s) ||
    /^taxa ao mes/.test(s) ||
    /^forma de pagamento/.test(s) ||
    /^matheus\b.*\b(almeida)\b/.test(s) ||
    /^leticia\b.*\b(almeida)\b/.test(s)
}

/**
 * Recebe linhas já extraídas por PDF.js ou OCR.
 *
 * As datas podem estar:
 * 10 NOV
 * 10/11
 * 10/11/2026
 * 10
 * NOV
 *
 * Também reconhece compras que não repetem a data:
 * 10 NOV
 * LOJA A 20,00
 * LOJA B 35,00
 */

export function textoPDFParaTransacoes(
  linhasTexto,
  { anoPadrao = null, ocr = false } = {}
) {
  const linhas = (Array.isArray(linhasTexto) ? linhasTexto : [])
    .map(v => String(v ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const ref = referenciaDocumento(linhas, anoPadrao)
  const transacoes = []
  const descartadas = []

  const info = {
    instituicao: detectarInstituicao(linhas),
    tipoDocumento: detectarTipoDocumento(linhas),
    ocr
  }

  const ehFaturaBradesco =
    info.instituicao === 'Bradesco' &&
    info.tipoDocumento === 'fatura'

  let dataAtual = null
  let diaPendente = null
  let saldoAnterior = null
  let emLancamentos = !ehFaturaBradesco

  let cartaoAtual = null

  for (let i = 0; i < linhas.length; i++) {
    let linha = linhas[i]

    // Cabeçalho de um cartão da fatura.
    const cabecalhoCartao = linha.match(
      /gastos referentes ao cart[aã]o:?\s*final\s*(\d{4})/i
    )

    if (cabecalhoCartao) {
      cartaoAtual = cabecalhoCartao[1]
      dataAtual = null
      diaPendente = null
      emLancamentos = true
      continue
    }

    if (!emLancamentos) continue

    // Ao entrar no resumo financeiro, encerra a leitura.
    if (
      /^resumo das despesas\b/i.test(norm(linha)) ||
      /^taxas mensais\b/i.test(norm(linha))
    ) {
      emLancamentos = false
      continue
    }

    // Data no formato isolado:
    // "10" seguido de "NOV".
    if (/^\d{1,2}$/.test(linha)) {
      const numero = Number(linha)

      if (numero >= 1 && numero <= 31) {
        diaPendente = numero
        continue
      }
    }

    // Mês isolado depois de um dia.
    const mesIsolado = norm(linha).match(
      /^(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?$/
    )

    if (mesIsolado && diaPendente != null) {
      const data = interpretarDataPDF(
        `${diaPendente} ${mesIsolado[1]}`,
        ref
      )

      if (data) dataAtual = data
      diaPendente = null
      continue
    }

    // Data no começo da linha.
    const dataInicio = linha.match(RE_DATA_INICIO)

    if (dataInicio) {
      const data = interpretarDataPDF(dataInicio[1], ref)

      if (data) {
        dataAtual = data
        diaPendente = null
      }

      linha = linha.slice(dataInicio[0].length).trim()
      if (!linha) continue
    }

    if (linhaIgnoravel(linha)) {
      if (/^saldo anterior\b/i.test(norm(linha))) {
        const r = extrairValoresFinais(` ${linha}`)
        if (r.valores.length) {
          saldoAnterior = r.valores.at(-1).valor
        }
      }
      continue
    }

    const { descricao, valores } = extrairValoresFinais(
      ` ${linha}`
    )

    if (!valores.length) {
      // Linha com possível descrição mas sem valor
      if (dataAtual && descricao && /[a-zA-ZÀ-ÿ]/.test(descricao)) {
        descartadas.push({
          linha: i + 1,
          motivo: 'Valor não identificado',
          trecho: linha.slice(0, 90)
        })
      }
      continue
    }

    if (
      !descricao ||
      !/[a-zA-ZÀ-ÿ]/.test(descricao) ||
      RE_INFORMATIVA.test(norm(descricao))
    ) {
      continue
    }

    if (!dataAtual) {
      descartadas.push({
        linha: i + 1,
        motivo: 'Data não identificada',
        trecho: linha.slice(0, 90)
      })
      continue
    }

    let valor = valores[0].valor
    if (valor === 0) continue

    const saldoLinha = valores.length === 2
      ? valores[1].valor
      : null

    const avisos = [
      ocr
        ? 'Lido por OCR: confira data, valor e descrição'
        : 'Lido do PDF: confira data, valor e descrição'
    ]

    let sinalIncerto = false
    const sinalExplicito =
      /^\s*[-−(]/.test(valores[0].original) ||
      /[-D)]\s*$/i.test(valores[0].original)

    if (!sinalExplicito && !ehFaturaBradesco) {
      const diferenca =
        saldoLinha != null && saldoAnterior != null
          ? saldoLinha - saldoAnterior
          : null

      if (
        diferenca != null &&
        Math.abs(Math.abs(diferenca) - Math.abs(valor)) < 0.015
      ) {
        valor = diferenca < 0
          ? -Math.abs(valor)
          : Math.abs(valor)

        avisos.push('Sinal deduzido pela variação do saldo')
      } else {
        sinalIncerto = true
        avisos.push('Confirme se é entrada ou saída')
      }
    }

    if (saldoLinha != null) saldoAnterior = saldoLinha

    if (dataAtual.semAno) {
      avisos.push(
        `Ano ${dataAtual.ano} deduzido da fatura; confira`
      )
    }

    if (ehFaturaBradesco) {
      avisos.push(
        'Fatura de cartão: confira compras, créditos e estornos'
      )
    }

    if (cartaoAtual) {
      avisos.push(
        `Cartão final ${cartaoAtual}: confira a vinculação`
      )
    }

    const parcela = extrairParcela(descricao)

    transacoes.push({
      linha: i + 1,
      data: dataAtual.iso,
      descricao,
      valor,
      idOrigem: null,
      parcelaAtual: parcela?.atual ?? null,
      parcelaTotal: parcela?.total ?? null,
      tipoInformado: ehFaturaBradesco
        ? 'fatura'
        : null,
      ativo: null,
      revisar: true,
      sinalIncerto,
      avisos
    })
  }

  return {
    transacoes,
    descartadas: descartadas.slice(0, 200),
    ...info,
    erro: transacoes.length
      ? null
      : 'Nenhum lançamento com data, descrição e valor foi reconhecido neste PDF. Caso necessário, adicione os lançamentos manualmente.'
  }
}

// ============================================================
// FORMATO DO ARQUIVO
// ============================================================

export function detectarFormato(nome, bytes) {
  const ext = String(nome || '')
    .toLowerCase()
    .split('.')
    .pop()

  const u8 = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes || [])

  if (!u8.length) {
    return { formato: null, erro: 'O arquivo está vazio.' }
  }

  if (u8.length > TAMANHO_MAXIMO_BYTES) {
    return {
      formato: null,
      erro: 'O arquivo passa de 5 MB. Exporte um período menor.'
    }
  }

  const inicio = String.fromCharCode(...u8.slice(0, 8))

  const ehZip =
    u8[0] === 0x50 &&
    u8[1] === 0x4b &&
    u8[2] === 0x03 &&
    u8[3] === 0x04

  const ehOle =
    u8[0] === 0xd0 &&
    u8[1] === 0xcf &&
    u8[2] === 0x11 &&
    u8[3] === 0xe0

  if (inicio.startsWith('%PDF-')) {
    return { formato: 'pdf', erro: null }
  }

  if (ehZip) {
    return ext === 'xlsx'
      ? { formato: 'xlsx', erro: null }
      : {
          formato: null,
          erro: 'Arquivo compactado não suportado.'
        }
  }

  if (ehOle) {
    return ext === 'xls'
      ? { formato: 'xls', erro: null }
      : {
          formato: null,
          erro: 'Formato não suportado.'
        }
  }

  if (u8.slice(0, 2048).some(b => b === 0)) {
    return {
      formato: null,
      erro: 'Arquivo binário não suportado ou corrompido.'
    }
  }

  const texto = decodificarTexto(u8.slice(0, 4096))

  if (/OFXHEADER|<OFX>/i.test(texto) || ext === 'ofx') {
    return { formato: 'ofx', erro: null }
  }

  if (ext === 'csv' || ext === 'txt') {
    return { formato: 'csv', erro: null }
  }

  if (['pdf', 'xlsx', 'xls'].includes(ext)) {
    return {
      formato: null,
      erro: 'O conteúdo não corresponde à extensão do arquivo.'
    }
  }

  return {
    formato: null,
    erro: 'Formato não suportado. Use CSV, OFX, XLS, XLSX ou PDF.'
  }
}

// ============================================================
// LIMITE DE TRANSAÇÕES
// ============================================================

export function aplicarLimite(resultado) {
  const transacoes = Array.isArray(resultado?.transacoes)
    ? resultado.transacoes
    : []

  if (transacoes.length <= MAXIMO_TRANSACOES) {
    return { ...resultado, transacoes }
  }

  return {
    ...resultado,
    transacoes: transacoes.slice(0, MAXIMO_TRANSACOES),
    truncado: true
  }
}
