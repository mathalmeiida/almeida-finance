import { defineConfig, devices } from '@playwright/test'

// Testes de interface do Almeida Finance.
// • Rodam contra o build local (`vite preview`), nunca contra produção.
// • Todo tráfego para *.supabase.co é interceptado nos testes (e2e/apoio.js):
//   nenhuma requisição chega ao banco real.
// • WebKit com emulação de iPhone usa o motor do Safari, mas NÃO reproduz o
//   zoom automático de foco do iOS (comportamento do UIKit). A validação final
//   do zoom exige um iPhone real.
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'off',
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    { name: 'iphone-se-webkit', use: { ...devices['iPhone SE'] } },
    { name: 'iphone-13-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-13-paisagem-webkit', use: { ...devices['iPhone 13 landscape'] } },
    // Largura real do Safari em paisagem com viewport-fit=cover (844px): o
    // preset do Playwright usa 750px e esconde regras com min-width: 768px.
    { name: 'iphone-13-paisagem-844-webkit', use: { ...devices['iPhone 13 landscape'], viewport: { width: 844, height: 390 } } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
})
