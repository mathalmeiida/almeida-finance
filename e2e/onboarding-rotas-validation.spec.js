// @ts-check
// Validação das rotas permitidas durante onboarding
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao } from './apoio.js'

test.describe('Onboarding - Validação de Rotas', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Rotas permitidas: deve acessar módulos com flag ativa', async ({ page }) => {
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      localStorage.setItem('almeida_configurando_onboarding', '1')
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ onboarding_concluido: false })
    })

    // Testar rotas permitidas
    const rotasPermitidas = ['/receitas', '/despesas', '/cartoes', '/beneficios', '/investimentos']
    
    for (const rota of rotasPermitidas) {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      
      const texto = await page.locator('body').textContent()
      const renderizouOnboarding = texto.includes('Vamos organizar suas finanças')
      
      expect(renderizouOnboarding, `Rota ${rota} NÃO deve renderizar onboarding`).toBeFalsy()
      console.log(`✅ Rota permitida: ${rota} acessível`)
    }
  })

  test('Rotas não permitidas: deve bloquear acesso sem flag', async ({ page }) => {
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      // SEM flag almeida_configurando_onboarding
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ onboarding_concluido: false })
    })

    // Tentar acessar módulos SEM flag
    const rotas = ['/receitas', '/despesas', '/configuracoes']
    
    for (const rota of rotas) {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      
      const texto = await page.locator('body').textContent()
      const renderizouOnboarding = texto.includes('Vamos organizar suas finanças')
      
      expect(renderizouOnboarding, `Rota ${rota} DEVE renderizar onboarding sem flag`).toBeTruthy()
      console.log(`✅ Rota bloqueada: ${rota} redireciona para onboarding`)
    }
  })

  test('Rotas administrativas: deve bloquear mesmo com flag', async ({ page }) => {
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      localStorage.setItem('almeida_configurando_onboarding', '1')
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ onboarding_concluido: false })
    })

    // Tentar acessar rotas administrativas MESMO COM flag
    const rotasAdmin = ['/configuracoes', '/conta', '/admin']
    
    for (const rota of rotasAdmin) {
      await page.goto(rota)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)
      
      const texto = await page.locator('body').textContent()
      const renderizouOnboarding = texto.includes('Vamos organizar suas finanças')
      
      expect(renderizouOnboarding, `Rota admin ${rota} DEVE renderizar onboarding`).toBeTruthy()
      console.log(`✅ Rota administrativa bloqueada: ${rota}`)
    }
  })

  test('Rota raiz: deve renderizar onboarding mesmo com flag', async ({ page }) => {
    await pularApresentacao(page)
    
    await page.addInitScript(() => {
      localStorage.clear()
      localStorage.setItem('almeida_apresentacao_publica_vista', '1')
      localStorage.setItem('almeida_configurando_onboarding', '1')
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso({ onboarding_concluido: false })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    
    const texto = await page.locator('body').textContent()
    const renderizouOnboarding = texto.includes('Vamos organizar suas finanças') || texto.includes('Configure suas finanças')
    
    expect(renderizouOnboarding, 'Rota / DEVE renderizar onboarding').toBeTruthy()
    console.log('✅ Rota raiz (/) renderiza onboarding corretamente')
  })
})
