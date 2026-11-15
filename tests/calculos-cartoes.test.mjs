#!/usr/bin/env node
/**
 * Testes matemáticos dos cálculos de CARTÕES DE CRÉDITO
 * - Limite disponível
 * - Compras e parcelas
 * - Faturas (fechamento, vencimento, total)
 * - Impacto no saldo futuro
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

// ── Limite disponível ──
console.log('# Limite disponível')
function calcularLimiteDisponivel(limite, compras) {
  const totalCompras = compras.reduce((acc, c) => acc + Number(c.valor), 0)
  return Number(limite) - totalCompras
}

const limite = 5000
const compras = [
  { id: 1, valor: 150.50 },
  { id: 2, valor: 300.00 },
  { id: 3, valor: 89.90 }
]
const limiteDisp = calcularLimiteDisponivel(limite, compras)
eq('Limite 5.000 - compras 540,40 = 4.459,60', limiteDisp, 4459.60)

// ── Compras parceladas ──
console.log('\n# Compras parceladas')
function calcularParcelaCartao(valorTotal, numParcelas) {
  if (numParcelas <= 0) return 0
  const parcela = Number(valorTotal) / numParcelas
  return Math.round(parcela * 100) / 100
}

function distribuirCentavos(valorTotal, numParcelas) {
  const parcela = calcularParcelaCartao(valorTotal, numParcelas)
  const totalParcelas = parcela * numParcelas
  const centavosRestantes = Math.round((Number(valorTotal) - totalParcelas) * 100)
  return { parcela, centavosRestantes, totalParcelas }
}

const compra1200em3x = distribuirCentavos(1200, 3)
eq('1.200 / 3 = 400,00', compra1200em3x.parcela, 400)
eq('1.200 / 3: sem centavos restantes', compra1200em3x.centavosRestantes, 0)

const compra100em3x = distribuirCentavos(100, 3)
eq('100 / 3 = 33,33', compra100em3x.parcela, 33.33)
eq('100 / 3: 1 centavo restante', compra100em3x.centavosRestantes, 1)
eq('100 / 3: total parcelas 99,99', compra100em3x.totalParcelas, 99.99)

// Centavo extra deve ir para primeira parcela
const compra10em3x = distribuirCentavos(10, 3)
eq('10 / 3 = 3,33', compra10em3x.parcela, 3.33)
eq('10 / 3: 1 centavo restante', compra10em3x.centavosRestantes, 1)

// ── Faturas mensais ──
console.log('\n# Faturas mensais')
function calcularTotalFatura(compras, mesAno) {
  return compras
    .filter(c => c.mesReferencia === mesAno)
    .reduce((acc, c) => {
      if (c.numParcelas > 1) {
        // Se parcelado, conta apenas a parcela do mês
        return acc + (Number(c.valor) / c.numParcelas)
      }
      return acc + Number(c.valor)
    }, 0)
}

const comprasFatura = [
  { id: 1, valor: 500, mesReferencia: '2026-11', numParcelas: 1 },
  { id: 2, valor: 300, mesReferencia: '2026-11', numParcelas: 3 }, // 100/mês
  { id: 3, valor: 150, mesReferencia: '2026-11', numParcelas: 1 },
  { id: 4, valor: 600, mesReferencia: '2026-12', numParcelas: 2 }, // não conta em nov
]

const totalNov = calcularTotalFatura(comprasFatura, '2026-11')
eq('Fatura nov: 500 + 100 (1/3) + 150 = 750', totalNov, 750)

const totalDez = calcularTotalFatura(comprasFatura, '2026-12')
eq('Fatura dez: 300 (ainda 1/3 da primeira) = 300', totalDez, 300)

// ── Fechamento e vencimento ──
console.log('\n# Fechamento e vencimento')
function calcularProximaFatura(diaFechamento, diaVencimento, hoje) {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  
  // Se hoje <= fechamento, a fatura fecha neste mês
  if (dia <= diaFechamento) {
    return {
      fechamento: `${ano}-${String(mes).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`,
      vencimento: `${ano}-${String(mes).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
    }
  }
  
  // Senão, fecha no próximo mês
  let mesProx = mes + 1
  let anoProx = ano
  if (mesProx > 12) {
    mesProx = 1
    anoProx++
  }
  
  return {
    fechamento: `${anoProx}-${String(mesProx).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`,
    vencimento: `${anoProx}-${String(mesProx).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
  }
}

const fatura1 = calcularProximaFatura(10, 20, '2026-11-05')
assert('Antes do fechamento: fecha neste mês', fatura1.fechamento === '2026-11-10')
assert('Vencimento no mesmo mês', fatura1.vencimento === '2026-11-20')

const fatura2 = calcularProximaFatura(10, 20, '2026-11-15')
assert('Depois do fechamento: fecha no próximo mês', fatura2.fechamento === '2026-12-10')
assert('Vencimento no próximo mês', fatura2.vencimento === '2026-12-20')

// ── Virada de ano ──
const faturaVirada = calcularProximaFatura(10, 20, '2026-12-15')
assert('Dezembro após fechamento: fecha em janeiro', faturaVirada.fechamento === '2027-01-10')
assert('Vencimento em janeiro', faturaVirada.vencimento === '2027-01-20')

// ── Casos especiais: vencimento antes do fechamento ──
console.log('\n# Casos especiais')
// Cartão que fecha dia 5 e vence dia 25 do mês ANTERIOR
function calcularFaturaVenceAntes(diaFechamento, diaVencimento, hoje) {
  const [ano, mes, dia] = hoje.split('-').map(Number)
  
  if (dia <= diaFechamento) {
    // Fecha neste mês, vence no anterior (mês passado)
    let mesVenc = mes - 1
    let anoVenc = ano
    if (mesVenc < 1) {
      mesVenc = 12
      anoVenc--
    }
    return {
      fechamento: `${ano}-${String(mes).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`,
      vencimento: `${anoVenc}-${String(mesVenc).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
    }
  }
  
  // Fecha mês que vem, vence este mês
  let mesFech = mes + 1
  let anoFech = ano
  if (mesFech > 12) {
    mesFech = 1
    anoFech++
  }
  
  return {
    fechamento: `${anoFech}-${String(mesFech).padStart(2, '0')}-${String(diaFechamento).padStart(2, '0')}`,
    vencimento: `${ano}-${String(mes).padStart(2, '0')}-${String(diaVencimento).padStart(2, '0')}`
  }
}

const faturaEspecial = calcularFaturaVenceAntes(5, 25, '2026-11-03')
assert('Fecha 05/11, vence 25/10 (mês anterior)', faturaEspecial.fechamento === '2026-11-05' && faturaEspecial.vencimento === '2026-10-25')

// ── Valores zerados ──
console.log('\n# Valores zerados')
eq('Limite zerado - compras 0 = 0', calcularLimiteDisponivel(0, []), 0)
eq('Compra zerada: parcela = 0', calcularParcelaCartao(0, 3), 0)
eq('Fatura vazia: total = 0', calcularTotalFatura([], '2026-11'), 0)

// ── Valores negativos (estorno) ──
console.log('\n# Estornos (valores negativos)')
const comprasComEstorno = [
  { id: 1, valor: 500 },
  { id: 2, valor: -100 } // estorno
]
const limiteComEstorno = calcularLimiteDisponivel(5000, comprasComEstorno)
eq('Limite 5.000 - (500 - 100) = 4.600', limiteComEstorno, 4600)

// ── Fevereiro e anos bissextos ──
console.log('\n# Fevereiro e anos bissextos')
const faturaFev = calcularProximaFatura(28, 15, '2026-02-20')
// Dia 20 < dia fechamento 28, então fecha em fevereiro mesmo
assert('Fevereiro dia 20 (antes do 28): fecha em fevereiro', faturaFev.fechamento === '2026-02-28')

const faturaFevDepois = calcularProximaFatura(20, 15, '2026-02-25')
assert('Fevereiro dia 25 (após o 20): fecha em março', faturaFevDepois.fechamento === '2026-03-20')

const faturaFevBissexto = calcularProximaFatura(29, 15, '2024-02-15')
// Dia 15 < dia 29, então fecha em fevereiro
assert('Bissexto dia 15 (antes do 29): fecha em fevereiro dia 29', faturaFevBissexto.fechamento === '2024-02-29')

console.log(`\n${falhas === 0 ? '✅ OK — todos os testes passaram' : `❌ ${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
