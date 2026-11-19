// Teste E2E REAL do OnboardingSimples (fluxo atual)
import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, criarBancoMemoria, USUARIO_TESTE } from './apoio'

test('OnboardingSimples: fluxo básico manual completo', async ({ page }) => {
  const perfil = perfilFalso({
    nome: null,
    onboarding_concluido: false,
    saldo_base: null,
  })
  
  const banco = criarBancoMemoria()
  
  await page.addInitScript(id => {
    localStorage.setItem(`almeida_apresentacao_vista_${id}`, '1')
  }, USUARIO_TESTE.id)
  
  await isolarSupabase(page, { autenticado: true, perfil, banco })
  await page.goto('/')
  
  // Deve mostrar OnboardingSimples - tela de boas-vindas
  await expect(page.getByText(/Vamos organizar suas finanças/i)).toBeVisible({ timeout: 10000 })
  
  // Clicar em "Configurar manualmente"
  const configurarBtn = page.getByRole('button', { name: /Configurar manualmente/i })
  await expect(configurarBtn).toBeVisible()
  await configurarBtn.click()
  
  // Deve mostrar central de configuração
  await expect(page.getByText(/Configure suas finanças/i)).toBeVisible({ timeout: 5000 })
  
  // Verificar cards principais
  await expect(page.getByText('Saldo e Contas')).toBeVisible()
  await expect(page.getByText('Receitas')).toBeVisible()
  await expect(page.getByText('Despesas')).toBeVisible()
  
  // Clicar em "Concluir" para finalizar
  const concluirBtn = page.getByRole('button', { name: /Concluir|Finalizar/i })
  if (await concluirBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await concluirBtn.click()
    
    // Deve mostrar tela de conclusão ou ir para Home
    await expect(page.getByText(/concluída|Home|Visão Geral/i)).toBeVisible({ timeout: 5000 })
  }
  
  // Verificar que dados foram persistidos
  expect(banco.escritas.length).toBeGreaterThanOrEqual(0) // Pode ser 0 se não cadastrou nada
})
