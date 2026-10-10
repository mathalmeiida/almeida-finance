// ─── Cálculos PUROS de Benefícios (VR/VA) ────────────────────────────────────
// Sem React, sem Supabase — fonte única da lógica de saldo, reutilizada pelo
// hook useBeneficios e testável isoladamente (node). O saldo do benefício é a
// soma ASSINADA das movimentações; nada aqui toca saldo bancário/limite diário.

// Efeito de uma movimentação sobre o SALDO do benefício.
//   recarga / estorno / ajuste → entram (+)
//   compra                     → sai (−)
// (valor é sempre >= 0 no banco; o sinal vem do tipo. Reduções manuais são
//  lançadas como 'compra' com descrição "Ajuste" — ver página.)
export function efeitoNoSaldo(mov) {
  const v = Number(mov.valor) || 0
  switch (mov.tipo) {
    case 'recarga':
    case 'estorno':
    case 'ajuste':
      return v
    case 'compra':
      return -v
    default:
      return 0
  }
}

// Saldo do benefício = soma assinada de todas as suas movimentações.
export function calcularSaldo(movimentacoes = []) {
  return movimentacoes.reduce((acc, m) => acc + efeitoNoSaldo(m), 0)
}

// Total GASTO (apenas compras) numa competência 'YYYY-MM'.
export function totalGastoNoMesCompetencia(movimentacoes = [], competencia) {
  return movimentacoes
    .filter(m => m.tipo === 'compra' && String(m.data).slice(0, 7) === competencia)
    .reduce((acc, m) => acc + (Number(m.valor) || 0), 0)
}
