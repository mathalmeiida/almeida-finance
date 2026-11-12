// ─── Importação Inteligente: abertura dos arquivos no navegador ─────────────
// Tudo é processado localmente. XLSX/XLS (SheetJS) e PDF (pdf.js) são
// carregados sob demanda, só nesta tela: não pesam na Home.
// Nenhum conteúdo do arquivo é enviado a servidores nem registrado em log.

import {
  detectarFormato, decodificarTexto, parseCSV, parseOFX, tabelaParaTransacoes,
  textoPDFParaTransacoes, aplicarLimite,
} from './importacaoLeitura.js'

const MAX_PAGINAS_PDF = 60

async function lerPlanilha(bytes, opcoes) {
  const XLSX = await import('xlsx')
  let wb
  try {
    wb = XLSX.read(bytes, { type: 'array', cellDates: true, cellFormula: false, cellHTML: false, sheetStubs: false })
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase()
    if (msg.includes('password') || msg.includes('encrypt')) throw new Error('A planilha está protegida por senha. Remova a senha e tente de novo.')
    throw new Error('Não foi possível abrir a planilha (arquivo corrompido ou formato inválido).')
  }
  let melhor = null
  for (const nome of wb.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false, dateNF: 'yyyy-mm-dd', defval: '', blankrows: false })
    const r = tabelaParaTransacoes(linhas.map(l => l.map(c => String(c ?? ''))), opcoes)
    if (!melhor || r.transacoes.length > melhor.transacoes.length) melhor = r
    if (r.transacoes.length) break
  }
  return melhor || { transacoes: [], descartadas: [], erro: 'A planilha está vazia.' }
}

const MAX_PAGINAS_OCR = 15
const MIN_CARACTERES_POR_PAGINA = 40 // abaixo disso o PDF é tratado como imagem

// OCR (tesseract.js) carregado SÓ quando necessário. Worker, núcleo e idioma
// vêm da própria origem (/ocr/*, copiados no build): nada é baixado de CDN e
// nenhum conteúdo do documento sai do aparelho.
async function ocrDasPaginas(doc, paginas, aoProgresso, cancelado) {
  const { createWorker } = await import('tesseract.js')
  const origem = typeof location !== 'undefined' ? location.origin : ''
  const worker = await createWorker('por', 1, {
    workerPath: `${origem}/ocr/worker.min.js`,
    corePath: `${origem}/ocr`,
    langPath: `${origem}/ocr/lang`,
    gzip: true,
    logger: () => {},
  })
  const linhas = []
  try {
    for (let p = 1; p <= paginas; p++) {
      if (cancelado?.()) break
      aoProgresso?.({ fase: 'ocr', pagina: p, total: paginas })
      const page = await doc.getPage(p)
      const base = page.getViewport({ scale: 1 })
      const escala = Math.max(1.5, Math.min(3, 1800 / base.width))
      const viewport = page.getViewport({ scale: escala })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      const { data } = await worker.recognize(canvas)
      canvas.width = 0; canvas.height = 0 // libera memória
      linhas.push(...String(data.text || '').split(/\r?\n/))
    }
  } finally {
    await worker.terminate().catch(() => {})
  }
  return linhas
}

// Agrupa os trechos de texto de cada página em linhas (mesma altura) e os
// ordena da esquerda para a direita. Sem texto suficiente → OCR local.
async function lerPDF(bytes, opcoes) {
  const { senha, aoProgresso, cancelado } = opcoes
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  let doc
  try {
    // isEvalSupported:false — não executa código embutido no PDF (CVE-2024-4367).
    // A senha só é usada nesta chamada: não é guardada nem registrada.
    doc = await pdfjs.getDocument({ data: bytes, password: senha || undefined, isEvalSupported: false, enableXfa: false, useSystemFonts: false }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') {
      return { precisaSenha: true, senhaIncorreta: e.code === 2, transacoes: [], descartadas: [], erro: null }
    }
    throw new Error('Não foi possível abrir o PDF (arquivo corrompido ou inválido).')
  }
  const linhas = []
  const paginas = Math.min(doc.numPages, MAX_PAGINAS_PDF)
  for (let p = 1; p <= paginas; p++) {
    aoProgresso?.({ fase: 'texto', pagina: p, total: paginas })
    const page = await doc.getPage(p)
    const { items } = await page.getTextContent()
    const porY = new Map()
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue
      const y = Math.round(it.transform[5])
      const chave = [...porY.keys()].find(k => Math.abs(k - y) <= 3) ?? y
      if (!porY.has(chave)) porY.set(chave, [])
      porY.get(chave).push({ x: it.transform[4], s: it.str })
    }
    ;[...porY.entries()].sort((a, b) => b[0] - a[0])
      .forEach(([, partes]) => linhas.push(partes.sort((a, b) => a.x - b.x).map(x => x.s).join(' ')))
  }
  const caracteres = linhas.join('').replace(/\s/g, '').length
  let usouOcr = false, linhasFinais = linhas
  if (caracteres < MIN_CARACTERES_POR_PAGINA * paginas) {
    try {
      linhasFinais = await ocrDasPaginas(doc, Math.min(paginas, MAX_PAGINAS_OCR), aoProgresso, cancelado)
      usouOcr = true
    } catch {
      await doc.destroy()
      return { transacoes: [], descartadas: [], erro: 'Este PDF é uma imagem e a leitura por OCR não pôde ser iniciada neste aparelho. Exporte o extrato em CSV, OFX ou planilha, ou cadastre manualmente.' }
    }
  }
  const truncado = doc.numPages > (usouOcr ? MAX_PAGINAS_OCR : MAX_PAGINAS_PDF)
  await doc.destroy()
  if (!linhasFinais.join('').trim()) {
    return { transacoes: [], descartadas: [], erro: 'Não encontramos texto neste PDF. Exporte o extrato em CSV, OFX ou planilha, ou cadastre manualmente.' }
  }
  return { ...textoPDFParaTransacoes(linhasFinais, { ...opcoes, ocr: usouOcr }), truncado }
}

// arquivo: File/Blob do <input type="file">.
// opcoes: { anoPadrao, senha (PDF), aoProgresso({fase,pagina,total}), cancelado() }
// Devolve { formato, transacoes, descartadas, erro, conta?, ehCartao?, truncado?,
//           precisaSenha?, senhaIncorreta?, instituicao?, tipoDocumento?, ocr? }
export async function lerArquivoImportacao(arquivo, { anoPadrao = new Date().getFullYear(), senha, aoProgresso, cancelado } = {}) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const { formato, erro } = detectarFormato(arquivo.name, bytes)
  if (erro) return { formato: null, transacoes: [], descartadas: [], erro }
  const opcoes = { anoPadrao, senha, aoProgresso, cancelado }
  let r
  try {
    if (formato === 'csv') r = tabelaParaTransacoes(parseCSV(decodificarTexto(bytes)), opcoes)
    else if (formato === 'ofx') r = parseOFX(decodificarTexto(bytes))
    else if (formato === 'xlsx' || formato === 'xls') r = await lerPlanilha(bytes, opcoes)
    else r = await lerPDF(bytes, opcoes)
  } catch (e) {
    return { formato, transacoes: [], descartadas: [], erro: e?.message || 'Não foi possível ler o arquivo.' }
  }
  return { formato, ...aplicarLimite(r) }
}