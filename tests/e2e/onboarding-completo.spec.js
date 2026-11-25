const { test, expect } = require('@playwright/test')

/**
 * TESTES ONBOARDING - VALIDAÇÃO FINAL
 * 
 * Configuração via variável de ambiente (segura):
 * set TEST_PASSWORD=SuaSenhaAqui
 * npm run test:e2e -- onboarding-completo.spec.js --headed
 */

test.setTimeout(90000)

const TEST_USER = {
  email: 'teste.onboarding@almeida.dev',
  senha: process.env.TEST_PASSWORD
}

// Verificar se senha foi configurada
test.beforeAll(() => {
  if (!TEST_USER.senha) {
    throw new Error(
      '❌ ERRO: Senha não configurada!\n' +
      'Configure a variável de ambiente:\n' +
      '  set TEST_PASSWORD=SuaSenhaAqui\n' +
      'Depois execute os testes novamente.'
    )
  }
  
  console.log('✅ Usando usuário:', TEST_USER.email)
  console.log('✅ Senha configurada via variável de ambiente')
})

test.describe('Onboarding - Fluxo Completo', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navegar para a página de login
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('1. Digitação do saldo NÃO deve redirecionar automaticamente', async ({ page }) => {
    // Login
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    // Aguardar onboarding carregar
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    
    // Escolher configuração manual
    await page.click('button:has-text("Configurar manualmente")')
    
    // Aguardar central de configuração
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Clicar em Saldo e Contas
    await page.click('button:has-text("Saldo e Contas")')
    
    // Aguardar tela de saldo
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    // Localizar o input de saldo
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    await expect(inputSaldo).toBeVisible()
    
    // Digitar o saldo LENTAMENTE, caractere por caractere
    // Simula digitação humana para detectar se algum evento causa navegação
    await inputSaldo.click()
    await page.keyboard.type('5', { delay: 150 })
    await page.waitForTimeout(200)
    
    // Verificar que ainda está na tela de saldo
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    await page.keyboard.type('0', { delay: 150 })
    await page.waitForTimeout(200)
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    await page.keyboard.type('0', { delay: 150 })
    await page.waitForTimeout(200)
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    await page.keyboard.type('0', { delay: 150 })
    await page.waitForTimeout(200)
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    await page.keyboard.type('0', { delay: 150 })
    await page.waitForTimeout(200)
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    await page.keyboard.type('0', { delay: 150 })
    await page.waitForTimeout(200)
    
    // Verificação final: ainda na tela de saldo
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    // Verificar valor formatado (R$ 5.000,00)
    const valorTexto = await inputSaldo.inputValue()
    expect(valorTexto).toContain('5.000,00')
    
    console.log('✅ SUCESSO: Digitação do saldo NÃO causou redirecionamento')
  })

  test('2. Apagar e redigitar saldo deve funcionar corretamente', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    
    // Digitar saldo inicial
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('300000', { delay: 100 })
    await page.waitForTimeout(500)
    
    // Verificar que ainda está na tela
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    // Apagar tudo
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.waitForTimeout(500)
    
    // Verificar que ainda está na tela
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    // Redigitar novo valor
    await page.keyboard.type('1250050', { delay: 100 })
    await page.waitForTimeout(500)
    
    // Verificar que ainda está na tela
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    const valorFinal = await inputSaldo.inputValue()
    expect(valorFinal).toContain('12.500,50')
    
    console.log('✅ SUCESSO: Apagar e redigitar funcionou corretamente')
  })

  test('3. Voltar e avançar deve preservar dados', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    
    // Digitar saldo
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('750000', { delay: 100 })
    await page.waitForTimeout(500)
    
    const valorDigitado = await inputSaldo.inputValue()
    
    // Salvar
    await page.click('button:has-text("Salvar")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Voltar para saldo
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    // Verificar que o valor foi preservado
    const valorPreservado = await inputSaldo.inputValue()
    expect(valorPreservado).toBe(valorDigitado)
    
    console.log('✅ SUCESSO: Dados preservados ao navegar')
  })

  test('4. Atualizar página durante onboarding não deve perder dados', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    
    // Digitar e salvar
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('800000', { delay: 100 })
    await page.click('button:has-text("Salvar")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Recarregar a página
    await page.reload({ waitUntil: 'networkidle' })
    
    // Deve voltar para a central de configuração (não perder o estado)
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 10000 })
    
    // Verificar que o saldo está marcado como configurado
    const badgeConfigurado = page.locator('text=✓ Configurado').first()
    await expect(badgeConfigurado).toBeVisible()
    
    console.log('✅ SUCESSO: Estado preservado após reload')
  })

  test('5. Concluir onboarding só deve acontecer com ação explícita', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Configurar saldo
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('500000', { delay: 100 })
    await page.click('button:has-text("Salvar")')
    
    // Voltar para central
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Verificar que ainda está no onboarding (NÃO foi para Home automaticamente)
    await expect(page.locator('h2:has-text("Configure suas finanças")')).toBeVisible()
    
    // Clicar explicitamente em "Concluir configuração"
    await page.click('button:has-text("Concluir configuração")')
    
    // Aguardar tela de conclusão
    await page.waitForSelector('h1:has-text("Tudo pronto")', { timeout: 5000 })
    
    // Clicar em "Ir para minha Home"
    await page.click('button:has-text("Ir para minha Home")')
    
    // Agora sim deve ir para a Home
    await page.waitForSelector('text=Olá', { timeout: 10000 })
    
    console.log('✅ SUCESSO: Onboarding só concluiu com ação explícita')
  })

  test('6. Testar em resolução mobile', async ({ page }) => {
    // Simular dispositivo móvel
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    
    // Digitar no mobile
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('250000', { delay: 150 })
    await page.waitForTimeout(500)
    
    // Verificar que ainda está na tela
    await expect(page.locator('h2:has-text("Saldo e Contas")')).toBeVisible()
    
    const valor = await inputSaldo.inputValue()
    expect(valor).toContain('2.500,00')
    
    console.log('✅ SUCESSO: Funciona corretamente em mobile')
  })

  test('7. Zerar dados e recomeçar onboarding', async ({ page }) => {
    // Este teste valida que após zerar os dados, o onboarding inicia corretamente
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForLoadState('networkidle')
    
    // Se já passou do onboarding, acessar configurações
    const temHome = await page.locator('text=Olá').isVisible().catch(() => false)
    
    if (temHome) {
      // Ir para Mais > Configurações
      await page.click('[data-menu="mais"]')
      await page.waitForTimeout(500)
      await page.click('text=Configurações')
      await page.waitForTimeout(1000)
      
      // Procurar opção de reiniciar onboarding ou zerar dados
      const temReiniciar = await page.locator('text=Reiniciar configuração').isVisible().catch(() => false)
      
      if (temReiniciar) {
        await page.click('text=Reiniciar configuração')
        await page.waitForTimeout(500)
        
        // Confirmar
        const temConfirmar = await page.locator('button:has-text("Confirmar")').isVisible().catch(() => false)
        if (temConfirmar) {
          await page.click('button:has-text("Confirmar")')
        }
        
        // Deve voltar para o onboarding
        await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
        
        console.log('✅ SUCESSO: Onboarding reiniciado corretamente')
      }
    }
  })
})

test.describe('Onboarding - Validações de Persistência', () => {
  
  test('8. Dados salvos devem aparecer no resumo final', async ({ page }) => {
    await page.fill('input[type="email"]', TEST_USER.email)
    await page.fill('input[type="password"]', TEST_USER.senha)
    await page.click('button:has-text("Entrar")')
    
    await page.waitForSelector('h1:has-text("Vamos organizar")', { timeout: 10000 })
    await page.click('button:has-text("Configurar manualmente")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Configurar saldo
    await page.click('button:has-text("Saldo e Contas")')
    await page.waitForSelector('h2:has-text("Saldo e Contas")', { timeout: 5000 })
    
    const inputSaldo = page.locator('input[inputMode="numeric"]').first()
    await inputSaldo.click()
    await inputSaldo.fill('')
    await page.keyboard.type('1000000', { delay: 100 })
    
    const valorDigitado = await inputSaldo.inputValue()
    
    await page.click('button:has-text("Salvar")')
    await page.waitForSelector('h2:has-text("Configure suas finanças")', { timeout: 5000 })
    
    // Concluir
    await page.click('button:has-text("Concluir configuração")')
    await page.waitForSelector('h1:has-text("Tudo pronto")', { timeout: 5000 })
    
    // Verificar que o saldo aparece no resumo
    const resumo = page.locator('text=Saldo disponível').locator('..')
    await expect(resumo).toBeVisible()
    
    // Verificar valor (R$ 10.000,00)
    const valorResumo = await resumo.textContent()
    expect(valorResumo).toContain('10.000,00')
    
    console.log('✅ SUCESSO: Dados aparecem no resumo final')
  })
})
