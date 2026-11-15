#!/usr/bin/env node
/**
 * Testes matemáticos de INVESTIMENTOS
 * - Aportes e resgates
 * - Patrimônio total
 * - Preço médio (ações)
 * - Rentabilidade
 * - Dividendos
 * - Não impactar saldo disponível
 */

let falhas = 0
const brl = (n) => `R$ ${Number(n).toFixed(2)}`
function eq(nome, obtido, esperado, tol = 0.01) {
  const ok = Math.abs(Number(obtido) - Number(esperado)) < tol
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, det = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`)
}

// ── Patrimônio total ──
console.log('# Patrimônio total')
function calcularPatrimonioTotal(investimentos) {
  return investimentos.reduce((acc, inv) => {
    return acc + Number(inv.saldoAtual || 0)
  }, 0)
}

const investimentos = [
  { id: 1, nome: 'Tesouro Direto', saldoAtual: 5000 },
  { id: 2, nome: 'CDB', saldoAtual: 3000 },
  { id: 3, nome: 'Ações', saldoAtual: 2500.50 }
]

const patrimonio = calcularPatrimonioTotal(investimentos)
eq('Patrimônio = 5.000 + 3.000 + 2.500,50 = 10.500,50', patrimonio, 10500.50)

// ── Aportes e resgates ──
console.log('\n# Aportes e resgates')
function aplicarMovimentacao(saldoInicial, aportes, resgates) {
  const totalAportes = aportes.reduce((acc, a) => acc + Number(a.valor), 0)
  const totalResgates = resgates.reduce((acc, r) => acc + Number(r.valor), 0)
  return Number(saldoInicial) + totalAportes - totalResgates
}

const saldoInicial = 10000
const aportes = [
  { data: '2026-11-05', valor: 500 },
  { data: '2026-11-15', valor: 300 }
]
const resgates = [
  { data: '2026-11-20', valor: 200 }
]

const saldoFinal = aplicarMovimentacao(saldoInicial, aportes, resgates)
eq('Saldo 10.000 + 800 aportes - 200 resgate = 10.600', saldoFinal, 10600)

// ── Rentabilidade percentual ──
console.log('\n# Rentabilidade')
function calcularRentabilidade(valorInicial, valorAtual) {
  if (Number(valorInicial) === 0) return 0
  return ((Number(valorAtual) - Number(valorInicial)) / Number(valorInicial)) * 100
}

const rent1 = calcularRentabilidade(10000, 11000)
eq('Rentabilidade 10k → 11k = 10%', rent1, 10)

const rent2 = calcularRentabilidade(10000, 9500)
eq('Rentabilidade 10k → 9,5k = -5%', rent2, -5)

const rent3 = calcularRentabilidade(0, 1000)
eq('Rentabilidade base 0 = 0', rent3, 0)

// ── Preço médio (ações) ──
console.log('\n# Preço médio (ações)')
function calcularPrecoMedio(compras) {
  const totalInvestido = compras.reduce((acc, c) => acc + (Number(c.quantidade) * Number(c.preco)), 0)
  const totalAcoes = compras.reduce((acc, c) => acc + Number(c.quantidade), 0)
  
  if (totalAcoes === 0) return 0
  return totalInvestido / totalAcoes
}

const comprasAcoes = [
  { quantidade: 10, preco: 50 },   // 500
  { quantidade: 5, preco: 60 },    // 300
  { quantidade: 15, preco: 45 }    // 675
]

const precoMedio = calcularPrecoMedio(comprasAcoes)
// Total investido: 500 + 300 + 675 = 1475
// Total ações: 10 + 5 + 15 = 30
// Preço médio: 1475 / 30 = 49,17
eq('Preço médio 30 ações por R$ 1.475 = 49,17/ação', precoMedio, 49.17, 0.01)

// ── Dividendos acumulados ──
console.log('\n# Dividendos')
function calcularDividendosTotais(dividendos) {
  return dividendos.reduce((acc, d) => acc + Number(d.valor), 0)
}

const dividendos = [
  { data: '2026-10-15', valor: 120.50 },
  { data: '2026-11-15', valor: 135.00 }
]

const totalDividendos = calcularDividendosTotais(dividendos)
eq('Dividendos 120,50 + 135 = 255,50', totalDividendos, 255.50)

// ── Investimentos NÃO impactam saldo disponível ──
console.log('\n# Não impactar saldo disponível')
function calcularSaldoComInvestimentos(saldoBase, receitas, despesas, investimentos) {
  // Investimentos não entram no cálculo
  const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor), 0)
  const totalDespesas = despesas.reduce((acc, d) => acc + Number(d.valor), 0)
  return Number(saldoBase) + totalReceitas - totalDespesas
}

const saldo = calcularSaldoComInvestimentos(
  5000,
  [{ valor: 3000 }],
  [{ valor: 1000 }],
  [{ valor: 10000 }] // investimento não conta
)

eq('Saldo 5k + 3k rec - 1k desp = 7k (investimento ignorado)', saldo, 7000)

// ── Rentabilidade mensal (CDB/Tesouro) ──
console.log('\n# Rentabilidade mensal')
function calcularRentabilidadeMensal(saldoInicial, taxaMensal, meses) {
  let saldo = Number(saldoInicial)
  for (let i = 0; i < meses; i++) {
    saldo = saldo * (1 + Number(taxaMensal) / 100)
  }
  return saldo
}

const saldoCDB = calcularRentabilidadeMensal(10000, 1, 3) // 1% a.m. por 3 meses
// Mês 1: 10.000 * 1,01 = 10.100
// Mês 2: 10.100 * 1,01 = 10.201
// Mês 3: 10.201 * 1,01 = 10.303,01
eq('CDB 10k a 1% a.m. por 3 meses = 10.303,01', saldoCDB, 10303.01)

// ── Valores zerados ──
console.log('\n# Valores zerados')
eq('Patrimônio vazio = 0', calcularPatrimonioTotal([]), 0)
eq('Sem aportes nem resgates = saldo inicial', aplicarMovimentacao(5000, [], []), 5000)
eq('Preço médio sem compras = 0', calcularPrecoMedio([]), 0)
eq('Dividendos vazios = 0', calcularDividendosTotais([]), 0)

// ── Valores negativos (perda de investimento) ──
console.log('\n# Valores negativos')
const rentNegativa = calcularRentabilidade(10000, 8000)
eq('Perda de 2k em 10k = -20%', rentNegativa, -20)

// ── Centavos e arredondamento ──
console.log('\n# Centavos e arredondamento')
const comprasCentavos = [
  { quantidade: 7, preco: 33.33 }, // 233,31
  { quantidade: 3, preco: 33.34 }  // 100,02
]
const precoMedioCentavos = calcularPrecoMedio(comprasCentavos)
// Total: 233,31 + 100,02 = 333,33
// Ações: 7 + 3 = 10
// Médio: 333,33 / 10 = 33,333
eq('Preço médio com centavos = 33,33', precoMedioCentavos, 33.33, 0.01)

// ── Resgate total (zera investimento) ──
console.log('\n# Resgate total')
const saldoAposResgate = aplicarMovimentacao(5000, [], [{ valor: 5000 }])
eq('Resgate total: 5k - 5k = 0', saldoAposResgate, 0)

// ── Múltiplos aportes no mesmo dia ──
console.log('\n# Múltiplos aportes')
const aportesMultiplos = [
  { data: '2026-11-05', valor: 100 },
  { data: '2026-11-05', valor: 200 },
  { data: '2026-11-05', valor: 150 }
]
const saldoMultiplo = aplicarMovimentacao(1000, aportesMultiplos, [])
eq('Múltiplos aportes no mesmo dia: 1k + 450 = 1.450', saldoMultiplo, 1450)

console.log(`\n${falhas === 0 ? '✅ OK — todos os testes passaram' : `❌ ${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
