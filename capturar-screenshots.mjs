// Script para capturar screenshots em múltiplas resoluções
import { chromium } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'

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

async function capturarScreenshots() {
  // Criar diretório
  await fs.mkdir('screenshots/antes', { recursive: true })
  
  console.log('🚀 Iniciando captura de screenshots...\n')
  
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  
  let total = 0
  let sucesso = 0
  
  for (const resolucao of RESOLUCOES) {
    console.log(`\n📱 Resolução: ${resolucao.nome} (${resolucao.width}x${resolucao.height})`)
    
    // Configurar viewport
    await page.setViewportSize({
      width: resolucao.width,
      height: resolucao.height
    })
    
    for (const pagina of PAGINAS) {
      total++
      try {
        // Navegar
        await page.goto(`${BASE_URL}${pagina.rota}`, { 
          waitUntil: 'networkidle',
          timeout: 15000 
        })
        await page.waitForTimeout(1500)
        
        // Capturar screenshot
        const filename = `screenshots/depois/${resolucao.nome}-${pagina.nome}.png`
        await page.screenshot({
          path: filename,
          fullPage: true
        })
        
        console.log(`   ✅ ${pagina.nome}`)
        sucesso++
        
      } catch (erro) {
        console.log(`   ❌ ${pagina.nome} — ${erro.message}`)
      }
    }
  }
  
  await browser.close()
  
  console.log(`\n✨ Captura concluída: ${sucesso}/${total} screenshots salvos em screenshots/depois/\n`)
}

capturarScreenshots().catch(console.error)
