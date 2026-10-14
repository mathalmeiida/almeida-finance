// Testes dos cálculos de cenários "E se...?" (lib/cenarios.js). Sem dependências.
import {
  simularImpactoRenda, projetarHorizontes, elegibilidadeFgts, multaFgts,
  elegibilidadeSeguroDesemprego, resumoRescisao,
} from '../src/lib/cenarios.js'

let falhas = 0
const brl = (n) => `R$ ${Number(n).toFixed(2)}`
function eq(nome, obtido, esperado, tol = 0.01) {
  const ok = Math.abs(Number(obtido) - Number(esperado)) < tol
  if (!ok) falhas++
  console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${brl(obtido)}, esperado ${brl(esperado)})`)
}
function assert(nome, cond, detalhe = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${detalhe}`)
}

// ── Impacto na renda ──
console.log('# Impacto na renda')
const perda = simularImpactoRenda({ receitaAtual: 6000, despesaMensal: 4000, reservaAtual: 12000, deltaRenda: -6000 })
eq('Perda de renda → receita 0', perda.receitaNova, 0)
eq('Perda de renda → déficit 4.000/mês', perda.deficitMensal, 4000)
eq('Perda de renda → reserva cobre 3 meses', perda.mesesReserva, 3)
const aumento = simularImpactoRenda({ receitaAtual: 6000, despesaMensal: 4000, reservaAtual: 12000, deltaRenda: 1000 })
eq('Aumento → saldo mensal 3.000', aumento.saldoMensal, 3000)
assert('Com sobra, reserva não se esgota (null)', aumento.mesesReserva === null)
const extra = simularImpactoRenda({ receitaAtual: 6000, despesaMensal: 4000, reservaAtual: 0, deltaRenda: 500 })
eq('Renda extra → saldo 2.500', extra.saldoMensal, 2500)

// ── Horizontes 3/6/12 sem salário ──
console.log('\n# Horizontes sem salário')
const h = projetarHorizontes({ reservaAtual: 12000, saldoMensal: -4000 })
eq('3 meses → 0', h.resultado[0].acumulado, 0)
eq('6 meses → −12.000', h.resultado[1].acumulado, -12000)
eq('12 meses → −36.000', h.resultado[2].acumulado, -36000)
assert('Reserva esgota no mês 4', h.mesEsgota === 4, `(${h.mesEsgota})`)
const hpos = projetarHorizontes({ reservaAtual: 5000, saldoMensal: 1000 })
assert('Saldo positivo não esgota', hpos.mesEsgota === null)

// ── FGTS: elegibilidade de saque ──
console.log('\n# FGTS — elegibilidade')
const semJusta = elegibilidadeFgts({ saldoFgts: 10000, modalidade: 'sem_justa_causa' })
assert('Sem justa causa saca integral', semJusta.podeSacar && semJusta.valorSacavel === 10000)
const pedido = elegibilidadeFgts({ saldoFgts: 10000, modalidade: 'pedido_demissao' })
assert('Pedido de demissão NÃO saca', !pedido.podeSacar && pedido.valorSacavel === 0)
const acordo = elegibilidadeFgts({ saldoFgts: 10000, modalidade: 'acordo' })
eq('Acordo saca 80% = 8.000', acordo.valorSacavel, 8000)
const aniversario = elegibilidadeFgts({ saldoFgts: 10000, modalidade: 'sem_justa_causa', saqueAniversario: true })
assert('Saque-aniversário NÃO libera no desligamento', !aniversario.podeSacar && aniversario.valorSacavel === 0)

// ── Multa FGTS ──
console.log('\n# Multa FGTS')
eq('Multa 40% sem justa causa', multaFgts({ saldoFgts: 10000, modalidade: 'sem_justa_causa' }), 4000)
eq('Multa 20% acordo', multaFgts({ saldoFgts: 10000, modalidade: 'acordo' }), 2000)
eq('Multa 0 pedido demissão', multaFgts({ saldoFgts: 10000, modalidade: 'pedido_demissao' }), 0)

// ── Seguro-desemprego ──
console.log('\n# Seguro-desemprego')
assert('Elegível só sem justa causa', elegibilidadeSeguroDesemprego({ modalidade: 'sem_justa_causa' }).elegivel)
assert('Acordo não elegível', !elegibilidadeSeguroDesemprego({ modalidade: 'acordo' }).elegivel)

// ── Resumo de rescisão (valores manuais) ──
console.log('\n# Resumo de rescisão')
const r = resumoRescisao({
  modalidade: 'sem_justa_causa',
  saldoSalario: 2000, ferias: 2667, decimoTerceiro: 1000, avisoPrevio: 6000, adicionais: 0,
  descontos: 500, saldoFgts: 10000,
})
// verbas: 2000+2667+1000+6000+0 + multa 4000 = 15667; − 500 desc = 15167
eq('Total verbas (com multa 40%)', r.totalVerbas, 15667)
eq('Líquido da rescisão', r.liquidoRescisao, 15167)
assert('FGTS sacável integral', r.fgtsSacavel === 10000)
eq('Dinheiro imediato = líquido + FGTS', r.dinheiroImediato, 25167)
// Pedido de demissão: sem multa, sem FGTS, sem seguro.
const rp = resumoRescisao({ modalidade: 'pedido_demissao', saldoSalario: 2000, saldoFgts: 10000 })
eq('Pedido: sem multa (verbas só saldo salário)', rp.totalVerbas, 2000)
assert('Pedido: FGTS não sacável', !rp.fgtsPodeSacar && rp.fgtsSacavel === 0)
assert('Pedido: seguro não elegível', !rp.seguroElegivel)
eq('Pedido: dinheiro imediato = só líquido', rp.dinheiroImediato, 2000)

console.log(`\n${falhas === 0 ? 'OK — todos os testes passaram' : `FALHOU — ${falhas} teste(s) com erro`}`)
process.exit(falhas === 0 ? 0 : 1)
