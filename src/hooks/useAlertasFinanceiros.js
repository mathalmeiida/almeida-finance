import { useMemo } from 'react'
import { useProjecao } from './useProjecao'
import { useReceitas } from './useReceitas'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useParcelamentos } from './useParcelamentos'
import { useMetas } from './useMetas'

/**
 * Hook: Alertas Financeiros
 * 
 * Gera notificações baseadas em regras sobre:
 * - Contas vencidas ou próximas do vencimento
 * - Limite de cartão próximo do máximo
 * - Reserva de emergência baixa
 * - Gastos acima da média
 * - Metas em risco
 * - Parcelamentos próximos do fim
 */
export function useAlertasFinanceiros() {
  const { resumoMes } = useProjecao()
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()
  const { cartoes } = useCartoes()
  const { parcelamentos } = useParcelamentos()
  const { metas } = useMetas()

  const alertas = useMemo(() => {
    const hoje = new Date()
    const resultado = []

    // ═══════════════════════════════════════════════════════
    // 1. CONTAS VENCIDAS
    // ═══════════════════════════════════════════════════════
    const despesasVencidas = despesas.filter(d => {
      if (d.pago || !d.data_vencimento) return false
      const venc = new Date(d.data_vencimento + 'T12:00:00')
      return venc < hoje
    })

    if (despesasVencidas.length > 0) {
      resultado.push({
        id: 'contas-vencidas',
        tipo: 'critico',
        titulo: `${despesasVencidas.length} conta(s) vencida(s)`,
        descricao: 'Pague o quanto antes para evitar juros e negativação',
        icone: '🚨',
        cor: '#ef4444',
        acao: { texto: 'Ver despesas', link: '/despesas' }
      })
    }

    // ═══════════════════════════════════════════════════════
    // 2. CONTAS PRÓXIMAS DO VENCIMENTO (7 dias)
    // ═══════════════════════════════════════════════════════
    const despesasProximas = despesas.filter(d => {
      if (d.pago || !d.data_vencimento) return false
      const venc = new Date(d.data_vencimento + 'T12:00:00')
      const diff = Math.ceil((venc - hoje) / 86400000)
      return diff >= 0 && diff <= 7
    })

    if (despesasProximas.length > 0) {
      resultado.push({
        id: 'contas-proximas',
        tipo: 'atencao',
        titulo: `${despesasProximas.length} conta(s) vencem em até 7 dias`,
        descricao: 'Organize-se para não perder os prazos',
        icone: '⏰',
        cor: '#f59e0b',
        acao: { texto: 'Ver despesas', link: '/despesas' }
      })
    }

    // ═══════════════════════════════════════════════════════
    // 3. LIMITE DE CARTÃO ALTO (> 80%)
    // ═══════════════════════════════════════════════════════
    const cartoesLimiteAlto = cartoes.filter(c => {
      if (!c.limite_total || c.limite_total <= 0) return false
      const pct = (c.fatura_atual / c.limite_total) * 100
      return pct > 80
    })

    if (cartoesLimiteAlto.length > 0) {
      cartoesLimiteAlto.forEach(c => {
        const pct = Math.round((c.fatura_atual / c.limite_total) * 100)
        resultado.push({
          id: `cartao-limite-${c.id}`,
          tipo: 'atencao',
          titulo: `${c.nome_cartao}: ${pct}% do limite usado`,
          descricao: 'Evite usar mais este cartão este mês',
          icone: '💳',
          cor: '#f59e0b',
          acao: { texto: 'Ver cartões', link: '/cartoes' }
        })
      })
    }

    // ═══════════════════════════════════════════════════════
    // 4. RESERVA DE EMERGÊNCIA BAIXA (< 1 mês)
    // ═══════════════════════════════════════════════════════
    const reservaAtual = resumoMes.reservaAtual || 0
    const despesasMensais = despesas
      .filter(d => {
        if (!d.data_vencimento) return false
        const data = new Date(d.data_vencimento + 'T12:00:00')
        return data.getMonth() + 1 === hoje.getMonth() + 1 && data.getFullYear() === hoje.getFullYear()
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    const mesesReserva = despesasMensais > 0 ? reservaAtual / despesasMensais : 0

    if (mesesReserva < 1 && reservaAtual > 0) {
      resultado.push({
        id: 'reserva-baixa',
        tipo: 'atencao',
        titulo: 'Reserva de emergência insuficiente',
        descricao: `Você tem apenas ${mesesReserva.toFixed(1)} mês(es) de reserva. Ideal: 3-6 meses`,
        icone: '🛡️',
        cor: '#f59e0b',
        acao: { texto: 'Ver investimentos', link: '/investimentos' }
      })
    } else if (reservaAtual === 0) {
      resultado.push({
        id: 'sem-reserva',
        tipo: 'critico',
        titulo: 'Você não tem reserva de emergência',
        descricao: 'Comece a guardar dinheiro para imprevistos',
        icone: '⚠️',
        cor: '#ef4444',
        acao: { texto: 'Criar reserva', link: '/investimentos' }
      })
    }

    // ═══════════════════════════════════════════════════════
    // 5. GASTOS ACIMA DA MÉDIA (> 120% da média dos últimos 3 meses)
    // ═══════════════════════════════════════════════════════
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()

    const gastosMes = despesas
      .filter(d => {
        if (!d.data_vencimento) return false
        const data = new Date(d.data_vencimento + 'T12:00:00')
        return data.getMonth() + 1 === mesAtual && data.getFullYear() === anoAtual
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    // Calcular média dos últimos 3 meses (simplificado)
    const gastosHistorico = despesas
      .filter(d => {
        if (!d.data_vencimento) return false
        const data = new Date(d.data_vencimento + 'T12:00:00')
        const diff = Math.ceil((hoje - data) / 86400000)
        return diff > 0 && diff <= 90
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    const mediaGastos = gastosHistorico / 3

    if (gastosMes > mediaGastos * 1.2 && mediaGastos > 0) {
      const pctAcima = Math.round(((gastosMes - mediaGastos) / mediaGastos) * 100)
      resultado.push({
        id: 'gastos-acima-media',
        tipo: 'info',
        titulo: `Gastos ${pctAcima}% acima da média`,
        descricao: 'Seus gastos estão mais altos que o normal este mês',
        icone: '📊',
        cor: '#3b82f6',
        acao: { texto: 'Ver despesas', link: '/despesas' }
      })
    }

    // ═══════════════════════════════════════════════════════
    // 6. METAS EM RISCO (< 50% do progresso esperado)
    // ═══════════════════════════════════════════════════════
    const metasEmRisco = metas.filter(m => {
      if (m.atingida || !m.data_alvo) return false
      const dataAlvo = new Date(m.data_alvo + 'T12:00:00')
      const dataInicio = m.created_at ? new Date(m.created_at) : new Date(m.data_alvo)
      
      const totalDias = Math.ceil((dataAlvo - dataInicio) / 86400000)
      const diasPassados = Math.ceil((hoje - dataInicio) / 86400000)
      const pctTempoDecorrido = totalDias > 0 ? (diasPassados / totalDias) * 100 : 0

      const valorAtual = Number(m.valor_atual) || 0
      const valorAlvo = Number(m.valor_alvo) || 0
      const pctProgresso = valorAlvo > 0 ? (valorAtual / valorAlvo) * 100 : 0

      // Meta em risco se progresso < 50% do tempo esperado
      return pctTempoDecorrido > 25 && pctProgresso < (pctTempoDecorrido * 0.5)
    })

    if (metasEmRisco.length > 0) {
      metasEmRisco.slice(0, 2).forEach(m => {
        resultado.push({
          id: `meta-risco-${m.id}`,
          tipo: 'info',
          titulo: `Meta "${m.nome}" está atrasada`,
          descricao: 'Você está abaixo do ritmo esperado para atingir esta meta',
          icone: '🎯',
          cor: '#3b82f6',
          acao: { texto: 'Ver metas', link: '/metas' }
        })
      })
    }

    // ═══════════════════════════════════════════════════════
    // 7. PARCELAMENTO PRÓXIMO DO FIM (últimas 3 parcelas)
    // ═══════════════════════════════════════════════════════
    const parcelamentosFinalizando = parcelamentos.filter(p => {
      if (p.quitado) return false
      const parcelasRestantes = p.numero_total_parcelas - (p.numero_parcelas_pagas || 0)
      return parcelasRestantes > 0 && parcelasRestantes <= 3
    })

    if (parcelamentosFinalizando.length > 0) {
      parcelamentosFinalizando.slice(0, 2).forEach(p => {
        const parcelasRestantes = p.numero_total_parcelas - (p.numero_parcelas_pagas || 0)
        resultado.push({
          id: `parcelamento-fim-${p.id}`,
          tipo: 'sucesso',
          titulo: `${p.descricao}: faltam ${parcelasRestantes} parcela(s)`,
          descricao: 'Você está quase quitando este parcelamento!',
          icone: '🎉',
          cor: '#10b981',
          acao: { texto: 'Ver despesas', link: '/despesas' }
        })
      })
    }

    // ═══════════════════════════════════════════════════════
    // 8. RECEITA ESPERADA NÃO RECEBIDA (> 7 dias de atraso)
    // ═══════════════════════════════════════════════════════
    const receitasAtrasadas = receitas.filter(r => {
      if (r.recebido || !r.data_recebimento) return false
      const dataRec = new Date(r.data_recebimento + 'T12:00:00')
      const diff = Math.ceil((hoje - dataRec) / 86400000)
      return diff > 7
    })

    if (receitasAtrasadas.length > 0) {
      resultado.push({
        id: 'receitas-atrasadas',
        tipo: 'atencao',
        titulo: `${receitasAtrasadas.length} receita(s) não recebida(s)`,
        descricao: 'Verifique se houve algum problema com estes recebimentos',
        icone: '💰',
        cor: '#f59e0b',
        acao: { texto: 'Ver receitas', link: '/receitas' }
      })
    }

    // Ordenar: crítico > atenção > info > sucesso
    const ordem = { critico: 0, atencao: 1, info: 2, sucesso: 3 }
    return resultado.sort((a, b) => ordem[a.tipo] - ordem[b.tipo])
  }, [resumoMes, receitas, despesas, cartoes, parcelamentos, metas])

  return {
    alertas,
    total: alertas.length,
    criticos: alertas.filter(a => a.tipo === 'critico').length,
    atencao: alertas.filter(a => a.tipo === 'atencao').length
  }
}
