/**
 * Remove o fundo retangular externo do ícone Almeida Finance usando
 * uma máscara geométrica de quadrado arredondado (rounded-square).
 *
 * Estratégia:
 *   1. Detecta automaticamente as dimensões do ícone interno por
 *      varredura de borda (onde começa o conteúdo não-fundo).
 *   2. Cria uma máscara SVG com o mesmo raio de borda do ícone.
 *   3. Aplica a máscara com sharp.composite() para tornar transparente
 *      tudo fora do quadrado arredondado — sem tocar nos pixels internos.
 */

import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const SRC  = join(__dir, '..', 'public', 'branding', 'Ícone Almeida Finance em Borgonha.png')
const DEST = join(__dir, '..', 'public', 'branding', 'af-icone.png')

// ── 1. Leitura e dimensões ────────────────────────────────────────────────────
const meta = await sharp(SRC).metadata()
const W = meta.width
const H = meta.height
console.log(`Dimensões originais: ${W}×${H}`)

// ── 2. Detectar a margem do ícone (onde começa o conteúdo ≠ fundo) ───────────
// Lemos uma faixa de pixels bruta para encontrar as bordas do ícone interno.
const { data: raw } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const px = new Uint8ClampedArray(raw.buffer)

// Cor do fundo externo amostrada no canto (0,0)
const [BR, BG, BB] = [px[0], px[1], px[2]]
console.log(`Cor do fundo externo: rgb(${BR},${BG},${BB})`)

// Tolerância para considerar um pixel como "fundo"
const TOL = 18

function isFundo(x, y) {
  const i = (y * W + x) * 4
  const dr = px[i]   - BR
  const dg = px[i+1] - BG
  const db = px[i+2] - BB
  return Math.sqrt(dr*dr + dg*dg + db*db) < TOL
}

// Varre do topo para baixo no centro horizontal — encontra onde começa o ícone
let margemTopo = 0
for (let y = 0; y < H; y++) {
  if (!isFundo(W >> 1, y)) { margemTopo = y; break }
}
// Varre da esquerda para a direita no centro vertical
let margemEsq = 0
for (let x = 0; x < W; x++) {
  if (!isFundo(x, H >> 1)) { margemEsq = x; break }
}
// Varre de baixo para cima no centro
let margemBase = H
for (let y = H - 1; y >= 0; y--) {
  if (!isFundo(W >> 1, y)) { margemBase = y; break }
}
// Varre da direita para a esquerda
let margemDir = W
for (let x = W - 1; x >= 0; x--) {
  if (!isFundo(x, H >> 1)) { margemDir = x; break }
}

const iconeX = margemEsq
const iconeY = margemTopo
const iconeW = margemDir - margemEsq
const iconeH = margemBase - margemTopo
console.log(`Ícone interno detectado: x=${iconeX} y=${iconeY} w=${iconeW} h=${iconeH}`)

// ── 3. Estimar raio de borda ──────────────────────────────────────────────────
// O ícone tem bordas visualmente muito arredondadas (~22% da largura)
// Amostamos diagonalmente a partir do canto do ícone para medir o raio.
// Estimativa conservadora: usa 20% da menor dimensão.
const raio = Math.round(Math.min(iconeW, iconeH) * 0.20)
console.log(`Raio estimado das bordas arredondadas: ${raio}px`)

// ── 4. Máscara SVG ────────────────────────────────────────────────────────────
// Cria um SVG do tamanho da imagem completa com um rect arredondado branco
// posicionado exatamente sobre o ícone interno.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect
    x="${iconeX}" y="${iconeY}"
    width="${iconeW}" height="${iconeH}"
    rx="${raio}" ry="${raio}"
    fill="white"
  />
</svg>`

const mascara = await sharp(Buffer.from(svg)).png().toBuffer()

// ── 5. Aplicar máscara ────────────────────────────────────────────────────────
// Composite com blend "dest-in": mantém apenas os pixels da imagem original
// onde a máscara é opaca (branca) → tudo fora do rect vira transparente.
await sharp(SRC)
  .ensureAlpha()
  .composite([{ input: mascara, blend: 'dest-in' }])
  .png({ compressionLevel: 9 })
  .toFile(DEST)

console.log(`✅ Salvo: ${DEST}`)

// ── 6. Verificação: cantos da imagem devem ser transparentes ──────────────────
const { data: result } = await sharp(DEST).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const res = new Uint8ClampedArray(result.buffer)

const pontos = [
  [5, 5], [W-5, 5], [5, H-5], [W-5, H-5],          // 4 cantos externos
  [W>>1, H>>1],                                        // centro (deve ser opaco)
]
let erros = 0
for (const [x, y] of pontos) {
  const a = res[((y * W + x) * 4) + 3]
  const esperado = (x === (W>>1) && y === (H>>1)) ? 'opaco' : 'transparente'
  const real = a < 20 ? 'transparente' : a > 235 ? 'opaco' : `parcial(${a})`
  const ok = (esperado === 'opaco' && a > 235) || (esperado === 'transparente' && a < 20)
  console.log(`  (${x},${y}): esperado=${esperado}, obtido=${real} ${ok ? '✓' : '✗'}`)
  if (!ok) erros++
}
console.log(erros === 0 ? '\n✅ Transparência verificada com sucesso.' : `\n⚠️ ${erros} verificação(ões) falharam.`)
