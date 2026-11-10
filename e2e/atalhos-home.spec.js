import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, medirViewport } from './apoio'

// Home autenticada com sessão e dados FALSOS (nenhuma chamada ao Supabase real).
// Celular (< 768 px): faixa deslizante com todos os atalhos.
// Computador (>= 768 px): grade com os 5 atalhos principais.
function faixa(page) {
  return page.locator('[data-testid="atalhos-home"]:visible')
}
const ehDesktop = info => info.project.use.viewport.width >= 768

async function abrirHome(page, opcoes = {}) {
  const ctx = await isolarSupabase(page, { autenticado: true, ...opcoes })
  await page.goto('/')
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  return ctx
}

const PADRAO = ['receitas', 'despesas', 'registrar-gasto', 'simular-compra', 'calendario', 'gastar-hoje',
  'consultoria', 'investimentos', 'metas', 'cartoes', 'e-se', 'importacao', 'parcelamentos', 'projecao']
const DESKTOP = ['registrar-gasto', 'simular-compra', 'calendario', 'gastar-hoje', 'consultoria']

async function idsVisiveis(page) {
  return faixa(page).locator('[data-atalho]').evaluateAll(els => els.map(e => e.dataset.atalho))
}

test('ordem padrão: celular com Receitas e Despesas primeiro; computador com os 5 principais', async ({ page }, info) => {
  await abrirHome(page)
  expect(await idsVisiveis(page)).toEqual(ehDesktop(info) ? DESKTOP : PADRAO)
})

test('celular: faixa rola na horizontal sem alargar a página e sem bloquear rolagem vertical', async ({ page }, info) => {
  test.skip(ehDesktop(info), 'faixa deslizante só no celular')
  await abrirHome(page)
  const trilho = faixa(page).getByTestId('atalhos-trilho')
  const r = await trilho.evaluate(el => ({
    rola: el.scrollWidth > el.clientWidth,
    touchAction: getComputedStyle(el).touchAction,
    snap: getComputedStyle(el).scrollSnapType,
  }))
  expect(r.rola).toBe(true)
  expect(r.touchAction).toBe('manipulation')
  expect(r.snap).toContain('x')
  const m = await medirViewport(page)
  expect(m.scrollWidth, `elementos vazando: ${m.vazando.join(', ')}`).toBeLessThanOrEqual(m.clientWidth)
})

test('celular: parte do próximo card visível, indicadores e dica "Deslize para ver mais"', async ({ page }, info) => {
  test.skip(ehDesktop(info), 'layout mobile (< 768px)')
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
  await expect(dica).toHaveCount(0)
})

test('computador: 5 cards alinhados, do mesmo tamanho, sem texto cortado e sem setas', async ({ page }, info) => {
  test.skip(!ehDesktop(info), 'grade só no computador')
  await abrirHome(page)
  const cards = faixa(page).locator('[data-atalho]')
  await expect(cards).toHaveCount(5)
  const caixas = await cards.evaluateAll(els => els.map(e => {
    const r = e.getBoundingClientRect(); const s = e.querySelector('span')
    return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), cortado: s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1 }
  }))
  expect(new Set(caixas.map(c => c.top)).size).toBe(1)
  expect(Math.max(...caixas.map(c => c.w)) - Math.min(...caixas.map(c => c.w))).toBeLessThanOrEqual(1)
  expect(new Set(caixas.map(c => c.h)).size).toBe(1)
  expect(caixas.some(c => c.cortado)).toBe(false)
  await expect(faixa(page).getByTestId('atalhos-seta-direita')).toHaveCount(0)
  const m = await medirViewport(page)
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth)
})

test('computador: menu lateral continua com Investimentos, Metas, Cartões, Projeção e Receitas', async ({ page }, info) => {
  test.skip(info.project.use.viewport.width < 1024, 'menu lateral só aparece em telas largas')
  await abrirHome(page)
  for (const nome of ['Investimentos', 'Metas', 'Cartões', 'Projeção', 'Receitas', 'Despesas', 'Importação']) {
    await expect(page.getByRole('link', { name: nome, exact: true }).first()).toBeAttached()
  }
})

test('cada atalho visível executa sua ação (rota ou modal) e nenhum repete destino', async ({ page }) => {
  await abrirHome(page)
  const rotas = {
    receitas: /\/receitas$/, despesas: /\/despesas$/, 'simular-compra': /\/posso-comprar$/, 'e-se': /\/e-se$/,
    investimentos: /\/investimentos$/, metas: /\/metas$/, cartoes: /\/cartoes$/, consultoria: /\/consultoria$/,
    parcelamentos: /\/despesas$/, projecao: /\/projecao$/, importacao: /\/importacao$/,
  }
  const modais = { calendario: 'Calendário financeiro', 'registrar-gasto': 'Gasto rápido', 'gastar-hoje': 'Planejamento completo' }
  const visiveis = await idsVisiveis(page)
  for (const id of visiveis) {
    await page.goto('/')
    const botao = faixa(page).locator(`[data-atalho="${id}"]`)
    await botao.scrollIntoViewIfNeeded()
    await botao.click()
    if (rotas[id]) await expect(page, `atalho ${id}`).toHaveURL(rotas[id])
    else {
      const dialogo = page.locator('div.fixed.inset-0.z-50').filter({ has: page.getByRole('heading', { name: modais[id], exact: true }) })
      await expect(dialogo, `modal de ${id}`).toBeVisible()
    }
  }
})

test('celular: Despesas abre a lista e Parcelamentos abre a seção de parcelas (destinos distintos)', async ({ page }, info) => {
  test.skip(ehDesktop(info), 'esses atalhos ficam no celular')
  await abrirHome(page)
  await faixa(page).locator('[data-atalho="despesas"]').click()
  await expect(page).toHaveURL(/\/despesas$/)
  await expect(page.getByRole('heading', { name: 'Acompanhamento de parcelas' })).toHaveCount(0)
  await page.goto('/')
  const botao = faixa(page).locator('[data-atalho="parcelamentos"]')
  await botao.scrollIntoViewIfNeeded()
  await botao.click()
  await expect(page.getByRole('heading', { name: 'Acompanhamento de parcelas' })).toBeVisible()
})

test('personalizar: ocultar, favoritar, reordenar, salvar no perfil e restaurar padrão', async ({ page }, info) => {
  const ctx = await abrirHome(page)
  await faixa(page).getByTestId('atalhos-personalizar').click()
  const lista = page.getByTestId('lista-personalizar-atalhos')
  await expect(lista).toBeVisible()
  await lista.getByRole('button', { name: 'Ocultar Calendário' }).click()
  await lista.getByRole('button', { name: 'Favoritar Consultoria' }).click()
  await lista.getByRole('button', { name: 'Mover Simular compra para baixo' }).click()
  await lista.getByRole('button', { name: 'Mover Simular compra para baixo' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(lista).toHaveCount(0)

  const ids = await idsVisiveis(page)
  expect(ids[0]).toBe('consultoria')
  expect(ids).not.toContain('calendario')
  expect(ids.indexOf('gastar-hoje')).toBeLessThan(ids.indexOf('simular-compra'))
  const escrita = ctx.escritasPerfil.find(e => e.atalhos_home)
  expect(escrita.atalhos_home).toMatchObject({ versao: 2, ocultos: ['calendario'], favoritos: ['consultoria'] })

  await page.reload()
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  expect((await idsVisiveis(page))[0]).toBe('consultoria')

  await faixa(page).getByTestId('atalhos-personalizar').click()
  await page.getByRole('button', { name: 'Restaurar padrão' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect.poll(() => idsVisiveis(page)).toEqual(ehDesktop(info) ? DESKTOP : PADRAO)
})

test('sem a coluna atalhos_home no banco (migration pendente) a preferência fica no aparelho', async ({ page }) => {
  await abrirHome(page, { colunaAtalhosAusente: true })
  await faixa(page).getByTestId('atalhos-personalizar').click()
  await page.getByTestId('lista-personalizar-atalhos').getByRole('button', { name: 'Ocultar Consultoria' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect.poll(async () => (await idsVisiveis(page)).includes('consultoria')).toBe(false)
  await page.reload()
  await expect(faixa(page)).toBeVisible({ timeout: 20_000 })
  expect(await idsVisiveis(page)).not.toContain('consultoria')
})

test('preferência salva é recuperada em novo login; configuração antiga ganha Receitas e Despesas', async ({ page }, info) => {
  await abrirHome(page, {
    perfil: perfilFalso({ atalhos_home: { versao: 1, ordem: ['metas', 'gastar-hoje', 'simular-compra'], ocultos: ['simular-compra'], favoritos: ['gastar-hoje'] } }),
  })
  const ids = await idsVisiveis(page)
  expect(ids[0]).toBe('gastar-hoje')
  expect(ids).not.toContain('simular-compra')
  if (!ehDesktop(info)) expect(ids.slice(1, 4)).toEqual(['receitas', 'despesas', 'metas'])
})
