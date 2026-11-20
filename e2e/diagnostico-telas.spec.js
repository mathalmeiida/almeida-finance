// @ts-check
// Diagnóstico visual manual (não roda por padrão): DIAG=1 npx playwright test diagnostico-telas --project=desktop-chromium
import { test } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'
import { DADOS } from './dados-exemplo.js'

test.skip(!process.env.DIAG, 'diagnóstico manual: defina DIAG=1')

const ALVOS = (process.env.ALVOS || '375x812:/,768x1024:/receitas').split(',')
for (const alvo of ALVOS) {
  test(`tela ${alvo}`, async ({ browser }) => {
    const [tam, rota] = alvo.split(':')
    const [w, h] = tam.split('x').map(Number)
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 })
    const page = await ctx.newPage()
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-03:00'))
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso({ saldo_base: 5000 }), banco: criarBancoMemoria(DADOS) })
    await page.goto(rota)
    await page.waitForLoadState('networkidle')
    await page.locator('.splash-bar').waitFor({ state: 'detached' })
    await page.waitForTimeout(400)
    const nome = `${tam}${rota.replace(/[/?=]/g, '_')}`
    await page.screenshot({ path: `test-results/diagnostico/${nome}.png`, fullPage: process.env.FULL === '1' })
    await ctx.close()
  })
}
