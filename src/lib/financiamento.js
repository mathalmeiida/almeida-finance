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

// ─── Custos da compra de imóvel (ITBI, cartório/registro, outros) ─────────────
// Todos OPCIONAIS. O ITBI é calculado automaticamente como:
//     ITBI = base de cálculo × alíquota (%)
// A alíquota varia por município (geralmente de 2% a 3%) e é editável. A base
// de cálculo também é editável: por padrão é o próprio valor do imóvel, mas o
// município pode usar o "valor venal de referência". Cartório (escritura +
// registro) é uma estimativa aproximada e "outros" cobre despesas diversas.
// Retorna o detalhamento e o total dos custos da compra.
export function calcularCustosImovel({
  valorImovel = 0, itbiAliquota = 0, itbiBase = null, cartorio = 0, avaliacao = 0, outros = 0,
}) {
  const num = (v) => Math.max(0, Number(v) || 0)
  const imovel = num(valorImovel)
  // Base de cálculo do ITBI: usa a informada; se vazia/zero, cai no valor do imóvel.
  const base = itbiBase == null || Number(itbiBase) <= 0 ? imovel : num(itbiBase)
  const aliquota = num(itbiAliquota)
  const itbi = base * (aliquota / 100)
  const cart = num(cartorio)
  const aval = num(avaliacao)
  const out = num(outros)
  const total = itbi + cart + aval + out
  return { itbi, itbiBase: base, itbiAliquota: aliquota, cartorio: cart, avaliacao: aval, outros: out, total }
}

// ─── Estimativa de IPVA ───────────────────────────────────────────────────────
// IPVA = valor venal do veículo × alíquota do estado (%). As alíquotas variam
// por UF e por tipo de veículo (automóvel de passeio é a referência mais comum,
// em geral de 2% a 4%). Fornecemos uma tabela base por UF (passeio) apenas como
// ESTIMATIVA — o usuário pode sempre editar o valor manualmente.
export const IPVA_ALIQUOTAS_UF = {
  AC: 2, AL: 3, AP: 3, AM: 3, BA: 2.5, CE: 3, DF: 3.5, ES: 2, GO: 3.75, MA: 2.5,
  MG: 4, MS: 3.5, MT: 3, PA: 2.5, PB: 2.5, PE: 3, PI: 2.5, PR: 3.5, RJ: 4, RN: 3,
  RS: 3, RO: 3, RR: 3, SC: 2, SP: 4, SE: 2.5, TO: 2,
}

// Estima o IPVA anual a partir do valor do veículo e da UF (ou de uma alíquota
// informada diretamente). Retorna { ipva, aliquota } — aliquota em %.
export function estimarIpvaAnual({ valorVeiculo = 0, uf = 'SP', aliquota = null }) {
  const valor = Math.max(0, Number(valorVeiculo) || 0)
  const aliq = aliquota != null && Number(aliquota) > 0
    ? Number(aliquota)
    : (IPVA_ALIQUOTAS_UF[uf] ?? 0)
  return { ipva: valor * (aliq / 100), aliquota: aliq }
}

// Estima o seguro anual como um percentual do valor do veículo. Sem um valor
// informado, usamos ~4% a.a. como referência média de mercado (editável).
export function estimarSeguroAnual({ valorVeiculo = 0, percentual = 4 }) {
  const valor = Math.max(0, Number(valorVeiculo) || 0)
  const pct = Math.max(0, Number(percentual) || 0)
  return valor * (pct / 100)
}

// ─── Custo mensal de uso do veículo (todos os componentes normalizados) ───────
// Converte valores anuais → mensais (÷12) e mantém os já mensais. NÃO inclui a
// parcela do financiamento (ela é somada à parte, no resumo). Cada componente
// aceita um período 'mensal' | 'anual' quando aplicável (seguro e manutenção).
// Retorna o detalhamento mensal e o total mensal de USO (sem a parcela).
export function calcularCustosVeiculoMensais({
  seguroValor = 0, seguroPeriodo = 'anual',
  manutencaoValor = 0, manutencaoPeriodo = 'mensal',
  ipvaAnual = 0, licenciamentoAnual = 0, combustivelMensal = 0, outrosMensal = 0,
}) {
  const num = (v) => Math.max(0, Number(v) || 0)
  const mensalizar = (valor, periodo) => periodo === 'anual' ? num(valor) / 12 : num(valor)
  const seguro = mensalizar(seguroValor, seguroPeriodo)
  const manutencao = mensalizar(manutencaoValor, manutencaoPeriodo)
  const ipva = num(ipvaAnual) / 12
  const licenciamento = num(licenciamentoAnual) / 12
  const combustivel = num(combustivelMensal)
  const outros = num(outrosMensal)
  const total = seguro + manutencao + ipva + licenciamento + combustivel + outros
  return { seguro, manutencao, ipva, licenciamento, combustivel, outros, total }
}

// ─── Custo total do veículo no período do financiamento ───────────────────────
// Consolida, para o prazo (em meses) do financiamento:
//   • parcelaMensal  → parcela do financiamento (já calculada via PRICE)
//   • custosUsoMensal → total mensal de uso (saída de calcularCustosVeiculoMensais)
//   • entrada e jurosTotais vêm do cálculo PRICE
// Retorna os totais mensais e o custo total estimado durante o período.
// NÃO soma novamente nada já contido nos campos de entrada.
export function calcularCustoVeiculoPeriodo({
  prazoMeses = 0, entrada = 0, parcelaMensal = 0, jurosTotais = 0,
  custosUsoMensal = 0, valorVeiculo = 0,
}) {
  const n = Math.max(0, Math.floor(Number(prazoMeses) || 0))
  const num = (v) => Math.max(0, Number(v) || 0)
  const parcela = num(parcelaMensal)
  const uso = num(custosUsoMensal)
  const ent = num(entrada)
  const custoMensalTotal = parcela + uso
  const totalParcelas = parcela * n
  const totalUsoPeriodo = uso * n
  // Custo total no período = entrada + todas as parcelas + custos de uso no período.
  const custoTotalPeriodo = ent + totalParcelas + totalUsoPeriodo
  return {
    prazoMeses: n,
    custoMensalTotal,
    totalParcelas,
    totalUsoPeriodo,
    jurosTotais: num(jurosTotais),
    custoTotalPeriodo,
    valorVeiculo: num(valorVeiculo),
  }
}

// ─── Consórcio (sem juros de financiamento) ───────────────────────────────────
// No consórcio não há juros como no financiamento; o custo vem da taxa de
// administração (percentual total sobre a carta, diluído no prazo), do fundo de
// reserva (opcional, idem) e de um seguro mensal opcional. O lance é apenas
// INFORMATIVO nesta versão: NÃO abate carta, parcela nem saldo (depende das
// regras da administradora).
//
// Cálculo:
//   totalTaxaAdm   = carta × (taxaAdmPercent / 100)
//   totalFundo     = carta × (fundoReservaPercent / 100)
//   baseParcelas   = carta + totalTaxaAdm + totalFundo
//   parcelaBase    = baseParcelas / prazoMeses
//   parcela        = parcelaBase + seguroMensal
//   custoTotal     = parcela × prazoMeses  (= baseParcelas + seguro×prazo)
export function calcularConsorcio({
  carta = 0, prazoMeses = 0, taxaAdmPercent = 0,
  fundoReservaPercent = 0, seguroMensal = 0, lance = 0,
}) {
  const num = (v) => Math.max(0, Number(v) || 0)
  const valorCarta = num(carta)
  const n = Math.max(0, Math.floor(Number(prazoMeses) || 0))
  const totalTaxaAdm = valorCarta * (num(taxaAdmPercent) / 100)
  const totalFundoReserva = valorCarta * (num(fundoReservaPercent) / 100)
  const seguro = num(seguroMensal)

  if (n <= 0 || valorCarta <= 0) {
    return {
      carta: valorCarta, prazoMeses: n,
      totalTaxaAdm, totalFundoReserva,
      parcelaBase: 0, seguroMensal: seguro, parcela: 0,
      custoTotal: 0, custoAdicional: totalTaxaAdm + totalFundoReserva,
      lance: num(lance),
    }
  }

  const baseParcelas = valorCarta + totalTaxaAdm + totalFundoReserva
  const parcelaBase = baseParcelas / n
  const parcela = parcelaBase + seguro
  const custoTotal = parcela * n
  return {
    carta: valorCarta,
    prazoMeses: n,
    totalTaxaAdm,
    totalFundoReserva,
    parcelaBase,
    seguroMensal: seguro,
    parcela,
    custoTotal,
    // Quanto se paga ALÉM da carta (taxas + fundo + seguro no período).
    custoAdicional: totalTaxaAdm + totalFundoReserva + seguro * n,
    lance: num(lance), // apenas informativo
  }
}

// ─── Amortização a partir do SALDO DEVEDOR ATUAL ──────────────────────────────
// Simula uma amortização aplicada AGORA sobre o saldo devedor atual, com as
// parcelas restantes e a taxa mensal do período. Trabalha apenas sobre o
// PRINCIPAL — seguros/encargos não entram aqui (devem ser tratados à parte).
//
// Entrada:
//   sistema  'sac' | 'price'
//   saldo    saldo devedor atual (principal)
//   i        taxa mensal (decimal, ex.: 0,009)
//   n        parcelas restantes
//   extra    valor a amortizar agora
//   modo     'prazo' (mantém a prestação, reduz meses) | 'parcela' (mantém meses, reduz prestação)
//
// Retorna antes/depois de prestação, prazo, juros, meses economizados, economia
// de juros, novo saldo e um flag de quitação total. Clampa saldos negativos e
// evita loops/arredondamentos acumulados.
export function amortizarSaldoDevedor({ sistema, saldo, i, n, extra, modo }) {
  const PV = Math.max(0, Number(saldo) || 0)
  const nn = Math.max(0, Math.floor(Number(n) || 0))
  const taxa = Math.max(0, Number(i) || 0)
  const extraNum = Math.max(0, Number(extra) || 0)
  if (PV <= 0 || nn <= 0) return null

  // Cronograma ANTES (sobre o saldo atual e o prazo restante).
  const antes = sistema === 'sac' ? calcularSac(PV, taxa, nn) : calcularPrice(PV, taxa, nn)
  const prestacaoAntes = sistema === 'sac' ? antes.primeira : antes.parcela

  // Novo saldo após a amortização (nunca negativo).
  const extraAplicado = Math.min(extraNum, PV)
  const novoSaldo = Math.max(0, PV - extraAplicado)
  const quitacaoTotal = novoSaldo <= 0.005

  if (quitacaoTotal) {
    return {
      sistema, modo, extraAplicado,
      saldoAntes: PV, saldoDepois: 0,
      prestacaoAntes, prestacaoDepois: 0,
      prazoAntes: nn, prazoDepois: 0,
      mesesEconomizados: nn,
      jurosAntes: antes.jurosTotais, jurosDepois: 0,
      economiaJuros: antes.jurosTotais,
      quitacaoTotal: true,
    }
  }

  let prestacaoDepois = prestacaoAntes
  let prazoDepois = nn
  let jurosDepois = 0

  if (modo === 'parcela') {
    // Mantém o prazo restante; recalcula a prestação sobre o novo saldo.
    const dep = sistema === 'sac' ? calcularSac(novoSaldo, taxa, nn) : calcularPrice(novoSaldo, taxa, nn)
    prestacaoDepois = sistema === 'sac' ? dep.primeira : dep.parcela
    jurosDepois = dep.jurosTotais
    prazoDepois = nn
  } else {
    // modo 'prazo': mantém a prestação atual; reduz o número de meses.
    if (sistema === 'sac') {
      // SAC: amortização mensal constante = PV/nn (mantida). Novo prazo em
      // número de amortizações necessárias para zerar o novo saldo.
      const amort = PV / nn
      let s = novoSaldo
      let meses = 0
      let juros = 0
      while (s > 0.005 && meses < nn * 2) {
        juros += s * taxa
        s = Math.max(0, s - amort)
        meses++
      }
      prazoDepois = meses
      jurosDepois = juros
      prestacaoDepois = amort + novoSaldo * taxa // 1ª prestação após amortizar (referência)
    } else {
      // PRICE: mantém a prestação original; amortiza o novo saldo com ela.
      const pmt = prestacaoAntes
      let s = novoSaldo
      let meses = 0
      let juros = 0
      while (s > 0.005 && meses < nn * 2) {
        const j = s * taxa
        const amort = pmt - j
        if (amort <= 0) break // prestação não cobre juros: evita loop
        juros += j
        s = Math.max(0, s - amort)
        meses++
      }
      prazoDepois = meses
      jurosDepois = juros
      prestacaoDepois = pmt
    }
  }

  return {
    sistema, modo, extraAplicado,
    saldoAntes: PV, saldoDepois: novoSaldo,
    prestacaoAntes, prestacaoDepois,
    prazoAntes: nn, prazoDepois,
    mesesEconomizados: Math.max(0, nn - prazoDepois),
    jurosAntes: antes.jurosTotais, jurosDepois,
    economiaJuros: Math.max(0, antes.jurosTotais - jurosDepois),
    quitacaoTotal: false,
  }
}
