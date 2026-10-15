
/**
 * ALMEIDA FINANCE
 * Calculo de faturas de cartao de credito.
 *
 * Regras:
 * - Compras sao projetadas, sem criar parcelas no banco.
 * - Respeita fechamento e vencimento.
 * - Compras parceladas sao distribuidas por competencia.
 * - Valores manuais nao sao somados em duplicidade.
 * - Valores manuais nao criam parcelas futuras.
 * - Faturas pagas nao comprometem o limite.
 *
 * Mantem as assinaturas das funcoes existentes.
 */

import { calcularParcelas } from '../hooks/useParcelamentos'

// ============================================================
// FUNCOES AUXILIARES
// ============================================================

function numero(valor, padrao = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : padrao
}

function centavos(valor) {
  return Math.round(numero(valor) * 100)
}

function dinheiro(valor) {
  return Math.round(numero(valor) * 100) / 100
}

function chaveNumerica(ano, mes) {
  return Number(ano) * 12 + Number(mes) - 1
}

function competenciaPorIndice(indice) {
  return {
    ano: Math.floor(indice / 12),
    mes: ((indice % 12) + 12) % 12 + 1
  }
}

function dataLocal(valor) {
  if (!valor) return null

  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime())
      ? null
      : valor
  }

  const texto = String(valor).slice(0, 10)
  const data = new Date(`${texto}T12:00:00`)

  return Number.isNaN(data.getTime()) ? null : data
}

function parcelasValidas(valor) {
  return Math.max(1, Math.trunc(numero(valor, 1)))
}

function distribuirParcela(valorTotal, quantidade, indice) {
  const total = centavos(valorTotal)
  const n = parcelasValidas(quantidade)

  if (indice < 0 || indice >= n) return 0

  // Preserva o contrato de calcularParcelas utilizado
  // pelo restante do aplicativo.
  const { base, ultima } = calcularParcelas(
    numero(valorTotal),
    n
  )

  return dinheiro(indice === n - 1 ? ultima : base)
}

// ============================================================
// 1. COMPETENCIA DA PRIMEIRA PARCELA
// ============================================================

/**
 * Determina em qual ciclo a compra entra.
 *
 * Exemplo:
 * Fechamento dia 20
 *
 * Compra em 18/10 -> competencia outubro
 * Compra em 20/10 -> competencia outubro
 * Compra em 21/10 -> competencia novembro
 *
 * A competencia representa o mes de fechamento,
 * nao necessariamente o mes do vencimento.
 */

export function competenciaPrimeiraParcela(
  dataCompra,
  diaFechamento
) {
  const data = dataLocal(dataCompra)

  if (!data) {
    throw new Error('Data da compra invalida')
  }

  let ano = data.getFullYear()
  let mes = data.getMonth() + 1

  const fechamento = Math.max(
    1,
    Math.min(31, numero(diaFechamento, 20))
  )

  // Ajusta o fechamento para meses mais curtos.
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const diaEfetivo = Math.min(fechamento, ultimoDia)

  if (data.getDate() > diaEfetivo) {
    mes += 1

    if (mes > 12) {
      mes = 1
      ano += 1
    }
  }

  return { ano, mes }
}

// ============================================================
// 2. PARCELA DE UMA COMPRA NO MES
// ============================================================

/**
 * Retorna a parcela da compra em uma competencia.
 *
 * Compra a vista:
 * aparece em um unico mes.
 *
 * Compra parcelada:
 * aparece uma vez em cada mes correspondente.
 */

export function parcelaCompraNoMes(
  compra,
  diaFechamento,
  ano,
  mes
) {
  if (!compra || !compra.data_compra) return null

  const inicio = competenciaPrimeiraParcela(
    compra.data_compra,
    diaFechamento
  )

  const indice =
    chaveNumerica(ano, mes) -
    chaveNumerica(inicio.ano, inicio.mes)

  const n = parcelasValidas(compra.numero_parcelas)

  if (indice < 0 || indice >= n) {
    return null
  }

  return {
    valor: distribuirParcela(
      compra.valor_total,
      n,
      indice
    ),
    parcela: indice + 1,
    totalParcelas: n
  }
}

// ============================================================
// 3. VALOR DAS COMPRAS NA FATURA
// ============================================================

export function valorFaturaCartaoNoMes(
  compras,
  diaFechamento,
  ano,
  mes
) {
  const total = (compras || []).reduce((acc, compra) => {
    const parcela = parcelaCompraNoMes(
      compra,
      diaFechamento,
      ano,
      mes
    )

    return acc + (parcela ? centavos(parcela.valor) : 0)
  }, 0)

  return total / 100
}

// ============================================================
// 4. LINHAS DE COMPRAS NA FATURA
// ============================================================

export function linhasFaturaNoMes(
  compras,
  diaFechamento,
  ano,
  mes
) {
  return (compras || [])
    .map(compra => {
      const parcela = parcelaCompraNoMes(
        compra,
        diaFechamento,
        ano,
        mes
      )

      if (!parcela) return null

      return {
        compra,
        valor: parcela.valor,
        parcela: parcela.parcela,
        totalParcelas: parcela.totalParcelas
      }
    })
    .filter(Boolean)
    .sort((a, b) =>
      String(a.compra.data_compra).localeCompare(
        String(b.compra.data_compra)
      )
    )
}

// ============================================================
// 5. FATURA COMPLETA
// ============================================================

/**
 * Combina:
 * - compras do cartao
 * - parcelamentos vinculados ao cartao
 *
 * Nao grava parcelas adicionais no banco.
 */

export function linhasFaturaCompleta(
  compras,
  parcelamentos,
  diaFechamento,
  ano,
  mes
) {
  const deCompras = linhasFaturaNoMes(
    compras,
    diaFechamento,
    ano,
    mes
  ).map(linha => ({
    id: linha.compra.id,
    descricao: linha.compra.descricao,
    categorias: linha.compra.categorias,
    data: linha.compra.data_compra,
    valor: linha.valor,
    parcela: linha.parcela,
    totalParcelas: linha.totalParcelas,
    origemParcelamento: false
  }))

  const deParcelamentos = (parcelamentos || [])
    .filter(p => !p.quitado_em)
    .map(p => {
      const inicio = dataLocal(p.primeira_parcela)

      if (!inicio) return null

      const indice =
        chaveNumerica(ano, mes) -
        chaveNumerica(
          inicio.getFullYear(),
          inicio.getMonth() + 1
        )

      const n = parcelasValidas(p.numero_parcelas)

      if (indice < 0 || indice >= n) {
        return null
      }

      return {
        id: `parc-${p.id}`,
        descricao: p.descricao,
        categorias: p.categorias,
        data: p.primeira_parcela,
        valor: distribuirParcela(
          p.valor_total,
          n,
          indice
        ),
        parcela: indice + 1,
        totalParcelas: n,
        origemParcelamento: true
      }
    })
    .filter(Boolean)

  return [...deCompras, ...deParcelamentos]
    .sort((a, b) =>
      String(a.data).localeCompare(String(b.data))
    )
}

// ============================================================
// 6. TOTAL DAS COMPRAS DETALHADAS
// ============================================================

export function totalFaturaCompleta(
  compras,
  parcelamentos,
  diaFechamento,
  ano,
  mes
) {
  const totalCentavos = linhasFaturaCompleta(
    compras,
    parcelamentos,
    diaFechamento,
    ano,
    mes
  ).reduce(
    (acc, linha) => acc + centavos(linha.valor),
    0
  )

  return totalCentavos / 100
}

// ============================================================
// 7. CHAVE DA FATURA
// ============================================================

export function anoMesChave(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}`
}

// ============================================================
// 8. FATURA INFORMADA MANUALMENTE
// ============================================================

export function faturaInformadaNoMes(
  faturasInformadas,
  cartaoId,
  ano,
  mes
) {
  if (!cartaoId || !faturasInformadas?.length) {
    return null
  }

  const chave = anoMesChave(ano, mes)

  return faturasInformadas.find(f =>
    String(f.cartao_id) === String(cartaoId) &&
    f.ano_mes === chave
  ) || null
}

// ============================================================
// 9. TOTAL FINAL DA FATURA
// ============================================================

/**
 * Regra:
 *
 * Se nao houver total manual:
 * usa a soma das compras.
 *
 * Se houver total manual:
 * usa o maior entre o total manual e as compras.
 *
 * Exemplo:
 * Manual = 3600
 * Compras = 1000
 * Total = 3600
 * Nao detalhado = 2600
 *
 * Manual = 3600
 * Compras = 4000
 * Total = 4000
 * Divergencia = 400
 */

export function totalFaturaComOverride(
  compras,
  parcelamentos,
  faturasInformadas,
  cartaoId,
  diaFechamento,
  ano,
  mes
) {
  const totalCompras = totalFaturaCompleta(
    compras,
    parcelamentos,
    diaFechamento,
    ano,
    mes
  )

  const informada = faturaInformadaNoMes(
    faturasInformadas,
    cartaoId,
    ano,
    mes
  )

  if (!informada) {
    return totalCompras
  }

  const manual = numero(informada.valor_total)

  return Math.max(
    centavos(manual),
    centavos(totalCompras)
  ) / 100
}

// ============================================================
// 10. DETALHAMENTO DO TOTAL MANUAL
// ============================================================

/**
 * Funcao adicional para exibir:
 * - total das compras
 * - total informado
 * - valor ainda nao detalhado
 * - divergencia
 *
 * Nao modifica nenhum registro do banco.
 */

export function resumoFaturaCartao(
  compras,
  parcelamentos,
  faturasInformadas,
  cartaoId,
  diaFechamento,
  ano,
  mes
) {
  const comprasDetalhadas = totalFaturaCompleta(
    compras,
    parcelamentos,
    diaFechamento,
    ano,
    mes
  )

  const informada = faturaInformadaNoMes(
    faturasInformadas,
    cartaoId,
    ano,
    mes
  )

  const possuiManual = informada !== null

  const totalManual = possuiManual
    ? numero(informada.valor_total)
    : 0

  const diferenca =
    centavos(totalManual) -
    centavos(comprasDetalhadas)

  return {
    total: totalFaturaComOverride(
      compras,
      parcelamentos,
      faturasInformadas,
      cartaoId,
      diaFechamento,
      ano,
      mes
    ),
    comprasDetalhadas,
    totalManual,
    possuiManual,
    naoDetalhado: Math.max(0, diferenca) / 100,
    divergencia: possuiManual
      ? Math.max(0, -diferenca) / 100
      : 0
  }
}

// ============================================================
// 11. PARCELAS FUTURAS
// ============================================================

/**
 * Soma somente parcelas de compras parceladas
 * posteriores a competencia selecionada.
 *
 * Nao inclui:
 * - total manual da fatura
 * - compras a vista
 * - parcelas da propria competencia selecionada
 */

export function totalParcelasFuturas(
  compras,
  parcelamentos,
  diaFechamento,
  ano,
  mes
) {
  const referencia = chaveNumerica(ano, mes)

  let total = 0

  for (const compra of compras || []) {
    const n = parcelasValidas(compra.numero_parcelas)

    if (n <= 1 || !compra.data_compra) continue

    const inicio = competenciaPrimeiraParcela(
      compra.data_compra,
      diaFechamento
    )

    const primeira = chaveNumerica(
      inicio.ano,
      inicio.mes
    )

    for (let indice = 0; indice < n; indice++) {
      if (primeira + indice <= referencia) continue

      total += centavos(
        distribuirParcela(
          compra.valor_total,
          n,
          indice
        )
      )
    }
  }

  for (const p of parcelamentos || []) {
    if (p.quitado_em) continue

    const n = parcelasValidas(p.numero_parcelas)
    const inicio = dataLocal(p.primeira_parcela)

    if (!inicio || n <= 1) continue

    const primeira = chaveNumerica(
      inicio.getFullYear(),
      inicio.getMonth() + 1
    )

    for (let indice = 0; indice < n; indice++) {
      if (primeira + indice <= referencia) continue

      total += centavos(
        distribuirParcela(
          p.valor_total,
          n,
          indice
        )
      )
    }
  }

  return total / 100
}

// ============================================================
// 12. LIMITE COMPROMETIDO
// ============================================================

/**
 * Soma obrigacoes cujas faturas nao foram
 * marcadas como pagas.
 *
 * Inclui:
 * - compras a vista
 * - compras parceladas
 * - parcelamentos vinculados
 * - totais manuais informados
 *
 * Evita somar o valor manual duas vezes.
 *
 * IMPORTANTE:
 * O resultado e uma estimativa baseada nos
 * registros do aplicativo.
 *
 * Pagamentos parciais, estornos e ajustes
 * nao registrados nao sao considerados.
 */

export function limiteComprometido(
  compras,
  diaFechamento,
  hoje = new Date(),
  extras = {}
) {
  const {
    cartaoId = null,
    parcelamentos = [],
    faturasInformadas = []
  } = extras

  const parcsDoCartao = cartaoId
    ? (parcelamentos || []).filter(
        p =>
          String(p.cartao_id) === String(cartaoId) &&
          !p.quitado_em
      )
    : []

  const manuaisDoCartao = cartaoId
    ? (faturasInformadas || []).filter(
        f => String(f.cartao_id) === String(cartaoId)
      )
    : []

  let minimo = null
  let maximo = null

  function considerar(indice) {
    if (!Number.isFinite(indice)) return

    if (minimo === null || indice < minimo) {
      minimo = indice
    }

    if (maximo === null || indice > maximo) {
      maximo = indice
    }
  }

  // Compras cadastradas
  for (const compra of compras || []) {
    if (!compra.data_compra) continue

    const inicio = competenciaPrimeiraParcela(
      compra.data_compra,
      diaFechamento
    )

    const primeiro = chaveNumerica(
      inicio.ano,
      inicio.mes
    )

    const n = parcelasValidas(compra.numero_parcelas)

    considerar(primeiro)
    considerar(primeiro + n - 1)
  }

  // Parcelamentos associados ao cartao
  for (const p of parcsDoCartao) {
    const inicio = dataLocal(p.primeira_parcela)

    if (!inicio) continue

    const primeiro = chaveNumerica(
      inicio.getFullYear(),
      inicio.getMonth() + 1
    )

    const n = parcelasValidas(p.numero_parcelas)

    considerar(primeiro)
    considerar(primeiro + n - 1)
  }

  // Faturas preenchidas manualmente
  for (const f of manuaisDoCartao) {
    const partes = String(f.ano_mes || '').split('-')
    const ano = Number(partes[0])
    const mes = Number(partes[1])

    if (
      !Number.isInteger(ano) ||
      !Number.isInteger(mes) ||
      mes < 1 ||
      mes > 12
    ) {
      continue
    }

    considerar(chaveNumerica(ano, mes))
  }

  if (minimo === null || maximo === null) {
    return 0
  }

  let totalCentavos = 0

  for (
    let indice = minimo;
    indice <= maximo;
    indice++
  ) {
    const { ano, mes } = competenciaPorIndice(indice)

    const informada = faturaInformadaNoMes(
      manuaisDoCartao,
      cartaoId,
      ano,
      mes
    )

    // Uma fatura marcada como paga nao
    // compromete mais o limite.
    if (informada?.pago === true) {
      continue
    }

    const totalMes = totalFaturaComOverride(
      compras,
      parcsDoCartao,
      manuaisDoCartao,
      cartaoId,
      diaFechamento,
      ano,
      mes
    )

    totalCentavos += centavos(totalMes)
  }

  return totalCentavos / 100
}
