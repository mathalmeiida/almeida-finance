#!/usr/bin/env node
/**
 * Testes matemáticos do LIMITE DIÁRIO
 * - Saldo disponível real
 * - Despesas previstas até fim do mês
 * - Dias restantes
 * - Limite diário = disponível / dias restantes
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

// ── Dias restantes no mês ──
console.log('# Dias restantes no mês')
function calcularDiasRestantes(hoje) {
  const [ano, mes] = hoje.split('-').map(Number)
  const ultimoDia = new Date(ano, mes, 0).getDate() // dia 0 do próximo mês = último do atual
  const diaAtual = parseInt(hoje.split('-')[2])
  return ultimoDia - diaAtual + 1 // +1 para incluir hoje
}

eq('Dias restantes em 05/11/2026 (30 dias) = 26', calcularDiasRestantes('2026-11-05'), 26)
eq('Dias restantes em 30/11/2026 = 1', calcularDiasRestantes('2026-11-30'), 1)
eq('Dias restantes em 01/02/2026 = 28', calcularDiasRestantes('2026-02-01'), 28)
eq('Dias restantes em 01/02/2024 (bissexto) = 29', calcularDiasRestantes('2024-02-01'), 29)

// ── Despesas previstas ──
console.log('\n# Despesas previstas')
function calcularDespesasPrevistas(despesas, hoje) {
  const [ano, mes] = hoje.split('-').map(Number)
  const mesAtual = `${ano}-${String(mes).padStart(2, '0')}`
  
  return despesas
    .filter(d => {
      // Só despesas do mês atual, após hoje
      return d.data.startsWith(mesAtual) && d.data > hoje
    })
    .reduce((acc, d) => acc + Number(d.valor), 0)
}

const despesas = [
  { data: '2026-11-10', valor: 500 },
  { data: '2026-11-15', valor: 300 },
  { data: '2026-11-20', valor: 200 },
  { data: '2026-12-05', valor: 400 }, // dezembro, não conta
  { data: '2026-11-03', valor: 100 }  // antes de hoje, não conta
]

const previstas = calcularDespesasPrevistas(despesas, '2026-11-05')
eq('Despesas previstas após 05/11: 500+300+200 = 1.000', previstas, 1000)

// ── Limite diário ──
console.log('\n# Limite diário')
function calcularLimiteDiario(saldoDisponivel, despesasPrevistas, diasRestantes) {
  const disponivel = Number(saldoDisponivel) - Number(despesasPrevistas)
  if (diasRestantes <= 0) return 0
  return disponivel / diasRestantes
}

const limiteBase = calcularLimiteDiario(6000, 1000, 25)
eq('Limite: (6.000 - 1.000) / 25 dias = 200/dia', limiteBase, 200)

const limiteSemDespesas = calcularLimiteDiario(3000, 0, 15)
eq('Sem despesas previstas: 3.000 / 15 = 200/dia', limiteSemDespesas, 200)

const limiteMuitasDespesas = calcularLimiteDiario(2000, 1800, 10)
eq('Despesas altas: (2.000 - 1.800) / 10 = 20/dia', limiteMuitasDespesas, 20)

// ── Saldo negativo após despesas ──
console.log('\n# Saldo negativo após despesas')
const limiteNegativo = calcularLimiteDiario(1000, 1500, 20)
eq('Despesas > saldo: (1.000 - 1.500) / 20 = -25/dia', limiteNegativo, -25)

// ── Último dia do mês ──
console.log('\n# Último dia do mês')
const limiteUltimoDia = calcularLimiteDiario(500, 0, 1)
eq('Último dia: 500 / 1 = 500/dia', limiteUltimoDia, 500)

// ── Valores zerados ──
console.log('\n# Valores zerados')
eq('Saldo 0: limite = 0', calcularLimiteDiario(0, 0, 15), 0)
eq('Dias 0: limite = 0', calcularLimiteDiario(5000, 0, 0), 0)

// ── Reserva de emergência ──
console.log('\n# Reserva de emergência')
function calcularComReserva(saldoTotal, percentualReserva, despesasPrevistas, diasRestantes) {
  const reserva = Number(saldoTotal) * (Number(percentualReserva) / 100)
  const saldoDisponivel = Number(saldoTotal) - reserva
  return {
    reserva,
    saldoDisponivel,
    limiteDiario: calcularLimiteDiario(saldoDisponivel, despesasPrevistas, diasRestantes)
  }
}

const comReserva10 = calcularComReserva(6000, 10, 1000, 25)
eq('Reserva 10% de 6k = 600', comReserva10.reserva, 600)
eq('Disponível após reserva: 6k - 600 = 5.400', comReserva10.saldoDisponivel, 5400)
eq('Limite com reserva: (5.400 - 1.000) / 25 = 176/dia', comReserva10.limiteDiario, 176)

const comReserva20 = calcularComReserva(6000, 20, 1000, 25)
eq('Reserva 20% = 1.200', comReserva20.reserva, 1200)
eq('Limite com 20% reserva: (4.800 - 1.000) / 25 = 152/dia', comReserva20.limiteDiario, 152)

// ── Integração: cenário completo ──
console.log('\n# Cenário completo')
function cenarioCompleto(dados) {
  const diasRestantes = calcularDiasRestantes(dados.hoje)
  const despesasPrevistas = calcularDespesasPrevistas(dados.despesas, dados.hoje)
  const reserva = dados.saldoTotal * (dados.percentualReserva / 100)
  const saldoDisponivel = dados.saldoTotal - reserva
  const limiteDiario = calcularLimiteDiario(saldoDisponivel, despesasPrevistas, diasRestantes)
  
  return {
    diasRestantes,
    despesasPrevistas,
    reserva,
    saldoDisponivel,
    disponibilidadeReal: saldoDisponivel - despesasPrevistas,
    limiteDiario
  }
}

const cenario = cenarioCompleto({
  hoje: '2026-11-05',
  saldoTotal: 6000,
  percentualReserva: 15,
  despesas: [
    { data: '2026-11-10', valor: 500 },
    { data: '2026-11-15', valor: 300 },
    { data: '2026-11-20', valor: 200 }
  ]
})

eq('Cenário: 26 dias restantes', cenario.diasRestantes, 26)
eq('Cenário: 1.000 despesas previstas', cenario.despesasPrevistas, 1000)
eq('Cenário: 900 reserva (15%)', cenario.reserva, 900)
eq('Cenário: 5.100 disponível', cenario.saldoDisponivel, 5100)
eq('Cenário: 4.100 disponibilidade real', cenario.disponibilidadeReal, 4100)
eq('Cenário: 157,69/dia limite', cenario.limiteDiario, 157.69, 0.01)

// ── Centavos e arredondamento ──
console.log('\n# Centavos')
const limiteCentavos = calcularLimiteDiario(1000, 333.33, 30)
eq('Limite com centavos: (1000 - 333,33) / 30 = 22,22/dia', limiteCentavos, 22.22, 0.01)

console.log(`\n${falhas === 0 ? '✅ OK — todos os testes passaram' : `❌ ${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
