#!/usr/bin/env node
/**
 * Validação visual das páginas autenticadas
 * Faz login e testa as principais rotas do app
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'
const TEST_EMAIL = 'e2e.test@almeidafinance.local'
const TEST_PASSWORD = 'TestE2E2024!Secure'

// Páginas autenticadas principais
const AUTH_ROUTES = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/receitas', name: 'Receitas' },
  { path: '/despesas', name: 'Despesas' },
  { path: '/cartoes', name: 'Cartões' },
  { path: '/investimentos', name: 'Investimentos' },
  { path: '/configuracoes', name: 'Configurações' },
  { path: '/mais', name: 'Mais' },
]

async function login(page) {
  console.log('🔐 Fazendo login...')
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  
  await page.fill('input[name="email"]', TEST_EMAIL)
  await page.fill('input[name="senha"]', TEST_PASSWORD)
  await page.click('button:has-text("Entrar")')
  
  // Aguardar redirecionamento ou onboarding
  await page.waitForTimeout(3000)
  
  const url = page.url()
  console.log(`   Redirecionado para: ${url}`)
  
  // Se caiu no onboarding, pular para dashboard
  if (url.includes('/onboarding') || url.includes('/apresentacao')) {
    console.log('   ⏩ Pulando onboarding...')
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
  }
  
  console.log('   ✅ Login realizado\n')
}

async function validateAuthPage(page, route, viewport) {
  console.log(`📱 ${viewport.name} | ${route.name}`)
  
  await page.setViewportSize({ width: viewport.width, height: viewport.height })
  
  try {
    await page.goto(`${BASE_URL}${route.path}`, { 
      waitUntil: 'networkidle',
      timeout: 10000 
    })
    await page.waitForTimeout(1500)
    
    // Verificar se não foi redirecionado para login (sessão expirou)
    if (page.url().includes('/login')) {
      console.log('   ⚠️  Sessão expirou, fazendo login novamente')
      await login(page)
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
    }
    
    const title = await page.title()
    console.log(`   Título: ${title}`)
    
    // Verificar aplicação dos tokens
    const marcaElements = await page.$$('[class*="bg-marca"], [class*="text-marca"]')
    console.log(`   ✅ Elementos com marca: ${marcaElements.length}`)
    
    const surfaceElements = await page.$$('[class*="bg-surface"]')
    console.log(`   ✅ Elementos com surface: ${surfaceElements.length}`)
    
    // Verificar cores hardcoded problemáticas
    const hardcodedBlue = await page.$$('[class*="text-blue-"], [class*="bg-blue-"]')
    const hardcodedPurple = await page.$$('[class*="text-purple-"], [class*="bg-purple-"]')
    
    const totalHardcoded = hardcodedBlue.length + hardcodedPurple.length
    if (totalHardcoded > 0) {
      console.log(`   ⚠️  Cores hardcoded: ${totalHardcoded} (blue: ${hardcodedBlue.length}, purple: ${hardcodedPurple.length})`)
    }
    
    // Screenshot
    const filename = `auth-${route.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.name.toLowerCase()}.png`
    await page.screenshot({ 
      path: `tests/screenshots/${filename}`,
      fullPage: false // Apenas viewport visível para páginas longas
    })
    console.log(`   📸 Screenshot: ${filename}\n`)
    
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}\n`)
  }
}

async function testThemeSwitching(page) {
  console.log('🎨 Testando troca de paleta...\n')
  
  await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  
  // Procurar pelo seletor de tema (assumindo que está na página de configurações)
  const themeButtons = await page.$$('button[class*="paleta"]')
  
  if (themeButtons.length > 0) {
    console.log(`   Encontrados ${themeButtons.length} botões de paleta`)
    
    // Clicar no segundo botão (troca de tema)
    if (themeButtons[1]) {
      await themeButtons[1].click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ 
        path: 'tests/screenshots/theme-switched.png',
        fullPage: false
      })
      console.log('   ✅ Tema alternado e capturado\n')
    }
  } else {
    console.log('   ⚠️  Seletor de tema não encontrado\n')
  }
}

async function main() {
  console.log('🎨 VALIDAÇÃO VISUAL - PÁGINAS AUTENTICADAS\n')
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  // Viewports para teste
  const VIEWPORTS = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 390, height: 844 },
  ]
  
  try {
    // Fazer login uma vez
    await login(page)
    
    // Testar apenas desktop e mobile para economizar tempo
    for (const route of AUTH_ROUTES) {
      for (const viewport of VIEWPORTS) {
        await validateAuthPage(page, route, viewport)
      }
    }
    
    // Testar troca de tema
    await testThemeSwitching(page)
    
    console.log('✅ Validação visual completa!')
    console.log('📁 Screenshots em tests/screenshots/')
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
