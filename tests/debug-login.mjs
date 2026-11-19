#!/usr/bin/env node
import { chromium } from 'playwright'

const BASE_URL = 'http://localhost:5173'

async function debugLogin() {
  console.log('🔍 Diagnosticando página de login...\n')
  
  const browser = await chromium.launch({ headless: false, slowMo: 500 })
  const context = await browser.newContext({ 
    viewport: { width: 1440, height: 900 },
    // Limpar cookies e storage
    storageState: undefined
  })
  const page = await context.newPage()
  
  // Limpar qualquer estado anterior
  await page.goto(BASE_URL)
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  
  try {
    console.log('1. Navegando para /login...')
    
    // Primeiro, marcar apresentação como vista para não redirecionar
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('almeida_apresentacao_vista', '1')
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
    
    console.log('2. Aguardando carregamento...')
    await page.waitForTimeout(2000)
    
    console.log('3. Capturando estrutura da página...')
    
    // Verificar se há formulário
    const forms = await page.$$('form')
    console.log(`   Formulários encontrados: ${forms.length}`)
    
    // Verificar inputs
    const inputs = await page.$$('input')
    console.log(`   Inputs encontrados: ${inputs.length}`)
    
    for (let i = 0; i < inputs.length; i++) {
      const type = await inputs[i].getAttribute('type')
      const name = await inputs[i].getAttribute('name')
      const placeholder = await inputs[i].getAttribute('placeholder')
      console.log(`   Input ${i}: type="${type}", name="${name}", placeholder="${placeholder}"`)
    }
    
    // Verificar botões
    const buttons = await page.$$('button')
    console.log(`   Botões encontrados: ${buttons.length}`)
    
    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
      const text = await buttons[i].textContent()
      const type = await buttons[i].getAttribute('type')
      console.log(`   Botão ${i}: text="${text?.trim()}", type="${type}"`)
    }
    
    console.log('\n4. Tentando preencher formulário...')
    
    // Tentar múltiplos seletores
    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="mail" i]',
      'input[placeholder*="e-mail" i]'
    ]
    
    let emailFilled = false
    for (const selector of emailSelectors) {
      try {
        await page.fill(selector, 'e2e.test@almeidafinance.local', { timeout: 2000 })
        console.log(`   ✅ Email preenchido com: ${selector}`)
        emailFilled = true
        break
      } catch (e) {
        console.log(`   ❌ Falhou: ${selector}`)
      }
    }
    
    const senhaSelectors = [
      'input[name="senha"]',
      'input[type="password"]',
      'input[placeholder*="senha" i]'
    ]
    
    let senhaFilled = false
    for (const selector of senhaSelectors) {
      try {
        await page.fill(selector, 'TestE2E2024!Secure', { timeout: 2000 })
        console.log(`   ✅ Senha preenchida com: ${selector}`)
        senhaFilled = true
        break
      } catch (e) {
        console.log(`   ❌ Falhou: ${selector}`)
      }
    }
    
    if (emailFilled && senhaFilled) {
      console.log('\n5. Tentando submeter formulário...')
      await page.screenshot({ path: 'tests/screenshots/debug-antes-submit.png' })
      
      const submitButton = await page.$('button[type="submit"]') || await page.$('button:has-text("Entrar")')
      if (submitButton) {
        await submitButton.click()
        console.log('   ✅ Clicou em submeter')
        
        await page.waitForTimeout(3000)
        console.log(`   URL após submit: ${page.url()}`)
        
        await page.screenshot({ path: 'tests/screenshots/debug-apos-submit.png' })
      }
    }
    
    console.log('\n✅ Diagnóstico concluído. Navegador permanecerá aberto por 30s para inspeção.')
    await page.waitForTimeout(30000)
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    await page.screenshot({ path: 'tests/screenshots/debug-erro.png' })
  } finally {
    await browser.close()
  }
}

debugLogin()
