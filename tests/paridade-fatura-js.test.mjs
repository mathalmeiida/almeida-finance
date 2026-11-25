// Gabarito JS da paridade SQL x JS do total da fatura (node puro, sem banco).
// Le tests/fixtures/paridade-fatura.json (o MESMO arquivo usado por
// supabase/tests/paridade-fatura.mjs contra a funcao SQL) e confere se
// src/lib/faturaCartao.js produz os valores esperados (calculados a mao).
// O lado SQL NAO e executado aqui: ver supabase/tests/paridade-fatura.mjs (PENDENTE no DEV/PGlite).
import { readFileSync } from 'fs'
import * as F from '../src/lib/faturaCartao.js'

const fx = JSON.parse(readFileSync(new URL('./fixtures/paridade-fatura.json', import.meta.url), 'utf8'))
let falhas = 0
let n = 0
function eq(nome, obtido, esperado) {
  n++
  const ok = Math.round(Number(obtido) * 100) === Math.round(Number(esperado) * 100)
  if (!ok) falhas++
  if (!ok) console.log(`FALHA - ${nome} (obtido ${obtido}, esperado ${esperado})`)
}
function assert(nome, cond, det = '') {
  n++
  if (!cond) { falhas++; console.log(`FALHA - ${nome} ${det}`) }
}

const HOJE = new Date('2026-11-10T12:00:00')

function montar(cen) {
  const fech = { ...fx.cartoes, ...(cen.cartoes || {}) }
  const cartoes = { main: { id: 'main', dia_fechamento: fech.main, dia_vencimento: 28 }, b: { id: 'b', dia_fechamento: fech.b, dia_vencimento: 28 } }
  const compras = (cen.compras || []).map((c, i) => ({ id: `c${i}`, cartao_id: c.cartao || 'main', ...c }))
  const parcelamentos = (cen.parcelamentos || []).map((p, i) => ({ id: `p${i}`, cartao_id: p.cartao || 'main', quitado_em: null, ...p }))
  const faturasInformadas = (cen.faturasInformadas || []).map(f => ({ cartao_id: f.cartao || 'main', ...f }))
  return { cartoes, compras, parcelamentos, faturasInformadas }
}
const split = ym => ({ ano: Number(ym.slice(0, 4)), mes: Number(ym.slice(5, 7)) })

console.log('# Totais por ciclo (gabarito x faturaCartao.js)')
for (const cen of fx.totais) {
  const { cartoes, compras, parcelamentos, faturasInformadas } = montar(cen)
  for (const [ym, esp] of Object.entries(cen.esperado)) {
    const { ano, mes } = split(ym)
    eq(`${cen.nome} | main ${ym}`, F.totalFaturaComOverride(compras, parcelamentos, faturasInformadas, 'main', cartoes.main.dia_fechamento, ano, mes), esp)
    const c = F.cicloFatura({ cartao: cartoes.main, compras, parcelamentos, faturasInformadas, pagamentos: [], ano, mes, hoje: HOJE })
    eq(`${cen.nome} | cicloFatura.total main ${ym}`, c.total, esp)
  }
  for (const [ym, esp] of Object.entries(cen.esperado_b || {})) {
    const { ano, mes } = split(ym)
    eq(`${cen.nome} | b ${ym}`, F.totalFaturaComOverride(compras, parcelamentos, faturasInformadas, 'b', cartoes.b.dia_fechamento, ano, mes), esp)
  }
}

console.log('# Sequencias de pagamento (regra: valor <= total - pago, total > 0)')
for (const cen of fx.pagamentos) {
  const { cartoes, compras, parcelamentos, faturasInformadas } = montar(cen)
  const pagamentos = []
  const porRef = {}
  const emAberto = (cartao, ym) => {
    const { ano, mes } = split(ym)
    return F.cicloFatura({ cartao: cartoes[cartao], compras, parcelamentos, faturasInformadas, pagamentos, ano, mes, hoje: HOJE })
  }
  for (const [ym, esp] of Object.entries(cen.esperado || {})) {
    eq(`${cen.nome} | total ${ym}`, emAberto('main', ym).total, esp)
  }
  cen.passos.forEach((p, i) => {
    const rot = `${cen.nome} | passo ${i + 1} ${p.op}`
    if (p.somenteSql) return
    const cartao = p.cartao || 'main'
    if (p.op === 'compra') {
      compras.push({ id: `n${i}`, cartao_id: cartao, ...p.compra })
    } else if (p.op === 'estornar') {
      porRef[p.ref].status = 'estornado'
    } else {
      const c = emAberto(cartao, p.ano_mes)
      const aceito = c.total > 0 && c.emAberto > 0 && Math.round(p.valor * 100) <= Math.round(c.emAberto * 100)
      assert(`${rot}: aceito=${aceito} esperado ${p.ok}`, aceito === p.ok)
      if (aceito) {
        const pg = { id: `g${i}`, cartao_id: cartao, ano_mes: p.ano_mes, valor: p.valor, status: 'ativo', origem: 'saldo_principal' }
        pagamentos.push(pg)
        if (p.id) porRef[p.id] = pg
      }
    }
    eq(`${rot}: em aberto apos o passo`, emAberto(cartao, p.ano_mes).emAberto, p.emAberto)
  })
}

console.log(falhas === 0 ? `OK - gabarito JS da paridade aprovado (${n} verificacoes). Lado SQL: PENDENTE (supabase/tests/paridade-fatura.mjs).` : `${falhas} FALHA(S) de ${n}`)
if (falhas) process.exitCode = 1
