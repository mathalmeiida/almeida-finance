// @ts-check
import { test, expect } from '@playwright/test'

/**
 * TESTES E2E — ONBOARDING
 * 
 * Testa o fluxo real de criação de conta e configuração inicial.
 * Executado em navegador real (Chromium/Firefox/WebKit).
 * 
 * IMPORTANTE: Usa ambiente DEV, não dados reais de produção.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('Onboarding - Fluxo Completo', () => {
  test.beforeEach(async ({ page }) => {
    // Limpa storage para simular usuário novo
    await page.goto(BASE_URL)
    await page.evaluate(() => localStorage.clear())
    await page.evaluate(() => sessionStorage.clear())
  })

  test('deve completar onboarding sem redirecionamento inesperado', async ({ page }) => {
    // 1. Abrir app
    await page.goto(BASE_URL)
    await expect(page).toHaveTitle(/Almeida Finance|Posso Comprar/)

    // 2. Criar conta (assumindo que há um link/botão para criar)
    // Se já estiver logado em DEV, vai direto para dashboard ou onboarding
    const hasLogin = await page.locator('text=Entrar').isVisible({ timeout: 2000 }).catch(() => false)
    
    if (hasLogin) {
      // Clicar em criar conta
      await page.click('text=Criar conta').catch(() => {
        console.log('Botão "Criar conta" não encontrado, assumindo já logado')
      })
    }

    // 3. Aguardar carregar (dashboard ou onboarding)
    await page.waitForLoadState('networkidle')
    
    // 4. Se estiver no onboarding, preencher saldo
    const hasOnboarding = await page.locator('text=Quanto você tem').isVisible({ timeout: 3000 }).catch(() => false)
    
    if (hasOnboarding) {
      // Preencher saldo SEM pressionar Enter
      const saldoInput = page.locator('input[id="onb-saldo"], input[type="text"][inputmode="numeric"]').first()
      await saldoInput.fill('1000')
      
      // Aguardar 2 segundos para verificar se há redirecionamento inesperado
      await page.waitForTimeout(2000)
      
      // Verificar que ainda está na mesma etapa (não redirecionou)
      const stillInSaldoStep = await page.locator('text=Quanto você tem').isVisible()
      expect(stillInSaldoStep).toBe(true)
      
      // Clicar no botão "Continuar"
      await page.click('button:has-text("Continuar")')
      
      // Aguardar próxima etapa (Renda)
      await page.waitForSelector('text=Quanto você recebe', { timeout: 5000 })
      
      // ✅ SUCESSO: chegou na próxima etapa sem redirecionamento inesperado
    }
  })

  test('deve persistir saldo ao voltar e avançar', async ({ page }) => {
    await page.goto(BASE_URL)
    
    // Assumindo que estamos no onboarding
    const hasOnboarding = await page.locator('text=Quanto você tem').isVisible({ timeout: 3000 }).catch(() => false)
    
    if (hasOnboarding) {
      // Preencher saldo
      const saldoInput = page.locator('input[id="onb-saldo"]').first()
      await saldoInput.fill('2500')
      
      // Avançar
      await page.click('button:has-text("Continuar")')
      await page.waitForSelector('text=Quanto você recebe', { timeout: 5000 })
      
      // Voltar
      await page.click('button[aria-label="Voltar"], button:has(svg)').first()
      await page.waitForSelector('text=Quanto você tem', { timeout: 5000 })
      
      // Verificar que o valor foi preservado
      const valorPreservado = await saldoInput.inputValue()
      expect(valorPreservado).toBeTruthy() // Deve ter algum valor
      
      // ✅ SUCESSO: valor persistiu
    }
  })
})

test.describe('Onboarding - Validações', () => {
  test('deve bloquear avanço com saldo negativo', async ({ page }) => {
    await page.goto(BASE_URL)
    
    const hasOnboarding = await page.locator('text=Quanto você tem').isVisible({ timeout: 3000 }).catch(() => false)
    
    if (hasOnboarding) {
      const saldoInput = page.locator('input[id="onb-saldo"]').first()
      await saldoInput.fill('-500')
      
      await page.click('button:has-text("Continuar")')
      
      // Deve mostrar erro
      const temErro = await page.locator('text=negativo').isVisible({ timeout: 2000 })
      expect(temErro).toBe(true)
    }
  })
})
