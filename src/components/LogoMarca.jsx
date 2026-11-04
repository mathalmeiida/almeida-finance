import React from 'react'

// ─── Logo Almeida Finance ─────────────────────────────────────────────────────
// Usa o PNG oficial em /branding/af-icone.png (public/).
// O PNG já tem fundo vinho arredondado — não precisa de painel extra.
//
// Props:
//   className     — classes extras no wrapper (ex.: margens)
//   imgClassName  — tamanho da imagem (padrão para telas de auth)
//   compact       — quando true, exibe versão menor (só o símbolo AF quadrado)
//   padding       — ignorado (mantido por compatibilidade com usos antigos)
export default function LogoMarca({
  className = '',
  imgClassName = 'h-16 w-auto',
  compact = false,
  padding = '',
}) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src="/branding/af-icone.png"
        alt="Almeida Finance"
        className={`object-contain ${compact ? 'h-10 w-10' : imgClassName}`}
        style={compact ? { minWidth: '40px' } : undefined}
      />
    </div>
  )
}
