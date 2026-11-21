// @ts-check
// Testes do onboarding adaptativo: módulos opcionais, estados e persistência.
// Todos os cenários rodam contra banco em memória — nada toca o Supabase real.
import { test, expect } from '@playwright/test'
import { criarBancoMemoria, isolarSupabase, perfilFalso, USUARIO_TESTE } from './apoio.js'

// Perfil sem onboarding concluído (estado inicial)
function perfilOnboarding(extra = {}) {
  return perfilFalso({ onboarding_concluido: false, ...extra })
}

// Abre o hub "Configure suas finanças"
async function abrirHub(page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  // Pula a tela de boas-vindas (escolha inicial) → central
  const pular = page.getByRole('button', { name: /pular por enquanto/i })
  if (await pular.isVisible({ timeout: 3000 })) {
    await pular.click()
    await page.waitForTimeout(400)
  }
  // Verifica hub
  await expect(page.getByText(/configure suas finanças/i)).toBeVisible()
}

test.describe('Onboarding — módulos opcionais', () => {
  // ─── 1. Usuário sem nenhum módulo pode concluir ───────────────────────────
  test('sem nenhum módulo configurado: pode concluir', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    // Todos os módulos mostram status "Não configurado" (texto na barra inferior)
    const textos = await page.locator('text=Opcional — configure quando quiser').all()
    expect(textos.length).toBeGreaterThanOrEqual(5)
    // Pode clicar em "Concluir configuração" mesmo sem preencher nada
    await page.getByRole('button', { name: /concluir configuração/i }).click()
    await expect(page.getByRole('heading', { name: /tudo pronto/i })).toBeVisible()
    await page.getByRole('button', { name: /ir para minha home/i }).click()
    await expect(page).toHaveURL('/')
  })

  // ─── 2. Usuário sem cartão — despesas por Pix/dinheiro funcionam normais ──
  test('sem cartão: registro de despesas não é bloqueado', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilFalso({ onboarding_concluido: true }), banco })
    // Acessa despesas diretamente sem cartão cadastrado
    await page.goto('/despesas')
    await expect(page.getByRole('button', { name: /nova despesa/i })).toBeVisible()
    await page.getByRole('button', { name: /nova despesa/i }).first().click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await modal.locator('input[name="descricao"]').fill('Supermercado')
    const valor = modal.locator('input[inputmode="numeric"]').first()
    await valor.click(); await valor.pressSequentially('10000')
    await modal.locator('input[name="data"]').fill('2026-11-15')
    // Pix não exige cartão — deve funcionar sem nenhuma validação de cartão
    await modal.locator('select[name="forma_pagamento"]').selectOption('pix')
    await modal.getByRole('button', { name: /salvar despesa/i }).click()
    await expect(modal).toBeHidden()
    expect(banco.linhas('despesas')).toHaveLength(1)
    expect(banco.linhas('compras_cartao')).toHaveLength(0)
  })

  // ─── 3. Usuário sem investimentos ─────────────────────────────────────────
  test('sem investimentos: hub mostra módulo como Não configurado sem erro', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    const cardInvest = page.locator('.rounded-xl.border-2').filter({ hasText: /investimentos/i }).first()
    await expect(cardInvest).toBeVisible()
    // Módulo não configurado mostra texto "Opcional"
    await expect(cardInvest).toContainText(/opcional/i)
  })

  // ─── 4. Usuário sem VR/VA ─────────────────────────────────────────────────
  test('sem VR/VA: hub mostra módulo como Não configurado', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    const cardVRVA = page.locator('.rounded-xl.border-2').filter({ hasText: /vr.*va|vr\/va/i }).first()
    await expect(cardVRVA).toBeVisible()
    await expect(cardVRVA).toContainText(/opcional/i)
  })

  // ─── 5. Apenas saldo configurado ─────────────────────────────────────────
  test('apenas saldo configurado: somente esse módulo mostra "Configurado"', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilOnboarding({ saldo_base: 500000, saldo_base_data: '2026-11-01' }),
      banco
    })
    await abrirHub(page)
    const cardSaldo = page.locator('.rounded-xl.border-2').filter({ hasText: /saldo e contas/i }).first()
    await expect(cardSaldo).toContainText(/configurado/i)
    // Cartões ainda não configurados: sem badge verde, mostra "Opcional"
    const cardCartoes = page.locator('.rounded-xl.border-2').filter({ hasText: /cartões de crédito/i }).first()
    await expect(cardCartoes).toContainText(/opcional/i)
  })

  // ─── 6. "Não utilizo" marca módulo corretamente ───────────────────────────
  test('"Não utilizo" muda badge e desabilita botão do módulo', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    // Encontra o card de cartões e clica em "Não utilizo"
    const cardCartoes = page.locator('.rounded-xl.border-2').filter({ hasText: /cartões de crédito/i }).first()
    await cardCartoes.getByRole('button', { name: /não utilizo/i }).click()
    // Badge deve mudar para "Não utilizo"
    await expect(cardCartoes).toContainText('Não utilizo')
    // O botão principal deve estar desabilitado (não navega)
    const btnConf = cardCartoes.getByRole('button').first()
    await expect(btnConf).toBeDisabled()
    // Após desfazer: badge "Não utilizo" some, botão volta a dizer "Não utilizo"
    // e status text volta para "Opcional"
    await cardCartoes.getByRole('button', { name: /desfazer/i }).click()
    await expect(cardCartoes.locator('.bg-blue-100')).toHaveCount(0)  // badge azul sumiu
    await expect(btnConf).toBeEnabled()
  })

  // ─── 7. Persistência do "Não utilizo" após reload ────────────────────────
  test('"Não utilizo" persiste após recarregar a página', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    // Marcar VR/VA como "Não utilizo"
    const cardVRVA = page.locator('.rounded-xl.border-2').filter({ hasText: /vr.*va|vr\/va/i }).first()
    await cardVRVA.getByRole('button', { name: /não utilizo/i }).click()
    await expect(cardVRVA).toContainText('Não utilizo')
    // Recarregar
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
    // Hub deve abrir direto (etapa=central salva no localStorage)
    await expect(page.getByText(/configure suas finanças/i)).toBeVisible()
    const cardVRVApos = page.locator('.rounded-xl.border-2').filter({ hasText: /vr.*va|vr\/va/i }).first()
    await expect(cardVRVApos).toContainText('Não utilizo')
  })

  // ─── 8. Retorno ao hub após módulo externo ────────────────────────────────
  test('após salvar saldo, retorna ao hub (não vai para Home)', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    // Entra no módulo Saldo
    const cardSaldo = page.locator('.rounded-xl.border-2').filter({ hasText: /saldo e contas/i }).first()
    await cardSaldo.getByRole('button').first().click()
    await expect(page.getByRole('heading', { name: /saldo e contas/i })).toBeVisible()
    // Salva saldo
    const inputSaldo = page.locator('input[inputmode="numeric"]').first()
    await inputSaldo.click(); await inputSaldo.pressSequentially('500000')
    await page.getByRole('button', { name: /salvar/i }).click()
    // Deve retornar ao hub
    await expect(page.getByText(/configure suas finanças/i)).toBeVisible()
    // Módulo saldo deve estar configurado
    const cardSaldoAtualizado = page.locator('.rounded-xl.border-2').filter({ hasText: /saldo e contas/i }).first()
    await expect(cardSaldoAtualizado).toContainText('Configurado')
  })

  // ─── 9. Todos os módulos configurados ────────────────────────────────────
  test('com todos os módulos configurados: todos mostram badge Configurado', async ({ page }) => {
    const uid = USUARIO_TESTE.id
    const banco = criarBancoMemoria({
      receitas: [{ id: 'r1', usuario_id: uid, descricao: 'Salário', valor: 5000, data: '2026-11-01', recorrente: true, frequencia: 'mensal' }],
      despesas: [{ id: 'd1', usuario_id: uid, descricao: 'Aluguel', valor: 1200, data: '2026-11-01', recorrente: true, frequencia: 'mensal', tipo_despesa: 'fixa' }],
      cartoes: [{ id: 'c1', usuario_id: uid, nome: 'Visa', limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28, criado_em: '2026-11-01T00:00:00Z' }],
      beneficios: [{ id: 'b1', usuario_id: uid, tipo: 'VR', nome: 'VR empresa', saldo: 50000 }],
      investimentos: [{ id: 'i1', usuario_id: uid, nome: 'CDB', categoria: 'renda_fixa', valor_aplicado: 10000, valor_atual: 10000, criado_em: '2026-11-01T00:00:00Z' }],
    })
    await isolarSupabase(page, {
      autenticado: true,
      perfil: perfilOnboarding({ saldo_base: 500000, saldo_base_data: '2026-11-01' }),
      banco
    })
    await abrirHub(page)
    const badges = await page.locator('text=✓ Configurado').all()
    expect(badges.length).toBeGreaterThanOrEqual(5) // saldo + receitas + despesas + cartoes + vrva + invest
  })

  // ─── 10. Apenas "Concluir configuração" finaliza o onboarding ─────────────
  test('somente "Concluir configuração" marca onboarding como concluído', async ({ page }) => {
    const banco = criarBancoMemoria()
    await isolarSupabase(page, { autenticado: true, perfil: perfilOnboarding(), banco })
    await abrirHub(page)
    // Sem clicar em Concluir, o onboarding deve continuar no hub
    await page.reload()
    await expect(page.getByText(/configure suas finanças/i)).toBeVisible()
    // Agora conclui
    await page.getByRole('button', { name: /concluir configuração/i }).click()
    await page.getByRole('button', { name: /ir para minha home/i }).click()
    await expect(page).toHaveURL('/')
    // Próximo acesso não abre mais o onboarding
    await page.reload()
    await expect(page.getByText(/configure suas finanças/i)).not.toBeVisible()
  })
})
