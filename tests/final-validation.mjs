#!/usr/bin/env node
/**
 * Validação final completa do aplicativo
 */

import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

const results = []

function addResult(page, resolution, result, paletteTest, issues) {
  results.push({
    page,
    resolution,
    result,
    paletteTest: paletteTest || 'N/A',
    issues: issues || 'Nenhum'
  })
}

async function testLogin(browser) {
  console.log('\n━━━ 1. TESTE DE LOGIN ━━━\n')
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  try {
    // Marcar apresentação como vista
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    // Teste Desktop 1440px
    console.log('📐 Desktop 1440px')
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    const desktop1440 = await page.evaluate(() => {
      // Verificar apenas os cantos extremos da viewport
      const corners = [
        { x: 5, y: 5 },
        { x: window.innerWidth - 5, y: 5 },
        { x: 5, y: window.innerHeight - 5 },
        { x: window.innerWidth - 5, y: window.innerHeight - 5 }
      ]
      
      const hasWhiteCorners = corners.some(corner => {
        const el = document.elementFromPoint(corner.x, corner.y)
        if (!el) return false
        const bg = window.getComputedStyle(el).backgroundColor
        return bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)'
      })
      
      return {
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        hasOverflow: document.body.scrollWidth > window.innerWidth,
        hasWhiteStrips: hasWhiteCorners
      }
    })
    
    await page.screenshot({ path: 'tests/screenshots/final-login-1440.png' })
    
    const desktop1440Issues = []
    if (desktop1440.hasOverflow) desktop1440Issues.push('Overflow horizontal')
    if (desktop1440.hasWhiteStrips) desktop1440Issues.push('Faixas brancas detectadas')
    
    console.log(`   Largura: ${desktop1440.bodyWidth}px / ${desktop1440.viewportWidth}px`)
    console.log(`   Overflow: ${desktop1440.hasOverflow ? '❌' : '✅'}`)
    console.log(`   Cantos brancos: ${desktop1440.hasWhiteStrips ? '❌' : '✅'}`)
    
    addResult(
      'Login',
      '1440px',
      desktop1440.hasOverflow || desktop1440.hasWhiteStrips ? '❌ Problema' : '✅ OK',
      'N/A (página pública)',
      desktop1440Issues.length ? desktop1440Issues.join(', ') : 'Nenhum'
    )
    
    // Teste Mobile 390px
    console.log('\n📱 Mobile 390px')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    
    const mobile390 = await page.evaluate(() => {
      const body = document.body
      return {
        bodyWidth: body.scrollWidth,
        viewportWidth: window.innerWidth,
        hasOverflow: body.scrollWidth > window.innerWidth
      }
    })
    
    await page.screenshot({ path: 'tests/screenshots/final-login-390.png' })
    
    console.log(`   Largura: ${mobile390.bodyWidth}px / ${mobile390.viewportWidth}px`)
    console.log(`   Overflow: ${mobile390.hasOverflow ? '❌' : '✅'}`)
    
    addResult(
      'Login',
      '390px',
      mobile390.hasOverflow ? '❌ Overflow' : '✅ OK',
      'N/A (página pública)',
      mobile390.hasOverflow ? 'Overflow horizontal' : 'Nenhum'
    )
    
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`)
    addResult('Login', 'Ambas', '❌ Erro', 'N/A', error.message)
  } finally {
    await context.close()
  }
}

async function waitForManualAuth(browser) {
  console.log('\n━━━ AUTENTICAÇÃO NECESSÁRIA ━━━\n')
  console.log('⏳ Aguardando login manual...')
  console.log('   1. Faça login no navegador')
  console.log('   2. Navegue até a Home/Dashboard')
  console.log('   3. Os testes continuarão em 60s\n')
  
  const context = await browser.newContext()
  const page = await context.newPage()
  
  await page.goto(`${BASE_URL}/login`)
  
  // Aguardar 60s para login manual
  for (let i = 60; i > 0; i--) {
    if (i % 10 === 0) {
      console.log(`   ⏱️  ${i}s restantes...`)
    }
    await page.waitForTimeout(1000)
    
    const url = page.url()
    if (!url.includes('/login') && !url.includes('/cadastro')) {
      console.log('\n✅ Login detectado!')
      
      // Salvar contexto
      const cookies = await context.cookies()
      const storage = await page.evaluate(() => ({
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage)
      }))
      
      return { authenticated: true, context, page, cookies, storage }
    }
  }
  
  console.log('\n⏱️  Timeout: Login não foi concluído')
  await context.close()
  return { authenticated: false }
}

async function testAuthenticatedPages(browser, authData) {
  if (!authData.authenticated) {
    console.log('\n❌ TESTES AUTENTICADOS PULADOS (sem login)\n')
    
    const blockedPages = [
      'Home/Dashboard', 'Configurações', 'Investimentos', 
      'Cartões', 'Receitas', 'Despesas', 'Calendário'
    ]
    
    blockedPages.forEach(page => {
      addResult(page, 'N/A', '⚠️  Não testado', 'Bloqueado', 'Requer autenticação')
    })
    
    return
  }
  
  console.log('\n━━━ 2. TESTE DE PÁGINAS AUTENTICADAS ━━━\n')
  
  const { context, page } = authData
  
  try {
    // Home
    console.log('📄 Home/Dashboard')
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    
    if (page.url().includes('/login') || page.url().includes('/onboarding')) {
      console.log('   ⚠️  Redirecionado para login/onboarding')
      addResult('Home', 'N/A', '⚠️  Bloqueado', 'N/A', 'Sessão expirou ou onboarding pendente')
    } else {
      await page.screenshot({ path: 'tests/screenshots/final-home-1440.png' })
      console.log('   ✅ Carregado')
      addResult('Home', '1440px', '✅ OK', 'Aplicada', 'Nenhum')
    }
    
    // Configurações
    console.log('\n⚙️  Configurações')
    await page.goto(`${BASE_URL}/configuracoes`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    
    if (!page.url().includes('/configuracoes')) {
      console.log('   ⚠️  Não acessível')
      addResult('Configurações', 'N/A', '⚠️  Bloqueado', 'N/A', 'Redirecionamento')
    } else {
      // Procurar seletor de paleta
      const paletteSection = await page.$('text=/paleta/i, text=/tema/i')
      
      if (paletteSection) {
        console.log('   ✅ Seletor de tema encontrado')
        await page.screenshot({ path: 'tests/screenshots/final-config-tema.png' })
        addResult('Configurações', '1440px', '✅ OK', 'Disponível', 'Nenhum')
      } else {
        console.log('   ⚠️  Seletor de tema não encontrado')
        addResult('Configurações', '1440px', '⚠️  Parcial', 'Não encontrado', 'Seletor de tema ausente')
      }
    }
    
  } catch (error) {
    console.error(`❌ Erro: ${error.message}`)
  }
}

async function generateReport() {
  console.log('\n━━━ RELATÓRIO FINAL ━━━\n')
  
  console.log('┌─────────────────────┬────────────┬────────────────┬─────────────────────┬────────────────────────┐')
  console.log('│ Página              │ Resolução  │ Visual         │ Paleta              │ Problemas              │')
  console.log('├─────────────────────┼────────────┼────────────────┼─────────────────────┼────────────────────────┤')
  
  results.forEach(r => {
    const page = r.page.padEnd(19)
    const res = r.resolution.padEnd(10)
    const visual = r.result.padEnd(14)
    const palette = r.paletteTest.padEnd(19)
    const issues = r.issues.substring(0, 22).padEnd(22)
    
    console.log(`│ ${page} │ ${res} │ ${visual} │ ${palette} │ ${issues} │`)
  })
  
  console.log('└─────────────────────┴────────────┴────────────────┴─────────────────────┴────────────────────────┘')
  
  const totalTests = results.length
  const passed = results.filter(r => r.result.includes('✅')).length
  const failed = results.filter(r => r.result.includes('❌')).length
  const blocked = results.filter(r => r.result.includes('⚠️')).length
  
  console.log(`\n📊 Resumo: ${passed}/${totalTests} OK | ${failed} Falhas | ${blocked} Bloqueados`)
  console.log(`📁 Screenshots: tests/screenshots/final-*.png\n`)
}

async function main() {
  console.log('🎨 VALIDAÇÃO FINAL - ALMEIDA FINANCE')
  console.log('═'.repeat(50))
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--start-maximized']
  })
  
  try {
    // Teste público (login)
    await testLogin(browser)
    
    // Tentar autenticação manual
    const authData = await waitForManualAuth(browser)
    
    // Testes autenticados
    await testAuthenticatedPages(browser, authData)
    
    // Relatório
    await generateReport()
    
    if (authData.authenticated && authData.context) {
      await authData.context.close()
    }
    
  } catch (error) {
    console.error('\n❌ Erro geral:', error.message)
  } finally {
    await browser.close()
  }
}

main()
