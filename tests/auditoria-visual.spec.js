// AUDITORIA VISUAL — DESKTOP vs MOBILE
// Captura screenshots de todas as páginas em múltiplas resoluções
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

// Resoluções a testar
const RESOLUCOES = [
  { nome: 'Mobile-375', width: 375, height: 667 },
  { nome: 'Mobile-390', width: 390, height: 844 },
  { nome: 'Tablet-768', width: 768, height: 1024 },
  { nome: 'Tablet-1024', width: 1024, height: 768 },
  { nome: 'Desktop-1366', width: 1366, height: 768 },
  { nome: 'Desktop-1440', width: 1440, height: 900 },
  { nome: 'Desktop-1920', width: 1920, height: 1080 },
]

// Páginas principais
const PAGINAS = [
  { rota: '/', nome: 'home' },
  { rota: '/receitas', nome: 'receitas' },
  { rota: '/despesas', nome: 'despesas' },
  { rota: '/cartoes', nome: 'cartoes' },
  { rota: '/investimentos', nome: 'investimentos' },
  { rota: '/calendario', nome: 'calendario' },
  { rota: '/admin', nome: 'admin' },
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
        await page.waitForTimeout(2000) // Aguardar animações
        
        // Capturar screenshot
        await page.screenshot({
          path: `screenshots/antes/${resolucao.nome}-${pagina.nome}.png`,
          fullPage: true
        })
        
        console.log(`✅ Capturado: ${resolucao.nome} — ${pagina.nome}`)
      })
    }
  }
