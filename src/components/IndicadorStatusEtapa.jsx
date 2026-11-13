/**
 * IndicadorStatusEtapa.jsx
 * Badge discreto mostrando status de preenchimento de etapas do onboarding adaptativo.
 */

import React from 'react'
import { CheckCircle2, AlertCircle, FileCheck, Circle } from 'lucide-react'

const STATUS_CONFIG = {
  importado: {
    icone: FileCheck,
    label: 'Importado',
    cor: 'text-blue-600 bg-blue-50',
    borda: 'border-blue-200'
  },
  parcial: {
    icone: AlertCircle,
    label: 'Precisa revisar',
    cor: 'text-amber-600 bg-amber-50',
    borda: 'border-amber-200'
  },
  pendente: {
    icone: Circle,
    label: 'Informação pendente',
    cor: 'text-gray-500 bg-gray-50',
    borda: 'border-gray-200'
  },
  confirmado: {
    icone: CheckCircle2,
    label: 'Confirmado',
    cor: 'text-green-600 bg-green-50',
    borda: 'border-green-200'
  }
}

export default function IndicadorStatusEtapa({ status, className = '', tamanho = 'md' }) {
  if (!status || !STATUS_CONFIG[status]) return null

  const config = STATUS_CONFIG[status]
  const Icone = config.icone

  const tamanhosIcone = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  }

  const tamanhosFonte = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  const espacamento = {
    sm: 'px-2 py-0.5 gap-1',
    md: 'px-3 py-1 gap-1.5',
    lg: 'px-4 py-1.5 gap-2'
  }

  return (
    <div 
      className={`
        inline-flex items-center rounded-full border
        ${config.cor} ${config.borda}
        ${espacamento[tamanho]} ${tamanhosFonte[tamanho]}
        font-medium ${className}
      `}
      title={config.label}
    >
      <Icone className={tamanhosIcone[tamanho]} />
      <span>{config.label}</span>
    </div>
  )
}

// Componente compacto apenas com ícone (para espaços reduzidos)
export function IndicadorStatusIcone({ status, className = '', tamanho = 'md' }) {
  if (!status || !STATUS_CONFIG[status]) return null

  const config = STATUS_CONFIG[status]
  const Icone = config.icone

  const tamanhosIcone = {
    sm: 'h-4 w-4 p-0.5',
    md: 'h-5 w-5 p-1',
    lg: 'h-6 w-6 p-1.5'
  }

  return (
    <div 
      className={`
        inline-flex items-center justify-center rounded-full
        ${config.cor} ${config.borda}
        ${tamanhosIcone[tamanho]} border ${className}
      `}
      title={config.label}
    >
      <Icone className="h-full w-full" />
    </div>
  )
}
