// @ts-check
// Receita com data em outro mês: é salva, não entra na lista/total do mês
// exibido e aparece ao navegar até o mês dela.
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso } from './apoio.js'

test('receita de dezembro não aparece em novembro e aparece em dezembro', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-10T12:00:00-03:00'))
  const banco = criarBancoMemoria()
  await isolarSupabase(page, { autenticado: true, perfil: perfilFalso(), banco })
  await page.goto('/receitas')
  await page.getByRole('button', { name: /Nova receita/ }).click()
  const modal = page.getByRole('dialog')
  await modal.locator('input[name="descricao"]').fill('Bônus de Natal')
  const valor = modal.locator('input[inputmode="numeric"]').first()
  await valor.click()
  await valor.pressSequentially('500000')
  await modal.locator('input[type="date"]').first().fill('2026-12-20')
  await modal.locator('button[type="submit"]').click()
  await expect(modal).toBeHidden()

  expect(banco.linhas('receitas').map(r => [r.descricao, r.data])).toEqual([['Bônus de Natal', '2026-12-20']])
  const lista = page.locator('main')
  await expect(lista).not.toContainText('Bônus de Natal')

  await page.getByRole('button', { name: 'Próximo mês' }).click()
  await expect(lista).toContainText('Bônus de Natal')
  await expect(lista).toContainText(/R\$\s*5\.000,00/)
})
