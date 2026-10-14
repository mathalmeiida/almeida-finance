
const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const round2 = v =>
  Math.round((num(v) + Number.EPSILON) * 100) / 100

const positivo = v => Math.max(0, round2(v))

export function simularImpactoRenda({
  receitaAtual = 0,
  despesaMensal = 0,
  reservaAtual = 0,
  deltaRenda = 0,
}) {
  const receita = positivo(num(receitaAtual) + num(deltaRenda))
  const despesa = positivo(despesaMensal)
  const reserva = positivo(reservaAtual)
  const saldoMensal = round2(receita - despesa)
  const deficitMensal = Math.max(0, -saldoMensal)

  return {
    receitaNova: receita,
    despesaMensal: despesa,
    reservaAtual: reserva,
    saldoMensal,
    deficitMensal,
    gastoDiario: round2(Math.max(0, saldoMensal) / 30),
    mesesReserva: deficitMensal > 0
      ? Math.floor((reserva / deficitMensal) * 100) / 100
      : null,
  }
}

// Projecao com valores mensais constantes.
// Nao inclui juros, inflacao ou pagamentos extraordinarios.
export function projetarHorizontes({
  reservaAtual = 0,
  saldoMensal = 0,
  horizontes = [3, 6, 12],
}) {
  const reserva = positivo(reservaAtual)
  const saldo = round2(saldoMensal)

  const resultado = horizontes.map(meses => ({
    meses,
    acumulado: round2(reserva + saldo * meses),
  }))

  const mesEsgota = saldo < 0
    ? Math.floor(reserva / -saldo) + 1
    : null

  return { resultado, mesEsgota }
}

export function elegibilidadeFgts({
  saldoFgts = 0,
  modalidade = 'sem_justa_causa',
  saqueAniversario = false,
}) {
  const saldo = positivo(saldoFgts)

  if (modalidade === 'pedido_demissao') {
    return {
      podeSacar: false,
      valorSacavel: 0,
      motivo: 'Pedido de demissao nao libera o saque-rescisao.',
    }
  }

  if (saqueAniversario) {
    return {
      podeSacar: false,
      valorSacavel: 0,
      motivo: 'Saque-aniversario: o saldo normalmente nao e liberado no desligamento. A multa, quando devida, e tratada separadamente.',
    }
  }

  if (modalidade === 'acordo') {
    return {
      podeSacar: saldo > 0,
      valorSacavel: round2(saldo * 0.8),
      motivo: 'Acordo: pode haver saque de ate 80% do saldo elegivel.',
    }
  }

  if (modalidade === 'sem_justa_causa') {
    return {
      podeSacar: saldo > 0,
      valorSacavel: saldo,
      motivo: 'Saque-rescisao estimado, sujeito as regras aplicaveis.',
    }
  }

  return {
    podeSacar: false,
    valorSacavel: 0,
    motivo: 'Modalidade nao reconhecida.',
  }
}

// A base oficial da multa pode diferir do saldo informado.
export function multaFgts({
  saldoFgts = 0,
  modalidade = 'sem_justa_causa',
}) {
  const aliquota =
    modalidade === 'sem_justa_causa' ? 0.4 :
    modalidade === 'acordo' ? 0.2 : 0

  return round2(positivo(saldoFgts) * aliquota)
}

export function elegibilidadeSeguroDesemprego({
  modalidade = 'sem_justa_causa',
}) {
  return modalidade === 'sem_justa_causa'
    ? {
        elegivel: true,
        motivo: 'Possivel direito ao seguro-desemprego, sujeito aos requisitos legais.',
      }
    : {
        elegivel: false,
        motivo: 'Pedido de demissao e acordo normalmente nao permitem seguro-desemprego.',
      }
}

export function resumoRescisao({
  modalidade = 'sem_justa_causa',
  saldoSalario = 0,
  ferias = 0,
  decimoTerceiro = 0,
  avisoPrevio = 0,
  adicionais = 0,
  descontos = 0,
  saldoFgts = 0,
  saqueAniversario = false,
}) {
  const verbas = {
    saldoSalario: positivo(saldoSalario),
    ferias: positivo(ferias),
    decimoTerceiro: positivo(decimoTerceiro),
    avisoPrevio: positivo(avisoPrevio),
    adicionais: positivo(adicionais),
    multaFgts: multaFgts({ saldoFgts, modalidade }),
  }

  const verbasTrabalhistas = round2(
    verbas.saldoSalario +
    verbas.ferias +
    verbas.decimoTerceiro +
    verbas.avisoPrevio +
    verbas.adicionais
  )

  const totalVerbas = round2(
    verbasTrabalhistas + verbas.multaFgts
  )

  const totalDescontos = positivo(descontos)

  const liquidoRescisao = Math.max(
    0,
    round2(totalVerbas - totalDescontos)
  )

  const fgts = elegibilidadeFgts({
    saldoFgts,
    modalidade,
    saqueAniversario,
  })

  const seguro = elegibilidadeSeguroDesemprego({
    modalidade,
  })

  const totalPotencial = round2(
    liquidoRescisao + fgts.valorSacavel
  )

  return {
    modalidade,
    verbas,
    verbasTrabalhistas,
    totalVerbas,
    totalDescontos,
    liquidoRescisao,
    multaEstimada: verbas.multaFgts,
    fgtsSacavel: fgts.valorSacavel,
    fgtsPodeSacar: fgts.podeSacar,
    fgtsMotivo: fgts.motivo,
    seguroElegivel: seguro.elegivel,
    seguroMotivo: seguro.motivo,
    dinheiroImediato: totalPotencial,
    totalPotencial,
  }
}
