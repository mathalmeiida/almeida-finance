// @ts-check
import { test, expect } from '@playwright/test'
import path from 'path'

const BASE_URL = 'http://localhost:4173'
const SCREENSHOTS_DIR = 'screenshots-validacao-visual'

// Mock de autenticação do Supabase
test.beforeEach(async ({ page }) => {
  // Interceptar chamadas do Supabase e mockar sessão autenticada
  await page.route('**/auth/v1/token**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'mock-refresh',
        user: {
          id: 'mock-user-id',
          email: 'teste@almeidafinance.com',
          user_metadata: { nome: 'Usuário Teste' }
        }
      })
    })
  })

  // Mockar chamada de perfil
  await page.route('**/rest/v1/perfis**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: 'mock-perfil-id',
        usuario_id: 'mock-user-id',
        nome: 'Usuário Teste',
        data_marco: '2026-01-01',
        saldo_inicial: 1000,
        onboarding_concluido: true
      }])
    })
  })

  // Mockar outras chamadas essenciais
  await page.route('**/rest/v1/**', route => {
    const url = route.request().url()
    
    // Cartões
    if (url.includes('/cartoes')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    }
    // Investimentos
    else if (url.includes('/investimentos')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    }
    // Benefícios
    else if (url.includes('/beneficios')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    }
    // Outras tabelas
    else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      })
    }
  })

  // Setar localStorage com sessão mock
  await page.addInitScript(() => {
    const mockSession = {
      access_token: 'mock-token',
      token_type: 'bearer',
      expires_at: Date.now() + 3600000,
      refresh_token: 'mock-refresh',
      user: {
        id: 'mock-user-id',
        email: 'teste@almeidafinance.com',
        user_metadata: { nome: 'Usuário Teste' }
      }
    }
    
    localStorage.setItem('sb-gbszkijxzcejhybcmqxm-auth-token', JSON.stringify(mockSession))
  })
})

test.describe('Validação Visual COM AUTENTICAÇÃO - Conversor Universal', () => {
  
  test('1. Página /importacao - Interface Completa Autenticada', async ({ page }) => {
    await page.goto(`${BASE_URL}/importacao`)
    
    // Aguardar carregamento completo
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Dar tempo para renderizar
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '10-importacao-autenticada-COMPLETA.png'),
      fullPage: true 
    })
    
    // Verificar elementos da interface de importação
    const hasHeading = await page.getByRole('heading', { name: /importação/i }).isVisible().catch(() => false)
    const hasUploadArea = await page.getByText(/arraste|selecione|arquivo/i).isVisible().catch(() => false)
    
    console.log('Heading presente:', hasHeading)
    console.log('Área de upload presente:', hasUploadArea)
  })

  test('2. Receitas - Modal de Importação', async ({ page }) => {
    await page.goto(`${BASE_URL}/receitas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    // Screenshot antes de abrir modal
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '11-receitas-ANTES-modal.png'),
      fullPage: true 
    })
    
    // Procurar e clicar no botão Importar
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible().catch(() => false)
    
    console.log('Botão Importar visível em Receitas:', btnVisible)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(500)
      
      // Screenshot com modal aberto
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '12-receitas-MODAL-importacao.png'),
        fullPage: true 
      })
    }
  })

  test('3. Despesas - Modal de Importação', async ({ page }) => {
    await page.goto(`${BASE_URL}/despesas`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '13-despesas-ANTES-modal.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible().catch(() => false)
    
    console.log('Botão Importar visível em Despesas:', btnVisible)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(500)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '14-despesas-MODAL-importacao.png'),
        fullPage: true 
      })
    }
  })

  test('4. Cartões - Modal de Importação', async ({ page }) => {
    await page.goto(`${BASE_URL}/cartoes`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '15-cartoes-ANTES-modal.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible().catch(() => false)
    
    console.log('Botão Importar visível em Cartões:', btnVisible)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(500)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '16-cartoes-MODAL-importacao.png'),
        fullPage: true 
      })
    }
  })

  test('5. Dashboard/Home - Layout Autenticado', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '17-dashboard-AUTENTICADO.png'),
      fullPage: true 
    })
    
    // Verificar se há botão de importar no dashboard
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible().catch(() => false)
    
    console.log('Botão Importar visível no Dashboard:', btnVisible)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(500)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '18-dashboard-MODAL-importacao.png'),
        fullPage: true 
      })
    }
  })

  test('6. Investimentos - Modal de Importação', async ({ page }) => {
    await page.goto(`${BASE_URL}/investimentos`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    
    await page.screenshot({ 
      path: path.join(SCREENSHOTS_DIR, '19-investimentos-ANTES-modal.png'),
      fullPage: true 
    })
    
    const importarBtn = page.getByRole('button', { name: /importar/i })
    const btnVisible = await importarBtn.isVisible().catch(() => false)
    
    console.log('Botão Importar visível em Investimentos:', btnVisible)
    
    if (btnVisible) {
      await importarBtn.click()
      await page.waitForTimeout(500)
      
      await page.screenshot({ 
        path: path.join(SCREENSHOTS_DIR, '20-investimentos-MODAL-importacao.png'),
        fullPage: true 
      })
    }
  })

  test('7. Verificar Console de Erros (Autenticado)', async ({ page }) => {
    const erros = []
    page.on('console', msg => {
      if (msg.type() === 'error') erros.push(msg.text())
    })
    page.on('pageerror', err => erros.push(err.message))
    
    await page.goto(`${BASE_URL}/importacao`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    const errosCriticos = erros.filter(e => 
      !e.includes('Extension') && 
      !e.includes('chrome-extension') &&
      !e.includes('DevTools') &&
      !e.includes('favicon')
    )
    
    console.log(`Total de erros capturados: ${erros.length}`)
    console.log(`Erros críticos: ${errosCriticos.length}`)
    
    if (errosCriticos.length > 0) {
      console.log('Erros encontrados:', errosCriticos)
    }
  })
})
