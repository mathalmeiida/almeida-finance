// Detalhamento de faturas: caso real reportado (fatura informada R$ 5.970,18
// exibindo R$ 7.800,93 detalhados e "100% detalhada"). Dados fictícios.
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

// Cartão c1 fecha dia 20. Fatura de novembro/2026 informada pelo banco: 5.970,18.
const FECH = 20
const compra = (id, valor_total, data_compra, numero_parcelas = 1, extra = {}) =>
  ({ id, cartao_id: 'c1', descricao: `Compra ${id}`, valor_total, data_compra, numero_parcelas, ...extra })
const compras = [
  compra('a', 4000, '2026-11-05'),
  compra('b', 1970.18, '2026-11-10'),
  // Outro cartão misturado na lista: não pode entrar na fatura de c1.
  { ...compra('x', 999, '2026-11-08'), cartao_id: 'c2' },
]
const informadas = [{ cartao_id: 'c1', ano_mes: '2026-11', valor_total: 5970.18 }]
const parcelamentos = [
  // 1ª parcela em 25/11 (após o fechamento do dia 20): pertence ao ciclo de dezembro.
  { id: 'p1', cartao_id: 'c1', descricao: 'Geladeira', valor_total: 5492.25, numero_parcelas: 3, primeira_parcela: '2026-11-25' },
  // Duplica a compra 'b' cadastrada em compras_cartao (mesma descrição, valor e parcelas).
  { id: 'p2', cartao_id: 'c1', descricao: 'compra B', valor_total: 1970.18, numero_parcelas: 1, primeira_parcela: '2026-11-10' },
  // Parcelamento de outro cartão.
  { id: 'p3', cartao_id: 'c2', descricao: 'Sofá', valor_total: 900, numero_parcelas: 3, primeira_parcela: '2026-11-02' },
]

console.log('# Caso 5.970,18 x 7.800,93')
const r = F.resumoFaturaCartao(compras, parcelamentos, informadas, 'c1', FECH, 2026, 11)
eq('compras detalhadas do ciclo de novembro = 5.970,18 (sem parcela do ciclo de dezembro)', r.comprasDetalhadas, 5970.18)
assert('detalhamento completo ao centavo', r.situacaoDetalhamento === 'completo' && r.percentualDetalhado === 100)
eq('total da fatura = 5.970,18', r.total, 5970.18)
const ls = F.linhasFaturaCompleta(compras, parcelamentos, FECH, 2026, 11, 'c1')
assert('nenhuma linha duplicada', new Set(ls.map(l => l.id)).size === ls.length && ls.length === 2, `(${ls.length} linhas)`)
eq('ciclo de dezembro contém a 1ª parcela da geladeira (1.830,75)', F.totalFaturaCompleta(compras, parcelamentos, FECH, 2026, 12, 'c1'), 1830.75)
eq('ciclo de janeiro contém a 2ª parcela (1.830,75)', F.totalFaturaCompleta(compras, parcelamentos, FECH, 2027, 1, 'c1'), 1830.75)
eq('3 parcelas somam o valor total', [12, 13, 14].reduce((a, i) => a + F.totalFaturaCompleta([], [parcelamentos[0]], FECH, 2026 + Math.floor((i - 1) / 12), ((i - 1) % 12) + 1, 'c1'), 0), 5492.25)

console.log('\n# Detalhado acima do informado nunca é "100%"')
const maisQue = [...compras, compra('z', 1830.75, '2026-11-12')]
const r2 = F.resumoFaturaCartao(maisQue, [], informadas, 'c1', FECH, 2026, 11)
eq('compras detalhadas = 7.800,93', r2.comprasDetalhadas, 7800.93)
assert('situação = divergente (não completa)', r2.situacaoDetalhamento === 'divergente')
eq('divergência = 1.830,75', r2.divergencia, 1830.75)
eq('"ainda não detalhado" = 0', r2.naoDetalhado, 0)
const s = F.statusDetalhamento(5970.18, 5970.17)
assert('1 centavo faltando = parcial e menor que 100%', s.situacaoDetalhamento === 'parcial' && s.percentualDetalhado < 100)
assert('sem total informado = sem_total', F.statusDetalhamento(0, 100, false).situacaoDetalhamento === 'sem_total')

console.log('\n# Filtro por cartão e ciclo')
eq('compra do cartão c2 não entra na fatura de c1', F.totalFaturaCompleta(compras, [], FECH, 2026, 11, 'c1'), 5970.18)
eq('sem cartaoId o comportamento anterior é mantido (soma tudo)', F.totalFaturaCompleta(compras, [], FECH, 2026, 11), 5970.18 + 999)
eq('compra de 21/11 não aparece em novembro', F.totalFaturaCompleta([compra('t', 100, '2026-11-21')], [], FECH, 2026, 11, 'c1'), 0)

await Promise.resolve()
console.log(falhas === 0 ? '\nOK — detalhamento de faturas aprovado' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
