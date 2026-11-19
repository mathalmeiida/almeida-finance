// AUDITORIA VISUAL RÁPIDA — Principais páginas e resoluções
import { test } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Resoluções críticas
const RESOLUCOES = [
  { nome: 'Mobile-390', width: 390, height: 844 },
  { nome: 'Desktop-1440', width: 1440, height: 900 },
  { nome: 'Desktop-1920', width: 1920, height: 1080 },
]

// Páginas principais
const PAGINAS = [
  { rota: '/', nome: 'home' },
  { rota: '/receitas', nome: 'receitas' },
  { rota: '/despesas', nome: 'despesas' },
  { rota: '/calendario', nome: 'calendario' },
]

for (const resolucao of RESOLUCOES) {
  for (const pagina of PAGINAS) {
    
    test(`${resolucao.nome} — ${pagina.nome}`, async ({ page }) => {
      // Configurar viewport
      await page.setViewportSize({
        width: resolucao.width,
        height: resolucao.height
      })
      
      // Navegar para página
      await page.goto(`${BASE_URL}${pagina.rota}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1500) // Aguardar animações
      
      // Capturar screenshot
      await page.screenshot({
        path: `screenshots/antes/${resolucao.nome}-${pagina.nome}.png`,
        fullPage: true
      })
      
      console.log(`✅ Capturado: ${resolucao.nome} — ${pagina.nome}`)
    })
  }
}
