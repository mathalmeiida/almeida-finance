/**
 * FotoPerfil - Componente reutilizável para exibir foto/avatar/iniciais do usuário
 * 
 * Prioridade:
 * 1. Foto enviada (perfil.foto_url)
 * 2. Avatar predefinido (perfil.avatar_id)
 * 3. Iniciais do nome (fallback)
 */

import React from 'react'
import { obterAvatar, obterIniciais } from '../lib/avatares'

export default function FotoPerfil({ 
  perfil, 
  usuario, 
  tamanho = 'md',  // 'sm' | 'md' | 'lg' | 'xl'
  onClick,
  className = '',
  showEditIcon = false
}) {
  const fotoUrl = perfil?.foto_url
  const avatarId = perfil?.avatar_id
  const nome = perfil?.nome
  const email = usuario?.email

  // Tamanhos predefinidos
  const tamanhos = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl',
    xl: 'w-32 h-32 text-4xl'
  }

  const classesTamanho = tamanhos[tamanho] || tamanhos.md

  // 1. Se tiver foto, exibir a imagem
  if (fotoUrl) {
    return (
      <div 
        className={`${classesTamanho} rounded-full overflow-hidden flex-shrink-0 relative ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <img 
          src={fotoUrl} 
          alt="Foto de perfil" 
          className="w-full h-full object-cover"
        />
        {showEditIcon && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white text-xs font-semibold">Editar</span>
          </div>
        )}
      </div>
    )
  }

  // 2. Se tiver avatar, exibir o emoji
  if (avatarId) {
    const avatar = obterAvatar(avatarId)
    if (avatar) {
      return (
        <div 
          className={`${classesTamanho} rounded-full flex items-center justify-center flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
          style={{ background: avatar.cor + '20' }}
          onClick={onClick}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
        >
          <span className="text-3xl">{avatar.emoji}</span>
          {showEditIcon && (
            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-semibold">Editar</span>
            </div>
          )}
        </div>
      )
    }
  }

  // 3. Fallback: iniciais
  const iniciais = obterIniciais(nome, email)
  return (
    <div 
      className={`${classesTamanho} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''} ${className}`}
      style={{ background: 'linear-gradient(135deg,#801D39,#420D1D)' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {iniciais}
      {showEditIcon && (
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="text-white text-xs font-semibold">Editar</span>
        </div>
      )}
    </div>
  )
}
