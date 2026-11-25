/**
 * Distribui o valor total em parcelas em centavos, ajustando a diferença
 * de arredondamento na ÚLTIMA parcela, de modo que a soma seja exatamente
 * igual ao valor total.
 * Ex: 1000 / 9 → 8x de 111,11 + 1x de 111,12 (soma = 1000,00)
 *
 * @returns {{ base: number, ultima: number }} valores em reais
 */
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
