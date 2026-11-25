/**
 * TESTE: Acesso ao aplicativo
 */

import { chromium } from 'playwright'

const TEST_USER = {
  email: 'teste.onboarding@almeida.dev',
  senha: 'Teste123!@#'
}

async function testarAcesso() {
  console.log('🧪 TESTE: Acesso ao aplicativo após correção')
  console.log('═'.repeat(70))
  
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(30000)
  
  const errors = []
  page.on('pageerror', err => {
    errors.push(err.message)
    console.log('❌ Erro:', err.message)
  })
  
  try {
    console.log('1. Acessando localhost:5173...')
    await page.goto('http://localhost:5173/')
    await page.waitForTimeout(2000)
    
    const temErro = await page.locator('text=Algo deu errado').isVisible().catch(() => false)
    
    if (temErro) {
      console.log('❌ Tela de erro apareceu!')
      await page.screenshot({ path: 'erro.png' })
      console.log('   Screenshot: erro.png')
      await browser.close()
      return { sucesso: false, motivo: 'Tela de erro' }
    }
    
    console.log('✅ Sem erro na tela inicial')
    
    console.log('2. Fazendo login...')
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForTimeout(3000)
    
    const temErroLogin = await page.locator('text=Algo deu errado').isVisible().catch(() => false)
    
    if (temErroLogin) {
      console.log('❌ Erro após login!')
      await page.screenshot({ path: 'erro-login.png' })
      await browser.close()
      return { sucesso: false, motivo: 'Erro após login' }
    }
    
    console.log('✅ Login sem erro')
    
    const temOnboarding = await page.locator('h1').first().textContent().catch(() => '')
    console.log('3. Primeira heading:', temOnboarding.substring(0, 50))
    
    await browser.close()
    
    if (errors.length > 0) {
      return { sucesso: false, motivo: 'Erros no console', errors }
    }
    
    return { sucesso: true }
    
  } catch (err) {
    console.log('❌ Exception:', err.message)
    await browser.close()
    return { sucesso: false, motivo: err.message }
  }
}

testarAcesso().then(result => {
  console.log('═'.repeat(70))
  if (result.sucesso) {
    console.log('✅ TESTE PASSOU')
  } else {
    console.log('❌ TESTE FALHOU:', result.motivo)
    if (result.errors) {
      result.errors.forEach(e => console.log('   -', e))
    }
  }
  console.log('═'.repeat(70))
  process.exit(result.sucesso ? 0 : 1)
})
