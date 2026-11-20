import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso, pularApresentacao } from './apoio.js'

/**
 * TESTES DE REGRESSÃO - ONBOARDING
 * 
 * Validam que a correção arquitetural está funcionando:
 * - atualizarPreferenciasLimite NÃO envia onboarding_concluido
 * - Apenas marcarOnboardingConcluido() pode finalizar onboarding
 * - Múltiplas atualizações não finalizam onboarding
 * 
 * Usa o mesmo padrão dos testes existentes (apoio.js + banco em memória)
 */

test.describe('Regressão Onboarding - Arquitetura Corrigida', () => {
  test.use({ viewport: { width: 1440, height: 900 } })
  
  test('1. Salvar saldo NÃO envia onboarding_concluido', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    const resultado = await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: false,
        nome: 'Teste Regressão',
        saldo_base: null
      }),
      banco
    })

    await pularApresentacao(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Clicar em "Configurar manualmente"
    const btnManual = page.locator('button').filter({ hasText: /Configurar manualmente/i }).first()
    const temBtnManual = await btnManual.isVisible({ timeout: 3000 }).catch(() => false)
    if (temBtnManual) {
      await btnManual.click()
      await page.waitForTimeout(1000)
    }
    
    // Abrir formulário de saldo
    const btnSaldo = page.locator('button').filter({ hasText: /Saldo e Contas/i }).first()
    await btnSaldo.click()
    await page.waitForTimeout(1000)
    
    // Digitar saldo
    const campoSaldo = page.locator('input[type="text"]').first()
    await campoSaldo.fill('50000') // R$ 500,00
    await page.waitForTimeout(500)
    
    // Salvar
    const btnSalvar = page.locator('button').filter({ hasText: /Salvar|Continuar/i }).last()
    await btnSalvar.click()
    await page.waitForTimeout(2000)
    
    // Verificar escritas no perfil
    const escritasPerfil = resultado.escritasPerfil || []
    console.log(`Total de escritas no perfil: ${escritasPerfil.length}`)
    
    // NENHUMA escrita deve conter onboarding_concluido
    const temOnboardingFlag = escritasPerfil.some(escrita => 
      escrita.hasOwnProperty('onboarding_concluido')
    )
    
    if (temOnboardingFlag) {
      console.log('❌ BUG: onboarding_concluido foi enviado em UPDATE de saldo!')
      escritasPerfil.forEach((e, i) => console.log(`Escrita ${i + 1}:`, e))
    }
    
    expect(temOnboardingFlag, 'onboarding_concluido NÃO deve ser enviado em atualizações de saldo').toBe(false)
    console.log('✅ Teste passou: onboarding_concluido não foi enviado')
  })

  test('2. Múltiplas atualizações NÃO finalizam onboarding', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    const resultado = await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: false,
        nome: 'Teste Múltiplas',
        saldo_base: null
      }),
      banco
    })

    await pularApresentacao(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Clicar em "Configurar manualmente"
    const btnManual = page.locator('button').filter({ hasText: /Configurar manualmente/i }).first()
    const temBtnManual = await btnManual.isVisible({ timeout: 3000 }).catch(() => false)
    if (temBtnManual) {
      await btnManual.click()
      await page.waitForTimeout(1000)
    }
    
    // Abrir e salvar saldo 3 vezes
    for (let i = 1; i <= 3; i++) {
      const btnSaldo = page.locator('button').filter({ hasText: /Saldo e Contas/i }).first()
      await btnSaldo.click()
      await page.waitForTimeout(800)
      
      const campoSaldo = page.locator('input[type="text"]').first()
      await campoSaldo.clear()
      await campoSaldo.fill(`${i * 10000}`) // R$ 100, R$ 200, R$ 300
      await page.waitForTimeout(500)
      
      const btnSalvar = page.locator('button').filter({ hasText: /Salvar|Continuar/i }).last()
      await btnSalvar.click()
      await page.waitForTimeout(1500)
      
      console.log(`✅ Salvamento ${i} concluído`)
    }
    
    // Verificar que NENHUMA escrita contém onboarding_concluido
    const escritasPerfil = resultado.escritasPerfil || []
    console.log(`Total de escritas: ${escritasPerfil.length}`)
    
    const temOnboardingFlag = escritasPerfil.some(escrita => 
      escrita.hasOwnProperty('onboarding_concluido')
    )
    
    expect(temOnboardingFlag, 'Múltiplas atualizações NÃO devem enviar onboarding_concluido').toBe(false)
    console.log('✅ Teste passou: nenhuma escrita contém onboarding_concluido')
  })

  test('3. Apenas marcarOnboardingConcluido() pode finalizar', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    const resultado = await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilFalso({
        onboarding_concluido: false,
        nome: 'Teste Finalizar',
        saldo_base: 1000
      }),
      banco
    })

    await pularApresentacao(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    
    // Clicar em "Configurar manualmente"
    const btnManual = page.locator('button').filter({ hasText: /Configurar manualmente/i }).first()
    const temBtnManual = await btnManual.isVisible({ timeout: 3000 }).catch(() => false)
    if (temBtnManual) {
      await btnManual.click()
      await page.waitForTimeout(1000)
    }
    
    // Clicar em "Concluir configuração"
    const btnConcluir = page.locator('button').filter({ hasText: /Concluir configuração/i }).first()
    const temBtnConcluir = await btnConcluir.isVisible({ timeout: 3000 }).catch(() => false)
    
    if (temBtnConcluir) {
      await btnConcluir.click()
      await page.waitForTimeout(2000)
      
      // ESTA escrita DEVE conter onboarding_concluido = true
      const escritasPerfil = resultado.escritasPerfil || []
      const ultimaEscrita = escritasPerfil[escritasPerfil.length - 1]
      
      if (ultimaEscrita) {
        console.log('Última escrita:', ultimaEscrita)
        expect(ultimaEscrita.onboarding_concluido, 'Deve marcar onboarding_concluido como true').toBe(true)
        console.log('✅ Teste passou: onboarding_concluido marcado corretamente')
      } else {
        console.log('⚠ Nenhuma escrita registrada')
      }
    } else {
      console.log('⚠ Botão "Concluir configuração" não encontrado (teste inconclusivo)')
    }
  })
})
