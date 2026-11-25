import React, { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, TrendingDown, Zap, Target, Calendar, Info, AlertCircle } from 'lucide-react'
import { useParcelamentos } from '../hooks/useParcelamentos'
import { formatCurrency } from '../lib/utils'

export default function PlanejadorDividas() {
  const { parcelamentos } = useParcelamentos()
  const [valorExtra, setValorExtra] = useState('')
  const [estrategia, setEstrategia] = useState('avalanche') // 'avalanche' | 'bola-de-neve'

  // Filtrar apenas parcelamentos ativos (não quitados)
  const dividasAtivas = useMemo(() => {
    return parcelamentos
      .filter(p => !p.quitado)
      .map(p => {
        const parcelasRestantes = p.numero_total_parcelas - (p.numero_parcelas_pagas || 0)
        const totalRestante = parcelasRestantes * p.valor_parcela
        
        return {
          id: p.id,
          descricao: p.descricao,
          valorParcela: Number(p.valor_parcela) || 0,
          parcelasRestantes,
          totalRestante,
          // Juros estimado baseado no total vs parcelas (simplificado)
          taxaJuros: p.numero_total_parcelas > 0 
            ? ((p.valor_parcela * p.numero_total_parcelas) / (p.valor_parcela * p.numero_total_parcelas) - 1) * 100
            : 0
        }
      })
  }, [parcelamentos])

  // Total de dívidas
  const totalDividas = dividasAtivas.reduce((acc, d) => acc + d.totalRestante, 0)
  const parcelaMensalTotal = dividasAtivas.reduce((acc, d) => acc + d.valorParcela, 0)

  // Simular estratégias de pagamento
  const simulacao = useMemo(() => {
    if (!valorExtra || Number(valorExtra) <= 0 || dividasAtivas.length === 0) return null

    const extra = Number(valorExtra)
    let dividas = dividasAtivas.map(d => ({ ...d }))

    // Ordenar conforme estratégia
    if (estrategia === 'avalanche') {
      // Prioriza dívidas com maior taxa de juros (simplificado: menor saldo restante = maior % de juros pago)
      dividas.sort((a, b) => a.totalRestante - b.totalRestante)
    } else {
      // Bola de neve: menor saldo primeiro
      dividas.sort((a, b) => a.totalRestante - b.totalRestante)
    }

    let meses = 0
    let totalPago = 0
    let extraDisponivel = extra
    const ordemQuitacao = []

    while (dividas.some(d => d.totalRestante > 0) && meses < 1200) { // limite 100 anos
      meses++
      
      // Pagar parcelas mínimas de todas
      dividas.forEach(d => {
        if (d.totalRestante > 0) {
          const pagamento = Math.min(d.valorParcela, d.totalRestante)
          d.totalRestante -= pagamento
          totalPago += pagamento
        }
      })

      // Aplicar valor extra na primeira dívida não quitada (conforme estratégia)
      let extraRestante = extraDisponivel
      for (let d of dividas) {
        if (d.totalRestante > 0 && extraRestante > 0) {
          const pagamentoExtra = Math.min(extraRestante, d.totalRestante)
          d.totalRestante -= pagamentoExtra
          totalPago += pagamentoExtra
          extraRestante -= pagamentoExtra

          if (d.totalRestante === 0) {
            ordemQuitacao.push({ nome: d.descricao, mes: meses })
          }

          break // Concentra no primeiro não quitado
        }
      }
    }

    // Tempo sem valor extra (apenas parcelas mínimas)
    let mesesSemExtra = 0
    dividasAtivas.forEach(d => {
      mesesSemExtra = Math.max(mesesSemExtra, d.parcelasRestantes)
    })

    const economiaJuros = (parcelaMensalTotal * mesesSemExtra) - totalPago
    const mesesEconomizados = mesesSemExtra - meses

    return {
      mesesParaQuitar: meses,
      mesesSemExtra,
      mesesEconomizados,
      economiaJuros: Math.max(0, economiaJuros),
      ordemQuitacao,
      totalPago
    }
  }, [valorExtra, estrategia, dividasAtivas, parcelaMensalTotal])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planejador de Dívidas</h1>
          <p className="text-sm text-gray-500 mt-1">Estratégias para quitar suas dívidas</p>
        </div>
      </div>

      {dividasAtivas.length === 0 ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Target size={28} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Sem dívidas ativas!</h2>
          <p className="text-sm text-gray-500">
            Você não tem parcelamentos pendentes no momento. Continue assim!
          </p>
        </div>
      ) : (
        <>
          {/* Resumo de dívidas */}
          <div className="card bg-red-50 border-red-200">
            <div className="text-center mb-4">
              <h2 className="text-sm font-medium text-red-900 mb-2">Total em dívidas</h2>
              <p className="text-3xl font-bold text-red-600">{formatCurrency(totalDividas)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <p className="text-xs text-red-700 mb-1">Parcela mensal</p>
                <p className="text-lg font-bold text-red-900">{formatCurrency(parcelaMensalTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-red-700 mb-1">Dívidas ativas</p>
                <p className="text-lg font-bold text-red-900">{dividasAtivas.length}</p>
              </div>
            </div>
          </div>

          {/* Lista de dívidas */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Suas dívidas</h3>
            <div className="space-y-2">
              {dividasAtivas.map((divida, i) => (
                <div key={divida.id} className="card flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{divida.descricao}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {divida.parcelasRestantes}× de {formatCurrency(divida.valorParcela)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{formatCurrency(divida.totalRestante)}</p>
                    <p className="text-xs text-gray-500 mt-1">restante</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulador */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Simule pagamento extra</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quanto pode pagar a mais por mês?
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorExtra}
                  onChange={(e) => setValorExtra(e.target.value)}
                  placeholder="R$ 0,00"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Estratégia de pagamento
                </label>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setEstrategia('avalanche')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      estrategia === 'avalanche'
                        ? 'border-marca bg-marca/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Zap size={20} className={estrategia === 'avalanche' ? 'text-marca' : 'text-gray-400'} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          Avalanche (Recomendado)
                        </p>
                        <p className="text-xs text-gray-600">
                          Prioriza dívidas com maior impacto financeiro. Economiza mais em juros.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEstrategia('bola-de-neve')}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      estrategia === 'bola-de-neve'
                        ? 'border-marca bg-marca/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Target size={20} className={estrategia === 'bola-de-neve' ? 'text-marca' : 'text-gray-400'} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 mb-1">
                          Bola de Neve
                        </p>
                        <p className="text-xs text-gray-600">
                          Prioriza dívidas menores primeiro. Vitórias rápidas aumentam motivação.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultado da simulação */}
          {simulacao && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="text-sm font-semibold text-green-900 mb-4">Resultado da simulação</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-green-600" />
                    <span className="text-sm text-green-900">Tempo para quitar tudo</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {simulacao.mesesParaQuitar} meses
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown size={18} className="text-green-600" />
                    <span className="text-sm text-green-900">Meses economizados</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">
                    {simulacao.mesesEconomizados} meses
                  </span>
                </div>

                {simulacao.economiaJuros > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={18} className="text-green-600" />
                      <span className="text-sm text-green-900">Economia estimada</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(simulacao.economiaJuros)}
                    </span>
                  </div>
                )}

                {simulacao.ordemQuitacao.length > 0 && (
                  <div className="pt-3 border-t border-green-200">
                    <p className="text-xs font-semibold text-green-900 mb-2">Ordem de quitação:</p>
                    <ul className="space-y-1">
                      {simulacao.ordemQuitacao.map((item, i) => (
                        <li key={i} className="text-xs text-green-700">
                          {i + 1}. {item.nome} (mês {item.mes})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>Avalanche:</strong> prioriza dívidas menores (quitação mais rápida). 
            <strong> Bola de neve:</strong> vitórias rápidas aumentam motivação.
            Simulações são estimativas — juros reais podem variar.
          </p>
        </div>
      </div>
    </div>
  )
}
