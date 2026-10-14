// ─── Simulador de cenários financeiros "E se...?" ─────────────────────────────
// Funções PURAS, sem UI nem banco. Tudo é ESTIMATIVA e TEMPORÁRIO: nada altera
// receitas, despesas, saldos ou registros reais. Os valores de rescisão NÃO
// substituem o cálculo oficial da folha/contador.

const num = (v) => {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}
const round2 = (v) => Math.round((num(v)) * 100) / 100

// ─── Impacto no orçamento (base de todos os cenários) ─────────────────────────
// A partir dos dados REAIS já calculados (receita e despesa mensais, reserva
// acumulada), projeta o saldo mensal e por quantos meses a reserva sustenta as
// despesas. deltaRenda aplica a variação (positiva ou negativa) sobre a receita.
//
//   receitaNova   = max(0, receitaAtual + deltaRenda)
//   saldoMensal   = receitaNova − despesaMensal
//   mesesReserva  = quando saldoMensal < 0 → reserva / |saldoMensal| (senão ∞)
//   gastoDiario   = max(0, saldoMensal) / 30 (referência simples)
export function simularImpactoRenda({
  receitaAtual = 0, despesaMensal = 0, reservaAtual = 0, deltaRenda = 0,
}) {
  const receita = Math.max(0, round2(receitaAtual) + round2(deltaRenda))
  const despesa = Math.max(0, round2(despesaMensal))
  const reserva = Math.max(0, round2(reservaAtual))
  const saldoMensal = round2(receita - despesa)
  const deficitMensal = saldoMensal < 0 ? -saldoMensal : 0

  // Meses que a reserva cobre o DÉFICIT (não a despesa inteira se ainda há renda).
  // Sem déficit → reserva não se esgota (null = "não se esgota pela despesa").
  const mesesReserva = deficitMensal > 0
    ? Math.floor((reserva / deficitMensal) * 100) / 100
    : null

  return {
    receitaNova: receita,
    despesaMensal: despesa,
    reservaAtual: reserva,
    saldoMensal,
    deficitMensal,
    gastoDiario: round2(Math.max(0, saldoMensal) / 30),
    mesesReserva,
  }
}

// Projeta o saldo acumulado por N meses (3/6/12) a partir da reserva atual,
// somando o saldo mensal do cenário mês a mês. Retorna o acumulado ao fim de
// cada horizonte e se/quando o dinheiro acaba. Usado para "orçamento sem salário".
export function projetarHorizontes({
  reservaAtual = 0, saldoMensal = 0, horizontes = [3, 6, 12],
}) {
  const reserva = Math.max(0, round2(reservaAtual))
  const saldo = round2(saldoMensal)
  const resultado = horizontes.map((meses) => ({
    meses,
    // Reserva + (saldo mensal × meses). Saldo negativo consome a reserva.
    acumulado: round2(reserva + saldo * meses),
  }))
  // Mês em que o acumulado fica negativo (dinheiro acaba), se acontecer.
  let mesEsgota = null
  if (saldo < 0) {
    const m = Math.floor(reserva / (-saldo)) + 1
    mesEsgota = m
  }
  return { resultado, mesEsgota }
}

// ─── FGTS: elegibilidade de saque ─────────────────────────────────────────────
// NÃO trata o saldo como dinheiro disponível automaticamente. Regras principais:
//  • Saque-RESCISÃO: liberado na demissão SEM JUSTA CAUSA (saldo integral) e,
//    parcialmente, no ACORDO (até 80% do saldo). Pedido de demissão NÃO saca.
//  • Saque-ANIVERSÁRIO: quem optou por essa modalidade NÃO tem direito ao
//    saque-rescisão integral (só a multa, quando houver) — o saldo fica retido.
// Retorna o valor sacável ESTIMADO e um aviso quando não há saque.
export function elegibilidadeFgts({ saldoFgts = 0, modalidade = 'sem_justa_causa', saqueAniversario = false }) {
  const saldo = Math.max(0, round2(saldoFgts))

  if (saqueAniversario) {
    return {
      podeSacar: false,
      valorSacavel: 0,
      motivo: 'Na modalidade saque-aniversário, o saldo do FGTS não é liberado no desligamento (apenas a multa rescisória, quando houver). O saque segue o calendário do mês de aniversário.',
    }
  }

  if (modalidade === 'pedido_demissao') {
    return {
      podeSacar: false,
      valorSacavel: 0,
      motivo: 'No pedido de demissão não há saque do FGTS nem direito à multa rescisória.',
    }
  }

  if (modalidade === 'acordo') {
    // Acordo (art. 484-A CLT): saque de até 80% do saldo.
    return {
      podeSacar: saldo > 0,
      valorSacavel: round2(saldo * 0.8),
      motivo: 'No acordo, o saque é limitado a 80% do saldo do FGTS.',
    }
  }

  // Sem justa causa: saque integral do saldo.
  return {
    podeSacar: saldo > 0,
    valorSacavel: saldo,
    motivo: saldo > 0 ? 'Demissão sem justa causa permite o saque integral do saldo.' : 'Sem saldo de FGTS informado.',
  }
}

// ─── Multa rescisória do FGTS (paga pelo empregador) ──────────────────────────
//  • Sem justa causa: 40% sobre o saldo do FGTS.
//  • Acordo: 20% sobre o saldo.
//  • Pedido de demissão: 0%.
export function multaFgts({ saldoFgts = 0, modalidade = 'sem_justa_causa' }) {
  const saldo = Math.max(0, round2(saldoFgts))
  const pct = modalidade === 'sem_justa_causa' ? 0.4
    : modalidade === 'acordo' ? 0.2
    : 0
  return round2(saldo * pct)
}

// ─── Seguro-desemprego: elegibilidade simplificada ────────────────────────────
// Direito apenas na demissão SEM JUSTA CAUSA (não no pedido nem no acordo).
// O número de parcelas depende do tempo trabalhado e de solicitações anteriores;
// aqui apenas indicamos elegibilidade — o valor é informado manualmente.
export function elegibilidadeSeguroDesemprego({ modalidade = 'sem_justa_causa' }) {
  if (modalidade === 'sem_justa_causa') {
    return { elegivel: true, motivo: 'Demissão sem justa causa dá direito ao seguro-desemprego (sujeito a carência e parcelas conforme o tempo trabalhado).' }
  }
  return { elegivel: false, motivo: 'Seguro-desemprego não se aplica a pedido de demissão ou acordo.' }
}

// ─── Rescisão: consolida verbas informadas MANUALMENTE ────────────────────────
// Não "inventa" verbas: soma apenas o que o usuário informar (saldo de salário,
// férias + 1/3, 13º proporcional, aviso-prévio, verbas adicionais) e a multa do
// FGTS (derivada da modalidade). Descontos informados são subtraídos. O saque do
// FGTS é tratado SEPARADAMENTE (não entra no "total a receber" da rescisão).
export function resumoRescisao({
  modalidade = 'sem_justa_causa',
  saldoSalario = 0, ferias = 0, decimoTerceiro = 0, avisoPrevio = 0, adicionais = 0,
  descontos = 0, saldoFgts = 0,
}) {
  const verbas = {
    saldoSalario: Math.max(0, round2(saldoSalario)),
    ferias: Math.max(0, round2(ferias)),
    decimoTerceiro: Math.max(0, round2(decimoTerceiro)),
    avisoPrevio: Math.max(0, round2(avisoPrevio)),
    adicionais: Math.max(0, round2(adicionais)),
    multaFgts: multaFgts({ saldoFgts, modalidade }),
  }
  const totalVerbas = round2(
    verbas.saldoSalario + verbas.ferias + verbas.decimoTerceiro +
    verbas.avisoPrevio + verbas.adicionais + verbas.multaFgts
  )
  const totalDescontos = Math.max(0, round2(descontos))
  const liquidoRescisao = round2(totalVerbas - totalDescontos)

  const fgts = elegibilidadeFgts({ saldoFgts, modalidade })
  const seguro = elegibilidadeSeguroDesemprego({ modalidade })

  return {
    modalidade,
    verbas,
    totalVerbas,
    totalDescontos,
    liquidoRescisao: Math.max(0, liquidoRescisao),
    // Separados por elegibilidade (não somados ao líquido automaticamente):
    fgtsSacavel: fgts.valorSacavel,
    fgtsPodeSacar: fgts.podeSacar,
    fgtsMotivo: fgts.motivo,
    seguroElegivel: seguro.elegivel,
    seguroMotivo: seguro.motivo,
    // Dinheiro imediato ESTIMADO = líquido da rescisão + FGTS sacável (quando houver).
    dinheiroImediato: round2(Math.max(0, liquidoRescisao) + fgts.valorSacavel),
  }
}
