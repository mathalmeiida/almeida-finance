// @ts-check
// Teste simples e direto do modal de Receitas
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao, criarBancoMemoria } from './apoio.js'

test.describe('Modal - Teste Simples', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Deve abrir modal de Nova Receita com role="dialog"', async ({ page }) => {
    const banco = criarBancoMemoria({ receitas: [] })
    
    // Capturar erros JavaScript
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    
    await isolarSupabase(page, { 
      autenticado: true, 
      perfil: perfilFalso(),
      banco 
    })
    await pularApresentacao(page)
    await page.goto('/receitas')
    await page.waitForLoadState('networkidle')
    
    // Screenshot antes de clicar
    await page.screenshot({ path: 'test-results/antes-click.png' })
    
    // Clicar no botão "Nova receita"
    const btn = page.locator('button', { hasText: 'Nova receita' }).first()
    await btn.waitFor({ state: 'visible', timeout: 5000 })
    await btn.click()
    
    // Aguardar um frame de React
    await page.waitForTimeout(500)
    
    // Screenshot após clicar
    await page.screenshot({ path: 'test-results/apos-click.png' })
    
    // Verificar HTML renderizado
    const html = await page.content()
    const temRoleDialog = html.includes('role="dialog"')
    const temAriaModal = html.includes('aria-modal="true"')
    const temModalTitle = html.includes('id="modal-title"')
    
    console.log('\n=== DEBUG ===')
    console.log('Erros JavaScript:', errors)
    console.log('HTML contém role="dialog":', temRoleDialog)
    console.log('HTML contém aria-modal="true":', temAriaModal)
    console.log('HTML contém id="modal-title":', temModalTitle)
    
    // Buscar modal no DOM
    const modal = page.locator('[role="dialog"]')
    const modalVisivel = await modal.isVisible().catch(() => false)
    
    console.log('Modal com role="dialog" está visível:', modalVisivel)
    
    if (!modalVisivel) {
      // Diagnosticar o que há na página
      const divs = await page.locator('div.fixed').count()
      console.log('Divs com class="fixed":', divs)
      
      const textoBody = await page.locator('body').textContent()
      console.log('Texto na página contém "Nova receita":', textoBody.includes('Nova receita'))
    }
    
    // Asserção principal
    expect(modalVisivel, 'Modal com role="dialog" deve estar visível').toBeTruthy()
    
    // Verificar acessibilidade completa
    const ariaModal = await modal.getAttribute('aria-modal')
    const ariaLabelledby = await modal.getAttribute('aria-labelledby')
    
    expect(ariaModal).toBe('true')
    expect(ariaLabelledby).toBe('modal-title')
    
    console.log('✅ Modal acessível detectado com sucesso')
  })
})
