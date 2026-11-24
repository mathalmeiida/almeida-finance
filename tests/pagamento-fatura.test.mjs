// Pagamento de faturas (regras puras em src/lib/faturaCartao.js e saldoDisponivel.js).
// Simulação em memória com dados fictícios: NÃO é teste contra o Supabase DEV.
import * as F from '../src/lib/faturaCartao.js'
import { calcularSaldoDisponivel } from '../src/lib/saldoDisponivel.js'
import { mensagemAmigavel, ehFaturaDesatualizada, ehConflitoTransacional } from '../src/lib/mensagemPagamentoFatura.js'

let falhas = 0
const brl = n => `R$ ${Number(n).toFixed(2)}`
function eq(nome, obtido, esperado) {
  const ok = Math.round(Number(obtido) * 100) === Math.round(Number(esperado) * 100)
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, det = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`)
}

// Cartão: fecha 20, vence 28, limite 5.000. Hoje: 10/11/2026.
const cartao = { id: 'c1', nome: 'Vinho', dia_fechamento: 20, dia_vencimento: 28, limite_total: 5000 }
const HOJE = new Date('2026-11-10T12:00:00')
const compra = (id, valor_total, data_compra, numero_parcelas = 1) => ({ id, cartao_id: 'c1', descricao: id, valor_total, data_compra, numero_parcelas })
// Outubro (fechou dia 20/10): 1.000. Novembro (ciclo aberto): 600 + 400/3 de parcelado.
const compras = [compra('out', 1000, '2026-10-05'), compra('nov', 600, '2026-11-03'), compra('parc', 1200, '2026-11-05', 3)]
const pg = (id, ano_mes, valor, status = 'ativo') => ({ id, cartao_id: 'c1', ano_mes, valor, status, data_pagamento: '2026-11-09', origem: 'saldo_principal' })
const ciclo = (pagamentos, ano, mes, faturasInformadas = [], hoje = HOJE) =>
  F.cicloFatura({ cartao, compras, parcelamentos: [], faturasInformadas, pagamentos, ano, mes, hoje })
const comprometido = pagamentos => F.limiteComprometido(compras, 20, HOJE, { cartaoId: 'c1', pagamentos })

console.log('# Totais por ciclo (compras de um ciclo nunca são abatidas por pagamentos de outro)')
eq('outubro = 1.000,00', ciclo([], 2026, 10).total, 1000)
eq('novembro = 600 + 400 = 1.000,00', ciclo([], 2026, 11).total, 1000)
eq('dezembro = 400,00 (parcela 2)', ciclo([], 2026, 12).total, 400)
eq('dívida total sem pagamentos = 1.000 + 1.000 + 400 + 400 = 2.800,00', comprometido([]), 2800)

console.log('\n# Pagamento total')
let pags = [pg('1', '2026-10', 1000)]
eq('outubro: em aberto 0', ciclo(pags, 2026, 10).emAberto, 0)
assert('outubro: status Paga', ciclo(pags, 2026, 10).status === 'Paga', `(${ciclo(pags, 2026, 10).status})`)
eq('novembro continua com 1.000,00 (pagamento de outubro não abate)', ciclo(pags, 2026, 11).total, 1000)
eq('novembro continua com 1.000,00 em aberto', ciclo(pags, 2026, 11).emAberto, 1000)
eq('dívida total cai 1.000,00 => 1.800,00', comprometido(pags), 1800)
eq('limite disponível sobe de 2.200 para 3.200', 5000 - comprometido(pags), 3200)

console.log('\n# Pagamento parcial')
pags = [pg('1', '2026-10', 400)]
let c = ciclo(pags, 2026, 10)
eq('outubro em aberto = 600,00', c.emAberto, 600)
assert('outubro vencida? vence 28/10 e hoje é 10/11 => Vencida', c.status === 'Vencida', `(${c.status})`)
const antes = new Date('2026-10-25T12:00:00')
assert('antes do vencimento com pagamento parcial => Parcialmente paga', ciclo(pags, 2026, 10, [], antes).status === 'Parcialmente paga')
eq('limite liberado proporcional: dívida 2.800 → 2.400', comprometido(pags), 2400)
eq('saldo anterior exibido em novembro = 600,00 (informativo)', ciclo(pags, 2026, 11).saldoAnterior, 600)
eq('total de novembro NÃO inclui o saldo anterior (sem duplicar)', ciclo(pags, 2026, 11).total, 1000)
eq('soma dos em aberto de todos os ciclos = dívida total', [10, 11, 12, 13].reduce((a, m) => a + ciclo(pags, m > 12 ? 2027 : 2026, m > 12 ? m - 12 : m).emAberto, 0), comprometido(pags))

console.log('\n# Pagamento antecipado (ciclo aberto)')
pags = [pg('1', '2026-11', 250)]
c = ciclo(pags, 2026, 11)
eq('novembro em aberto = 750,00', c.emAberto, 750)
assert('novembro: Parcialmente paga (ciclo ainda aberto, vence 28/11)', c.status === 'Parcialmente paga', `(${c.status})`)
assert('ciclo aberto sem pagamento = Aberta', ciclo([], 2026, 11, [], new Date('2026-11-10T12:00:00')).status === 'Aberta')
assert('depois do fechamento e sem pagamento = Fechada', ciclo([], 2026, 11, [], new Date('2026-11-22T12:00:00')).status === 'Fechada')
assert('depois do vencimento sem pagamento = Vencida', ciclo([], 2026, 11, [], new Date('2026-11-29T12:00:00')).status === 'Vencida')
eq('dívida total = 2.550,00', comprometido(pags), 2550)

console.log('\n# Estorno')
pags = [pg('1', '2026-10', 1000, 'estornado'), pg('2', '2026-11', 250)]
eq('pagamento estornado não conta: outubro em aberto 1.000,00', ciclo(pags, 2026, 10).emAberto, 1000)
eq('dívida volta a refletir só o pagamento ativo (2.550,00)', comprometido(pags), 2550)
assert('histórico mantém o estornado', ciclo(pags, 2026, 10).pagamentos.length === 1 && ciclo(pags, 2026, 10).pagamentos[0].status === 'estornado')

console.log('\n# Compatibilidade com boolean antigo (pago = true)')
const legado = [{ cartao_id: 'c1', ano_mes: '2026-10', valor_total: 1000, pago: true }]
eq('boolean pago sem registro de pagamento => em aberto 0', ciclo([], 2026, 10, legado).emAberto, 0)
eq('com registro estornado o boolean é ignorado => 1.000,00', ciclo([pg('9', '2026-10', 1000, 'estornado')], 2026, 10, legado).emAberto, 1000)

console.log('\n# Validação e duplicidade')
assert('valor acima do saldo em aberto é recusado', !!F.validarPagamento({ valor: 1000.01, emAberto: 1000, data: '2026-11-10', hoje: HOJE }))
assert('valor zero é recusado', !!F.validarPagamento({ valor: 0, emAberto: 1000, data: '2026-11-10', hoje: HOJE }))
assert('data futura é recusada', !!F.validarPagamento({ valor: 10, emAberto: 1000, data: '2026-11-11', hoje: HOJE }))
assert('pagamento válido passa', F.validarPagamento({ valor: 1000, emAberto: 1000, data: '2026-11-10', hoje: HOJE }) === null)
const dupl = [pg('1', '2026-10', 1000), pg('2', '2026-10', 500)]
eq('pagamentos acima do total são limitados ao total (nunca negativo)', ciclo(dupl, 2026, 10).emAberto, 0)
eq('e não reduzem mais a dívida do que o total do ciclo', comprometido(dupl), 1800)
assert('pagamento de outro cartão não afeta este', F.valorPagoFatura(1000, [{ ...pg('1', '2026-10', 500), cartao_id: 'c2' }], [], 'c1', 2026, 10) === 0)

console.log('\n# Saldo da conta e despesas (sem contar duas vezes)')
const base = { saldoBase: 5000, marco: '2026-11-01', hoje: '2026-11-10', receitas: [], despesas: [{ id: 'd1', data: '2026-11-05', valor: 100 }] }
eq('sem pagamentos: 4.900,00', calcularSaldoDisponivel(base).saldo, 4900)
const comPg = calcularSaldoDisponivel({ ...base, pagamentos: [{ ...pg('1', '2026-10', 400), data_pagamento: '2026-11-09' }] })
eq('pagamento de 400 debita o saldo: 4.500,00', comPg.saldo, 4500)
eq('despesas continuam 100,00 (pagamento não vira despesa)', comPg.despesas, 100)
eq('estornado não debita', calcularSaldoDisponivel({ ...base, pagamentos: [pg('1', '2026-10', 400, 'estornado')] }).saldo, 4900)
eq('origem outra conta não debita o saldo principal', calcularSaldoDisponivel({ ...base, pagamentos: [{ ...pg('1', '2026-10', 400), origem: 'outra_conta' }] }).saldo, 4900)
eq('pagamento anterior ao marco já está no saldo informado', calcularSaldoDisponivel({ ...base, pagamentos: [{ ...pg('1', '2026-10', 400), data_pagamento: '2026-11-01' }] }).saldo, 4900)
eq('mesmo id repetido na lista conta uma vez', calcularSaldoDisponivel({ ...base, pagamentos: [pg('1', '2026-10', 400), pg('1', '2026-10', 400)] }).saldo, 4500)

console.log('\n# Nova compra após pagamento parcial (sem estorno)')
{
  const pagsP = [pg('1', '2026-11', 300)]
  const calc = cs => F.cicloFatura({ cartao, compras: cs, parcelamentos: [], faturasInformadas: [], pagamentos: pagsP, ano: 2026, mes: 11, hoje: HOJE })
  const antesC = calc(compras)
  eq('antes: total 1.000, pago 300, em aberto 700', antesC.emAberto, 700)
  const novas = [...compras, compra('nova', 250, '2026-11-08')]
  const depC = calc(novas)
  eq('depois da nova compra: total sobe para 1.250,00', depC.total, 1250)
  eq('pagamento anterior preservado: pago continua 300,00', depC.pago, 300)
  eq('em aberto = novo total - pago = 950,00', depC.emAberto, 950)
  assert('status Parcialmente paga', depC.status === 'Parcialmente paga', `(${depC.status})`)
  assert('lista de pagamentos intacta (1 ativo, sem estorno)', depC.pagamentos.length === 1 && depC.pagamentos[0].status === 'ativo')
  assert('valor igual ao novo em aberto é aceito', F.validarPagamento({ valor: 950, emAberto: depC.emAberto, data: '2026-11-10', hoje: HOJE }) === null)
  const quitado = F.cicloFatura({ cartao, compras: novas, parcelamentos: [], faturasInformadas: [], pagamentos: [...pagsP, pg('2', '2026-11', 950)], ano: 2026, mes: 11, hoje: HOJE })
  eq('quitar o novo restante zera o em aberto', quitado.emAberto, 0)
  assert('status Paga', quitado.status === 'Paga')
  const reaberto = F.cicloFatura({ cartao, compras: [...novas, compra('outra', 80, '2026-11-09')], parcelamentos: [], faturasInformadas: [], pagamentos: [...pagsP, pg('2', '2026-11', 950)], ano: 2026, mes: 11, hoje: HOJE })
  assert('fatura quitada volta a Parcialmente paga com nova compra', reaberto.status === 'Parcialmente paga', `(${reaberto.status})`)
  eq('em aberto da fatura reaberta = 80,00', reaberto.emAberto, 80)
  const menor = F.cicloFatura({ cartao, compras: [compra('so', 200, '2026-11-03')], parcelamentos: [], faturasInformadas: [], pagamentos: pagsP, ano: 2026, mes: 11, hoje: HOJE })
  eq('total abaixo do pago: em aberto 0 (sem débito extra)', menor.emAberto, 0)
  eq('excedente pago exposto = 100,00', menor.excedentePago, 100)
  const saldoNovo = calcularSaldoDisponivel({ saldoBase: 5000, marco: '2026-11-01', hoje: '2026-11-10', receitas: [], despesas: [], pagamentos: [pg('1', '2026-11', 300), pg('2', '2026-11', 950)] })
  eq('saldo debita só os pagamentos reais (300 + 950)', saldoNovo.saldo, 3750)
}

console.log('\n# Saldo anterior não duplica o total de compras do ciclo')
{
  const pagsA = [pg('1', '2026-10', 400)]
  const nov = ciclo(pagsA, 2026, 11)
  eq('saldo anterior informativo = 600,00', nov.saldoAnterior, 600)
  eq('total de compras de novembro segue 1.000,00', nov.total, 1000)
  eq('em aberto de novembro não soma o anterior', nov.emAberto, 1000)
  eq('limite comprometido não duplica (2.400)', comprometido(pagsA), 2400)
}

console.log('\n# Pagamento legado outra_conta nunca debita')
eq('legado migrado não debita saldo', calcularSaldoDisponivel({ ...base, pagamentos: [{ ...pg('L', '2026-10', 1000), origem: 'outra_conta', legado: true, data_pagamento: '2026-11-09' }] }).saldo, 4900)
eq('legado ainda conta como pago no ciclo', ciclo([{ ...pg('L', '2026-10', 1000), origem: 'outra_conta', legado: true }], 2026, 10).emAberto, 0)

console.log('\n# Parcelamento (valor em aberto) e parcelas futuras')
eq('parcelas futuras após novembro = 800 (2 parcelas de 400)', F.totalParcelasFuturas(compras, [], 20, 2026, 11), 800)

console.log('\n# Mensagens amigaveis dos erros das RPCs')
{
  const JA_ESTORNADO = 'Este pagamento já foi estornado.'
  assert('estorno repetido ("Pagamento já estornado") vira mensagem amigavel', mensagemAmigavel(new Error('Pagamento já estornado')) === JA_ESTORNADO, `(${mensagemAmigavel(new Error('Pagamento já estornado'))})`)
  assert('retry de pagamento estornado ("Este pagamento já foi estornado. Gere um novo pagamento.")', mensagemAmigavel(new Error('Este pagamento já foi estornado. Gere um novo pagamento.')) === JA_ESTORNADO)
  assert('variante sem acento (ja estornado)', mensagemAmigavel({ message: 'Pagamento ja estornado' }) === JA_ESTORNADO)
  assert('variante sem acento (ja foi estornado)', mensagemAmigavel({ message: 'Este pagamento ja foi estornado' }) === JA_ESTORNADO)
  assert('aceita string pura', mensagemAmigavel('Pagamento já estornado') === JA_ESTORNADO)
  const desat = 'Fatura desatualizada: o total no servidor é 500.00 e a tela mostra 1000.00. Atualize a tela e tente novamente.'
  assert('fatura desatualizada e reconhecida', ehFaturaDesatualizada(new Error(desat)) && ehFaturaDesatualizada({ code: '40001', message: 'x' }))
  assert('fatura desatualizada vira mensagem amigavel sem numeros internos', /fatura mudou/i.test(mensagemAmigavel(new Error(desat))) && !/500\.00/.test(mensagemAmigavel(new Error(desat))))
  assert('deadlock 40P01 e lock_timeout 55P03 sao conflitos repetiveis', ehConflitoTransacional({ code: '40P01' }) && ehConflitoTransacional({ code: '55P03' }) && ehConflitoTransacional({ code: '40001' }) && !ehConflitoTransacional({ code: '22003' }))
  assert('conflito 40P01 recarrega a fatura e pede nova tentativa em pt-BR', ehFaturaDesatualizada({ code: '40P01', message: 'deadlock detected' }) && /tente novamente/i.test(mensagemAmigavel({ code: '40P01', message: 'deadlock detected' })) && !/deadlock/i.test(mensagemAmigavel({ code: '40P01', message: 'deadlock detected' })))
  assert('valor acima do em aberto mantem o valor em aberto do servidor', /em aberto: 300\.00/.test(mensagemAmigavel(new Error('Valor excede o saldo em aberto da fatura (em aberto: 300.00)'))))
  assert('fatura quitada', /não tem saldo em aberto/.test(mensagemAmigavel(new Error('Fatura sem saldo em aberto: já está quitada'))))
  assert('ciclo sem valor', /não tem valor a pagar/.test(mensagemAmigavel(new Error('Fatura sem valor a pagar neste ciclo'))))
  assert('quitada nao e confundida com estorno', mensagemAmigavel(new Error('Fatura sem saldo em aberto: já está quitada')) !== JA_ESTORNADO)
  assert('cartao nao encontrado', /não encontrado/.test(mensagemAmigavel(new Error('Cartão não encontrado'))))
  assert('data futura', /futura/.test(mensagemAmigavel(new Error('Data do pagamento não pode ser futura'))))
  assert('mensagem desconhecida e preservada', mensagemAmigavel(new Error('algo novo')) === 'algo novo')
  assert('erro vazio tem texto padrao', mensagemAmigavel(null) === 'Erro ao registrar o pagamento.')
}

console.log(falhas === 0 ? '\nOK — regras de pagamento de fatura aprovadas (simulação)' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
