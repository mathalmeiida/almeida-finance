import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Versão real do app (package.json) e, quando o build roda na Vercel, o commit
// publicado (variável pública de sistema da Vercel — não é segredo).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))
const commit = (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7)

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD__: JSON.stringify(commit),
  },
})
