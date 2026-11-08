import { test, expect } from '@playwright/test'
import { isolarSupabase, medirViewport } from './apoio'

const indicadorAtivo = page => page.locator('[data-testid="apresentacao-indicador"][aria-selected="true"]')

async function indiceAtivo(page) {
  const todos = page.locator('[data-testid="apresentacao-indicador"]')
  const n = await todos.count()
  for (let i = 0; i < n; i++) if ((await todos.nth(i).getAttribute('aria-selected')) === 'true') return i
  return -1
}

test.beforeEach(async ({ page }) => {
  await isolarSupabase(page)
})

test('primeiro acesso mostra a capa com marca, frase e os dois botões', async ({ page }) => {
  await page.goto('/login')
  const apres = page.getByTestId('apresentacao')
  await expect(apres).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'Almeida Finance' })).toBeVisible()
  await expect(page.getByText('Seu dinheiro. Seu controle. Seu futuro.')).toBeVisible()
  await expect(page.getByText('Organize suas finanças, acompanhe seu patrimônio e planeje suas próximas conquistas em um só lugar.')).toBeVisible()
  await expect(page.getByTestId('apresentacao-comecar')).toBeVisible()
  await expect(page.getByTestId('apresentacao-entrar')).toBeVisible()
  // Logo original, sem duplicar: uma na capa; a do topo fica invisível na capa.
  await expect(page.locator('img[alt="Almeida Finance"]')).toHaveCount(1)
  await expect(page.locator('[data-testid="apresentacao-indicador"]')).toHaveCount(6)
  const m = await medirViewport(page)
  expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth)
})

test('avançar, voltar, deslizar e indicadores acompanham a posição', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 15_000 })
  expect(await indiceAtivo(page)).toBe(0)

  await page.getByTestId('apresentacao-avancar').click()
  await expect.poll(() => indiceAtivo(page)).toBe(1)
  await expect(page.getByRole('heading', { name: 'Tudo sob controle.' })).toBeInViewport()

  // Deslizar = rolagem horizontal do trilho com scroll-snap.
  await page.getByTestId('apresentacao-trilho').evaluate(el => el.scrollTo({ left: el.clientWidth * 4, behavior: 'auto' }))
  await expect.poll(() => indiceAtivo(page)).toBe(4)
  await expect(page.getByRole('heading', { name: 'Menos trabalho. Mais controle.' })).toBeInViewport()
  await expect(page.getByText('Em breve')).toBeVisible()

  await page.getByTestId('apresentacao-voltar').click()
  await expect.poll(() => indiceAtivo(page)).toBe(3)
  await expect(page.getByRole('heading', { name: 'Seu patrimônio em evolução.' })).toBeInViewport()

  // Indicador clicável → última tela; "Pular" some no fim.
  await page.locator('[data-testid="apresentacao-indicador"]').nth(5).click()
  await expect.poll(() => indiceAtivo(page)).toBe(5)
  await expect(page.getByRole('heading', { name: 'Decisões melhores começam com planejamento.' })).toBeInViewport()
  await expect(page.getByTestId('apresentacao-pular')).toHaveCount(0)
  await expect(page.getByTestId('apresentacao-avancar')).toBeDisabled()
})

test('teclado ← → navega entre as telas', async ({ page }, info) => {
  test.skip(info.project.use.hasTouch, 'teclado físico: desktop')
  await page.goto('/login')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect.poll(() => indiceAtivo(page)).toBe(2)
  await page.keyboard.press('ArrowLeft')
  await expect.poll(() => indiceAtivo(page)).toBe(1)
})

test('"Já tenho uma conta" abre o login e a apresentação não volta no próximo acesso', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('apresentacao-entrar').click()
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('apresentacao')).toHaveCount(0)
})

test('"Começar agora" abre o cadastro e voltar ao login não repete a apresentação', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('apresentacao-comecar').click()
  await expect(page).toHaveURL(/\/cadastro$/)
  await expect(page.getByRole('heading', { name: 'Comece agora' })).toBeVisible()
  await page.getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
  await expect(page.getByTestId('apresentacao')).toHaveCount(0)
})

test('"Pular" leva ao login e "Conhecer o Almeida Finance" reabre a apresentação', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('apresentacao-pular').click()
  await expect(page.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeVisible()
  await page.getByRole('button', { name: 'Conhecer o Almeida Finance' }).click()
  await expect(page.getByTestId('apresentacao')).toBeVisible()
})

test('movimento reduzido: sem animação de entrada', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('.af-apres-entrada')).toHaveCount(0)
  await page.getByTestId('apresentacao-avancar').click()
  await expect(indicadorAtivo(page)).toHaveAttribute('aria-label', /tela 2 de 6/)
})

test('login com erro mostra mensagem clara (sem chamar o Supabase real)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('almeida_apresentacao_publica_vista', '1'))
  await page.route(/\/auth\/v1\/token/, route => route.fulfill({
    status: 400, contentType: 'application/json',
    body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', message: 'Invalid login credentials' }),
  }))
  await page.goto('/login')
  await page.locator('input[name="email"]').fill('pessoa@exemplo.invalid')
  await page.locator('input[name="senha"]').fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible()
})

test('usuário autenticado: "Rever apresentação" usa o mesmo componente e volta às Configurações', async ({ page }) => {
  await isolarSupabase(page, { autenticado: true })
  await page.goto('/apresentacao')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('apresentacao-comecar')).toHaveCount(0) // sem botões públicos
  await page.locator('[data-testid="apresentacao-indicador"]').nth(5).click()
  await page.getByRole('button', { name: 'Começar agora' }).click()
  await expect(page).toHaveURL(/\/configuracoes$/)
})

test('usuário antigo com onboarding concluído vai direto à Home (sem apresentação)', async ({ page }) => {
  await isolarSupabase(page, { autenticado: true })
  await page.goto('/')
  await expect(page.locator('[data-testid="atalhos-home"]:visible')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByTestId('apresentacao')).toHaveCount(0)
})

test('usuário novo (onboarding pendente) vê a apresentação e depois o onboarding atual', async ({ page }) => {
  const { perfilFalso } = await import('./apoio')
  await isolarSupabase(page, { autenticado: true, perfil: perfilFalso({ onboarding_concluido: false, saldo_base: null }) })
  await page.goto('/')
  await expect(page.getByTestId('apresentacao')).toBeVisible({ timeout: 20_000 })
  await page.getByTestId('apresentacao-pular').click()
  await expect(page.getByTestId('apresentacao')).toHaveCount(0)
  await expect(page.locator('[data-testid="atalhos-home"]:visible')).toHaveCount(0) // ainda no onboarding
})
