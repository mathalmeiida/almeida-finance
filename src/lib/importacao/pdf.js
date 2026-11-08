// ─── Extração de texto de PDF ────────────────────────────────────────────────
// Usa o pdf.js (Mozilla) apenas para LER o texto já existente no PDF.
// Configuração restritiva: sem eval, sem fontes do sistema, sem XFA e sem
// execução de JavaScript embutido (o pdf.js não executa scripts nesse modo).
// PDFs digitalizados (imagem, sem texto) são identificados e recusados com
// orientação — não há OCR nesta versão (ver documentação da funcionalidade).

import { ErroImportacao } from './detectar.js'
import { MAXIMO_PAGINAS_PDF } from './limites.js'

const TOLERANCIA_Y = 2.5
const ESPACO_CELULA = 8

function agruparLinhas(itens, pagina) {
  const ordenados = itens
    .filter(i => i.str && i.str.trim())
    .map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0 }))
    .sort((a, b) => (Math.abs(b.y - a.y) > TOLERANCIA_Y ? b.y - a.y : a.x - b.x))
  const linhas = []
  for (const it of ordenados) {
    const ultima = linhas[linhas.length - 1]
    if (ultima && Math.abs(ultima.y - it.y) <= TOLERANCIA_Y) ultima.itens.push(it)
    else linhas.push({ y: it.y, itens: [it] })
  }
  return linhas.map(l => {
    l.itens.sort((a, b) => a.x - b.x)
    const celulas = []
    let fimAnterior = null
    for (const it of l.itens) {
      if (fimAnterior == null || it.x - fimAnterior > ESPACO_CELULA) celulas.push(it.str.trim())
      else celulas[celulas.length - 1] += (it.x - fimAnterior > 1.5 ? ' ' : '') + it.str.trim()
      fimAnterior = it.x + it.w
    }
    return { pagina, celulas: celulas.filter(Boolean), texto: celulas.filter(Boolean).join('  ') }
  })
}

/**
 * @param {Uint8Array} bytes
 * @param {object} pdfjs  módulo pdfjs-dist já carregado (injetado p/ testes)
 */
export async function extrairLinhasPdf(bytes, pdfjs) {
  let doc
  try {
    doc = await pdfjs.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      enableXfa: false,
      disableAutoFetch: true,
      disableStream: true,
      verbosity: 0,
    }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') {
      throw new ErroImportacao('protegido', 'O PDF está protegido por senha. Gere o documento sem senha no app do banco e envie novamente.')
    }
    throw new ErroImportacao('corrompido', 'Não foi possível abrir o PDF. O arquivo pode estar corrompido.')
  }
  try {
    const paginas = Math.min(doc.numPages, MAXIMO_PAGINAS_PDF)
    const linhas = []
    let caracteres = 0
    for (let p = 1; p <= paginas; p++) {
      const pagina = await doc.getPage(p)
      const conteudo = await pagina.getTextContent()
      const daPagina = agruparLinhas(conteudo.items, p)
      for (const l of daPagina) caracteres += l.texto.length
      linhas.push(...daPagina)
      pagina.cleanup?.()
    }
    if (caracteres < 20) {
      throw new ErroImportacao(
        'digitalizado',
        'Este PDF não tem texto selecionável (parece digitalizado). Baixe o extrato em PDF original, CSV, OFX ou planilha no app do banco.'
      )
    }
    return { linhas, paginas, paginasTotal: doc.numPages, truncado: doc.numPages > MAXIMO_PAGINAS_PDF }
  } finally {
    await doc.destroy?.()
  }
}
