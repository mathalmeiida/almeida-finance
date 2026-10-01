import { useMemo } from 'react'
import { useReceitas } from './useReceitas'
import { useDespesas } from './useDespesas'
import { useParcelamentos } from './useParcelamentos'
import { labelMes } from '../lib/utils'

/**
 * Hook central de projeção financeira.
 * Gera os dados dos próximos 12 meses a partir dos dados reais do usuário.
 *
 * Lógica por mês:
 *   receitas  = receitas recorrentes + receitas não-recorrentes do mês atual (se for o mês atual)
 *   despesas  = despesas recorrentes + despesas não-recorrentes do mês atual (se for o mês atual)
 *   parcelas  = soma das parcelas ainda ativas naquele mês
 *   saldo     = receitas - despesas - parcelas
 */
export function useProjecao() {
  // Busca dados do mês atual (para não-recorrentes)
  const mesAtual = new Date().getMonth() + 1
  const anoAtual = new Date().getFullYear()

  const { receitas, carregando: carregandoR } = useReceitas(mesAtual, anoAtual)
  const { despesas, carregando: carregandoD, criar: criarDespesa, recarregar: recarregarDespesas } = useDespesas(mesAtual, anoAtual)
  const { parcelamentos, carregando: carregandoP } = useParcelamentos()

  const carregando = carregandoR || carregandoD || carregandoP

  // Totais do mês corrente (para o Dashboard)
  const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor), 0)
  const totalDespesas = despesas.reduce((acc, r) => acc + Number(r.valor), 0)
  const totalParcelas = parcelamentos
    .filter(p => p.ativo)
    .reduce((acc, p) => acc + Number(p.valor_parcela), 0)
  const sobraMes = totalReceitas - totalDespesas - totalParcelas

  // Totais por tipo de despesa (fixa / variavel)
  const totalDespesasFixas = despesas
    .filter(d => d.tipo_despesa === 'fixa')
    .reduce((acc, d) => acc + Number(d.valor), 0)
  const totalDespesasVariaveis = despesas
    .filter(d => d.tipo_despesa !== 'fixa')
    .reduce((acc, d) => acc + Number(d.valor), 0)
  const percentualRendaFixa = totalReceitas > 0
    ? Math.round((totalDespesasFixas / totalReceitas) * 100)
    : 0

  // Base mensal de receitas recorrentes
  const receitasRecorrentes = receitas
    .filter(r => r.recorrente)
    .reduce((acc, r) => acc + Number(r.valor), 0)

  // Base mensal de despesas recorrentes
  const despesasRecorrentes = despesas
    .filter(d => d.recorrente)
    .reduce((acc, d) => acc + Number(d.valor), 0)

  // Projeção dos próximos 12 meses
  const projecao = useMemo(() => {
    if (carregando) return []

    const meses = []
    const hoje = new Date()

    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const ano = data.getFullYear()
      const mes = data.getMonth() + 1
      const ehMesAtual = i === 0

      // Receitas: recorrentes sempre + não-recorrentes só no mês atual
      const receitasMes = ehMesAtual
        ? totalReceitas
        : receitasRecorrentes

      // Despesas fixas: recorrentes sempre + não-recorrentes só no mês atual
      const despesasFixas = ehMesAtual
        ? totalDespesas
        : despesasRecorrentes

      // Parcelas ativas neste mês específico (ignora quitados antecipadamente)
      const parcelasMes = parcelamentos
        .filter(p => !p.quitado_em)
        .reduce((acc, p) => {
          const inicio = new Date(p.primeira_parcela + 'T12:00:00')
          const fimParcela = new Date(
            inicio.getFullYear(),
            inicio.getMonth() + p.numero_parcelas - 1,
            1
          )
          const dentroDoRange = data >= inicio && data <= fimParcela
          return dentroDoRange ? acc + Number(p.valor_parcela) : acc
        }, 0)

      const despesasTotais = despesasFixas + parcelasMes
      const saldo = receitasMes - despesasTotais

      meses.push({
        mes: labelMes(data),
        ano,
        mesNum: mes,
        receitas: receitasMes,
        despesas: despesasTotais,
        parcelas: parcelasMes,
        saldo,
        ehMesAtual,
      })
    }

    return meses
  }, [carregando, totalReceitas, totalDespesas, totalParcelas,
      receitasRecorrentes, despesasRecorrentes, parcelamentos])

  return {
    carregando,
    projecao,
    // resumo do mês atual
    resumoMes: {
      receitaTotal: totalReceitas,
      despesaTotal: totalDespesas,
      parcelasTotal: totalParcelas,
      sobraPrevista: sobraMes,
      qtdReceitas: receitas.length,
      qtdDespesas: despesas.length,
      qtdParcelamentos: parcelamentos.filter(p => p.ativo).length,
      // totais por tipo de despesa
      totalDespesasFixas,
      totalDespesasVariaveis,
      percentualRendaFixa,
    },
    // dados brutos para o simulador
    receitas,
    despesas,
    parcelamentos,
    // mês/ano de referência
    mesAtual,
    anoAtual,
    // ações reaproveitáveis (ex: gasto rápido no Dashboard)
    criarDespesa,
    recarregarDespesas,
  }
}
