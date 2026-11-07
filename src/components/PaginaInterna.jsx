import React from 'react'

// Contêiner padrão das páginas internas do menu "Mais".
// O botão Voltar já vem do Layout (cabeçalho mobile e barra desktop), então aqui
// só entram título, descrição e uma coluna que respeita a largura disponível
// (min-w-0 / max-w-full — sem larguras fixas nem margens negativas).
export default function PaginaInterna({ titulo, descricao, children }) {
  return (
    <div className="w-full min-w-0 max-w-lg md:max-w-2xl mx-auto space-y-5 pt-3 pb-mobilenav md:pb-8">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-gray-900 break-words">{titulo}</h1>
        {descricao && <p className="text-sm text-gray-500 mt-1">{descricao}</p>}
      </div>
      {children}
    </div>
  )
}
