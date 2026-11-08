// ─── Leitura de planilhas XLSX e XLS (somente valores) ──────────────────────
// Implementação própria e enxuta, sem dependências externas:
//   • XLSX: ZIP + XML. Descompactação com a API nativa DecompressionStream.
//   • XLS (BIFF8): contêiner OLE/CFB + registros de células.
// Lemos APENAS valores de células (texto e números). Macros (VBA), fórmulas,
// links externos e objetos incorporados são ignorados — nada é executado.
// Arquivos protegidos por senha são detectados e recusados com mensagem clara.

import { ErroImportacao } from './detectar.js'
import { MAXIMO_DESCOMPACTADO_BYTES, MAXIMO_LINHAS } from './limites.js'

const corrompido = (detalhe) =>
  new ErroImportacao('corrompido', `A planilha parece corrompida ou incompatível${detalhe ? ` (${detalhe})` : ''}.`)
const protegido = () =>
  new ErroImportacao('protegido', 'A planilha está protegida por senha. Remova a senha no Excel e envie novamente.')

function dv(bytes) { return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength) }

// ═══ XLSX ════════════════════════════════════════════════════════════════════

async function inflarRaw(dados, limite) {
  if (typeof DecompressionStream === 'undefined') {
    throw new ErroImportacao('incompativel', 'Este navegador não suporta a leitura de XLSX. Atualize o navegador ou exporte em CSV.')
  }
  const stream = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const leitor = stream.getReader()
  const partes = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.length
    if (total > limite) {
      await leitor.cancel()
      throw new ErroImportacao('tamanho', 'A planilha descompactada é grande demais para ser processada.')
    }
    partes.push(value)
  }
  const saida = new Uint8Array(total)
  let pos = 0
  for (const p of partes) { saida.set(p, pos); pos += p.length }
  return saida
}

function lerZip(bytes) {
  const v = dv(bytes)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw corrompido('ZIP sem diretório')
  const total = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const entradas = {}
  let somaDescompactada = 0
  for (let k = 0; k < total; k++) {
    if (p + 46 > bytes.length || v.getUint32(p, true) !== 0x02014b50) throw corrompido('entrada ZIP inválida')
    const flags = v.getUint16(p + 8, true)
    const metodo = v.getUint16(p + 10, true)
    const tamComp = v.getUint32(p + 20, true)
    const tamDesc = v.getUint32(p + 24, true)
    const nLen = v.getUint16(p + 28, true)
    const eLen = v.getUint16(p + 30, true)
    const cLen = v.getUint16(p + 32, true)
    const local = v.getUint32(p + 42, true)
    const nome = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nLen))
    if (flags & 0x1) throw protegido()
    somaDescompactada += tamDesc
    entradas[nome] = { metodo, tamComp, tamDesc, local }
    p += 46 + nLen + eLen + cLen
  }
  if (somaDescompactada > MAXIMO_DESCOMPACTADO_BYTES) {
    throw new ErroImportacao('tamanho', 'A planilha descompactada é grande demais para ser processada.')
  }
  return entradas
}

async function extrairEntrada(bytes, entrada) {
  const v = dv(bytes)
  const p = entrada.local
  if (p + 30 > bytes.length || v.getUint32(p, true) !== 0x04034b50) throw corrompido('cabeçalho local')
  const inicio = p + 30 + v.getUint16(p + 26, true) + v.getUint16(p + 28, true)
  const dados = bytes.subarray(inicio, inicio + entrada.tamComp)
  if (entrada.metodo === 0) return dados
  if (entrada.metodo === 8) return inflarRaw(dados, Math.min(MAXIMO_DESCOMPACTADO_BYTES, entrada.tamDesc * 2 + 1024))
  throw corrompido('compressão não suportada')
}

function xmlTexto(t) {
  return t
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

function colunaParaIndice(ref) {
  const letras = (ref.match(/^[A-Z]+/) || [''])[0]
  let n = 0
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

function textosDeSi(si) {
  let s = ''
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g
  let m
  while ((m = re.exec(si))) s += m[1]
  return xmlTexto(s)
}

function parseSheetXml(xml, compartilhadas) {
  const linhas = []
  // Linhas vazias auto-fechadas (<row r="5"/>) são removidas antes da leitura.
  const limpo = xml.replace(/<row\b[^>]*\/>/g, '')
  const reLinha = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let m
  while ((m = reLinha.exec(limpo)) && linhas.length <= MAXIMO_LINHAS + 50) {
    const linha = []
    const reCel = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let c, seq = 0
    while ((c = reCel.exec(m[1]))) {
      const attrs = c[1]
      const ref = (attrs.match(/\sr="([A-Z]+\d+)"/) || [])[1]
      const tipo = (attrs.match(/\st="(\w+)"/) || [])[1]
      const col = ref ? colunaParaIndice(ref) : seq
      seq = col + 1
      const corpo = c[2] || ''
      const vBruto = (corpo.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
      let valor = null
      if (tipo === 's') valor = compartilhadas[Number(vBruto)] ?? ''
      else if (tipo === 'inlineStr') valor = textosDeSi(corpo)
      else if (tipo === 'str' || tipo === 'e') valor = vBruto != null ? xmlTexto(vBruto) : ''
      else if (tipo === 'b') valor = vBruto === '1'
      else if (vBruto != null) { const n = Number(vBruto); valor = Number.isFinite(n) ? n : xmlTexto(vBruto) }
      if (col >= 0 && col < 200) linha[col] = valor
    }
    for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = ''
    if (linha.some(v => v !== '' && v != null)) linhas.push(linha)
  }
  return linhas
}

export async function lerXlsx(bytes) {
  const entradas = lerZip(bytes)
  const texto = async (nome) => {
    const e = entradas[nome]
    return e ? new TextDecoder().decode(await extrairEntrada(bytes, e)) : null
  }
  const workbook = await texto('xl/workbook.xml')
  if (!workbook) throw corrompido('sem workbook')
  const rels = (await texto('xl/_rels/workbook.xml.rels')) || ''
  const alvos = {}
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = (m[0].match(/\sId="([^"]+)"/) || [])[1]
    const alvo = (m[0].match(/\sTarget="([^"]+)"/) || [])[1]
    if (id && alvo) alvos[id] = alvo.replace(/^\/?xl\//, '').replace(/^\//, '')
  }
  const sst = await texto('xl/sharedStrings.xml')
  const compartilhadas = sst ? [...sst.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => textosDeSi(m[1])) : []

  const folhas = []
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const nome = xmlTexto((m[0].match(/\sname="([^"]*)"/) || [])[1] || '')
    const rid = (m[0].match(/\sr:id="([^"]+)"/) || [])[1]
    const caminho = rid && alvos[rid] ? `xl/${alvos[rid]}` : null
    if (!caminho || !entradas[caminho]) continue
    const xml = await texto(caminho)
    folhas.push({ nome, linhas: parseSheetXml(xml, compartilhadas) })
    if (folhas.length >= 10) break
  }
  if (folhas.length === 0) throw corrompido('sem planilhas')
  return folhas
}

// ═══ XLS (BIFF8 em contêiner CFB) ════════════════════════════════════════════

function lerCfb(bytes) {
  const v = dv(bytes)
  if (bytes.length < 512) throw corrompido('CFB curto')
  const shift = v.getUint16(0x1e, true)
  if (shift !== 9 && shift !== 12) throw corrompido('setor inválido')
  const tamSetor = 1 << shift
  const tamMini = 1 << v.getUint16(0x20, true)
  const nFat = v.getUint32(0x2c, true)
  const dirInicio = v.getUint32(0x30, true)
  const corte = v.getUint32(0x38, true)
  const miniFatInicio = v.getUint32(0x3c, true)
  let difatSetor = v.getUint32(0x44, true)
  const maxSetores = Math.ceil(bytes.length / tamSetor) + 1

  const off = sid => (sid + 1) * tamSetor
  const setoresFat = []
  for (let i = 0; i < 109 && setoresFat.length < nFat; i++) setoresFat.push(v.getUint32(0x4c + i * 4, true))
  let guarda = 0
  while (difatSetor < 0xfffffffa && setoresFat.length < nFat && guarda++ < maxSetores) {
    const base = off(difatSetor)
    if (base + tamSetor > bytes.length) throw corrompido('DIFAT')
    for (let i = 0; i < tamSetor / 4 - 1 && setoresFat.length < nFat; i++) setoresFat.push(v.getUint32(base + i * 4, true))
    difatSetor = v.getUint32(base + tamSetor - 4, true)
  }
  const fat = []
  for (const s of setoresFat) {
    const base = off(s)
    if (base + tamSetor > bytes.length) throw corrompido('FAT')
    for (let i = 0; i < tamSetor / 4; i++) fat.push(v.getUint32(base + i * 4, true))
  }
  const cadeia = (inicio, tabela) => {
    const lista = []
    let s = inicio
    while (s < 0xfffffffa) {
      if (s >= tabela.length || lista.length > maxSetores * 64) throw corrompido('cadeia de setores')
      lista.push(s)
      s = tabela[s]
    }
    return lista
  }
  const lerCadeia = (inicio) => {
    const setores = cadeia(inicio, fat)
    const saida = new Uint8Array(setores.length * tamSetor)
    setores.forEach((s, i) => {
      const base = off(s)
      if (base + tamSetor > bytes.length) {
        saida.set(bytes.subarray(base, bytes.length), i * tamSetor)
      } else saida.set(bytes.subarray(base, base + tamSetor), i * tamSetor)
    })
    return saida
  }

  const dir = lerCadeia(dirInicio)
  const dvDir = dv(dir)
  const entradas = []
  for (let p = 0; p + 128 <= dir.length; p += 128) {
    const nLen = dvDir.getUint16(p + 0x40, true)
    const tipo = dir[p + 0x42]
    if (tipo === 0 || nLen < 2 || nLen > 64) continue
    let nome = ''
    for (let i = 0; i < nLen - 2; i += 2) nome += String.fromCharCode(dvDir.getUint16(p + i, true))
    entradas.push({ nome, tipo, inicio: dvDir.getUint32(p + 0x74, true), tamanho: dvDir.getUint32(p + 0x78, true) })
  }
  const raiz = entradas.find(e => e.tipo === 5)
  let miniStream = null, miniFat = null
  const lerStream = (entrada) => {
    if (entrada.tamanho < corte && entrada.tipo === 2) {
      if (!miniStream) {
        miniStream = raiz ? lerCadeia(raiz.inicio) : new Uint8Array(0)
        const mf = miniFatInicio < 0xfffffffa ? lerCadeia(miniFatInicio) : new Uint8Array(0)
        const dvm = dv(mf)
        miniFat = []
        for (let i = 0; i + 4 <= mf.length; i += 4) miniFat.push(dvm.getUint32(i, true))
      }
      const setores = cadeia(entrada.inicio, miniFat)
      const saida = new Uint8Array(setores.length * tamMini)
      setores.forEach((s, i) => saida.set(miniStream.subarray(s * tamMini, (s + 1) * tamMini), i * tamMini))
      return saida.subarray(0, entrada.tamanho)
    }
    return lerCadeia(entrada.inicio).subarray(0, entrada.tamanho)
  }
  return { entradas, lerStream }
}

// Leitor de bytes que atravessa registros CONTINUE (necessário para a SST).
class LeitorSegmentos {
  constructor(segmentos) { this.seg = segmentos; this.i = 0; this.p = 0 }
  fim() { return this.i >= this.seg.length }
  garantir() {
    while (this.i < this.seg.length && this.p >= this.seg[this.i].length) { this.i++; this.p = 0 }
    if (this.i >= this.seg.length) throw corrompido('SST')
  }
  u8() { this.garantir(); return this.seg[this.i][this.p++] }
  u16() { return this.u8() | (this.u8() << 8) }
  u32() { return (this.u16() | (this.u16() << 16)) >>> 0 }
  pular(n) { for (let k = 0; k < n; k++) this.u8() }
  noLimite() { return this.i < this.seg.length && this.p >= this.seg[this.i].length }
  caracteres(qtd, alto) {
    let s = ''
    for (let k = 0; k < qtd; k++) {
      if (this.noLimite()) { this.i++; this.p = 0; alto = (this.u8() & 1) === 1 }
      s += String.fromCharCode(alto ? this.u16() : this.u8())
    }
    return s
  }
}

function lerStringSst(r) {
  const qtd = r.u16()
  const flags = r.u8()
  const alto = (flags & 1) === 1
  const rico = (flags & 8) !== 0
  const ext = (flags & 4) !== 0
  const runs = rico ? r.u16() : 0
  const extTam = ext ? r.u32() : 0
  const s = r.caracteres(qtd, alto)
  r.pular(runs * 4 + extTam)
  return s
}

function decodificarRk(rk) {
  let n
  if (rk & 0x02) n = rk >> 2
  else {
    const buf = new DataView(new ArrayBuffer(8))
    buf.setUint32(4, rk & 0xfffffffc, true)
    buf.setUint32(0, 0, true)
    n = buf.getFloat64(0, true)
  }
  return rk & 0x01 ? n / 100 : n
}

function lerBiff(stream) {
  const v = dv(stream)
  const folhas = []
  let sst = []
  let atual = null
  let emPlanilha = false
  let p = 0
  let formulaPendente = null
  const registros = []
  // 1ª passada: registros (com CONTINUE agrupado para a SST)
  while (p + 4 <= stream.length) {
    const id = v.getUint16(p, true)
    const len = v.getUint16(p + 2, true)
    if (p + 4 + len > stream.length) break
    registros.push({ id, dados: stream.subarray(p + 4, p + 4 + len) })
    p += 4 + len
  }
  for (let k = 0; k < registros.length; k++) {
    const { id, dados } = registros[k]
    const d = dv(dados)
    if (id === 0x002f) throw protegido()          // FILEPASS
    if (id === 0x0809) {                          // BOF
      const tipo = dados.length >= 4 ? d.getUint16(2, true) : 0
      if (tipo === 0x0010) { atual = { nome: `Planilha ${folhas.length + 1}`, linhas: [] }; emPlanilha = true }
      continue
    }
    if (id === 0x000a) {                          // EOF
      if (emPlanilha && atual) folhas.push(atual)
      atual = null; emPlanilha = false
      continue
    }
    if (id === 0x00fc) {                          // SST (+ CONTINUE)
      const segs = [dados.subarray(8)]
      while (k + 1 < registros.length && registros[k + 1].id === 0x003c) segs.push(registros[++k].dados)
      const total = d.getUint32(4, true)
      const r = new LeitorSegmentos(segs)
      sst = []
      for (let s = 0; s < total && s < 200000; s++) {
        try { sst.push(lerStringSst(r)) } catch { break }
      }
      continue
    }
    if (!emPlanilha || !atual) continue
    const definir = (linha, col, valor) => {
      if (linha > MAXIMO_LINHAS + 50 || col > 200) return
      const l = atual.linhas[linha] || (atual.linhas[linha] = [])
      l[col] = valor
    }
    if (id === 0x00fd && dados.length >= 10) definir(d.getUint16(0, true), d.getUint16(2, true), sst[d.getUint32(6, true)] ?? '')
    else if (id === 0x0203 && dados.length >= 14) definir(d.getUint16(0, true), d.getUint16(2, true), d.getFloat64(6, true))
    else if (id === 0x027e && dados.length >= 10) definir(d.getUint16(0, true), d.getUint16(2, true), decodificarRk(d.getUint32(6, true)))
    else if (id === 0x00bd && dados.length >= 6) {
      const linha = d.getUint16(0, true)
      const col0 = d.getUint16(2, true)
      const qtd = (dados.length - 6) / 6
      for (let i = 0; i < qtd; i++) definir(linha, col0 + i, decodificarRk(d.getUint32(4 + i * 6 + 2, true)))
    } else if (id === 0x0204 && dados.length >= 9) {
      const qtd = d.getUint16(6, true)
      const alto = (dados[8] & 1) === 1
      let s = ''
      for (let i = 0; i < qtd; i++) {
        const pos = 9 + (alto ? i * 2 : i)
        if (pos + (alto ? 1 : 0) >= dados.length) break
        s += String.fromCharCode(alto ? d.getUint16(pos, true) : dados[pos])
      }
      definir(d.getUint16(0, true), d.getUint16(2, true), s)
    } else if (id === 0x0006 && dados.length >= 14) {   // FORMULA: só o resultado em cache
      const linha = d.getUint16(0, true), col = d.getUint16(2, true)
      if (d.getUint16(12, true) === 0xffff) {
        if (dados[6] === 0) formulaPendente = { linha, col }  // resultado texto no STRING seguinte
      } else definir(linha, col, d.getFloat64(6, true))
    } else if (id === 0x0207 && formulaPendente && dados.length >= 3) {
      const qtd = d.getUint16(0, true)
      const alto = (dados[2] & 1) === 1
      let s = ''
      for (let i = 0; i < qtd; i++) {
        const pos = 3 + (alto ? i * 2 : i)
        if (pos + (alto ? 1 : 0) >= dados.length) break
        s += String.fromCharCode(alto ? d.getUint16(pos, true) : dados[pos])
      }
      definir(formulaPendente.linha, formulaPendente.col, s)
      formulaPendente = null
    }
  }
  return folhas.map(f => ({
    nome: f.nome,
    linhas: f.linhas.filter(Boolean).map(l => Array.from(l, x => (x === undefined ? '' : x))).filter(l => l.some(x => x !== '')),
  }))
}

export function lerXls(bytes) {
  const { entradas, lerStream } = lerCfb(bytes)
  const nomes = entradas.map(e => e.nome)
  // XLSX criptografado (senha de abertura) é salvo como contêiner OLE.
  if (nomes.includes('EncryptionInfo') || nomes.includes('EncryptedPackage')) throw protegido()
  const wb = entradas.find(e => e.tipo === 2 && (e.nome === 'Workbook' || e.nome === 'Book'))
  if (!wb) throw new ErroImportacao('incompativel', 'Documento do Office não reconhecido como planilha.')
  const folhas = lerBiff(lerStream(wb))
  if (folhas.length === 0) throw corrompido('sem planilhas')
  return folhas
}
