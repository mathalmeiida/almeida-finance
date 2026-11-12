import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs'

// Versão real do app (package.json) e, quando o build roda na Vercel, o commit
// publicado (variável pública de sistema da Vercel — não é segredo).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)

// OCR local (tesseract.js): copia worker, núcleo WASM e idioma português de
// node_modules para public/ocr (ignorado no git), servidos da própria origem.
// Só são baixados pelo navegador quando o usuário importa um PDF digitalizado.
function copiarArquivosOcr() {
  return {
    name: 'af-copiar-ocr',
    buildStart() {
      const destino = new URL('./public/ocr/', import.meta.url)
      const lang = new URL('./public/ocr/lang/', import.meta.url)
      mkdirSync(lang, { recursive: true })
      const copiar = (de, para) => { const o = new URL(de, import.meta.url); if (existsSync(o)) copyFileSync(o, para) }
      copiar('./node_modules/tesseract.js/dist/worker.min.js', new URL('worker.min.js', destino))
      for (const n of ['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js']) {
        copiar(`./node_modules/tesseract.js-core/${n}`, new URL(n, destino))
      }
      copiar('./node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz', new URL('por.traineddata.gz', lang))
    },
  }
}

export default defineConfig({
  plugins: [react(), copiarArquivosOcr()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(commit),
  },
})
