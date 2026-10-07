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
import { labelMes } from './utils'

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
  const hoje = new Date()
  const anoHoje = hoje.getFullYear()
  const mesHoje = hoje.getMonth() + 1
  const diaHoje = hoje.getDate()

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
    // Total do cartão no mês cai no dia de VENCIMENTO. Fatura informada tem
    // prioridade (substitui a soma das compras) — mesma regra do orçamento.
    for (const c of cartoes) {
      const comprasDoCartao = comprasCartao.filter(cp => cp.cartao_id === c.id)
      const parcelamentosDoCartao = parcelamentos.filter(p => p.cartao_id === c.id)
      const informada = faturaInformadaNoMes(faturasInformadas, c.id, ano, mes)
      let totalCartao, diaVenc
      if (informada) {
        totalCartao = Number(informada.valor_total) || 0
        diaVenc = informada.vencimento_dia || c.dia_vencimento || 1
      } else {
        totalCartao = linhasFaturaCompleta(comprasDoCartao, parcelamentosDoCartao, c.dia_fechamento, ano, mes)
          .reduce((a, l) => a + l.valor, 0)
        diaVenc = c.dia_vencimento || 1
      }
      if (totalCartao > 0) addSaida(diaVenc, totalCartao)
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
