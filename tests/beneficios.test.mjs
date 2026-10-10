// Teste automatizado dos cálculos de Benefícios (VR/VA).
// Roda SEM dependências: `node tests/beneficios.test.mjs`.
// Importa as MESMAS funções puras usadas pelo app (lib/beneficiosCalculos.js),
// então valida exatamente a lógica real de saldo. Sai com código !=0 se falhar.

import {
  efeitoNoSaldo, calcularSaldo, totalGastoNoMesCompetencia,
} from '../src/lib/beneficiosCalculos.js'

let falhas = 0
const brl = (n) => `R$ ${n.toFixed(2)}`
function eq(nome, obtido, esperado) {
  const ok = Math.abs(obtido - esperado) < 0.001
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, detalhe = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${detalhe}`)
}

// ── Cenário principal (passo a passo, verificando o saldo acumulado) ──
console.log('# Cenário principal (VR)')
const movs = []
const saldoApos = (m) => { movs.push(m); return calcularSaldo(movs) }

eq('Saldo inicial R$ 1.000,00',        saldoApos({ tipo: 'recarga', valor: 1000, data: '2026-10-01' }), 1000)
eq('Compra R$ 150,00 → 850,00',        saldoApos({ tipo: 'compra',  valor: 150,  data: '2026-10-03' }), 850)
eq('Recarga R$ 500,00 → 1.350,00',     saldoApos({ tipo: 'recarga', valor: 500,  data: '2026-10-05' }), 1350)
eq('Compra R$ 50,00 → 1.300,00',       saldoApos({ tipo: 'compra',  valor: 50,   data: '2026-10-08' }), 1300)
eq('Ajuste +R$ 100,00 → 1.400,00',     saldoApos({ tipo: 'ajuste',  valor: 100,  data: '2026-10-09' }), 1400)
eq('Estorno R$ 50,00 → 1.450,00',      saldoApos({ tipo: 'estorno', valor: 50,   data: '2026-10-10' }), 1450)

// ── Acúmulo de saldo entre meses (nada zera na virada do mês) ──
console.log('\n# Acúmulo entre meses')
const multimes = [
  { tipo: 'recarga', valor: 1000, data: '2026-10-01' },
  { tipo: 'compra',  valor: 200,  data: '2026-10-20' }, // sobra 800 em outubro
  { tipo: 'recarga', valor: 1000, data: '2026-11-01' }, // novembro soma à sobra
]
eq('Saldo acumulado out+nov = 1.800,00', calcularSaldo(multimes), 1800)

// ── Recarga mensal sem duplicidade (chave: beneficio_id + competencia) ──
console.log('\n# Recarga mensal sem duplicidade')
// Simula o guard do app: só adiciona a recarga automática do mês se ainda não
// existir uma para a mesma competência.
function aplicarRecargaMes(lista, { competencia, valor }) {
  const jaTem = lista.some(m => m.tipo === 'recarga' && m.automatica && m.competencia === competencia)
  if (jaTem) return lista
  return [...lista, { tipo: 'recarga', valor, data: `${competencia}-05`, competencia, automatica: true }]
}
let l = [{ tipo: 'recarga', valor: 1000, data: '2026-10-01' }]
l = aplicarRecargaMes(l, { competencia: '2026-11', valor: 500 }) // 1ª vez: aplica
l = aplicarRecargaMes(l, { competencia: '2026-11', valor: 500 }) // 2ª vez: NÃO duplica
const recargasNov = l.filter(m => m.tipo === 'recarga' && m.competencia === '2026-11').length
assert('Recarga de 2026-11 aplicada apenas 1 vez', recargasNov === 1, `(encontradas ${recargasNov})`)
eq('Saldo após recarga única = 1.500,00', calcularSaldo(l), 1500)

// ── Edição e exclusão de movimentações recalculam o saldo ──
console.log('\n# Edição e exclusão')
let base = [
  { id: 'a', tipo: 'recarga', valor: 1000, data: '2026-10-01' },
  { id: 'b', tipo: 'compra',  valor: 150,  data: '2026-10-03' },
]
eq('Antes da edição = 850,00', calcularSaldo(base), 850)
// Edita a compra de 150 → 100
base = base.map(m => m.id === 'b' ? { ...m, valor: 100 } : m)
eq('Após editar compra p/ 100 = 900,00', calcularSaldo(base), 900)
// Exclui a compra
base = base.filter(m => m.id !== 'b')
eq('Após excluir a compra = 1.000,00', calcularSaldo(base), 1000)

// ── Separação entre VR e VA (saldos independentes) ──
console.log('\n# Separação VR x VA')
const todas = [
  { beneficio_id: 'VR', tipo: 'recarga', valor: 1000, data: '2026-10-01' },
  { beneficio_id: 'VR', tipo: 'compra',  valor: 150,  data: '2026-10-03' },
  { beneficio_id: 'VA', tipo: 'recarga', valor: 800,  data: '2026-10-01' },
  { beneficio_id: 'VA', tipo: 'compra',  valor: 300,  data: '2026-10-04' },
]
const porBenef = (bid) => todas.filter(m => m.beneficio_id === bid)
eq('Saldo VR = 850,00', calcularSaldo(porBenef('VR')), 850)
eq('Saldo VA = 500,00', calcularSaldo(porBenef('VA')), 500)
assert('VR e VA são independentes', calcularSaldo(porBenef('VR')) !== calcularSaldo(porBenef('VA')))

// ── Total gasto no mês (apenas compras da competência) ──
console.log('\n# Total gasto no mês')
eq('Compras VR em out/2026 = 150,00', totalGastoNoMesCompetencia(porBenef('VR'), '2026-10'), 150)
eq('Compras VA em out/2026 = 300,00', totalGastoNoMesCompetencia(porBenef('VA'), '2026-10'), 300)

// ── Garantia conceitual: cálculos de benefício NÃO envolvem saldo bancário ──
// (As funções puras só conhecem movimentações de benefício; não há qualquer
//  referência a saldo_base, limite diário ou resultado mensal. Verificação de
//  isolamento é estrutural — este arquivo importa apenas beneficiosCalculos.)
console.log('\n# Isolamento financeiro')
assert('efeitoNoSaldo ignora tipo desconhecido', efeitoNoSaldo({ tipo: 'x', valor: 999 }) === 0)

console.log(falhas === 0 ? '\n✅ TODOS OS TESTES PASSARAM' : `\n❌ ${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
