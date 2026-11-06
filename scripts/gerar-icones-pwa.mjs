/**
 * gerar-icones-pwa.mjs
 * Gera todos os ícones PWA a partir do "Ícone Almeida Finance em Borgonha.png"
 * que tem fundo vinho sólido (sem transparência) — correto para PWA/iOS.
 *
 * Saída:
 *   public/branding/icon-192.png        — ícone PWA 192×192 (any)
 *   public/branding/icon-512.png        — ícone PWA 512×512 (any)
 *   public/branding/icon-maskable.png   — 512×512 com safe-zone maskable
 *   public/branding/apple-touch-icon.png — 180×180 para iOS (fundo opaco)
 */

import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// Fonte: ícone com fundo vinho sólido (sem transparência nos cantos)
const FONTE = path.join(ROOT, 'public', 'branding', 'Ícone Almeida Finance em Borgonha.png')
const OUT   = path.join(ROOT, 'public', 'branding')

// Cor de fundo vinho premium (caso algum resize precise preencher)
const FUNDO_VINHO = { r: 45, g: 4, b: 17, alpha: 1 }

async function gerar(tamanho, nomeArquivo, opcoes = {}) {
  const { maskable = false } = opcoes

  let pipeline = sharp(FONTE)

  if (maskable) {
    // Para maskable: a área "safe zone" é 80% do centro (40% de padding em cada lado).
    // Reduzimos o conteúdo para caber dentro da safe zone (80%) e adicionamos fundo vinho.
    const conteudo = Math.round(tamanho * 0.8)
    pipeline = sharp(FONTE)
      .resize(conteudo, conteudo, { fit: 'contain', background: FUNDO_VINHO })
      .extend({
        top:    Math.floor((tamanho - conteudo) / 2),
        bottom: Math.ceil((tamanho - conteudo) / 2),
        left:   Math.floor((tamanho - conteudo) / 2),
        right:  Math.ceil((tamanho - conteudo) / 2),
        background: FUNDO_VINHO,
      })
  } else {
    // Ícone comum: resize direto, preenchendo fundo vinho se necessário
    pipeline = sharp(FONTE)
      .resize(tamanho, tamanho, { fit: 'contain', background: FUNDO_VINHO })
      .flatten({ background: FUNDO_VINHO })
  }

  const saida = path.join(OUT, nomeArquivo)
  await pipeline.png({ compressionLevel: 9 }).toFile(saida)
  console.log(`✓ ${nomeArquivo} (${tamanho}×${tamanho})`)
}

async function main() {
  console.log('Gerando ícones PWA...\n')

  await gerar(192,  'icon-192.png')
  await gerar(512,  'icon-512.png')
  await gerar(512,  'icon-maskable.png', { maskable: true })
  await gerar(180,  'apple-touch-icon.png')
  await gerar(32,   'favicon-32.png')

  console.log('\n✅ Todos os ícones gerados com sucesso.')
  console.log('Lembre-se de atualizar o manifest.webmanifest e index.html.')
}

main().catch(err => { console.error('Erro:', err); process.exit(1) })
