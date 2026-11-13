/**
 * NavegacaoOnboardingAdaptativo.jsx
 * Navegação lateral mostrando progresso adaptativo do onboarding.
 * Exibe status de cada etapa (importada/parcial/confirmada/pendente).
 */

import React from 'react'
import { Check, FileCheck, AlertCircle, Circle } from 'lucide-react'
import { ETAPAS_ONBOARDING } from '../lib/onboardingFluxo'

const ICONES_STATUS = {
  importado: FileCheck,
  parcial: AlertCircle,
  pendente: Circle,
  confirmado: Check
}

const CORES_STATUS = {
  importado: 'text-blue-600 bg-blue-50 border-blue-200',
  parcial: 'text-amber-600 bg-amber-50 border-amber-200',
  pendente: 'text-gray-400 bg-gray-50 border-gray-200',
  confirmado: 'text-green-600 bg-green-50 border-green-200'
}

export default function NavegacaoOnboardingAdaptativo({
  etapaAtual,
  statusEtapas = {},
  onNavegar,
  className = ''
}) {
  const etapas = [
    { numero: 1, nome: 'Perfil', chave: 'perfil' },
    { numero: 2, nome: 'Importação', chave: 'importacao' },
    { numero: 3, nome: 'Saldo', chave: 'saldo' },
    { numero: 4, nome: 'Receitas', chave: 'renda' },
    { numero: 5, nome: 'Despesas', chave: 'despesas' },
    { numero: 6, nome: 'Cartões', chave: 'cartoes' },
    { numero: 7, nome: 'Metas', chave: 'metas' },
    { numero: 8, nome: 'Reserva', chave: 'reserva' }
  ]

  return (
    <div className={`space-y-2 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Progresso do cadastro
      </h3>

      <div className="space-y-1">
        {etapas.map((etapa) => {
          const status = statusEtapas[etapa.chave]
          const ehAtual = etapaAtual === etapa.numero
          const IconeStatus = status ? ICONES_STATUS[status] : Circle
          const corStatus = status ? CORES_STATUS[status] : 'text-gray-300 bg-white border-gray-200'

          return (
            <button
              key={etapa.chave}
              onClick={() => onNavegar?.(etapa.numero)}
              disabled={!onNavegar}
              className={`
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                transition-all duration-200
                ${ehAtual 
                  ? 'bg-[#5D0F26] bg-opacity-5 border-2 border-[#5D0F26] shadow-sm' 
                  : 'border border-transparent hover:bg-gray-50'
                }
                ${onNavegar ? 'cursor-pointer' : 'cursor-default'}
              `}
            >
              {/* Indicador de status */}
              <div 
                className={`
                  flex-shrink-0 h-8 w-8 rounded-full border flex items-center justify-center
                  transition-colors duration-200
                  ${corStatus}
                  ${ehAtual ? 'ring-2 ring-[#5D0F26] ring-opacity-20' : ''}
                `}
              >
                {status ? (
                  <IconeStatus className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-semibold text-gray-400">
                    {etapa.numero}
                  </span>
                )}
              </div>

              {/* Nome da etapa */}
              <div className="flex-1 text-left">
                <div className={`
                  text-sm font-medium
                  ${ehAtual ? 'text-[#5D0F26]' : 'text-gray-700'}
                `}>
                  {etapa.nome}
                </div>
                
                {/* Label do status */}
                {status && (
                  <div className="text-xs text-gray-500 mt-0.5">
                    {status === 'importado' && 'Dados importados'}
                    {status === 'parcial' && 'Precisa revisar'}
                    {status === 'pendente' && 'Aguardando'}
                    {status === 'confirmado' && 'Confirmado'}
                  </div>
                )}
              </div>

              {/* Indicador visual de etapa atual */}
              {ehAtual && (
                <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#5D0F26]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
