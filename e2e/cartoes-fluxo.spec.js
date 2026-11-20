// @ts-check
// Fluxo real da aba Cartões, com valores esperados calculados à mão.
// Cartão: limite 5.000,00, fecha dia 20, vence dia 28. Hoje fixo: 10/11/2026.
// Tudo roda contra o banco em memória de e2e/apoio.js (nada chega ao Supabase).
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso, USUARIO_TESTE } from './apoio.js'

const HOJE = new Date('2026-11-10T12:00:00-03:00')
const CARTAO = {
  id: 'cartao-visa', usuario_id: USUARIO_TESTE.id, nome: 'Visa Teste', banco: null,
  limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28, cor: '#6366f1', criado_em: '2026-11-01T00:00:00Z',
}
const brl = v => new RegExp(`R\\$\\s*${v.replace('.', '\\.')}`)

async function abrirFatura(page) {
  await page.goto('/cartoes')
  await page.getByRole('button', { name: 'Ver fatura' }).click()
  await expect(page.getByRole('heading', { name: CARTAO.nome })).toBeVisible()
}

async function registrarCompra(page, { descricao, valorCentavos, data, parcelas = 1 }) {
  await page.getByRole('button', { name: /Registrar compra/ }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.locator('input[name="descricao"]').fill(descricao)
  const valor = modal.locator('input[inputmode="numeric"]').first()
  await valor.click()
  await valor.pressSequentially(String(valorCentavos))
  await modal.locator('input[name="data_compra"]').fill(data)
  if (parcelas > 1) {
    await modal.getByText('Parcelada', { exact: true }).click()
    await modal.locator('select[name="numero_parcelas"]').selectOption(String(parcelas))
  }
  await modal.getByRole('button', { name: 'Salvar compra' }).click()
  await expect(modal).toBeHidden()
}

const faturaAtual = page => page.getByRole('button', { name: /Fatura do ciclo atual/ })
const cicloSeguinte = page => page.getByRole('button', { name: /Ciclo seguinte/ })
const limiteDisponivel = page => page.locator('#detalhes-cartao')
const linhaCompra = (page, texto) => page.locator('#compras-cartao .card .flex.items-center.justify-between.gap-3').filter({ hasText: texto })

test.describe('Cartões — fluxo completo', () => {
  test.use({ actionTimeout: 10_000 })
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(HOJE) })

  test('navegação: Ver fatura → Registrar compra; recarregar mantém a fatura aberta', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    await abrirFatura(page)
    await expect(page.getByRole('button', { name: /Registrar compra/ })).toBeVisible()
    await expect(page).toHaveURL(/\/cartoes\?cartao=cartao-visa/)
    await page.reload()
    await expect(page.getByRole('heading', { name: CARTAO.nome })).toBeVisible()
    await page.getByRole('button', { name: /Voltar aos cartões/ }).click()
    await expect(page.getByRole('button', { name: 'Ver fatura' })).toBeVisible()
    await expect(page).toHaveURL(/\/cartoes$/)
    // O botão Voltar do navegador também retorna à fatura e depois à lista.
    await page.goBack()
    await expect(page.getByRole('heading', { name: CARTAO.nome })).toBeVisible()
  })

  test('à vista, 3x, 12x, fechamento, edição, exclusão e persistência', async ({ page }) => {
    test.setTimeout(150_000)
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    await abrirFatura(page)

    // 1) À vista 300,00 em 12/11 → ciclo de novembro.
    await registrarCompra(page, { descricao: 'Mercado', valorCentavos: 30000, data: '2026-11-12' })
    await expect(faturaAtual(page)).toContainText(brl('300,00'))
    await expect(limiteDisponivel(page)).toContainText(brl('4.700,00'))

    // 2) 3x de 1.200,00 em 15/11 → 400,00 em nov, dez e jan.
    await registrarCompra(page, { descricao: 'Celular', valorCentavos: 120000, data: '2026-11-15', parcelas: 3 })
    await expect(faturaAtual(page)).toContainText(brl('700,00'))
    await expect(cicloSeguinte(page)).toContainText(brl('400,00'))

    // 3) 12x de 1.000,00 em 21/11 (depois do fechamento) → começa em dezembro.
    await registrarCompra(page, { descricao: 'Notebook', valorCentavos: 100000, data: '2026-11-21', parcelas: 12 })
    await expect(faturaAtual(page)).toContainText(brl('700,00'))
    await expect(cicloSeguinte(page)).toContainText(brl('483,33'))

    // 4) À vista 50,00 NO dia do fechamento (20/11) → ainda em novembro.
    await registrarCompra(page, { descricao: 'Farmácia', valorCentavos: 5000, data: '2026-11-20' })
    await expect(faturaAtual(page)).toContainText(brl('750,00'))
    // Comprometido = 300 + 1.200 + 1.000 + 50 = 2.550 → disponível 2.450.
    await expect(limiteDisponivel(page)).toContainText(brl('2.450,00'))

    const compras = banco.linhas('compras_cartao')
    expect(compras.map(c => [c.descricao, c.valor_total, c.numero_parcelas, c.cartao_id])).toEqual([
      ['Mercado', 300, 1, CARTAO.id], ['Celular', 1200, 3, CARTAO.id],
      ['Notebook', 1000, 12, CARTAO.id], ['Farmácia', 50, 1, CARTAO.id],
    ])
    expect(banco.linhas('despesas')).toHaveLength(0)

    // Faturas futuras: a 12ª parcela (nov/2027) leva o ajuste de centavos.
    await page.getByRole('button', { name: 'Ver mais meses' }).click()
    await page.getByRole('button', { name: 'Ver mais meses' }).click()
    const futuras = page.locator('#faturas-cartao .grid > button')
    await expect(futuras.nth(2)).toContainText(brl('483,33')) // jan/27
    await expect(futuras.nth(3)).toContainText(brl('83,33'))  // fev/27
    await expect(futuras.nth(12)).toContainText(brl('83,37')) // nov/27
    await expect(futuras.nth(13)).toContainText(brl('0,00'))  // dez/27

    // 5) Edição da compra à vista: 300,00 → 350,00.
    await page.getByRole('button', { name: 'Por data' }).click()
    await linhaCompra(page, 'Mercado').getByRole('button', { name: 'Editar compra' }).click()
    const modal = page.getByRole('dialog')
    const valor = modal.locator('input[inputmode="numeric"]').first()
    await valor.fill('')
    await valor.pressSequentially('35000')
    await modal.getByRole('button', { name: 'Salvar alterações' }).click()
    await expect(modal).toBeHidden()
    await expect(faturaAtual(page)).toContainText(brl('800,00'))
    await expect(limiteDisponivel(page)).toContainText(brl('2.400,00'))
    expect(banco.linhas('compras_cartao').find(c => c.descricao === 'Mercado')?.valor_total).toBe(350)

    // 6) Exclusão cancelada não remove nada.
    page.once('dialog', d => d.dismiss())
    await linhaCompra(page, 'Farmácia').getByRole('button', { name: 'Excluir compra' }).click()
    await expect(linhaCompra(page, 'Farmácia')).toBeVisible()
    expect(banco.linhas('compras_cartao')).toHaveLength(4)

    // 7) Exclusão confirmada da compra à vista.
    page.once('dialog', d => d.accept())
    await linhaCompra(page, 'Farmácia').getByRole('button', { name: 'Excluir compra' }).click()
    await expect(linhaCompra(page, 'Farmácia')).toHaveCount(0)
    expect(banco.linhas('compras_cartao')).toHaveLength(3)
    await expect(faturaAtual(page)).toContainText(brl('750,00'))
    await expect(limiteDisponivel(page)).toContainText(brl('2.450,00'))

    // 8) Exclusão de compra parcelada ainda não faturada (12x, começa em dez).
    await cicloSeguinte(page).click()
    page.once('dialog', d => d.accept())
    await linhaCompra(page, 'Notebook').getByRole('button', { name: 'Excluir compra' }).click()
    await expect(linhaCompra(page, 'Notebook')).toHaveCount(0)
    expect(banco.linhas('compras_cartao').map(c => c.descricao)).toEqual(['Mercado', 'Celular'])
    await expect(cicloSeguinte(page)).toContainText(brl('400,00'))
    // Comprometido = 350 + 1.200 = 1.550 → disponível 3.450.
    await expect(limiteDisponivel(page)).toContainText(brl('3.450,00'))

    // 9) Persistência após recarregar.
    await page.reload()
    await expect(faturaAtual(page)).toContainText(brl('750,00'))
    await expect(cicloSeguinte(page)).toContainText(brl('400,00'))
    await expect(limiteDisponivel(page)).toContainText(brl('3.450,00'))
  })

  test('parcelada com parcela em fatura já fechada não é apagada', async ({ page }) => {
    const antiga = { id: 'compra-antiga', usuario_id: USUARIO_TESTE.id, cartao_id: CARTAO.id, descricao: 'Geladeira',
      valor_total: 900, data_compra: '2026-10-05', numero_parcelas: 3, criado_em: '2026-10-05T10:00:00Z' }
    const banco = criarBancoMemoria({ cartoes: [CARTAO], compras_cartao: [antiga] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    await abrirFatura(page)
    await expect(faturaAtual(page)).toContainText(brl('300,00')) // parcela 2/3 em novembro
    await page.getByRole('button', { name: 'Por data' }).click()
    let perguntou = false
    page.once('dialog', d => { perguntou = true; d.accept() })
    await linhaCompra(page, 'Geladeira').getByRole('button', { name: 'Excluir compra' }).click()
    await expect(page.getByText(/já tem parcela em fatura fechada/)).toBeVisible()
    expect(perguntou).toBe(false)
    expect(banco.linhas('compras_cartao')).toHaveLength(1)
  })

  test('limite insuficiente: avisa antes de salvar e o disponível não fica negativo', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    await abrirFatura(page)
    await page.getByRole('button', { name: /Registrar compra/ }).click()
    const modal = page.getByRole('dialog')
    const valor = modal.locator('input[inputmode="numeric"]').first()
    await valor.click()
    await valor.pressSequentially('520000') // 5.200,00 > 5.000,00
    await expect(modal.getByText(/ultrapassa o limite disponível/)).toBeVisible()
    await modal.locator('input[name="descricao"]').fill('TV')
    await modal.getByRole('button', { name: 'Salvar compra' }).click()
    await expect(modal).toBeHidden()
    await expect(limiteDisponivel(page)).toContainText(brl('0,00'))
  })

  test('compra lançada em Despesas aparece na fatura e na Home sem duplicar', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    await page.goto('/despesas')
    await page.getByRole('button', { name: /Nova despesa/i }).first().click()
    const modal = page.getByRole('dialog')
    await modal.locator('input[name="descricao"]').fill('Restaurante')
    const valor = modal.locator('input[inputmode="numeric"]').first()
    await valor.click()
    await valor.pressSequentially('12000')
    await modal.locator('input[name="data"]').fill('2026-11-09')
    await modal.locator('select[name="forma_pagamento"]').selectOption('cartao_credito')
    await modal.locator('select[name="cartao_id"]').selectOption(CARTAO.id)
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal).toBeHidden()

    await abrirFatura(page)
    await expect(faturaAtual(page)).toContainText(brl('120,00'))
    await page.getByRole('button', { name: 'Por data' }).click()
    await expect(linhaCompra(page, 'Restaurante')).toContainText(brl('120,00'))
    await expect(limiteDisponivel(page)).toContainText(brl('4.880,00'))

    // Home (layout desktop, ≥ md): compromissos do mês = fatura 120,00, contada uma vez.
    if ((page.viewportSize()?.width ?? 0) >= 768) {
      await page.goto('/')
      const compromissos = page.locator('.af-hcard').filter({ hasText: 'Compromissos (mês)' })
      await expect(compromissos).toContainText(brl('120,00'))
    }
  })
})
