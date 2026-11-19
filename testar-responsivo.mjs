// Teste rápido de responsividade das páginas principais
import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const PAGES = ['/', '/receitas', '/despesas', '/cartoes', '/investimentos', '/projecao']
const WIDTHS = [390, 768, 1024, 1440, 1920]

async function testar() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  let problemas = []
  
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    console.log(`\n📱 Testando ${width}px`)
    
    for (const rota of PAGES) {
      try {
        await page.goto(`${BASE_URL}${rota}`, { waitUntil: 'networkidle', timeout: 10000 })
        
        // Verificar overflow horizontal
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
        const viewportWidth = width
        const hasOverflow = bodyWidth > viewportWidth + 5 // tolerância 5px
        
        if (hasOverflow) {
          problemas.push(`${width}px ${rota}: overflow ${bodyWidth}px`)
          console.log(`   ❌ ${rota} — overflow horizontal (${bodyWidth}px)`)
        } else {
          console.log(`   ✅ ${rota}`)
        }
      } catch (err) {
        problemas.push(`${width}px ${rota}: ${err.message}`)
        console.log(`   ⚠️  ${rota} — ${err.message}`)
      }
    }
  }
  
  await browser.close()
  
  console.log(`\n\n${problemas.length ? '❌' : '✅'} Teste concluído`)
  if (problemas.length) {
    console.log('\nProblemas encontrados:')
    problemas.forEach(p => console.log(`  - ${p}`))
  } else {
    console.log('Nenhum problema de overflow detectado.')
  }
  
  process.exit(problemas.length > 0 ? 1 : 0)
}

testar()
