export function calcularParcelas(valorTotal, numeroParcelas) {
  const totalCentavos = Math.round(Number(valorTotal) * 100)
  const n = Number(numeroParcelas)
  if (!n || n <= 0) return { base: 0, ultima: 0 }
  const baseCentavos = Math.floor(totalCentavos / n)
  const ultimaCentavos = totalCentavos - baseCentavos * (n - 1)
  return {
    base: baseCentavos / 100,
    ultima: ultimaCentavos / 100,
  }
}

