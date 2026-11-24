
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
 * - Pagamentos ativos (total, parcial, antecipado) reduzem a divida e liberam limite.
 * - Cada ciclo (competencia = mes de fechamento) so contem as proprias compras:
 *   pagamentos de um ciclo nunca abatem compras de outro.
 *
 * Mantem as assinaturas das funcoes existentes.
 */

import { calcularParcelas } from './parcelas.js'

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
// 4B. PARCELAMENTOS DO CARTAO (ciclo correto, sem duplicar)
// ============================================================

function normalizarTexto(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Competencia (mes de fechamento) da 1a parcela de um parcelamento.
 * A data da 1a parcela segue a MESMA regra de fechamento das compras:
 * depois do dia de fechamento, entra no ciclo seguinte.
 */
export function competenciaParcelamento(parcelamento, diaFechamento) {
  const inicio = dataLocal(parcelamento?.primeira_parcela)
  if (!inicio) return null
  return competenciaPrimeiraParcela(inicio, diaFechamento)
}

/**
 * Parcelamentos que realmente compoem a fatura do cartao:
 * - apenas os vinculados ao cartao (quando cartaoId informado);
 * - nao quitados;
 * - que nao repetem uma compra ja cadastrada em compras_cartao
 *   (mesmo cartao, descricao, valor total e numero de parcelas).
 */
export function parcelamentosDaFatura(compras, parcelamentos, cartaoId = null) {
  const chaves = new Set(
    (compras || []).map(c =>
      [
        String(c.cartao_id ?? ''),
        normalizarTexto(c.descricao),
        centavos(c.valor_total),
        parcelasValidas(c.numero_parcelas)
      ].join('|')
    )
  )

  return (parcelamentos || []).filter(p => {
    if (!p || p.quitado_em) return false

    if (
      cartaoId &&
      String(p.cartao_id) !== String(cartaoId)
    ) {
      return false
    }

    const chave = [
      String(p.cartao_id ?? ''),
      normalizarTexto(p.descricao),
      centavos(p.valor_total),
      parcelasValidas(p.numero_parcelas)
    ].join('|')

    return !chaves.has(chave)
  })
}

function comprasDoCartao(compras, cartaoId) {
  if (!cartaoId) return compras || []
  return (compras || []).filter(
    c => c.cartao_id == null || String(c.cartao_id) === String(cartaoId)
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
  mes,
  cartaoId = null
) {
  const comprasCartao = comprasDoCartao(compras, cartaoId)

  const deCompras = linhasFaturaNoMes(
    comprasCartao,
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

  const deParcelamentos = parcelamentosDaFatura(
    comprasCartao,
    parcelamentos,
    cartaoId
  )
    .map(p => {
      const inicio = competenciaParcelamento(p, diaFechamento)

      if (!inicio) return null

      const indice =
        chaveNumerica(ano, mes) -
        chaveNumerica(inicio.ano, inicio.mes)

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
  mes,
  cartaoId = null
) {
  const totalCentavos = linhasFaturaCompleta(
    compras,
    parcelamentos,
    diaFechamento,
    ano,
    mes,
    cartaoId
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
    mes,
    cartaoId
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
    mes,
    cartaoId
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
      : 0,
    ...statusDetalhamento(totalManual, comprasDetalhadas, possuiManual)
  }
}

/**
 * Situacao do detalhamento de uma fatura com total informado.
 * - 'sem_total'  : nao ha total informado (nada a comparar)
 * - 'parcial'    : compras detalhadas < total informado
 * - 'completo'   : compras detalhadas == total informado (ao centavo)
 * - 'divergente' : compras detalhadas > total informado (nunca e "100%")
 * percentualDetalhado fica sempre entre 0 e 100.
 */
export function statusDetalhamento(
  totalInformado,
  comprasDetalhadas,
  possuiManual = true
) {
  if (!possuiManual) {
    return { situacaoDetalhamento: 'sem_total', percentualDetalhado: 0 }
  }

  const total = centavos(totalInformado)
  const detalhado = centavos(comprasDetalhadas)

  if (detalhado > total) {
    return { situacaoDetalhamento: 'divergente', percentualDetalhado: 100 }
  }

  if (detalhado === total) {
    return { situacaoDetalhamento: 'completo', percentualDetalhado: 100 }
  }

  return {
    situacaoDetalhamento: 'parcial',
    percentualDetalhado: total > 0
      ? Math.min(99, Math.floor((detalhado / total) * 100))
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

  for (const p of parcelamentosDaFatura(compras, parcelamentos)) {
    const n = parcelasValidas(p.numero_parcelas)
    const inicio = competenciaParcelamento(p, diaFechamento)

    if (!inicio || n <= 1) continue

    const primeira = chaveNumerica(inicio.ano, inicio.mes)

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
 * Soma o saldo em aberto das obrigacoes do cartao
 * (total de cada ciclo menos pagamentos ativos).
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
 * Ajustes feitos fora do aplicativo nao sao
 * considerados.
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
    faturasInformadas = [],
    pagamentos = []
  } = extras

  const parcsDoCartao = cartaoId
    ? parcelamentosDaFatura(compras, parcelamentos, cartaoId)
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
    const inicio = competenciaParcelamento(p, diaFechamento)

    if (!inicio) continue

    const primeiro = chaveNumerica(inicio.ano, inicio.mes)

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

    const totalMes = totalFaturaComOverride(
      compras,
      parcsDoCartao,
      manuaisDoCartao,
      cartaoId,
      diaFechamento,
      ano,
      mes
    )

    // Pagamentos ativos do ciclo liberam o limite na mesma
    // proporcao (parcial libera parcial; total libera tudo).
    totalCentavos += centavos(
      saldoEmAbertoFatura(totalMes, pagamentos, manuaisDoCartao, cartaoId, ano, mes)
    )
  }

  return totalCentavos / 100
}

// ============================================================
// 13. PAGAMENTOS DE FATURA
// ============================================================

/**
 * Pagamentos de um ciclo (cartao + competencia 'YYYY-MM').
 * Estornados ficam no historico, mas nao contam como pagos.
 */
export function pagamentosDoCiclo(
  pagamentos,
  cartaoId,
  ano,
  mes,
  { incluirEstornados = false } = {}
) {
  const chave = anoMesChave(ano, mes)

  return (pagamentos || []).filter(pg =>
    String(pg.cartao_id) === String(cartaoId) &&
    pg.ano_mes === chave &&
    (incluirEstornados || pg.status !== 'estornado')
  )
}

/**
 * Valor ja pago de um ciclo, limitado ao total do ciclo.
 *
 * Compatibilidade: faturas antigas marcadas como pagas (boolean) e
 * sem nenhum registro de pagamento contam como totalmente pagas.
 * Se existir qualquer registro (mesmo estornado), o boolean e ignorado.
 */
export function valorPagoFatura(
  totalCiclo,
  pagamentos,
  faturasInformadas,
  cartaoId,
  ano,
  mes
) {
  const total = centavos(totalCiclo)

  const todos = pagamentosDoCiclo(
    pagamentos, cartaoId, ano, mes, { incluirEstornados: true }
  )

  if (todos.length === 0) {
    const informada = faturaInformadaNoMes(
      faturasInformadas, cartaoId, ano, mes
    )
    return informada?.pago === true ? total / 100 : 0
  }

  const ativos = todos
    .filter(pg => pg.status !== 'estornado')
    .reduce((acc, pg) => acc + centavos(pg.valor), 0)

  return Math.min(total, ativos) / 100
}

/** Saldo em aberto do ciclo: total - pagamentos ativos (nunca negativo). */
export function saldoEmAbertoFatura(
  totalCiclo,
  pagamentos,
  faturasInformadas,
  cartaoId,
  ano,
  mes
) {
  const pago = valorPagoFatura(
    totalCiclo, pagamentos, faturasInformadas, cartaoId, ano, mes
  )

  return Math.max(0, centavos(totalCiclo) - centavos(pago)) / 100
}

function isoData(valor) {
  if (valor instanceof Date) {
    const y = valor.getFullYear()
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(valor || '').slice(0, 10)
}

function dataDoDia(ano, mes, dia) {
  const ultimo = new Date(ano, mes, 0).getDate()
  const d = Math.max(1, Math.min(ultimo, numero(dia, 1)))
  return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Datas de fechamento e vencimento (nominal) de um ciclo.
 * O vencimento cai no mes seguinte ao do fechamento quando o dia de
 * vencimento e menor que o de fechamento (mesma regra usada na
 * projecao e no calendario).
 */
export function datasCiclo(cartao, ano, mes, vencimentoDia = null) {
  const diaFech = numero(cartao?.dia_fechamento, 20)
  const diaVenc = numero(vencimentoDia, 0) || numero(cartao?.dia_vencimento, 1)

  const mesVenc = diaVenc < diaFech
    ? competenciaPorIndice(chaveNumerica(ano, mes) + 1)
    : { ano, mes }

  return {
    fechamento: dataDoDia(ano, mes, diaFech),
    vencimento: dataDoDia(mesVenc.ano, mesVenc.mes, diaVenc)
  }
}

export const STATUS_FATURA = {
  ABERTA: 'Aberta',
  FECHADA: 'Fechada',
  PARCIAL: 'Parcialmente paga',
  PAGA: 'Paga',
  VENCIDA: 'Vencida'
}

/**
 * Status de um ciclo:
 * - Paga: ha pagamento e nada em aberto
 * - Vencida: saldo em aberto depois do vencimento
 * - Parcialmente paga: ha pagamento e ainda resta saldo
 * - Fechada: passou o fechamento, sem pagamento
 * - Aberta: ainda recebendo compras
 */
export function statusFatura({
  total,
  pago,
  fechamento,
  vencimento,
  hoje = new Date()
}) {
  const hojeIso = isoData(hoje)
  const totalC = centavos(total)
  const pagoC = centavos(pago)
  const emAberto = Math.max(0, totalC - pagoC)

  if (totalC > 0 && emAberto === 0) return STATUS_FATURA.PAGA
  if (emAberto > 0 && hojeIso > vencimento) return STATUS_FATURA.VENCIDA
  if (emAberto > 0 && pagoC > 0) return STATUS_FATURA.PARCIAL
  if (hojeIso > fechamento) return STATUS_FATURA.FECHADA

  return STATUS_FATURA.ABERTA
}

/**
 * Visao completa de um ciclo para a tela e para o modal de pagamento.
 *
 * Saldo anterior: saldo em aberto do ciclo imediatamente anterior, apenas
 * informativo (para o usuario saber quanto ainda deve). NAO e somado ao
 * total do ciclo nem a divida: esse valor continua pertencendo ao ciclo
 * anterior ate ser pago, e por isso nunca e contado duas vezes.
 */
export function cicloFatura({
  cartao,
  compras,
  parcelamentos,
  faturasInformadas,
  pagamentos,
  ano,
  mes,
  hoje = new Date()
}) {
  const cartaoId = cartao.id
  const fech = cartao.dia_fechamento

  const resumo = resumoFaturaCartao(
    compras, parcelamentos, faturasInformadas, cartaoId, fech, ano, mes
  )

  const informada = faturaInformadaNoMes(faturasInformadas, cartaoId, ano, mes)
  const datas = datasCiclo(cartao, ano, mes, informada?.vencimento_dia)

  const pago = valorPagoFatura(
    resumo.total, pagamentos, faturasInformadas, cartaoId, ano, mes
  )
  const emAberto = saldoEmAbertoFatura(
    resumo.total, pagamentos, faturasInformadas, cartaoId, ano, mes
  )

  const anterior = competenciaPorIndice(chaveNumerica(ano, mes) - 1)
  const totalAnterior = totalFaturaComOverride(
    compras, parcelamentos, faturasInformadas, cartaoId, fech,
    anterior.ano, anterior.mes
  )
  const saldoAnterior = saldoEmAbertoFatura(
    totalAnterior, pagamentos, faturasInformadas, cartaoId,
    anterior.ano, anterior.mes
  )

  return {
    ano,
    mes,
    ...resumo,
    ...datas,
    pago,
    emAberto,
    saldoAnterior,
    status: statusFatura({
      total: resumo.total,
      pago,
      fechamento: datas.fechamento,
      vencimento: datas.vencimento,
      hoje
    }),
    pagamentos: pagamentosDoCiclo(
      pagamentos, cartaoId, ano, mes, { incluirEstornados: true }
    )
  }
}

/**
 * Valida um pagamento antes de enviar ao servidor.
 * Retorna mensagem de erro ou null.
 */
export function validarPagamento({ valor, emAberto, data, hoje = new Date() }) {
  const v = centavos(valor)

  if (!(v > 0)) return 'Informe um valor maior que zero.'
  if (v > centavos(emAberto)) return 'O valor não pode ser maior que o saldo em aberto da fatura.'
  if (!data) return 'Informe a data do pagamento.'
  if (isoData(data) > isoData(hoje)) return 'A data do pagamento não pode ser futura.'

  return null
}
