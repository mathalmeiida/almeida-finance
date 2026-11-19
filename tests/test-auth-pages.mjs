#!/usr/bin/env node
/**
 * Teste visual das páginas autenticadas
 * Cria uma sessão de teste e valida as páginas principais
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'
const TEST_EMAIL = 'e2e.test@almeidafinance.local'
const TEST_PASSWORD = 'TestE2E2024!Secure'

const PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/receitas', name: 'Receitas' },
  { path: '/despesas', name: 'Despesas' },
  { path: '/cartoes', name: 'Cartões' },
  { path: '/investimentos', name: 'Investimentos' },
  { path: '/configuracoes', name: 'Configurações' },
]

async function login(page) {
  console.log('\n🔐 Fazendo login...')
  
  // Marcar apresentação como vista
  await page.goto(BASE_URL)
  await page.evaluate(() => {
    localStorage.setItem('almeida_apresentacao_publica_vista', '1')
  })
  
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  
  // Verificar se formulário está presente
  const emailInput = await page.$('input[name="email"]')
  if (!emailInput) {
    throw new Error('Formulário de login não encontrado')
  }
  
  await page.fill('input[name="email"]', TEST_EMAIL)
  await page.fill('input[name="senha"]', TEST_PASSWORD)
  
  await page.screenshot({ path: 'tests/screenshots/login-antes.png' })
  
  await page.click('button[type="submit"]')
  
  // Aguardar navegação ou erro
  await page.waitForTimeout(3000)
  
  const currentUrl = page.url()
  console.log(`   URL atual: ${currentUrl}`)
  
  // Se ficou em /login, houve erro
  if (currentUrl.includes('/login')) {
    const errorMsg = await page.$('.text-red-700, .text-red-600')
    if (errorMsg) {
      const text = await errorMsg.textContent()
      throw new Error(`Erro de login: ${text}`)
    }
    throw new Error('Login falhou (permaneceu em /login)')
  }
  
  // Se caiu no onboarding, pular
  if (currentUrl.includes('/onboarding') || currentUrl.includes('/apresentacao')) {
    console.log('   ⏩ Pulando onboarding...')
    await page.evaluate(() => {
      localStorage.setItem('almeida_configurando_onboarding', '1')
    })
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
  }
  
  console.log('   ✅ Login OK')
  await page.screenshot({ path: 'tests/screenshots/login-sucesso.png' })
  
  return true
}

async function testPage(page, route, viewport) {
  console.log(`\n📱 ${viewport.name} | ${route.name}`)
  
  await page.setViewportSize(viewport)
  
  try {
    await page.goto(`${BASE_URL}${route.path}`, { 
      waitUntil: 'networkidle',
      timeout: 15000 
    })
    
    // Se redirecionou para login, sessão expirou
    if (page.url().includes('/login')) {
      console.log('   ⚠️  Sessão expirou')
      return false
    }
    
    await page.waitForTimeout(1000)
    
    // Verificar cores
    const marcaEls = await page.$$('[class*="bg-marca"], [class*="text-marca"]')
    const blueEls = await page.$$('[class*="text-blue-6"], [class*="bg-blue-"]')
    const purpleEls = await page.$$('[class*="text-purple-"], [class*="bg-purple-"]')
    
    console.log(`   Marca: ${marcaEls.length} | Blue: ${blueEls.length} | Purple: ${purpleEls.length}`)
    
    // Screenshot
    const filename = `${route.name.toLowerCase().replace(/\s+/g, '-')}-${viewport.name.toLowerCase()}.png`
    await page.screenshot({ 
      path: `tests/screenshots/${filename}`,
      fullPage: false
    })
    console.log(`   📸 ${filename}`)
    
    return true
    
  } catch (error) {
    console.log(`   ❌ ${error.message}`)
    return false
  }
}

async function testTheme(page) {
  console.log('\n🎨 Testando seletor de tema...')
  
  await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  
  // Procurar seletores de paleta
  const paletteSections = await page.$$('button[class*="rounded"]')
  console.log(`   Botões encontrados: ${paletteSections.length}`)
  
  // Capturar estado inicial
  await page.screenshot({ path: 'tests/screenshots/config-tema-1.png' })
  
  // Tentar clicar no segundo botão de paleta se houver
  if (paletteSections.length >= 2) {
    await paletteSections[1].click()
    await page.waitForTimeout(1000)
    
    await page.screenshot({ path: 'tests/screenshots/config-tema-2.png' })
    console.log('   ✅ Tema alternado')
    
    // Recarregar página para testar persistência
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    await page.screenshot({ path: 'tests/screenshots/config-tema-persistido.png' })
    console.log('   ✅ Persistência testada')
  }
}

async function main() {
  console.log('🎨 TESTE DE PÁGINAS AUTENTICADAS')
  
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  
  const viewports = [
    { name: 'Desktop', width: 1440, height: 900 },
    { name: 'Mobile', width: 390, height: 844 },
  ]
  
  try {
    // Login
    const loggedIn = await login(page)
    if (!loggedIn) {
      throw new Error('Login falhou')
    }
    
    // Testar páginas em desktop e mobile
    for (const viewport of viewports) {
      for (const route of PAGES) {
        const success = await testPage(page, route, viewport)
        if (!success && route.path === '/') {
          throw new Error('Dashboard não carregou - sessão inválida')
        }
      }
    }
    
    // Testar seletor de tema
    await testTheme(page)
    
    console.log('\n✅ TESTES CONCLUÍDOS')
    console.log('📁 Screenshots em tests/screenshots/')
    
    // Manter navegador aberto por 10s para inspeção
    await page.waitForTimeout(10000)
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    await page.screenshot({ path: 'tests/screenshots/erro-final.png' })
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
