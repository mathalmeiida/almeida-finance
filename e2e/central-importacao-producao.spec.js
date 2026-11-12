// Testes da Central de Importação em PRODUÇÃO
// ATENÇÃO: Estes testes acessam https://almeida-finance.vercel.app
// e requerem credenciais reais de teste.

import { test, expect, devices } from '@playwright/test'

const PRODUCAO_URL = 'https://almeida-finance.vercel.app'

// Credenciais de teste (criar usuário de teste ou usar variáveis de ambiente)
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'teste@almeida.finance'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'senha-segura-123'

test.describe('Central de Importação - Produção', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ir para produção
    await page.goto(PRODUCAO_URL)
    await page.waitForLoadState('networkidle')
  })

  test('deve carregar o site em produção', async ({ page }) => {
    // Verificar título
    await expect(page).toHaveTitle(/Almeida Finance/)
    
    // Verificar elementos básicos
    const tela = await page.textContent('body')
    expect(tela).toContain('Almeida Finance')
  })

  test('deve mostrar tela de login', async ({ page }) => {
    // Deve ter campos de login
    const haEmail = await page.locator('input[type="email"]').count()
    const haSenha = await page.locator('input[type="password"]').count()
    
    expect(haEmail).toBeGreaterThan(0)
    expect(haSenha).toBeGreaterThan(0)
  })

  test('deve ter link para Central de Importação após login', async ({ page }) => {
    // Tentar fazer login (se credenciais disponíveis)
    if (!process.env.TEST_USER_EMAIL) {
      test.skip(true, 'Credenciais de teste não configuradas')
    }

    // Login
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    
    // Aguardar navegação
    await page.waitForURL('**/home', { timeout: 10000 })
    
    // Desktop: verificar sidebar
    if (page.viewportSize().width >= 768) {
      await expect(page.getByText('Central de Importação')).toBeVisible()
    }
    
    // Mobile: abrir menu
    if (page.viewportSize().width < 768) {
      await page.click('[aria-label="Menu"]')
      await expect(page.getByText('Central de Importação')).toBeVisible()
    }
  })

  test('deve acessar /central-importacao diretamente', async ({ page }) => {
    // Tentar acessar URL direta
    await page.goto(PRODUCAO_URL + '/central-importacao')
    
    // Deve redirecionar para login OU mostrar Central (se já logado)
    const url = page.url()
    const temLogin = url.includes('/login') || url.includes('/auth')
    const temCentral = url.includes('/central-importacao')
    
    expect(temLogin || temCentral).toBeTruthy()
  })

  test('deve verificar estrutura da página Central', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) {
      test.skip(true, 'Requer login')
    }

    // Login
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
    
    // Ir para Central
    await page.goto(PRODUCAO_URL + '/central-importacao')
    await page.waitForLoadState('networkidle')
    
    // Verificar título
    await expect(page.getByRole('heading', { name: /Central de Importação/i })).toBeVisible()
    
    // Verificar abas
    await expect(page.getByText('Histórico')).toBeVisible()
    await expect(page.getByText('Nova Importação')).toBeVisible()
  })

  test('deve alternar entre abas', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) {
      test.skip(true, 'Requer login')
    }

    // Login e navegação
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
    await page.goto(PRODUCAO_URL + '/central-importacao')
    
    // Clicar em "Nova Importação"
    await page.getByText('Nova Importação').click()
    
    // Verificar se componente de importação aparece
    await expect(page.getByText(/Arraste seu arquivo/i)).toBeVisible({ timeout: 5000 })
    
    // Voltar para "Histórico"
    await page.getByText('Histórico').click()
    
    // Verificar mensagem de histórico (com ou sem migration)
    const corpo = await page.textContent('body')
    const temHistorico = corpo.includes('importação') || corpo.includes('Histórico')
    expect(temHistorico).toBeTruthy()
  })

  test('deve mostrar graceful degradation se migration não aplicada', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) {
      test.skip(true, 'Requer login')
    }

    // Login e navegação
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
    await page.goto(PRODUCAO_URL + '/central-importacao')
    
    // Verificar se há mensagem de indisponibilidade OU histórico funcional
    const corpo = await page.textContent('body')
    
    // Cenário 1: Migration aplicada (mostra estatísticas ou lista)
    const temEstatisticas = corpo.includes('Total') || corpo.includes('Importadas')
    
    // Cenário 2: Migration não aplicada (mostra graceful degradation)
    const temGraceful = corpo.includes('indisponível') || corpo.includes('atualização')
    
    // Pelo menos um dos dois deve ser verdadeiro
    expect(temEstatisticas || temGraceful).toBeTruthy()
  })
})

test.describe('Central de Importação - Desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('deve mostrar sidebar com link', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) {
      test.skip(true, 'Requer login')
    }

    await page.goto(PRODUCAO_URL)
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/home')
    
    // Sidebar deve estar visível
    const sidebar = page.locator('aside, nav')
    await expect(sidebar).toBeVisible()
    
    // Link deve estar presente
    await expect(page.getByText('Central de Importação')).toBeVisible()
  })
})
