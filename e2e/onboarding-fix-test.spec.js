// @ts-check
// Teste do onboarding após correção da flag CHAVE_CONFIGURANDO
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao, criarBancoMemoria } from './apoio.js'

test.describe('Onboarding - Correção da Flag', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Usuário com onboarding_concluido=false deve ver OnboardingSimples', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await pularApresentacao(page)
    
    // Limpar localStorage antes de configurar mock
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    // Perfil COM onboarding pendente
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: false,
        nome: 'Teste Onboarding',
        saldo_base: null
      }),
      banco 
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    // Verificar se OnboardingSimples renderizou
    const texto = await page.locator('body').textContent()
    const temOnboarding = texto.includes('Vamos organizar suas finanças')
    const temDashboard = texto.includes('Planeje suas decisões')

    console.log('Detecção:', { onboarding: temOnboarding, dashboard: temDashboard })

    expect(temOnboarding, '✅ OnboardingSimples DEVE renderizar').toBeTruthy()
    expect(temDashboard, '❌ Dashboard NÃO deve renderizar').toBeFalsy()
    
    console.log('✅ TESTE PASSOU: onboarding_concluido=false renderiza OnboardingSimples')
  })

  test('Usuário com onboarding_concluido=true deve ver Dashboard', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
    })
    
    // Perfil COM onboarding concluído
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: true,
        nome: 'Teste Dashboard'
      }),
      banco 
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const texto = await page.locator('body').textContent()
    const temOnboarding = texto.includes('Vamos organizar suas finanças')
    const temDashboard = texto.includes('Planeje suas decisões')

    console.log('Detecção:', { onboarding: temOnboarding, dashboard: temDashboard })

    expect(temDashboard, '✅ Dashboard DEVE renderizar').toBeTruthy()
    expect(temOnboarding, '❌ Onboarding NÃO deve renderizar').toBeFalsy()
    
    console.log('✅ TESTE PASSOU: onboarding_concluido=true renderiza Dashboard')
  })

  test('Flag CHAVE_CONFIGURANDO não deve bloquear renderização do onboarding', async ({ page }) => {
    const banco = criarBancoMemoria()
    
    await pularApresentacao(page)
    
    // Setar a flag ANTES de carregar a página
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      localStorage.setItem('almeida_configurando_onboarding', '1') // <--- FLAG SETADA
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ 
        onboarding_concluido: false,
        nome: 'Teste Flag'
      }),
      banco 
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)

    const texto = await page.locator('body').textContent()
    const temOnboarding = texto.includes('Vamos organizar suas finanças') || texto.includes('Configure suas finanças')
    const temDashboard = texto.includes('Planeje suas decisões')

    console.log('Detecção (com flag):', { onboarding: temOnboarding, dashboard: temDashboard })

    // A flag deve permitir acesso aos módulos, MAS não bloquear o próprio onboarding
    expect(temOnboarding, '✅ Onboarding DEVE renderizar mesmo com flag ativa').toBeTruthy()
    expect(temDashboard, '❌ Dashboard NÃO deve renderizar').toBeFalsy()
    
    console.log('✅ TESTE PASSOU: Flag não bloqueia onboarding')
  })
})
