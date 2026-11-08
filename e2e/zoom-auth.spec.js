import { test, expect } from '@playwright/test'
import { isolarSupabase, pularApresentacao, medirViewport } from './apoio'

// Diagnóstico do zoom no iPhone: mede o que o Safari recebe em cada tela de
// autenticação (fonte computada dos campos, largura do layout, escala do
// visual viewport antes e depois do foco). Não registra dados digitados.
const TELAS = [
  { rota: '/login', nome: 'Login' },
  { rota: '/cadastro', nome: 'Cadastro' },
  { rota: '/recuperar-senha', nome: 'Recuperar senha' },
]

for (const tela of TELAS) {
  test(`${tela.nome}: campos com fonte >= 16px e sem layout mais largo que a tela`, async ({ page }, info) => {
    await isolarSupabase(page)
    await pularApresentacao(page)
    await page.goto(tela.rota)
    const campos = page.locator('form input')
    await expect(campos.first()).toBeVisible({ timeout: 15_000 })

    const antes = await medirViewport(page)
    expect(antes.vazando, `elementos fora da tela: ${antes.vazando.join(', ')}`).toEqual([])
    expect(antes.scrollWidth).toBeLessThanOrEqual(antes.clientWidth)

    const n = await campos.count()
    for (let i = 0; i < n; i++) {
      const campo = campos.nth(i)
      const tipo = await campo.getAttribute('type')
      await campo.tap?.().catch(() => campo.click())
      await campo.focus()
      const fonte = await campo.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
      const depois = await medirViewport(page)
      info.annotations.push({ type: 'medida', description: `${tela.nome} campo ${i} (${tipo}): fonte ${fonte}px, escala ${depois.escala}, scrollWidth ${depois.scrollWidth}/${depois.clientWidth}` })
      // Toque (iPhone em qualquer orientação): mínimo 16px. Desktop com mouse
      // não tem zoom de foco e mantém o visual compacto de 14px.
      if (info.project.use.hasTouch) expect(fonte, `campo ${i} (${tipo}) em ${tela.nome}`).toBeGreaterThanOrEqual(16)
      else expect(fonte).toBeGreaterThanOrEqual(14)
      expect(depois.escala).toBeCloseTo(1, 2)
      expect(depois.scrollWidth).toBeLessThanOrEqual(depois.clientWidth)
    }
  })
}

test('Toque: campos com utilitários pequenos (text-xs/!text-xs) sobem para 16px; grandes ficam intactos', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'regra só se aplica a dispositivos de toque')
  await isolarSupabase(page)
  await pularApresentacao(page)
  await page.goto('/login')
  await expect(page.locator('form input').first()).toBeVisible({ timeout: 15_000 })
  const fontes = await page.evaluate(() => {
    const criar = cls => {
      const el = document.createElement('input')
      el.className = cls
      document.body.appendChild(el)
      const f = parseFloat(getComputedStyle(el).fontSize)
      el.remove()
      return f
    }
    return {
      textXs: criar('input text-xs'),
      importanteXs: criar('input !py-1.5 !text-xs text-right'),
      semClasseInput: criar('text-sm border'),
      grande: criar('input text-xl font-bold'),
    }
  })
  expect(fontes.textXs).toBeGreaterThanOrEqual(16)
  expect(fontes.importanteXs).toBeGreaterThanOrEqual(16)
  expect(fontes.semClasseInput).toBeGreaterThanOrEqual(16)
  expect(fontes.grande).toBe(20)
})

test('Meta viewport não bloqueia o zoom manual', async ({ page }) => {
  await isolarSupabase(page)
  await page.goto('/login')
  const conteudo = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(conteudo).toContain('width=device-width')
  expect(conteudo).not.toMatch(/user-scalable\s*=\s*(no|0)/)
  expect(conteudo).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/)
})
