// Testes da Importação Inteligente — libs PURAS, com arquivos fictícios.
import { readFileSync } from 'fs'
import {
  numeroBR, dataBR, extrairParcela, parseCSV, tabelaParaTransacoes, parseOFX,
  textoPDFParaTransacoes, detectarFormato, decodificarTexto,
} from '../src/lib/importacaoLeitura.js'
import {
  prepararItens, normalizarExistentes, montarRegistros, impactoNoSaldo, resumoImportacao,
  sugerirCategoria, alterarTipo, similaridade,
} from '../src/lib/importacaoRegras.js'

let falhas = 0
function assert(nome, cond, det = '') { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }
const fx = n => readFileSync(new URL(`./fixtures/importacao/${n}`, import.meta.url))
const CATS = [
  { id: 'c-alim', nome: 'Alimentação' }, { id: 'c-transp', nome: 'Transporte' }, { id: 'c-saude', nome: 'Saúde' },
  { id: 'c-serv', nome: 'Serviços' }, { id: 'c-sal', nome: 'Salário' }, { id: 'c-rend', nome: 'Rendimentos' },
]
const porDesc = (itens, trecho) => itens.find(i => i.descricao.includes(trecho))

console.log('# Números e datas')
assert('1.234,56', numeroBR('1.234,56') === 1234.56)
assert('-R$ 1.234,56', numeroBR('-R$ 1.234,56') === -1234.56)
assert('(45,00) negativo', numeroBR('(45,00)') === -45)
assert('123,45 D negativo', numeroBR('123,45 D') === -123.45)
assert('1,234.56 (formato EUA)', numeroBR('1,234.56') === 1234.56)
assert('1.234 milhar', numeroBR('1.234') === 1234)
assert('-89.90 (OFX)', numeroBR('-89.90') === -89.9)
assert('texto não é número', numeroBR('abc') === null && numeroBR('') === null && numeroBR('1,2,3') === null)
assert('dd/mm/aaaa', dataBR('05/11/2026') === '2026-11-05')
assert('aaaammdd com hora OFX', dataBR('20260922120000[-3:BRT]') === '2026-09-22')
assert('data impossível rejeitada', dataBR('31/02/2026') === null)
assert('dd/mm só com ano padrão', dataBR('05/11') === null && dataBR('05/11', 2026) === '2026-11-05')
assert('parcela "PARC 02/05"', JSON.stringify(extrairParcela('LOJA PARC 02/05')) === JSON.stringify({ atual: 2, total: 5, texto: 'parc 02/05' }))
assert('data no meio não é parcela', extrairParcela('COMPRA 05/11 LOJA') === null)

console.log('\n# CSV de extrato')
const csv = tabelaParaTransacoes(parseCSV(decodificarTexto(fx('extrato-banco.csv'))))
assert('encontra cabeçalho após linhas de título', !csv.erro)
assert('12 transações válidas', csv.transacoes.length === 12, `(${csv.transacoes.length})`)
assert('descarta saldo anterior e data inválida', csv.descartadas.length === 2 && csv.descartadas.some(d => /Data/.test(d.motivo)))
assert('usa a coluna Valor, não Saldo', csv.transacoes[0].valor === 4800)
assert('lê documento como identificador', csv.transacoes[0].idOrigem === '100201')
assert('CSV vírgula com aspas', parseCSV('a,b\n"1,5","x ""y"""')[1].join('|') === '1,5|x "y"')
assert('Windows-1252', decodificarTexto(new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f])) === 'Histórico')
assert('sem cabeçalho reconhecível: erro claro', !!tabelaParaTransacoes([['x', 'y'], ['1', '2']]).erro)

console.log('\n# Classificação do extrato')
const itens = prepararItens(csv.transacoes, { contexto: 'extrato', origem: 'extrato:conta', categorias: CATS })
assert('salário = receita incluída', porDesc(itens, 'SALARIO').tipo === 'receita' && porDesc(itens, 'SALARIO').incluir)
assert('salário categorizado', porDesc(itens, 'SALARIO').categoriaNome === 'Salário')
assert('supermercado = despesa Alimentação', porDesc(itens, 'SUPERMERCADO').tipo === 'despesa' && porDesc(itens, 'SUPERMERCADO').categoriaId === 'c-alim')
assert('uber = Transporte', porDesc(itens, 'UBER').categoriaId === 'c-transp')
assert('PIX recebido NÃO entra como renda sem confirmação', porDesc(itens, 'PIX RECEBIDO').tipo === 'receita' && !porDesc(itens, 'PIX RECEBIDO').incluir && porDesc(itens, 'PIX RECEBIDO').revisar)
assert('PIX enviado = despesa para revisar', porDesc(itens, 'PIX ENVIADO').tipo === 'despesa' && porDesc(itens, 'PIX ENVIADO').revisar)
assert('pagamento de fatura fora (sem gasto em dobro)', porDesc(itens, 'PAGAMENTO FATURA').tipo === 'pagamento_fatura' && !porDesc(itens, 'PAGAMENTO FATURA').incluir)
assert('aplicação CDB fora (patrimônio separado)', porDesc(itens, 'APLICACAO').tipo === 'investimento' && !porDesc(itens, 'APLICACAO').incluir)
assert('transferência própria fora', porDesc(itens, 'MESMA TITULARIDADE').tipo === 'transferencia' && !porDesc(itens, 'MESMA TITULARIDADE').incluir)
assert('rendimento creditado na conta = receita', porDesc(itens, 'REND PAGO').tipo === 'receita' && porDesc(itens, 'REND PAGO').categoriaNome === 'Rendimentos')
assert('tarifa = Serviços', porDesc(itens, 'TARIFA').categoriaId === 'c-serv')
const cafes = itens.filter(i => i.descricao === 'CAFE DA ESQUINA')
assert('dois cafés iguais sem id: ambos mantidos', cafes.length === 2 && cafes.every(c => c.incluir) && cafes[0].chave !== cafes[1].chave)
assert('categoria ambígua não é presumida', sugerirCategoria('POSTO FARMACIA', 'despesa', CATS) === null)
assert('sem regra: sem categoria', sugerirCategoria('LOJA XYZ', 'despesa', CATS) === null)

console.log('\n# Totais, gravação e saldo (regra da Home)')
const res = resumoImportacao(itens)
// incluídos: salário 4800, rend 3,21 (entradas); mercado 182,40 + uber 23,90 + pix 80 + tarifa 29,90 + 2×8,50 (saídas)
assert('entradas = 4.803,21', res.entradas === 4803.21, `(${res.entradas})`)
assert('saídas = 333,20', res.saidas === 333.2, `(${res.saidas})`)
const reg = montarRegistros(itens, { categorias: CATS })
assert('2 receitas e 6 despesas', reg.receitas.length === 2 && reg.despesas.length === 6)
assert('receita não recorrente', reg.receitas.every(r => r.dados.recorrente === false && r.dados.frequencia === 'nao_repete'))
assert('despesa com tipo_despesa e sem cartão', reg.despesas.every(d => ['fixa', 'variavel'].includes(d.dados.tipo_despesa) && d.dados.cartao_id === null))
assert('nada vai para investimentos a partir do extrato', reg.investimentos_movimentacoes.length === 0)
const imp = impactoNoSaldo(itens, { saldoBaseData: '2026-10-05', hoje: '2026-11-06' })
// após 05/10: rend +3,21; tarifa −29,90; cafés −17,00 → −43,69 (aplicação/transferência/fatura não contam)
assert('impacto no saldo só após a data-base', imp.delta === -43.69 && imp.antesDaBase === 4, `(${imp.delta}, ${imp.antesDaBase})`)
assert('saldo não configurado: sem impacto', impactoNoSaldo(itens, { saldoBaseData: null, hoje: '2026-11-06' }).delta === 0)
const reclass = alterarTipo(porDesc(itens, 'PIX ENVIADO'), 'transferencia')
assert('reclassificar como transferência tira da gravação', !reclass.incluir && montarRegistros([reclass]).despesas.length === 0)

console.log('\n# Duplicidades')
const existentes = normalizarExistentes('despesas', [
  { id: 'd1', data: '2026-10-03', valor: 182.4, descricao: 'Supermercado Bom Preço' },
  { id: 'd2', data: '2026-10-10', valor: 8.5, descricao: 'Lanche' },
])
const comExist = prepararItens(csv.transacoes, { contexto: 'extrato', origem: 'extrato:conta', categorias: CATS, existentes })
assert('mesma data/valor/descrição: possível duplicata desmarcada', porDesc(comExist, 'SUPERMERCADO').status === 'possivel_duplicata' && !porDesc(comExist, 'SUPERMERCADO').incluir)
const cafes2 = comExist.filter(i => i.descricao === 'CAFE DA ESQUINA')
assert('mesma data/valor, descrição diferente: aviso fraco, continua incluído', cafes2[0].status === 'possivel_duplicata_fraca' && cafes2[0].incluir)
assert('um existente casa com no máximo um item', cafes2[1].status === 'novo')
const chaves = new Set(itens.map(i => i.chave))
const reimport = prepararItens(csv.transacoes, { contexto: 'extrato', origem: 'extrato:conta', categorias: CATS, chavesImportadas: chaves })
assert('reimportar o mesmo arquivo: tudo marcado como já importado', reimport.every(i => i.status === 'ja_importado' && !i.incluir))
const outraConta = prepararItens(csv.transacoes, { contexto: 'extrato', origem: 'extrato:poupanca', categorias: CATS, chavesImportadas: chaves })
assert('mesma linha em outra conta não é "já importado"', outraConta.every(i => i.status !== 'ja_importado'))
assert('similaridade', similaridade('SUPERMERCADO BOM PRECO', 'Supermercado Bom Preço') === 1 && similaridade('Uber', 'Farmácia') === 0)

console.log('\n# OFX de fatura de cartão')
const ofx = parseOFX(decodificarTexto(fx('fatura-cartao.ofx')))
assert('detecta cartão de crédito', ofx.ehCartao && !ofx.erro)
assert('7 lançamentos lidos', ofx.transacoes.length === 7)
const fat = prepararItens(ofx.transacoes, { contexto: 'fatura', origem: 'cartao:c1', categorias: CATS, cartaoId: 'c1' })
assert('compras negativas viram compra', porDesc(fat, 'RESTAURANTE').tipo === 'compra' && porDesc(fat, 'RESTAURANTE').categoriaId === 'c-alim')
assert('pagamento da fatura ignorado', porDesc(fat, 'PAGAMENTO RECEBIDO').tipo === 'pagamento_fatura' && !porDesc(fat, 'PAGAMENTO RECEBIDO').incluir)
assert('estorno não vira compra nem renda', porDesc(fat, 'ESTORNO').tipo === 'estorno' && !porDesc(fat, 'ESTORNO').incluir)
const iofs = fat.filter(i => i.descricao.includes('IOF'))
assert('FITID repetido: 2ª ocorrência marcada como duplicada', iofs[0].incluir && iofs[1].status === 'duplicado_no_arquivo' && !iofs[1].incluir)
const parc = porDesc(fat, 'PARC 02/05')
assert('parcela identificada e para revisão', parc.parcelaAtual === 2 && parc.parcelaTotal === 5 && parc.revisar)
const regFat = montarRegistros(fat, { categorias: CATS })
const compraParc = regFat.compras_cartao.find(c => c.dados.descricao.includes('PARC'))
assert('compra parcelada: total = parcela × parcelas', compraParc.dados.valor_total === 1000 && compraParc.dados.numero_parcelas === 5)
assert('3 compras gravadas (restaurante, netflix, parcelada) + 1 IOF', regFat.compras_cartao.length === 4)
assert('fatura não gera receita/despesa (sem dupla contagem)', regFat.receitas.length === 0 && regFat.despesas.length === 0)
assert('compras não mexem no saldo disponível', impactoNoSaldo(fat, { saldoBaseData: '2026-01-01', hoje: '2026-11-06' }).delta === 0)
const fatJa = prepararItens(ofx.transacoes, { contexto: 'fatura', origem: 'cartao:c1', categorias: CATS, cartaoId: 'c1',
  existentes: normalizarExistentes('compras_cartao', [{ id: 'k1', cartao_id: 'c1', data_compra: '2026-08-15', valor_total: 1000, numero_parcelas: 5, descricao: 'Loja de móveis' }]) })
assert('parcela do mês seguinte casa com a compra já cadastrada', porDesc(fatJa, 'PARC 02/05').status === 'possivel_duplicata')
assert('sem cartão escolhido: erro de validação', montarRegistros(prepararItens(ofx.transacoes, { contexto: 'fatura', origem: 'x' })).erros.length > 0)

console.log('\n# OFX bancário (XML 2.x)')
const ofx2 = parseOFX(decodificarTexto(fx('extrato-banco.ofx')))
assert('lê 3 transações com NAME + MEMO', ofx2.transacoes.length === 3 && ofx2.transacoes[0].descricao === 'PAGTO SALARIO - EMPRESA FICTICIA')
assert('conta identificada', ofx2.conta.conta === '12345-6' && !ofx2.ehCartao)
assert('OFX sem bloco é rejeitado', !!parseOFX('qualquer coisa').erro)

console.log('\n# Investimentos')
const inv = tabelaParaTransacoes(parseCSV(decodificarTexto(fx('investimentos.csv'))))
const invItens = prepararItens(inv.transacoes, { contexto: 'investimentos', origem: 'inv:i1', investimentoId: 'i1' })
assert('aplicação = aporte', invItens[0].tipo === 'aporte')
assert('rendimento', invItens[1].tipo === 'rendimento')
assert('dividendos', invItens[2].tipo === 'dividendo')
assert('resgate', invItens[3].tipo === 'resgate')
assert('tipo desconhecido não é presumido', invItens[4].tipo === 'indefinido' && !invItens[4].incluir)
const regInv = montarRegistros(invItens)
assert('4 movimentações, nenhuma receita/despesa (patrimônio separado)', regInv.investimentos_movimentacoes.length === 4 && regInv.receitas.length === 0 && regInv.despesas.length === 0)
assert('movimentações não mudam o saldo disponível', impactoNoSaldo(invItens, { saldoBaseData: '2026-01-01', hoje: '2026-11-06' }).delta === 0)

console.log('\n# PDF (texto) e formatos')
const pdf = textoPDFParaTransacoes(['EXTRATO', '02/10/2026 PAGTO SALARIO 4.800,00 5.800,00', '03/10 MERCADO -182,40', 'Total 1.000,00'], { anoPadrao: 2026 })
assert('PDF: reconhece linhas data/descrição/valor', pdf.transacoes.length === 2)
assert('PDF: tudo para revisão, com aviso de dois valores', pdf.transacoes.every(t => t.revisar) && pdf.transacoes[0].avisos.some(a => a.includes('dois valores')))
assert('PDF sem lançamentos: erro honesto', !!textoPDFParaTransacoes(['nada aqui']).erro)
assert('arquivo vazio rejeitado', !!detectarFormato('a.csv', new Uint8Array()).erro)
assert('assinatura PDF', detectarFormato('x.pdf', new TextEncoder().encode('%PDF-1.4 ...')).formato === 'pdf')
assert('extensão PDF com conteúdo de texto rejeitada', !!detectarFormato('x.pdf', new TextEncoder().encode('oi')).erro)
assert('binário desconhecido rejeitado', !!detectarFormato('x.csv', new Uint8Array([1, 0, 2, 0])).erro)
assert('OFX pelo conteúdo', detectarFormato('extrato.txt', fx('fatura-cartao.ofx')).formato === 'ofx')
assert('ZIP que não é xlsx rejeitado', !!detectarFormato('a.zip', new Uint8Array([0x50, 0x4b, 3, 4, 0])).erro)
assert('acima de 5 MB rejeitado', !!detectarFormato('a.csv', new Uint8Array(5 * 1024 * 1024 + 1).fill(65)).erro)

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1

// ── Parte C (retomada): taxas, compra/venda e ativos ─────────────────────────
{
  let f2 = 0
  const ok = (n, c) => { if (!c) f2++; console.log(`${c ? 'PASS' : 'FALHA'} — ${n}`) }
  const base = [
    { linha: 1, data: '2026-10-01', descricao: 'Taxa de custódia', valor: -5, ativo: null },
    { linha: 2, data: '2026-10-02', descricao: 'IR sobre resgate', valor: -12, ativo: null },
    { linha: 3, data: '2026-10-03', descricao: 'Compra FICT11', valor: -980, ativo: 'FICT11' },
    { linha: 4, data: '2026-10-04', descricao: 'Venda FICT11', valor: 500, ativo: 'FICT11' },
    { linha: 5, data: '2026-10-05', descricao: 'Rendimento', valor: 3, ativo: 'XPTO99' },
  ]
  const invs = [{ id: 'a', nome: 'CDB Banco X' }, { id: 'b', nome: 'FII FICT11' }]
  const r = prepararItens(base, { contexto: 'investimentos', origem: 'inv:a', investimentoId: 'a', investimentos: invs })
  ok('taxa de custódia = taxa, fora da gravação', r[0].tipo === 'taxa' && !r[0].incluir)
  ok('IR = taxa, fora da gravação', r[1].tipo === 'taxa' && !r[1].incluir)
  ok('compra de cotas = aporte, com aviso de quantidade', r[2].tipo === 'aporte' && r[2].avisos.some(a => a.includes('quantidade')))
  ok('venda = resgate', r[3].tipo === 'resgate')
  ok('ativo associado ao investimento de mesmo nome', r[2].investimentoId === 'b' && r[3].investimentoId === 'b')
  ok('ativo sem correspondência: padrão + revisão', r[4].investimentoId === 'a' && r[4].revisar)
  ok('taxas não geram registros', montarRegistros(r).investimentos_movimentacoes.length === 3)
  console.log(f2 === 0 ? 'OK — retomada' : `${f2} FALHA(S) na retomada`)
  if (f2) process.exitCode = 1
}
