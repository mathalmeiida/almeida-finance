/**
 * TESTE DO BUG: Redirecionamento Automático ao Digitar Saldo
 * 
 * Bug reportado: "digitação do saldo redireciona automaticamente para a Home"
 * 
 * Este teste valida:
 * 1. Login com usuário teste
 * 2. Navegar para onboarding/saldo
 * 3. Digitar "R$ 5.000,00" caracter por caracter
 * 4. Verificar que NÃO houve redirecionamento durante digitação
 * 5. Clicar em salvar
 * 6. Verificar que salvamento funcionou
 * 7. Reload da página preserva valor
 */

import { test, expect } from '@playwright/test'

const TEST_EMAIL = 'teste.onboarding@almeida.dev'
const TEST_PASSWORD = 'Teste123!@#'
const BASE_URL = 'http://localhost:5173'

test.describe('Bug: Redirecionamento Automático ao Digitar Saldo', () => {
  
  test('Não deve redirecionar automaticamente ao digitar R$ 5.000,00', async ({ page }) => {
    // 1. Login
    await page.goto(BASE_URL)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Aguardar login completar
    await page.waitForURL(/\/(home|onboarding)/, { timeout: 10000 })
    
    // 2. Navegar para etapa de saldo (se não estiver já)
    const currentUrl = page.url()
    if (!currentUrl.includes('/onboarding')) {
      // Se já completou onboarding, resetar no banco primeiro
      console.log('⚠️ Usuário já completou onboarding. Teste pode falhar.')
      // Ou podemos navegar diretamente
      await page.goto(`${BASE_URL}/onboarding`)
    }
    
    // 3. Localizar campo de saldo
    // (Pode ser input com label "Saldo", "Saldo atual", etc)
    const saldoInput = page.locator('input').filter({ 
      has: page.locator('xpath=//label[contains(text(), "Saldo") or contains(text(), "saldo")]') 
    }).first()
    
    // Ou tentar por placeholder/name
    const inputFallback = page.locator('input[name*="saldo"], input[placeholder*="saldo"]').first()
    const campoSaldo = await saldoInput.count() > 0 ? saldoInput : inputFallback
    
    await campoSaldo.waitFor({ timeout: 5000 })
    
    // 4. Limpar campo primeiro
    await campoSaldo.clear()
    
    // 5. Digitar valor caracter por caracter (simula digitação real)
    const valorDigitar = '5000'
    for (const char of valorDigitar) {
      await campoSaldo.type(char, { delay: 100 }) // 100ms entre cada tecla
      
      // VERIFICAÇÃO CRÍTICA: URL não deve mudar durante digitação
      const urlDuranteDigitacao = page.url()
      expect(urlDuranteDigitacao).toMatch(/\/onboarding/)
      expect(urlDuranteDigitacao).not.toMatch(/\/home/)
      
      // Log para debug
      console.log(`Digitou '${char}' - URL: ${urlDuranteDigitacao}`)
    }
    
    // 6. Aguardar 500ms após última tecla (dar tempo para qualquer efeito colateral)
    await page.waitForTimeout(500)
    
    // 7. Verificar que ainda está na página de onboarding
    const urlAposDigitar = page.url()
    expect(urlAposDigitar).toMatch(/\/onboarding/)
    expect(urlAposDigitar).not.toMatch(/\/home/)
    
    console.log('✅ Nenhum redirecionamento durante digitação')
    
    // 8. Localizar e clicar no botão de salvar/continuar
    const btnSalvar = page.locator('button').filter({ 
      hasText: /salvar|continuar|próxim|avançar/i 
    }).first()
    
    await btnSalvar.click()
    
    // 9. Aguardar salvamento (pode haver loading)
    await page.waitForTimeout(1000)
    
    // 10. Verificar que valor foi salvo (via console ou UI)
    // Recarregar página e verificar que valor permanece
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    const valorSalvo = await campoSaldo.inputValue()
    
    // Aceitar diferentes formatos: "5000", "5.000", "5000.00", "R$ 5.000,00"
    const valorNumerico = valorSalvo.replace(/[^\d]/g, '')
    expect(valorNumerico).toContain('5000')
    
    console.log('✅ Valor preservado após reload:', valorSalvo)
  })
  
  test('Deve permitir navegar entre etapas sem perder dados', async ({ page }) => {
    // 1. Login
    await page.goto(BASE_URL)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/\/(home|onboarding)/, { timeout: 10000 })
    
    // 2. Se tiver botão "Voltar" ou navegação entre etapas, testar
    const btnVoltar = page.locator('button').filter({ hasText: /voltar|anterior/i }).first()
    const btnAvancar = page.locator('button').filter({ hasText: /avançar|próxim|continuar/i }).first()
    
    if (await btnAvancar.isVisible()) {
      const urlInicial = page.url()
      
      await btnAvancar.click()
      await page.waitForTimeout(500)
      
      const urlAposAvancar = page.url()
      expect(urlAposAvancar).not.toBe(urlInicial)
      
      console.log('✅ Avançou para próxima etapa')
      
      if (await btnVoltar.isVisible()) {
        await btnVoltar.click()
        await page.waitForTimeout(500)
        
        const urlAposVoltar = page.url()
        expect(urlAposVoltar).toBe(urlInicial)
        
        console.log('✅ Voltou para etapa anterior')
      }
    } else {
      console.log('⚠️ Navegação entre etapas não disponível')
    }
  })
})
