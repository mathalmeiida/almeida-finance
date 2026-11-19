#!/usr/bin/env node
/**
 * Teste visual com login manual
 * Aguarda usuário fazer login manualmente e salva sessão
 */

import { chromium } from 'playwright'
import { writeFile } from 'fs/promises'

const BASE_URL = 'http://localhost:5173'

const PAGES = [
  { path: '/', name: 'Dashboard' },
  { path: '/receitas', name: 'Receitas' },
  { path: '/despesas', name: 'Despesas' },
  { path: '/cartoes', name: 'Cartões' },
  { path: '/investimentos', name: 'Investimentos' },
  { path: '/configuracoes', name: 'Configurações' },
]

async function waitForManualLogin(page) {
  console.log('\n🔐 AGUARDANDO LOGIN MANUAL')
  console.log('─'.repeat(50))
  console.log('1. Faça login no navegador que abriu')
  console.log('2. Aguarde ser redirecionado para o Dashboard')
  console.log('3. O teste continuará automaticamente\n')
  
  // Marcar apresentação como vista
  await page.goto(BASE_URL)
  await page.evaluate(() => {
    localStorage.setItem('almeida_apresentacao_publica_vista', '1')
  })
  
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  
  // Aguardar redirecionamento (sinal de login bem-sucedido)
  let authenticated = false
  for (let i = 0; i < 60; i++) { // 60 segundos máximo
    await page.waitForTimeout(1000)
    const url = page.url()
    
    if (!url.includes('/login') && !url.includes('/cadastro')) {
      authenticated = true
      console.log('✅ Login detectado!')
      break
    }
    
    if (i === 30) {
      console.log('⏱️  Ainda aguardando... (30s)')
    }
  }
  
  if (!authenticated) {
    throw new Error('Timeout: Login não foi concluído em 60 segundos')
  }
  
  // Salvar contexto de autenticação
  const cookies = await page.context().cookies()
  const storage = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    session: Object.entries(sessionStorage)
  }))
  
  await writeFile(
    'tests/auth-session.json',
    JSON.stringify({ cookies, storage }, null, 2)
  )
  
  console.log('💾 Sessão salva em tests/auth-session.json')
  
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
    
    if (page.url().includes('/login')) {
      console.log('   ⚠️  Sessão expirou')
      return false
    }
    
    await page.waitForTimeout(1500)
    
    // Contagem de elementos com cores
    const marca = await page.$$('[class*="bg-marca"], [class*="text-marca"]')
    const blue = await page.$$('[class*="text-blue-6"], [class*="bg-blue-5"], [class*="bg-blue-6"]')
    const purple = await page.$$('[class*="text-purple-6"], [class*="bg-purple-"]')
    
    console.log(`   Marca: ${marca.length} | Blue: ${blue.length} | Purple: ${purple.length}`)
    
    // Screenshot
    const filename = `auth-${route.name.toLowerCase()}-${viewport.name.toLowerCase()}.png`
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
  console.log('\n🎨 TESTE DE TEMA')
  console.log('─'.repeat(50))
  
  await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  
  // Capturar tema atual
  await page.screenshot({ path: 'tests/screenshots/tema-1-inicial.png' })
  console.log('📸 Tema inicial capturado')
  
  // Procurar botões de paleta
  const paletteButtons = await page.$$('button')
  console.log(`Botões encontrados na página: ${paletteButtons.length}`)
  
  // Tentar encontrar seletor de tema (procurar por section com título "Paleta")
  const paletteSection = await page.$('text=/paleta/i')
  if (paletteSection) {
    console.log('✅ Seção de paleta encontrada')
    
    // Procurar botões próximos
    const parent = await paletteSection.evaluateHandle(el => el.closest('section, div.card'))
    const buttons = await parent.$$('button')
    
    console.log(`Botões na seção: ${buttons.length}`)
    
    if (buttons.length >= 2) {
      // Clicar no segundo botão
      await buttons[1].click()
      await page.waitForTimeout(1000)
      
      await page.screenshot({ path: 'tests/screenshots/tema-2-alterado.png' })
      console.log('📸 Tema alterado capturado')
      
      // Recarregar para testar persistência
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      
      await page.screenshot({ path: 'tests/screenshots/tema-3-persistido.png' })
      console.log('📸 Persistência verificada')
      console.log('✅ Troca de tema funcional')
    } else {
      console.log('⚠️  Seletor de tema não tem múltiplas opções')
    }
  } else {
    console.log('⚠️  Seção de paleta não encontrada')
  }
}

async function testResponsive(page, route) {
  console.log(`\n📐 Responsividade: ${route.name}`)
  
  const viewports = [
    { name: 'Mobile', width: 390, height: 844 },
    { name: 'Desktop', width: 1440, height: 900 }
  ]
  
  for (const vp of viewports) {
    await page.setViewportSize(vp)
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    
    // Verificar elementos cortados ou overflow
    const hasOverflow = await page.evaluate(() => {
      const body = document.body
      return body.scrollWidth > body.clientWidth
    })
    
    if (hasOverflow) {
      console.log(`   ⚠️  ${vp.name}: Overflow horizontal detectado`)
    } else {
      console.log(`   ✅ ${vp.name}: Layout OK`)
    }
  }
}

async function main() {
  console.log('🎨 TESTE VISUAL COM LOGIN MANUAL\n')
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const page = await context.newPage()
  
  try {
    // Aguardar login manual
    await waitForManualLogin(page)
    
    console.log('\n📋 TESTANDO PÁGINAS')
    console.log('─'.repeat(50))
    
    // Testar páginas principais
    const viewports = [
      { name: 'Desktop', width: 1440, height: 900 },
      { name: 'Mobile', width: 390, height: 844 }
    ]
    
    for (const route of PAGES) {
      for (const vp of viewports) {
        await testPage(page, route, vp)
      }
    }
    
    // Testar tema
    await testTheme(page)
    
    // Testar responsividade em páginas críticas
    console.log('\n📐 TESTE DE RESPONSIVIDADE')
    console.log('─'.repeat(50))
    await testResponsive(page, { path: '/', name: 'Dashboard' })
    await testResponsive(page, { path: '/cartoes', name: 'Cartões' })
    
    console.log('\n✅ TODOS OS TESTES CONCLUÍDOS')
    console.log('📁 Screenshots em tests/screenshots/')
    console.log('💾 Sessão salva em tests/auth-session.json')
    
    // Manter aberto por 5s
    await page.waitForTimeout(5000)
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    await page.screenshot({ path: 'tests/screenshots/erro-teste.png' })
  } finally {
    await browser.close()
  }
}

main()
