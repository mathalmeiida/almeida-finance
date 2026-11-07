import React, { useEffect, useState } from 'react'
import { iniciaisDoNome } from '../lib/avatar'

// ─── Avatar do usuário ────────────────────────────────────────────────────────
// Mostra a foto de perfil (perfis.avatar_url) dentro do círculo. Sem foto — ou
// se a imagem falhar ao carregar (URL quebrada, sem conexão) — volta às
// iniciais, no MESMO visual que o app já usava. Nunca exibe imagem quebrada.
//
// variante:
//   'suave'     → fundo marca-100 + iniciais na cor da marca (cabeçalho/sidebar)
//   'gradiente' → gradiente vinho + iniciais brancas (Mais / Meu perfil)
export default function AvatarUsuario({
  url,
  nome,
  className = 'w-9 h-9',
  textoClassName = 'text-xs',
  variante = 'suave',
}) {
  const [falhou, setFalhou] = useState(false)
  const [carregada, setCarregada] = useState(false)

  // Nova URL (foto trocada) → tenta carregar de novo.
  useEffect(() => { setFalhou(false); setCarregada(false) }, [url])

  const mostrarFoto = !!url && !falhou
  const iniciais = iniciaisDoNome(nome)
  const fundo = variante === 'gradiente'
    ? { background: 'linear-gradient(135deg,#801D39,#420D1D)' }
    : undefined
  const classeFundo = variante === 'gradiente' ? 'text-white' : 'bg-marca-100 text-marca'

  return (
    <span
      className={`relative rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden font-bold ${classeFundo} ${className}`}
      style={fundo}
    >
      {/* Iniciais ficam por baixo até a foto terminar de carregar. */}
      {(!mostrarFoto || !carregada) && (
        <span className={textoClassName} aria-hidden="true">{iniciais}</span>
      )}
      {mostrarFoto && (
        <img
          src={url}
          alt={`Foto de perfil de ${nome || 'usuário'}`}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${carregada ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setCarregada(true)}
          onError={() => setFalhou(true)}
          draggable={false}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </span>
  )
}
