// Ícones do app: sem moldura dupla, arte em tela cheia, versionados no manifest.
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

let falhas = 0
const assert = (n, c, d = '') => { if (!c) falhas++; console.log(`${c ? 'PASS' : 'FALHA'} — ${n} ${d}`) }
const B = fileURLToPath(new URL('../public/branding/', import.meta.url))

async function pix(arq, x, y) {
  const { data, info } = await sharp(B + arq).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = (Math.min(y, info.height - 1) * info.width + Math.min(x, info.width - 1)) * 4
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3], w: info.width }
}

for (const [arq, n] of [['icon-512.png', 512], ['icon-192.png', 192]]) {
  const meta = await sharp(B + arq).metadata()
  assert(`${arq} tem ${n}×${n}`, meta.width === n && meta.height === n)
  assert(`${arq}: cantos transparentes (sem fundo extra atrás da arte)`, (await pix(arq, 1, 1)).a === 0 && (await pix(arq, n - 2, n - 2)).a === 0)
  const meio = n >> 1
  assert(`${arq}: a arte toca as 4 bordas (sem margem vazia)`, [(await pix(arq, meio, 2)), (await pix(arq, meio, n - 3)), (await pix(arq, 2, meio)), (await pix(arq, n - 3, meio))].every(p => p.a > 200))
}
for (const [arq, n] of [['apple-touch-icon.png', 180], ['icon-maskable.png', 512]]) {
  const meta = await sharp(B + arq).metadata()
  assert(`${arq} tem ${n}×${n}`, meta.width === n && meta.height === n)
  const { data, info } = await sharp(B + arq).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let transparente = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparente++
  assert(`${arq}: totalmente opaco (exigência do iOS/Android)`, transparente === 0)
  // sem "quadrado dentro de quadrado": a faixa da borda não é uma moldura escura e uniforme
  const borda = await pix(arq, n >> 1, 1), interior = await pix(arq, n >> 1, Math.round(n * 0.1))
  const dist = Math.abs(borda.r - interior.r) + Math.abs(borda.g - interior.g) + Math.abs(borda.b - interior.b)
  assert(`${arq}: borda e interior contínuos (sem moldura)`, dist < 60, `(Δ=${dist})`)
}
const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'))
assert('manifest: ícones 192, 512 e maskable versionados', ['192x192', '512x512'].every(s => manifest.icons.some(i => i.sizes === s && /\?v=\d+/.test(i.src))) && manifest.icons.some(i => i.purpose === 'maskable' && /\?v=\d+/.test(i.src)))
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
assert('index.html: favicon e apple-touch versionados', /apple-touch-icon\.png\?v=\d+/.test(html) && /favicon-32\.png\?v=\d+/.test(html))

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
