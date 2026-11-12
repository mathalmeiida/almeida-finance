import { test, expect } from '@playwright/test'
import sharp from 'sharp'
import { isolarSupabase, perfilFalso, criarBancoMemoria, USUARIO_TESTE } from './apoio'
import { gerarPDF, gerarPDFImagem } from './pdfApoio'

// Importação de PDF (documentos FICTÍCIOS, banco em memória). Nada chega ao
// Supabase real e nenhum arquivo sai do navegador.
const U = USUARIO_TESTE.id

async function abrir(page, { banco = criarBancoMemoria(), perfil = perfilFalso() } = {}) {
  await isolarSupabase(page, { autenticado: true, banco, perfil })
  await page.goto('/importacao')
  await expect(page.getByTestId('importacao')).toBeVisible({ timeout: 20_000 })
  return banco
}
const enviar = (page, nome, buffer) => page.getByTestId('importacao-arquivo').setInputFiles({ name: nome, mimeType: 'application/pdf', buffer })
const item = (page, texto) => page.getByTestId('importacao-lista').locator('li').filter({ hasText: texto })
const confirmar = page => page.getByTestId('importacao-confirmar')

const EXTRATO = [
  'Banco Itaú', 'Extrato conta corrente', 'Período: 01/10/2026 a 31/10/2026', 'Saldo anterior 1.000,00',
  '02/10 PAGTO SALARIO EMPRESA 4.800,00 5.800,00',
  '03/10 SUPERMERCADO BOM PRECO 182,40 5.617,60',
  '05/10 TRANSF MESMA TITULARIDADE 500,00 5.117,60',
  '06/10 ESTORNO COMPRA LOJA 40,00 5.157,60',
  '09/10 PAGAMENTO FATURA CARTAO 900,00 4.257,60',
]

test('PDF de extrato: instituição, estorno/transferência/fatura fora, duplicidade e gravação só do confirmado', async ({ page }) => {
  const banco = await abrir(page, { banco: criarBancoMemoria({ despesas: [{ id: 'd1', usuario_id: U, data: '2026-10-03', valor: 182.4, descricao: 'Supermercado Bom Preço', recorrente: false }] }) })
  await enviar(page, 'extrato.pdf', gerarPDF([EXTRATO]))
  await expect(page.getByTestId('importacao-resumo')).toContainText('5 movimentações identificadas', { timeout: 30_000 })
  await expect(page.getByTestId('importacao-resumo')).toContainText('Itaú')
  expect(banco.escritas).toHaveLength(0) // nada gravado antes da confirmação
  await expect(item(page, 'TRANSF MESMA').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'PAGAMENTO FATURA').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'ESTORNO').getByRole('checkbox')).toBeDisabled()
  await expect(item(page, 'SUPERMERCADO').locator('[data-status]')).toHaveAttribute('data-status', 'possivel_duplicata')
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toContainText('1 lançamentos importados')
  expect(banco.linhas('receitas').map(r => r.valor)).toEqual([4800])
  expect(banco.linhas('despesas')).toHaveLength(1) // só a que já existia
})

test('PDF de várias páginas é lido por inteiro', async ({ page }) => {
  await abrir(page)
  const pag = n => [`0${n}/10/2026 COMPRA A${n} -10,00`, `1${n}/10/2026 COMPRA B${n} -20,00`]
  await enviar(page, 'longo.pdf', gerarPDF([pag(1), pag(2), pag(3)]))
  await expect(page.getByTestId('importacao-resumo')).toContainText('6 movimentações identificadas', { timeout: 30_000 })
})

test('fatura em PDF com parcela: vira compra no cartão com o total; pagamento fora', async ({ page }) => {
  const banco = await abrir(page, { banco: criarBancoMemoria({ cartoes: [{ id: 'c1', usuario_id: U, nome: 'Cartão Teste', limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28 }] }) })
  await page.getByRole('radio', { name: /Fatura de cartão/ }).click()
  await page.locator('#imp-cartao').selectOption('c1')
  await enviar(page, 'fatura.pdf', gerarPDF([[
    'Nubank', 'Fatura do cartão', 'Vencimento: 10/11/2026',
    '05 OUT •••• 1234 Padaria Pao Quente R$ 25,90',
    '15 AGO •••• 1234 Loja de Moveis - Parcela 5/10 R$ 200,00',
    '20 OUT Pagamento recebido -R$ 900,00',
  ]]))
  await expect(page.getByTestId('importacao-resumo')).toContainText('Nubank', { timeout: 30_000 })
  await expect(item(page, 'Loja de Moveis')).toContainText('Parcela 5/10')
  await expect(item(page, 'Pagamento recebido').getByRole('checkbox')).toBeDisabled()
  await confirmar(page).click()
  await expect(page.getByTestId('importacao-concluida')).toContainText('2 lançamentos importados')
  const compras = banco.linhas('compras_cartao')
  expect(compras.find(c => c.descricao.includes('Loja'))).toMatchObject({ valor_total: 2000, numero_parcelas: 10, data_compra: '2026-08-15', cartao_id: 'c1' })
  expect(banco.linhas('despesas')).toHaveLength(0)
  expect(banco.linhas('receitas')).toHaveLength(0)
})

test('PDF protegido por senha: pede a senha, recusa a errada e abre com a correta', async ({ page }) => {
  await abrir(page)
  await enviar(page, 'protegido.pdf', gerarPDF([EXTRATO], { senha: 'abc123' }))
  const form = page.getByTestId('importacao-senha')
  await expect(form).toBeVisible({ timeout: 20_000 })
  await form.getByLabel('Este PDF é protegido por senha').fill('errada')
  await form.getByRole('button', { name: 'Abrir PDF' }).click()
  await expect(form).toContainText('Senha incorreta', { timeout: 20_000 })
  await form.getByLabel('Este PDF é protegido por senha').fill('abc123')
  await form.getByRole('button', { name: 'Abrir PDF' }).click()
  await expect(page.getByTestId('importacao-resumo')).toContainText('5 movimentações identificadas', { timeout: 30_000 })
  await expect(page.getByTestId('importacao-senha')).toHaveCount(0)
  // A senha não fica guardada em nenhum armazenamento do navegador.
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }))
  expect(guardado).not.toContain('abc123')
})

test('PDF digitalizado (imagem): OCR local lê os lançamentos e avisa para conferir', async ({ page, browser }) => {
  test.setTimeout(240_000)
  // Imagem renderizada com texto de verdade (fonte do navegador), sem texto no PDF.
  const aux = await browser.newPage({ viewport: { width: 900, height: 400 } })
  await aux.setContent(`<body style="margin:0;background:#fff;font:32px Arial,Helvetica,sans-serif;color:#000;padding:24px;line-height:56px">
    EXTRATO CONTA CORRENTE<br>02/10/2026 PAGTO SALARIO 4.800,00 C<br>03/10/2026 MERCADO CENTRAL 182,40 D<br>05/10/2026 FARMACIA SAUDE 95,00 D</body>`)
  const png = await aux.screenshot()
  await aux.close()
  const jpeg = await sharp(png).jpeg({ quality: 90 }).toBuffer()
  const meta = await sharp(jpeg).metadata()
  const banco = await abrir(page)
  await enviar(page, 'digitalizado.pdf', gerarPDFImagem({ jpeg, largura: meta.width, altura: meta.height }))
  await expect(page.getByTestId('importacao-resumo')).toBeVisible({ timeout: 200_000 })
  await expect(page.getByTestId('importacao-aviso-ocr')).toBeVisible()
  await expect(page.getByTestId('importacao-lista')).toContainText('4.800,00')
  expect(await page.getByTestId('importacao-lista').locator('li').count()).toBeGreaterThanOrEqual(2)
  expect(banco.escritas).toHaveLength(0) // revisão obrigatória: nada gravado
})

test('layout não reconhecido: mensagem clara com saída manual, nada gravado', async ({ page }) => {
  const banco = await abrir(page)
  await enviar(page, 'estranho.pdf', gerarPDF([['Relatorio mensal da conta', 'Resumo geral sem lancamentos']]))
  await expect(page.getByRole('alert').first()).toContainText('Não reconhecemos lançamentos', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Cadastrar despesa' })).toBeVisible()
  expect(banco.escritas).toHaveLength(0)
})

test('documento de outro tipo: avisa sem bloquear', async ({ page }) => {
  await abrir(page) // contexto padrão = extrato
  await enviar(page, 'fatura.pdf', gerarPDF([['Fatura do cartão', 'Vencimento: 10/11/2026', 'Limite disponível', '05 OUT Padaria R$ 25,90']]))
  await expect(page.getByTestId('importacao-aviso-tipo')).toContainText('fatura de cartão', { timeout: 30_000 })
})
