import React, { useEffect } from 'react'
import logoAlmeida from '../assets/Logo Corporativo Almeida Finance.png'

// ─── Splash screen de abertura ────────────────────────────────────────────────
// Puramente VISUAL: fundo escuro do tema, logo com fade+zoom suave e um
// indicador de carregamento elegante. Não toca em autenticação nem dados.
// O App controla o tempo: a logo entra com fade-in, permanece visível e, quando
// `saindo` vira true, a tela inteira faz fade-out suave antes de ser removida.
export default function Splash({ saindo = false }) {
  // Ao montar a splash do React, removemos o splash estático do index.html
  // (eles compartilham o mesmo fundo escuro, então a troca é imperceptível).
  useEffect(() => {
    const estatico = document.getElementById('splash-inicial')
    if (estatico) estatico.remove()
  }, [])

  return (
    <div
      className={
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-50 px-6' +
        (saindo ? ' splash-fade-out' : '')
      }
    >
      {/* Logo com animação fade + zoom suave */}
      <img
        src={logoAlmeida}
        alt="Almeida Finance"
        className="w-56 max-w-[70vw] h-auto object-contain animate-splash-logo"
      />
      {/* Indicador de carregamento discreto abaixo da logo */}
      <div className="mt-8 w-9 h-9 rounded-full border-[3px] border-white/15 border-t-blue-500 animate-spin" />
    </div>
  )
}
