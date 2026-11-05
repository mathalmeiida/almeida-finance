import React, { useEffect } from 'react'

// ─── Splash screen de abertura ────────────────────────────────────────────────
// Puramente VISUAL: logo com fade+zoom suave e barra de carregamento.
// O App controla o tempo: quando `saindo` vira true, fade-out antes de remover.
export default function Splash({ saindo = false }) {
  // Remove o splash estático do index.html assim que o React monta.
  useEffect(() => {
    const estatico = document.getElementById('splash-inicial')
    if (estatico) estatico.remove()
    // Restaura o background para branco após o splash (tema claro padrão).
    document.documentElement.style.backgroundColor = ''
    document.body.style.backgroundColor = ''
  }, [])

  return (
    <div
      className={
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#3d0a18] px-6' +
        (saindo ? ' splash-fade-out' : '')
      }
    >
      {/* Logo oficial com fade + zoom suave */}
      <img
        src="/branding/icon-192.png"
        alt="Almeida Finance"
        className="animate-splash-logo w-32 max-w-[55vw] h-auto rounded-[22%]"
      />
      {/* Barra de carregamento indeterminada */}
      <div className="mt-8 w-44 max-w-[60vw] h-1.5 rounded-full bg-white/20 overflow-hidden">
        <div className="splash-bar h-full w-2/5 rounded-full bg-white/80" />
      </div>
      <p className="mt-4 text-sm text-white/60 tracking-widest uppercase">
        Organize&nbsp;•&nbsp;Planeje&nbsp;•&nbsp;Investa
      </p>
    </div>
  )
}
