import { useMemo } from 'react'
import { useProjecao } from './useProjecao'
import { useReceitas } from './useReceitas'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useParcelamentos } from './useParcelamentos'

/**
 * Hook: Posso Comprar 2.0
 * 
 * Simula impacto de uma compra considerando:
 * - Saldo atual
 * - Receitas futuras (próximos 30 dias)
 * - Despesas previstas (próximos 30 dias)
 * - Faturas de cartão (próximas)
 * - Parcelamentos ativos
 * - Impacto na reserva de emergência
 * 
 * Retorna: pode comprar / cautela / melhor esperar / não cabe
 */
export function usePossoComprar2(valorCompra, opcaoPagamento = 'avista', numeroParcelas = 1) {
  const { projecao, resumoMes } = useProjecao()
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()
  const { cartoes } = useCartoes()
  const { parcelamentos } = useParcelamentos()

  const simulacao = useMemo(() => {
    if (!valorCompra || valorCompra <= 0) return null

    const valor = Number(valorCompra)
    const hoje = new Date()
    const data30Dias = new Date(hoje)
    data30Dias.setDate(hoje.getDate() + 30)

    // ═══════════════════════════════════════════════════════
    // 1. SALDO ATUAL
    // ═══════════════════════════════════════════════════════
    const saldoAtual = resumoMes.saldoAtual || 0
    const reservaAtual = resumoMes.reservaAtual || 0

    // ═══════════════════════════════════════════════════════
    // 2. RECEITAS FUTURAS (próximos 30 dias)
    // ═══════════════════════════════════════════════════════
    const receitasFuturas = receitas
      .filter(r => {
        if (!r.data_recebimento) return false
        const dataRec = new Date(r.data_recebimento + 'T12:00:00')
        return dataRec >= hoje && dataRec <= data30Dias
      })
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0)

    // ═══════════════════════════════════════════════════════
    // 3. DESPESAS PREVISTAS (próximos 30 dias)
    // ═══════════════════════════════════════════════════════
    const despesasPrevistas = despesas
      .filter(d => {
        if (d.pago || !d.data_vencimento) return false
        const dataVenc = new Date(d.data_vencimento + 'T12:00:00')
        return dataVenc >= hoje && dataVenc <= data30Dias
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    // ═══════════════════════════════════════════════════════
    // 4. FATURAS DE CARTÃO (próximas)
    // ═══════════════════════════════════════════════════════
    const faturasPendentes = cartoes
      .filter(c => c.fatura_atual > 0)
      .reduce((acc, c) => acc + (Number(c.fatura_atual) || 0), 0)

    // ═══════════════════════════════════════════════════════
    // 5. PARCELAMENTOS ATIVOS (parcela mensal)
    // ═══════════════════════════════════════════════════════
    const parcelasMensais = parcelamentos
      .filter(p => !p.quitado)
      .reduce((acc, p) => acc + (Number(p.valor_parcela) || 0), 0)

    // ═══════════════════════════════════════════════════════
    // 6. CÁLCULO DA DISPONIBILIDADE
    // ═══════════════════════════════════════════════════════
    const disponivel = saldoAtual + receitasFuturas - despesasPrevistas - faturasPendentes - parcelasMensais
    
    // Valor que sobraria após a compra
    const saldoApos = disponivel - (opcaoPagamento === 'parcelado' ? (valor / numeroParcelas) : valor)
    
    // Percentual do disponível que a compra consome
    const pctImpacto = disponivel > 0 ? ((opcaoPagamento === 'parcelado' ? (valor / numeroParcelas) : valor) / disponivel) * 100 : 100

    // ═══════════════════════════════════════════════════════
    // 7. ANÁLISE DE DECISÃO
    // ═══════════════════════════════════════════════════════
    let resultado, cor, icone, mensagem, detalhes, recomendacoes

    // NÃO CABE NO ORÇAMENTO
    if (saldoApos < 0) {
      resultado = 'nao-cabe'
      cor = '#ef4444'
      icone = '🚫'
      mensagem = 'Não cabe no orçamento'
      detalhes = 'Esta compra deixaria você no negativo nos próximos 30 dias.'
      recomendacoes = [
        'Aguarde receber mais receitas',
        'Reduza outras despesas primeiro',
        'Considere uma alternativa mais barata'
      ]
    }
    // MELHOR ESPERAR (impacto > 70% ou afeta reserva)
    else if (pctImpacto > 70 || saldoApos < reservaAtual * 0.5) {
      resultado = 'melhor-esperar'
      cor = '#f59e0b'
      icone = '⏳'
      mensagem = 'Melhor esperar um pouco'
      detalhes = pctImpacto > 70 
        ? `Esta compra consumiria ${Math.round(pctImpacto)}% do seu orçamento disponível.`
        : 'Esta compra afetaria significativamente sua reserva de emergência.'
      recomendacoes = [
        'Aguarde receber próximas receitas',
        'Verifique se há despesas que pode adiar',
        'Considere dividir em mais parcelas'
      ]
    }
    // COM CAUTELA (impacto 40-70%)
    else if (pctImpacto > 40) {
      resultado = 'cautela'
      cor = '#3b82f6'
      icone = '⚠️'
      mensagem = 'Pode, mas com cautela'
      detalhes = `Esta compra representa ${Math.round(pctImpacto)}% do seu orçamento disponível.`
      recomendacoes = [
        'Certifique-se de que é uma compra necessária',
        'Evite outras compras grandes este mês',
        'Mantenha controle rigoroso dos gastos'
      ]
    }
    // PODE COMPRAR (impacto < 40%)
    else {
      resultado = 'pode-comprar'
      cor = '#10b981'
      icone = '✅'
      mensagem = 'Você pode comprar!'
      detalhes = `Sobrará ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoApos)} no seu orçamento.`
      recomendacoes = [
        'Aproveite a compra com tranquilidade',
        'Continue controlando seus gastos',
        'Considere guardar o que sobrar'
      ]
    }

    return {
      resultado,
      cor,
      icone,
      mensagem,
      detalhes,
      recomendacoes,
      metricas: {
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
        valorParcela: opcaoPagamento === 'parcelado' ? valor / numeroParcelas : valor
      }
    }
  }, [valorCompra, opcaoPagamento, numeroParcelas, resumoMes, receitas, despesas, cartoes, parcelamentos])

  return { simulacao }
}
