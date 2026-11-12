/**
 * Gera os ícones do app a partir de public/branding/af-icone.png.
 *
 * Problema anterior: a arte (quadrado vinho arredondado, com ~17% de margem
 * transparente) era "achatada" sobre um fundo vinho escuro, o que criava dois
 * quadrados sobrepostos (moldura dupla), principalmente no iPhone.
 *
 * Agora:
 *  • Detecta o contorno real da arte pelo canal alfa e recorta a margem vazia.
 *  • icon-192 / icon-512 / favicon ("any"): a própria arte preenche todo o
 *    ícone; fora dos cantos arredondados fica transparente (sem fundo extra).
 *  • apple-touch-icon e icon-maskable: o sistema aplica a máscara (iOS/Android)
 *    e exige fundo opaco. A arte entra em tela cheia (sem moldura), com um
 *    pequeno corte para remover o brilho da borda; os cantos recebem a cor
 *    local da própria arte (a máscara do sistema os esconde).
 *
 * Uso: node tools/gerar-icones-pwa.mjs
 */
import sharp from 'sharp'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PASTA = path.join(RAIZ, 'public', 'branding')
const FONTE = path.join(PASTA, 'af-icone.png')

async function contornoDaArte() {
  const { data, info } = await sharp(FONTE).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 128) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      }
    }
  }
  // Contorno completo (a arte tem ~2% a mais de largura que de altura).
  return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 }
}

async function main() {
  const caixa = await contornoDaArte()
  const lado = Math.max(caixa.width, caixa.height)
  // Arte inteira, ajustada a um quadrado (distorção < 2%), tocando as 4 bordas.
  const arte = await sharp(FONTE).extract(caixa).resize(lado, lado, { fit: 'fill' }).png().toBuffer()
  console.log(`contorno da arte: ${caixa.width}×${caixa.height} em (${caixa.left}, ${caixa.top})`)

  // Ícones "any": a arte ocupa todo o ícone; cantos transparentes.
  for (const [n, nome] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'favicon-180-fonte.png']]) {
    if (nome.includes('fonte')) continue
    await sharp(arte).resize(n, n).png({ compressionLevel: 9 }).toFile(path.join(PASTA, nome))
    console.log(`✓ ${nome} (${n}×${n}, transparente nos cantos)`)
  }
  await sharp(arte).resize(32, 32).png({ compressionLevel: 9 }).toFile(path.join(PASTA, 'favicon-32.png'))
  console.log('✓ favicon-32.png')

  // Ícones com fundo opaco (iOS e maskable): arte em tela cheia, sem moldura.
  async function telaCheia(n, nome) {
    const corte = Math.round(lado * 0.02) // tira o brilho da borda da arte
    const miolo = await sharp(arte)
      .extract({ left: corte, top: corte, width: lado - 2 * corte, height: lado - 2 * corte })
      .resize(n, n).png().toBuffer()
    // Cor local de cada canto (pixel opaco logo depois do arredondamento).
    const { data, info } = await sharp(miolo).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const amostra = (x, y) => { const i = (y * info.width + x) * 4; return { r: data[i], g: data[i + 1], b: data[i + 2] } }
    const d = Math.round(n * 0.14)
    const cantos = [[0, 0, d, d], [n - d, 0, n - d - 1, d], [0, n - d, d, n - d - 1], [n - d, n - d, n - d - 1, n - d - 1]]
    const camadas = cantos.map(([px, py, sx, sy]) => {
      const c = amostra(Math.min(n - 1, sx), Math.min(n - 1, sy))
      return { input: { create: { width: d, height: d, channels: 3, background: c } }, left: px, top: py }
    })
    const medio = amostra(Math.round(n * 0.5), Math.round(n * 0.12))
    await sharp({ create: { width: n, height: n, channels: 3, background: medio } })
      .composite([...camadas, { input: miolo }])
      .flatten().png({ compressionLevel: 9 }).toFile(path.join(PASTA, nome))
    console.log(`✓ ${nome} (${n}×${n}, opaco, arte em tela cheia)`)
  }
  await telaCheia(180, 'apple-touch-icon.png')
  await telaCheia(512, 'icon-maskable.png')
}
main().catch(e => { console.error(e); process.exit(1) })
