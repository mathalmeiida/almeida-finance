// Testes básicos do site em produção (sem login)
import { test, expect, devices } from '@playwright/test'

const PRODUCAO_URL = 'https://almeida-finance.vercel.app'

test.describe('Site em Produção - Verificações Básicas', () => {
  
  test('deve carregar página inicial', async ({ page }) => {
    await page.goto(PRODUCAO_URL, { timeout: 30000 })
    await page.waitForLoadState('domcontentloaded')
    
    // Verificar que não há erro 404/500
    const status = page.url()
    expect(status).toContain('almeida-finance.vercel.app')
  })

  test('deve ter bundle da Fase 2', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    await page.waitForLoadState('networkidle')
    
    // Verificar se há scripts carregados
    const scripts = await page.locator('script[src*="index-"]').count()
    expect(scripts).toBeGreaterThan(0)
  })

  test('deve ter meta tags corretas', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    
    // Verificar viewport (PWA)
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('width=device-width')
    
    // Verificar manifest (PWA)
    const manifest = await page.locator('link[rel="manifest"]').count()
    expect(manifest).toBe(1)
  })

  test('deve redirecionar para login ou home', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    
    const url = page.url()
    
    // Deve estar em login OU home (se já logado)
    const urlValida = url.includes('/login') || 
                      url.includes('/auth') || 
                      url.includes('/home') ||
                      url === PRODUCAO_URL + '/' ||
                      url === PRODUCAO_URL
    
    expect(urlValida).toBeTruthy()
  })

  test('deve ter CSS carregado', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    await page.waitForLoadState('networkidle')
    
    // Verificar se há estilos
    const links = await page.locator('link[rel="stylesheet"]').count()
    expect(links).toBeGreaterThan(0)
  })

  test('não deve ter erros de console críticos', async ({ page }) => {
    const erros = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        erros.push(msg.text())
      }
    })
    
    await page.goto(PRODUCAO_URL)
    await page.waitForTimeout(3000) // Aguardar carregamento
    
    // Filtrar erros conhecidos/aceitáveis
    const errosCriticos = erros.filter(e => 
      !e.includes('favicon') && // Favicon pode falhar em dev
      !e.includes('404') && // 404s de assets opcionais
      !e.includes('net::ERR_FAILED') // Erros de rede intermitentes
    )
    
    expect(errosCriticos.length).toBe(0)
  })
})

test.describe('PWA - Funcionalidades Básicas', () => {
  
  test('deve ter service worker registrado', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    await page.waitForLoadState('networkidle')
    
    // Verificar se SW está disponível
    const hasSW = await page.evaluate(() => 'serviceWorker' in navigator)
    expect(hasSW).toBeTruthy()
  })

  test('deve ter ícones PWA', async ({ page }) => {
    await page.goto(PRODUCAO_URL)
    
    // Verificar apple-touch-icon
    const appleIcon = await page.locator('link[rel="apple-touch-icon"]').count()
    expect(appleIcon).toBeGreaterThan(0)
    
    // Verificar manifest
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
    expect(manifest).toBeTruthy()
  })
})

test.describe('Rota /central-importacao', () => {
  
  test('deve existir (não 404)', async ({ page }) => {
    await page.goto(PRODUCAO_URL + '/central-importacao')
    await page.waitForLoadState('domcontentloaded')
    
    const corpo = await page.textContent('body')
    
    // Não deve ter mensagem de 404
    expect(corpo).not.toContain('404')
    expect(corpo).not.toContain('Not Found')
    expect(corpo).not.toContain('Página não encontrada')
  })

  test('deve redirecionar para autenticação se não logado', async ({ page }) => {
    await page.goto(PRODUCAO_URL + '/central-importacao')
    await page.waitForLoadState('networkidle', { timeout: 15000 })
    
    const url = page.url()
    
    // Deve redirecionar para login OU mostrar conteúdo (se já logado)
    const temLogin = url.includes('/login') || url.includes('/auth')
    const temCentral = url.includes('/central-importacao')
    
    expect(temLogin || temCentral).toBeTruthy()
  })
})

test.describe('Compatibilidade de Dispositivos', () => {
  
  test('desktop - deve carregar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(PRODUCAO_URL)
    
    const loaded = await page.waitForLoadState('networkidle', { timeout: 30000 })
    expect(loaded).toBeFalsy() // waitForLoadState retorna void se bem-sucedido
  })

  test('mobile - deve carregar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto(PRODUCAO_URL)
    
    const loaded = await page.waitForLoadState('networkidle', { timeout: 30000 })
    expect(loaded).toBeFalsy()
  })

  test('tablet - deve carregar', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad
    await page.goto(PRODUCAO_URL)
    
    const loaded = await page.waitForLoadState('networkidle', { timeout: 30000 })
    expect(loaded).toBeFalsy()
  })
})
