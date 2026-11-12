import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, criarBancoMemoria, medirViewport } from './apoio'

// Página de consultoria: "Sobre mim" e "Como posso ajudar".
test('Sobre mim recolhido, Minha história abre/fecha e os 4 serviços aparecem', async ({ page }) => {
  await isolarSupabase(page, { autenticado: true, banco: criarBancoMemoria(), perfil: perfilFalso() })
  await page.goto('/consultoria')
  const botao = page.getByRole('button', { name: 'Minha história' })
  await expect(botao).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Conheça minha trajetória')).toHaveCount(0)
  await expect(page.getByText('Engenheiro de Produção, certificado pela ANBIMA (CPA e C-Pro R), com mais de 7 anos de experiência no mercado financeiro, unindo conhecimento e tecnologia para simplificar sua vida financeira.')).toBeVisible()
  await expect(page.getByAltText('Foto profissional de Matheus Almeida')).toBeVisible()
  for (const t of ['Experiência', 'Formação', 'Certificações']) await expect(page.getByText(t, { exact: true }).first()).toBeVisible()

  const historia = page.getByText('O Almeida Finance nasceu de uma percepção')
  await expect(historia).toHaveCount(0) // recolhido por padrão
  await botao.click()
  await expect(botao).toHaveAttribute('aria-expanded', 'true')
  await expect(historia).toBeVisible()
  await expect(page.getByText('combinando tecnologia, planejamento e educação financeira')).toBeVisible()
  await botao.click()
  await expect(historia).toHaveCount(0)

  for (const t of ['Organização financeira', 'Planejamento e metas', 'Simulação de decisões', 'Carteira de investimentos']) {
    await expect(page.getByText(t, { exact: true })).toBeVisible()
  }
  await expect(page.getByText('Acompanhamento personalizado')).toHaveCount(0)
  await expect(page.getByText('Estratégias de diversificação')).toHaveCount(0) // sem promessa de recomendação individual
  await expect(page.getByText('Orientação educacional sobre diversificação')).toBeVisible()

  const v = await medirViewport(page)
  expect(v.scrollWidth).toBeLessThanOrEqual(v.clientWidth + 1)
})
