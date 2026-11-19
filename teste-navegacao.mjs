// Teste rápido de navegação nas páginas principais
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

async function testar() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  
  const paginas = [
    { rota: '/', nome: 'Home', selector: '[data-testid="atalhos-home"], .af-cal-home' },
    { rota: '/receitas', nome: 'Receitas', selector: 'h1:has-text("Receitas")' },
    { rota: '/despesas', nome: 'Despesas', selector: 'h1:has-text("Despesas")' },
    { rota: '/cartoes', nome: 'Cartões', selector: 'h1:has-text("Cartões")' },
    { rota: '/investimentos', nome: 'Investimentos', selector: 'h1:has-text("Patrimônio")' },
    { rota: '/projecao', nome: 'Projeção', selector: 'h1:has-text("Planejamento")' },
  ]
  
  let ok = 0, falhas = []
  
  for (const p of paginas) {
    try {
      await page.goto(`${BASE_URL}${p.rota}`, { waitUntil: 'networkidle', timeout: 10000 })
      await page.waitForSelector(p.selector, { timeout: 5000 })
      console.log(`✅ ${p.nome}`)
      ok++
    } catch (err) {
      console.log(`❌ ${p.nome} — ${err.message}`)
      falhas.push(p.nome)
    }
  }
  
  await browser.close()
  
  console.log(`\n${ok}/${paginas.length} páginas OK`)
  if (falhas.length) {
    console.log(`Falhas: ${falhas.join(', ')}`)
    process.exit(1)
  }
}

testar()
