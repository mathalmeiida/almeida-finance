// Página de teste dos tokens semânticos do tema
import React from 'react'

export default function TesteTokens() {
  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="bg-surface rounded-2xl border border-border-col p-6">
          <h1 className="text-2xl font-bold text-text-pri mb-2">Tokens Semânticos</h1>
          <p className="text-text-sec mb-4">Testando variáveis do tema responsivo</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-2 rounded-lg p-4">
              <h3 className="font-semibold text-text-pri mb-2">Surface 2</h3>
              <p className="text-sm text-text-sec">Elevação suave</p>
            </div>
            
            <div className="bg-marca rounded-lg p-4 text-white">
              <h3 className="font-semibold mb-2">Marca</h3>
              <p className="text-sm opacity-90">Cor de ação</p>
            </div>
            
            <div className="bg-marca-50 rounded-lg p-4">
              <h3 className="font-semibold text-marca mb-2">Marca 50</h3>
              <p className="text-sm text-text-sec">8% opacidade</p>
            </div>
            
            <div className="bg-accent/10 border border-accent rounded-lg p-4">
              <h3 className="font-semibold text-accent mb-2">Accent</h3>
              <p className="text-sm text-text-sec">Destaques</p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-marca-100 rounded-lg border border-marca-150">
            <p className="text-marca font-medium">Botão estilo marca-100</p>
          </div>
          
          <div className="mt-4 flex gap-3">
            <button className="px-4 py-2 bg-marca hover:bg-marca-hover text-white rounded-lg transition-colors">
              Botão Primário
            </button>
            <button className="px-4 py-2 bg-surface-2 border border-border-col text-text-pri rounded-lg hover:bg-marca-50 transition-colors">
              Botão Secundário
            </button>
          </div>
        </div>
        
        <div className="bg-surface rounded-xl p-4 border border-border-col">
          <h2 className="font-bold text-text-pri mb-2">Status dos Tokens</h2>
          <ul className="space-y-1 text-sm text-text-sec">
            <li>✅ bg, surface, surface-2</li>
            <li>✅ text-pri, text-sec</li>
            <li>✅ border-col</li>
            <li>✅ marca, marca-hover, marca-50/100/150/200</li>
            <li>✅ accent</li>
          </ul>
        </div>
        
      </div>
    </div>
  )
}
