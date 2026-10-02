import React, { useState, useEffect } from 'react'
import { MessageCircle, Sparkles, UserCheck, BellRing, CheckCircle2 } from 'lucide-react'

export default function Consultoria() {
  const [avisado, setAvisado] = useState(false)

  // Esconde o aviso de "interesse registrado" após alguns segundos.
  useEffect(() => {
    if (!avisado) return
    const t = setTimeout(() => setAvisado(false), 4000)
    return () => clearTimeout(t)
  }, [avisado])

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <MessageCircle size={22} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Consultoria Financeira</h1>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              Em breve
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Planejamento personalizado com Matheus Almeida
          </p>
        </div>
      </div>

      {/* Texto introdutório */}
      <div className="card">
        <p className="text-sm text-gray-700 leading-relaxed">
          Em breve, você poderá contar com um atendimento individual para organizar suas finanças,
          definir metas e montar um plano financeiro personalizado.
        </p>
      </div>

      {/* Card em destaque */}
      <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <UserCheck size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              Atendimento personalizado
              <Sparkles size={15} className="text-amber-500" />
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Organize sua vida financeira com um planejamento feito de acordo com seus objetivos.
            </p>
          </div>
        </div>
      </div>

      {/* Interesse */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">Quer ser avisado quando lançar?</p>
            <p className="text-xs text-gray-500 mt-0.5">Avisaremos assim que a consultoria estiver disponível.</p>
          </div>
          <button
            onClick={() => setAvisado(true)}
            className="btn-primary flex items-center justify-center gap-2 flex-shrink-0"
          >
            <BellRing size={16} /> Quero ser avisado
          </button>
        </div>

        {avisado && (
          <div className="mt-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
            <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700">Interesse registrado! Em breve teremos novidades.</p>
          </div>
        )}
      </div>
    </div>
  )
}
