// ─── Foto de perfil: regras puras (testáveis em Node) ────────────────────────
// O bucket 'avatares' é PRIVADO. Por isso perfis.foto_url guarda o CAMINHO do
// arquivo no bucket (ex.: "<uid>/perfil-123.jpg") e a imagem é exibida por URL
// assinada temporária. Registros antigos guardavam a "URL pública" (que não
// abre em bucket privado — causa do bug); caminhoFoto() aceita os dois.

export const TAMANHO_MAX_ORIGINAL = 25 * 1024 * 1024 // antes da compressão
export const LADO_SAIDA = 512 // px da foto final (quadrada, exibida em círculo)

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const EXTENSOES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

export function caminhoFoto(fotoUrl) {
  if (!fotoUrl || typeof fotoUrl !== 'string') return null
  if (!/^https?:\/\//i.test(fotoUrl)) return fotoUrl.replace(/^\/+/, '')
  const m = fotoUrl.match(/\/avatares\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function ehHeic(arquivo) {
  const ext = String(arquivo?.name || '').toLowerCase().split('.').pop()
  return /heic|heif/.test(arquivo?.type || '') || ext === 'heic' || ext === 'heif'
}

// Validação antes de decodificar. Alguns Androids não informam o tipo: aí
// vale a extensão. O tamanho original pode ser grande (fotos de celular): a
// imagem é reduzida para 512 px antes do envio.
export function validarArquivoFoto(arquivo) {
  if (!arquivo) return 'Nenhum arquivo selecionado.'
  if (!arquivo.size) return 'O arquivo está vazio.'
  const ext = String(arquivo.name || '').toLowerCase().split('.').pop()
  const tipoOk = TIPOS.includes(arquivo.type) || (!arquivo.type && EXTENSOES.includes(ext))
  if (!tipoOk) return 'Formato não suportado. Use uma foto JPG, PNG, WebP ou HEIC.'
  if (arquivo.size > TAMANHO_MAX_ORIGINAL) return 'A foto passa de 25 MB. Escolha outra imagem.'
  return null
}

// Recorte quadrado: zoom >= 1; deslocX/deslocY em [-1, 1] movem o recorte
// dentro da sobra da imagem (0 = centralizado).
export function recorteQuadrado({ largura, altura, zoom = 1, deslocX = 0, deslocY = 0 }) {
  const z = Math.max(1, Math.min(4, Number(zoom) || 1))
  const lado = Math.min(largura, altura) / z
  const clamp = v => Math.max(-1, Math.min(1, Number(v) || 0))
  const sx = ((largura - lado) / 2) * (1 + clamp(deslocX))
  const sy = ((altura - lado) / 2) * (1 + clamp(deslocY))
  return { sx, sy, lado }
}

export function caminhoNovaFoto(userId, agora = Date.now()) {
  return `${userId}/perfil-${agora}.jpg`
}

export function mensagemErroFoto(err) {
  const m = String(err?.message || err || '')
  if (/failed to fetch|network|load failed/i.test(m)) return 'Sem conexão. A foto não foi enviada; sua foto atual continua a mesma.'
  if (/row-level security|unauthorized|403|permission/i.test(m)) return 'Sem permissão para salvar a foto. Entre novamente na conta e tente de novo.'
  if (/payload too large|413|exceeded/i.test(m)) return 'A foto ficou grande demais para envio. Tente outra imagem.'
  return 'Não foi possível salvar a foto. Tente novamente.'
}
