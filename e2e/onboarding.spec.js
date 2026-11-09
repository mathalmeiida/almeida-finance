import { test, expect } from '@playwright/test'
import { isolarSupabase, perfilFalso, criarBancoMemoria, USUARIO_TESTE } from './apoio'

// Onboarding de 8 etapas com sessão e banco FALSOS (em memória). Nenhuma
// requisição chega ao Supabase real. Verifica gravações, ausência de
// duplicidade, separação saldo × patrimônio, retomada e resumo final.

const perfilNovo = (extra = {}) => perfilFalso({
  nome: 'Teste', onboarding_concluido: false, saldo_base: null, saldo_base_data: null,
  reserva_configurada: false, reserva_atual: 0, ...extra,
})

async function preparar(page, { perfil = perfilNovo(), banco = criarBancoMemoria(), colunasOnboardingAusentes = true } = {}) {
  // Apresentação já vista por este usuário: o teste começa na Etapa 1.
  await page.addInitScript(id => localStorage.setItem(`almeida_apresentacao_vista_${id}`, '1'), USUARIO_TESTE.id)
  const ctx = await isolarSupabase(page, { autenticado: true, perfil, banco, colunasOnboardingAusentes })
  return { ...ctx, banco }
}

const etapa = page => page.getByTestId('onboarding-progresso')
const continuar = page => page.getByRole('button', { name: /^(Continuar|Salvar e continuar)/ })
const capturar = async (page, nome, info) => {
  if (process.env.CAPTURAS) await page.screenshot({ path: `capturas-revisao/onboarding/${info.project.name}/${nome}.png`, fullPage: true })
}

async function etapasAteDespesas(page, info) {
  // 1 — Perfil
  await expect(etapa(page)).toHaveAttribute('data-etapa', '1', { timeout: 20_000 })
  await page.getByLabel('Como prefere ser chamado?').fill('Ana')
  await page.getByRole('button', { name: 'Economizar dinheiro' }).click()
  await page.getByRole('button', { name: 'Acompanhar investimentos' }).click()
  await capturar(page, '1-perfil', info)
  await continuar(page).click()

  // 2 — Saldo + patrimônio
  await expect(etapa(page)).toHaveAttribute('data-etapa', '2')
  await page.locator('#onb-saldo').fill('150000')        // R$ 1.500,00
  await page.locator('#onb-patrimonio').fill('1000000')  // R$ 10.000,00
  await capturar(page, '2-saldo-investimentos', info)
  await continuar(page).click()

  // 3 — Receitas
  await expect(etapa(page)).toHaveAttribute('data-etapa', '3')
  await page.getByPlaceholder('Nome da receita (ex.: Salário)').fill('Salário')
  await page.getByPlaceholder('R$ 0,00').first().fill('480000')
  await capturar(page, '3-receitas', info)
  await continuar(page).click()
  await expect(page.getByRole('heading', { name: /Vale-Refeição ou Vale-Alimentação/ })).toBeVisible()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '3') // VR/VA faz parte da etapa 3
  await continuar(page).click()

  // 4 — Despesas
  await expect(etapa(page)).toHaveAttribute('data-etapa', '4')
  await page.getByPlaceholder('Nome da despesa (ex.: Aluguel)').fill('Aluguel')
  await page.getByPlaceholder('R$ 0,00').first().fill('120000')
  await page.getByRole('button', { name: 'Adicionar outra despesa' }).click()
  await expect(page.getByText('Aluguel', { exact: true })).toBeVisible()
  await capturar(page, '4-despesas', info)
}

test('novo usuário completa as 8 etapas sem duplicar lançamentos', async ({ page }, info) => {
  const { banco, escritasPerfil } = await preparar(page)
  await page.goto('/')
  await etapasAteDespesas(page, info)

  // Voltar até o saldo e avançar de novo NÃO pode duplicar nada.
  await page.getByRole('button', { name: 'Voltar' }).or(page.locator('button:has(svg.lucide-arrow-left)')).first().click()
  await page.getByRole('button', { name: 'Continuar' }).click() // VR/VA
  await expect(etapa(page)).toHaveAttribute('data-etapa', '4')
  await continuar(page).click()

  // 5 — Cartões (com cor)
  await expect(etapa(page)).toHaveAttribute('data-etapa', '5')
  await page.getByPlaceholder('Nome do cartão (ex.: Nubank, Bradesco Visa)').fill('Nubank')
  await page.getByPlaceholder('Ex.: 20').fill('20')
  await page.getByPlaceholder('Ex.: 28').fill('28')
  await page.getByRole('button', { name: 'Roxo' }).click()
  await capturar(page, '5-cartoes', info)
  await continuar(page).click()

  // 6 — Importação (Em breve)
  await expect(etapa(page)).toHaveAttribute('data-etapa', '6')
  await page.getByTestId('onboarding-importar-agora').click()
  await expect(page.getByTestId('importacao')).toBeVisible() // mesmo módulo da página /importacao
  await capturar(page, '6-importacao', info)
  await page.getByRole('button', { name: 'Voltar', exact: true }).click()
  await page.getByRole('button', { name: /Deixar para depois/ }).click()

  // 7 — Metas + reserva
  await expect(etapa(page)).toHaveAttribute('data-etapa', '7')
  await page.getByPlaceholder('Nome da meta (ex.: Viagem, Carro)').fill('Viagem')
  await page.getByPlaceholder('R$ 0,00').first().fill('500000')
  await capturar(page, '7-metas', info)
  await continuar(page).click()
  await expect(page.getByRole('heading', { name: /reserva de emergência/ })).toBeVisible()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '7')
  await continuar(page).click()

  // 8 — Tema e atalhos (mesmo mecanismo da Home)
  await expect(etapa(page)).toHaveAttribute('data-etapa', '8')
  await page.getByRole('button', { name: 'Escuro' }).click()
  await page.getByRole('button', { name: 'Escolher e ordenar atalhos' }).click()
  await page.getByTestId('lista-personalizar-atalhos').getByRole('button', { name: 'Favoritar Metas' }).click()
  await page.getByRole('button', { name: 'Salvar' }).click()
  await expect(page.getByTestId('onboarding-atalhos-previa').locator('[data-atalho]').first()).toHaveAttribute('data-atalho', 'metas')
  await capturar(page, '8-personalizacao', info)
  await continuar(page).click()
  await page.getByRole('button', { name: 'Pular por enquanto' }).click() // alertas push

  // Final
  await expect(page.getByRole('heading', { name: 'Tudo pronto!' })).toBeVisible()
  const resumo = page.getByTestId('onboarding-resumo')
  await expect(resumo).toContainText('Ana')
  await expect(resumo).toContainText('Economizar dinheiro, Acompanhar investimentos')
  await expect(resumo).toContainText(/Saldo em contas\s*R\$\s*1\.500,00/)
  await expect(resumo).toContainText(/Patrimônio investido\s*R\$\s*10\.000,00/)
  await expect(resumo).toContainText('1 cadastrada') // receitas
  await expect(resumo).toContainText('1 cartão')
  await expect(resumo).toContainText('1 meta')
  await expect(resumo).toContainText('Escuro')
  await capturar(page, '9-final', info)

  // Banco: exatamente um registro de cada, e patrimônio separado do saldo.
  expect(banco.linhas('receitas')).toHaveLength(1)
  expect(banco.linhas('despesas')).toHaveLength(1)
  expect(banco.linhas('cartoes')).toHaveLength(1)
  expect(banco.linhas('cartoes')[0].cor).toBe('#7c3aed')
  expect(banco.linhas('metas')).toHaveLength(1)
  expect(banco.linhas('metas')[0]).toMatchObject({ nome: 'Viagem', valor_desejado: 5000 })
  const inv = banco.linhas('investimentos')
  expect(inv).toHaveLength(1)
  expect(inv[0]).toMatchObject({ valor_atual: 10000, valor_aplicado: 10000, categoria: 'outro' })
  expect(banco.linhas('investimentos_movimentacoes')).toHaveLength(0) // não é aporte/receita
  const saldoGravado = escritasPerfil.filter(e => 'saldo_base' in e).map(e => e.saldo_base)
  expect(saldoGravado).toEqual([1500]) // gravado uma vez, sem somar o patrimônio
  expect(escritasPerfil.some(e => e.nome === 'Ana')).toBe(true)

  await page.getByRole('button', { name: /Ir para minha Home/ }).click()
  await expect(page.locator('[data-testid="atalhos-home"]:visible')).toBeVisible({ timeout: 20_000 })
  expect(escritasPerfil.some(e => e.onboarding_concluido === true)).toBe(true)
})

test('editar o patrimônio ao voltar atualiza o mesmo registro', async ({ page }, info) => {
  const { banco } = await preparar(page)
  await page.goto('/')
  await etapasAteDespesas(page, info)
  // Volta: Despesas → VR/VA → Receitas → Saldo
  for (let i = 0; i < 3; i++) await page.locator('button:has(svg.lucide-arrow-left)').first().click()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '2')
  await expect(page.locator('#onb-patrimonio')).toHaveValue('10.000,00')
  await page.locator('#onb-patrimonio').fill('1200000')
  await continuar(page).click()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '3')
  await expect(page.locator('li', { hasText: 'Salário' })).toHaveCount(1) // receita salva reaparece, uma vez
  await continuar(page).click()
  expect(banco.linhas('investimentos')).toHaveLength(1)
  expect(banco.linhas('investimentos')[0].valor_atual).toBe(12000)
  expect(banco.linhas('receitas')).toHaveLength(1)
})

test('usuário com investimentos já cadastrados: patrimônio não é duplicado', async ({ page }) => {
  const banco = criarBancoMemoria({ investimentos: [{ id: 'inv-1', usuario_id: USUARIO_TESTE.id, nome: 'CDB Banco X', categoria: 'cdb', valor_aplicado: 3000, valor_atual: 3200, reserva_valor: 0 }] })
  await preparar(page, { banco, perfil: perfilNovo({ saldo_base: 800 }) })
  await page.goto('/')
  await page.getByLabel('Como prefere ser chamado?').fill('Bia')
  await continuar(page).click()
  await expect(page.getByTestId('onboarding-patrimonio-existente')).toContainText('3.200,00')
  await expect(page.locator('#onb-patrimonio')).toHaveCount(0)
  await continuar(page).click()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '3')
  expect(banco.linhas('investimentos')).toHaveLength(1)
})

test('interromper e voltar: oferece continuar de onde parou ou ir para o app', async ({ page }, info) => {
  const { escritasPerfil } = await preparar(page)
  await page.goto('/')
  await etapasAteDespesas(page, info)
  await page.reload()
  await expect(page.getByTestId('onboarding-retomar')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Continuar de onde parei' }).click()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '4')
  await expect(page.getByText('Aluguel', { exact: true })).toBeVisible() // dado salvo continua lá

  await page.reload()
  await page.getByRole('button', { name: 'Ir para o app agora' }).click()
  await expect(page.locator('[data-testid="atalhos-home"]:visible')).toBeVisible({ timeout: 20_000 })
  expect(escritasPerfil.some(e => e.onboarding_concluido === true)).toBe(true)
})

test('com a migration aplicada, objetivos e etapa vão para o perfil', async ({ page }) => {
  const { escritasPerfil } = await preparar(page, { colunasOnboardingAusentes: false })
  await page.goto('/')
  await page.getByLabel('Como prefere ser chamado?').fill('Caio')
  await page.getByRole('button', { name: 'Sair das dívidas' }).click()
  await continuar(page).click()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '2')
  expect(escritasPerfil.some(e => Array.isArray(e.objetivos_financeiros) && e.objetivos_financeiros.includes('sair_dividas'))).toBe(true)
  await expect.poll(() => escritasPerfil.some(e => e.onboarding_etapa === 'saldo')).toBe(true)
})

test('card da Home reabre direto na etapa pendente (reserva)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('almeida_refazer_onboarding', '1')
    localStorage.setItem('almeida_onboarding_etapa', 'reserva')
  })
  await preparar(page, { perfil: perfilNovo({ onboarding_concluido: true, saldo_base: 500 }) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /reserva de emergência/ })).toBeVisible({ timeout: 20_000 })
  await expect(etapa(page)).toHaveAttribute('data-etapa', '7')
})

test('perfil sem nome não avança e mostra mensagem', async ({ page }) => {
  await preparar(page)
  await page.goto('/')
  await page.getByLabel('Como prefere ser chamado?').fill('')
  await continuar(page).click()
  await expect(page.getByText('Informe como prefere ser chamado.')).toBeVisible()
  await expect(etapa(page)).toHaveAttribute('data-etapa', '1')
})
