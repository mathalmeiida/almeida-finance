// Cálculos de fatura e limite do cartão (src/lib/faturaCartao.js) comparados
// com valores esperados calculados à mão. Módulo puro, sem rede.
import * as F from '../src/lib/faturaCartao.js'

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

// Cartão: fecha dia 20, vence dia 28. Hoje: 10/11/2026.
const FECH = 20
const HOJE = new Date('2026-11-10T12:00:00')
const compra = (id, valor_total, data_compra, numero_parcelas = 1) => ({ id, valor_total, data_compra, numero_parcelas, cartao_id: 'c1' })

console.log('# Competência pelo fechamento')
const c = F.competenciaPrimeiraParcela
assert('compra dia 12 entra no ciclo de novembro', JSON.stringify(c('2026-11-12', FECH)) === '{"ano":2026,"mes":11}')
assert('compra NO dia do fechamento (20) ainda entra em novembro', JSON.stringify(c('2026-11-20', FECH)) === '{"ano":2026,"mes":11}')
assert('compra dia 21 (após fechamento) vai para dezembro', JSON.stringify(c('2026-11-21', FECH)) === '{"ano":2026,"mes":12}')
assert('virada de ano: 21/12 vai para janeiro/2027', JSON.stringify(c('2026-12-21', FECH)) === '{"ano":2027,"mes":1}')
assert('fechamento 31 em fevereiro usa o último dia (28)', JSON.stringify(c('2027-02-28', 31)) === '{"ano":2027,"mes":2}')

console.log('\n# Compra à vista')
const avista = [compra('a', 300, '2026-11-12')]
eq('fatura de novembro = 300,00', F.valorFaturaCartaoNoMes(avista, FECH, 2026, 11), 300)
eq('fatura de dezembro = 0', F.valorFaturaCartaoNoMes(avista, FECH, 2026, 12), 0)
eq('limite comprometido = 300,00', F.limiteComprometido(avista, FECH, HOJE, { cartaoId: 'c1' }), 300)

console.log('\n# Compra em 3x (1.200,00 em 15/11)')
const tres = [compra('b', 1200, '2026-11-15', 3)]
eq('novembro = 400,00', F.valorFaturaCartaoNoMes(tres, FECH, 2026, 11), 400)
eq('dezembro = 400,00', F.valorFaturaCartaoNoMes(tres, FECH, 2026, 12), 400)
eq('janeiro/2027 = 400,00', F.valorFaturaCartaoNoMes(tres, FECH, 2027, 1), 400)
eq('fevereiro/2027 = 0 (acabou)', F.valorFaturaCartaoNoMes(tres, FECH, 2027, 2), 0)
eq('parcelas futuras após novembro = 800,00', F.totalParcelasFuturas(tres, [], FECH, 2026, 11), 800)

console.log('\n# Compra em 12x (1.000,00 em 21/11, após o fechamento)')
const doze = [compra('d', 1000, '2026-11-21', 12)]
eq('novembro = 0 (entra só em dezembro)', F.valorFaturaCartaoNoMes(doze, FECH, 2026, 11), 0)
eq('dezembro = 83,33 (parcela 1)', F.valorFaturaCartaoNoMes(doze, FECH, 2026, 12), 83.33)
eq('outubro/2027 = 83,33 (parcela 11)', F.valorFaturaCartaoNoMes(doze, FECH, 2027, 10), 83.33)
eq('novembro/2027 = 83,37 (parcela 12, ajuste de centavos)', F.valorFaturaCartaoNoMes(doze, FECH, 2027, 11), 83.37)
eq('dezembro/2027 = 0', F.valorFaturaCartaoNoMes(doze, FECH, 2027, 12), 0)
let soma = 0
for (let i = 0; i < 14; i++) { const m = (11 + i) % 12 + 1; const a = 2026 + Math.floor((11 + i) / 12); soma += F.valorFaturaCartaoNoMes(doze, FECH, a, m) }
eq('soma das 12 parcelas = 1.000,00 exatos', soma, 1000)

console.log('\n# Carteira completa (limite 5.000,00)')
const todas = [...avista, ...tres, ...doze, compra('f', 50, '2026-11-20')]
eq('fatura de novembro = 300 + 400 + 50 = 750,00', F.valorFaturaCartaoNoMes(todas, FECH, 2026, 11), 750)
eq('fatura de dezembro = 400 + 83,33 = 483,33', F.valorFaturaCartaoNoMes(todas, FECH, 2026, 12), 483.33)
eq('fatura de janeiro/2027 = 483,33', F.valorFaturaCartaoNoMes(todas, FECH, 2027, 1), 483.33)
eq('fatura de fevereiro/2027 = 83,33', F.valorFaturaCartaoNoMes(todas, FECH, 2027, 2), 83.33)
const comprometido = F.limiteComprometido(todas, FECH, HOJE, { cartaoId: 'c1' })
eq('limite comprometido = soma de todas as compras = 2.550,00', comprometido, 2550)
eq('limite disponível = 5.000 − 2.550 = 2.450,00', 5000 - comprometido, 2450)

console.log('\n# Edição e exclusão refletem no cálculo')
const editada = todas.map(x => x.id === 'a' ? { ...x, valor_total: 350 } : x)
eq('à vista editada 300 → 350: novembro = 800,00', F.valorFaturaCartaoNoMes(editada, FECH, 2026, 11), 800)
eq('à vista editada: comprometido = 2.600,00', F.limiteComprometido(editada, FECH, HOJE, { cartaoId: 'c1' }), 2600)
const semFarmacia = editada.filter(x => x.id !== 'f')
eq('após excluir a de 50,00: novembro = 750,00', F.valorFaturaCartaoNoMes(semFarmacia, FECH, 2026, 11), 750)
const semDoze = semFarmacia.filter(x => x.id !== 'd')
eq('após excluir a 12x: dezembro = 400,00', F.valorFaturaCartaoNoMes(semDoze, FECH, 2026, 12), 400)
eq('após excluir a 12x: comprometido = 1.550,00', F.limiteComprometido(semDoze, FECH, HOJE, { cartaoId: 'c1' }), 1550)

console.log('\n# Limite insuficiente e fatura paga')
const estouro = [compra('x', 5200, '2026-11-12')]
const comp = F.limiteComprometido(estouro, FECH, HOJE, { cartaoId: 'c1' })
eq('comprometido acima do limite = 5.200,00', comp, 5200)
eq('disponível exibido nunca negativo = 0', Math.max(0, 5000 - comp), 0)
const pagas = [{ cartao_id: 'c1', ano_mes: '2026-11', valor_total: 750, pago: true }]
eq('fatura de novembro paga libera o limite dela', F.limiteComprometido(todas, FECH, HOJE, { cartaoId: 'c1', faturasInformadas: pagas }), 2550 - 750)

console.log('\n# Parcelamento vinculado ao cartão (sem duplicar com compras)')
const parc = [{ id: 'p1', cartao_id: 'c1', valor_total: 600, numero_parcelas: 3, primeira_parcela: '2026-11-01' }]
eq('fatura completa de novembro = 750 + 200 = 950,00', F.totalFaturaCompleta(todas, parc, FECH, 2026, 11), 950)
const linhas = F.linhasFaturaCompleta(todas, parc, FECH, 2026, 11)
assert('cada compra aparece uma única vez na fatura', new Set(linhas.map(l => l.id)).size === linhas.length, `(${linhas.length} linhas)`)

console.log(falhas === 0 ? '\nOK — cálculos de fatura aprovados' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
