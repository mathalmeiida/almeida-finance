import React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useOcultarValores } from '../contexts/OcultarValoresContext'

/**
 * Botão para alternar exibição de valores financeiros
 * 
 * Uso:
 * <BotaoOcultarValores />
 * 
 * Ou com props customizadas:
 * <BotaoOcultarValores 
 *   tamanho="sm" 
 *   variante="ghost"
 *   className="absolute top-4 right-4"
 * />
 */

export default function BotaoOcultarValores({ 
  tamanho = 'md',
  variante = 'secondary',
  className = '',
  mostrarTexto = false
}) {
  const { ocultar, alternar, sincronizando } = useOcultarValores()

  const tamanhos = {
    sm: {
      botao: 'p-1.5',
      icone: 14
    },
    md: {
      botao: 'p-2',
      icone: 18
    },
    lg: {
      botao: 'p-3',
      icone: 22
    }
  }

  const variantes = {
    primary: 'btn-primary',
    secondary: 'bg-white/10 hover:bg-white/20 text-white',
    ghost: 'hover:bg-gray-100 text-gray-700',
  }

  const config = tamanhos[tamanho]
  const classeVariante = variantes[variante]

  const Icon = ocultar ? EyeOff : Eye

  return (
    <button
      type="button"
      onClick={alternar}
      disabled={sincronizando}
      className={`
        ${config.botao}
        ${classeVariante}
        rounded-lg
        transition-all
        flex items-center gap-2
        ${sincronizando ? 'opacity-50 cursor-wait' : ''}
        ${className}
      `}
      title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
      aria-label={ocultar ? 'Mostrar valores financeiros' : 'Ocultar valores financeiros'}
      aria-pressed={ocultar}
    >
      <Icon size={config.icone} />
      {mostrarTexto && (
        <span className="text-sm font-medium">
          {ocultar ? 'Mostrar' : 'Ocultar'}
        </span>
      )}
    </button>
  )
}
