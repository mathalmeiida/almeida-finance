// Testes da recorrência de RECEITAS (lib em hooks/useReceitas.js — funções puras).
// Testes da recorrência de RECEITAS — lib PURA (sem React/supabase).
import { valorReceitaRecorrenteNoMes, frequenciaDaReceita } from '../src/lib/recorrenciaReceita.js'

let falhas = 0
const brl = (n) => `R$ ${Number(n).toFixed(2)}`
function eq(nome, obtido, esperado, tol = 0.01) {
  const ok = Math.abs(Number(obtido) - Number(esperado)) < tol
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, det = '') { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }

// ── Frequência derivada (retrocompat) ──
console.log('# Frequência derivada')
assert('recorrente+sem meses → mensal', frequenciaDaReceita({ recorrente: true }) === 'mensal')
assert('recorrente+meses → por_meses', frequenciaDaReceita({ recorrente: true, recorrencia_meses: 3 }) === 'por_meses')
assert('não recorrente → nao_repete', frequenciaDaReceita({ recorrente: false }) === 'nao_repete')
assert('frequencia explícita vence', frequenciaDaReceita({ frequencia: 'quinzenal', recorrente: true }) === 'quinzenal')

// ── Única (nao_repete): só no mês de origem (tratado fora); aqui 0 ──
console.log('\n# Única')
const unica = { data: '2026-01-10', valor: 1000, frequencia: 'nao_repete' }
eq('Única não projeta em fev', valorReceitaRecorrenteNoMes(unica, 2026, 2), 0)

// ── Mensal ──
console.log('\n# Mensal')
const mensal = { data: '2026-01-10', valor: 5000, frequencia: 'mensal' }
eq('Mensal jan', valorReceitaRecorrenteNoMes(mensal, 2026, 1), 5000)
eq('Mensal mar', valorReceitaRecorrenteNoMes(mensal, 2026, 3), 5000)
eq('Mensal antes do início', valorReceitaRecorrenteNoMes(mensal, 2025, 12), 0)

// ── A cada X meses (por_meses) ──
console.log('\n# A cada X meses')
const trimestral = { data: '2026-01-10', valor: 900, frequencia: 'por_meses', recorrencia_meses: 3 }
eq('Trimestral jan (mês 0)', valorReceitaRecorrenteNoMes(trimestral, 2026, 1), 900)
eq('Trimestral fev (fora)', valorReceitaRecorrenteNoMes(trimestral, 2026, 2), 0)
eq('Trimestral abr (mês 3)', valorReceitaRecorrenteNoMes(trimestral, 2026, 4), 900)

// ── Semanal ──
console.log('\n# Semanal')
// 2026-01-05 é segunda-feira. Janeiro/2026 tem segundas em 5,12,19,26 → 4x.
const semanal = { data: '2026-01-05', valor: 100, frequencia: 'semanal' }
eq('Semanal jan (4 segundas)', valorReceitaRecorrenteNoMes(semanal, 2026, 1), 400)
// Fevereiro/2026: segundas em 2,9,16,23 → 4x.
eq('Semanal fev (4 segundas)', valorReceitaRecorrenteNoMes(semanal, 2026, 2), 400)

// ── Quinzenal (a cada 14 dias) ──
console.log('\n# Quinzenal')
// Início 2026-01-05; +14 = 19/jan (2 em jan); +14 = 02/fev, +14 = 16/fev (2 em fev).
const quinzenal = { data: '2026-01-05', valor: 500, frequencia: 'quinzenal' }
eq('Quinzenal jan (05 e 19)', valorReceitaRecorrenteNoMes(quinzenal, 2026, 1), 1000)
eq('Quinzenal fev (02 e 16)', valorReceitaRecorrenteNoMes(quinzenal, 2026, 2), 1000)

// ── Término por data_fim ──
console.log('\n# Término por data')
const comFim = { data: '2026-01-10', valor: 5000, frequencia: 'mensal', data_fim: '2026-03-31' }
eq('Mensal c/ fim: mar ainda recebe', valorReceitaRecorrenteNoMes(comFim, 2026, 3), 5000)
eq('Mensal c/ fim: abr NÃO recebe', valorReceitaRecorrenteNoMes(comFim, 2026, 4), 0)

// ── Término por ocorrências (mensal) ──
console.log('\n# Término por ocorrências')
const tresVezes = { data: '2026-01-10', valor: 5000, frequencia: 'mensal', ocorrencias: 3 }
eq('3 ocorrências: jan (1ª)', valorReceitaRecorrenteNoMes(tresVezes, 2026, 1), 5000)
eq('3 ocorrências: mar (3ª)', valorReceitaRecorrenteNoMes(tresVezes, 2026, 3), 5000)
eq('3 ocorrências: abr (4ª, fora)', valorReceitaRecorrenteNoMes(tresVezes, 2026, 4), 0)

console.log(`\n${falhas === 0 ? 'OK — todos os testes passaram' : `FALHOU — ${falhas} teste(s) com erro`}`)
process.exit(falhas === 0 ? 0 : 1)
