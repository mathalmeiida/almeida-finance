// ─── Horizonte financeiro: fluxo de caixa DIÁRIO projetado ────────────────────
// Função PURA (sem UI, sem banco). Transforma os dados já existentes do app
// (receitas, despesas, parcelamentos, faturas de cartão) em um fluxo de caixa
// dia a dia para os próximos N meses, APENAS para visualização.
//
// NÃO altera nenhum cálculo de orçamento. Reaproveita as mesmas fontes:
//   - receitas/despesas: campo `data` (dia real) + recorrência (dia da 1ª ocorrência)
//   - parcelamentos: dia da `primeira_parcela`
//   - faturas de cartão: dia de vencimento (fatura informada tem prioridade)
//
// Definições (para não inventar regra):
//   • A RESERVA de emergência é percentual mensal, sem dia natural → NÃO entra
//     no saldo diário; aparece só no resumo do mês (patrimônio reservado).
//   • Saldo inicial do 1º mês = saldo disponível hoje; o saldo final de um mês
//     encadeia como inicial do próximo (fluxo de caixa contínuo).
//   • Recorrências semanais/diárias: o total do mês é lançado no dia 1 (a
//     posição exata no dia é aproximada; o VALOR do mês permanece exato).

import { valorDespesaRecorrenteNoMes, frequenciaDaDespesa } from '../hooks/useDespesas'
import { valorParcelaNoMes } from '../hooks/useParcelamentos'
import { linhasFaturaCompleta } from './faturaCartao'
import { faturaInformadaNoMes } from './faturaCartao'
import { labelMes, partesHojeBrasil } from './utils'
import { vencimentoEfetivo } from './calendarioBancario'

const ultimoDiaDoMes = (ano, mes) => new Date(ano, mes, 0).getDate()
const diaDe = (dataISO) => parseInt(String(dataISO).slice(8, 10), 10) || 1
const mesDe = (dataISO) => parseInt(String(dataISO).slice(5, 7), 10)
const anoDe = (dataISO) => parseInt(String(dataISO).slice(0, 4), 10)
const clampDia = (dia, ano, mes) => Math.min(Math.max(1, dia), ultimoDiaDoMes(ano, mes))

/**
 * Gera o horizonte financeiro.
 * @returns Array de meses: {
 *   ano, mes, label, ehMesAtual,
 *   saldoInicial, entradas, saidas, reserva, saldoFinal,
 *   dias: [{ dia, ehHoje, entradas, saidas, saldo }]
 * }
 */
export function gerarHorizonte({
  receitas = [], despesas = [], recorrentes = [],
  parcelamentos = [], cartoes = [], comprasCartao = [], faturasInformadas = [],
  saldoInicial = 0, reservaPct = 20, meses = 12,
}) {
  // "Hoje" no fuso de Brasília, consistente com as datas gravadas (que agora
  // também usam Brasília). Evita o descasamento UTC×local no "diaHoje"/mês.
  const { ano: anoHoje, mes: mesHoje, dia: diaHoje } = partesHojeBrasil()

  const resultado = []
  let saldoAnterior = Number(saldoInicial) || 0

  for (let i = 0; i < meses; i++) {
    const ref = new Date(anoHoje, (mesHoje - 1) + i, 1)
    const ano = ref.getFullYear()
    const mes = ref.getMonth() + 1
    const ehMesAtual = i === 0
    const totalDias = ultimoDiaDoMes(ano, mes)

    // Mapa dia → { entradas, saidas } de eventos reais daquele mês.
    const porDia = Array.from({ length: totalDias + 1 }, () => ({ entradas: 0, saidas: 0 }))
    const addEntrada = (dia, v) => { porDia[clampDia(dia, ano, mes)].entradas += v }
    const addSaida = (dia, v) => { porDia[clampDia(dia, ano, mes)].saidas += v }

    // ── RECEITAS ──
    // No mês atual: receitas não-recorrentes do mês (data no mês) + recorrentes.
    // Meses futuros: só recorrentes (mesmo critério do useProjecao).
    for (const r of receitas) {
      const valor = Number(r.valor) || 0
      if (valor <= 0) continue
      if (r.recorrente) {
        // recorrente mensal: cai no mesmo dia da data de início, todo mês (a
        // partir do mês de início).
        const inicioAno = anoDe(r.data), inicioMes = mesDe(r.data)
        const comecou = ano > inicioAno || (ano === inicioAno && mes >= inicioMes)
        if (comecou) addEntrada(diaDe(r.data), valor)
      } else if (ehMesAtual && mesDe(r.data) === mes && anoDe(r.data) === ano) {
        addEntrada(diaDe(r.data), valor)
      }
    }

    // ── DESPESAS ──
    // Pontuais (não-recorrentes) só no mês atual, no dia da data.
    if (ehMesAtual) {
      for (const d of despesas) {
        if (d.recorrente) continue
        const valor = Number(d.valor) || 0
        if (valor <= 0) continue
        if (mesDe(d.data) === mes && anoDe(d.data) === ano) addSaida(diaDe(d.data), valor)
      }
    }
    // Recorrentes: usa a mesma função do orçamento para o VALOR do mês; o dia é
    // o da data de início (mensal/por_meses). Semanal/diária → dia 1 (aproxima
    // posição, mantém valor exato do mês).
    for (const d of recorrentes) {
      const valorMes = valorDespesaRecorrenteNoMes(d, ano, mes)
      if (valorMes <= 0) continue
      const freq = frequenciaDaDespesa(d)
      const dia = (freq === 'mensal' || freq === 'por_meses') ? diaDe(d.data) : 1
      addSaida(dia, valorMes)
    }

    // ── PARCELAS AVULSAS (sem cartão) ──
    for (const p of parcelamentos) {
      if (p.cartao_id) continue // as de cartão entram via fatura
      const valor = valorParcelaNoMes(p, ano, mes)
      if (valor <= 0) continue
      addSaida(diaDe(p.primeira_parcela), valor)
    }

    // ── FATURAS DE CARTÃO ──
    // A fatura é lançada no FLUXO DE CAIXA no mês/dia em que REALMENTE VENCE
    // (quando o dinheiro sai), não no mês de competência (fechamento).
    // Regra: se o dia de vencimento for ANTERIOR ao dia de fechamento, a fatura
    // fechada neste mês só vence no mês SEGUINTE (ex.: fecha 20, vence 01 → a
    // fatura de outubro vence em 01/novembro). Então, para o mês atual do fluxo
    // (ano,mes), a fatura que vence aqui é a da competência:
    //   • mesma (ano,mes)         se dia_vencimento >= dia_fechamento;
    //   • mês ANTERIOR (compVenc) se dia_vencimento <  dia_fechamento.
    // Fatura informada tem prioridade (substitui a soma das compras).
    for (const c of cartoes) {
      const comprasDoCartao = comprasCartao.filter(cp => cp.cartao_id === c.id)
      const parcelamentosDoCartao = parcelamentos.filter(p => p.cartao_id === c.id)
      const diaFech = Number(c.dia_fechamento) || 1
      const diaVenc = Number(c.dia_vencimento) || 1
      // Competência cuja fatura vence NESTE mês do fluxo.
      let compAno = ano, compMes = mes
      if (diaVenc < diaFech) {
        // vence no mês seguinte ao fechamento → a que vence agora fechou no mês anterior
        compMes = mes - 1
        if (compMes < 1) { compMes = 12; compAno = ano - 1 }
      }
      const informada = faturaInformadaNoMes(faturasInformadas, c.id, compAno, compMes)
      let totalCartao
      if (informada) {
        totalCartao = Number(informada.valor_total) || 0
      } else {
        totalCartao = linhasFaturaCompleta(comprasDoCartao, parcelamentosDoCartao, c.dia_fechamento, compAno, compMes)
          .reduce((a, l) => a + l.valor, 0)
      }
      // Vencimento informado (se houver) tem prioridade sobre o dia do cartão.
      const diaVencNominal = (informada && informada.vencimento_dia) ? informada.vencimento_dia : diaVenc
      // Calendário bancário: se o vencimento cair em fim de semana/feriado
      // nacional, PRORROGA para o próximo dia útil. Mantém o lançamento DENTRO
      // do mês do fluxo (se a prorrogação ultrapassar o mês, usa o próximo dia
      // útil mesmo assim — o total do mês não se altera, só a posição do dia).
      const vef = vencimentoEfetivo(ano, mes, diaVencNominal)
      const diaVencEfetivo = (vef.ano === ano && vef.mes === mes) ? vef.dia : totalDias
      if (totalCartao > 0) addSaida(diaVencEfetivo, totalCartao)
    }

    // ── Monta a lista de dias com saldo acumulado ──
    let entradasMes = 0, saidasMes = 0
    let saldo = saldoAnterior
    const dias = []
    for (let dia = 1; dia <= totalDias; dia++) {
      const ev = porDia[dia]
      saldo += ev.entradas - ev.saidas
      entradasMes += ev.entradas
      saidasMes += ev.saidas
      dias.push({
        dia,
        entradas: ev.entradas,
        saidas: ev.saidas,
        saldo,
        temEvento: ev.entradas > 0 || ev.saidas > 0,
        ehHoje: ehMesAtual && dia === diaHoje,
      })
    }

    // Reserva prevista do mês (informativa, não entra no saldo diário).
    const reserva = entradasMes > 0 ? entradasMes * (reservaPct / 100) : 0
    const saldoFinal = saldo

    resultado.push({
      ano, mes,
      label: labelMes(new Date(ano, mes - 1, 1)),
      ehMesAtual,
      saldoInicial: saldoAnterior,
      entradas: entradasMes,
      saidas: saidasMes,
      reserva,
      saldoFinal,
      dias,
    })

    // Encadeia: saldo final vira inicial do próximo mês.
    saldoAnterior = saldoFinal
  }

  return resultado
}
