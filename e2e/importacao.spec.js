import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import { isolarSupabase, perfilFalso, criarBancoMemoria, medirViewport, USUARIO_TESTE } from './apoio'

// Importação Inteligente com sessão e banco FALSOS (em memória) e arquivos
// fictícios. Nenhuma requisição chega ao Supabase real.

const fx = n => readFileSync(new URL(`../tests/fixtures/importacao/${n}`, import.meta.url))
const U = USUARIO_TESTE.id

// PDF mínimo válido, com uma linha de texto por item (fonte Helvetica padrão).
function gerarPDF(linhas) {
  const esc = s => s.replace(/[()\\]/g, m => `\\${m}`)
  const conteudo = ['BT', '/F1 11 Tf', '14 TL', '50 780 Td', ...linhas.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`), 'ET'].join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(pdf, 'latin1')
}

async function abrir(page, { banco = criarBancoMemoria(), perfil = perfilFalso() } = {}) {
  await isolarSupabase(page, { autenticado: true, banco, perfil })
  await page.goto('/importacao')
  await expect(page.getByTestId('importacao')).toBeVisible({ timeout: 20_000 })
  return banco
}
const enviar = (page, name, buffer, mimeType = 'text/plain') => page.getByTestId('importacao-arquivo').setInputFiles({ name, mimeType, buffer })
const item = (page, texto) => page.getByTestId('importacao-lista').locator('li').filter({ hasText: texto })
const confirmar = page => page.getByTestId('importacao-confirmar')

test('extrato CSV: prévia, impacto no saldo, confirmação e gravação sem transferências', async ({ page }) => {
  const banco = await abrir(page, { perfil: perfilFalso({ saldo_base_data: '2026-10-05' }) })
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(page.getByTestId('importacao-resumo')).toContainText('12 movimentações identificadas')
  await expect(page.getByTestId('importacao-resumo')).toContainText('2 linhas não foram lidas')
  await expect(page.getByTestId('importacao-impacto')).toContainText('43,69')
  await expect(page.getByTestId('importacao-qtd-incluidos')).toHaveText('8')
  // Nada gravado antes da confirmação.
  expect(banco.escritas).toHaveLength(0)
  await expect(item(page, 'PIX RECEBIDO').getByRole('checkbox')).not.toBeChecked()
  await expect(item(page, 'PAGAMENTO FATURA').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'APLICACAO CDB').getByRole('checkbox')).toBeDisabled()

  const m = await medirViewport(page)
  expect(m.scrollWidth, `vazando: ${m.vazando.join(', ')}`).toBeLessThanOrEqual(m.clientWidth)

  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toContainText('8 lançamentos importados')
  expect(banco.linhas('receitas').map(r => r.descricao).sort()).toEqual(['PAGTO SALARIO EMPRESA FICTICIA', 'REND PAGO APLIC AUT'])
  expect(banco.linhas('despesas')).toHaveLength(6)
  expect(banco.linhas('despesas').every(d => d.usuario_id === U && d.recorrente === false)).toBe(true)
  expect(banco.linhas('despesas').some(d => /FATURA|APLICACAO|TITULARIDADE/.test(d.descricao))).toBe(false)
  expect(banco.linhas('despesas').find(d => d.descricao.includes('SUPERMERCADO')).categoria_id).toBe('cat-alimentacao')
  expect(banco.linhas('investimentos_movimentacoes')).toHaveLength(0)
  // Histórico com chaves (hash), sem descrição.
  expect(banco.linhas('importacoes')).toHaveLength(1)
  expect(banco.linhas('importacoes_itens')).toHaveLength(8)
  expect(JSON.stringify(banco.linhas('importacoes_itens'))).not.toContain('SUPERMERCADO')

  // Reimportar o mesmo arquivo: nada novo.
  await page.getByRole('button', { name: 'Importar outro arquivo' }).click()
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(page.getByTestId('importacao-qtd-incluidos')).toHaveText('0')
  await expect(confirmar(page)).toBeDisabled()
  await expect(item(page, 'SUPERMERCADO').locator('[data-status]')).toHaveAttribute('data-status', /ja_importado|possivel_duplicata/)
})

test('sem histórico no banco, a duplicidade é detectada pelos lançamentos já cadastrados', async ({ page }) => {
  const banco = criarBancoMemoria({ despesas: [{ id: 'd1', usuario_id: U, data: '2026-10-03', valor: 182.4, descricao: 'Supermercado Bom Preço', recorrente: false }] })
  await abrir(page, { banco })
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(item(page, 'SUPERMERCADO').locator('[data-status]')).toHaveAttribute('data-status', 'possivel_duplicata')
  await expect(item(page, 'SUPERMERCADO').getByRole('checkbox')).not.toBeChecked()
  await expect(page.getByTestId('importacao-qtd-incluidos')).toHaveText('7')
})

test('corrigir, recategorizar, reclassificar e remover antes de confirmar', async ({ page }) => {
  const banco = await abrir(page)
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  const uber = item(page, 'UBER')
  await uber.getByRole('button', { name: 'Editar' }).click()
  await uber.getByLabel('Descrição').fill('Uber para o trabalho')
  await uber.getByLabel('Valor').fill('2590')
  await uber.getByLabel('Categoria').selectOption({ label: '🏠 Moradia' })
  await uber.getByRole('button', { name: 'Concluir edição' }).click()

  const pix = item(page, 'PIX ENVIADO')
  await pix.getByRole('button', { name: 'Editar' }).click()
  await pix.getByLabel('Tipo').selectOption('transferencia')
  await expect(pix.getByRole('checkbox')).not.toBeChecked()

  await item(page, 'TARIFA').getByRole('button', { name: /Remover/ }).click()
  await expect(item(page, 'TARIFA')).toHaveCount(0)

  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toBeVisible()
  const d = banco.linhas('despesas')
  expect(d.find(x => x.descricao === 'Uber para o trabalho')).toMatchObject({ valor: 25.9, categoria_id: 'cat-moradia' })
  expect(d.some(x => x.descricao.includes('PIX ENVIADO') || x.descricao.includes('TARIFA'))).toBe(false)
  expect(d).toHaveLength(4)
})

test('fatura OFX: compras no cartão, parcela com total, sem receita/despesa nem pagamento', async ({ page }) => {
  const banco = await abrir(page, { banco: criarBancoMemoria({ cartoes: [{ id: 'c1', usuario_id: U, nome: 'Cartão Teste', limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28 }] }) })
  // OFX de cartão escolhido como extrato: bloqueado com orientação.
  await enviar(page, 'fatura.ofx', fx('fatura-cartao.ofx'))
  await expect(page.getByRole('alert')).toContainText('Fatura de cartão')
  await page.getByRole('radio', { name: /Fatura de cartão/ }).click()
  await page.locator('#imp-cartao').selectOption('c1')
  await enviar(page, 'fatura.ofx', fx('fatura-cartao.ofx'))
  await expect(page.getByTestId('importacao-resumo')).toContainText('7 movimentações identificadas')
  await expect(item(page, 'PAGAMENTO RECEBIDO').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'ESTORNO').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'PARC 02/05')).toContainText('Parcela 2/5')
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toContainText('4 lançamentos importados')
  const compras = banco.linhas('compras_cartao')
  expect(compras).toHaveLength(4)
  expect(compras.every(c => c.cartao_id === 'c1' && c.usuario_id === U)).toBe(true)
  expect(compras.find(c => c.descricao.includes('PARC'))).toMatchObject({ valor_total: 1000, numero_parcelas: 5, data_compra: '2026-08-15' })
  expect(banco.linhas('receitas')).toHaveLength(0)
  expect(banco.linhas('despesas')).toHaveLength(0)
})

test('investimentos CSV: movimentações atualizam a posição, sem tocar receitas/despesas', async ({ page }) => {
  const banco = await abrir(page, { banco: criarBancoMemoria({ investimentos: [{ id: 'i1', usuario_id: U, nome: 'CDB Teste', categoria: 'cdb', valor_aplicado: 500, valor_atual: 500, reserva_valor: 0 }] }) })
  await page.getByRole('radio', { name: /Investimentos/ }).click()
  await page.locator('#imp-inv').selectOption('i1')
  await enviar(page, 'investimentos.csv', fx('investimentos.csv'), 'text/csv')
  await expect(item(page, 'Evento desconhecido').getByRole('checkbox')).toBeDisabled()
  await expect(page.getByTestId('importacao-qtd-incluidos')).toHaveText('4')
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toContainText('4 lançamentos importados')
  expect(banco.linhas('investimentos_movimentacoes').map(m => m.tipo).sort()).toEqual(['aporte', 'dividendo', 'rendimento', 'resgate'])
  const inv = banco.linhas('investimentos')[0]
  expect(Math.round(inv.valor_atual * 100) / 100).toBe(1257.94) // 500 + 1000 + 12,34 + 45,60 − 300
  expect(banco.linhas('receitas')).toHaveLength(0)
  expect(banco.linhas('despesas')).toHaveLength(0)
})

test('planilha XLSX é lida localmente', async ({ page }) => {
  const banco = await abrir(page)
  const ws = XLSX.utils.aoa_to_sheet([
    ['Data', 'Descrição', 'Valor'],
    ['02/10/2026', 'PAGTO SALARIO', 3000],
    ['04/10/2026', 'FARMACIA CENTRAL', -45.9],
  ])
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Extrato')
  await enviar(page, 'extrato.xlsx', Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  await expect(page.getByTestId('importacao-resumo')).toContainText('2 movimentações identificadas')
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toBeVisible()
  expect(banco.linhas('receitas')[0]).toMatchObject({ valor: 3000, data: '2026-10-02' })
  expect(banco.linhas('despesas')[0]).toMatchObject({ valor: 45.9, data: '2026-10-04' })
})

test('PDF com texto: lançamentos lidos e marcados para revisão', async ({ page }) => {
  const banco = await abrir(page)
  await enviar(page, 'extrato.pdf', gerarPDF(['EXTRATO FICTICIO', '02/10/2026 PAGTO SALARIO 4.800,00', '03/10/2026 MERCADO CENTRAL -182,40', 'SALDO FINAL 4.617,60']), 'application/pdf')
  await expect(page.getByTestId('importacao-resumo')).toContainText('2 movimentações identificadas', { timeout: 20_000 })
  await expect(page.getByTestId('importacao-lista').getByText('Revisar', { exact: true })).toHaveCount(2)
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toBeVisible()
  expect(banco.linhas('receitas')).toHaveLength(1)
  expect(banco.linhas('despesas')[0]).toMatchObject({ valor: 182.4 })
})

test('arquivos inválidos são recusados com mensagem e nada é gravado', async ({ page }) => {
  const banco = await abrir(page)
  const casos = [
    ['vazio.csv', Buffer.alloc(0), 'vazio'],
    ['falso.pdf', Buffer.from('isto não é um pdf'), 'não corresponde'],
    ['binario.csv', Buffer.from([1, 0, 2, 0, 3]), 'não suportado'],
    ['semcolunas.csv', Buffer.from('a;b\n1;2\n'), 'colunas'],
    ['quebrado.pdf', Buffer.from('%PDF-1.4\nlixo sem estrutura'), 'PDF'],
  ]
  for (const [nome, buf, trecho] of casos) {
    await enviar(page, nome, buf)
    await expect(page.getByRole('alert'), nome).toContainText(trecho, { timeout: 15_000 })
  }
  expect(banco.escritas).toHaveLength(0)
})

test('onboarding etapa 6 usa a mesma importação e volta ao fluxo', async ({ page }) => {
  await page.addInitScript(id => {
    localStorage.setItem(`almeida_apresentacao_vista_${id}`, '1')
    localStorage.setItem(`almeida_onboarding_progresso_${id}`, 'importacao')
  }, U)
  const banco = criarBancoMemoria()
  await isolarSupabase(page, { autenticado: true, banco, perfil: perfilFalso({ onboarding_concluido: false }) })
  await page.goto('/')
  await page.getByRole('button', { name: 'Continuar de onde parei' }).click({ timeout: 20_000 })
  await page.getByTestId('onboarding-importar-agora').click()
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await confirmar(page).click()
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByTestId('onboarding-progresso')).toHaveAttribute('data-etapa', '7')
  expect(banco.linhas('despesas')).toHaveLength(6)
})

test('indicador de progresso e cancelar antes de confirmar não grava nada', async ({ page }) => {
  const banco = await abrir(page)
  await expect(page.getByTestId('importacao-passos')).toHaveAttribute('data-passo', '1')
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(page.getByTestId('importacao-passos')).toHaveAttribute('data-passo', '2')
  await page.getByTestId('importacao-cancelar').click()
  await expect(page.getByTestId('importacao-passos')).toHaveAttribute('data-passo', '1')
  await expect(page.getByTestId('importacao-lista')).toHaveCount(0)
  expect(banco.escritas).toHaveLength(0)
})

test('falha de conexão ao analisar: mensagem clara e nada gravado', async ({ page }) => {
  const banco = await abrir(page)
  await page.route(/\/rest\/v1\/(receitas|despesas)\?/, r => r.abort('internetdisconnected'))
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(page.getByRole('alert')).toContainText('Sem conexão')
  expect(banco.escritas).toHaveLength(0)
})

test('falha de conexão ao gravar: informa o que não foi salvo', async ({ page }) => {
  const banco = await abrir(page)
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await page.route(/\/rest\/v1\/despesas/, r => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.fallback()))
  await confirmar(page).click()
  const fim = page.getByTestId('importacao-concluida')
  await expect(fim).toContainText('2 lançamentos importados') // só as receitas
  await expect(fim.getByRole('alert')).toContainText('6 em despesas')
  expect(banco.linhas('despesas')).toHaveLength(0)
  expect(banco.linhas('importacoes')[0].status).toBe('parcial')
})

test('isolamento: lançamento de outro usuário não interfere na duplicidade nem é lido', async ({ page }) => {
  const banco = criarBancoMemoria({ despesas: [{ id: 'x1', usuario_id: 'outro-usuario', data: '2026-10-03', valor: 182.4, descricao: 'SUPERMERCADO BOM PRECO', recorrente: false }] })
  await abrir(page, { banco })
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(item(page, 'SUPERMERCADO').locator('[data-status]')).toHaveCount(0)
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toBeVisible()
  expect(banco.linhas('despesas').filter(d => d.usuario_id === U)).toHaveLength(6)
  expect(banco.linhas('despesas').find(d => d.id === 'x1').usuario_id).toBe('outro-usuario')
})

test('saldo da Home depois da importação = saldo informado + impacto mostrado na prévia', async ({ page }) => {
  // A Home soma os lançamentos do mês corrente após a data do saldo: fixa
  // 'hoje' em outubro, mês do extrato fictício.
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00-03:00'))
  await abrir(page, { perfil: perfilFalso({ saldo_base: 1000, saldo_base_data: '2026-10-05' }) })
  await enviar(page, 'extrato.csv', fx('extrato-banco.csv'), 'text/csv')
  await expect(page.getByTestId('importacao-impacto')).toContainText('43,69')
  await confirmar(page).click()
  await page.getByRole('button', { name: 'Ir para a Home' }).click()
  await expect(page.getByText('R$ 956,31').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 }) // 1.000,00 − 43,69
})
