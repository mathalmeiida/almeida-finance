import { test, expect } from '@playwright/test'
import { isolarSupabase, medirViewport } from './apoio'

// Layout da Home no celular (iPhone/PWA): sem vão entre o último bloco e o
// menu inferior, fundo contínuo, carrossel com ~4 atalhos e parte do próximo.
async function abrirHome(page) {
  await isolarSupabase(page, { autenticado: true })
  await page.goto('/')
  await expect(page.locator('[data-testid="atalhos-home"]:visible')).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(2500) // splash
}
const ehCelular = info => info.project.use.viewport.width < 768

test('menu inferior: fixo, sem vão excessivo e sem rolagem horizontal da página', async ({ page }, info) => {
  test.skip(!ehCelular(info), 'layout do celular')
  await abrirHome(page)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const m = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegação principal"]')
    const home = document.querySelector('.af-home-premium')
    const rn = nav.getBoundingClientRect(), rh = home.getBoundingClientRect()
    return { navAltura: Math.round(rn.height), navFundo: Math.round(innerHeight - rn.bottom), pos: getComputedStyle(nav).position, vao: Math.round(rn.top - rh.bottom) }
  })
  console.log('LAYOUT', JSON.stringify(m))
  expect(m.pos).toBe('fixed')
  expect(m.navFundo).toBe(0)
  expect(m.vao).toBeGreaterThanOrEqual(0)
  expect(m.vao).toBeLessThanOrEqual(24) // antes: ~35 px de vão
  const v = await medirViewport(page)
  expect(v.scrollWidth, `vazando: ${v.vazando.join(', ')}`).toBeLessThanOrEqual(v.clientWidth)
})

test('fundo da Home contínuo (margens e área abaixo) e restaurado ao sair', async ({ page }, info) => {
  test.skip(!ehCelular(info), 'layout do celular')
  await abrirHome(page)
  const fundoHome = await page.evaluate(() => getComputedStyle(document.querySelector('.af-home-premium')).backgroundColor)
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(fundoHome)
  await page.goto('/receitas')
  await page.waitForTimeout(500)
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(fundoHome)
})

test('tela alta (iPhone Pro Max): conteúdo curto não deixa faixa clara acima do menu', async ({ page }, info) => {
  test.skip(!ehCelular(info) || info.project.name !== 'iphone-13-webkit', 'um só aparelho basta')
  await page.setViewportSize({ width: 430, height: 932 })
  await abrirHome(page)
  const cores = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Navegação principal"]').getBoundingClientRect()
    const home = getComputedStyle(document.querySelector('.af-home-premium')).backgroundColor
    const el = document.elementFromPoint(8, nav.top - 6)
    // sobe até um ancestral com fundo próprio
    let n = el, cor = 'rgba(0, 0, 0, 0)'
    while (n && cor === 'rgba(0, 0, 0, 0)') { cor = getComputedStyle(n).backgroundColor; n = n.parentElement }
    return { home, acima: cor }
  })
  expect(cores.acima).toBe(cores.home)
})

test('atalhos no celular: ~4 cards inteiros e parte do próximo; deslizar continua funcionando', async ({ page }, info) => {
  test.skip(!ehCelular(info), 'carrossel do celular')
  await abrirHome(page)
  const trilho = page.locator('[data-testid="atalhos-home"]:visible').getByTestId('atalhos-trilho')
  const r = await trilho.evaluate(el => {
    const area = el.getBoundingClientRect()
    const cards = [...el.querySelectorAll('[data-atalho]')].map(c => c.getBoundingClientRect())
    const inteiros = cards.filter(b => b.left >= area.left - 1 && b.right <= area.right + 1).length
    const parcial = cards.some(b => b.left < area.right - 1 && b.right > area.right + 1)
    return { inteiros, parcial, largura: Math.round(cards[0].width), rola: el.scrollWidth > el.clientWidth }
  })
  console.log('CARDS', JSON.stringify({ largura: info.project.use.viewport.width, ...r }))
  expect(r.rola).toBe(true)
  expect(r.parcial).toBe(true)
  expect(r.inteiros).toBeGreaterThanOrEqual(info.project.use.viewport.width >= 375 ? 4 : 3)
  await trilho.evaluate(el => el.scrollTo({ left: 400, behavior: 'auto' }))
  expect(await trilho.evaluate(el => el.scrollLeft)).toBeGreaterThan(100)
})
