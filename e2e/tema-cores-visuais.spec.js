// @ts-check
// Verificação visual das cores dos temas
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, pularApresentacao } from './apoio.js'

test.describe('Temas - Cores Visuais', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('Cores devem mudar visualmente entre tema claro e escuro', async ({ page }) => {
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso() })
    await pularApresentacao(page)
    
    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')
    
    // Garantir que está no tema claro primeiro
    const btnClaro = page.locator('button').filter({ hasText: /claro/i }).first()
    await btnClaro.click()
    await page.waitForTimeout(300)
    
    // Capturar cor de fundo da página no tema claro
    const bgClaro = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Capturar cor de um card no tema claro
    const cardClaro = await page.locator('.card').first().evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    console.log('Tema CLARO:')
    console.log('  Body background:', bgClaro)
    console.log('  Card background:', cardClaro)
    
    // Mudar para tema escuro
    const btnEscuro = page.locator('button').filter({ hasText: /escuro/i }).first()
    await btnEscuro.click()
    await page.waitForTimeout(300)
    
    // Capturar cor de fundo da página no tema escuro
    const bgEscuro = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // Capturar cor de um card no tema escuro
    const cardEscuro = await page.locator('.card').first().evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    console.log('\nTema ESCURO:')
    console.log('  Body background:', bgEscuro)
    console.log('  Card background:', cardEscuro)
    
    // Verificar que as cores mudaram
    expect(bgClaro).not.toBe(bgEscuro)
    expect(cardClaro).not.toBe(cardEscuro)
    
    console.log('\n✅ Cores mudam visualmente entre temas')
    
    // Verificar que tema escuro tem cores mais escuras (valores RGB menores)
    const rgbClaro = bgClaro.match(/rgb\((\d+), (\d+), (\d+)\)/)
    const rgbEscuro = bgEscuro.match(/rgb\((\d+), (\d+), (\d+)\)/)
    
    if (rgbClaro && rgbEscuro) {
      const luminosidadeClaro = parseInt(rgbClaro[1]) + parseInt(rgbClaro[2]) + parseInt(rgbClaro[3])
      const luminosidadeEscuro = parseInt(rgbEscuro[1]) + parseInt(rgbEscuro[2]) + parseInt(rgbEscuro[3])
      
      console.log('Luminosidade claro:', luminosidadeClaro)
      console.log('Luminosidade escuro:', luminosidadeEscuro)
      
      expect(luminosidadeEscuro, 'Tema escuro deve ter menos luminosidade').toBeLessThan(luminosidadeClaro)
      console.log('✅ Tema escuro é realmente mais escuro')
    }
    
    // Screenshots para comparação visual
    await page.screenshot({ path: 'test-results/tema-escuro.png' })
    
    await btnClaro.click()
    await page.waitForTimeout(300)
    await page.screenshot({ path: 'test-results/tema-claro.png' })
    
    console.log('\n📸 Screenshots salvos em test-results/')
  })

  test('Tema automático deve aplicar baseado em preferência do sistema', async ({ page }) => {
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso() })
    await pularApresentacao(page)
    
    await page.goto('/configuracoes')
    await page.waitForLoadState('networkidle')
    
    // Definir preferência do sistema como escuro
    await page.emulateMedia({ colorScheme: 'dark' })
    
    // Selecionar tema automático
    const btnAuto = page.locator('button').filter({ hasText: /automático/i }).first()
    await btnAuto.click()
    await page.waitForTimeout(300)
    
    // Verificar que html tem classe tema-automatico
    const htmlClass = await page.locator('html').getAttribute('class')
    expect(htmlClass).toContain('tema-automatico')
    
    // Capturar cor de fundo (deve ser escura)
    const bgAuto = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    console.log('Tema AUTOMÁTICO (dark):')
    console.log('  Body background:', bgAuto)
    console.log('  HTML class:', htmlClass)
    
    // Mudar preferência do sistema para claro
    await page.emulateMedia({ colorScheme: 'light' })
    await page.waitForTimeout(300)
    
    const bgAutoLight = await page.locator('body').evaluate(el => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    console.log('\nTema AUTOMÁTICO (light):')
    console.log('  Body background:', bgAutoLight)
    
    // Verificar que a cor mudou
    expect(bgAuto).not.toBe(bgAutoLight)
    console.log('✅ Tema automático responde a preferência do sistema')
  })
})
