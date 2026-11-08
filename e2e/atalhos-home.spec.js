import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, medirViewport } from './apoio'

// Home autenticada com sessão e dados FALSOS (nenhuma chamada ao Supabase real).
// Só a instância visível da faixa (mobile ou desktop) é usada.
function faixa(page) {
  return page.locator('[data-testid="atalhos-home"]:visible')
}

async function abrirHome(page, opcoes = {}) {
  const ctx = await isolarSupabase(page, { autenticado: true, ...opcoes })
  await page.goto('/')
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  return ctx
}

const PADRAO = ['simular-compra', 'e-se', 'investimentos', 'metas', 'cartoes', 'calendario',
  'registrar-gasto', 'consultoria', 'parcelamentos', 'projecao', 'gastar-hoje']

async function idsVisiveis(page) {
  return faixa(page).locator('[data-atalho]').evaluateAll(els => els.map(e => e.dataset.atalho))
}

test('ordem padrão começa pelos 4 atalhos originais e não há importação (ainda inexistente)', async ({ page }) => {
  await abrirHome(page)
  const ids = await idsVisiveis(page)
  expect(ids).toEqual(PADRAO)
  expect(ids).not.toContain('importacao')
})

test('faixa rola na horizontal sem alargar a página e sem bloquear rolagem vertical', async ({ page }) => {
  await abrirHome(page)
  const trilho = faixa(page).getByTestId('atalhos-trilho')
  const info = await trilho.evaluate(el => ({
    rola: el.scrollWidth > el.clientWidth,
    touchAction: getComputedStyle(el).touchAction,
    snap: getComputedStyle(el).scrollSnapType,
  }))
  expect(info.rola).toBe(true)
  expect(info.touchAction).toBe('manipulation') // permite pan vertical e pinch-zoom
  expect(info.snap).toContain('x')
  const m = await medirViewport(page)
  expect(m.scrollWidth, `elementos vazando: ${m.vazando.join(', ')}`).toBeLessThanOrEqual(m.clientWidth)
})

test('mobile: parte do próximo card visível, indicadores e dica "Deslize para ver mais"', async ({ page }, info) => {
  // Layout mobile da Home vai até 767px; acima disso (ex.: iPhone em paisagem
  // a 844px) vale o layout de tablet/desktop, com setas no lugar da dica.
  test.skip(!info.project.use.isMobile || info.project.use.viewport.width >= 768, 'layout mobile (< 768px)')
  await abrirHome(page)
  const trilho = faixa(page).getByTestId('atalhos-trilho')
  const parcial = await trilho.evaluate(el => {
    const r = el.getBoundingClientRect()
    return [...el.querySelectorAll('[data-atalho]')].some(c => {
      const b = c.getBoundingClientRect()
      return b.left < r.right && b.right > r.right
    })
  })
  expect(parcial).toBe(true)
  const dica = faixa(page).getByTestId('atalhos-dica')
  await expect(dica).toBeVisible()
  const dots = faixa(page).locator('.af-shortcut-dot')
  expect(await dots.count()).toBeGreaterThan(1)
  await expect(dots.first()).toHaveAttribute('data-ativo', 'true')

  await trilho.evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }))
  await expect(dots.last()).toHaveAttribute('data-ativo', 'true')
  await expect(dica).toHaveCount(0) // some após a interação
})

test('desktop/tablet: setas aparecem só com conteúdo oculto e somem nas extremidades', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 768, 'layout com setas (>= 768px)')
  await abrirHome(page)
  const esq = faixa(page).getByTestId('atalhos-seta-esquerda')
  const dir = faixa(page).getByTestId('atalhos-seta-direita')
  await expect(esq).toHaveCount(0)
  await expect(dir).toBeVisible()
  await dir.click()
  await expect(esq).toBeVisible()
  await faixa(page).getByTestId('atalhos-trilho').evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'auto' }))
  await expect(dir).toHaveCount(0)
  await expect(esq).toBeVisible()
})

test('cada atalho executa sua ação real (rota ou modal existente)', async ({ page }) => {
  await abrirHome(page)
  const rotas = {
    'simular-compra': /\/posso-comprar$/,
    'e-se': /\/e-se$/,
    investimentos: /\/investimentos$/,
    metas: /\/metas$/,
    cartoes: /\/cartoes$/,
    consultoria: /\/consultoria$/,
    parcelamentos: /\/despesas$/, // ?aba=parceladas é consumido pela página
    projecao: /\/projecao$/,
  }
  for (const [id, rota] of Object.entries(rotas)) {
    await page.goto('/')
    const botao = faixa(page).locator(`[data-atalho="${id}"]`)
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    await expect(page, `atalho ${id}`).toHaveURL(rota)
  }
  const modais = { calendario: 'Calendário financeiro', 'registrar-gasto': 'Gasto rápido', 'gastar-hoje': 'Planejamento completo' }
  for (const [id, titulo] of Object.entries(modais)) {
    await page.goto('/')
    const botao = faixa(page).locator(`[data-atalho="${id}"]`)
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    const dialogo = page.locator('div.fixed.inset-0.z-50').filter({ has: page.getByRole('heading', { name: titulo, exact: true }) })
    await expect(dialogo, `modal de ${id}`).toBeVisible()
  }
})

test('parcelamentos abre a aba Parceladas', async ({ page }) => {
  await abrirHome(page)
  const botao = faixa(page).locator('[data-atalho="parcelamentos"]')
  await botao.scrollIntoViewIfNeeded()
  await botao.click()
  await expect(page).toHaveURL(/\/despesas$/)
  await expect(page.getByRole('heading', { name: 'Acompanhamento de parcelas' })).toBeVisible()
})

test('personalizar: ocultar, favoritar, reordenar, salvar no perfil e restaurar padrão', async ({ page }) => {
  const ctx = await abrirHome(page)
  await faixa(page).getByTestId('atalhos-personalizar').click()
  const lista = page.getByTestId('lista-personalizar-atalhos')
  await expect(lista).toBeVisible()

  await lista.getByRole('button', { name: 'Ocultar Consultoria' }).click()
  await lista.getByRole('button', { name: 'Favoritar Cartões' }).click()
  await lista.getByRole('button', { name: 'Mover E se...? para baixo' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(lista).toHaveCount(0)

  const ids = await idsVisiveis(page)
  expect(ids[0]).toBe('cartoes') // favorito primeiro
  expect(ids).not.toContain('consultoria')
  expect(ids.indexOf('investimentos')).toBeLessThan(ids.indexOf('e-se'))

  // Gravado no Supabase (PATCH em perfis) com a config normalizada.
  const escrita = ctx.escritasPerfil.find(e => e.atalhos_home)
  expect(escrita).toBeTruthy()
  expect(escrita.atalhos_home.ocultos).toEqual(['consultoria'])
  expect(escrita.atalhos_home.favoritos).toEqual(['cartoes'])

  // Persistência após recarregar (perfil devolvido pelo "banco").
  await page.reload()
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  expect((await idsVisiveis(page))[0]).toBe('cartoes')

  // Restaurar padrão.
  await faixa(page).getByTestId('atalhos-personalizar').click()
  await page.getByRole('button', { name: 'Restaurar padrão' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect.poll(() => idsVisiveis(page)).toEqual(PADRAO)
})

test('sem a coluna atalhos_home no banco (migration pendente) a preferência fica no aparelho', async ({ page }) => {
  await abrirHome(page, { colunaAtalhosAusente: true })
  await faixa(page).getByTestId('atalhos-personalizar').click()
  await page.getByTestId('lista-personalizar-atalhos').getByRole('button', { name: 'Ocultar Metas' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect.poll(async () => (await idsVisiveis(page)).includes('metas')).toBe(false)
  await page.reload()
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  expect(await idsVisiveis(page)).not.toContain('metas')
})

test('preferência salva no perfil é recuperada em novo login', async ({ page }) => {
  await abrirHome(page, {
    perfil: perfilFalso({ atalhos_home: { versao: 1, ordem: PADRAO, ocultos: ['e-se'], favoritos: ['projecao'] } }),
  })
  const ids = await idsVisiveis(page)
  expect(ids[0]).toBe('projecao')
  expect(ids).not.toContain('e-se')
})
