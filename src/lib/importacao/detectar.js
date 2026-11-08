// ─── Identificação do formato do arquivo ─────────────────────────────────────
// O formato é decidido pelo CONTEÚDO (assinatura binária), não só pela
// extensão: um ".pdf" que não começa com %PDF é recusado. Isso também evita
// processar arquivos renomeados ou incompatíveis.

import { TAMANHO_MAXIMO_BYTES, FORMATOS_ACEITOS } from './limites.js'

export class ErroImportacao extends Error {
  constructor(codigo, mensagem) {
    super(mensagem)
    this.name = 'ErroImportacao'
    this.codigo = codigo
  }
}

function comecaCom(bytes, assinatura) {
  if (bytes.length < assinatura.length) return false
  return assinatura.every((b, i) => bytes[i] === b)
}

const ASSINATURA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]          // %PDF-
const ASSINATURA_ZIP = [0x50, 0x4b, 0x03, 0x04]                // PK.. (XLSX)
const ASSINATURA_OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // XLS / Office criptografado

export function extensaoDe(nome) {
  const m = String(nome || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return m ? m[1] : ''
}

// Decodifica texto tentando UTF-8 e, se houver caracteres inválidos, cai para
// Windows-1252 (muito usado em CSV/OFX de bancos brasileiros).
export function decodificarTexto(bytes) {
  let inicio = 0
  if (comecaCom(bytes, [0xef, 0xbb, 0xbf])) inicio = 3
  const corpo = bytes.subarray(inicio)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(corpo)
  } catch {
    return new TextDecoder('windows-1252').decode(corpo)
  }
}

function pareceBinario(bytes) {
  const amostra = bytes.subarray(0, Math.min(bytes.length, 4096))
  let controle = 0
  for (const b of amostra) {
    if (b === 0) return true
    if (b < 9 || (b > 13 && b < 32)) controle++
  }
  return controle > amostra.length * 0.05
}

/**
 * @param {Uint8Array} bytes
 * @param {string} nome
 * @returns {{ formato: 'pdf'|'csv'|'ofx'|'xls'|'xlsx', texto?: string, htmlPlanilha?: boolean }}
 */
export function detectarFormato(bytes, nome) {
  if (!bytes || bytes.length === 0) {
    throw new ErroImportacao('vazio', 'O arquivo está vazio.')
  }
  if (bytes.length > TAMANHO_MAXIMO_BYTES) {
    throw new ErroImportacao('tamanho', 'O arquivo ultrapassa o limite de 10 MB.')
  }
  const ext = extensaoDe(nome)

  if (comecaCom(bytes, ASSINATURA_PDF)) return { formato: 'pdf' }
  if (comecaCom(bytes, ASSINATURA_ZIP)) {
    if (ext && !['xlsx', 'xls'].includes(ext)) {
      throw new ErroImportacao('incompativel', 'Arquivo compactado não suportado. Envie PDF, CSV, OFX, XLS ou XLSX.')
    }
    return { formato: 'xlsx' }
  }
  if (comecaCom(bytes, ASSINATURA_OLE)) return { formato: 'xls' }

  if (ext === 'pdf') throw new ErroImportacao('corrompido', 'O PDF parece corrompido ou não é um PDF válido.')
  if (ext === 'xlsx') throw new ErroImportacao('corrompido', 'A planilha XLSX parece corrompida.')
  if (pareceBinario(bytes)) {
    throw new ErroImportacao('incompativel', 'Formato não reconhecido. Envie PDF, CSV, OFX, XLS ou XLSX.')
  }

  const texto = decodificarTexto(bytes)
  if (!texto.trim()) throw new ErroImportacao('vazio', 'O arquivo não contém dados.')
  const inicio = texto.slice(0, 2048).toUpperCase()

  if (inicio.includes('OFXHEADER') || inicio.includes('<OFX>') || /<\?OFX/.test(inicio)) {
    return { formato: 'ofx', texto }
  }
  // Muitos bancos exportam "XLS" que na verdade é uma tabela HTML.
  if (/<TABLE|<HTML/.test(inicio)) {
    return { formato: 'xls', texto, htmlPlanilha: true }
  }
  if (ext === 'xls') throw new ErroImportacao('corrompido', 'A planilha XLS parece corrompida.')
  return { formato: 'csv', texto }
}

export function formatoAceito(formato) {
  return FORMATOS_ACEITOS.includes(formato)
}

// SHA-256 do arquivo (hex). Usado só para avisar quando o MESMO arquivo é
// importado de novo — o conteúdo nunca sai do aparelho.
export async function hashArquivo(bytes) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  // Fora de contexto seguro (ex.: teste via http na rede local) a Web Crypto
  // não existe; usa a implementação em JS abaixo (mesmo resultado).
  return sha256Js(bytes)
}

const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

export function sha256Js(bytes) {
  const len = bytes.length
  const total = Math.ceil((len + 9) / 64) * 64
  const msg = new Uint8Array(total)
  msg.set(bytes)
  msg[len] = 0x80
  const bits = len * 8
  const dvm = new DataView(msg.buffer)
  dvm.setUint32(total - 8, Math.floor(bits / 2 ** 32))
  dvm.setUint32(total - 4, bits >>> 0)
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const w = new Uint32Array(64)
  const rotr = (x, n) => (x >>> n) | (x << (32 - n))
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dvm.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  return [...h].map(x => x.toString(16).padStart(8, '0')).join('')
}
