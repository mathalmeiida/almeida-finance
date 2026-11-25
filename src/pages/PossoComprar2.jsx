import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Calculator, TrendingUp, TrendingDown, AlertCircle, Info } from 'lucide-react'
import { usePossoComprar2 } from '../hooks/usePossoComprar2'
import { formatCurrency } from '../lib/utils'

export default function PossoComprar2() {
  const [valorCompra, setValorCompra] = useState('')
  const [opcaoPagamento, setOpcaoPagamento] = useState('avista')
  const [numeroParcelas, setNumeroParcelas] = useState(1)

  const { simulacao } = usePossoComprar2(valorCompra, opcaoPagamento, numeroParcelas)

  const handleSimular = (e) => {
    e.preventDefault()
    // Simulação já roda automaticamente via hook
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Posso Comprar?</h1>
          <p className="text-sm text-gray-500 mt-1">Simulador financeiro completo</p>
        </div>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSimular} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Valor da compra
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={valorCompra}
            onChange={(e) => setValorCompra(e.target.value)}
            placeholder="R$ 0,00"
            className="input w-full text-lg"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Forma de pagamento
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setOpcaoPagamento('avista')
                setNumeroParcelas(1)
              }}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                opcaoPagamento === 'avista'
                  ? 'border-marca bg-marca/5 text-marca'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              À vista
            </button>
            <button
              type="button"
              onClick={() => setOpcaoPagamento('parcelado')}
              className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                opcaoPagamento === 'parcelado'
                  ? 'border-marca bg-marca/5 text-marca'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              Parcelado
            </button>
          </div>
        </div>

        {opcaoPagamento === 'parcelado' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Número de parcelas
            </label>
            <input
              type="number"
              min="2"
              max="48"
              value={numeroParcelas}
              onChange={(e) => setNumeroParcelas(Number(e.target.value))}
              className="input w-full"
            />
            {valorCompra > 0 && numeroParcelas > 1 && (
              <p className="text-sm text-gray-500 mt-2">
                {numeroParcelas}× de {formatCurrency(valorCompra / numeroParcelas)}
              </p>
            )}
          </div>
        )}
      </form>

      {/* Resultado da simulação */}
      {simulacao && (
        <div className="space-y-4">
          {/* Card principal com resultado */}
          <div
            className="card text-center"
            style={{
              background: `linear-gradient(135deg, ${simulacao.cor}15 0%, ${simulacao.cor}05 100%)`,
              borderColor: `${simulacao.cor}40`
            }}
          >
            <div className="text-6xl mb-4">{simulacao.icone}</div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: simulacao.cor }}>
              {simulacao.mensagem}
            </h2>
            <p className="text-sm text-gray-600">{simulacao.detalhes}</p>
          </div>

          {/* Métricas financeiras */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Análise financeira</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Saldo atual</span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(simulacao.metricas.saldoAtual)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <TrendingUp size={14} className="text-green-600" />
                  Receitas próximas (30 dias)
                </span>
                <span className="text-sm font-semibold text-green-600">
                  +{formatCurrency(simulacao.metricas.receitasFuturas)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 flex items-center gap-1">
                  <TrendingDown size={14} className="text-red-600" />
                  Despesas previstas (30 dias)
                </span>
                <span className="text-sm font-semibold text-red-600">
                  -{formatCurrency(simulacao.metricas.despesasPrevistas)}
                </span>
              </div>
              {simulacao.metricas.faturasPendentes > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Faturas de cartão</span>
                  <span className="text-sm font-semibold text-red-600">
                    -{formatCurrency(simulacao.metricas.faturasPendentes)}
                  </span>
                </div>
              )}
              {simulacao.metricas.parcelasMensais > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Parcelamentos ativos</span>
                  <span className="text-sm font-semibold text-red-600">
                    -{formatCurrency(simulacao.metricas.parcelasMensais)}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-gray-900">Disponível (30 dias)</span>
                  <span className="text-sm font-bold text-gray-900">
                    {formatCurrency(simulacao.metricas.disponivel)}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Esta compra</span>
                  <span className="text-sm font-semibold text-red-600">
                    -{formatCurrency(simulacao.metricas.valorParcela)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-900">Sobraria</span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: simulacao.metricas.saldoApos >= 0 ? '#10b981' : '#ef4444' }}
                  >
                    {formatCurrency(simulacao.metricas.saldoApos)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recomendações */}
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Recomendações</h3>
            <ul className="space-y-2">
              {simulacao.recomendacoes.map((rec, i) => (
                <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                  <span className="text-blue-500 flex-shrink-0">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="card bg-gray-50 border-gray-200">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 leading-relaxed">
                Esta simulação considera seu saldo atual, receitas e despesas previstas para os
                próximos 30 dias, faturas de cartão e parcelamentos ativos. É uma estimativa para
                auxiliar sua decisão — ajuste conforme sua situação real.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {!simulacao && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Calculator size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Informe o valor da compra
          </h2>
          <p className="text-sm text-gray-500">
            Digite o valor e forma de pagamento para simular o impacto no seu orçamento
          </p>
        </div>
      )}
    </div>
  )
}
