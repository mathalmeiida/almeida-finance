// Teste automatizado dos cálculos de financiamento (imóvel e automóvel).
// Roda SEM dependências: `node tests/financiamento.test.mjs`.
// Importa as MESMAS funções puras usadas pelos simuladores
// (lib/financiamento.js), validando a lógica real de custos e parcelas.

import {
  calcularPrice, calcularEntrada, comprometimentoRenda,
  calcularCustosImovel, estimarIpvaAnual, estimarSeguroAnual,
  calcularCustosVeiculoMensais, calcularCustoVeiculoPeriodo,
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

// ── Resultado ──
console.log(`\n${falhas === 0 ? 'OK — todos os testes passaram' : `FALHOU — ${falhas} teste(s) com erro`}`)
process.exit(falhas === 0 ? 0 : 1)
