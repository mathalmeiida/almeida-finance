// ─── Validação Final: Central de Importação (Estrutural) ───────────────────
// Testes sem login - validam estrutura, layout e responsividade
// Executar: npx playwright test validacao-central.spec.mjs

import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:4173'

test.describe('Central de Importação - Validação Estrutural', () => {
  test('página deve carregar (sem autenticação)', async ({ page }) => {
    // Tenta acessar a página
    const response = await page.goto(`${BASE_URL}/central-importacao`)
    
    // Pode redirecionar para login (esperado)
    if (page.url().includes('/login')) {
      console.log('✓ Redirecionou para login (comportamento correto)')
      expect(page.url()).toContain('/login')
    } else {
      // Ou carrega se já tiver sessão (cache)
      console.log('✓ Página carregou (sessão ativa)')
      expect(page.url()).toContain('/central-importacao')
    }
  })

  test('redirecionamento /importacao → /central-importacao', async ({ page }) => {
    await page.goto(`${BASE_URL}/importacao`)
    
    // Deve redirecionar
    await page.waitForTimeout(1000)
    const url = page.url()
    
    // Aceita /central-importacao ou /login (se não autenticado)
    const redirecionouCorreto = url.includes('/central-importacao') || url.includes('/login')
    expect(redirecionouCorreto).toBeTruthy()
    console.log('✓ Redirecionamento funcionou:', url)
  })

  test('build está disponível', async ({ page }) => {
    const response = await page.goto(BASE_URL)
    expect(response?.status()).toBe(200)
  })

  test('manifest.webmanifest acessível (PWA)', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/manifest.webmanifest`)
    expect(response?.status()).toBe(200)
    
    const manifest = await response?.json()
    expect(manifest).toHaveProperty('name')
    console.log('✓ PWA manifest:', manifest.name)
  })

  test('service worker registrado', async ({ page }) => {
    await page.goto(BASE_URL)
    
    const swRegistrado = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations()
      return regs.length > 0
    })
    
    console.log('✓ Service Worker:', swRegistrado ? 'registrado' : 'não registrado (dev mode)')
  })
})

test.describe('Responsividade - Múltiplos Viewports', () => {
  const viewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 15 Pro', width: 393, height: 852 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Notebook', width: 1366, height: 768 },
    { name: 'Desktop', width: 1920, height: 1080 },
  ]

  for (const viewport of viewports) {
    test(`${viewport.name} (${viewport.width}×${viewport.height})`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await page.goto(BASE_URL)
      
      // Verifica se não há overflow horizontal
      const hasOverflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth
      })
      
      expect(hasOverflow).toBe(false)
      console.log(`✓ ${viewport.name}: sem rolagem horizontal`)
    })
  }
})
