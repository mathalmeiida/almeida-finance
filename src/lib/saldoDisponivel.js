// ─── Saldo disponível (regra única, pura e testável) ────────────────────────
// saldo = saldo informado + receitas − despesas com data DEPOIS da data do
// saldo informado (marco) e até hoje, em QUALQUER mês.
//  • Lançamentos no dia do marco ou antes já estão no saldo informado.
//  • Lançamentos futuros (> hoje) ainda não mexem no saldo.
//  • Cada registro conta uma vez (dedup por id), mesmo vindo de duas listas.
//  • Só entram receitas e despesas: compras de cartão (pagas pela fatura),
//    transferências entre contas próprias e movimentações de investimento não
//    são gravadas nessas tabelas e, portanto, nunca afetam este saldo.
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100

function somaNoPeriodo(listas, marco, hoje) {
  const vistos = new Set()
  let total = 0
  for (const lista of listas) {
    for (const l of lista || []) {
      if (!l || !l.data || l.data <= marco || l.data > hoje) continue
      const chave = l.id ?? `${l.data}|${l.valor}|${l.descricao}`
      if (vistos.has(chave)) continue
      vistos.add(chave)
      total += Number(l.valor) || 0
    }
  }
  return total
}

export function calcularSaldoDisponivel({ saldoBase, marco, hoje, receitas = [], despesas = [] }) {
  if (saldoBase == null) return { configurado: false, saldo: 0, receitas: 0, despesas: 0 }
  const m = marco || hoje
  const rec = somaNoPeriodo(Array.isArray(receitas[0]) ? receitas : [receitas], m, hoje)
  const desp = somaNoPeriodo(Array.isArray(despesas[0]) ? despesas : [despesas], m, hoje)
  return { configurado: true, saldo: r2((Number(saldoBase) || 0) + rec - desp), receitas: r2(rec), despesas: r2(desp) }
}

// Primeiro dia do mês de uma data ISO.
export const inicioDoMes = iso => `${iso.slice(0, 7)}-01`

// O marco é de um mês anterior? Então é preciso buscar os lançamentos
// entre o marco e o início do mês atual (as listas do mês não os trazem).
export function precisaBuscarAnteriores(marco, hoje) {
  return !!marco && marco < inicioDoMes(hoje)
}

// Diferença entre o saldo do app e o informado pelo banco (conciliação).
export function divergenciaSaldo(saldoApp, saldoBanco) {
  const d = r2((Number(saldoBanco) || 0) - (Number(saldoApp) || 0))
  return { diferenca: d, confere: Math.abs(d) < 0.01 }
}
