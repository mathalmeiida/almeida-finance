import { test, expect } from '@playwright/test'
import { isolarSupabase, criarBancoMemoria, medirViewport, USUARIO_TESTE } from './apoio'
import { mkdirSync } from 'node:fs'

// Home: cabeçalho dentro da área segura, menu inferior, calendário, sem overflow,
// em vários tamanhos e com poucos/muitos lançamentos.
const TAMANHOS = [[375, 667], [390, 844], [393, 852], [430, 932], [768, 1024], [1366, 768], [1920, 1080]]
const SAFE_TOP = 47, SAFE_BOTTOM = 34

async function simularAreaSegura(page) {
  // Playwright não emula env(safe-area-inset-*): substitui no CSS servido.
  await page.route('**/assets/*.css', async route => {
    const r = await route.fetch(); const t = await r.text()
    await route.fulfill({ response: r, body: t.replaceAll('env(safe-area-inset-bottom)', `${SAFE_BOTTOM}px`).replaceAll('env(safe-area-inset-top)', `${SAFE_TOP}px`) })
  })
}
function despesasDoMes(qtd) {
  const hoje = new Date(); const ym = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return Array.from({ length: qtd }, (_, i) => ({ id: `d${i}`, usuario_id: USUARIO_TESTE.id, descricao: `Gasto ${i}`, valor: 10 + i, data: `${ym}-${String((i % 27) + 1).padStart(2, '0')}`, tipo: 'variavel', pago: true, categoria: 'Outros' }))
}
async function abrirHome(page, { banco = criarBancoMemoria(), areaSegura = false } = {}) {
  const erros = []
  page.on('pageerror', e => erros.push(String(e)))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|supabase/i.test(m.text())) erros.push(m.text()) })
  if (areaSegura) await simularAreaSegura(page)
  await isolarSupabase(page, { autenticado: true, banco })
  await page.goto('/')
  await expect(page.locator('.af-home-premium')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(2800) // abertura animada
  return erros
}
const foto = async (page, nome, info) => {
  mkdirSync(`capturas-revisao/home-mobile/${info.project.name}`, { recursive: true })
  await page.screenshot({ path: `capturas-revisao/home-mobile/${info.project.name}/${nome}.png`, fullPage: false })
}
const um = info => info.project.name === 'iphone-13-webkit'

for (const [w, h] of TAMANHOS) {
  test(`Home ${w}x${h}: sem overflow, cabeçalho e menu dentro da tela, sem erros`, async ({ page }, info) => {
    test.skip(!um(info), 'um projeto basta (o tamanho é definido aqui)')
    await page.setViewportSize({ width: w, height: h })
    const celular = w < 768
    const erros = await abrirHome(page, { areaSegura: celular })
    const v = await medirViewport(page)
    expect(v.scrollWidth, `vazando: ${v.vazando.join(', ')}`).toBeLessThanOrEqual(v.clientWidth)
    if (celular) {
      const m = await page.evaluate(() => {
        const cab = document.querySelector('header.af-header-mobile').getBoundingClientRect()
        const filhos = [...document.querySelector('header.af-header-mobile').querySelectorAll('img, button, svg')].map(e => e.getBoundingClientRect()).filter(r => r.width > 0)
        const topoUtil = cab.top + parseFloat(getComputedStyle(document.querySelector('header.af-header-mobile')).paddingTop)
        const fora = filhos.filter(r => r.top < topoUtil - 1 || r.bottom > cab.bottom + 1).length
        const nav = document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect()
        return { cabAltura: Math.round(cab.height), fora, navBase: Math.round(innerHeight - nav.bottom), navAltura: Math.round(nav.height) }
      })
      expect(m.cabAltura).toBe(56 + SAFE_TOP) // 56px úteis + área segura
      expect(m.fora, 'logo/avatar vazando do cabeçalho').toBe(0)
      expect(m.navBase).toBe(0)
      // Fim da página: último bloco encosta no menu com respiro pequeno e sem sobreposição.
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(300)
      const fim = await page.evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect()
        const vis = [...document.querySelectorAll('[data-testid="atalhos-home"]')].find(e => e.offsetParent)
        const pers = [...vis.querySelectorAll('button')].find(b => /personalizar/i.test(b.textContent)).getBoundingClientRect()
        return Math.round(nav.top - pers.bottom)
      })
      expect(fim).toBeGreaterThanOrEqual(0)
      expect(fim).toBeLessThanOrEqual(16)
      await foto(page, `home-${w}x${h}-fim`, info)
    } else {
      await expect(page.locator('header.af-header-mobile')).toBeHidden()
      await foto(page, `home-${w}x${h}`, info)
    }
    expect(erros).toEqual([])
  })
}

test('Home com muitos lançamentos: rola até o fim, sem overflow e sem sobreposição', async ({ page }, info) => {
  test.skip(!um(info), 'um projeto basta')
  const banco = criarBancoMemoria({ despesas: despesasDoMes(60) })
  const erros = await abrirHome(page, { banco, areaSegura: true })
  const v = await medirViewport(page)
  expect(v.scrollWidth).toBeLessThanOrEqual(v.clientWidth)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(300)
  const gap = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect()
    const vis = [...document.querySelectorAll('[data-testid="atalhos-home"]')].find(e => e.offsetParent)
    return Math.round(nav.top - vis.getBoundingClientRect().bottom)
  })
  expect(gap).toBeGreaterThanOrEqual(0)
  await foto(page, 'muitos-lancamentos', info)
  expect(erros).toEqual([])
})

test('calendário: dias dentro das células, selecionar dia e "Adicionar lançamento" abrem seus fluxos', async ({ page }, info) => {
  test.skip(!um(info), 'um projeto basta')
  const erros = await abrirHome(page, { areaSegura: true })
  const cal = await page.evaluate(() => {
    const raiz = [...document.querySelectorAll('.af-cal-home')].find(e => e.offsetParent)
    const rr = raiz.getBoundingClientRect()
    const dias = [...raiz.querySelectorAll('.af-cal-day')]
    const fora = dias.filter(d => { const r = d.getBoundingClientRect(); return r.left < rr.left - 1 || r.right > rr.right + 1 }).length
    const estouro = dias.filter(d => d.scrollWidth > d.clientWidth + 1).length
    return { colunas: new Set(dias.map(d => Math.round(d.getBoundingClientRect().left))).size, fora, estouro, total: dias.length }
  })
  expect(cal.colunas).toBe(7)
  expect(cal.fora).toBe(0)
  expect(cal.estouro).toBe(0)
  const raiz = page.locator('.af-cal-home:visible')
  await raiz.locator('.af-cal-day:not(.outro-mes)').nth(9).click()
  await expect.poll(() => page.getByText('Calendário financeiro').count()).toBeGreaterThan(2) // além dos cards da Home (mobile+desktop), o título do modal aberto
  await page.keyboard.press('Escape')
  await page.reload()
  await page.locator('.af-home-premium').waitFor()
  await page.waitForTimeout(2800)
  await page.getByRole('button', { name: /Adicionar lançamento/ }).first().click()
  await expect(page.getByText(/Registrar gasto|Novo gasto|Gasto/i).first()).toBeVisible()
  expect(erros).toEqual([])
})

test('menu inferior: destinos corretos', async ({ page }, info) => {
  test.skip(!um(info), 'um projeto basta')
  await abrirHome(page)
  const nav = page.locator('nav[aria-label="Navegação principal"]')
  await nav.getByRole('link', { name: 'Consultoria' }).click()
  await expect(page).toHaveURL(/\/consultoria$/)
  await nav.getByRole('link', { name: 'Evolução' }).click()
  await expect(page).toHaveURL(/\/minha-evolucao$/)
  await nav.getByRole('link', { name: 'Início' }).click()
  await expect(page).toHaveURL(/\/$/)
})
