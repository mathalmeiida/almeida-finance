import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, CheckCircle2, AlertCircle, Info as InfoIcon, ArrowRight } from 'lucide-react'
import { useAlertasFinanceiros } from '../hooks/useAlertasFinanceiros'

const ICONES_TIPO = {
  critico: AlertCircle,
  atencao: AlertCircle,
  info: InfoIcon,
  sucesso: CheckCircle2
}

export default function AlertasFinanceiros() {
  const { alertas, total, criticos, atencao } = useAlertasFinanceiros()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alertas Financeiros</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total === 0
              ? 'Tudo sob controle!'
              : `${total} alerta${total > 1 ? 's' : ''} ${criticos > 0 ? `(${criticos} crítico${criticos > 1 ? 's' : ''})` : ''}`}
          </p>
        </div>
      </div>

      {/* Resumo */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Críticos</p>
            <p className="text-2xl font-bold text-red-600">{criticos}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Atenção</p>
            <p className="text-2xl font-bold text-amber-600">{atencao}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Total</p>
            <p className="text-2xl font-bold text-gray-900">{total}</p>
          </div>
        </div>
      )}

      {/* Lista de alertas */}
      {alertas.length > 0 ? (
        <div className="space-y-3">
          {alertas.map((alerta) => {
            const IconeTipo = ICONES_TIPO[alerta.tipo]
            const bgClass = {
              critico: 'bg-red-50 border-red-200',
              atencao: 'bg-amber-50 border-amber-200',
              info: 'bg-blue-50 border-blue-200',
              sucesso: 'bg-green-50 border-green-200'
            }[alerta.tipo]

            const textClass = {
              critico: 'text-red-900',
              atencao: 'text-amber-900',
              info: 'text-blue-900',
              sucesso: 'text-green-900'
            }[alerta.tipo]

            return (
              <div key={alerta.id} className={`card ${bgClass}`}>
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{alerta.icone}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold mb-1 ${textClass}`}>
                      {alerta.titulo}
                    </h3>
                    <p className={`text-xs mb-3 ${textClass} opacity-80`}>
                      {alerta.descricao}
                    </p>
                    {alerta.acao && (
                      <Link
                        to={alerta.acao.link}
                        className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                        style={{ color: alerta.cor }}
                      >
                        {alerta.acao.texto}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                  <IconeTipo size={20} style={{ color: alerta.cor }} className="flex-shrink-0" />
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tudo sob controle!</h2>
          <p className="text-sm text-gray-500">
            Não há alertas financeiros no momento. Continue assim!
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-start gap-2">
          <InfoIcon size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            Os alertas são gerados automaticamente com base nas suas transações, metas e prazos.
            Revise-os regularmente para manter sua saúde financeira em dia.
          </p>
        </div>
      </div>
    </div>
  )
}
