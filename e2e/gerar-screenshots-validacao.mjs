// ─── Gerador de Screenshots: Validação Final ────────────────────────────────
// Captura screenshots em 5 viewports para validação visual
// Executar: node e2e/gerar-screenshots-validacao.mjs

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'http://localhost:4173'
const OUTPUT_DIR = 'screenshots/validacao-final'

// Criar diretório de output
mkdirSync(OUTPUT_DIR, { recursive: true })

const viewports = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15-pro', width: 393, height: 852 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'notebook', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
]

async function capturarScreenshots() {
  const browser = await chromium.launch()
  
  for (const viewport of viewports) {
    console.log(`\n📸 Capturando ${viewport.name} (${viewport.width}×${viewport.height})...`)
    
    const page = await browser.newPage({ 
      viewport: { width: viewport.width, height: viewport.height } 
    })
    
    try {
      // 1. Home/Login
      await page.goto(BASE_URL)
      await page.waitForLoadState('networkidle')
      await page.screenshot({ 
        path: join(OUTPUT_DIR, `${viewport.name}-01-home.png`),
        fullPage: false
      })
      console.log(`✓ ${viewport.name}-01-home.png`)
      
      // 2. Tentar acessar Central de Importação
      await page.goto(`${BASE_URL}/central-importacao`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000) // Aguarda renderização
      await page.screenshot({ 
        path: join(OUTPUT_DIR, `${viewport.name}-02-central-importacao.png`),
        fullPage: true
      })
      console.log(`✓ ${viewport.name}-02-central-importacao.png`)
      
      // 3. Redirecionamento /importacao
      await page.goto(`${BASE_URL}/importacao`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)
      await page.screenshot({ 
        path: join(OUTPUT_DIR, `${viewport.name}-03-redir-importacao.png`),
        fullPage: false
      })
      console.log(`✓ ${viewport.name}-03-redir-importacao.png`)
      
    } catch (err) {
      console.error(`❌ Erro em ${viewport.name}:`, err.message)
    } finally {
      await page.close()
    }
  }

  await browser.close()
  console.log(`\n✅ Screenshots salvos em: ${OUTPUT_DIR}`)
  console.log(`Total: ${viewports.length * 3} imagens\n`)
}

// Executar
capturarScreenshots().catch(console.error)
