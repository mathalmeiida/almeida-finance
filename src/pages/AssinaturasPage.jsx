import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Tv, CheckCircle2, XCircle, Calendar, TrendingUp, Info } from 'lucide-react'
import { useAssinaturas } from '../hooks/useAssinaturas'
import { formatCurrency } from '../lib/utils'

export default function AssinaturasPage() {
  const { ativas, canceladas, totalMensal, totalAtivas, totalCanceladas } = useAssinaturas()
  const [aba, setAba] = useState('ativas') // 'ativas' | 'canceladas'

  const lista = aba === 'ativas' ? ativas : canceladas

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assinaturas</h1>
          <p className="text-sm text-gray-500 mt-1">Gerencie seus gastos recorrentes</p>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Ativas</p>
          <p className="text-2xl font-bold text-green-600">{totalAtivas}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">Total mensal</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalMensal)}</p>
        </div>
        <div className="card text-center col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Canceladas (60 dias)</p>
          <p className="text-2xl font-bold text-red-600">{totalCanceladas}</p>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAba('ativas')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            aba === 'ativas'
              ? 'text-marca'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Ativas ({totalAtivas})
          {aba === 'ativas' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-marca" />
          )}
        </button>
        <button
          onClick={() => setAba('canceladas')}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            aba === 'canceladas'
              ? 'text-marca'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Canceladas ({totalCanceladas})
          {aba === 'canceladas' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-marca" />
          )}
        </button>
      </div>

      {/* Lista */}
      {lista.length > 0 ? (
        <div className="space-y-3">
          {lista.map((assinatura) => (
            <div key={assinatura.id} className="card">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  assinatura.ativa ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  {assinatura.ativa ? (
                    <CheckCircle2 size={20} className="text-green-600" />
                  ) : (
                    <XCircle size={20} className="text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                      {assinatura.descricao}
                    </h3>
                    <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                      {formatCurrency(assinatura.valorMensal)}/mês
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {assinatura.categoria && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        {assinatura.categoria}
                      </span>
                    )}
                    {assinatura.ativa && assinatura.proximoVencimento && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        Próximo: {new Date(assinatura.proximoVencimento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                    {!assinatura.ativa && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle size={12} />
                        Última há {assinatura.diasDesdeUltima} dias
                      </span>
                    )}
                    <span className="text-gray-400">
                      {assinatura.ocorrencias} ocorrência{assinatura.ocorrencias > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Tv size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            {aba === 'ativas' ? 'Sem assinaturas ativas' : 'Sem assinaturas canceladas'}
          </h2>
          <p className="text-sm text-gray-500">
            {aba === 'ativas'
              ? 'Suas despesas recorrentes aparecerão aqui automaticamente'
              : 'Assinaturas canceladas nos últimos 60 dias aparecerão aqui'}
          </p>
        </div>
      )}

      {/* Dicas */}
      {totalAtivas > 0 && aba === 'ativas' && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <TrendingUp size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Dica de economia</h3>
              <p className="text-sm text-blue-700 mb-3">
                Revise suas assinaturas regularmente. Cancele as que você não usa mais.
                Economize até {formatCurrency(totalMensal * 0.3)} por mês eliminando 30% delas!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Identificamos assinaturas automaticamente com base em despesas fixas e palavras-chave
            (streaming, academia, internet, etc.). Despesas com mesmo nome e valor são agrupadas.
            Assinaturas sem ocorrência há mais de 60 dias aparecem como canceladas.
          </p>
        </div>
      </div>
    </div>
  )
}
