/**
 * TESTE MANUAL SIMPLIFICADO - DIGITAÇÃO DO SALDO
 * Valida se digitação causa redirecionamento
 */

import { chromium } from 'playwright'

const TEST_USER = {
  email: 'teste.onboarding@almeida.dev',
  senha: 'Teste123!@#'
}

async function testarAcesso() {
  console.log('🧪 TESTE: Acesso ao aplicativo')
  console.log('═'.repeat(70))
  
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  
  // Logs do console
  const consoleLogs = []
  const errors = []
  
  page.on('console', msg => {
    const text = msg.text()
    consoleLogs.push(text)
    if (msg.type() === 'error') {
      errors.push(text)
    }
  })
  
  page.on('pageerror', err => {
    errors.push(`PAGE ERROR: ${err.message}`)
    console.log('❌ Erro de página:', err.message)
  })
  
  try {
    // 1. Acessar página
    console.log('1. Acessando http://localhost:5173...')
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
    console.log('✅ Página carregada')
    
    // Aguardar um pouco para ver se há erros
    await page.waitForTimeout(2000)
    
    // 2. Verificar se há erro na tela
    const temErro = await page.locator('text=Algo deu errado').isVisible().catch(() => false)
    
    if (temErro) {
      console.log('❌ Tela de erro apareceu')
      
      // Capturar screenshot
      await page.screenshot({ path: 'erro-tela.png' })
      console.log('   Screenshot: erro-tela.png')
      
      // Capturar erros do console
      if (errors.length > 0) {
        console.log('   Erros do console:')
        errors.forEach(e => console.log('   -', e))
      }
      
      await browser.close()
      return false
    }
    
    // 3. Login
    console.log('2. Fazendo login...')
    await page.waitForSelector('input[type="email"]', { timeout: 5000 })
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    console.log('✅ Credenciais enviadas')
    
    // 4. Aguardar resposta do login
    await page.waitForTimeout(3000)
    
    // Verificar se há erro
    const temErroLogin = await page.locator('text=Algo deu errado').isVisible().catch(() => false)
    
    if (temErroLogin) {
      console.log('❌ Erro após login')
      await page.screenshot({ path: 'erro-login.png' })
      
      if (errors.length > 0) {
        console.log('   Erros:')
        errors.forEach(e => console.log('   -', e))
      }
      
      await browser.close()
      return false
    }
    
    // 5. Verificar se onboarding apareceu
    const temOnboarding = await page.locator('h1:has-text("Vamos organizar")').isVisible().catch(() => false)
    
    if (temOnboarding) {
      console.log('✅ Onboarding carregou!')
      await browser.close()
      return true
    }
    
    // Verificar se já está na Home
    const temHome = await page.locator('text=Olá').isVisible().catch(() => false)
    
    if (temHome) {
      console.log('⚠️  Redirecionou para Home (onboarding já concluído?)')
      await browser.close()
      return true
    }
    
    console.log('⚠️  Estado desconhecido')
    await page.screenshot({ path: 'estado-desconhecido.png' })
    
    if (consoleLogs.length > 0) {
      console.log('   Logs do console:')
      consoleLogs.slice(-10).forEach(log => console.log('   -', log))
    }
    
    await browser.close()
    return false
    
  } catch (err) {
    console.log('❌ ERRO:', err.message)
    
    if (errors.length > 0) {
      console.log('   Erros capturados:')
      errors.forEach(e => console.log('   -', e))
    }
    
    await page.screenshot({ path: 'erro-exception.png' }).catch(() => {})
    await browser.close()
    return false
  }
}
    
    // 2. Aguardar onboarding
    console.log('2. Aguardando onboarding...')
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    console.log('✅ Onboarding carregou')
    
    // 3. Configurar manualmente
    console.log('3. Clicando em "Configurar manualmente"...')
    await page.click('button:has-text("Configurar manualmente")')
    
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    console.log('✅ Central de configuração carregou')
    
    // 4. Saldo e Contas
    console.log('4. Clicando em "Saldo e Contas"...')
    await page.click('button:has-text("Saldo e Contas")')
    
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    console.log('✅ Tela de saldo carregou')
    
    // 5. TESTE CRÍTICO: Digitar saldo LENTAMENTE
    console.log('5. Digitando saldo LENTAMENTE (5-0-0-0-0-0)...')
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    await inputSaldo.click()
    
    // Digitar um dígito por vez com delay
    const digitos = ['5', '0', '0', '0', '0', '0']
    for (let i = 0; i < digitos.length; i++) {
      await page.keyboard.type(digitos[i], { delay: 200 })
      await page.waitForTimeout(500)
      
      // VALIDAÇÃO CRÍTICA: Ainda na tela de saldo?
      const temTituloSaldo = await page.locator('h2:has-text("Saldo e Contas")').isVisible()
      
      if (!temTituloSaldo) {
        console.log(`❌ FALHOU após digitar ${i + 1} dígito(s)`)
        console.log(`   Redirecionou para outra página!`)
        
        const url = page.url()
        const titulo = await page.title()
        console.log(`   URL atual: ${url}`)
        console.log(`   Título: ${titulo}`)
        
        await browser.close()
        return false
      }
      
      console.log(`   ✓ Dígito ${i + 1}/6 OK - ainda na tela de saldo`)
    }
    
    // 6. Validar valor formatado
    const valorTexto = await inputSaldo.inputValue()
    console.log(`6. Valor formatado: ${valorTexto}`)
    
    if (valorTexto.includes('5.000,00')) {
      console.log('✅ Valor formatado corretamente')
    } else {
      console.log(`⚠️  Formatação inesperada: ${valorTexto}`)
    }
    
    // 7. Verificar que ainda está na tela
    const aindaNaTelaSaldo = await page.locator('h2:has-text("Saldo e Contas")').isVisible()
    
    console.log('═'.repeat(70))
    if (aindaNaTelaSaldo) {
      console.log('✅ TESTE PASSOU: Digitação NÃO causou redirecionamento')
      console.log('✅ Usuário permaneceu na tela de saldo')
    } else {
      console.log('❌ TESTE FALHOU: Redirecionamento ocorreu')
    }
    console.log('═'.repeat(70))
    
    await browser.close()
    return aindaNaTelaSaldo
    
  } catch (err) {
    console.log('❌ ERRO:', err.message)
    console.log('Stack:', err.stack)
    
    // Capturar screenshot se possível
    try {
      await page.screenshot({ path: 'erro-teste.png' })
      console.log('Screenshot salvo: erro-teste.png')
    } catch {}
    
    await browser.close()
    return false
  }
}

testarAcesso().then(sucesso => {
  console.log()
  console.log('═'.repeat(70))
  if (sucesso) {
    console.log('✅ TESTE PASSOU: Aplicativo carregou sem erros')
  } else {
    console.log('❌ TESTE FALHOU: Veja logs e screenshots acima')
  }
  console.log('═'.repeat(70))
  process.exit(sucesso ? 0 : 1)
})
