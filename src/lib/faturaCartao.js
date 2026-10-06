/**
 * Lógica de cálculo de faturas de cartão de crédito.
 * Nenhuma parcela é gravada no banco — tudo é projetado a partir da compra.
 */

import { calcularParcelas } from '../hooks/useParcelamentos'

/**
 * Determina em qual mês/ano uma COMPRA entra como PRIMEIRA parcela,
 * com base no dia de fechamento do cartão.
 *
 * Regra: compra feita ATÉ o dia de fechamento (inclusive) entra na fatura
 * que fecha naquele mês; compra feita DEPOIS do fechamento entra na próxima.
 * Ex: fecha dia 20 — compra dia 18 → mês atual; compra dia 22 → mês seguinte.
 *
 * @param {object} compra  { data_compra, dia_fechamento (do cartão) }
 * @returns {{ ano: number, mes: number }} competência da 1ª parcela (mes 1-12)
 */
export function competenciaPrimeiraParcela(dataCompra, diaFechamento) {
  const d = new Date(dataCompra + 'T12:00:00')
  let ano = d.getFullYear()
  let mes = d.getMonth() + 1 // 1-12
  if (d.getDate() > Number(diaFechamento)) {
    // passou do fechamento → entra na próxima fatura
    mes += 1
    if (mes > 12) { mes = 1; ano += 1 }
  }
  return { ano, mes }
}

/**
 * Retorna o valor que uma compra representa na fatura de um mês/ano,
 * e qual número de parcela cai nesse mês (ou null se não houver parcela).
 *
 * - À vista (numero_parcelas = 1): valor total na competência da compra.
 * - Parcelada: distribui com arredondamento (última parcela ajustada),
 *   uma parcela por mês a partir da competência da 1ª parcela.
 *
 * @returns {{ valor: number, parcela: number } | null}
 */
export function parcelaCompraNoMes(compra, diaFechamento, ano, mes) {
  const { ano: anoIni, mes: mesIni } = competenciaPrimeiraParcela(compra.data_compra, diaFechamento)
  const indice = (ano - anoIni) * 12 + (mes - mesIni)
  const n = Number(compra.numero_parcelas) || 1
  if (indice < 0 || indice >= n) return null

  const { base, ultima } = calcularParcelas(Number(compra.valor_total), n)
  const ehUltima = indice === n - 1
  return {
    valor: ehUltima ? ultima : base,
    parcela: indice + 1, // 1-based: "1/12", "2/12"...
    totalParcelas: n,
  }
}

/**
 * Soma o valor da fatura de UM cartão em um mês/ano, a partir das suas compras.
 */
export function valorFaturaCartaoNoMes(compras, diaFechamento, ano, mes) {
  return compras.reduce((acc, c) => {
    const p = parcelaCompraNoMes(c, diaFechamento, ano, mes)
    return acc + (p ? p.valor : 0)
  }, 0)
}

/**
 * Lista as parcelas (linhas da fatura) de um cartão em um mês/ano.
 * Cada item: { compra, valor, parcela, totalParcelas }
 */
export function linhasFaturaNoMes(compras, diaFechamento, ano, mes) {
  return compras
    .map(c => {
      const p = parcelaCompraNoMes(c, diaFechamento, ano, mes)
      if (!p) return null
      return { compra: c, valor: p.valor, parcela: p.parcela, totalParcelas: p.totalParcelas }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.compra.data_compra) - new Date(b.compra.data_compra))
}

/**
 * Monta TODAS as linhas da fatura de um cartão em um mês/ano, combinando:
 *  - compras lançadas em compras_cartao (competência pelo fechamento)
 *  - parcelamentos vinculados ao cartão por cartao_id (competência pela
 *    primeira_parcela do próprio parcelamento)
 *
 * Não cria registros; apenas projeta a partir dos dados existentes.
 *
 * @param {object[]} compras        compras_cartao DESTE cartão
 * @param {object[]} parcelamentos  parcelamentos vinculados a ESTE cartão (cartao_id)
 * @param {number} diaFechamento
 * @param {number} ano
 * @param {number} mes  1-12
 * @returns {Array<{ id, descricao, categorias, valor, parcela, totalParcelas, origemParcelamento }>}
 */
export function linhasFaturaCompleta(compras, parcelamentos, diaFechamento, ano, mes) {
  // Compras à vista / parceladas lançadas no cartão
  const deCompras = linhasFaturaNoMes(compras, diaFechamento, ano, mes).map(l => ({
    id: l.compra.id,
    descricao: l.compra.descricao,
    categorias: l.compra.categorias,
    data: l.compra.data_compra,
    valor: l.valor,
    parcela: l.parcela,
    totalParcelas: l.totalParcelas,
    origemParcelamento: false,
  }))

  // Parcelamentos vinculados ao cartão (usa a primeira_parcela do parcelamento)
  const deParcelamentos = parcelamentos
    .filter(p => !p.quitado_em)
    .map(p => {
      const inicio = new Date(p.primeira_parcela + 'T12:00:00')
      const indice = (ano - inicio.getFullYear()) * 12 + ((mes - 1) - inicio.getMonth())
      if (indice < 0 || indice >= p.numero_parcelas) return null
      const { base, ultima } = calcularParcelas(Number(p.valor_total), p.numero_parcelas)
      const valor = indice === p.numero_parcelas - 1 ? ultima : base
      return {
        id: `parc-${p.id}`,
        descricao: p.descricao,
        categorias: p.categorias,
        data: p.primeira_parcela,
        valor,
        parcela: indice + 1,
        totalParcelas: p.numero_parcelas,
        origemParcelamento: true,
      }
    })
    .filter(Boolean)

  return [...deCompras, ...deParcelamentos].sort((a, b) => new Date(a.data) - new Date(b.data))
}

/**
 * Valor total da fatura (compras + parcelamentos) de um cartão em um mês/ano.
 */
export function totalFaturaCompleta(compras, parcelamentos, diaFechamento, ano, mes) {
  return linhasFaturaCompleta(compras, parcelamentos, diaFechamento, ano, mes)
    .reduce((acc, l) => acc + l.valor, 0)
}

// Converte (ano, mes) → 'YYYY-MM' (chave da tabela faturas_cartao).
export function anoMesChave(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

/**
 * Retorna o TOTAL INFORMADO de um cartão em um mês, se existir; senão null.
 * `faturasInformadas` = linhas da tabela faturas_cartao (do cartão ou de todos).
 */
export function faturaInformadaNoMes(faturasInformadas, cartaoId, ano, mes) {
  if (!faturasInformadas || faturasInformadas.length === 0) return null
  const chave = anoMesChave(ano, mes)
  const f = faturasInformadas.find(x => x.cartao_id === cartaoId && x.ano_mes === chave)
  return f ? f : null
}

/**
 * Total da fatura de um cartão num mês RESPEITANDO o override:
 *   - se existe total informado para (cartão, mês) → usa valor_total (SUBSTITUI);
 *   - senão → soma projetada (totalFaturaCompleta).
 * Esta é a FONTE ÚNICA do valor que entra no orçamento, garantindo que o total
 * informado nunca seja somado às compras detalhadas (evita duplicidade).
 */
export function totalFaturaComOverride(compras, parcelamentos, faturasInformadas, cartaoId, diaFechamento, ano, mes) {
  const informada = faturaInformadaNoMes(faturasInformadas, cartaoId, ano, mes)
  if (informada) return Number(informada.valor_total) || 0
  return totalFaturaCompleta(compras, parcelamentos, diaFechamento, ano, mes)
}

/**
 * Limite comprometido de um cartão = soma do valor restante de todas as
 * compras ainda não totalmente pagas. Para simplificar e refletir o uso real
 * do limite rotativo, consideramos o valor total das compras cuja última
 * parcela ainda não venceu em meses passados.
 *
 * Aproximação adotada: limite comprometido = soma, para cada compra, das
 * parcelas de competência >= mês atual (parcelas futuras + a do mês).
 */
export function limiteComprometido(compras, diaFechamento, hoje = new Date()) {
  const anoHoje = hoje.getFullYear()
  const mesHoje = hoje.getMonth() + 1
  return compras.reduce((acc, c) => {
    const n = Number(c.numero_parcelas) || 1
    const { base, ultima } = calcularParcelas(Number(c.valor_total), n)
    const { ano: anoIni, mes: mesIni } = competenciaPrimeiraParcela(c.data_compra, diaFechamento)
    let soma = 0
    for (let i = 0; i < n; i++) {
      const ano = anoIni + Math.floor((mesIni - 1 + i) / 12)
      const mes = ((mesIni - 1 + i) % 12) + 1
      const competenciaFutura = ano > anoHoje || (ano === anoHoje && mes >= mesHoje)
      if (competenciaFutura) soma += (i === n - 1 ? ultima : base)
    }
    return acc + soma
  }, 0)
}
