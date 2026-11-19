// Captura visual das páginas principais em 3 resoluções críticas
import { chromium } from '@playwright/test'
import fs from 'fs/promises'

const BASE_URL = 'http://localhost:5173'
const PAGES = ['/receitas', '/despesas', '/cartoes', '/investimentos', '/projecao']
const WIDTHS = [390, 1024, 1920]

async function capturar() {
  await fs.mkdir('screenshots/paginas', { recursive: true })
  
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  let total = 0, ok = 0
  
  for (const width of WIDTHS) {
    console.log(`\n📱 ${width}px`)
    await page.setViewportSize({ width, height: 900 })
    
    for (const rota of PAGES) {
      total++
      const nome = rota.replace('/', '') || 'home'
      try {
        await page.goto(`${BASE_URL}${rota}`, { waitUntil: 'networkidle', timeout: 10000 })
        await page.waitForTimeout(1000)
        await page.screenshot({ path: `screenshots/paginas/${width}-${nome}.png`, fullPage: true })
        console.log(`   ✅ ${nome}`)
        ok++
      } catch (err) {
        console.log(`   ❌ ${nome} — ${err.message}`)
      }
    }
  }
  
  await browser.close()
  console.log(`\n✨ ${ok}/${total} screenshots salvos\n`)
}

capturar()
