// ─── Foto de perfil: validação, compressão e caminhos no Storage ─────────────
// A imagem é processada NO NAVEGADOR antes do envio:
//   • valida formato e tamanho do arquivo original;
//   • recorta no centro (quadrado) e redimensiona para 512×512;
//   • codifica em WebP (ou JPEG quando o navegador não codifica WebP, ex.:
//     Safari antigo), reduzindo a qualidade até ficar abaixo do limite.
// Resultado típico: 30–120 KB por foto.

export const AVATAR_BUCKET = 'avatars'

// Formatos aceitos na ENTRADA. HEIC/HEIF (câmera do iPhone) são aceitos porque o
// Safari decodifica nativamente; se o navegador não conseguir decodificar,
// mostramos uma mensagem clara.
export const TIPOS_ACEITOS = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]
const EXTENSOES_ACEITAS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

export const TAMANHO_MAX_ENTRADA = 15 * 1024 * 1024 // 15 MB (foto original)
export const TAMANHO_MAX_SAIDA = 1024 * 1024        // 1 MB (após compressão; o bucket aceita até 2 MB)
const LADO_FINAL = 512

export function validarArquivoImagem(arquivo) {
  if (!arquivo) return 'Nenhuma imagem selecionada.'
  const tipo = (arquivo.type || '').toLowerCase()
  const ext = (arquivo.name || '').split('.').pop()?.toLowerCase() || ''
  const tipoOk = TIPOS_ACEITOS.includes(tipo) || (!tipo && EXTENSOES_ACEITAS.includes(ext))
  if (!tipoOk) return 'Formato não suportado. Use JPG, PNG, WEBP ou HEIC.'
  if (arquivo.size > TAMANHO_MAX_ENTRADA) return 'A imagem é muito grande. Escolha uma foto de até 15 MB.'
  if (arquivo.size === 0) return 'O arquivo de imagem está vazio.'
  return null
}

function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível ler esta imagem. Tente outra foto (JPG ou PNG).'))
    }
    img.decoding = 'async'
    img.src = url
  })
}

function canvasParaBlob(canvas, tipo, qualidade) {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), tipo, qualidade))
}

// Recebe um File/Blob e devolve { blob, tipo, extensao } pronto para upload.
// Navegadores modernos já aplicam a orientação EXIF ao desenhar no canvas
// (image-orientation: from-image é o padrão), então fotos da câmera não ficam
// de lado.
export async function processarImagemAvatar(arquivo) {
  const erro = validarArquivoImagem(arquivo)
  if (erro) throw new Error(erro)

  const img = await carregarImagem(arquivo)
  const largura = img.naturalWidth || img.width
  const altura = img.naturalHeight || img.height
  if (!largura || !altura) throw new Error('Imagem inválida.')

  const lado = Math.min(largura, altura)
  const sx = (largura - lado) / 2
  const sy = (altura - lado) / 2
  const destino = Math.min(LADO_FINAL, lado)

  const canvas = document.createElement('canvas')
  canvas.width = destino
  canvas.height = destino
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não permite processar imagens.')
  // Fundo branco: PNGs com transparência não ficam pretos ao virar JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, destino, destino)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, lado, lado, 0, 0, destino, destino)

  // Tenta WebP; se o navegador devolver outro tipo (não codifica WebP), usa JPEG.
  let tipo = 'image/webp'
  let blob = await canvasParaBlob(canvas, tipo, 0.85)
  if (!blob || blob.type !== 'image/webp') {
    tipo = 'image/jpeg'
    blob = await canvasParaBlob(canvas, tipo, 0.85)
  }
  // Reduz a qualidade até caber no limite.
  let qualidade = 0.75
  while (blob && blob.size > TAMANHO_MAX_SAIDA && qualidade >= 0.4) {
    blob = await canvasParaBlob(canvas, tipo, qualidade)
    qualidade -= 0.1
  }
  if (!blob) throw new Error('Não foi possível comprimir a imagem.')
  if (blob.size > TAMANHO_MAX_SAIDA) throw new Error('Não foi possível reduzir a imagem para menos de 1 MB.')

  return { blob, tipo, extensao: tipo === 'image/webp' ? 'webp' : 'jpg' }
}

// Extrai o caminho do objeto no bucket a partir da URL pública salva no perfil.
// Ex.: https://x.supabase.co/storage/v1/object/public/avatars/<uid>/avatar-1.webp
//      → "<uid>/avatar-1.webp"
export function caminhoDoAvatar(url) {
  if (!url) return null
  const marcador = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const i = url.indexOf(marcador)
  if (i === -1) return null
  const caminho = url.slice(i + marcador.length).split('?')[0]
  try { return decodeURIComponent(caminho) } catch { return caminho }
}

export function iniciaisDoNome(nome) {
  const limpo = String(nome || '').trim()
  if (!limpo) return 'U'
  return limpo.slice(0, 2).toUpperCase()
}
