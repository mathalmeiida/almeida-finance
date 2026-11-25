import { useMemo } from 'react'
import { useProjecao } from './useProjecao'
import { useReceitas } from './useReceitas'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useParcelamentos } from './useParcelamentos'

/**
 * Hook auxiliar: Análise abrangente para Posso Comprar
 * Integrado ao simulador existente
 */
export function useAnaliseCompra(valorCompra, opcaoPagamento = 'avista', numeroParcelas = 1) {
  const { projecao, resumoMes } = useProjecao()
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()
  const { cartoes } = useCartoes()
  const { parcelamentos } = useParcelamentos()

  return useMemo(() => {
    if (!valorCompra || valorCompra <= 0) return null

    const valor = Number(valorCompra)
    const hoje = new Date()
    const data30Dias = new Date(hoje)
    data30Dias.setDate(hoje.getDate() + 30)

    const saldoAtual = resumoMes.saldoAtual || 0
    const reservaAtual = resumoMes.reservaAtual || 0

    const receitasFuturas = receitas
      .filter(r => {
        if (!r.data_recebimento) return false
        const dataRec = new Date(r.data_recebimento + 'T12:00:00')
        return dataRec >= hoje && dataRec <= data30Dias
      })
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)

    const despesasPrevistas = despesas
      .filter(d => {
        if (d.pago || !d.data_vencimento) return false
        const dataVenc = new Date(d.data_vencimento + 'T12:00:00')
        return dataVenc >= hoje && dataVenc <= data30Dias
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    const faturasPendentes = cartoes
      .filter(c => c.fatura_atual > 0)
      .reduce((acc, c) => acc + (Number(c.fatura_atual) || 0), 0)

    const parcelasMensais = parcelamentos
      .filter(p => !p.quitado)
      .reduce((acc, p) => acc + (Number(p.valor_parcela) || 0), 0)

    const disponivel = saldoAtual + receitasFuturas - despesasPrevistas - faturasPendentes - parcelasMensais
    const valorParcela = opcaoPagamento === 'parcelado' ? (valor / numeroParcelas) : valor
    const saldoApos = disponivel - valorParcela
    const pctImpacto = disponivel > 0 ? (valorParcela / disponivel) * 100 : 100

    return {
      saldoAtual,
      receitasFuturas,
      despesasPrevistas,
      faturasPendentes,
      parcelasMensais,
      disponivel,
      saldoApos,
      pctImpacto: Math.round(pctImpacto),
      reservaAtual,
      valorCompra: valor,
      valorParcela
    }
  }, [valorCompra, opcaoPagamento, numeroParcelas, resumoMes, receitas, despesas, cartoes, parcelamentos])
}
