import { useMemo } from 'react'
import { useProjecao } from './useProjecao'
import { useReceitas } from './useReceitas'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useParcelamentos } from './useParcelamentos'
import { useInvestimentos } from './useInvestimentos'

/**
 * Hook: Saúde Financeira
 * 
 * Calcula pontuação 0-100 baseada em dados reais do usuário.
 * Critérios transparentes sem IA ou APIs externas.
 */
export function useSaudeFinanceira() {
  const { projecao, resumoMes, carregando: carregandoProjecao } = useProjecao()
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()
  const { cartoes } = useCartoes()
  const { parcelamentos } = useParcelamentos()
  const { investimentos } = useInvestimentos()

  const resultado = useMemo(() => {
    if (carregandoProjecao) return null

    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()

    // Verificar dados mínimos
    const temDados = receitas.length > 0 || despesas.length > 0
    if (!temDados) {
      return {
        pontuacao: 0,
        nivel: 'insuficiente',
        indicadores: [],
        recomendacoes: ['Cadastre suas receitas e despesas para começar'],
        temDados: false
      }
    }

    let pontuacao = 0
    const indicadores = []
    const recomendacoes = []
    const alertas = []

    // ═══════════════════════════════════════════════════════
    // 1. CONTAS EM DIA (20 pontos)
    // ═══════════════════════════════════════════════════════
    const despesasVencidas = despesas.filter(d => {
      if (d.pago || !d.data_vencimento) return false
      const venc = new Date(d.data_vencimento + 'T12:00:00')
      return venc < hoje
    })

    const despesasProximas = despesas.filter(d => {
      if (d.pago || !d.data_vencimento) return false
      const venc = new Date(d.data_vencimento + 'T12:00:00')
      const diff = Math.ceil((venc - hoje) / 86400000)
      return diff >= 0 && diff <= 7
    })

    if (despesasVencidas.length === 0) {
      pontuacao += 20
      indicadores.push({ categoria: 'Contas em dia', status: 'excelente', pontos: 20, descricao: 'Sem contas vencidas' })
    } else if (despesasVencidas.length <= 2) {
      pontuacao += 10
      indicadores.push({ categoria: 'Contas em dia', status: 'atencao', pontos: 10, descricao: `${despesasVencidas.length} conta(s) vencida(s)` })
      alertas.push(`Você tem ${despesasVencidas.length} conta(s) vencida(s)`)
      recomendacoes.push('Pague as contas vencidas o quanto antes')
    } else {
      indicadores.push({ categoria: 'Contas em dia', status: 'critico', pontos: 0, descricao: `${despesasVencidas.length} contas vencidas` })
      alertas.push(`${despesasVencidas.length} contas vencidas!`)
      recomendacoes.push('Priorize o pagamento das contas vencidas')
    }

    if (despesasProximas.length > 0) {
      alertas.push(`${despesasProximas.length} conta(s) vencem nos próximos 7 dias`)
    }

    // ═══════════════════════════════════════════════════════
    // 2. CONTROLE DE GASTOS (25 pontos)
    // ═══════════════════════════════════════════════════════
    const receitaMensal = resumoMes.receitaMes || 0
    const compromissosMensal = resumoMes.compromissosMes || 0
    
    if (receitaMensal > 0) {
      const pctComprometido = (compromissosMensal / receitaMensal) * 100

      if (pctComprometido <= 70) {
        pontuacao += 25
        indicadores.push({ categoria: 'Controle de gastos', status: 'excelente', pontos: 25, descricao: `${Math.round(pctComprometido)}% da renda comprometida` })
      } else if (pctComprometido <= 85) {
        pontuacao += 15
        indicadores.push({ categoria: 'Controle de gastos', status: 'bom', pontos: 15, descricao: `${Math.round(pctComprometido)}% da renda comprometida` })
        recomendacoes.push('Busque reduzir gastos não essenciais')
      } else if (pctComprometido <= 100) {
        pontuacao += 8
        indicadores.push({ categoria: 'Controle de gastos', status: 'atencao', pontos: 8, descricao: `${Math.round(pctComprometido)}% da renda comprometida` })
        alertas.push('Seus gastos estão consumindo quase toda sua renda')
        recomendacoes.push('Revise seus gastos com urgência')
      } else {
        indicadores.push({ categoria: 'Controle de gastos', status: 'critico', pontos: 0, descricao: 'Gastando mais do que ganha' })
        alertas.push('Você está gastando mais do que ganha!')
        recomendacoes.push('Corte gastos imediatamente para evitar endividamento')
      }
    } else {
      indicadores.push({ categoria: 'Controle de gastos', status: 'neutro', pontos: 0, descricao: 'Sem receita cadastrada' })
    }

    // ═══════════════════════════════════════════════════════
    // 3. RESERVA DE EMERGÊNCIA (25 pontos)
    // ═══════════════════════════════════════════════════════
    const reservaAtual = resumoMes.reservaAtual || 0
    const despesasEssenciais = despesas
      .filter(d => {
        const data = d.data_vencimento ? new Date(d.data_vencimento + 'T12:00:00') : null
        return data && data.getMonth() + 1 === mesAtual && data.getFullYear() === anoAtual
      })
      .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    const mesesCobertos = despesasEssenciais > 0 ? reservaAtual / despesasEssenciais : 0

    if (mesesCobertos >= 6) {
      pontuacao += 25
      indicadores.push({ categoria: 'Reserva de emergência', status: 'excelente', pontos: 25, descricao: `${Math.floor(mesesCobertos)} meses de reserva` })
    } else if (mesesCobertos >= 3) {
      pontuacao += 18
      indicadores.push({ categoria: 'Reserva de emergência', status: 'bom', pontos: 18, descricao: `${Math.floor(mesesCobertos)} meses de reserva` })
      recomendacoes.push('Continue guardando para atingir 6 meses de reserva')
    } else if (mesesCobertos >= 1) {
      pontuacao += 10
      indicadores.push({ categoria: 'Reserva de emergência', status: 'atencao', pontos: 10, descricao: `${mesesCobertos.toFixed(1)} mês(es) de reserva` })
      alertas.push('Sua reserva de emergência está abaixo do recomendado')
      recomendacoes.push('Priorize construir uma reserva de 3-6 meses')
    } else if (reservaAtual > 0) {
      pontuacao += 5
      indicadores.push({ categoria: 'Reserva de emergência', status: 'critico', pontos: 5, descricao: 'Menos de 1 mês de reserva' })
      alertas.push('Reserva de emergência insuficiente')
      recomendacoes.push('Comece a guardar dinheiro urgentemente')
    } else {
      indicadores.push({ categoria: 'Reserva de emergência', status: 'critico', pontos: 0, descricao: 'Sem reserva de emergência' })
      alertas.push('Você não tem reserva de emergência!')
      recomendacoes.push('Crie uma reserva de emergência o quanto antes')
    }

    // ═══════════════════════════════════════════════════════
    // 4. ENDIVIDAMENTO (20 pontos)
    // ═══════════════════════════════════════════════════════
    const totalDividas = parcelamentos
      .filter(p => !p.quitado)
      .reduce((acc, p) => {
        const parcelasRestantes = p.numero_total_parcelas - (p.numero_parcelas_pagas || 0)
        return acc + (parcelasRestantes * p.valor_parcela)
      }, 0)

    const comprometimentoDividas = receitaMensal > 0 ? (totalDividas / receitaMensal) * 100 : 0

    if (totalDividas === 0) {
      pontuacao += 20
      indicadores.push({ categoria: 'Endividamento', status: 'excelente', pontos: 20, descricao: 'Sem dívidas' })
    } else if (comprometimentoDividas <= 30) {
      pontuacao += 15
      indicadores.push({ categoria: 'Endividamento', status: 'bom', pontos: 15, descricao: 'Dívidas sob controle' })
    } else if (comprometimentoDividas <= 50) {
      pontuacao += 8
      indicadores.push({ categoria: 'Endividamento', status: 'atencao', pontos: 8, descricao: 'Endividamento moderado' })
      recomendacoes.push('Evite fazer novas dívidas')
    } else {
      indicadores.push({ categoria: 'Endividamento', status: 'critico', pontos: 0, descricao: 'Endividamento alto' })
      alertas.push('Suas dívidas comprometem mais da metade da sua renda')
      recomendacoes.push('Concentre esforços em quitar dívidas')
    }

    // ═══════════════════════════════════════════════════════
    // 5. CAPACIDADE DE ECONOMIZAR (10 pontos)
    // ═══════════════════════════════════════════════════════
    const totalInvestido = investimentos.reduce((acc, inv) => acc + (Number(inv.valor_investido) || 0), 0)

    if (totalInvestido > 0) {
      pontuacao += 10
      indicadores.push({ categoria: 'Capacidade de economizar', status: 'excelente', pontos: 10, descricao: 'Investindo regularmente' })
    } else if (reservaAtual > despesasEssenciais) {
      pontuacao += 5
      indicadores.push({ categoria: 'Capacidade de economizar', status: 'bom', pontos: 5, descricao: 'Conseguindo guardar dinheiro' })
      recomendacoes.push('Considere começar a investir')
    } else {
      indicadores.push({ categoria: 'Capacidade de economizar', status: 'atencao', pontos: 0, descricao: 'Dificuldade para economizar' })
      recomendacoes.push('Busque maneiras de reduzir gastos e economizar')
    }

    // ═══════════════════════════════════════════════════════
    // CLASSIFICAÇÃO FINAL
    // ═══════════════════════════════════════════════════════
    let nivel, nivelTexto, cor

    if (pontuacao >= 85) {
      nivel = 'excelente'
      nivelTexto = 'Excelente'
      cor = '#10b981'
    } else if (pontuacao >= 70) {
      nivel = 'boa'
      nivelTexto = 'Boa'
      cor = '#3b82f6'
    } else if (pontuacao >= 50) {
      nivel = 'regular'
      nivelTexto = 'Regular'
      cor = '#f59e0b'
    } else {
      nivel = 'atencao'
      nivelTexto = 'Precisa de atenção'
      cor = '#ef4444'
    }

    return {
      pontuacao: Math.round(pontuacao),
      nivel,
      nivelTexto,
      cor,
      indicadores,
      recomendacoes: recomendacoes.slice(0, 5), // Top 5
      alertas,
      temDados: true,
      metricas: {
        despesasVencidas: despesasVencidas.length,
        despesasProximas: despesasProximas.length,
        pctComprometido: receitaMensal > 0 ? Math.round((compromissosMensal / receitaMensal) * 100) : 0,
        mesesReserva: Math.floor(mesesCobertos),
        totalDividas,
        totalInvestido
      }
    }
  }, [carregandoProjecao, resumoMes, receitas, despesas, cartoes, parcelamentos, investimentos, projecao])

  return {
    saudeFinanceira: resultado,
    carregando: carregandoProjecao
  }
}
