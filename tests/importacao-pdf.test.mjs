// Testes do leitor de PDF (texto extraído) — layouts fictícios, lib PURA.
import { textoPDFParaTransacoes, detectarInstituicao, detectarTipoDocumento } from '../src/lib/importacaoLeitura.js'
import { prepararItens, montarRegistros } from '../src/lib/importacaoRegras.js'

let falhas = 0
function assert(nome, c, det = '') { if (!c) falhas++; console.log(`${c ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }
const por = (r, t) => r.transacoes.find(x => x.descricao.includes(t))

console.log('# Fatura (meses por extenso, final do cartão, parcelas, virada de ano)')
const fatura = [
  'Nubank', 'Fatura do cartão', 'Vencimento: 10/01/2027', 'Fechamento 03/01/2027',
  '28 DEZ •••• 1234 Livraria Central R$ 89,90',
  '02 JAN •••• 1234 Mercado Bairro R$ 154,32',
  '15 AGO •••• 1234 Loja de Móveis - Parcela 5/10 R$ 200,00',
  'Total da fatura R$ 444,22',
  '04 JAN Pagamento recebido -R$ 1.000,00',
]
let r = textoPDFParaTransacoes(fatura, { anoPadrao: 2026 })
assert('instituição e tipo detectados', r.instituicao === 'Nubank' && r.tipoDocumento === 'fatura')
assert('3 compras + pagamento (negativo) lidos', r.transacoes.length === 4, `(${r.transacoes.length})`)
assert('dezembro numa fatura de janeiro → ano anterior', por(r, 'Livraria').data === '2026-12-28')
assert('janeiro no ano da fatura', por(r, 'Mercado').data === '2027-01-02')
assert('agosto do ano anterior', por(r, 'Loja de Móveis').data === '2027-08-15' || por(r, 'Loja de Móveis').data === '2026-08-15')
assert('final do cartão removido da descrição', por(r, 'Livraria').descricao === 'Livraria Central')
assert('"Total da fatura" não vira lançamento', !r.transacoes.some(t => /total/i.test(t.descricao)))
assert('parcela identificada', por(r, 'Loja').parcelaAtual === 5 && por(r, 'Loja').parcelaTotal === 10)
assert('data sem ano avisa que o ano foi deduzido', por(r, 'Mercado').avisos.some(a => a.includes('deduzido')))
const itens = prepararItens(r.transacoes, { contexto: 'fatura', origem: 'cartao:x', cartaoId: 'c1' })
assert('pagamento da fatura fora; compras dentro', itens.filter(i => i.tipo === 'compra').length === 3 && itens.find(i => i.descricao.includes('Pagamento')).tipo === 'pagamento_fatura')
assert('nenhuma receita/despesa gerada (sem contar em dobro)', montarRegistros(itens).despesas.length === 0 && montarRegistros(itens).receitas.length === 0)

console.log('\n# Extrato com coluna de saldo (sinal deduzido)')
const extrato = [
  'Banco Itaú', 'Extrato conta corrente', 'Período: 01/10/2026 a 31/10/2026',
  'Saldo anterior 1.000,00',
  '02/10 PAGTO SALARIO EMPRESA 4.800,00 5.800,00',
  '03/10 SUPERMERCADO BOM PRECO 182,40 5.617,60',
  '05/10 TRANSF MESMA TITULARIDADE 500,00 5.117,60',
  '06/10 ESTORNO COMPRA LOJA 40,00 5.157,60',
  '09/10 PAGAMENTO FATURA CARTAO 900,00 4.257,60',
  '12/10 COMPRA SEM VALOR NA LINHA',
]
r = textoPDFParaTransacoes(extrato, { anoPadrao: 2026 })
assert('instituição e tipo', r.instituicao === 'Itaú' && r.tipoDocumento === 'extrato')
assert('5 lançamentos', r.transacoes.length === 5)
assert('salário entrou (saldo subiu)', por(r, 'SALARIO').valor === 4800)
assert('supermercado saiu (saldo caiu)', por(r, 'SUPERMERCADO').valor === -182.4)
assert('estorno entrou (saldo subiu)', por(r, 'ESTORNO').valor === 40)
assert('aviso de sinal deduzido pelo saldo', por(r, 'SUPERMERCADO').avisos.some(a => a.includes('saldo')))
assert('linha com data e sem valor vai para "não reconhecidas" com trecho', r.descartadas.some(d => d.trecho?.includes('SEM VALOR')))
const ie = prepararItens(r.transacoes, { contexto: 'extrato', origem: 'extrato:x' })
assert('transferência própria e fatura fora; estorno fora', ['transferencia', 'pagamento_fatura', 'estorno'].every(t => !ie.find(i => i.tipo === t)?.incluir))
assert('só salário e supermercado são gravados', montarRegistros(ie).receitas.length === 1 && montarRegistros(ie).despesas.length === 1)

console.log('\n# Sinal indicado por D/C e valores sem pista')
r = textoPDFParaTransacoes(['Extrato', '02/10/2026 PAGTO SALARIO 4.800,00 C', '03/10/2026 MERCADO 182,40 D'], { anoPadrao: 2026 })
assert('C = entrada, D = saída', r.transacoes[0].valor === 4800 && r.transacoes[1].valor === -182.4)
r = textoPDFParaTransacoes(['Extrato', '02/10/2026 PAGTO SALARIO 4.800,00', '03/10/2026 MERCADO 182,40'], { anoPadrao: 2026 })
assert('sem sinal e sem saldo: marcado como incerto', r.transacoes.every(t => t.sinalIncerto))
const iu = prepararItens(r.transacoes, { contexto: 'extrato', origem: 'extrato:y' })
assert('incertos ficam desmarcados e pedem revisão', iu.every(i => !i.incluir && i.revisar) && montarRegistros(iu).despesas.length === 0)

console.log('\n# Investimentos e OCR')
r = textoPDFParaTransacoes(['XP Investimentos', 'Extrato de investimentos', '01/10/2026 Aplicação CDB Banco X 1.000,00', '15/10/2026 Rendimento CDB Banco X 12,34', '20/10/2026 Dividendos FICT11 45,60'], { anoPadrao: 2026 })
assert('instituição e tipo de investimentos', r.instituicao === 'XP Investimentos' && r.tipoDocumento === 'investimentos')
const ii = prepararItens(r.transacoes, { contexto: 'investimentos', origem: 'inv:1', investimentoId: 'i1' })
assert('aporte, rendimento e dividendo', ii.map(i => i.tipo).join() === 'aporte,rendimento,dividendo')
r = textoPDFParaTransacoes(['02/10/2026 PAGTO SALARIO 4.800,00 C'], { anoPadrao: 2026, ocr: true })
assert('OCR: aviso específico em cada lançamento', r.ocr === true && r.transacoes[0].avisos[0].includes('OCR'))

console.log('\n# Nada reconhecido')
r = textoPDFParaTransacoes(['Relatório mensal', 'Resumo geral sem lançamentos'], { anoPadrao: 2026 })
assert('erro claro com saída manual', r.transacoes.length === 0 && /manualmente/.test(r.erro))
assert('instituição desconhecida = null', detectarInstituicao(['Banco Fictício']) === null && detectarTipoDocumento(['qualquer coisa']) === null)

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
