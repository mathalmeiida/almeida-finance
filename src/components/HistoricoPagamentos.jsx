import React, { useState } from 'react'
import { Calendar, DollarSign, FileText, RotateCcw, Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '../lib/utils'

/**
 * Componente para exibir histórico de pagamentos de uma fatura.
 * 
 * Props:
 * - pagamentos: array de objetos pagamento
 * - onEstornar: function(pagamentoId, motivo)
 * - carregando: boolean
 * - mostrarDetalhes: boolean (default false) - expandir todos por padrão
 */
export default function HistoricoPagamentos({
  pagamentos = [],
  onEstornar,
  carregando = false,
  mostrarDetalhes = false
}) {
  const [expandido, setExpandido] = useState(mostrarDetalhes ? 'todos' : null)
  const [estornando, setEstornando] = useState(null)
  const [motivoEstorno, setMotivoEstorno] = useState('')

  // Pagamentos ativos (não estornados)
  const pagamentosAtivos = pagamentos.filter(p => !p.estornado)
  const pagamentosEstornados = pagamentos.filter(p => p.estornado)

  // Total pago (apenas não estornados)
  const totalPago = pagamentosAtivos.reduce((acc, p) => acc + (Number(p.valor_pago) || 0), 0)

  // Handler de estorno
  async function handleEstornar(pagamentoId) {
    if (!onEstornar) return

    const confirmado = confirm(
      'Tem certeza que deseja estornar este pagamento?\n\n' +
      'O valor será removido do total pago e o limite liberado será recalculado.'
    )

    if (!confirmado) return

    try {
      await onEstornar(pagamentoId, motivoEstorno.trim() || null)
      setEstornando(null)
      setMotivoEstorno('')
    } catch (err) {
      alert('Erro ao estornar pagamento: ' + (err.message || 'Erro desconhecido'))
    }
  }

  if (pagamentos.length === 0) {
    return (
      <div className="card text-center py-8">
        <FileText size={32} className="text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Nenhum pagamento registrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Resumo */}
      {pagamentosAtivos.length > 0 && (
        <div className="card bg-emerald-50 border-emerald-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={18} />
              <span className="text-sm font-medium">Total pago</span>
            </div>
            <span className="text-lg font-bold text-emerald-900">
              {formatCurrency(totalPago)}
            </span>
          </div>
          <p className="text-xs text-emerald-600 mt-1">
            {pagamentosAtivos.length} pagamento{pagamentosAtivos.length !== 1 ? 's' : ''} 
            {pagamentosEstornados.length > 0 && ` • ${pagamentosEstornados.length} estornado${pagamentosEstornados.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* Lista de pagamentos ativos */}
      {pagamentosAtivos.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Pagamentos realizados</h4>
          <div className="space-y-2">
            {pagamentosAtivos.map((pagamento) => {
              const estaExpandido = expandido === 'todos' || expandido === pagamento.id

              return (
                <div
                  key={pagamento.id}
                  className="card hover:bg-gray-50 transition-colors"
                >
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-base">
                          {formatCurrency(pagamento.valor_pago)}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          pagamento.tipo_pagamento === 'total'
                            ? 'bg-emerald-100 text-emerald-700'
                            : pagamento.tipo_pagamento === 'antecipado'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pagamento.tipo_pagamento === 'total' 
                            ? 'Total' 
                            : pagamento.tipo_pagamento === 'antecipado' 
                              ? 'Antecipado' 
                              : 'Parcial'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <Calendar size={11} />
                        {formatDate(pagamento.data_pagamento)}
                      </p>
                      {pagamento.observacao && (
                        <p className="text-xs text-gray-600 mt-1 italic truncate">
                          {pagamento.observacao}
                        </p>
                      )}
                    </div>

                    {/* Botão de estornar */}
                    {onEstornar && (
                      <button
                        type="button"
                        onClick={() => setEstornando(pagamento.id)}
                        disabled={carregando}
                        className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
                        title="Estornar pagamento"
                      >
                        <RotateCcw size={13} />
                        Estornar
                      </button>
                    )}
                  </div>

                  {/* Modal inline de estorno */}
                  {estornando === pagamento.id && (
                    <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                      <label className="label text-xs">Motivo do estorno (opcional)</label>
                      <textarea
                        value={motivoEstorno}
                        onChange={(e) => setMotivoEstorno(e.target.value)}
                        className="input text-sm resize-none"
                        rows="2"
                        placeholder="Ex: Pagamento duplicado, Erro no valor..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEstornando(null)
                            setMotivoEstorno('')
                          }}
                          className="btn-secondary flex-1 text-xs py-1.5"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEstornar(pagamento.id)}
                          disabled={carregando}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-1.5 text-xs font-medium flex-1 flex items-center justify-center gap-1.5"
                        >
                          {carregando ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              Estornando...
                            </>
                          ) : (
                            <>
                              <XCircle size={13} />
                              Confirmar estorno
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Lista de pagamentos estornados (colapsada por padrão) */}
      {pagamentosEstornados.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpandido(prev => prev === 'estornados' ? null : 'estornados')}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-2"
          >
            <XCircle size={14} />
            Pagamentos estornados ({pagamentosEstornados.length})
          </button>

          {expandido === 'estornados' && (
            <div className="space-y-2 opacity-60">
              {pagamentosEstornados.map((pagamento) => (
                <div
                  key={pagamento.id}
                  className="card bg-gray-50 border-gray-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-700 text-base line-through">
                          {formatCurrency(pagamento.valor_pago)}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                          Estornado
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <Calendar size={11} />
                        Pagamento: {formatDate(pagamento.data_pagamento)}
                      </p>
                      {pagamento.estornado_em && (
                        <p className="text-xs text-red-600 mt-0.5">
                          Estornado em: {formatDate(pagamento.estornado_em)}
                        </p>
                      )}
                      {pagamento.motivo_estorno && (
                        <p className="text-xs text-gray-600 mt-1 italic">
                          Motivo: {pagamento.motivo_estorno}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
