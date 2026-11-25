import React from 'react'
import { useDesfazer } from '../contexts/DesfazerContext'

/**
 * Componente de barra de desfazer - usa o contexto
 */
export function BarraDesfazer() {
  const { acaoAtual, desfazer, cancelar } = useDesfazer()
  
  if (!acaoAtual) return null

  return (
    <div 
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300"
      role="alert"
      aria-live="polite"
    >
      <div className="bg-gray-900 text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-4">
        <span className="text-sm font-medium">
          {acaoAtual.descricao}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={desfazer}
            className="text-sm font-semibold text-blue-300 hover:text-blue-200 transition-colors"
          >
            Desfazer
          </button>
          <button
            type="button"
            onClick={cancelar}
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
