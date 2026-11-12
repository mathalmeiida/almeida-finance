import { test, expect } from '@playwright/test'
import { isolarSupabase, medirViewport } from './apoio'
import { mkdirSync } from 'node:fs'

// Seis páginas largas no desktop (Configurações, Todas as funcionalidades,
// Ajuda, Perfil, Sobre, Importação) e o layout vertical preservado no celular.
const LARGURAS = [[1920, 1080], [1440, 900], [1366, 768], [1024, 768]]

const caixa = (page, sel) => page.locator(sel).first().evaluate(el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } })
const filhos = (page, sel) => page.locator(sel).first().evaluate(el => [...el.children].filter(c => c.offsetParent).map(c => { const r = c.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) } }))
const colunasDistintas = lista => new Set(lista.map(i => Math.round(i.x / 20))).size
async function larguraUtil(page) { return page.evaluate(() => { const r = document.querySelector('main').getBoundingClientRect(); return Math.round(r.width) }) }
async function semOverflow(page) { const v = await medirViewport(page); expect(v.scrollWidth, `vazando: ${v.vazando.join(', ')}`).toBeLessThanOrEqual(v.clientWidth) }

async function abrir(page, rota, esperar) {
  const erros = []
  page.on('pageerror', e => erros.push(String(e)))
  await isolarSupabase(page, { autenticado: true })
  await page.goto(rota)
  await expect(page.locator(esperar).first()).toBeVisible({ timeout: 20_000 })
  await page.waitForTimeout(1800)
  return erros
}
const foto = async (page, nome, info, w) => {
  if (!process.env.CAPTURAS) return
  mkdirSync(`capturas-revisao/desktop/${info.project.name}`, { recursive: true })
  await page.screenshot({ path: `capturas-revisao/desktop/${info.project.name}/${nome}-${w}.png`, fullPage: true })
}
const desktop = info => info.project.name === 'desktop-chromium'
const celular = info => info.project.name === 'iphone-13-webkit'

const PAGINAS = {
  funcionalidades: ['/mais/funcionalidades', '[data-testid="funcionalidades-grade"]'],
  ajuda: ['/mais/ajuda', '[data-testid="ajuda-colunas"]'],
  perfil: ['/mais/perfil', '[data-testid="perfil-colunas"]'],
  sobre: ['/mais/sobre', '[data-testid="sobre-cabecalho"]'],
  importacao: ['/importacao', '[data-testid="importacao-colunas"]'],
  config: ['/configuracoes', '[data-testid="config-zona-perigo"]'],
}

for (const [w, h] of LARGURAS) {
  test(`desktop ${w}px: seis páginas aproveitam a largura, em colunas e sem overflow`, async ({ page }, info) => {
    test.skip(!desktop(info), 'só desktop')
    await page.setViewportSize({ width: w, height: h })
    const util = async () => larguraUtil(page)

    // 2. Todas as funcionalidades: 3 colunas (≥1280), 2 no 1024
    let erros = await abrir(page, ...PAGINAS.funcionalidades)
    const f = await filhos(page, PAGINAS.funcionalidades[1])
    expect(f.length).toBeGreaterThanOrEqual(5)
    expect(colunasDistintas(f)).toBe(w >= 1280 ? 3 : 2)
    const gf = await caixa(page, PAGINAS.funcionalidades[1])
    expect(gf.w).toBeGreaterThanOrEqual((await util()) * 0.9)
    await semOverflow(page); await foto(page, 'funcionalidades', info, w)
    expect(erros).toEqual([])

    // 3. Ajuda: FAQ esquerda / Como usar direita
    await abrir(page, ...PAGINAS.ajuda)
    const a = await filhos(page, PAGINAS.ajuda[1])
    expect(a).toHaveLength(2)
    expect(a[1].x).toBeGreaterThan(a[0].x + a[0].w - 5)
    expect(Math.abs(a[0].y - a[1].y)).toBeLessThan(4)
    await page.getByRole('button', { name: 'Como funciona o limite diário?' }).click()
    await expect(page.getByText('dividido pelos dias restantes')).toBeVisible()
    await semOverflow(page); await foto(page, 'ajuda', info, w)

    // 4. Perfil: cabeçalho amplo + dados à esquerda / segurança à direita
    await abrir(page, ...PAGINAS.perfil)
    const p = await filhos(page, PAGINAS.perfil[1])
    expect(p).toHaveLength(2)
    expect(p[1].x).toBeGreaterThan(p[0].x + p[0].w - 5)
    const cab = await page.locator('main .card').first().evaluate(el => Math.round(el.getBoundingClientRect().width))
    expect(cab).toBeGreaterThanOrEqual((await util()) * 0.9)
    await semOverflow(page); await foto(page, 'perfil', info, w)

    // 5. Sobre: cabeçalho horizontal + duas colunas
    await abrir(page, ...PAGINAS.sobre)
    const cs = await caixa(page, PAGINAS.sobre[1])
    expect(cs.w).toBeGreaterThanOrEqual((await util()) * 0.9)
    const logo = await caixa(page, '[data-testid="sobre-cabecalho"] img')
    const titulo = await caixa(page, '[data-testid="sobre-cabecalho"] h2')
    expect(titulo.x).toBeGreaterThan(logo.x + logo.w - 5) // horizontal: logo ao lado do texto
    await expect(page.getByTestId('sobre-versao-desktop')).toBeVisible()
    const secoes = await page.locator('section[aria-label="Principais funcionalidades"], section[aria-label="Privacidade"]').evaluateAll(l => l.map(e => Math.round(e.getBoundingClientRect().left)))
    expect(new Set(secoes.map(x => Math.round(x / 20))).size).toBe(2)
    await semOverflow(page); await foto(page, 'sobre', info, w)

    // 6. Importação: container largo, 3 opções lado a lado, formulário + arquivo em 2 colunas
    await abrir(page, ...PAGINAS.importacao)
    const imp = await caixa(page, '[data-testid="importacao"]')
    expect(imp.w).toBeGreaterThanOrEqual((await util()) * 0.9)
    const ops = await page.getByRole('radio').evaluateAll(l => l.map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top) } }))
    expect(ops).toHaveLength(3)
    expect(new Set(ops.map(o => o.y)).size).toBe(1)
    const ic = await filhos(page, PAGINAS.importacao[1])
    expect(ic).toHaveLength(2)
    expect(ic[1].x).toBeGreaterThan(ic[0].x + ic[0].w - 5)
    await expect(page.getByTestId('importacao-arquivo')).toHaveCount(1)
    await semOverflow(page); await foto(page, 'importacao', info, w)

    // 1. Configurações: apagar à esquerda, encerrar à direita, sobre abaixo em largura total
    await abrir(page, ...PAGINAS.config)
    const z = await filhos(page, PAGINAS.config[1])
    expect(z).toHaveLength(2)
    expect(z[1].x).toBeGreaterThan(z[0].x + z[0].w - 5)
    expect(Math.abs(z[0].y - z[1].y)).toBeLessThan(4)
    const grade = await caixa(page, PAGINAS.config[1])
    const sobre = await caixa(page, 'div.card:has(h2:text-is("Sobre o Almeida Finance"))')
    expect(sobre.w).toBeGreaterThanOrEqual(grade.w - 2)
    expect(sobre.y).toBeGreaterThan(z[0].y)
    await expect(page.getByRole('button', { name: 'Apagar dados financeiros' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Encerrar minha conta' })).toBeVisible()
    await semOverflow(page); await foto(page, 'configuracoes', info, w)
  })
}

test('celular 390px: seis páginas continuam em uma coluna, sem overflow', async ({ page }, info) => {
  test.skip(!celular(info), 'só celular')
  for (const [nome, [rota, seletor]] of Object.entries(PAGINAS)) {
    await abrir(page, rota, seletor)
    const f = nome === 'sobre' ? [] : await filhos(page, seletor)
    if (f.length > 1 && nome !== 'config') expect(colunasDistintas(f), nome).toBe(1)
    if (nome === 'config') expect(colunasDistintas(await filhos(page, seletor))).toBe(1)
    await semOverflow(page)
  }
  await abrir(page, ...PAGINAS.sobre)
  await expect(page.getByTestId('sobre-versao-desktop')).toBeHidden()
  await expect(page.locator('section[aria-label="Informações do aplicativo"]')).toBeVisible()
})
