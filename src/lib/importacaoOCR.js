/**
 * ALMEIDA FINANCE — OCR para Importação de Imagens
 * 
 * Processa JPG, JPEG, PNG, WEBP usando Tesseract.js
 * Extrai texto de faturas e extratos digitalizados
 * 
 * HEIC não é suportado (requer conversão externa)
 * Todo processamento é local: nenhum dado sai do aparelho
 */

// Pré-processa imagem para melhorar OCR
function preprocessarImagem(canvas) {
  const ctx = canvas.getContext('2d')
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  
  // Converter para escala de cinza e aumentar contraste
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const contraste = ((gray - 128) * 1.5) + 128
    const valor = Math.max(0, Math.min(255, contraste))
    
    data[i] = valor     // R
    data[i + 1] = valor // G
    data[i + 2] = valor // B
  }
  
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Realiza OCR em uma imagem usando Tesseract.js
 * Usa os mesmos workers locais do OCR de PDF (/ocr/*)
 * @param {File} arquivo - Arquivo de imagem (JPG, PNG, WEBP)
 * @param {Function} onProgress - Callback de progresso (0-100)
 * @returns {Promise<string>} Texto extraído
 */
export async function extrairTextoDeImagem(arquivo, onProgress = null) {
  const extensao = arquivo.name.split('.').pop().toLowerCase()
  
  // Verificar formato HEIC (não suportado)
  if (extensao === 'heic') {
    throw new Error('Formato HEIC não é suportado. Use JPG, PNG, WEBP ou PDF.')
  }
  
  // Carregar imagem em um canvas
  const img = new Image()
  const url = URL.createObjectURL(arquivo)
  
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = url
  })
  
  // Criar canvas e pré-processar
  const canvas = document.createElement('canvas')
  
  // Limitar tamanho para performance (max 3000px)
  const maxDim = 3000
  const escala = Math.min(1, maxDim / Math.max(img.width, img.height))
  canvas.width = Math.round(img.width * escala)
  canvas.height = Math.round(img.height * escala)
  
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  
  preprocessarImagem(canvas)
  
  URL.revokeObjectURL(url)
  
  // Executar OCR com worker local (igual ao PDF OCR)
  const { createWorker } = await import('tesseract.js')
  const origem = typeof location !== 'undefined' ? location.origin : ''
  const worker = await createWorker('por', 1, {
    workerPath: `${origem}/ocr/worker.min.js`,
    corePath: `${origem}/ocr`,
    langPath: `${origem}/ocr/lang`,
    gzip: true,
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  
  try {
    const { data } = await worker.recognize(canvas)
    canvas.width = 0
    canvas.height = 0 // libera memória
    return data.text
  } finally {
    await worker.terminate().catch(() => {})
  }
}

/**
 * Extrai transações financeiras de texto OCR
 * @param {string} texto - Texto extraído do OCR
 * @returns {Array} Lista de transações identificadas
 */
export function extrairTransacoesDeTexto(texto) {
  const linhas = texto.split('\n').filter(l => l.trim())
  const transacoes = []
  
  // Padrões comuns em faturas
  const padraoValor = /R?\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2}))/g
  const padraoData = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]
    
    // Pular linhas de cabeçalho comuns
    if (/^(data|descri|valor|total|saldo)/i.test(linha)) {
      continue
    }
    
    // Buscar valor
    const matchValor = linha.match(padraoValor)
    if (!matchValor) continue
    
    const valorStr = matchValor[0].replace(/[R$\s]/g, '').replace('.', '').replace(',', '.')
    const valor = parseFloat(valorStr)
    
    if (isNaN(valor) || valor <= 0) continue
    
    // Buscar data
    const matchData = linha.match(padraoData)
    let data = null
    if (matchData) {
      const [, dia, mes, ano] = matchData[0].match(/(\d+)[\/\-](\d+)(?:[\/\-](\d+))?/) || []
      const anoCompleto = ano ? (ano.length === 2 ? `20${ano}` : ano) : new Date().getFullYear()
      data = `${anoCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`
    }
    
    // Extrair descrição (texto entre data e valor)
    let descricao = linha
      .replace(padraoData, '')
      .replace(padraoValor, '')
      .trim()
    
    if (!descricao) {
      descricao = `Transação ${i + 1}`
    }
    
    transacoes.push({
      descricao: descricao.substring(0, 100), // Limitar tamanho
      valor,
      data: data || new Date().toISOString().split('T')[0],
      original: linha,
      confianca: matchData && matchValor ? 'alta' : 'baixa'
    })
  }
  
  return transacoes
}

/**
 * Processa arquivo de imagem completo
 * @param {File} arquivo
 * @param {Function} onProgress
 * @returns {Promise<Object>} { texto, transacoes, origem }
 */
export async function processarImagemFinanceira(arquivo, onProgress = null) {
  if (onProgress) onProgress(0)
  
  // Extrair texto
  const texto = await extrairTextoDeImagem(arquivo, (p) => {
    if (onProgress) onProgress(p * 0.8) // 0-80% para OCR
  })
  
  if (onProgress) onProgress(90)
  
  // Extrair transações
  const transacoes = extrairTransacoesDeTexto(texto)
  
  if (onProgress) onProgress(100)
  
  return {
    texto,
    transacoes,
    origem: arquivo.name,
    formato: 'imagem_ocr',
    confianca_geral: transacoes.length > 0 ? 
      (transacoes.filter(t => t.confianca === 'alta').length / transacoes.length) : 0
  }
}
