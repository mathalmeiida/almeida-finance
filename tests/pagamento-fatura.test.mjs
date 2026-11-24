// Pagamento de faturas (regras puras em src/lib/faturaCartao.js e saldoDisponivel.js).
// Simulação em memória com dados fictícios: NÃO é teste contra o Supabase DEV.
import * as F from '../src/lib/faturaCartao.js'
import { calcularSaldoDisponivel } from '../src/lib/saldoDisponivel.js'

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

console.log('\n# Parcelamento (valor em aberto) e parcelas futuras')
eq('parcelas futuras após novembro = 800 (2 parcelas de 400)', F.totalParcelasFuturas(compras, [], 20, 2026, 11), 800)

console.log(falhas === 0 ? '\nOK — regras de pagamento de fatura aprovadas (simulação)' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
