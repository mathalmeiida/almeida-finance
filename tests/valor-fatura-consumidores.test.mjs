// Valor de fatura usado por Horizonte/Calendario/Home/Projecao (mesma composicao de
// gerarHorizonte: saldoEmAbertoFatura(totalFaturaComOverride(...))) e limite comprometido.
// gerarHorizonte NAO e importavel em node puro (importa hooks com react/supabase), por isso
// a composicao e reproduzida aqui com as funcoes puras de faturaCartao. Dados ficticios.
import * as F from '../src/lib/faturaCartao.js'

let falhas = 0
function eq(nome, obtido, esperado) { const ok = Math.abs(obtido - esperado) < 0.005; if (!ok) falhas++; console.log(`${ok ? 'PASS' : 'FALHA'} - ${nome} (obtido ${obtido}, esperado ${esperado})`) }

// Cartao fecha 20, vence 28, hoje 10/11/2026. Compra de 1.000 em 05/11 (ciclo de novembro, vence 28/11).
const cartao = { id: 'c1', nome: 'Teste', dia_fechamento: 20, dia_vencimento: 28, limite_total: 5000 }
const comprasCartao = [{ id: 'k1', cartao_id: 'c1', descricao: 'k1', valor_total: 1000, data_compra: '2026-11-05', numero_parcelas: 1 }]
const pg = (id, valor, o = {}) => ({ id, cartao_id: 'c1', ano_mes: '2026-11', valor, status: 'ativo', origem: 'saldo_principal', data_pagamento: '2026-11-09', ...o })
const saidasDe = pagamentosFatura => F.saldoEmAbertoFatura(
  F.totalFaturaComOverride(comprasCartao, [], [], 'c1', cartao.dia_fechamento, 2026, 11),
  pagamentosFatura, [], 'c1', 2026, 11)

eq('sem pagamento: fatura inteira no vencimento', saidasDe([]), 1000)
eq('pagamento parcial: só o em aberto', saidasDe([pg('a', 300)]), 700)
eq('pagamento total: fatura quitada não aparece', saidasDe([pg('a', 1000)]), 0)
eq('pagamento estornado: volta ao total', saidasDe([pg('a', 1000, { status: 'estornado' })]), 1000)
eq('pagamento legado conta como pago no ciclo', saidasDe([pg('a', 1000, { origem: 'outra_conta', legado: true })]), 0)
eq('pagamento de outro ciclo não abate', saidasDe([pg('a', 1000, { ano_mes: '2026-10' })]), 1000)
eq('pagamento de outro cartão não abate', saidasDe([pg('a', 1000, { cartao_id: 'c2' })]), 1000)
eq('dois pagamentos parciais somam uma vez', saidasDe([pg('a', 300), pg('b', 200)]), 500)
eq('mesmo valor via saldoEmAbertoFatura', F.saldoEmAbertoFatura(1000, [pg('a', 300)], [], 'c1', 2026, 11), 700)

// Limite: parcial libera proporcional, uma vez; nova compra aumenta comprometido.
const hojeD = new Date('2026-11-10T12:00:00')
const comp = (pagamentos, compras = comprasCartao) => F.limiteComprometido(compras, 20, hojeD, { cartaoId: 'c1', pagamentos })
eq('limite comprometido sem pagamento', comp([]), 1000)
eq('pagamento parcial reduz uma vez', comp([pg('a', 300)]), 700)
eq('pagamento total libera tudo', comp([pg('a', 1000)]), 0)
eq('estorno restaura', comp([pg('a', 300, { status: 'estornado' })]), 1000)
eq('nova compra após parcial soma só o novo', comp([pg('a', 300)], [...comprasCartao, { id: 'k2', cartao_id: 'c1', descricao: 'k2', valor_total: 200, data_compra: '2026-11-08', numero_parcelas: 1 }]), 900)
const parc = [{ id: 'k3', cartao_id: 'c1', descricao: 'k3', valor_total: 1200, data_compra: '2026-11-05', numero_parcelas: 3 }]
eq('compra parcelada 1200 em 3x compromete o total 1200 (sem dupla contagem)', comp([], parc), 1200)

console.log(falhas === 0 ? '\nOK - horizonte e limite aprovados' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
