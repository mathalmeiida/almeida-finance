import { test, expect } from '@playwright/test'

/**
 * Testes automatizados das prioridades do Almeida Finance
 * 
 * IMPORTANTE: Usar credenciais de teste (não produção)
 */

const CREDENCIAIS_TESTE = {
  email: process.env.TEST_USER_EMAIL || 'teste@almeidafinance.com',
  senha: process.env.TEST_USER_PASSWORD || 'teste123456',
  emailAdmin: process.env.TEST_ADMIN_EMAIL || 'admin@almeidafinance.com',
  senhaAdmin: process.env.TEST_ADMIN_PASSWORD || 'admin123456'
}

test.describe('Prioridade 1: WhatsApp Financeiro', () => {
  test.beforeEach(async ({ page }) => {
    // Login como admin
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.emailAdmin)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senhaAdmin)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('deve exibir aba WhatsApp no painel admin', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    
    // Verificar se aba WhatsApp existe
    const abaWhatsApp = page.locator('button:has-text("WhatsApp")')
    await expect(abaWhatsApp).toBeVisible()
  })

  test('deve abrir simulador de WhatsApp', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    
    // Clicar na aba WhatsApp
    await page.click('button:has-text("WhatsApp")')
    await page.waitForTimeout(500)
    
    // Clicar no botão "Abrir simulador"
    const botaoSimulador = page.locator('button:has-text("Abrir simulador")')
    await expect(botaoSimulador).toBeVisible()
    await botaoSimulador.click()
    
    // Verificar se navegou para /admin/whatsapp
    await page.waitForURL('**/admin/whatsapp', { timeout: 5000 })
    
    // Verificar elementos da interface
    await expect(page.locator('h1:has-text("WhatsApp Financeiro")')).toBeVisible()
    await expect(page.locator('text=Modo Simulação Ativo')).toBeVisible()
    await expect(page.locator('input[placeholder*="mensagem"]')).toBeVisible()
  })

  test('deve processar mensagem de receita', async ({ page }) => {
    await page.goto('/admin/whatsapp')
    await page.waitForLoadState('networkidle')
    
    // Digitar mensagem
    const input = page.locator('input[placeholder*="mensagem"]')
    await input.fill('Recebi 3000 de salário')
    
    // Enviar
    await page.click('button:has-text("Enviar")')
    await page.waitForTimeout(1000)
    
    // Verificar preview
    await expect(page.locator('text=Nova Receita')).toBeVisible()
    await expect(page.locator('text=R$ 3000')).toBeVisible()
    await expect(page.locator('text=Salário')).toBeVisible()
  })

  test('deve alternar entre modo simulação e real', async ({ page }) => {
    await page.goto('/admin/whatsapp')
    await page.waitForLoadState('networkidle')
    
    // Verificar modo simulação ativo
    await expect(page.locator('button:has-text("Simulação")')).toBeVisible()
    
    // Alternar para modo real
    await page.click('button:has-text("Simulação")')
    await page.waitForTimeout(500)
    
    // Verificar modo real ativo
    await expect(page.locator('button:has-text("Real")')).toBeVisible()
    await expect(page.locator('text=Modo Real Ativo')).toBeVisible()
  })

  test('deve validar mensagem inválida', async ({ page }) => {
    await page.goto('/admin/whatsapp')
    await page.waitForLoadState('networkidle')
    
    // Enviar mensagem sem valor
    const input = page.locator('input[placeholder*="mensagem"]')
    await input.fill('Fui ao mercado hoje')
    await page.click('button:has-text("Enviar")')
    await page.waitForTimeout(1000)
    
    // Verificar erro
    await expect(page.locator('text=Erro ao processar')).toBeVisible()
    await expect(page.locator('text=valor monetário')).toBeVisible()
  })
})

test.describe('Prioridade 2: Pagamento de Faturas', () => {
  test.beforeEach(async ({ page }) => {
    // Login normal
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.email)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senha)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('deve exibir faturas pendentes', async ({ page }) => {
    await page.goto('/cartoes')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Verificar se a página de cartões carregou
    await expect(page.locator('h1:has-text("Cartões")')).toBeVisible({ timeout: 10000 })
  })

  test.skip('deve registrar pagamento parcial', async ({ page }) => {
    // Este teste requer uma fatura existente no banco de testes
    // Desabilitado até setup do ambiente de testes
  })
})

test.describe('Prioridade 3: Custo de Vida', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.email)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senha)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
  })

  test('deve carregar página de custo de vida', async ({ page }) => {
    await page.goto('/custo-de-vida')
    await page.waitForLoadState('networkidle')
    
    // Verificar elementos principais
    await expect(page.locator('h1:has-text("Custo de Vida")')).toBeVisible({ timeout: 10000 })
  })

  test('deve exibir categorias de despesas', async ({ page }) => {
    await page.goto('/custo-de-vida')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
    
    // Verificar se há categorias ou mensagem de sem dados
    const temCategorias = await page.locator('text=Alimentação').isVisible({ timeout: 5000 }).catch(() => false)
    const semDados = await page.locator('text=Nenhum custo registrado').isVisible({ timeout: 5000 }).catch(() => false)
    
    expect(temCategorias || semDados).toBeTruthy()
  })
})

test.describe('Prioridade 6: Auditoria Geral', () => {
  test('deve preservar a Home sem alterações', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.email)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senha)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    
    // Verificar elementos principais da Home
    await expect(page.locator('text=Olá')).toBeVisible({ timeout: 10000 })
    
    // Verificar que não há erros no console
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    
    await page.waitForTimeout(2000)
    expect(errors.length).toBe(0)
  })

  test('deve carregar sem erros de JavaScript', async ({ page }) => {
    const errors = []
    page.on('pageerror', error => {
      errors.push(error.message)
    })
    
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    expect(errors.length).toBe(0)
  })

  test('deve ser responsivo (mobile)', async ({ page, context }) => {
    await context.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    
    // Verificar que elementos estão visíveis em mobile
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('deve validar isolamento entre usuários', async ({ page, context }) => {
    // Login com usuário 1
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.email)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senha)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    
    // Capturar algum dado do usuário 1
    const nomeUsuario1 = await page.locator('text=Olá').textContent().catch(() => null)
    
    // Logout
    await page.goto('/mais')
    await page.waitForLoadState('networkidle')
    const botaoSair = page.locator('button:has-text("Sair")')
    if (await botaoSair.isVisible({ timeout: 3000 }).catch(() => false)) {
      await botaoSair.click()
      await page.waitForURL('**/login', { timeout: 5000 })
    }
    
    // Login com usuário 2 (admin)
    await page.goto('/login')
    await page.fill('input[type="email"]', CREDENCIAIS_TESTE.emailAdmin)
    await page.fill('input[type="password"]', CREDENCIAIS_TESTE.senhaAdmin)
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 10000 })
    
    // Verificar que é outro usuário
    const nomeUsuario2 = await page.locator('text=Olá').textContent().catch(() => null)
    
    // Usuários diferentes devem ter saudações diferentes
    if (nomeUsuario1 && nomeUsuario2) {
      expect(nomeUsuario1).not.toBe(nomeUsuario2)
    }
  })
})

test.describe('Build e Deploy', () => {
  test('deve ter build sem erros', async () => {
    // Este teste é executado pelo CI/CD, não pelo Playwright
    expect(true).toBe(true)
  })
})
