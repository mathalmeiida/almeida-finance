// ─── Cálculos de financiamento imobiliário (SAC e PRICE) ──────────────────────
// Funções PURAS, sem dependência de UI nem de banco. Usadas apenas para
// SIMULAÇÃO — não alteram nenhum dado real do app.
//
// Convenção de taxa: o usuário informa a taxa ANUAL (% a.a.). Convertemos para
// a taxa MENSAL equivalente por juros compostos (padrão de mercado para
// financiamento imobiliário):
//     i_mensal = (1 + i_anual) ^ (1/12) − 1
// A simulação exibe essa taxa mensal para deixar claro o que foi usado.

// Converte taxa anual (ex.: 11.5 = 11,5% a.a.) em taxa mensal equivalente (decimal).
export function taxaAnualParaMensal(taxaAnualPercent) {
  const iAnual = (Number(taxaAnualPercent) || 0) / 100
  if (iAnual <= 0) return 0
  return Math.pow(1 + iAnual, 1 / 12) - 1
}

// Normaliza o prazo informado (anos ou meses) em número de parcelas (meses).
export function prazoEmMeses(valor, unidade) {
  const v = Math.max(0, Math.floor(Number(valor) || 0))
  return unidade === 'anos' ? v * 12 : v
}

// ─── PRICE (parcelas fixas) ───────────────────────────────────────────────────
// Prestação constante:
//   PMT = PV · i / (1 − (1 + i)^(−n))
// Com i = 0, cai para PV/n (sem juros).
export function calcularPrice(valorFinanciado, i, n) {
  const PV = Number(valorFinanciado) || 0
  const nn = Math.max(0, Math.floor(n))
  if (PV <= 0 || nn <= 0) {
    return { tipo: 'price', parcela: 0, jurosTotais: 0, totalPago: 0, taxaMensal: i, n: nn }
  }
  let parcela
  if (i <= 0) {
    parcela = PV / nn
  } else {
    parcela = (PV * i) / (1 - Math.pow(1 + i, -nn))
  }
  const totalPago = parcela * nn
  const jurosTotais = totalPago - PV
  return {
    tipo: 'price',
    parcela,
    jurosTotais,
    totalPago,
    taxaMensal: i,
    n: nn,
  }
}

// ─── SAC (amortização constante) ──────────────────────────────────────────────
// Amortização fixa = PV/n; juros do mês = saldo devedor · i; parcela decresce.
//   parcela_k = amortizacao + saldo_{k-1} · i
// Retorna primeira, última, uma intermediária (meio do prazo), juros e total,
// mais a lista completa de parcelas (para "amortizar" e detalhes, se preciso).
export function calcularSac(valorFinanciado, i, n) {
  const PV = Number(valorFinanciado) || 0
  const nn = Math.max(0, Math.floor(n))
  if (PV <= 0 || nn <= 0) {
    return {
      tipo: 'sac', amortizacao: 0, primeira: 0, intermediaria: 0, ultima: 0,
      jurosTotais: 0, totalPago: 0, taxaMensal: i, n: nn, parcelas: [],
    }
  }
  const amortizacao = PV / nn
  let saldo = PV
  let jurosTotais = 0
  let totalPago = 0
  const parcelas = []
  for (let k = 1; k <= nn; k++) {
    const juros = saldo * i
    const parcela = amortizacao + juros
    jurosTotais += juros
    totalPago += parcela
    saldo = Math.max(0, saldo - amortizacao)
    parcelas.push({ k, parcela, juros, amortizacao, saldo })
  }
  const idxMeio = Math.min(nn - 1, Math.floor(nn / 2))
  return {
    tipo: 'sac',
    amortizacao,
    primeira: parcelas[0].parcela,
    intermediaria: parcelas[idxMeio].parcela,
    ultima: parcelas[nn - 1].parcela,
    jurosTotais,
    totalPago,
    taxaMensal: i,
    n: nn,
    parcelas,
  }
}

// ─── Entrada / valor financiado ───────────────────────────────────────────────
// Soma os componentes da entrada e deriva o valor financiado, com limites.
export function calcularEntrada({ valorImovel, recursosProprios = 0, reservaUsada = 0, fgts = 0 }) {
  const imovel = Number(valorImovel) || 0
  const proprios = Math.max(0, Number(recursosProprios) || 0)
  const reserva = Math.max(0, Number(reservaUsada) || 0)
  const fg = Math.max(0, Number(fgts) || 0)
  const entradaTotal = proprios + reserva + fg
  const valorFinanciado = Math.max(0, imovel - entradaTotal)
  return {
    imovel,
    recursosProprios: proprios,
    reservaUsada: reserva,
    fgts: fg,
    entradaTotal,
    valorFinanciado,
    entradaExcedeImovel: entradaTotal > imovel && imovel > 0,
  }
}

// ─── "E se eu amortizar?" ─────────────────────────────────────────────────────
// Aplica uma amortização extra em um dado mês e recalcula o restante.
// modo = 'prazo' (reduz nº de parcelas, mantém o valor da parcela/padrão) ou
//        'parcela' (mantém o prazo, reduz o valor das parcelas).
// Funciona para PRICE e SAC. Retorna um resumo do impacto estimado.
export function simularAmortizacao({ sistema, valorFinanciado, i, n, extra, mesAmortizacao, modo }) {
  const PV = Number(valorFinanciado) || 0
  const nn = Math.max(0, Math.floor(n))
  const extraNum = Math.max(0, Number(extra) || 0)
  const mesAmort = Math.min(Math.max(1, Math.floor(Number(mesAmortizacao) || 1)), nn)
  if (PV <= 0 || nn <= 0 || extraNum <= 0) return null

  // Base original (para comparar juros).
  const base = sistema === 'sac' ? calcularSac(PV, i, nn) : calcularPrice(PV, i, nn)

  // Simula mês a mês até o mês da amortização, aplica o extra e segue.
  let saldo = PV
  let jurosTotais = 0
  let totalPago = 0
  let parcelasPagas = 0

  const amortizacaoSacBase = PV / nn
  const parcelaPriceBase = sistema === 'price'
    ? (i <= 0 ? PV / nn : (PV * i) / (1 - Math.pow(1 + i, -nn)))
    : 0

  // Fase 1: do mês 1 até mesAmort (inclusive), com as condições originais.
  for (let k = 1; k <= mesAmort && saldo > 0.005; k++) {
    const juros = saldo * i
    let amort
    if (sistema === 'sac') amort = amortizacaoSacBase
    else amort = parcelaPriceBase - juros
    const parcela = amort + juros
    jurosTotais += juros
    totalPago += parcela
    saldo = Math.max(0, saldo - amort)
    parcelasPagas++
  }
  // Aplica a amortização extra no saldo.
  saldo = Math.max(0, saldo - extraNum)
  totalPago += extraNum

  const parcelasRestantesOriginais = nn - mesAmort
  let novoPrazoTotal = parcelasPagas
  let novaParcela = null

  if (saldo > 0.005 && parcelasRestantesOriginais > 0) {
    if (modo === 'parcela') {
      // Mantém o prazo restante; recalcula a parcela sobre o novo saldo.
      const nRest = parcelasRestantesOriginais
      if (sistema === 'sac') {
        const amort = saldo / nRest
        // SAC: nova 1ª parcela após amortizar (referência de redução).
        novaParcela = amort + saldo * i
        for (let k = 1; k <= nRest; k++) {
          const juros = saldo * i
          const parcela = amort + juros
          jurosTotais += juros
          totalPago += parcela
          saldo = Math.max(0, saldo - amort)
          parcelasPagas++
        }
      } else {
        const pmt = i <= 0 ? saldo / nRest : (saldo * i) / (1 - Math.pow(1 + i, -nRest))
        novaParcela = pmt
        for (let k = 1; k <= nRest && saldo > 0.005; k++) {
          const juros = saldo * i
          const amort = pmt - juros
          jurosTotais += juros
          totalPago += pmt
          saldo = Math.max(0, saldo - amort)
          parcelasPagas++
        }
      }
      novoPrazoTotal = parcelasPagas
    } else {
      // modo 'prazo': mantém a parcela padrão; reduz o número de meses.
      if (sistema === 'sac') {
        const amort = amortizacaoSacBase
        while (saldo > 0.005 && parcelasPagas < nn * 3) {
          const juros = saldo * i
          const parcela = amort + juros
          jurosTotais += juros
          totalPago += parcela
          saldo = Math.max(0, saldo - amort)
          parcelasPagas++
        }
      } else {
        const pmt = parcelaPriceBase
        while (saldo > 0.005 && parcelasPagas < nn * 3) {
          const juros = saldo * i
          const amort = pmt - juros
          if (amort <= 0) break // parcela não cobre juros (taxa alta): evita loop
          jurosTotais += juros
          totalPago += Math.min(pmt, saldo + juros)
          saldo = Math.max(0, saldo - amort)
          parcelasPagas++
        }
      }
      novoPrazoTotal = parcelasPagas
    }
  }

  return {
    sistema,
    modo,
    extra: extraNum,
    mesAmortizacao: mesAmort,
    jurosTotaisOriginais: base.jurosTotais,
    jurosTotaisNovo: jurosTotais,
    economiaJuros: Math.max(0, base.jurosTotais - jurosTotais),
    prazoOriginal: nn,
    novoPrazo: novoPrazoTotal,
    mesesReduzidos: Math.max(0, nn - novoPrazoTotal),
    novaParcela, // só no modo 'parcela'
  }
}

// Percentual da renda comprometido pela parcela (0..∞). Renda 0 → null.
export function comprometimentoRenda(parcela, renda) {
  const r = Number(renda) || 0
  if (r <= 0) return null
  return (Number(parcela) || 0) / r * 100
}
