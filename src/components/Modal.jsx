import React, { useEffect } from 'react'
import { X } from 'lucide-react'

// Larguras disponíveis para o painel no desktop. 'md' (padrão) preserva o
// comportamento atual de todos os modais; 'lg'/'xl' são para conteúdos mais
// largos (ex.: Horizonte Financeiro com 5 indicadores lado a lado).
const LARGURAS = {
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
}

export default function Modal({ aberto, onFechar, titulo, children, tamanho = 'md' }) {
  // Fecha com ESC
  useEffect(() => {
    function handler(e) {
      if (e.key === 'Escape') onFechar()
    }
    if (aberto) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [aberto, onFechar])

  // Bloqueia o scroll do conteúdo de fundo enquanto o modal está aberto.
  useEffect(() => {
    document.body.classList.toggle('no-scroll', aberto)
    return () => document.body.classList.remove('no-scroll')
  }, [aberto])

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onFechar}
      />
      {/* Painel — bottom sheet no mobile, card centralizado no desktop.
          Altura limitada à viewport (com safe-area no mobile) e scroll interno;
          o cabeçalho (título + X) fica fixo no topo. */}
      <div className={`relative bg-white w-full ${LARGURAS[tamanho] || LARGURAS.md} rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900 pr-2 truncate">{titulo}</h3>
          <button
            onClick={onFechar}
            className="touch-target -mr-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
