// ─── Gerador de Screenshots: Central de Importação ─────────────────────────
// Captura 8 estados (desktop + mobile): vazio, preenchido, erro, sucesso
//
// Executar: node tests/gerar-screenshots.mjs
// Requisito: servidor rodando em http://localhost:5173

import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const BASE_URL = 'http://localhost:5173'
const OUTPUT_DIR = 'screenshots/central-importacao'

// Criar diretório de output
mkdirSync(OUTPUT_DIR, { recursive: true })

async function capturarScreenshots() {
  const browser = await chromium.launch()
  
  // Helper: Login
  async function fazerLogin(page) {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[type="email"]', 'teste@teste.com')
    await page.fill('input[type="password"]', 'senha123')
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
  }

  // Desktop (1920x1080)
  console.log('📸 Capturando screenshots DESKTOP...')
  const desktopPage = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  
  try {
    await fazerLogin(desktopPage)
    await desktopPage.goto(`${BASE_URL}/central-importacao`)
    await desktopPage.waitForSelector('[data-testid="central-importacao"]', { timeout: 10000 })
    
    // 1. Desktop - Estado Vazio (sem histórico)
    await desktopPage.screenshot({ 
      path: join(OUTPUT_DIR, '01-desktop-vazio.png'),
      fullPage: true 
    })
    console.log('✓ 01-desktop-vazio.png')
    
    // 2. Desktop - Preenchido (formulário com dados)
    await desktopPage.click('button:has-text("Extrato bancário")')
    await desktopPage.fill('input[placeholder*="Conta"]', 'Conta Teste XYZ')
    await desktopPage.screenshot({ 
      path: join(OUTPUT_DIR, '02-desktop-preenchido.png'),
      fullPage: true 
    })
    console.log('✓ 02-desktop-preenchido.png')
    
    // 3. Desktop - Erro (botão disabled)
    await desktopPage.click('button:has-text("Fatura de cartão")')
    await desktopPage.waitForTimeout(500)
    await desktopPage.screenshot({ 
      path: join(OUTPUT_DIR, '03-desktop-erro.png'),
      fullPage: true 
    })
    console.log('✓ 03-desktop-erro.png')
    
    // 4. Desktop - Sucesso (se houver histórico)
    await desktopPage.click('button:has-text("Extrato bancário")')
    await desktopPage.waitForTimeout(500)
    await desktopPage.screenshot({ 
      path: join(OUTPUT_DIR, '04-desktop-sucesso.png'),
      fullPage: true 
    })
    console.log('✓ 04-desktop-sucesso.png')
    
  } catch (err) {
    console.error('❌ Erro ao capturar desktop:', err.message)
  } finally {
    await desktopPage.close()
  }

  // Mobile (375x667 - iPhone SE)
  console.log('\n📱 Capturando screenshots MOBILE...')
  const mobilePage = await browser.newPage({ viewport: { width: 375, height: 667 } })
  
  try {
    await fazerLogin(mobilePage)
    await mobilePage.goto(`${BASE_URL}/central-importacao`)
    await mobilePage.waitForSelector('[data-testid="central-importacao"]', { timeout: 10000 })
    
    // 5. Mobile - Estado Vazio (aba Nova Importação)
    await mobilePage.screenshot({ 
      path: join(OUTPUT_DIR, '05-mobile-vazio.png'),
      fullPage: true 
    })
    console.log('✓ 05-mobile-vazio.png')
    
    // 6. Mobile - Preenchido (contexto selecionado)
    await mobilePage.click('button[role="radio"]:has-text("Extrato bancário")')
    await mobilePage.fill('input[placeholder*="Conta"]', 'Conta Mobile')
    await mobilePage.screenshot({ 
      path: join(OUTPUT_DIR, '06-mobile-preenchido.png'),
      fullPage: true 
    })
    console.log('✓ 06-mobile-preenchido.png')
    
    // 7. Mobile - Histórico vazio
    await mobilePage.click('button:has-text("Histórico")')
    await mobilePage.waitForTimeout(500)
    await mobilePage.screenshot({ 
      path: join(OUTPUT_DIR, '07-mobile-historico.png'),
      fullPage: true 
    })
    console.log('✓ 07-mobile-historico.png')
    
    // 8. Mobile - Abas visíveis
    await mobilePage.click('button:has-text("Nova Importação")')
    await mobilePage.waitForTimeout(500)
    await mobilePage.screenshot({ 
      path: join(OUTPUT_DIR, '08-mobile-abas.png'),
      fullPage: true 
    })
    console.log('✓ 08-mobile-abas.png')
    
  } catch (err) {
    console.error('❌ Erro ao capturar mobile:', err.message)
  } finally {
    await mobilePage.close()
  }

  await browser.close()
  console.log('\n✅ Screenshots salvos em:', OUTPUT_DIR)
}

// Executar
capturarScreenshots().catch(console.error)
