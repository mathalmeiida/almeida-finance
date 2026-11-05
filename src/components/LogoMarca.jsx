import React from 'react'

// ─── Logo Almeida Finance ─────────────────────────────────────────────────────
// Usa icon-192.png — fundo vinho sólido, sem transparência nos cantos.
// O ícone antigo (af-icone.png) tinha cantos transparentes → iOS mostrava
// moldura branca na Tela de Início. O novo tem fundo opaco vinho.
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
        src="/branding/icon-192.png"
        alt="Almeida Finance"
        className={`object-contain rounded-[18%] ${compact ? 'h-10 w-10' : imgClassName}`}
        style={compact ? { minWidth: '40px' } : undefined}
      />
    </div>
  )
}
