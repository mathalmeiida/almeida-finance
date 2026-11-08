// Gera um PDF mínimo (texto selecionável, fonte Helvetica) para os testes.
// Cada linha vira um comando de texto em uma posição Y própria, o que imita a
// estrutura de extratos e faturas reais (texto posicionado por coordenadas).
// Opcional: `colunas` (array de arrays) posiciona cada célula em um X próprio.

function escaparPdf(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

export function gerarPdfTexto(linhas) {
  let y = 800
  const comandos = []
  for (const linha of linhas) {
    const celulas = Array.isArray(linha) ? linha : [linha]
    // Colunas como em extratos reais: data estreita, descrição larga, valores.
    const posicoes = [40, 110, 380, 470]
    celulas.forEach((celula, k) => {
      const x = posicoes[k] ?? 470 + (k - 3) * 80
      comandos.push(`BT /F1 10 Tf ${x} ${y} Td (${escaparPdf(celula)}) Tj ET`)
    })
    y -= 16
  }
  const conteudo = comandos.join('\n')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo, 'latin1')} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objetos.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new Uint8Array(Buffer.from(pdf, 'latin1'))
}

// PDF sem nenhum texto (simula um documento digitalizado/escaneado).
export function gerarPdfSemTexto() {
  return gerarPdfTexto([]).slice()
}
