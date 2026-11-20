// @ts-check
// Layout nas 5 resoluções de referência, com dados de exemplo.
// Falha se: a página rolar na horizontal, ou algum elemento sair da tela sem
// estar dentro de um trilho com rolagem própria (carrossel), de um card que o
// recorta de propósito ou de um painel fixo fora da tela (menu fechado).
// Roda só no projeto desktop-chromium: cada teste define o próprio viewport.
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'
import { DADOS } from './dados-exemplo.js'

const RESOLUCOES = [[360, 800], [375, 812], [768, 1024], [1366, 768], [1920, 1080]]
const PAGINAS = ['/', '/receitas', '/despesas', '/cartoes', '/cartoes?cartao=c1', '/projecao', '/mais']

/** Lista elementos que saem da tela, já classificados. Roda no navegador. */
function vazamentos() {
  const vw = document.documentElement.clientWidth
  const descr = el => `${el.tagName.toLowerCase()}.${String(el.className?.baseVal ?? el.className).trim().split(/\s+/).slice(0, 5).join('.')}`
  const reais = []
  let intencionais = 0
  for (const el of document.querySelectorAll('body *')) {
    if (el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') continue
    const b = el.getBoundingClientRect()
    if (b.width === 0 || b.height === 0 || !(b.right > vw + 1 || b.left < -1)) continue
    let intencional = false
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p)
      if (s.position === 'fixed' && (s.transform !== 'none' || s.translate !== 'none')) { intencional = true; break }
      if (['auto', 'scroll'].includes(s.overflowX)) { intencional = true; break }
      if (['hidden', 'clip'].includes(s.overflowX)) {
        // Recorte por um card é intencional; recorte pela raiz esconde conteúdo.
        intencional = p.getBoundingClientRect().width < vw - 1
        break
      }
    }
    if (intencional) intencionais++
    else reais.push(`${descr(el)} [${Math.round(b.left)}→${Math.round(b.right)}] "${(el.textContent || '').trim().slice(0, 30)}"`)
  }
  return { vw, scrollWidth: document.documentElement.scrollWidth, reais, intencionais }
}

test.describe('Responsividade', () => {
  test.beforeEach(() => { test.skip(test.info().project.name !== 'desktop-chromium', 'viewport definido por teste') })

  for (const tema of ['claro', 'escuro']) {
    for (const [w, h] of RESOLUCOES) {
      test(`${w}×${h} tema ${tema}: sem rolagem horizontal nem conteúdo cortado`, async ({ browser }) => {
        test.setTimeout(90_000)
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768 })
        const page = await ctx.newPage()
        await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-03:00'))
        await isolarSupabase(page, { autenticado: true, perfil: perfilFalso({ saldo_base: 5000, cor_tema: tema }), banco: criarBancoMemoria(DADOS) })
        const problemas = []
        for (const rota of PAGINAS) {
          await page.goto(rota)
          await page.locator('.splash-bar').waitFor({ state: 'detached' })
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(300)
          const r = await page.evaluate(vazamentos)
          console.log(`${w}x${h} ${tema} ${rota.padEnd(18)} rolagem ${r.scrollWidth}/${r.vw} | cortados ${r.reais.length} | em trilho/card ${r.intencionais}`)
          if (r.scrollWidth > r.vw) problemas.push(`${rota}: rolagem horizontal (${r.scrollWidth}px > ${r.vw}px)`)
          for (const x of r.reais) problemas.push(`${rota}: ${x}`)
        }
        await ctx.close()
        expect(problemas, problemas.join('\n')).toEqual([])
      })
    }
  }
})
