import React from 'react'
import logoAlmeida from '../assets/Logo Corporativo Almeida Finance.png'

// ─── Logo Almeida Finance sobre área de destaque na cor da marca ──────────────
// O logo ORIGINAL é branco; no tema claro ele some sobre fundo claro. Este
// componente coloca o logo (sem alterar o arquivo/desenho) sobre um painel
// arredondado na COR DA MARCA (bg-marca → azul #2855A5 ou rosa #B83F79,
// conforme a preferência do usuário, via a variável --marca). Assim o logo
// branco fica sempre legível e acompanha o tema automaticamente.
//
// Reutilizável em: sidebar, header mobile, splash, login, cadastro e demais
// telas de autenticação. Só visual — não toca em dados/cálculos.
//
// Props:
//   className   classes extras no painel (ex.: margens)
//   imgClassName tamanho/ajuste da imagem (padrão enxuto p/ sidebar)
//   padding     padding do painel (padrão 'p-4')
export default function LogoMarca({
  className = '',
  imgClassName = 'h-16 w-auto',
  padding = 'p-4',
}) {
  return (
    <div className={`inline-flex items-center justify-center rounded-2xl bg-marca shadow-sm ${padding} ${className}`}>
      <img
        src={logoAlmeida}
        alt="Almeida Finance"
        className={`object-contain ${imgClassName}`}
      />
    </div>
  )
}
