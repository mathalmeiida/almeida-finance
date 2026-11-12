// Geradores de PDF FICTÍCIO para os testes (sem dependências): PDF com texto
// (várias páginas), PDF só com imagem (digitalizado) e criptografia RC4-40
// (senha de usuário), compatível com o leitor pdf.js.
import { createHash } from 'crypto'

const PAD = Buffer.from('28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A', 'hex')
const md5 = b => createHash('md5').update(b).digest()
function rc4(chave, dados) {
  const S = [...Array(256).keys()]
  let j = 0
  for (let i = 0; i < 256; i++) { j = (j + S[i] + chave[i % chave.length]) & 255; [S[i], S[j]] = [S[j], S[i]] }
  const saida = Buffer.alloc(dados.length)
  let a = 0, b = 0
  for (let k = 0; k < dados.length; k++) {
    a = (a + 1) & 255; b = (b + S[a]) & 255; [S[a], S[b]] = [S[b], S[a]]
    saida[k] = dados[k] ^ S[(S[a] + S[b]) & 255]
  }
  return saida
}
const padSenha = s => Buffer.concat([Buffer.from(s, 'latin1'), PAD]).subarray(0, 32)

function criptografia(senha) {
  const id = md5(Buffer.from('almeida-teste'))
  const O = rc4(md5(padSenha('dono-teste')).subarray(0, 5), padSenha(senha))
  const P = Buffer.alloc(4); P.writeInt32LE(-4)
  const chave = md5(Buffer.concat([padSenha(senha), O, P, id])).subarray(0, 5)
  const U = rc4(chave, PAD)
  const chaveObjeto = n => md5(Buffer.concat([chave, Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, 0, 0])])).subarray(0, 10)
  return { id, O, U, chaveObjeto }
}

// objetos: [{ dict: 'texto do dicionário', fluxo?: Buffer }] (numerados a partir de 1)
function montar(objetos, senha) {
  const cr = senha ? criptografia(senha) : null
  const todos = [...objetos]
  if (cr) todos.push({ dict: `<< /Filter /Standard /V 1 /R 2 /O <${cr.O.toString('hex')}> /U <${cr.U.toString('hex')}> /P -4 >>` })
  const partes = [Buffer.from('%PDF-1.4\n', 'latin1')]
  const offsets = []
  let pos = partes[0].length
  todos.forEach((o, i) => {
    const num = i + 1
    let bloco
    if (o.fluxo) {
      const dados = cr ? rc4(cr.chaveObjeto(num), o.fluxo) : o.fluxo
      bloco = Buffer.concat([Buffer.from(`${num} 0 obj\n${o.dict.replace('__LEN__', String(dados.length))}\nstream\n`, 'latin1'), dados, Buffer.from('\nendstream\nendobj\n', 'latin1')])
    } else bloco = Buffer.from(`${num} 0 obj\n${o.dict}\nendobj\n`, 'latin1')
    offsets.push(pos); partes.push(bloco); pos += bloco.length
  })
  const xref = [`xref\n0 ${todos.length + 1}\n0000000000 65535 f \n`, ...offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`)].join('')
  const trailer = `trailer\n<< /Size ${todos.length + 1} /Root 1 0 R${cr ? ` /Encrypt ${todos.length} 0 R /ID [<${cr.id.toString('hex')}> <${cr.id.toString('hex')}>]` : ''} >>\nstartxref\n${pos}\n%%EOF`
  partes.push(Buffer.from(xref + trailer, 'latin1'))
  return Buffer.concat(partes)
}

const esc = s => s.replace(/[()\\]/g, m => `\\${m}`)

// paginas: array de arrays de linhas de texto. senha: opcional.
export function gerarPDF(paginas, { senha } = {}) {
  const n = paginas.length
  const objetos = [
    { dict: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dict: `<< /Type /Pages /Kids [${paginas.map((_, k) => `${4 + 2 * k} 0 R`).join(' ')}] /Count ${n} >>` },
    { dict: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>' },
  ]
  paginas.forEach((linhas, k) => {
    const conteudo = ['BT', '/F1 11 Tf', '14 TL', '40 800 Td', ...linhas.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`), 'ET'].join('\n')
    objetos.push({ dict: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + 2 * k} 0 R >>` })
    objetos.push({ dict: '<< /Length __LEN__ >>', fluxo: Buffer.from(conteudo, 'latin1') })
  })
  return montar(objetos, senha)
}

// PDF "digitalizado": uma página com uma imagem JPEG e nenhum texto.
export function gerarPDFImagem({ jpeg, largura, altura }) {
  const w = Math.round(largura * 0.75), h = Math.round(altura * 0.75)
  const conteudo = Buffer.from(`q ${w} 0 0 ${h} 0 0 cm /Im1 Do Q`, 'latin1')
  return montar([
    { dict: '<< /Type /Catalog /Pages 2 0 R >>' },
    { dict: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>' },
    { dict: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>` },
    { dict: '<< /Length __LEN__ >>', fluxo: conteudo },
    { dict: `<< /Type /XObject /Subtype /Image /Width ${largura} /Height ${altura} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length __LEN__ >>`, fluxo: jpeg },
  ])
}
