// Testes da Importação Inteligente — motor PURO (sem React/Supabase).
// Executar: npm run test:importacao
// Cobre: extrato bancário (CSV, OFX, PDF), fatura de cartão (PDF, CSV, OFX,
// XLS), extrato de investimentos (XLSX, CSV, PDF), duplicidades, aprendizado
// de categorias, montagem do pacote de gravação e validação de arquivos.

import * as pdfjs from '../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
import { extrairDocumento } from '../src/lib/importacao/motor.js'
import { analisarItens, calcularPrecoMedio, detectarDuplicidades } from '../src/lib/importacao/analisar.js'
import { montarPayload } from '../src/lib/importacao/payload.js'
import { parseValor, parseData, chaveAprendizado } from '../src/lib/importacao/normalizar.js'
import { detectarParcela } from '../src/lib/importacao/interpretar.js'
import { valorReceitaRecorrenteNoMes } from '../src/lib/recorrenciaReceita.js'
import { gerarPdfTexto, gerarPdfSemTexto } from './helpers/gerarPdf.mjs'
import { gerarXlsx, gerarXls } from './helpers/gerarPlanilhas.mjs'

let falhas = 0
let total = 0
function ok(nome, cond, det = '') {
  total++
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome}${!cond && det ? ` (${det})` : ''}`)
}
function igual(nome, obtido, esperado) {
  const a = JSON.stringify(obtido), b = JSON.stringify(esperado)
  ok(nome, a === b, `obtido ${a}, esperado ${b}`)
}

const HOJE = '2026-11-08'
const recursos = { carregarPdfjs: async () => pdfjs }
const latin1 = t => new Uint8Array(Buffer.from(t, 'latin1'))
const utf8 = t => new Uint8Array(Buffer.from(t, 'utf8'))
const extrair = (bytes, nome, tipoDocumento, extra = {}) =>
  extrairDocumento({ bytes, nome, tipoDocumento, hoje: HOJE, ...extra }, recursos)
async function falha(promessa) {
  try { await promessa; return null } catch (e) { return e }
}

const CAT_DESPESA = ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Serviços', 'Internet', 'Empréstimos', 'Vestuário', 'Pets', 'Outros', 'Eletrônicos', 'Viagem']
  .map((nome, i) => ({ id: `cd-${i}`, nome, tipo: 'despesa' }))
const CAT_RECEITA = ['Salário', 'Freelance', 'Renda extra', 'Dividendos / JCP', 'Rendimentos', 'Reembolso', 'Outras receitas']
  .map((nome, i) => ({ id: `cr-${i}`, nome, tipo: 'receita' }))
const catNome = id => [...CAT_DESPESA, ...CAT_RECEITA].find(c => c.id === id)?.nome
const ocorrenciaDespesa = (d, ano, mes) => {
  const [a, m] = d.data.split('-').map(Number)
  return (ano * 12 + mes) >= (a * 12 + m) && d.frequencia === 'mensal' ? Number(d.valor) : 0
}
const ctxBase = (extra = {}) => ({
  categoriasDespesa: CAT_DESPESA, categoriasReceita: CAT_RECEITA,
  ocorrenciaDespesa, ocorrenciaReceita: valorReceitaRecorrenteNoMes,
  existentes: {}, regrasUsuario: [], ...extra,
})

// ════════════════════════════════════════════════════════════════════════════
console.log('# Normalização')
ok('valor BR 1.234,56', parseValor('R$ 1.234,56') === 1234.56)
ok('valor negativo com sufixo D', parseValor('1.234,56 D') === -1234.56)
ok('valor com menos no fim', parseValor('99,90-') === -99.9)
ok('valor entre parênteses', parseValor('(50,00)') === -50)
ok('valor OFX -12.50', parseValor('-12.50') === -12.5)
ok('milhar BR sem decimais 12.500', parseValor('12.500') === 12500)
ok('texto não numérico → null', parseValor('abc') === null)
ok('data dd/mm/aaaa', parseData('05/11/2026') === '2026-11-05')
ok('data OFX com fuso', parseData('20261105120000[-3:BRT]') === '2026-11-05')
ok('data dd/mm usa ano da referência', parseData('15/12', { referencia: '2027-01-10' }) === '2026-12-15')
ok('data "05 NOV"', parseData('05 NOV', { referencia: '2026-11-30' }) === '2026-11-05')
ok('data inválida 31/02 → null', parseData('31/02/2026') === null)
ok('chave de aprendizado remove números e genéricos', chaveAprendizado('PIX ENVIADO UBER DO BRASIL 12/10') === 'UBER')
igual('parcela explícita "PARC 03/10"', detectarParcela('LOJA X PARC 03/10'), { atual: 3, total: 10, explicito: true, limpa: 'LOJA X' })
igual('parcela "Parcela 2/3" (Nubank)', detectarParcela('Loja Y - Parcela 2/3')?.total, 3)

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Extrato bancário — CSV (Windows-1252, separador ;)')
const csvBanco = [
  'Extrato Conta Corrente - Banco Itaú',
  'Data;Lançamento;Valor (R$);Saldo (R$)',
  '01/10/2026;SALDO ANTERIOR;;1.000,00',
  '01/10/2026;PIX RECEBIDO EMPRESA ACME SALARIO;5.000,00;6.000,00',
  '02/10/2026;SUPERMERCADO PAO DE ACUCAR;-250,40;5.749,60',
  '02/10/2026;SUPERMERCADO PAO DE ACUCAR;-250,40;5.499,20',
  '03/10/2026;UBER *TRIP;-23,90;5.475,30',
  '05/10/2026;NETFLIX.COM;-55,90;5.419,40',
  '06/10/2026;PAGAMENTO FATURA CARTAO ITAUCARD;-1.200,00;4.219,40',
  '07/10/2026;APLICACAO CDB DI;-1.000,00;3.219,40',
  '08/10/2026;TARIFA PACOTE SERVICOS;-39,90;3.179,50',
  '09/10/2026;PIX ENVIADO MATHEUS ALMEIDA SILVA;-500,00;2.679,50',
  '10/10/2026;ENEL DISTRIBUICAO ENERGIA;-180,00;2.499,50',
  '11/10/2026;DROGARIA SAO PAULO;-45,00;2.454,50',
  '12/10/2026;RENDIMENTO POUPANCA;3,21;2.457,71',
  '05/11/2026;NETFLIX.COM;-55,90;2.401,81',
].join('\r\n')
const docBanco = await extrair(latin1(csvBanco), 'extrato.csv', 'extrato_bancario', { nomeTitular: 'Matheus Almeida Silva' })
ok('formato detectado = csv', docBanco.formato === 'csv')
ok('instituição reconhecida = Itaú', docBanco.instituicao === 'Itaú', docBanco.instituicao)
ok('linha de SALDO ANTERIOR ignorada', !docBanco.itens.some(i => /SALDO/.test(i.descricao)))
ok('13 movimentações identificadas', docBanco.itens.length === 13, docBanco.itens.length)
const porDesc = (doc, trecho) => doc.itens.find(i => i.descricao.includes(trecho))
ok('PIX recebido = receita via PIX', porDesc(docBanco, 'ACME').natureza === 'receita' && porDesc(docBanco, 'ACME').meio === 'pix')
ok('pagamento de fatura não vira despesa', porDesc(docBanco, 'FATURA').natureza === 'pagamento_fatura' && porDesc(docBanco, 'FATURA').destino === null)
ok('aplicação em CDB não é despesa de consumo', porDesc(docBanco, 'CDB').natureza === 'aplicacao' && porDesc(docBanco, 'CDB').destino === null)
ok('PIX para o próprio titular = transferência interna', porDesc(docBanco, 'MATHEUS').natureza === 'transferencia')
ok('cabeçalho "Lançamento" (Windows-1252) reconhecido sem dedução de colunas', docBanco.colunasInferidas === false)
const comAssinaturas = analisarItens(docBanco.itens, ctxBase({ tipoDocumento: 'extrato_bancario', categoriasDespesa: [...CAT_DESPESA, { id: 'cd-ass', nome: 'Assinaturas' }] }))
ok('Netflix → Assinaturas quando a categoria existe na conta', comAssinaturas.itens.find(i => i.descricao.includes('NETFLIX')).categoriaId === 'cd-ass')

const existentesBanco = {
  despesas: [
    { id: 'd1', descricao: 'Supermercado Pão de Açúcar', valor: 250.40, data: '2026-10-02', frequencia: 'nao_repete' },
    { id: 'd2', descricao: 'Presente aniversário', valor: 45.00, data: '2026-10-11', frequencia: 'nao_repete' },
    { id: 'd3', descricao: 'Conta de energia ENEL', valor: 175.00, data: '2026-01-10', frequencia: 'mensal', recorrente: true },
  ],
  receitas: [
    { id: 'r1', descricao: 'Salário ACME', valor: 5000, data: '2026-01-01', frequencia: 'mensal', recorrente: true },
  ],
  impressoes: [],
}
const anBanco = analisarItens(docBanco.itens, ctxBase({ tipoDocumento: 'extrato_bancario', instituicao: docBanco.instituicao, existentes: existentesBanco }))
const aDesc = (an, trecho) => an.itens.filter(i => i.descricao.includes(trecho))
ok('categoria: supermercado → Alimentação', catNome(aDesc(anBanco, 'PAO DE ACUCAR')[0].categoriaId) === 'Alimentação')
ok('categoria: Uber → Transporte', catNome(aDesc(anBanco, 'UBER')[0].categoriaId) === 'Transporte')
ok('categoria: Netflix → Serviços (sem "Assinaturas" na conta)', catNome(aDesc(anBanco, 'NETFLIX')[0].categoriaId) === 'Serviços')
ok('categoria: energia → Moradia (fixa)', catNome(aDesc(anBanco, 'ENEL')[0].categoriaId) === 'Moradia' && aDesc(anBanco, 'ENEL')[0].tipoDespesa === 'fixa')
ok('categoria: farmácia → Saúde', catNome(aDesc(anBanco, 'DROGARIA')[0].categoriaId) === 'Saúde')
ok('categoria: rendimento → Rendimentos', aDesc(anBanco, 'RENDIMENTO')[0].categoriaNome === 'Rendimentos')
const mercados = aDesc(anBanco, 'PAO DE ACUCAR')
ok('duplicidade 1-para-1: só UMA das duas compras iguais é marcada', mercados.filter(i => i.duplicidade).length === 1)
ok('provável duplicidade fica desmarcada', mercados.find(i => i.duplicidade).selecionado === false && mercados.find(i => !i.duplicidade).selecionado === true)
const drog = aDesc(anBanco, 'DROGARIA')[0]
ok('mesmo valor e data com descrição diferente = só "possível" e continua selecionado',
  drog.duplicidade?.nivel === 'possivel' && drog.selecionado === true)
const salario = aDesc(anBanco, 'ACME')[0]
ok('salário já previsto como receita recorrente → provável duplicidade', salario.duplicidade?.nivel === 'provavel' && salario.duplicidade.recorrente)
ok('energia coincide com despesa recorrente (valor ±10%)', aDesc(anBanco, 'ENEL')[0].duplicidade?.recorrente === true)
ok('Netflix em 2 meses → marcada como recorrente', aDesc(anBanco, 'NETFLIX').every(i => i.recorrente))
ok('resumo: 2 receitas e 3 transferências', anBanco.resumo.receitas === 2 && anBanco.resumo.transferencias === 3, JSON.stringify(anBanco.resumo))

// Importação recorrente: o mesmo arquivo de novo é reconhecido por impressão digital.
const impressoesSalvas = anBanco.itens.filter(i => i.selecionado).map(i => ({ impressao_digital: i.impressao, tabela: i.destino, registro_id: `x-${i.id}` }))
const reimportado = analisarItens(docBanco.itens, ctxBase({ tipoDocumento: 'extrato_bancario', instituicao: docBanco.instituicao, existentes: { impressoes: impressoesSalvas } }))
ok('reimportação: itens já importados marcados como "certa" e desmarcados',
  reimportado.itens.filter(i => i.duplicidade?.nivel === 'certa').length === impressoesSalvas.length &&
  reimportado.itens.filter(i => i.duplicidade?.nivel === 'certa').every(i => !i.selecionado))
ok('reimportação: as duas compras idênticas têm impressões diferentes', new Set(mercados.map(i => i.impressao)).size === 2)

// Aprendizado por usuário
const comRegra = analisarItens(docBanco.itens, ctxBase({ tipoDocumento: 'extrato_bancario', regrasUsuario: [{ destino: 'despesas', padrao: 'UBER TRIP', categoria_id: 'cd-5' }] }))
ok('regra aprendida do usuário prevalece (Uber → Lazer)', catNome(aDesc(comRegra, 'UBER')[0].categoriaId) === 'Lazer' && aDesc(comRegra, 'UBER')[0].origemCategoria === 'aprendida')
const outroUsuario = analisarItens(docBanco.itens, ctxBase({ tipoDocumento: 'extrato_bancario' }))
ok('sem a regra (outro usuário), volta à regra padrão', catNome(aDesc(outroUsuario, 'UBER')[0].categoriaId) === 'Transporte')

// Pacote de gravação
const { payload: pBanco, erros: eBanco } = montarPayload({
  tipoDocumento: 'extrato_bancario', arquivos: [docBanco], instituicao: docBanco.instituicao, periodo: docBanco.periodo, itens: anBanco.itens,
})
ok('payload sem erros', eBanco.length === 0, eBanco.join('; '))
ok('payload só com selecionados (sem transferências/duplicidades prováveis)', pBanco.itens.length === anBanco.itens.filter(i => i.selecionado).length)
ok('despesa no payload tem forma de pagamento e tipo', pBanco.itens.some(i => i.tabela === 'despesas' && i.dados.tipo_despesa && 'forma_pagamento' in i.dados))
ok('receita usa nome da categoria (coluna texto)', pBanco.itens.filter(i => i.tabela === 'receitas').every(i => typeof i.dados.categoria === 'string'))
ok('regras de aprendizado enviadas', pBanco.regras.length > 0 && pBanco.regras.every(r => r.padrao && r.destino))
ok('arquivo enviado apenas como hash/tamanho/formato', pBanco.arquivos[0].hash.length === 64 && !('texto' in pBanco.arquivos[0]))

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Extrato bancário — OFX')
const ofx = `OFXHEADER:100
DATA:OFXSGML
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>NU PAGAMENTOS<FID>260</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>0260<ACCTID>123456789</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261031
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005000000[-3:BRT]<TRNAMT>1500.00<FITID>A1<MEMO>Transferência recebida pelo Pix - CLIENTE X</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261006<TRNAMT>-89.90<FITID>A2<MEMO>Compra no débito - IFOOD *RESTAURANTE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261007<TRNAMT>-120.00<FITID>A3<MEMO>Pagamento de boleto efetuado - SABESP</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>2290.10<DTASOF>20261031</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
const docOfx = await extrair(utf8(ofx), 'nubank.ofx', 'extrato_bancario')
ok('formato = ofx', docOfx.formato === 'ofx')
ok('instituição pelo código COMPE 260 = Nubank', docOfx.instituicao === 'Nubank')
ok('3 transações com FITID', docOfx.itens.length === 3 && docOfx.itens.every(i => i.idExterno))
ok('sinais do OFX respeitados', docOfx.itens[0].natureza === 'receita' && docOfx.itens[1].natureza === 'despesa')
ok('boleto identificado como meio de pagamento', docOfx.itens[2].meio === 'boleto')
ok('saldo final lido apenas como informação', docOfx.meta.saldoFinal.valor === 2290.1)
ok('período do OFX', docOfx.periodo.inicio === '2026-10-01' && docOfx.periodo.fim === '2026-10-31')
const anOfx = analisarItens(docOfx.itens, ctxBase({ tipoDocumento: 'extrato_bancario', instituicao: 'Nubank' }))
ok('iFood → Alimentação; Sabesp → Moradia', catNome(anOfx.itens[1].categoriaId) === 'Alimentação' && catNome(anOfx.itens[2].categoriaId) === 'Moradia')

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Extrato bancário — PDF sem sinais (sentido pelo saldo)')
const pdfBanco = gerarPdfTexto([
  'BANCO BRADESCO S.A. - Extrato de conta corrente',
  'Período: 01/10/2026 a 31/10/2026',
  ['Data', 'Histórico', 'Valor', 'Saldo'],
  ['01/10/2026', 'SALDO ANTERIOR', '', '1.000,00'],
  ['02/10/2026', 'TED 237 EMPRESA XPTO', '3.000,00', '4.000,00'],
  ['03/10/2026', 'CONTA DE LUZ', '150,00', '3.850,00'],
  ['04/10/2026', 'OPERACAO 99', '20,00', '3.870,00'],
])
const docPdfBanco = await extrair(pdfBanco, 'extrato.pdf', 'extrato_bancario')
ok('formato = pdf', docPdfBanco.formato === 'pdf')
ok('Bradesco reconhecido', docPdfBanco.instituicao === 'Bradesco')
ok('3 lançamentos lidos do PDF', docPdfBanco.itens.length === 3, docPdfBanco.itens.length)
ok('crédito pelo aumento do saldo', docPdfBanco.itens[0].natureza === 'receita')
ok('débito pela redução do saldo', docPdfBanco.itens[1].natureza === 'despesa')
ok('sem palavra-chave mas com saldo: sentido confirmado (entrada)', docPdfBanco.itens[2].natureza === 'receita' && docPdfBanco.itens[2].pendencias.length === 0)
ok('período do documento', docPdfBanco.periodo.inicio === '2026-10-01' && docPdfBanco.periodo.fim === '2026-10-31')

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Fatura de cartão — PDF')
const pdfFatura = gerarPdfTexto([
  'ITAUCARD - Fatura do cartão Platinum',
  'Fechamento da fatura: 03/11/2026',
  'Vencimento: 10/11/2026',
  'Total da fatura R$ 302,41',
  ['05/10', 'MERCADO LIVRE*LOJA 03/10', '150,00'],
  ['12/10', 'NETFLIX.COM', '55,90'],
  ['15/10', 'UBER *TRIP', '23,40'],
  ['20/10', 'ESTORNO LOJA X', '-30,00'],
  ['25/10', 'PAGAMENTO EFETUADO', '-1.000,00'],
  ['28/10', 'IOF COMPRA INTERNACIONAL', '3,21'],
  ['02/11', 'AMAZON PARC 01/12', '99,90'],
])
const docFat = await extrair(pdfFatura, 'fatura.pdf', 'fatura_cartao')
ok('Itaú reconhecido na fatura', docFat.instituicao === 'Itaú')
ok('vencimento e fechamento lidos', docFat.meta.vencimento === '2026-11-10' && docFat.meta.fechamento === '2026-11-03')
ok('7 lançamentos', docFat.itens.length === 7, docFat.itens.length)
const fat = t => docFat.itens.find(i => i.descricaoOriginal.includes(t))
ok('compra parcelada 03/10 → compra de origem 10x de 150', fat('MERCADO LIVRE').numeroParcelas === 10 && fat('MERCADO LIVRE').valorTotal === 1500 && fat('MERCADO LIVRE').parcelaAtual === 3)
ok('parcelamento sem prefixo PARC fica pendente de confirmação', fat('MERCADO LIVRE').pendencias.some(p => p.includes('Confirme')))
ok('descrição sem o texto da parcela', fat('MERCADO LIVRE').descricao === 'MERCADO LIVRE*LOJA')
ok('PARC 01/12 explícito → 12x, total 1.198,80', fat('AMAZON').numeroParcelas === 12 && fat('AMAZON').valorTotal === 1198.8)
ok('estorno identificado e não importado', fat('ESTORNO').natureza === 'estorno' && fat('ESTORNO').destino === null)
ok('pagamento da fatura identificado e não importado', fat('PAGAMENTO').natureza === 'pagamento' && fat('PAGAMENTO').destino === null)
ok('IOF = encargo, importado no cartão', fat('IOF').natureza === 'encargo' && fat('IOF').destino === 'compras_cartao')
ok('compra à vista = 1 parcela', fat('NETFLIX').numeroParcelas === 1 && fat('NETFLIX').valorTotal === 55.9)

const cartao = { id: 'cartao-1', nome: 'Itaú Platinum', banco: 'Itaú', dia_fechamento: 3, dia_vencimento: 10 }
const anFat = analisarItens(docFat.itens, ctxBase({ tipoDocumento: 'fatura_cartao', instituicao: 'Itaú', meta: docFat.meta, cartao }))
const anF = t => anFat.itens.find(i => i.descricaoOriginal.includes(t))
ok('soma dos lançamentos confere com o total da fatura (sem aviso)', !anFat.avisos.some(a => a.includes('soma')), anFat.avisos.join(' | '))
ok('parcela 3/10 incoerente com a data → sugere data da compra original', anF('MERCADO LIVRE').dataCompraSugerida === '2026-08-05', anF('MERCADO LIVRE').dataCompraSugerida)
ok('parcela 1/12 coerente → sem sugestão', anF('AMAZON').dataCompraSugerida === null)
ok('não inventa parcelas: uma única compra de origem por linha', anFat.itens.filter(i => i.descricaoOriginal.includes('AMAZON')).length === 1)

const { payload: pFat, erros: eFat0 } = montarPayload({ tipoDocumento: 'fatura_cartao', arquivos: [docFat], instituicao: 'Itaú', periodo: docFat.periodo, itens: anFat.itens, cartaoId: null })
ok('sem cartão escolhido → erro claro', pFat === null && eFat0.some(e => e.includes('cartão')))
const { payload: pFat2 } = montarPayload({ tipoDocumento: 'fatura_cartao', arquivos: [docFat], instituicao: 'Itaú', periodo: docFat.periodo, itens: anFat.itens, cartaoId: 'cartao-1' })
const compraParc = pFat2.itens.find(i => i.dados.descricao === 'MERCADO LIVRE*LOJA')
ok('payload: compra parcelada gravada uma vez com 10 parcelas', compraParc.dados.numero_parcelas === 10 && compraParc.dados.valor_total === 1500 && compraParc.dados.cartao_id === 'cartao-1')
ok('payload: estorno e pagamento fora da gravação', !pFat2.itens.some(i => /ESTORNO|PAGAMENTO/.test(i.dados.descricao)))

// Próximo mês: a parcela 04/10 da mesma compra já cadastrada
const pdfFaturaDez = gerarPdfTexto([
  'ITAUCARD', 'Fechamento: 03/12/2026', 'Vencimento: 10/12/2026',
  ['05/08', 'MERCADO LIVRE*LOJA 04/10', '150,00'],
  ['20/11', 'PADARIA REAL', '18,00'],
])
const docFatDez = await extrair(pdfFaturaDez, 'fatura-dez.pdf', 'fatura_cartao')
const comprasExistentes = [{ id: 'c1', cartao_id: 'cartao-1', descricao: 'MERCADO LIVRE*LOJA', valor_total: 1500, numero_parcelas: 10, data_compra: '2026-08-05' }]
const anDez = analisarItens(docFatDez.itens, ctxBase({ tipoDocumento: 'fatura_cartao', meta: docFatDez.meta, cartao, existentes: { compras: comprasExistentes } }))
const parc4 = anDez.itens.find(i => i.descricaoOriginal.includes('MERCADO'))
ok('fatura seguinte: parcela 04/10 reconhecida como compra parcelada já cadastrada', parc4.duplicidade?.registroId === 'c1' && parc4.selecionado === false)
ok('fatura seguinte: compra nova sugerida para importação', anDez.itens.find(i => i.descricaoOriginal.includes('PADARIA')).selecionado === true)
ok('compra de outro cartão não conta como duplicidade', analisarItens(docFatDez.itens, ctxBase({ tipoDocumento: 'fatura_cartao', cartao: { ...cartao, id: 'outro' }, existentes: { compras: comprasExistentes } })).itens[0].duplicidade === null)

console.log('\n# Fatura de cartão — CSV (Nubank) e OFX (sinal invertido)')
const csvNubank = 'date,title,amount\n2026-10-03,Restaurante Sabor,45.90\n2026-10-04,Loja Y - Parcela 2/3,100.00\n2026-10-10,Pagamento recebido,-500.00\n'
const docNu = await extrair(utf8(csvNubank), 'nubank-2026-11.csv', 'fatura_cartao')
ok('CSV de fatura: 3 linhas', docNu.itens.length === 3)
ok('CSV: compra positiva = compra', docNu.itens[0].natureza === 'compra')
ok('CSV: "Parcela 2/3" → 3x, total 300', docNu.itens[1].numeroParcelas === 3 && docNu.itens[1].valorTotal === 300)
ok('CSV: pagamento recebido identificado', docNu.itens[2].natureza === 'pagamento')
const ofxCartao = `OFXHEADER:100
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261003<TRNAMT>-45.90<FITID>C1<MEMO>RESTAURANTE SABOR</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261004<TRNAMT>-80.00<FITID>C2<MEMO>POSTO SHELL</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261010<TRNAMT>500.00<FITID>C3<MEMO>PAGAMENTO RECEBIDO</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`
const docOfxCartao = await extrair(utf8(ofxCartao), 'cartao.ofx', 'fatura_cartao')
ok('OFX cartão: compras negativas viram compras', docOfxCartao.itens[0].natureza === 'compra' && docOfxCartao.itens[1].natureza === 'compra')
ok('OFX cartão: crédito = pagamento', docOfxCartao.itens[2].natureza === 'pagamento')
const docOfxComoExtrato = await extrair(utf8(ofxCartao), 'cartao.ofx', 'extrato_bancario')
ok('aviso quando o arquivo parece de outro tipo', docOfxComoExtrato.avisos.some(a => a.includes('parece ser fatura')))

console.log('\n# Fatura de cartão — XLS (BIFF8) com SST dividida em CONTINUE')
const xlsFatura = gerarXls([
  ['Data', 'Estabelecimento', 'Valor'],
  [46298, 'FARMACIA PAGUE MENOS', 32.5],
  [46299, 'POSTO IPIRANGA', 200],
], { dividirSst: true })
const docXls = await extrair(xlsFatura, 'fatura.xls', 'fatura_cartao')
ok('XLS lido (2 lançamentos)', docXls.formato === 'xls' && docXls.itens.length === 2, docXls.itens.length)
ok('XLS: data serial do Excel convertida (46298 = 03/10/2026)', docXls.itens[0].data === '2026-10-03', docXls.itens[0].data)
ok('XLS: texto da SST com CONTINUE reconstruído', docXls.itens[0].descricao === 'FARMACIA PAGUE MENOS', docXls.itens[0].descricao)
ok('XLS: número RK (200) lido', docXls.itens[1].valor === 200)

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Extrato de investimentos — XLSX (B3 movimentação) + CSV (posição)')
const xlsxB3 = gerarXlsx([
  ['Entrada/Saída', 'Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação'],
  ['Credito', 46270, 'Transferência - Liquidação', 'PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 'XP INVESTIMENTOS CCTVM S/A', 100, 30, 3000],
  ['Credito', 46280, 'Dividendo', 'PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 'XP INVESTIMENTOS CCTVM S/A', 100, 1.5, 150],
  ['Credito', 46281, 'Juros Sobre Capital Próprio', 'PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 'XP INVESTIMENTOS CCTVM S/A', 100, 0.5, 50],
  ['Credito', 46282, 'Rendimento', 'MXRF11 - MAXI RENDA FDO INV IMOB - FII', 'XP INVESTIMENTOS CCTVM S/A', 10, 1.23, 12.3],
  ['Debito', 46290, 'Transferência - Liquidação', 'PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 'XP INVESTIMENTOS CCTVM S/A', 20, 35, 700],
  ['Credito', 46291, 'Atualização', 'PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS', 'XP INVESTIMENTOS CCTVM S/A', 0, '', ''],
])
const docB3 = await extrair(xlsxB3, 'movimentacao.xlsx', 'extrato_investimentos')
ok('XLSX lido', docB3.formato === 'xlsx' && docB3.itens.length === 6, docB3.itens.length)
const b3 = docB3.itens
ok('compra (liquidação + crédito) = aporte', b3[0].natureza === 'aporte' && b3[0].valor === 3000 && b3[0].quantidade === 100)
ok('dividendo reconhecido', b3[1].natureza === 'dividendo')
ok('JCP = juros', b3[2].natureza === 'juros')
ok('rendimento de FII', b3[3].natureza === 'rendimento' && b3[3].categoriaAtivo === 'fii')
ok('venda (liquidação + débito) = resgate', b3[4].natureza === 'resgate' && b3[4].valor === 700)
ok('evento corporativo não é importado', b3[5].natureza === 'evento' && b3[5].destino === null)
ok('ativo: código e nome', b3[0].ativo.codigo === 'PETR4' && b3[0].descricao.startsWith('PETR4 · PETROLEO'))
ok('PETR4 = ações', b3[0].categoriaAtivo === 'acoes')

const csvPosicao = 'Produto;Instituição;Quantidade;Preço de Fechamento;Valor Atualizado\nPETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS;XP INVESTIMENTOS;80;38,00;3.040,00\nMXRF11 - MAXI RENDA FDO INV IMOB - FII;XP INVESTIMENTOS;10;10,50;105,00\n'
const docPos = await extrair(utf8(csvPosicao), 'posicao.csv', 'extrato_investimentos')
ok('posições lidas sem confundir com movimentação', docPos.itens.length === 2 && docPos.itens.every(i => i.natureza === 'posicao' && i.destino === 'investimentos'))
ok('valor da posição = Valor Atualizado', docPos.itens[0].valor === 3040)

// Cenário A: PETR4 ainda não existe no app → investimento novo com preço médio
const juntos = [...docB3.itens, ...docPos.itens.map((i, k) => ({ ...i, id: `pos-${k}` }))]
const anInvNovo = analisarItens(juntos, ctxBase({ tipoDocumento: 'extrato_investimentos', instituicao: 'XP Investimentos', existentes: { investimentos: [] } }))
const novoPetr = anInvNovo.novosInvestimentos.find(n => n.ref === 'novo:PETR4')
ok('novo investimento PETR4 criado a partir do extrato', Boolean(novoPetr))
ok('histórico completo (100 − 20 = 80): preço médio 30,00 e aplicado 2.400,00', novoPetr.precoUnitario === 30 && novoPetr.valorAplicado === 2400, JSON.stringify(novoPetr))
ok('valor atual do novo = posição do extrato (3.040)', novoPetr.valorAtual === 3040)
const novoMxrf = anInvNovo.novosInvestimentos.find(n => n.ref === 'novo:MXRF11')
ok('histórico insuficiente (MXRF11): preço médio NÃO calculado e pendência', novoMxrf.precoUnitario === null && novoMxrf.pendencias.some(p => p.includes('Preço médio')))
ok('preço médio exige quantidade em todas as operações', calcularPrecoMedio([{ natureza: 'aporte', quantidade: null, valor: 100, data: '2026-01-01' }], 10) === null)

// Cenário B: PETR4 já existe → posição vira conciliação desmarcada; nada é somado
const existentesInv = { investimentos: [{ id: 'inv-1', nome: 'PETR4 Petrobras', valor_atual: 2000, valor_aplicado: 1800, quantidade: 60 }], movimentacoes: [
  { id: 'm1', investimento_id: 'inv-1', tipo: 'dividendo', valor: 150, data: '2026-09-15' },
] }
const anInv = analisarItens(juntos, ctxBase({ tipoDocumento: 'extrato_investimentos', existentes: existentesInv }))
const posPetr = anInv.itens.find(i => i.natureza === 'posicao' && i.ativo.codigo === 'PETR4')
ok('posição de investimento existente = conciliação (substituir), desmarcada', posPetr.acao === 'conciliar' && posPetr.selecionado === false && posPetr.valorAtualAnterior === 2000)
ok('movimentações vinculadas ao investimento existente', anInv.itens.filter(i => i.ativo?.codigo === 'PETR4' && i.natureza !== 'posicao').every(i => i.investimentoId === 'inv-1'))
ok('dividendo já registrado → duplicidade', anInv.itens.find(i => i.natureza === 'dividendo').duplicidade?.registroId === 'm1')
ok('sem novo investimento para PETR4', !anInv.novosInvestimentos.some(n => n.ref === 'novo:PETR4'))
posPetr.selecionado = true
const { payload: pInv, erros: eInv } = montarPayload({ tipoDocumento: 'extrato_investimentos', arquivos: [docB3, docPos], instituicao: 'XP', periodo: docB3.periodo, itens: anInv.itens, novosInvestimentos: anInv.novosInvestimentos })
ok('payload de investimentos sem erros', eInv.length === 0, eInv.join('; '))
const conc = pInv.itens.find(i => i.acao === 'conciliar')
ok('conciliação SUBSTITUI o valor atual (3.040), não soma', conc.registro_id === 'inv-1' && conc.dados.valor_atual === 3040)
ok('novo investimento (MXRF11) vem antes das movimentações que o usam',
  pInv.itens.findIndex(i => i.ref === 'novo:MXRF11') < pInv.itens.findIndex(i => i.dados.investimento_ref === 'novo:MXRF11'))
ok('movimentações com tipo válido da tabela', pInv.itens.filter(i => i.tabela === 'investimentos_movimentacoes').every(i => ['aporte', 'resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao'].includes(i.dados.tipo)))
ok('posição nova não vira movimentação', !pInv.itens.some(i => i.tabela === 'investimentos_movimentacoes' && i.dados.valor === 105))

console.log('\n# Extrato de investimentos — PDF de corretora')
const pdfInv = gerarPdfTexto([
  'BTG PACTUAL - Extrato de movimentações',
  ['05/11/2026', 'APLICACAO CDB BANCO XPTO 110% CDI', '1.000,00'],
  ['10/11/2026', 'RESGATE TESOURO SELIC 2029', '500,00'],
  ['15/11/2026', 'RENDIMENTO CDB BANCO XPTO', '12,34'],
  'Posição em 30/11/2026',
  ['', 'TESOURO SELIC 2029', '1.234,56'],
])
const docPdfInv = await extrair(pdfInv, 'btg.pdf', 'extrato_investimentos')
const pi = docPdfInv.itens
ok('BTG reconhecido', docPdfInv.instituicao === 'BTG Pactual')
ok('aplicação em CDB = aporte (categoria cdb)', pi[0].natureza === 'aporte' && pi[0].categoriaAtivo === 'cdb')
ok('resgate do Tesouro Selic (categoria tesouro)', pi[1].natureza === 'resgate' && pi[1].categoriaAtivo === 'tesouro' && pi[1].descricao === 'Tesouro Selic 2029')
ok('rendimento de CDB', pi[2].natureza === 'rendimento')
ok('posição do Tesouro lida sem data', pi.some(i => i.natureza === 'posicao' && i.valor === 1234.56))

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Validação de arquivos')
const codigo = e => e?.codigo
ok('arquivo vazio', codigo(await falha(extrair(new Uint8Array(0), 'x.csv', 'extrato_bancario'))) === 'vazio')
ok('".pdf" que não é PDF = corrompido', codigo(await falha(extrair(utf8('não sou pdf'), 'x.pdf', 'extrato_bancario'))) === 'corrompido')
ok('PDF com estrutura inválida = corrompido', codigo(await falha(extrair(utf8('%PDF-1.4 lixo'), 'x.pdf', 'extrato_bancario'))) === 'corrompido')
ok('PDF digitalizado (sem texto) = orientação, sem OCR', codigo(await falha(extrair(gerarPdfSemTexto(), 'x.pdf', 'extrato_bancario'))) === 'digitalizado')
const pdfjsSenha = { getDocument: () => ({ promise: Promise.reject(Object.assign(new Error('senha'), { name: 'PasswordException' })) }) }
ok('PDF com senha = protegido', codigo(await falha(extrairDocumento({ bytes: pdfBanco, nome: 'x.pdf', tipoDocumento: 'extrato_bancario', hoje: HOJE }, { carregarPdfjs: async () => pdfjsSenha }))) === 'protegido')
ok('XLS com senha (FILEPASS) = protegido', codigo(await falha(extrair(gerarXls([['Data', 'Descrição', 'Valor']], { protegido: true }), 'x.xls', 'extrato_bancario'))) === 'protegido')
ok('XLSX criptografado = protegido', codigo(await falha(extrair(gerarXlsx([['a']], { criptografado: true }), 'x.xlsx', 'extrato_bancario'))) === 'protegido')
ok('binário desconhecido = incompatível', codigo(await falha(extrair(new Uint8Array([0, 1, 2, 3, 0, 0, 7, 8]), 'x.csv', 'extrato_bancario'))) === 'incompativel')
ok('CSV sem colunas reconhecíveis = estrutura', codigo(await falha(extrair(utf8('foo;bar\nbaz;qux\n'), 'x.csv', 'extrato_bancario'))) === 'estrutura')
ok('arquivo acima de 10 MB = tamanho', codigo(await falha(extrair(new Uint8Array(10 * 1024 * 1024 + 1), 'x.csv', 'extrato_bancario'))) === 'tamanho')
ok('ZIP que não é planilha = incompatível', codigo(await falha(extrair(gerarXlsx([['a']]), 'x.zip', 'extrato_bancario'))) === 'incompativel')

// ════════════════════════════════════════════════════════════════════════════
console.log('\n# Escolha manual do usuário é preservada ao recalcular duplicidades')
const manual = anBanco.itens.map(i => ({ ...i }))
const dupManual = manual.find(i => i.duplicidade?.nivel === 'provavel' && !i.duplicidade.recorrente)
dupManual.editadoDuplicidade = true
dupManual.acaoDuplicidade = 'manter'
detectarDuplicidades(manual, { existentes: existentesBanco, ocorrenciaDespesa, ocorrenciaReceita: valorReceitaRecorrenteNoMes })
ok('decisão "manter os dois" não é sobrescrita', dupManual.acaoDuplicidade === 'manter' && dupManual.duplicidade)

console.log('\n# Hash do arquivo (fallback sem Web Crypto)')
const { sha256Js, hashArquivo } = await import('../src/lib/importacao/detectar.js')
for (const amostra of [new Uint8Array(0), utf8('abc'), new Uint8Array(1000).map((_, i) => i % 251)]) {
  ok(`SHA-256 em JS = Web Crypto (${amostra.length} bytes)`, sha256Js(amostra) === await hashArquivo(amostra))
}

console.log(`\n${total - falhas}/${total} testes passaram.`)
if (falhas) { console.log(`${falhas} FALHA(S)`); process.exit(1) }
