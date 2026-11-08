import { test, expect } from '@playwright/test'
import { isolarSupabase } from './apoio'

// Capturas para revisão visual (não fazem asserção de design).
// Execução manual: npx playwright test e2e/capturas.spec.js --project=iphone-13-webkit
test.skip(!process.env.CAPTURAS, 'defina CAPTURAS=1 para gerar as imagens')

test('capturas', async ({ page }, info) => {
  const pasta = `capturas-revisao/${info.project.name}`
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await isolarSupabase(page)
  await page.goto('/login')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(2600) // splash de 2s
  await page.screenshot({ path: `${pasta}/1-capa.png` })
  for (const [i, nome] of [[1, '2-controle'], [4, '3-importacao']]) {
    await page.locator('[data-testid="apresentacao-indicador"]').nth(i).click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${pasta}/${nome}.png` })
  }
  await page.getByTestId('apresentacao-entrar').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${pasta}/4-login.png` })

  const p2 = await page.context().newPage()
  await isolarSupabase(p2, { autenticado: true })
  await p2.goto('/')
  const faixa = p2.locator('[data-testid="atalhos-home"]:visible')
  await expect(faixa).toBeVisible({ timeout: 20_000 })
  await p2.waitForTimeout(2600)
  await faixa.scrollIntoViewIfNeeded()
  await p2.waitForTimeout(400)
  await faixa.screenshot({ path: `${pasta}/5-atalhos.png` })
  await faixa.getByTestId('atalhos-personalizar').click()
  await p2.waitForTimeout(400)
  await p2.screenshot({ path: `${pasta}/6-personalizar.png` })
})
