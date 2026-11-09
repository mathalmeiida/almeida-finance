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
  return { transacoes, descartadas, erro: null }
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

// ── Texto extraído de PDF → transações ───────────────────────────────────────
// PDF não tem estrutura padronizada entre bancos. Só aceitamos linhas no
// formato "data  descrição  valor" e TODAS ficam marcadas para revisão.
const RE_LINHA_PDF = /^(\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?)\s+(.+?)\s+((?:-\s?)?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?[-DC])?)(?:\s+((?:-\s?)?(?:R\$\s?)?\d{1,3}(?:\.\d{3})*,\d{2}(?:\s?[-DC])?))?\s*$/i

export function textoPDFParaTransacoes(linhasTexto, { anoPadrao = null } = {}) {
  const transacoes = [], descartadas = []
  linhasTexto.forEach((bruta, i) => {
    const l = String(bruta).replace(/\s+/g, ' ').trim()
    const m = l.match(RE_LINHA_PDF)
    if (!m) return
    const descricao = m[2].trim()
    if (DESCRICOES_INFORMATIVAS.test(norm(descricao))) { descartadas.push({ linha: i + 1, motivo: 'Linha de saldo/total (informativa)' }); return }
    const data = dataBR(m[1], anoPadrao)
    const valor = numeroBR(m[3])
    if (!data) { descartadas.push({ linha: i + 1, motivo: 'Data inválida ou sem ano' }); return }
    if (valor == null || valor === 0) return
    const parcela = extrairParcela(descricao)
    const avisos = ['Lido de PDF: confira data, descrição e valor']
    if (/^\d{1,2}[/.-]\d{1,2}$/.test(m[1])) avisos.push(`Data sem ano no PDF: assumimos ${anoPadrao}`)
    if (m[4]) avisos.push('A linha tem dois valores; usamos o primeiro (o segundo costuma ser o saldo)')
    transacoes.push({
      linha: i + 1, data, descricao, valor, idOrigem: null,
      parcelaAtual: parcela?.atual ?? null, parcelaTotal: parcela?.total ?? null,
      tipoInformado: null, ativo: null, revisar: true, avisos,
    })
  })
  return {
    transacoes, descartadas,
    erro: transacoes.length ? null : 'Não reconhecemos lançamentos neste PDF. Se for digitalizado (imagem) ou de layout diferente, exporte o extrato em CSV, OFX ou planilha.',
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
