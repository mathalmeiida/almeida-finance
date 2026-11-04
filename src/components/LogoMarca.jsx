import React from 'react'

// ─── Logo Almeida Finance ─────────────────────────────────────────────────────
// Usa o PNG oficial em /branding/almeida-finance-logo.png (public/).
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
  padding = '',   // backward-compat: não usado, PNG já tem espaçamento interno
}) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <img
        src="/branding/almeida-finance-logo.png"
        alt="Almeida Finance"
        className={`object-contain rounded-2xl ${compact ? 'h-10 w-10' : imgClassName}`}
        style={compact ? { minWidth: '40px' } : undefined}
      />
    </div>
  )
}
