import React from 'react'

// ─── Logo Almeida Finance ─────────────────────────────────────────────────────
// Usa af-icone.png — logo AF com fundo vinho arredondado e padding transparente.
//
// IMPORTANTE — estrutura da imagem:
//   O af-icone.png é um PNG 1254×1254 com canal alpha. O conteúdo (shape vinho
//   arredondado com letras AF em branco) ocupa ~66% da área; o restante é
//   padding transparente que permite o iOS arredondar o ícone sem cortar a logo.
//   NÃO adicionar rounded-* sobre a imagem — ela já tem shape próprio arredondado
//   incorporado. Adicionar border-radius externo cria a "moldura dupla" percebida.
//
// icon-192.png (fundo vinho sólido, sem alpha) é usado APENAS para PWA/manifest/
// apple-touch-icon, onde o OS exige fundo opaco.
//
// Props:
//   className     — classes extras no wrapper div (ex.: margens)
//   imgClassName  — classes da <img> para controlar tamanho (ex.: "h-16 w-auto")
//   compact       — quando true, usa tamanho menor (sidebar recolhida)
//   padding       — ignorado (mantido para compatibilidade com chamadas antigas)
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
        // Sem rounded-* aqui — a imagem já tem shape arredondado incorporado.
        // object-contain preserva proporção sem distorção.
        className={`object-contain ${compact ? 'h-10 w-10' : imgClassName}`}
        style={compact ? { minWidth: '40px' } : undefined}
      />
    </div>
  )
}
