// Teste automatizado dos cálculos de financiamento (imóvel e automóvel).
// Roda SEM dependências: `node tests/financiamento.test.mjs`.
// Importa as MESMAS funções puras usadas pelos simuladores
// (lib/financiamento.js), validando a lógica real de custos e parcelas.

import {
  calcularPrice, calcularSac, calcularEntrada, comprometimentoRenda,
  calcularCustosImovel, estimarIpvaAnual, estimarSeguroAnual,
  calcularCustosVeiculoMensais, calcularCustoVeiculoPeriodo,
  amortizarSaldoDevedor, calcularConsorcio, taxaAnualParaMensal, prazoEmMeses,
  IPVA_ALIQUOTAS_UF,
} from '../src/lib/financiamento.js'

let falhas = 0
const brl = (n) => `R$ ${n.toFixed(2)}`
function eq(nome, obtido, esperado, tol = 0.01) {
  const ok = Math.abs(obtido - esperado) < tol
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, detalhe = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${detalhe}`)
}

// ── Custos da compra do imóvel (ITBI por alíquota + base editável) ──
console.log('# Imóvel — custos da compra')
const ci = calcularCustosImovel({
  valorImovel: 300000, itbiAliquota: 2, cartorio: 3500, avaliacao: 1200, outros: 800,
})
eq('ITBI 2% de 300.000 = 6.000', ci.itbi, 6000)
eq('Total de custos = 11.500', ci.total, 11500)

// Base de cálculo editável (valor venal de referência diferente do imóvel).
const ciBase = calcularCustosImovel({ valorImovel: 300000, itbiBase: 320000, itbiAliquota: 3 })
eq('ITBI 3% sobre base 320.000 = 9.600', ciBase.itbi, 9600)

// Base vazia → cai no valor do imóvel.
const ciSemBase = calcularCustosImovel({ valorImovel: 300000, itbiAliquota: 3 })
eq('ITBI 3% sobre o próprio imóvel = 9.000', ciSemBase.itbi, 9000)

// Entrada total + valor financiado + total necessário para comprar.
console.log('\n# Imóvel — entrada e total necessário')
const ent = calcularEntrada({ valorImovel: 300000, recursosProprios: 40000, reservaUsada: 10000, fgts: 20000 })
eq('Entrada total = 70.000', ent.entradaTotal, 70000)
eq('Valor financiado = 230.000', ent.valorFinanciado, 230000)
const totalNecessario = ent.entradaTotal + ci.total
eq('Total necessário (entrada + custos) = 81.500', totalNecessario, 81500)

// ── Estimativas do automóvel ──
console.log('\n# Automóvel — estimativas')
assert('Tabela de IPVA tem 27 UFs', Object.keys(IPVA_ALIQUOTAS_UF).length === 27,
  `(encontradas ${Object.keys(IPVA_ALIQUOTAS_UF).length})`)
const ipvaSP = estimarIpvaAnual({ valorVeiculo: 80000, uf: 'SP' })
eq('IPVA SP (4%) de 80.000 = 3.200', ipvaSP.ipva, 3200)
assert('Alíquota SP retornada = 4%', ipvaSP.aliquota === 4)
const ipvaManual = estimarIpvaAnual({ valorVeiculo: 80000, uf: 'SP', aliquota: 2.5 })
eq('IPVA com alíquota manual 2,5% = 2.000', ipvaManual.ipva, 2000)
eq('Seguro anual estimado 4% de 80.000 = 3.200', estimarSeguroAnual({ valorVeiculo: 80000 }), 3200)

// ── Custos mensais de uso (conversão anual → mensal) ──
console.log('\n# Automóvel — custos mensais de uso')
const uso = calcularCustosVeiculoMensais({
  seguroValor: 3600, seguroPeriodo: 'anual',          // 300/mês
  manutencaoValor: 1200, manutencaoPeriodo: 'anual',  // 100/mês
  ipvaAnual: 3200,                                     // 266,67/mês
  licenciamentoAnual: 180,                             // 15/mês
  combustivelMensal: 400,
  outrosMensal: 50,
})
eq('Seguro mensal (3600/12) = 300', uso.seguro, 300)
eq('Manutenção mensal (1200/12) = 100', uso.manutencao, 100)
eq('IPVA mensal (3200/12) = 266,67', uso.ipva, 266.6667, 0.01)
eq('Licenciamento mensal (180/12) = 15', uso.licenciamento, 15)
// 300 + 100 + 266,67 + 15 + 400 (combustível) + 50 (outros) = 1.131,67
eq('Total de uso mensal = 1.131,67', uso.total, 1131.6667, 0.01)

// Seguro informado como mensal não é dividido.
const usoMensal = calcularCustosVeiculoMensais({ seguroValor: 300, seguroPeriodo: 'mensal' })
eq('Seguro mensal informado = 300 (sem dividir)', usoMensal.seguro, 300)

// ── Custo total no período + parcela + comprometimento ──
console.log('\n# Automóvel — período e comprometimento')
const price = calcularPrice(60000, 0.019, 48) // financiado 60k, 1,9% a.m., 48x
const periodo = calcularCustoVeiculoPeriodo({
  prazoMeses: 48, entrada: 20000, parcelaMensal: price.parcela,
  jurosTotais: price.jurosTotais, custosUsoMensal: uso.total, valorVeiculo: 80000,
})
eq('Custo mensal total = parcela + uso', periodo.custoMensalTotal, price.parcela + uso.total)
eq('Total de parcelas = parcela × 48', periodo.totalParcelas, price.parcela * 48)
eq('Custo total período = entrada + parcelas + uso×48',
  periodo.custoTotalPeriodo, 20000 + price.parcela * 48 + uso.total * 48)
const pct = comprometimentoRenda(periodo.custoMensalTotal, 6000)
assert('Comprometimento calculado (renda 6.000)', pct != null && pct > 0, `(${pct?.toFixed(1)}%)`)

// ── Conversão de taxa anual → mensal e prazo ──
console.log('\n# Taxas e prazo')
eq('Taxa anual 0% → 0 mensal', taxaAnualParaMensal(0) * 100, 0)
assert('Taxa anual 12,68% ≈ 1% a.m.', Math.abs(taxaAnualParaMensal(12.6825) * 100 - 1) < 0.01)
assert('Prazo 30 anos = 360 meses', prazoEmMeses(30, 'anos') === 360)
assert('Prazo 60 meses = 60', prazoEmMeses(60, 'meses') === 60)

// ── Amortização sobre o saldo devedor (SAC/PRICE, prazo/parcela) ──
console.log('\n# Amortização')
const PVa = 100000, ia = 0.009, na = 240
// PRICE reduzir prazo
const apPrazo = amortizarSaldoDevedor({ sistema: 'price', saldo: PVa, i: ia, n: na, extra: 20000, modo: 'prazo' })
eq('PRICE prazo: saldo depois = 80.000', apPrazo.saldoDepois, 80000)
assert('PRICE prazo: reduz meses', apPrazo.prazoDepois < na, `(${apPrazo.prazoDepois}/${na})`)
assert('PRICE prazo: economia de juros > 0', apPrazo.economiaJuros > 0)
assert('PRICE prazo: prestação ~ mantida', Math.abs(apPrazo.prestacaoDepois - apPrazo.prestacaoAntes) < 0.01)
// PRICE reduzir parcela
const apParc = amortizarSaldoDevedor({ sistema: 'price', saldo: PVa, i: ia, n: na, extra: 20000, modo: 'parcela' })
assert('PRICE parcela: prazo mantido', apParc.prazoDepois === na)
assert('PRICE parcela: prestação menor', apParc.prestacaoDepois < apParc.prestacaoAntes)
// SAC reduzir prazo / parcela
const asPrazo = amortizarSaldoDevedor({ sistema: 'sac', saldo: PVa, i: ia, n: na, extra: 20000, modo: 'prazo' })
assert('SAC prazo: reduz meses', asPrazo.prazoDepois < na)
const asParc = amortizarSaldoDevedor({ sistema: 'sac', saldo: PVa, i: ia, n: na, extra: 20000, modo: 'parcela' })
assert('SAC parcela: prazo mantido', asParc.prazoDepois === na)
assert('SAC parcela: prestação menor', asParc.prestacaoDepois < asParc.prestacaoAntes)
// Quitação total e valor acima do saldo (sem negativos)
const aQuit = amortizarSaldoDevedor({ sistema: 'price', saldo: PVa, i: ia, n: na, extra: PVa, modo: 'prazo' })
assert('Quitação total: flag + saldo 0 + juros 0', aQuit.quitacaoTotal && aQuit.saldoDepois === 0 && aQuit.jurosDepois === 0)
const aSup = amortizarSaldoDevedor({ sistema: 'sac', saldo: PVa, i: ia, n: na, extra: PVa + 50000, modo: 'parcela' })
assert('Valor acima do saldo: quita sem negativo', aSup.quitacaoTotal && aSup.saldoDepois === 0)

// ── Consórcio (sem juros; taxa de adm + fundo diluídos) ──
console.log('\n# Consórcio')
const cons = calcularConsorcio({ carta: 100000, prazoMeses: 100, taxaAdmPercent: 18, fundoReservaPercent: 2, seguroMensal: 0 })
eq('Consórcio: total taxa adm 18% = 18.000', cons.totalTaxaAdm, 18000)
eq('Consórcio: total fundo 2% = 2.000', cons.totalFundoReserva, 2000)
// base = 100000 + 18000 + 2000 = 120000 → parcela = 120000/100 = 1.200
eq('Consórcio: parcela = 1.200', cons.parcela, 1200)
eq('Consórcio: custo total = 120.000', cons.custoTotal, 120000)
assert('Consórcio: lance é informativo (não abate)', calcularConsorcio({ carta: 100000, prazoMeses: 100, taxaAdmPercent: 18, lance: 30000 }).custoTotal === 118000)

// ── Planejamento completo: reatividade ao percentual da reserva ──
// Reproduz a MESMA fórmula de derivarResumoGastar (Dashboard): a partir de um
// saldo seguro (sem reserva), receita e dias, deriva TODOS os valores exibidos
// que precisam reagir ao percentual: reserva planejada, saldo seguro ajustado,
// disponível, gasto diário e indicador de atenção.
console.log('\n# Planejamento — reatividade ao percentual da reserva')
function statusOrcamento(receita, disponivel) {
  if (receita <= 0) return null
  const pctComp = (receita - disponivel) / receita
  if (disponivel < 0 || pctComp >= 1) return 'comprometido'
  if (pctComp >= 0.8) return 'atencao'
  return 'ok'
}
function derivar({ saldoSeguro, receita, pct, dias }) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0))
  const reserva = Math.max(0, receita) * (p / 100)
  const saldoSeguroAjustado = Math.max(0, Math.max(0, saldoSeguro) - reserva)
  const disponivel = saldoSeguroAjustado
  const limiteDia = dias > 0 ? disponivel / dias : 0
  return { reserva, saldoSeguroAjustado, disponivel, limiteDia, status: statusOrcamento(receita, disponivel) }
}
// Saldo seguro 6.000, receita 6.000, 30 dias → percentuais oficiais.
const base = { saldoSeguro: 6000, receita: 6000, dias: 30 }
const casos = [
  { pct: 10, reserva: 600,  seguro: 5400, dia: 180 },
  { pct: 15, reserva: 900,  seguro: 5100, dia: 170 },
  { pct: 20, reserva: 1200, seguro: 4800, dia: 160 },
  { pct: 25, reserva: 1500, seguro: 4500, dia: 150 },
  { pct: 30, reserva: 1800, seguro: 4200, dia: 140 },
]
for (const c of casos) {
  const r = derivar({ ...base, pct: c.pct })
  eq(`${c.pct}% → reserva ${c.reserva}`, r.reserva, c.reserva)
  eq(`${c.pct}% → saldo seguro ajustado ${c.seguro}`, r.saldoSeguroAjustado, c.seguro)
  eq(`${c.pct}% → disponível ${c.seguro}`, r.disponivel, c.seguro)
  eq(`${c.pct}% → gasto diário ${c.dia}`, r.limiteDia, c.dia)
}
// Reatividade: valores MUDAM entre percentuais (10% ≠ 30%).
assert('Gasto diário muda de 10% para 30%', derivar({ ...base, pct: 10 }).limiteDia !== derivar({ ...base, pct: 30 }).limiteDia)
// Personalizado.
eq('Personalizado 18% → disponível 4.920', derivar({ ...base, pct: 18 }).saldoSeguroAjustado, 4920)
// Bordas.
eq('Reserva > saldo não gera negativo', derivar({ saldoSeguro: 1000, receita: 6000, pct: 30, dias: 30 }).disponivel, 0)
eq('Dias 0 não divide por zero', derivar({ ...base, pct: 20, dias: 0 }).limiteDia, 0)
// Indicador de atenção reage: reserva alta aperta o orçamento.
assert('Status muda conforme a reserva', derivar({ ...base, pct: 10 }).status !== derivar({ saldoSeguro: 1000, receita: 6000, pct: 30, dias: 30 }).status)

// ── Mensagem de status financeiro (3 estados, arredondado a centavos) ──
console.log('\n# Mensagem de status do orçamento')
function estadoOrcamento({ saldoSeguro, receita, pct, saldoConfigurado = true }) {
  if (!saldoConfigurado) return null
  const p = Math.min(100, Math.max(0, Number(pct) || 0))
  const reserva = Math.max(0, receita) * (p / 100)
  const disponivelReal = Math.round((Math.max(0, saldoSeguro) - reserva) * 100) / 100
  const estado = disponivelReal < 0 ? 'negativo' : disponivelReal === 0 ? 'equilibrado' : 'positivo'
  return { disponivelReal, estado }
}
// Negativo: reserva (1.800) > saldo seguro (1.000) → faltam 800.
const neg = estadoOrcamento({ saldoSeguro: 1000, receita: 6000, pct: 30 })
assert('Negativo → estado negativo', neg.estado === 'negativo')
eq('Negativo → faltam 800 (abs)', Math.abs(neg.disponivelReal), 800)
// Equilibrado: saldo seguro == reserva → 0.
const eql = estadoOrcamento({ saldoSeguro: 1200, receita: 6000, pct: 20 })
assert('Equilibrado → estado equilibrado', eql.estado === 'equilibrado')
eq('Equilibrado → disponível 0', eql.disponivelReal, 0)
// Positivo: sobra real.
const pos = estadoOrcamento({ saldoSeguro: 6000, receita: 6000, pct: 20 })
assert('Positivo → estado positivo', pos.estado === 'positivo')
eq('Positivo → disponível 4.800', pos.disponivelReal, 4800)
// Centavos: diferença mínima NÃO vira "faltam R$ 0,00" indevido.
const centavos = estadoOrcamento({ saldoSeguro: 1200.004, receita: 6000, pct: 20 })
assert('Diferença de centavos arredonda p/ equilibrado', centavos.estado === 'equilibrado')

// ── Resultado ──
console.log(`\n${falhas === 0 ? 'OK — todos os testes passaram' : `FALHOU — ${falhas} teste(s) com erro`}`)
process.exit(falhas === 0 ? 0 : 1)
