// ─── Normalização de textos, valores e datas ─────────────────────────────────
// Funções PURAS (sem React/Supabase), usadas pelo motor de leitura e pelos
// testes em Node. Nenhuma função aqui "chuta" valores: quando o texto não é
// reconhecido com segurança, o retorno é null e o item vai para conferência.

const MESES_ABREV = {
  JAN: 1, FEV: 2, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAI: 5, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, AUG: 8, SET: 9, SEP: 9, OUT: 10, OCT: 10, NOV: 11, DEZ: 12, DEC: 12,
}

export function removerAcentos(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// "Pão de Açúcar  - Loja 12" → "PAO DE ACUCAR LOJA 12"
export function normalizarDescricao(texto) {
  return removerAcentos(texto)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Palavras genéricas de extratos que não ajudam a diferenciar lançamentos.
const PALAVRAS_GENERICAS = new Set([
  'PIX', 'TED', 'DOC', 'TEF', 'COMPRA', 'COMPRAS', 'PAGAMENTO', 'PAGTO', 'PGTO', 'PAG',
  'DEBITO', 'CREDITO', 'CARTAO', 'ENVIADO', 'ENVIADA', 'RECEBIDO', 'RECEBIDA', 'TRANSF',
  'TRANSFERENCIA', 'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NO', 'NA', 'PARA', 'COM',
  'LTDA', 'SA', 'ME', 'EIRELI', 'BR', 'BRA', 'BRASIL', 'VISA', 'MASTER', 'ELO', 'INT',
  'NACIONAL', 'QR', 'CODE', 'CONTA', 'PARC', 'PARCELA', 'COMPRAVISA', 'DEB', 'CRED',
])

export function tokensSignificativos(texto) {
  return normalizarDescricao(texto)
    .split(' ')
    .filter(t => t.length >= 2 && !/^\d+$/.test(t) && !PALAVRAS_GENERICAS.has(t))
}

// Chave usada no aprendizado de categorias por usuário. Remove números (datas,
// códigos de autorização, parcelas) e palavras genéricas; mantém até 3 termos.
// Ex.: "PIX ENVIADO UBER DO BRASIL 12/10" → "UBER"
//      "IFOOD *RESTAURANTE SABOR" → "IFOOD RESTAURANTE SABOR"
export function chaveAprendizado(texto) {
  return tokensSignificativos(texto).slice(0, 3).join(' ').slice(0, 80)
}

// Similaridade entre descrições (0..1): Jaccard dos termos significativos,
// com bônus quando um texto contém o outro (ex.: "NETFLIX" × "NETFLIX.COM").
export function similaridadeDescricao(a, b) {
  const na = normalizarDescricao(a)
  const nb = normalizarDescricao(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const ta = new Set(tokensSignificativos(a))
  const tb = new Set(tokensSignificativos(b))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const jaccard = inter / (ta.size + tb.size - inter)
  const [menor, maior] = ta.size <= tb.size ? [ta, tb] : [tb, ta]
  let contidos = 0
  for (const t of menor) {
    if ([...maior].some(m => m === t || (t.length >= 4 && (m.startsWith(t) || t.startsWith(m))))) contidos++
  }
  const contencao = contidos / menor.size
  return Math.max(jaccard, contencao * 0.9)
}

export const arred2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100

// ─── Valores monetários ──────────────────────────────────────────────────────
// Aceita formatos brasileiros e internacionais. Retorna número COM sinal
// (negativo = saída/crédito, conforme o documento) ou null se não reconhecer.
//   "R$ 1.234,56" → 1234.56 | "-1.234,56" → -1234.56 | "1.234,56 D" → -1234.56
//   "1.234,56-"   → -1234.56 | "(50,00)" → -50 | "-12.50" (OFX) → -12.5
export function parseValor(entrada) {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? arred2(entrada) : null
  if (entrada == null) return null
  let t = String(entrada).trim().replace(/\u2212/g, '-').replace(/\u00a0/g, ' ')
  if (!t) return null

  let negativo = false
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1) }
  // Sufixo D (débito) / C (crédito), comum em extratos impressos.
  const sufixo = t.match(/\s*([DC])$/i)
  if (sufixo && /\d/.test(t.slice(0, -1))) {
    if (sufixo[1].toUpperCase() === 'D') negativo = true
    t = t.slice(0, -sufixo[0].length)
  }
  t = t.replace(/R\$|BRL|US\$/gi, '').replace(/\s+/g, '')
  if (t.startsWith('+')) t = t.slice(1)
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1) }
  if (t.endsWith('-')) { negativo = !negativo; t = t.slice(0, -1) }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null

  const ultimaVirgula = t.lastIndexOf(',')
  const ultimoPonto = t.lastIndexOf('.')
  let normal
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    // O separador que aparece por último é o decimal.
    normal = ultimaVirgula > ultimoPonto
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '')
  } else if (ultimaVirgula >= 0) {
    const partes = t.split(',')
    normal = partes.length === 2 && partes[1].length <= 2
      ? `${partes[0]}.${partes[1]}`
      : (partes.length > 1 && partes.slice(1).every(p => p.length === 3) ? partes.join('') : null)
  } else if (ultimoPonto >= 0) {
    const partes = t.split('.')
    // "1.234" / "1.234.567" → milhar (padrão BR); "12.50" / "1.5" → decimal.
    normal = partes.length > 1 && partes.slice(1).every(p => p.length === 3)
      ? partes.join('')
      : (partes.length === 2 ? t : null)
  } else {
    normal = t
  }
  if (normal == null) return null
  const n = Number(normal)
  if (!Number.isFinite(n)) return null
  return arred2(negativo ? -n : n)
}

// Quantidades (cotas/ações) podem ter mais de 2 casas decimais.
export function parseQuantidade(entrada) {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null
  if (entrada == null) return null
  const t = String(entrada).trim().replace(/\s/g, '')
  if (!t || !/^-?[\d.,]+$/.test(t)) return null
  let normal = t
  if (t.includes(',') && t.includes('.')) {
    normal = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  } else if (t.includes(',')) {
    normal = t.replace(',', '.')
  } else if ((t.match(/\./g) || []).length > 1) {
    normal = t.replace(/\./g, '')
  }
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}

// ─── Datas ───────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0') }

export function montarISO(ano, mes, dia) {
  const a = Number(ano), m = Number(mes), d = Number(dia)
  if (!Number.isInteger(a) || !Number.isInteger(m) || !Number.isInteger(d)) return null
  if (a < 1990 || a > 2100 || m < 1 || m > 12 || d < 1) return null
  const ultimo = new Date(a, m, 0).getDate()
  if (d > ultimo) return null
  return `${a}-${pad(m)}-${pad(d)}`
}

function anoCurto(aa) {
  const n = Number(aa)
  return n >= 70 ? 1900 + n : 2000 + n
}

// Quando o documento traz só "dd/mm", o ano vem da referência (ex.: vencimento
// da fatura ou fim do período). Se a data resultante ficar muito depois da
// referência, ela é do ano anterior (ex.: compra de 15/12 numa fatura de jan).
function resolverAnoSemAno(dia, mes, referencia) {
  if (!referencia) return null
  const [ra, rm, rd] = referencia.split('-').map(Number)
  const candidato = montarISO(ra, mes, dia)
  if (!candidato) return null
  const ref = Date.UTC(ra, rm - 1, rd)
  const [ca, cm, cd] = candidato.split('-').map(Number)
  const diff = (Date.UTC(ca, cm - 1, cd) - ref) / 86400000
  return diff > 45 ? montarISO(ra - 1, mes, dia) : candidato
}

// Converte o número serial de data do Excel (base 1900) em ISO.
export function serialExcelParaISO(serial) {
  const n = Number(serial)
  if (!Number.isFinite(n) || n < 32874 || n > 73051) return null // 1990..2100
  const ms = Math.round((Math.floor(n) - 25569) * 86400000)
  const d = new Date(ms)
  return montarISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
}

/**
 * Reconhece datas em formatos comuns de bancos e corretoras.
 * @param {string|number} entrada
 * @param {{ referencia?: string }} opcoes  referencia = 'YYYY-MM-DD' para datas sem ano
 * @returns {string|null} 'YYYY-MM-DD'
 */
export function parseData(entrada, opcoes = {}) {
  if (entrada == null) return null
  if (typeof entrada === 'number') return serialExcelParaISO(entrada)
  const t = String(entrada).trim()
  if (!t) return null
  let m

  // ISO: 2026-11-05 ou 2026-11-05T10:00:00
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/))) return montarISO(m[1], m[2], m[3])
  // OFX: 20261105 ou 20261105120000 seguido de fuso entre colchetes
  if ((m = t.match(/^(\d{4})(\d{2})(\d{2})(?:\d{0,6}(?:\.\d+)?)?(?:\[.*\])?$/))) return montarISO(m[1], m[2], m[3])
  // dd/mm/aaaa, dd-mm-aaaa, dd.mm.aaaa (com hora opcional)
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s.*)?$/))) return montarISO(m[3], m[2], m[1])
  // dd/mm/aa
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})(?:\s.*)?$/))) return montarISO(anoCurto(m[3]), m[2], m[1])
  // dd/mm (sem ano)
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})$/))) return resolverAnoSemAno(Number(m[1]), Number(m[2]), opcoes.referencia)
  // "05 NOV", "05/NOV", "05 NOV 2026", "05-nov-26"
  if ((m = removerAcentos(t).toUpperCase().match(/^(\d{1,2})[\s/.-]*([A-Z]{3})[A-Z]*\.?(?:[\s/.-]*(\d{2,4}))?$/))) {
    const mes = MESES_ABREV[m[2]]
    if (!mes) return null
    if (m[3]) return montarISO(m[3].length === 2 ? anoCurto(m[3]) : m[3], mes, m[1])
    return resolverAnoSemAno(Number(m[1]), mes, opcoes.referencia)
  }
  return null
}

export function adicionarMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number)
  const total = a * 12 + (m - 1) + meses
  const na = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const ultimo = new Date(na, nm, 0).getDate()
  return montarISO(na, nm, Math.min(d, ultimo))
}

export function adicionarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d + dias))
  return montarISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function diferencaDias(isoA, isoB) {
  const [a1, m1, d1] = isoA.split('-').map(Number)
  const [a2, m2, d2] = isoB.split('-').map(Number)
  return Math.round((Date.UTC(a1, m1 - 1, d1) - Date.UTC(a2, m2 - 1, d2)) / 86400000)
}
