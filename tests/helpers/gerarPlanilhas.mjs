// Geradores mínimos de XLSX (ZIP + XML) e XLS (BIFF8 em CFB) para os testes.
import { deflateRawSync } from 'node:zlib'

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const TABELA = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zip(arquivos, { criptografado = false } = {}) {
  const locais = []
  const centrais = []
  let offset = 0
  for (const [nome, conteudo] of Object.entries(arquivos)) {
    const dados = Buffer.from(conteudo, 'utf8')
    const comp = deflateRawSync(dados)
    const nomeBuf = Buffer.from(nome, 'utf8')
    const flags = criptografado ? 1 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(flags, 6)
    local.writeUInt16LE(8, 8); local.writeUInt32LE(crc32(dados), 14)
    local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(dados.length, 22)
    local.writeUInt16LE(nomeBuf.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
    central.writeUInt16LE(flags, 8); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc32(dados), 16)
    central.writeUInt32LE(comp.length, 20); central.writeUInt32LE(dados.length, 24)
    central.writeUInt16LE(nomeBuf.length, 28); central.writeUInt32LE(offset, 42)
    locais.push(local, nomeBuf, comp)
    centrais.push(central, nomeBuf)
    offset += local.length + nomeBuf.length + comp.length
  }
  const dir = Buffer.concat(centrais)
  const fim = Buffer.alloc(22)
  fim.writeUInt32LE(0x06054b50, 0)
  fim.writeUInt16LE(Object.keys(arquivos).length, 8); fim.writeUInt16LE(Object.keys(arquivos).length, 10)
  fim.writeUInt32LE(dir.length, 12); fim.writeUInt32LE(offset, 16)
  return new Uint8Array(Buffer.concat([...locais, dir, fim]))
}

function colLetra(i) {
  let s = ''
  i += 1
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26) }
  return s
}
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function gerarXlsx(linhas, opcoes = {}) {
  const strings = []
  const idx = new Map()
  const linhasXml = linhas.map((linha, r) => {
    const cels = linha.map((v, c) => {
      const ref = `${colLetra(c)}${r + 1}`
      if (v === null || v === undefined || v === '') return ''
      if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`
      if (!idx.has(v)) { idx.set(v, strings.length); strings.push(v) }
      return `<c r="${ref}" t="s"><v>${idx.get(v)}</v></c>`
    }).join('')
    return `<row r="${r + 1}">${cels}</row>`
  }).join('')
  return zip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Movimentação" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    'xl/sharedStrings.xml': `<?xml version="1.0"?><sst count="${strings.length}">${strings.map(s => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0"?><worksheet><sheetData><row r="99"/>${linhasXml}</sheetData></worksheet>`,
  }, opcoes)
}

// ─── XLS (BIFF8) ─────────────────────────────────────────────────────────────
function registro(id, dados) {
  const h = Buffer.alloc(4)
  h.writeUInt16LE(id, 0); h.writeUInt16LE(dados.length, 2)
  return Buffer.concat([h, dados])
}

export function gerarXls(linhas, { protegido = false, dividirSst = false } = {}) {
  const strings = []
  const idx = new Map()
  for (const l of linhas) for (const v of l) if (typeof v === 'string' && !idx.has(v)) { idx.set(v, strings.length); strings.push(v) }

  const bof = (dt) => { const b = Buffer.alloc(16); b.writeUInt16LE(0x0600, 0); b.writeUInt16LE(dt, 2); return registro(0x0809, b) }
  const partesSst = strings.map(s => { const b = Buffer.alloc(3); b.writeUInt16LE(s.length, 0); b[2] = 0; return Buffer.concat([b, Buffer.from(s, 'latin1')]) })
  const cab = Buffer.alloc(8); cab.writeUInt32LE(strings.length, 0); cab.writeUInt32LE(strings.length, 4)
  const sstCorpo = Buffer.concat([cab, ...partesSst])
  const recSst = []
  if (dividirSst && sstCorpo.length > 20) {
    // Corta no meio de uma string: o CONTINUE começa com o byte de flags.
    const corte = 8 + 3 + Math.floor(strings[0].length / 2)
    recSst.push(registro(0x00fc, sstCorpo.subarray(0, corte)))
    recSst.push(registro(0x003c, Buffer.concat([Buffer.from([0]), sstCorpo.subarray(corte)])))
  } else recSst.push(registro(0x00fc, sstCorpo))

  const celulas = []
  linhas.forEach((l, r) => l.forEach((v, c) => {
    if (v === '' || v == null) return
    if (typeof v === 'number') {
      if (Number.isInteger(v) && Math.abs(v) < 2 ** 29) {
        const b = Buffer.alloc(10); b.writeUInt16LE(r, 0); b.writeUInt16LE(c, 2); b.writeUInt32LE(((v << 2) | 2) >>> 0, 6)
        celulas.push(registro(0x027e, b))
      } else {
        const b = Buffer.alloc(14); b.writeUInt16LE(r, 0); b.writeUInt16LE(c, 2); b.writeDoubleLE(v, 6)
        celulas.push(registro(0x0203, b))
      }
    } else {
      const b = Buffer.alloc(10); b.writeUInt16LE(r, 0); b.writeUInt16LE(c, 2); b.writeUInt32LE(idx.get(v), 6)
      celulas.push(registro(0x00fd, b))
    }
  }))
  let stream = Buffer.concat([
    bof(0x0005),
    ...(protegido ? [registro(0x002f, Buffer.alloc(6))] : []),
    ...recSst,
    registro(0x000a, Buffer.alloc(0)),
    bof(0x0010),
    ...celulas,
    registro(0x000a, Buffer.alloc(0)),
  ])
  const tamanhoReal = stream.length
  if (stream.length < 4096) stream = Buffer.concat([stream, Buffer.alloc(4096 - stream.length)])
  const setoresDados = Math.ceil(stream.length / 512)
  stream = Buffer.concat([stream, Buffer.alloc(setoresDados * 512 - stream.length)])

  const header = Buffer.alloc(512, 0)
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(header, 0)
  header.writeUInt16LE(0x3e, 0x18); header.writeUInt16LE(3, 0x1a); header.writeUInt16LE(0xfffe, 0x1c)
  header.writeUInt16LE(9, 0x1e); header.writeUInt16LE(6, 0x20)
  header.writeUInt32LE(1, 0x2c); header.writeUInt32LE(1, 0x30); header.writeUInt32LE(4096, 0x38)
  header.writeUInt32LE(0xfffffffe, 0x3c); header.writeUInt32LE(0xfffffffe, 0x44)
  for (let i = 0; i < 109; i++) header.writeUInt32LE(i === 0 ? 0 : 0xffffffff, 0x4c + i * 4)

  const fat = Buffer.alloc(512, 0xff)
  fat.writeUInt32LE(0xfffffffd, 0)
  fat.writeUInt32LE(0xfffffffe, 4)
  for (let s = 0; s < setoresDados; s++) fat.writeUInt32LE(s === setoresDados - 1 ? 0xfffffffe : 3 + s, (2 + s) * 4)

  const dir = Buffer.alloc(512, 0)
  const entrada = (i, nome, tipo, inicio, tamanho) => {
    const base = i * 128
    const n = Buffer.from(nome + '\0', 'utf16le')
    n.copy(dir, base)
    dir.writeUInt16LE(n.length, base + 0x40)
    dir[base + 0x42] = tipo
    dir.writeUInt32LE(0xffffffff, base + 0x44); dir.writeUInt32LE(0xffffffff, base + 0x48)
    dir.writeUInt32LE(tipo === 5 ? 1 : 0xffffffff, base + 0x4c)
    dir.writeUInt32LE(inicio, base + 0x74); dir.writeUInt32LE(tamanho, base + 0x78)
  }
  entrada(0, 'Root Entry', 5, 0xfffffffe, 0)
  entrada(1, 'Workbook', 2, 2, Math.max(tamanhoReal, 4096))
  return new Uint8Array(Buffer.concat([header, fat, dir, stream]))
}
