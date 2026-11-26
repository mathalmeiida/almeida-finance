// Saldo de caixa a partir de um marco de conciliação.
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100
const diaISO = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null
const instante = v => typeof v === 'string' && /T| /.test(v) && /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(v) ? Date.parse(v) : NaN

function somaNoPeriodo(listas, marco, hoje, marcoAtualizadoEm, despesa) {
  const vistos = new Set()
  const corte = instante(marcoAtualizadoEm)
  let total = 0
  for (const lista of listas) {
    for (const l of lista || []) {
      if (!l) continue
      const data = diaISO(despesa && l.pago_em ? l.pago_em : l.data)
      if (!data || data < marco || data > hoje) continue
      if (data === marco) {
        // Sem horário confiável, mantém a regra legada para evitar dupla baixa.
        // Para antecipações, o horário da criação não prova o horário do pagamento.
        const evento = instante(despesa && l.pago_em ? l.pago_em : l.criado_em)
        if (!Number.isFinite(corte) || !Number.isFinite(evento) || evento <= corte) continue
      }
      // Sem ID não é possível distinguir dois lançamentos legítimos iguais.
      if (l.id != null) {
        if (vistos.has(l.id)) continue
        vistos.add(l.id)
      }
      const valor = Number(l.valor)
      if (Number.isFinite(valor)) total += valor
    }
  }
  return total
}

export function calcularSaldoDisponivel({ saldoBase, marco, hoje, marcoAtualizadoEm = null, receitas = [], despesas = [] }) {
  if (saldoBase == null) return { configurado: false, saldo: 0, receitas: 0, despesas: 0 }
  const m = marco || hoje
  const rec = somaNoPeriodo(Array.isArray(receitas[0]) ? receitas : [receitas], m, hoje, marcoAtualizadoEm, false)
  const desp = somaNoPeriodo(Array.isArray(despesas[0]) ? despesas : [despesas], m, hoje, marcoAtualizadoEm, true)
  return { configurado: true, saldo: r2((Number(saldoBase) || 0) + rec - desp), receitas: r2(rec), despesas: r2(desp) }
}

export const inicioDoMes = iso => `${iso.slice(0, 7)}-01`
export function precisaBuscarAnteriores(marco, hoje) {
  return !!marco && marco < inicioDoMes(hoje)
}
export function divergenciaSaldo(saldoApp, saldoBanco) {
  const d = r2((Number(saldoBanco) || 0) - (Number(saldoApp) || 0))
  return { diferenca: d, confere: Math.abs(d) < 0.01 }
}
