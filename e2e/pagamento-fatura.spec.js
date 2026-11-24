// @ts-check
// E2E REAL contra o Supabase DEV: pagamento de fatura (total, parcial, antecipado,
// estorno, recarregamento e duplicidade). NÃO usa mocks de rede.
//
// STATUS: escrito, mas NÃO EXECUTADO no ambiente de desenvolvimento do agente
// (sem credenciais DEV e DNS do DEV inacessível; ver DEV-BLOQUEADO.md).
//
// Pré-requisitos:
//   1. Migration supabase/migrations/2026-11_pagamentos_fatura.sql aplicada no DEV.
//   2. .env.development.local com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do DEV.
//   3. Usuário de teste do DEV (e outro, para o isolamento): E2E_EMAIL, E2E_SENHA,
//      E2E_EMAIL_B, E2E_SENHA_B.
//   4. App rodando em http://localhost:5173 (npm run dev -- --mode development).
//
// Execução:
//   E2E_EMAIL=... E2E_SENHA=... E2E_EMAIL_B=... E2E_SENHA_B=... \
//   npx playwright test e2e/pagamento-fatura.spec.js --config=playwright.dev.config.js
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL_DEV = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.E2E_EMAIL
const SENHA = process.env.E2E_SENHA
const EMAIL_B = process.env.E2E_EMAIL_B
const SENHA_B = process.env.E2E_SENHA_B
const configurado = Boolean(URL_DEV && ANON && EMAIL && SENHA)

test.skip(!configurado, 'Sem credenciais DEV (VITE_SUPABASE_URL/ANON_KEY e E2E_EMAIL/E2E_SENHA): teste não executado')
if (URL_DEV && /almeida-finance\.vercel\.app|producao|prod/i.test(URL_DEV)) {
  throw new Error('Este teste só pode rodar contra o DEV.')
}

const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const mesCorrente = hoje.slice(0, 7)

async function clienteLogado(email, senha) {
  const sb = createClient(URL_DEV, ANON)
  const { error } = await sb.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  return sb
}

async function login(page, email, senha) {
  await page.goto('/login')
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.getByLabel(/senha/i).fill(senha)
  await page.getByRole('button', { name: /entrar/i }).click()
  await page.waitForURL(url => !/login/.test(url.pathname), { timeout: 20_000 })
}

test.describe.serial('Pagamento de fatura (DEV real)', () => {
  /** @type {import('@supabase/supabase-js').SupabaseClient} */
  let sb
  let userId
  let cartaoId
  const nomeCartao = `E2E Pagamento ${Date.now()}`

  test.beforeAll(async () => {
    sb = await clienteLogado(EMAIL, SENHA)
    userId = (await sb.auth.getUser()).data.user.id
    // Cartão que fecha no último dia do mês (compra de hoje cai no ciclo corrente) e compra de R$ 1.000,00.
    const { data: c, error } = await sb.from('cartoes').insert({
      usuario_id: userId, nome: nomeCartao, limite_total: 5000, dia_fechamento: 28, dia_vencimento: 28,
    }).select().single()
    if (error) throw error
    cartaoId = c.id
    // Compra na data de hoje, ou dia 1 se hoje passou do fechamento (mantém o ciclo corrente).
    const dia = Number(hoje.slice(8, 10)) <= 28 ? hoje : `${mesCorrente}-01`
    const { error: e2 } = await sb.from('compras_cartao').insert({
      usuario_id: userId, cartao_id: cartaoId, descricao: 'E2E compra', valor_total: 1000, data_compra: dia, numero_parcelas: 1,
    })
    if (e2) throw e2
  })

  test.afterAll(async () => {
    if (!sb || !cartaoId) return
    // Limpeza apenas dos dados criados por este teste (cartão do próprio usuário de teste).
    await sb.from('cartoes').delete().eq('id', cartaoId)
  })

  const abrirFatura = async (page) => {
    await page.goto(`/cartoes?cartao=${cartaoId}`)
    await expect(page.getByTestId('pagar-fatura')).toBeVisible({ timeout: 15_000 })
  }

  test('pagamento parcial reduz o saldo em aberto e libera limite proporcional', async ({ page }) => {
    await login(page, EMAIL, SENHA)
    await abrirFatura(page)
    await page.getByTestId('pagar-fatura').click()
    await page.getByLabel(/valor do pagamento/i).fill('400')
    await page.getByRole('button', { name: /confirmar pagamento/i }).click()
    await expect(page.getByTestId('status-fatura').first()).toContainText(/parcialmente paga/i)
    await expect(page.getByTestId('historico-pagamentos')).toContainText('400,00')
    await expect(page.getByText('R$ 4.400,00').first()).toBeVisible() // limite disponível
  })

  test('recarregar a página mantém o pagamento (persistência no Supabase)', async ({ page }) => {
    await login(page, EMAIL, SENHA)
    await abrirFatura(page)
    await page.reload()
    await expect(page.getByTestId('historico-pagamentos')).toContainText('400,00')
    await expect(page.getByTestId('status-fatura').first()).toContainText(/parcialmente paga/i)
  })

  test('duplicidade: mesma chave de idempotência não gera segundo pagamento', async () => {
    const chave = `e2e-dup-${Date.now()}`
    const args = {
      p_cartao_id: cartaoId, p_ano_mes: mesCorrente, p_valor: 100, p_data_pagamento: hoje,
      p_origem: 'saldo_principal', p_conta_nome: null, p_total_ciclo: 1000, p_idempotency_key: chave,
    }
    const r1 = await sb.rpc('pagar_fatura_cartao', args)
    const r2 = await sb.rpc('pagar_fatura_cartao', args)
    expect(r1.error).toBeNull()
    expect(r2.error).toBeNull()
    expect(r2.data.id).toBe(r1.data.id)
    const { count } = await sb.from('pagamentos_fatura').select('*', { count: 'exact', head: true }).eq('idempotency_key', chave)
    expect(count).toBe(1)
    await sb.rpc('estornar_pagamento_fatura', { p_pagamento_id: r1.data.id })
  })

  test('origem outra_conta é recusada (só existe saldo principal)', async () => {
    const r = await sb.rpc('pagar_fatura_cartao', {
      p_cartao_id: cartaoId, p_ano_mes: mesCorrente, p_valor: 10, p_data_pagamento: hoje,
      p_origem: 'outra_conta', p_conta_nome: null, p_total_ciclo: 1000, p_idempotency_key: `e2e-outra-${Date.now()}`,
    })
    expect(r.error).not.toBeNull()
  })

  test('nova compra após pagamento parcial: total maior aceito e pagamento anterior preservado', async () => {
    const ym = '2031-03'
    const base = { p_cartao_id: cartaoId, p_ano_mes: ym, p_data_pagamento: hoje, p_origem: 'saldo_principal', p_conta_nome: null }
    const a = await sb.rpc('pagar_fatura_cartao', { ...base, p_valor: 100, p_total_ciclo: 300, p_idempotency_key: `e2e-nc-a-${Date.now()}` })
    expect(a.error).toBeNull()
    const b = await sb.rpc('pagar_fatura_cartao', { ...base, p_valor: 350, p_total_ciclo: 500, p_idempotency_key: `e2e-nc-b-${Date.now()}` })
    expect(b.error).toBeNull()
    const { data } = await sb.from('pagamentos_fatura').select('id,status').eq('cartao_id', cartaoId).eq('ano_mes', ym)
    expect(data.filter(p => p.status === 'ativo').length).toBe(2)
    const dup = await sb.rpc('estornar_pagamento_fatura', { p_pagamento_id: b.data.id })
    expect(dup.error).toBeNull()
    const dup2 = await sb.rpc('estornar_pagamento_fatura', { p_pagamento_id: b.data.id })
    expect(dup2.error).not.toBeNull()
    await sb.rpc('estornar_pagamento_fatura', { p_pagamento_id: a.data.id })
  })

  test('valor acima do saldo em aberto é recusado', async () => {
    const r = await sb.rpc('pagar_fatura_cartao', {
      p_cartao_id: cartaoId, p_ano_mes: mesCorrente, p_valor: 700, p_data_pagamento: hoje,
      p_origem: 'saldo_principal', p_conta_nome: null, p_total_ciclo: 1000, p_idempotency_key: `e2e-excesso-${Date.now()}`,
    })
    expect(r.error).not.toBeNull()
  })

  test('pagamento total (quitando o restante) marca a fatura como Paga', async ({ page }) => {
    await login(page, EMAIL, SENHA)
    await abrirFatura(page)
    await page.getByTestId('pagar-fatura').click()
    await page.getByRole('button', { name: /pagar total/i }).click()
    await page.getByRole('button', { name: /confirmar pagamento/i }).click()
    await expect(page.getByTestId('status-fatura').first()).toContainText(/^paga$/i)
    await expect(page.getByTestId('pagar-fatura')).toBeDisabled()
  })

  test('estorno devolve o saldo em aberto e restaura o limite', async ({ page }) => {
    await login(page, EMAIL, SENHA)
    await abrirFatura(page)
    page.once('dialog', d => d.accept())
    await page.getByTestId('historico-pagamentos').getByRole('button', { name: /estornar/i }).first().click()
    await expect(page.getByTestId('status-fatura').first()).not.toContainText(/^paga$/i)
    await expect(page.getByTestId('pagar-fatura')).toBeEnabled()
  })

  test('pagamento antecipado de ciclo futuro é aceito', async () => {
    const proximo = new Date(`${mesCorrente}-15T12:00:00`)
    proximo.setMonth(proximo.getMonth() + 1)
    const ym = proximo.toISOString().slice(0, 7)
    const r = await sb.rpc('pagar_fatura_cartao', {
      p_cartao_id: cartaoId, p_ano_mes: ym, p_valor: 50, p_data_pagamento: hoje,
      p_origem: 'saldo_principal', p_conta_nome: null, p_total_ciclo: 200, p_idempotency_key: `e2e-antecipado-${Date.now()}`,
    })
    expect(r.error).toBeNull()
    await sb.rpc('estornar_pagamento_fatura', { p_pagamento_id: r.data.id })
  })

  test('isolamento: usuário B não lê nem paga fatura do usuário A', async () => {
    test.skip(!EMAIL_B || !SENHA_B, 'Sem usuário B (E2E_EMAIL_B/E2E_SENHA_B)')
    const sbB = await clienteLogado(EMAIL_B, SENHA_B)
    const { data } = await sbB.from('pagamentos_fatura').select('id').eq('cartao_id', cartaoId)
    expect(data).toEqual([])
    const r = await sbB.rpc('pagar_fatura_cartao', {
      p_cartao_id: cartaoId, p_ano_mes: mesCorrente, p_valor: 10, p_data_pagamento: hoje,
      p_origem: 'saldo_principal', p_conta_nome: null, p_total_ciclo: 1000, p_idempotency_key: `e2e-b-${Date.now()}`,
    })
    expect(r.error).not.toBeNull()
  })
})
