import React from 'react'

// Célula de valor em destaque (número grande, rótulo pequeno), compartilhada
// pelos simuladores de financiamento (imóvel e automóvel). Usa a surface do
// tema (bg-gray-50) e break-words para não cortar valores no mobile (320px).
export default function DestaqueValor({ rotulo, valor, cor = 'text-gray-900', sub }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 min-w-0">
      <p className="text-xs text-gray-500">{rotulo}</p>
      <p className={`text-lg font-bold break-words ${cor}`}>{valor}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
