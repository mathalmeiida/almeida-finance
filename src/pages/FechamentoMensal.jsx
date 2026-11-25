import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calendar, TrendingUp, TrendingDown, PieChart, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { formatCurrency } from '../lib/utils'

export default function FechamentoMensal() {
  const { receitas } = useReceitas()
  const { despesas } = useDespesas()
  const { investimentos } = useInvestimentos()

  const hoje = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(hoje.getMonth() + 1)
  const [anoSelecionado, setAnoSelecionado] = useState(hoje.getFullYear())

  // Gerar lista de meses disponíveis (últimos 12 meses)
  const mesesDisponiveis = useMemo(() => {
    const meses = []
    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje)
      data.setMonth(data.getMonth() - i)
      meses.push({
        mes: data.getMonth() + 1,
        ano: data.getFullYear(),
        label: data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      })
    }
    return meses
  }, [])

  // Calcular dados do mês selecionado
  const dadosMes = useMemo(() => {
    const receitasMes = receitas.filter(r => {
      if (!r.data_recebimento) return false
      const data = new Date(r.data_recebimento + 'T12:00:00')
      return data.getMonth() + 1 === mesSelecionado && data.getFullYear() === anoSelecionado
    })

    const despesasMes = despesas.filter(d => {
      if (!d.data_vencimento) return false
      const data = new Date(d.data_vencimento + 'T12:00:00')
      return data.getMonth() + 1 === mesSelecionado && data.getFullYear() === anoSelecionado
    })

    const investimentosMes = investimentos.filter(inv => {
      if (!inv.data_aporte) return false
      const data = new Date(inv.data_aporte + 'T12:00:00')
      return data.getMonth() + 1 === mesSelecionado && data.getFullYear() === anoSelecionado
    })

    const totalReceitas = receitasMes.reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
    const totalDespesas = despesasMes.reduce((acc, d) => acc + (Number(d.valor) || 0), 0)
    const totalInvestido = investimentosMes.reduce((acc, inv) => acc + (Number(inv.valor_investido) || 0), 0)
    
    const saldo = totalReceitas - totalDespesas
    const economia = totalInvestido
    const taxaEconomia = totalReceitas > 0 ? (economia / totalReceitas) * 100 : 0

    // Agrupar despesas por categoria
    const despesasPorCategoria = {}
    despesasMes.forEach(d => {
      const cat = d.categoria || 'Sem categoria'
      if (!despesasPorCategoria[cat]) {
        despesasPorCategoria[cat] = { total: 0, quantidade: 0 }
      }
      despesasPorCategoria[cat].total += Number(d.valor) || 0
      despesasPorCategoria[cat].quantidade++
    })

    const categorias = Object.entries(despesasPorCategoria)
      .map(([nome, dados]) => ({
        nome,
        total: dados.total,
        quantidade: dados.quantidade,
        percentual: totalDespesas > 0 ? (dados.total / totalDespesas) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total)

    return {
      totalReceitas,
      totalDespesas,
      totalInvestido,
      saldo,
      economia,
      taxaEconomia,
      categorias,
      receitasMes,
      despesasMes
    }
  }, [receitas, despesas, investimentos, mesSelecionado, anoSelecionado])

  // Calcular comparação com mês anterior
  const mesAnterior = useMemo(() => {
    const dataAnterior = new Date(anoSelecionado, mesSelecionado - 2) // -2 porque getMonth() é 0-indexed
    const mesAnt = dataAnterior.getMonth() + 1
    const anoAnt = dataAnterior.getFullYear()

    const receitasAnt = receitas.filter(r => {
      if (!r.data_recebimento) return false
      const data = new Date(r.data_recebimento + 'T12:00:00')
      return data.getMonth() + 1 === mesAnt && data.getFullYear() === anoAnt
    }).reduce((acc, r) => acc + (Number(r.valor) || 0), 0)

    const despesasAnt = despesas.filter(d => {
      if (!d.data_vencimento) return false
      const data = new Date(d.data_vencimento + 'T12:00:00')
      return data.getMonth() + 1 === mesAnt && data.getFullYear() === anoAnt
    }).reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

    return { receitas: receitasAnt, despesas: despesasAnt }
  }, [receitas, despesas, mesSelecionado, anoSelecionado])

  const variacaoReceitas = mesAnterior.receitas > 0
    ? ((dadosMes.totalReceitas - mesAnterior.receitas) / mesAnterior.receitas) * 100
    : 0

  const variacaoDespesas = mesAnterior.despesas > 0
    ? ((dadosMes.totalDespesas - mesAnterior.despesas) / mesAnterior.despesas) * 100
    : 0

  const [expandirCategorias, setExpandirCategorias] = useState(false)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Fechamento Mensal</h1>
          <p className="text-sm text-gray-500 mt-1">Resumo financeiro consolidado</p>
        </div>
      </div>

      {/* Seletor de mês */}
      <div className="card">
        <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
        <select
          value={`${anoSelecionado}-${mesSelecionado}`}
          onChange={(e) => {
            const [ano, mes] = e.target.value.split('-')
            setAnoSelecionado(Number(ano))
            setMesSelecionado(Number(mes))
          }}
          className="input w-full"
        >
          {mesesDisponiveis.map((m) => (
            <option key={`${m.ano}-${m.mes}`} value={`${m.ano}-${m.mes}`}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Card resumo principal */}
      <div className="card bg-gradient-to-br from-marca/10 to-marca/5 border-marca/20">
        <div className="text-center mb-6">
          <h2 className="text-sm font-medium text-gray-600 mb-2">Resultado do mês</h2>
          <p className={`text-4xl font-bold mb-1 ${dadosMes.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(dadosMes.saldo)}
          </p>
          <p className="text-xs text-gray-500">
            {dadosMes.saldo >= 0 ? 'Sobrou' : 'Faltou'} no final do mês
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp size={14} className="text-green-600" />
              <span className="text-xs text-gray-500">Receitas</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(dadosMes.totalReceitas)}</p>
            {variacaoReceitas !== 0 && (
              <p className={`text-xs mt-1 ${variacaoReceitas > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {variacaoReceitas > 0 ? '+' : ''}{variacaoReceitas.toFixed(1)}% vs mês anterior
              </p>
            )}
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingDown size={14} className="text-red-600" />
              <span className="text-xs text-gray-500">Despesas</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(dadosMes.totalDespesas)}</p>
            {variacaoDespesas !== 0 && (
              <p className={`text-xs mt-1 ${variacaoDespesas > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {variacaoDespesas > 0 ? '+' : ''}{variacaoDespesas.toFixed(1)}% vs mês anterior
              </p>
            )}
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <PieChart size={14} className="text-blue-600" />
              <span className="text-xs text-gray-500">Economia</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(dadosMes.economia)}</p>
            <p className="text-xs text-blue-600 mt-1">
              {dadosMes.taxaEconomia.toFixed(1)}% da renda
            </p>
          </div>
        </div>
      </div>

      {/* Despesas por categoria */}
      {dadosMes.categorias.length > 0 && (
        <div className="card">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setExpandirCategorias(!expandirCategorias)}
          >
            <h3 className="text-sm font-semibold text-gray-900">
              Despesas por categoria ({dadosMes.categorias.length})
            </h3>
            {expandirCategorias ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {expandirCategorias && (
            <div className="mt-4 space-y-3">
              {dadosMes.categorias.map((cat, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700">{cat.nome}</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(cat.total)} ({cat.percentual.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-marca transition-all"
                      style={{ width: `${cat.percentual}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {cat.quantidade} despesa{cat.quantidade > 1 ? 's' : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Métricas adicionais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total de receitas</p>
          <p className="text-xl font-bold text-gray-900">{dadosMes.receitasMes.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total de despesas</p>
          <p className="text-xl font-bold text-gray-900">{dadosMes.despesasMes.length}</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            O fechamento considera receitas recebidas e despesas vencidas no período selecionado.
            Economia = investimentos realizados no mês. Comparações são feitas com o mês anterior.
          </p>
        </div>
      </div>
    </div>
  )
}
