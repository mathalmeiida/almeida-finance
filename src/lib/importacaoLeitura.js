// ─── Importação Inteligente: leitura de arquivos (funções puras) ─────────────
// Sem React, sem Supabase, sem rede. Tudo roda no navegador do usuário: o
// arquivo nunca é enviado a servidores. Testável em Node.
//
// Saída comum de todos os leitores: lista de "transações brutas"
//   { linha, data: 'AAAA-MM-DD', descricao, valor (com sinal: < 0 = saída),
//     idOrigem (FITID/identificador do banco ou null), parcelaAtual,
//     parcelaTotal, tipoInformado, ativo, revisar (bool), avisos: [] }
// Nada é inventado: linhas sem data OU sem valor válidos são descartadas e
// contadas em `descartadas`, com o motivo.

export const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024 // 5 MB
export const MAXIMO_TRANSACOES = 2000
export const FORMATOS_SUPORTADOS = ['csv', 'ofx', 'xlsx', 'xls', 'pdf']

// ── Texto e normalização ─────────────────────────────────────────────────────
export function semAcentos(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
const norm = s => semAcentos(s).toLowerCase().replace(/\s+/g, ' ').trim()

// Decodifica bytes de texto: UTF-8 (com ou sem BOM); se inválido, Windows-1252
// (padrão de muitos bancos brasileiros).
export function decodificarTexto(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(u8).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1252').decode(u8)
  }
}

// ── Números no formato brasileiro (e variações comuns) ───────────────────────
// "1.234,56" | "-1.234,56" | "R$ 1.234,56" | "(123,45)" | "123,45 D" |
// "123,45-" | "1234.56" | "1,234.56". Devolve null se não for número.
export function numeroBR(entrada) {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? Math.round(entrada * 100) / 100 : null
  let s = String(entrada ?? '').trim()
  if (!s) return null
  let negativo = false
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1) }
  if (/\s*D$/i.test(s)) { negativo = true; s = s.replace(/\s*D$/i, '') }
  else if (/\s*C$/i.test(s)) s = s.replace(/\s*C$/i, '')
  s = s.replace(/R\$/gi, '').replace(/\s/g, '')
  if (/-$/.test(s)) { negativo = true; s = s.slice(0, -1) }
  if (/^[-−]/.test(s)) { negativo = !negativo; s = s.slice(1) }
  if (/^\+/.test(s)) s = s.slice(1)
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const ultPonto = s.lastIndexOf('.')
  const ultVirgula = s.lastIndexOf(',')
  let normalizado
  if (ultPonto >= 0 && ultVirgula >= 0) {
    normalizado = ultVirgula > ultPonto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (ultVirgula >= 0) {
    if ((s.match(/,/g) || []).length > 1) return null
    normalizado = s.replace(',', '.')
  } else if (ultPonto >= 0) {
    // "1.234" ou "1.234.567" = milhar; "12.5"/"1234.56" = decimal
    normalizado = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s
    if ((normalizado.match(/\./g) || []).length > 1) return null
  } else normalizado = s
  const n = Number(normalizado)
  if (!Number.isFinite(n)) return null
  return Math.round((negativo ? -n : n) * 100) / 100
}

// ── Datas ────────────────────────────────────────────────────────────────────
function isoValida(a, m, d) {
  const dt = new Date(Date.UTC(a, m - 1, d))
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  if (a < 1990 || a > 2100) return null
  return `${String(a).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// Aceita dd/mm/aaaa, dd/mm/aa, dd-mm-aaaa, dd.mm.aaaa, aaaa-mm-dd, aaaammdd
// (OFX) e dd/mm (somente com anoPadrao). Objetos Date também.
export function dataBR(entrada, anoPadrao = null) {
  if (entrada instanceof Date && !Number.isNaN(entrada.getTime())) {
    return isoValida(entrada.getFullYear(), entrada.getMonth() + 1, entrada.getDate())
  }
  const s = String(entrada ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return isoValida(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{4})(\d{2})(\d{2})/)
  if (m && s.length >= 8 && /^\d{8}/.test(s)) return isoValida(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b/)
  if (m) {
    let a = +m[3]
    if (m[3].length === 2) a += 2000
    return isoValida(a, +m[2], +m[1])
  }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})$/)
  if (m && anoPadrao) return isoValida(+anoPadrao, +m[2], +m[1])
  return null
}

// ── Parcelas na descrição: "PARC 03/10", "3/10", "03 DE 10", "PARCELA 2/6" ──
export function extrairParcela(descricao) {
  const s = norm(descricao)
  const m = s.match(/(?:parc(?:ela)?\.?\s*)?\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\b(?!\/\d)/)
  if (!m) return null
  const atual = +m[1], total = +m[2]
  if (!(total >= 2 && total <= 72 && atual >= 1 && atual <= total)) return null
  // Evita confundir datas "05/11" sem a palavra parcela: só aceita sem o
  // prefixo quando o total parece de parcelamento e a expressão está no fim.
  const temPrefixo = /parc/.test(m[0]) || /\bde\b/.test(m[0])
  const noFim = m.index + m[0].length >= s.length
  if (!temPrefixo && !noFim) return null
  return { atual, total, texto: m[0] }
}

// ── CSV ──────────────────────────────────────────────────────────────────────
function detectarDelimitador(texto) {
  const amostra = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 10)
  let melhor = ';', pontos = -1
  for (const d of [';', ',', '\t', '|']) {
    const contagens = amostra.map(l => {
      let n = 0, aspas = false
      for (const c of l) { if (c === '"') aspas = !aspas; else if (c === d && !aspas) n++ }
      return n
    })
    const consistentes = contagens.filter(n => n > 0 && n === contagens[contagens.length - 1]).length
    const total = contagens.reduce((a, b) => a + b, 0)
    const p = consistentes * 1000 + total
    if (total > 0 && p > pontos) { melhor = d; pontos = p }
  }
  return melhor
}

export function parseCSV(texto) {
  const t = String(texto ?? '').replace(/^\uFEFF/, '')
  const d = detectarDelimitador(t)
  const linhas = []
  let campo = '', linha = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++ } else aspas = false
      } else campo += c
    } else if (c === '"') aspas = true
    else if (c === d) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some(x => x.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some(x => x.trim() !== '')) linhas.push(linha)
  return linhas.map(l => l.map(x => x.trim()))
}

// ── Tabela (CSV/XLSX) → transações ──────────────────────────────────────────
const SINONIMOS = {
  data: ['data', 'date', 'dt', 'data lancamento', 'data do lancamento', 'data da compra', 'data movimento', 'data mov', 'data da transacao', 'data operacao'],
  descricao: ['descricao', 'historico', 'lancamento', 'estabelecimento', 'memo', 'title', 'titulo', 'detalhes', 'descricao do lancamento', 'local', 'identificacao'],
  valor: ['valor', 'amount', 'valor (r$)', 'valor r$', 'quantia', 'valor em r$', 'valor da transacao', 'valor liquido'],
  debito: ['debito', 'saida', 'saidas', 'debitos', 'valor debito'],
  credito: ['credito', 'entrada', 'entradas', 'creditos', 'valor credito'],
  id: ['id', 'identificador', 'documento', 'fitid', 'codigo da transacao', 'id transacao', 'nr documento', 'numero documento', 'n documento'],
  parcela: ['parcela', 'parcelas', 'parcelamento'],
  tipo: ['tipo', 'movimentacao', 'tipo de movimentacao', 'operacao', 'evento'],
  ativo: ['ativo', 'produto', 'papel', 'codigo', 'ticker', 'investimento'],
}

export function detectarColunas(cabecalho) {
  const nomes = cabecalho.map(c => norm(c).replace(/[:*]/g, '').trim())
  const mapa = {}
  for (const [chave, lista] of Object.entries(SINONIMOS)) {
    let i = nomes.findIndex(n => lista.includes(n))
    if (i < 0) i = nomes.findIndex(n => n && lista.some(s => s.length >= 4 && n.startsWith(s)))
    if (i >= 0 && !Object.values(mapa).includes(i)) mapa[chave] = i
  }
  return mapa
}

// Descrição pode vir de "Descrição" ou, em extratos de investimento, de
// "Tipo"/"Ativo" (ex.: Data, Tipo, Ativo, Valor).
function colunasValidas(m) {
  return m.data != null && (m.descricao != null || m.tipo != null || m.ativo != null) &&
    (m.valor != null || m.debito != null || m.credito != null)
}

const DESCRICOES_INFORMATIVAS = /^(saldo( anterior| do dia| final| inicial| disponivel| em conta)?|s a l d o|total( da fatura| geral)?|subtotal|limite)\b/

export function tabelaParaTransacoes(linhas, { anoPadrao = null } = {}) {
  const descartadas = []
  let inicio = -1, mapa = null
  for (let i = 0; i < Math.min(linhas.length, 25); i++) {
    const m = detectarColunas(linhas[i] || [])
    if (colunasValidas(m)) { inicio = i; mapa = m; break }
  }
  if (!mapa) return { transacoes: [], descartadas, erro: 'Não encontramos as colunas de data, descrição e valor. Use um arquivo com cabeçalho (ex.: Data; Descrição; Valor).' }

  // Detectar tipo de documento pelo cabeçalho
  const cabecalhoTexto = linhas.slice(0, Math.max(inicio, 25)).map(linha => Array.isArray(linha) ? linha.join(' ') : String(linha))
  const tipoDocumento = detectarTipoDocumento(cabecalhoTexto)

  const transacoes = []
  for (let i = inicio + 1; i < linhas.length; i++) {
    const l = linhas[i] || []
    const celula = k => (mapa[k] != null ? l[mapa[k]] : undefined)
    const descricao = (mapa.descricao != null
      ? String(celula('descricao') ?? '')
      : [celula('tipo'), celula('ativo')].filter(x => String(x ?? '').trim()).join(' - ')).trim()
    const data = dataBR(celula('data'), anoPadrao)
    const semAno = /^\s*\d{1,2}[/.-]\d{1,2}\s*$/.test(String(celula('data') ?? ''))
    let valor = null
    if (mapa.valor != null) valor = numeroBR(celula('valor'))
    if (valor == null && (mapa.debito != null || mapa.credito != null)) {
      const deb = numeroBR(celula('debito'))
      const cred = numeroBR(celula('credito'))
      if (deb) valor = -Math.abs(deb)
      else if (cred) valor = Math.abs(cred)
    }
    if (!descricao && data == null && valor == null) continue // linha vazia
    if (DESCRICOES_INFORMATIVAS.test(norm(descricao))) { descartadas.push({ linha: i + 1, motivo: 'Linha de saldo/total (informativa)' }); continue }
    if (!data) { descartadas.push({ linha: i + 1, motivo: 'Data ausente ou inválida' }); continue }
    if (valor == null || valor === 0) { descartadas.push({ linha: i + 1, motivo: 'Valor ausente ou inválido' }); continue }
    let parcela = extrairParcela(descricao)
    const colParcela = celula('parcela')
    if (colParcela) {
      const m = String(colParcela).match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i)
      if (m && +m[2] >= 2 && +m[1] <= +m[2]) parcela = { atual: +m[1], total: +m[2] }
    }
    transacoes.push({
      linha: i + 1,
      data,
      descricao: descricao || '(sem descrição)',
      valor,
      idOrigem: celula('id') ? String(celula('id')).trim() || null : null,
      parcelaAtual: parcela?.atual ?? null,
      parcelaTotal: parcela?.total ?? null,
      tipoInformado: celula('tipo') ? String(celula('tipo')).trim() : null,
      ativo: celula('ativo') ? String(celula('ativo')).trim() : null,
      revisar: !descricao || semAno,
      avisos: [...(descricao ? [] : ['Sem descrição no arquivo']), ...(semAno ? [`Data sem ano no arquivo: assumimos ${anoPadrao}`] : [])],
    })
  }
  return { transacoes, descartadas, tipoDocumento: tipoDocumento || null, erro: null }
}

// ── OFX (SGML 1.x e XML 2.x) ────────────────────────────────────────────────
function tagOFX(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))
  return m ? m[1].trim() : null
}

export function parseOFX(texto) {
  const t = String(texto ?? '')
  if (!/<OFX>/i.test(t)) return { transacoes: [], descartadas: [], erro: 'Arquivo OFX inválido (sem o bloco <OFX>).' }
  const ehCartao = /<CCSTMTRS>/i.test(t)
  const conta = {
    banco: tagOFX(t, 'ORG') || tagOFX(t, 'BANKID'),
    conta: tagOFX(t, 'ACCTID'),
  }
  const blocos = t.split(/<STMTTRN>/i).slice(1).map(b => b.split(/<\/STMTTRN>/i)[0])
  const transacoes = [], descartadas = []
  blocos.forEach((b, i) => {
    const data = dataBR(tagOFX(b, 'DTPOSTED') || tagOFX(b, 'DTUSER'))
    const valor = numeroBR(tagOFX(b, 'TRNAMT'))
    const descricao = [tagOFX(b, 'NAME'), tagOFX(b, 'MEMO')].filter(Boolean)
      .filter((v, j, a) => a.indexOf(v) === j).join(' - ').trim()
    if (!data) { descartadas.push({ linha: i + 1, motivo: 'Data ausente ou inválida' }); return }
    if (valor == null || valor === 0) { descartadas.push({ linha: i + 1, motivo: 'Valor ausente ou inválido' }); return }
    const parcela = extrairParcela(descricao)
    transacoes.push({
      linha: i + 1, data, valor,
      descricao: descricao || '(sem descrição)',
      idOrigem: tagOFX(b, 'FITID') || null,
      parcelaAtual: parcela?.atual ?? null,
      parcelaTotal: parcela?.total ?? null,
      tipoInformado: tagOFX(b, 'TRNTYPE'),
      ativo: null,
      revisar: !descricao,
      avisos: descricao ? [] : ['Sem descrição no arquivo'],
    })
  })
  if (blocos.length === 0) return { transacoes, descartadas, erro: 'Nenhuma transação encontrada no OFX.', conta, ehCartao }
  return { transacoes, descartadas, erro: null, conta, ehCartao }
}

// ── Texto extraído de PDF (ou de OCR) → transações ───────────────────────────
// PDF não tem estrutura padronizada entre bancos. Aceitamos linhas que
// COMEÇAM com uma data e TERMINAM com um valor ("data  descrição  valor",
// opcionalmente seguido do saldo). Tudo fica marcado para revisão e nada é
// inventado: o que não bate com esse formato vai para "não reconhecidas".
const MES_RE = '(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\\.?'
const DATA_PDF = `(\\d{1,2}[/.-]\\d{1,2}(?:[/.-]\\d{2,4})?|\\d{1,2}\\s*(?:de\\s+)?${MES_RE}(?:\\s*(?:de\\s+|/)?\\d{4})?|\\d{1,2}[/.-]${MES_RE}(?:[/.-]\\d{2,4})?)`
const VALOR_PDF = '((?:-\\s?)?(?:R\\$\\s?)?\\d{1,3}(?:\\.\\d{3})*,\\d{2}(?:\\s?[-DC])?)'
const RE_LINHA_PDF = new RegExp(`^${DATA_PDF}\\s+(.+?)\\s+${VALOR_PDF}(?:\\s+${VALOR_PDF})?\\s*$`, 'i')
// Padrão alternativo: layout com mais espaçamento ou colunas diferentes
const RE_LINHA_PDF_ALT = new RegExp(`^${DATA_PDF}\\s+(.{3,}?)\\s{2,}${VALOR_PDF}(?:\\s+${VALOR_PDF})?\\s*$`, 'i')
// Padrão para Bradesco e layouts similares: data + descrição ocupando várias colunas + valor ao final
const RE_LINHA_PDF_BRADESCO = new RegExp(`^${DATA_PDF}[\\s\\|]+(.+?)\\s+${VALOR_PDF}\\s*$`, 'i')
const RE_COMECA_COM_DATA = new RegExp(`^${DATA_PDF}\\s+\\S`, 'i')
const RE_DATA_COMPLETA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g
const RE_INFORMATIVA_PDF = /^(vencimento|fechamento|valor (total|da fatura|minimo)|pagamento minimo|total|subtotal|saldo|limite|melhor dia|periodo|data de)/
const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 }

// Regras reutilizáveis por instituição (começam pelos nomes mais comuns; para
// incluir outra, basta acrescentar uma linha).
const INSTITUICOES = [
  ['Nubank', /nubank|nu pagamentos/], ['Itaú', /\bitau\b|itau unibanco/], ['Bradesco', /bradesco/],
  ['Santander', /santander/], ['Banco do Brasil', /banco do brasil/], ['Caixa', /caixa economica/],
  ['Inter', /banco inter\b/], ['C6 Bank', /\bc6 bank\b/], ['XP Investimentos', /\bxp (investimentos|inc)/],
  ['BTG Pactual', /btg pactual/], ['Mercado Pago', /mercado pago/], ['PicPay', /picpay/],
  ['Sicredi', /sicredi/], ['Sicoob', /sicoob/], ['Neon', /\bneon\b/], ['BS2', /\bbs2\b/],
]

export function detectarInstituicao(linhas) {
  const topo = norm(linhas.slice(0, 60).join(' '))
  const achada = INSTITUICOES.find(([, re]) => re.test(topo))
  return achada ? achada[0] : null
}

// 'fatura' | 'extrato' | 'investimentos' | null — só uma sugestão ao usuário.
export function detectarTipoDocumento(linhas) {
  // Só o cabeçalho (antes do primeiro lançamento): linhas como "PAGAMENTO
  // FATURA CARTAO" de um extrato não podem fazê-lo parecer uma fatura.
  const fim = linhas.findIndex(l => RE_COMECA_COM_DATA.test(String(l).trim()))
  const t = norm(linhas.slice(0, fim < 0 ? 80 : Math.min(fim, 80)).join(' '))
  if (/\bfatura\b/.test(t) && /(cartao|vencimento|limite|fechamento)/.test(t)) return 'fatura'
  if (/(posicao consolidada|carteira de investimentos|extrato de investimentos|nota de negociacao|rendimentos?)/.test(t) && /(investiment|cotas|ativos?|renda fixa|fundo)/.test(t)) return 'investimentos'
  if (/extrato/.test(t)) return 'extrato'
  return null
}

// Ano de referência: a maior data completa do documento (ex.: vencimento ou
// fim do período). Datas "dd/mm" ou "05 NOV" sem ano usam esse ano, ou o
// anterior quando o mês é posterior ao da referência (compra de dezembro numa
// fatura de janeiro).
function referenciaDoDocumento(linhas, anoPadrao) {
  let maior = null
  for (const l of linhas) {
    for (const m of String(l).matchAll(RE_DATA_COMPLETA)) {
      const iso = dataBR(`${m[1]}/${m[2]}/${m[3]}`)
      if (iso && (!maior || iso > maior)) maior = iso
    }
  }
  if (maior) return { ano: +maior.slice(0, 4), mes: +maior.slice(5, 7), deduzida: true }
  return { ano: anoPadrao || new Date().getFullYear(), mes: 12, deduzida: false }
}

function dataDoTrecho(trecho, ref) {
  const t = norm(trecho)
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/)
  let dia, mes, ano
  if (m) { dia = +m[1]; mes = +m[2]; ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null }
  else {
    m = t.match(/^(\d{1,2})[\s/.-]*(?:de\s+)?([a-z]{3})[a-z]*\.?(?:[\s/.-]*(?:de\s+)?(\d{2}|\d{4}))?$/)
    if (!m || !MESES[m[2]]) return null
    dia = +m[1]; mes = MESES[m[2]]; ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null
  }
  const semAno = ano == null
  if (semAno) ano = mes > ref.mes ? ref.ano - 1 : ref.ano
  const iso = dataBR(`${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`)
  return iso ? { iso, semAno, ano } : null
}

const SINAL_EXPLICITO = /^\s*-|^\(|-\s*$|\s[DC]$/i

export function textoPDFParaTransacoes(linhasTexto, { anoPadrao = null, ocr = false } = {}) {
  const linhas = linhasTexto.map(l => String(l).replace(/\s+/g, ' ').trim()).filter(Boolean)
  const ref = referenciaDoDocumento(linhas, anoPadrao)
  const transacoes = [], descartadas = []
  let saldoAnterior = null
  const info = { instituicao: detectarInstituicao(linhas), tipoDocumento: detectarTipoDocumento(linhas), ocr }

  linhas.forEach((l, i) => {
    // "Saldo anterior ..." sem data: só serve para deduzir o sinal dos lançamentos.
    const mSaldo = norm(l).match(/^saldo (anterior|inicial)\b/)
    if (mSaldo) {
      const v = [...l.matchAll(new RegExp(VALOR_PDF, 'gi'))].map(x => numeroBR(x[1])).filter(x => x != null)
      if (v.length) saldoAnterior = v[v.length - 1]
      return
    }
    const m = l.match(RE_LINHA_PDF)
    if (!m) {
      // Tenta padrões alternativos
      const mAlt = l.match(RE_LINHA_PDF_ALT) || l.match(RE_LINHA_PDF_BRADESCO)
      if (mAlt) {
        // Usa match alternativo
        const descricao = mAlt[2].trim().replace(/^[•*·.xX]{2,}\s*\d{4}\s+/, '')
        const data = dataDoTrecho(mAlt[1], ref)
        const valor1 = numeroBR(mAlt[3])
        const saldoLinha = mAlt[4] != null ? numeroBR(mAlt[4]) : null

        if (RE_INFORMATIVA_PDF.test(norm(descricao))) {
          if (saldoLinha != null) saldoAnterior = saldoLinha
          else if (/^saldo/.test(norm(descricao)) && valor1 != null) saldoAnterior = valor1
          descartadas.push({ linha: i + 1, motivo: 'Linha de saldo/total (informativa)', trecho: l.slice(0, 90) })
          return
        }
        if (!data) { descartadas.push({ linha: i + 1, motivo: 'Data inválida', trecho: l.slice(0, 90) }); return }
        if (valor1 == null || valor1 === 0) { descartadas.push({ linha: i + 1, motivo: 'Valor ausente ou inválido', trecho: l.slice(0, 90) }); return }

        const avisos = [ocr ? 'Lido por reconhecimento de texto (OCR): confira data, descrição e valor' : 'Lido de PDF: confira data, descrição e valor']
        let valor = valor1, sinalIncerto = false
        if (!SINAL_EXPLICITO.test(mAlt[3])) {
          if (saldoLinha != null && saldoAnterior != null && Math.abs(Math.abs(saldoLinha - saldoAnterior) - Math.abs(valor1)) < 0.015) {
            valor = (saldoLinha - saldoAnterior) < 0 ? -Math.abs(valor1) : Math.abs(valor1)
            avisos.push('Entrada/saída deduzida pela variação do saldo')
          } else sinalIncerto = true
        }
        if (saldoLinha != null) saldoAnterior = saldoLinha
        if (data.semAno) avisos.push(ref.deduzida ? `Data sem ano: usamos ${data.ano}, deduzido das datas do documento` : `Data sem ano no documento: assumimos ${data.ano}`)
        const parcela = extrairParcela(descricao)
        transacoes.push({
          linha: i + 1, data: data.iso, descricao, valor, idOrigem: null,
          parcelaAtual: parcela?.atual ?? null, parcelaTotal: parcela?.total ?? null,
          tipoInformado: null, ativo: null, revisar: true, sinalIncerto, avisos,
        })
        return
      }

      // Nenhum padrão funcionou
      if (RE_COMECA_COM_DATA.test(l) && /[a-zA-Z]{3}/.test(l.replace(new RegExp(`^${DATA_PDF}`, 'i'), ''))) {
        descartadas.push({ linha: i + 1, motivo: 'Linha com data, mas sem valor reconhecível (layout diferente?)', trecho: l.slice(0, 90) })
      }
      return
    }
    let descricao = m[2].trim().replace(/^[•*·.xX]{2,}\s*\d{4}\s+/, '')
    const data = dataDoTrecho(m[1], ref)
    const valor1 = numeroBR(m[3])
    const saldoLinha = m[4] != null ? numeroBR(m[4]) : null
    if (RE_INFORMATIVA_PDF.test(norm(descricao))) {
      if (saldoLinha != null) saldoAnterior = saldoLinha
      else if (/^saldo/.test(norm(descricao)) && valor1 != null) saldoAnterior = valor1
      descartadas.push({ linha: i + 1, motivo: 'Linha de saldo/total (informativa)', trecho: l.slice(0, 90) })
      return
    }
    if (!data) { descartadas.push({ linha: i + 1, motivo: 'Data inválida', trecho: l.slice(0, 90) }); return }
    if (valor1 == null || valor1 === 0) { descartadas.push({ linha: i + 1, motivo: 'Valor ausente ou inválido', trecho: l.slice(0, 90) }); return }

    const avisos = [ocr ? 'Lido por reconhecimento de texto (OCR): confira data, descrição e valor' : 'Lido de PDF: confira data, descrição e valor']
    let valor = valor1, sinalIncerto = false
    if (!SINAL_EXPLICITO.test(m[3])) {
      // Sem sinal no valor: tenta deduzir pela variação do saldo informado ao lado.
      if (saldoLinha != null && saldoAnterior != null && Math.abs(Math.abs(saldoLinha - saldoAnterior) - Math.abs(valor1)) < 0.015) {
        valor = (saldoLinha - saldoAnterior) < 0 ? -Math.abs(valor1) : Math.abs(valor1)
        avisos.push('Entrada/saída deduzida pela variação do saldo')
      } else sinalIncerto = true
    }
    if (saldoLinha != null) saldoAnterior = saldoLinha
    if (data.semAno) avisos.push(ref.deduzida ? `Data sem ano: usamos ${data.ano}, deduzido das datas do documento` : `Data sem ano no documento: assumimos ${data.ano}`)
    const parcela = extrairParcela(descricao)
    transacoes.push({
      linha: i + 1, data: data.iso, descricao, valor, idOrigem: null,
      parcelaAtual: parcela?.atual ?? null, parcelaTotal: parcela?.total ?? null,
      tipoInformado: null, ativo: null, revisar: true, sinalIncerto, avisos,
    })
  })
  return {
    transacoes, descartadas: descartadas.slice(0, 200), ...info,
    erro: transacoes.length ? null
      : 'Não reconhecemos lançamentos neste PDF (o layout do banco pode ser diferente). Você pode exportar o extrato em CSV, OFX ou planilha, ou cadastrar manualmente em Receitas e Despesas.',
  }
}

// ── Formato do arquivo (extensão + assinatura dos bytes) ─────────────────────
export function detectarFormato(nome, bytes) {
  const ext = String(nome || '').toLowerCase().split('.').pop()
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || [])
  if (u8.length === 0) return { formato: null, erro: 'O arquivo está vazio.' }
  if (u8.length > TAMANHO_MAXIMO_BYTES) return { formato: null, erro: 'O arquivo passa de 5 MB. Exporte um período menor.' }
  const inicio = String.fromCharCode(...u8.slice(0, 8))
  const ehZip = u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04
  const ehOle = u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0
  if (inicio.startsWith('%PDF-')) return { formato: 'pdf', erro: null }
  if (ehZip) return ext === 'xlsx' ? { formato: 'xlsx', erro: null } : { formato: null, erro: 'Arquivo compactado não suportado. Envie CSV, OFX, XLSX, XLS ou PDF.' }
  if (ehOle) return ext === 'xls' ? { formato: 'xls', erro: null } : { formato: null, erro: 'Formato não suportado. Envie CSV, OFX, XLSX, XLS ou PDF.' }
  // Texto: rejeita binário desconhecido (bytes nulos)
  if (u8.slice(0, 2048).some(b => b === 0)) return { formato: null, erro: 'Formato não suportado ou arquivo corrompido.' }
  const texto = decodificarTexto(u8.slice(0, 4096))
  if (/OFXHEADER|<OFX>/i.test(texto) || ext === 'ofx') return { formato: 'ofx', erro: null }
  if (ext === 'csv' || ext === 'txt') return { formato: 'csv', erro: null }
  if (['pdf', 'xlsx', 'xls'].includes(ext)) return { formato: null, erro: 'O conteúdo não corresponde à extensão do arquivo (arquivo corrompido?).' }
  return { formato: null, erro: 'Formato não suportado. Envie CSV, OFX, XLSX, XLS ou PDF.' }
}

// Limite de segurança do volume processado.
export function aplicarLimite(resultado) {
  if (resultado.transacoes.length <= MAXIMO_TRANSACOES) return resultado
  return { ...resultado, transacoes: resultado.transacoes.slice(0, MAXIMO_TRANSACOES), erro: null, truncado: true }
}
