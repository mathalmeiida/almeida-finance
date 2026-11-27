
/**
 * ALMEIDA FINANCE — IMPORTAÇÃO INTELIGENTE
 * Leitura local de PDF, CSV, OFX, XLSX, XLS e imagens.
 */

import {
  detectarFormato,
  decodificarTexto,
  parseCSV,
  parseOFX,
  tabelaParaTransacoes,
  textoPDFParaTransacoes,
  aplicarLimite,
  TAMANHO_MAXIMO_BYTES,
} from './importacaoLeitura.js'

import {
  processarImagemFinanceira
} from './importacaoOCR.js'

const MAX_PAGINAS_PDF = 60
const MAX_PAGINAS_OCR = 15
const MIN_CARACTERES_POR_PAGINA = 40

// ============================================================
// PLANILHAS
// ============================================================

async function lerPlanilha(bytes, opcoes) {
  const XLSX = await import('xlsx')

  let wb

  try {
    wb = XLSX.read(bytes, {
      type: 'array',
      cellDates: true,
      cellFormula: false,
      cellHTML: false,
      sheetStubs: false,
    })
  } catch (e) {
    const msg = String(e?.message || '').toLowerCase()

    if (
      msg.includes('password') ||
      msg.includes('encrypt')
    ) {
      throw new Error(
        'A planilha está protegida por senha.'
      )
    }

    throw new Error(
      'Não foi possível abrir a planilha.'
    )
  }

  let melhor = null

  for (const nome of wb.SheetNames) {
    if (opcoes.cancelado?.()) {
      return resultadoCancelado()
    }

    const linhas = XLSX.utils.sheet_to_json(
      wb.Sheets[nome],
      {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd',
        defval: '',
        blankrows: false,
      }
    )

    const r = tabelaParaTransacoes(
      linhas.map(l =>
        l.map(c => String(c ?? ''))
      ),
      opcoes
    )

    if (
      !melhor ||
      r.transacoes.length > melhor.transacoes.length
    ) {
      melhor = r
    }

    if (r.transacoes.length) break
  }

  return melhor || {
    transacoes: [],
    descartadas: [],
    erro: 'A planilha está vazia.',
  }
}

// ============================================================
// CANCELAMENTO
// ============================================================

function resultadoCancelado() {
  return {
    transacoes: [],
    descartadas: [],
    erro: 'Operação cancelada.',
  }
}

// ============================================================
// OCR LOCAL
// ============================================================

async function ocrDasPaginas(
  doc,
  paginas,
  aoProgresso,
  cancelado
) {
  const { createWorker } = await import('tesseract.js')

  const origem =
    typeof location !== 'undefined'
      ? location.origin
      : ''

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

      aoProgresso?.({
        fase: 'ocr',
        pagina: p,
        total: paginas,
      })

      const page = await doc.getPage(p)

      const base = page.getViewport({
        scale: 1,
      })

      const escala = Math.max(
        1.5,
        Math.min(3, 1800 / base.width)
      )

      const viewport = page.getViewport({
        scale: escala,
      })

      const canvas = document.createElement('canvas')

      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)

      try {
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        }).promise

        const { data } = await worker.recognize(canvas)

        linhas.push(
          ...String(data.text || '').split(/\r?\n/)
        )
      } finally {
        canvas.width = 0
        canvas.height = 0
        page.cleanup()
      }
    }
  } finally {
    await worker.terminate().catch(() => {})
  }

  return linhas
}

// ============================================================
// NORMALIZAÇÃO DO TEXTO PDF
// ============================================================

function normalizarLinhaPDF(texto) {
  return String(texto || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function juntarPartes(partes) {
  return normalizarLinhaPDF(
    partes
      .slice()
      .sort((a, b) => a.x - b.x)
      .map(item => item.s)
      .join(' ')
  )
}

function normalizarDataInicial(linha) {
  return linha.replace(
    /^(\d{1,2})\s*\/\s*(\d{1,2})(?=\s|$)/,
    '$1/$2'
  )
}

function normalizarValorFinal(linha) {
  return linha.replace(
    /(\d[\d.]*,\d{2})\s+[-−]\s*$/,
    '$1-'
  )
}

// ============================================================
// ORGANIZAÇÃO DAS LINHAS DO PDF
// ============================================================

function agruparLinhasPDF(items) {
  const grupos = []

  const textos = items
    .filter(it =>
      typeof it.str === 'string' &&
      it.str.trim() &&
      it.transform
    )
    .map(it => ({
      x: it.transform[4],
      y: it.transform[5],
      s: it.str,
    }))
    .sort((a, b) => {
      return b.y - a.y || a.x - b.x
    })

  for (const item of textos) {
    let grupo = grupos.find(
      g => Math.abs(g.y - item.y) <= 2
    )

    if (!grupo) {
      grupo = {
        y: item.y,
        partes: [],
      }

      grupos.push(grupo)
    }

    grupo.partes.push(item)
  }

  return grupos.sort(
    (a, b) => b.y - a.y
  )
}

// ============================================================
// TRATAMENTO ESPECÍFICO DA FATURA BRADESCO
// ============================================================

function processarPaginaBradesco(
  grupos,
  numeroPagina,
  largura,
  origemX
) {
  if (numeroPagina === 1) {
    return grupos
      .map(g => juntarPartes(g.partes))
      .filter(Boolean)
  }

  const linhas = []

  const limiteColuna =
    origemX + largura * 0.60

  for (const grupo of grupos) {
    const esquerda = grupo.partes.filter(
      item => item.x < limiteColuna
    )

    let linha = juntarPartes(esquerda)

    if (!linha) continue

    linha = normalizarDataInicial(linha)
    linha = normalizarValorFinal(linha)

    const ehCabecalhoCartao =
      /cart[aã]o\s+(?:\d{4}\s+)?(?:[X*]{4}\s+){2}\d{4}/i
        .test(linha)

    const ehCabecalhoLancamentos =
      /^lan[çc]amentos\b/i.test(linha)

    const ehLancamento =
      /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+/
        .test(linha)

    if (
      ehCabecalhoCartao ||
      ehCabecalhoLancamentos ||
      ehLancamento
    ) {
      linhas.push(linha)
    }
  }

  return linhas
}

// ============================================================
// LEITURA DO PDF
// ============================================================

async function lerPDF(bytes, opcoes) {
  const {
    senha,
    aoProgresso,
    cancelado,
  } = opcoes

  const pdfjs = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )

  const { default: workerUrl } = await import(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
  )

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  let doc

  try {
    doc = await pdfjs.getDocument({
      data: bytes,
      password: senha || undefined,
      isEvalSupported: false,
      enableXfa: false,
      useSystemFonts: false,
    }).promise
  } catch (e) {
    if (e?.name === 'PasswordException') {
      return {
        precisaSenha: true,
        senhaIncorreta: e.code === 2,
        transacoes: [],
        descartadas: [],
        erro: null,
      }
    }

    throw new Error(
      'Não foi possível abrir o PDF.'
    )
  }

  try {
    const paginas = Math.min(
      doc.numPages,
      MAX_PAGINAS_PDF
    )

    const paginasExtraidas = []

    let caracteres = 0

    for (let p = 1; p <= paginas; p++) {
      if (cancelado?.()) {
        return resultadoCancelado()
      }

      aoProgresso?.({
        fase: 'texto',
        pagina: p,
        total: paginas,
      })

      const page = await doc.getPage(p)

      const { items } = await page.getTextContent()

      const grupos = agruparLinhasPDF(items)

      const linhasCompletas = grupos
        .map(g => juntarPartes(g.partes))
        .filter(Boolean)

      caracteres += linhasCompletas
        .join('')
        .replace(/\s/g, '')
        .length

      paginasExtraidas.push({
        numero: p,
        largura: page.view[2] - page.view[0],
        origemX: page.view[0],
        grupos,
        linhasCompletas,
      })

      page.cleanup()
    }

    const textoDocumento = paginasExtraidas
      .flatMap(p => p.linhasCompletas)
      .join(' ')

    const ehBradesco =
      /bradesco/i.test(textoDocumento) &&
      /fatura/i.test(textoDocumento) &&
      /lan[çc]amentos/i.test(textoDocumento)

    let linhasFinais = []

    for (const pagina of paginasExtraidas) {
      if (ehBradesco) {
        linhasFinais.push(
          ...processarPaginaBradesco(
            pagina.grupos,
            pagina.numero,
            pagina.largura,
            pagina.origemX
          )
        )
      } else {
        linhasFinais.push(
          ...pagina.linhasCompletas
        )
      }
    }

    let usouOcr = false

    // OCR somente quando o documento não possui
    // texto extraível suficiente.

    if (
      caracteres <
      MIN_CARACTERES_POR_PAGINA * paginas
    ) {
      try {
        linhasFinais = await ocrDasPaginas(
          doc,
          Math.min(paginas, MAX_PAGINAS_OCR),
          aoProgresso,
          cancelado
        )

        usouOcr = true
      } catch {
        return {
          transacoes: [],
          descartadas: [],
          erro:
            'Este PDF é uma imagem e a leitura por OCR não pôde ser iniciada. Tente CSV, OFX ou planilha.',
        }
      }
    }

    if (cancelado?.()) {
      return resultadoCancelado()
    }

    linhasFinais = linhasFinais
      .map(normalizarLinhaPDF)
      .map(normalizarDataInicial)
      .map(normalizarValorFinal)
      .filter(Boolean)

    if (!linhasFinais.length) {
      return {
        transacoes: [],
        descartadas: [],
        erro: 'Não encontramos texto neste PDF.',
      }
    }

    const truncado =
      doc.numPages >
      (
        usouOcr
          ? MAX_PAGINAS_OCR
          : MAX_PAGINAS_PDF
      )

    const resultado = textoPDFParaTransacoes(
      linhasFinais,
      {
        ...opcoes,
        ocr: usouOcr,
      }
    )

    return {
      ...resultado,
      truncado,
    }
  } finally {
    await doc.destroy().catch(() => {})
  }
}

// ============================================================
// IMPORTAÇÃO DE IMAGENS
// ============================================================

async function lerImagem(arquivo, opcoes) {
  const {
    aoProgresso,
    cancelado,
  } = opcoes

  try {
    if (cancelado?.()) {
      return resultadoCancelado()
    }

    aoProgresso?.({
      fase: 'ocr',
      pagina: 1,
      total: 1,
    })

    const resultado =
      await processarImagemFinanceira(
        arquivo,
        progresso => {
          aoProgresso?.({
            fase: 'ocr',
            pagina: 1,
            total: 1,
            progresso,
          })
        }
      )

    if (cancelado?.()) {
      return resultadoCancelado()
    }

    if (!resultado.transacoes?.length) {
      return {
        transacoes: [],
        descartadas: [],
        erro:
          'Não foi possível identificar transações nesta imagem.',
        ocr: true,
      }
    }

    const transacoes = resultado.transacoes.map(t => ({
      data: t.data,
      descricao: t.descricao,
      valor: t.valor,
      tipo: t.valor < 0
        ? 'despesa'
        : 'receita',
      confianca: t.confianca,
      revisar: true,
    }))

    return {
      transacoes,
      descartadas: [],
      erro: null,
      ocr: true,
      confiancaGeral: resultado.confianca_geral,
      tipoDocumento: 'imagem',
    }
  } catch (e) {
    return {
      transacoes: [],
      descartadas: [],
      erro:
        e?.message ||
        'Não foi possível processar a imagem.',
    }
  }
}

// ============================================================
// CENTRAL DE IMPORTAÇÃO
// ============================================================

export async function lerArquivoImportacao(
  arquivo,
  {
    anoPadrao = new Date().getFullYear(),
    senha,
    aoProgresso,
    cancelado,
  } = {}
) {
  if (!arquivo) {
    return {
      formato: null,
      transacoes: [],
      descartadas: [],
      erro: 'Nenhum arquivo selecionado.',
    }
  }

  if (cancelado?.()) {
    return resultadoCancelado()
  }

  if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
    return {
      formato: null,
      transacoes: [],
      descartadas: [],
      erro:
        `Arquivo muito grande. Máximo: ${
          TAMANHO_MAXIMO_BYTES / 1024 / 1024
        } MB.`,
    }
  }

  const opcoes = {
    anoPadrao,
    senha,
    aoProgresso,
    cancelado,
  }

  let formato = null

  try {
    const bytes = new Uint8Array(
      await arquivo.arrayBuffer()
    )

    const deteccao = detectarFormato(
      arquivo.name,
      bytes
    )

    formato = deteccao.formato

    if (deteccao.erro) {
      return {
        formato: null,
        transacoes: [],
        descartadas: [],
        erro: deteccao.erro,
      }
    }

    let resultado

    if (
      ['jpg', 'jpeg', 'png', 'webp'].includes(formato)
    ) {
      resultado = await lerImagem(
        arquivo,
        opcoes
      )
    } else if (formato === 'csv') {
      resultado = tabelaParaTransacoes(
        parseCSV(decodificarTexto(bytes)),
        opcoes
      )
    } else if (
      formato === 'ofx' ||
      formato === 'qfx'
    ) {
      resultado = parseOFX(
        decodificarTexto(bytes)
      )
    } else if (
      formato === 'xlsx' ||
      formato === 'xls'
    ) {
      resultado = await lerPlanilha(
        bytes,
        opcoes
      )
    } else if (formato === 'txt') {
      resultado = tabelaParaTransacoes(
        decodificarTexto(bytes)
          .split(/\r?\n/)
          .map(l => l.split(/\t|;|,/)),
        opcoes
      )
    } else if (formato === 'pdf') {
      resultado = await lerPDF(
        bytes,
        opcoes
      )
    } else {
      return {
        formato,
        transacoes: [],
        descartadas: [],
        erro: 'Formato não suportado.',
      }
    }

    if (cancelado?.()) {
      return resultadoCancelado()
    }

    const limitado = aplicarLimite(resultado)

    return {
      formato,
      ...limitado,
      truncado: Boolean(
        resultado.truncado ||
        limitado.truncado
      ),
    }
  } catch (e) {
    return {
      formato,
      transacoes: [],
      descartadas: [],
      erro:
        e?.message ||
        'Não foi possível ler o arquivo.',
    }
  }
}
