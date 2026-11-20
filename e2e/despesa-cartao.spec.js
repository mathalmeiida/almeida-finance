// @ts-check
// Compra no cartão de crédito registrada pela página Despesas.
// Regra do app: compra de cartão vive SOMENTE em compras_cartao (fonte única
// da fatura e do limite). A página Despesas não pode gravar a mesma compra em
// "despesas" (seria contada duas vezes: como despesa e dentro da fatura).
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso, USUARIO_TESTE } from './apoio.js'

const HOJE = new Date('2026-11-10T12:00:00-03:00')
const CARTAO = {
  id: 'cartao-visa', usuario_id: USUARIO_TESTE.id, nome: 'Visa Teste', banco: 'Banco X',
  limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28, criado_em: '2026-11-01T00:00:00Z',
}

async function abrirNovaDespesaNoCartao(page) {
  await page.goto('/despesas')
  await page.getByRole('button', { name: /Nova despesa/i }).first().click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  await modal.locator('input[name="descricao"]').fill('Tênis')
  const valor = modal.locator('input[inputmode="numeric"]').first()
  await valor.click()
  await valor.pressSequentially('30000') // R$ 300,00
  await modal.locator('input[name="data"]').fill('2026-11-12')
  await modal.locator('select[name="forma_pagamento"]').selectOption('cartao_credito')
  return modal
}

test.describe('Despesas → compra no cartão', () => {
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(HOJE) })

  test('1x no cartão: exige cartão e grava UMA linha em compras_cartao', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    const modal = await abrirNovaDespesaNoCartao(page)

    // O seletor de cartão precisa existir também na compra 1x.
    const seletor = modal.locator('select[name="cartao_id"]')
    await expect(seletor).toBeVisible()

    // Sem cartão escolhido, o formulário não salva nada.
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal.getByRole('alert')).toHaveText(/Selecione o cartão usado na compra/)
    expect(banco.escritas.filter(e => e.metodo === 'POST')).toHaveLength(0)

    await seletor.selectOption(CARTAO.id)
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal).toBeHidden()

    const compras = banco.linhas('compras_cartao')
    expect(compras).toHaveLength(1)
    expect(compras[0]).toMatchObject({
      cartao_id: CARTAO.id, descricao: 'Tênis', valor_total: 300,
      data_compra: '2026-11-12', numero_parcelas: 1, usuario_id: USUARIO_TESTE.id,
    })
    // Nenhuma cópia em despesas nem em parcelamentos.
    expect(banco.linhas('despesas')).toHaveLength(0)
    expect(banco.linhas('parcelamentos')).toHaveLength(0)
    await expect(page.getByText(/lançad[ao] na fatura do cartão Visa Teste/i)).toBeVisible()
  })

  test('parcelada 3x no cartão: grava UMA compra com 3 parcelas', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    const modal = await abrirNovaDespesaNoCartao(page)
    await modal.getByRole('button', { name: 'Parcelada' }).click()
    await modal.locator('select[name="numero_parcelas"]').selectOption('3')
    await modal.locator('select[name="cartao_id"]').selectOption(CARTAO.id)
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal).toBeHidden()

    const compras = banco.linhas('compras_cartao')
    expect(compras).toHaveLength(1)
    expect(compras[0]).toMatchObject({ cartao_id: CARTAO.id, valor_total: 300, numero_parcelas: 3 })
    expect(banco.linhas('despesas')).toHaveLength(0)
    expect(banco.linhas('parcelamentos')).toHaveLength(0)
  })

  test('sem cartão cadastrado: bloqueia e orienta o cadastro', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    const modal = await abrirNovaDespesaNoCartao(page)
    await expect(modal.getByText(/ainda não possui cartões cadastrados/i)).toBeVisible()
    await expect(modal.getByRole('button', { name: /Salvar despesa/i })).toBeDisabled()
    expect(banco.escritas).toHaveLength(0)
  })

  test('assinatura mensal no cartão: fica em despesas com cartão obrigatório', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    const modal = await abrirNovaDespesaNoCartao(page)
    await modal.locator('select[name="frequencia"]').selectOption('mensal')
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal.getByRole('alert')).toHaveText(/Selecione o cartão/)
    expect(banco.escritas).toHaveLength(0)

    await modal.locator('select[name="cartao_id"]').selectOption(CARTAO.id)
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal).toBeHidden()
    expect(banco.linhas('compras_cartao')).toHaveLength(0)
    expect(banco.linhas('despesas')).toHaveLength(1)
    expect(banco.linhas('despesas')[0]).toMatchObject({
      forma_pagamento: 'cartao_credito', cartao_id: CARTAO.id, recorrente: true, frequencia: 'mensal',
    })
  })

  test('outras formas de pagamento continuam em despesas', async ({ page }) => {
    const banco = criarBancoMemoria({ cartoes: [CARTAO] })
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
    const modal = await abrirNovaDespesaNoCartao(page)
    await modal.locator('select[name="forma_pagamento"]').selectOption('pix')
    await expect(modal.locator('select[name="cartao_id"]')).toHaveCount(0)
    await modal.getByRole('button', { name: /Salvar despesa/i }).click()
    await expect(modal).toBeHidden()
    expect(banco.linhas('despesas')).toHaveLength(1)
    expect(banco.linhas('despesas')[0]).toMatchObject({ forma_pagamento: 'pix', cartao_id: null })
    expect(banco.linhas('compras_cartao')).toHaveLength(0)
  })
})
