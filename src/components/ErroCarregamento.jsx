import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function ErroCarregamento({ mensagem, onTentarNovamente }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          Erro ao carregar
        </h1>
        <p className="text-gray-600 mb-6">
          {mensagem || 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'}
        </p>
        <button
          onClick={onTentarNovamente}
          className="w-full bg-marca text-white py-3 px-4 rounded-lg font-medium hover:bg-marca-700 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw size={20} />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
