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

// Agrupa os trechos de texto de cada página em linhas (mesma altura) e os
// ordena da esquerda para a direita.
async function lerPDF(bytes, opcoes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  let doc
  try {
    // isEvalSupported:false — não executa código embutido no PDF (CVE-2024-4367).
    doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, enableXfa: false, useSystemFonts: false }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error('O PDF está protegido por senha. Exporte sem senha ou use CSV/OFX.')
    throw new Error('Não foi possível abrir o PDF (arquivo corrompido ou inválido).')
  }
  const linhas = []
  const paginas = Math.min(doc.numPages, MAX_PAGINAS_PDF)
  for (let p = 1; p <= paginas; p++) {
    const page = await doc.getPage(p)
    const { items } = await page.getTextContent()
    const porY = new Map()
    for (const it of items) {
      if (!it.str || !it.str.trim()) continue
      const y = Math.round(it.transform[5])
      const chave = [...porY.keys()].find(k => Math.abs(k - y) <= 2) ?? y
      if (!porY.has(chave)) porY.set(chave, [])
      porY.get(chave).push({ x: it.transform[4], s: it.str })
    }
    ;[...porY.entries()].sort((a, b) => b[0] - a[0])
      .forEach(([, partes]) => linhas.push(partes.sort((a, b) => a.x - b.x).map(x => x.s).join(' ')))
  }
  await doc.destroy()
  if (!linhas.length) return { transacoes: [], descartadas: [], erro: 'O PDF não tem texto selecionável (provavelmente é uma imagem digitalizada). Leitura por OCR ainda não está disponível.' }
  return textoPDFParaTransacoes(linhas, opcoes)
}

// arquivo: File/Blob do <input type="file">.
// Devolve { formato, transacoes, descartadas, erro, conta?, ehCartao?, truncado? }
export async function lerArquivoImportacao(arquivo, { anoPadrao = new Date().getFullYear() } = {}) {
  const bytes = new Uint8Array(await arquivo.arrayBuffer())
  const { formato, erro } = detectarFormato(arquivo.name, bytes)
  if (erro) return { formato: null, transacoes: [], descartadas: [], erro }
  const opcoes = { anoPadrao }
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
