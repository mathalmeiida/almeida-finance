/**
 * SeletorFotoPerfil - Componente para selecionar foto, avatar ou usar iniciais
 * 
 * Permite ao usuário:
 * - Enviar foto da galeria/computador (JPG, PNG, WebP)
 * - Escolher avatar predefinido
 * - Continuar usando as iniciais (padrão)
 * 
 * Armazena fotos no Supabase Storage (bucket 'avatares')
 * Salva escolha em perfis.foto_url / perfis.avatar_id
 */

import React, { useState, useRef } from 'react'
import { Upload, Grid3x3, Type, X, Check, Loader2, Camera, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AVATARES_PREDEFINIDOS } from '../lib/avatares'

export default function SeletorFotoPerfil({ 
  usuario, 
  perfil, 
  onAtualizar,
  onFechar 
}) {
  const [aba, setAba] = useState('foto') // 'foto' | 'avatar' | 'iniciais'
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null)
  const inputRef = useRef(null)

  const userId = usuario?.id
  const fotoAtual = perfil?.foto_url
  const avatarAtual = perfil?.avatar_id

  // Validação de arquivo
  function validarArquivo(arquivo) {
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp']
    const tamanhoMax = 5 * 1024 * 1024 // 5MB

    if (!tiposPermitidos.includes(arquivo.type)) {
      return 'Formato não suportado. Use JPG, PNG ou WebP.'
    }

    if (arquivo.size > tamanhoMax) {
      return 'Arquivo muito grande. Máximo 5MB.'
    }

    return null
  }

  // Selecionar arquivo
  function handleFileSelect(e) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return

    const erroValidacao = validarArquivo(arquivo)
    if (erroValidacao) {
      setErro(erroValidacao)
      return
    }

    setErro('')
    setArquivoSelecionado(arquivo)
    
    // Gerar preview
    const reader = new FileReader()
    reader.onload = (event) => {
      setPreviewUrl(event.target.result)
    }
    reader.readAsDataURL(arquivo)
  }

  // Fazer upload da foto
  async function handleUploadFoto() {
    if (!arquivoSelecionado || !userId) return

    setEnviando(true)
    setErro('')

    try {
      // 1. Remover foto antiga se existir
      if (fotoAtual) {
        const pathAntigo = fotoAtual.split('/avatares/')[1]
        if (pathAntigo) {
          await supabase.storage
            .from('avatares')
            .remove([pathAntigo])
        }
      }

      // 2. Upload novo arquivo
      const ext = arquivoSelecionado.name.split('.').pop()
      const nomeArquivo = `${userId}/perfil-${Date.now()}.${ext}`
      
      const { error: uploadError } = await supabase.storage
        .from('avatares')
        .upload(nomeArquivo, arquivoSelecionado, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) throw uploadError

      // 3. Obter URL pública (assinada para acesso privado)
      const { data: { publicUrl } } = supabase.storage
        .from('avatares')
        .getPublicUrl(nomeArquivo)

      // 4. Atualizar perfil no banco
      const { error: updateError } = await supabase
        .from('perfis')
        .update({
          foto_url: publicUrl,
          avatar_id: null,  // Remove avatar se tinha
          foto_atualizada_em: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // 5. Notificar componente pai
      if (onAtualizar) {
        await onAtualizar()
      }

      onFechar()
    } catch (err) {
      console.error('Erro ao fazer upload:', err)
      setErro(err.message || 'Erro ao fazer upload da foto.')
    } finally {
      setEnviando(false)
    }
  }

  // Escolher avatar predefinido
  async function handleEscolherAvatar(avatarId) {
    if (!userId) return

    setEnviando(true)
    setErro('')

    try {
      // 1. Remover foto se existir
      if (fotoAtual) {
        const pathAntigo = fotoAtual.split('/avatares/')[1]
        if (pathAntigo) {
          await supabase.storage
            .from('avatares')
            .remove([pathAntigo])
        }
      }

      // 2. Atualizar perfil
      const { error: updateError } = await supabase
        .from('perfis')
        .update({
          foto_url: null,  // Remove foto
          avatar_id: avatarId,
          foto_atualizada_em: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // 3. Notificar componente pai
      if (onAtualizar) {
        await onAtualizar()
      }

      onFechar()
    } catch (err) {
      console.error('Erro ao selecionar avatar:', err)
      setErro(err.message || 'Erro ao selecionar avatar.')
    } finally {
      setEnviando(false)
    }
  }

  // Usar iniciais (remover foto e avatar)
  async function handleUsarIniciais() {
    if (!userId) return

    setEnviando(true)
    setErro('')

    try {
      // 1. Remover foto se existir
      if (fotoAtual) {
        const pathAntigo = fotoAtual.split('/avatares/')[1]
        if (pathAntigo) {
          await supabase.storage
            .from('avatares')
            .remove([pathAntigo])
        }
      }

      // 2. Atualizar perfil
      const { error: updateError } = await supabase
        .from('perfis')
        .update({
          foto_url: null,
          avatar_id: null,
          foto_atualizada_em: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // 3. Notificar componente pai
      if (onAtualizar) {
        await onAtualizar()
      }

      onFechar()
    } catch (err) {
      console.error('Erro ao remover foto/avatar:', err)
      setErro(err.message || 'Erro ao atualizar perfil.')
    } finally {
      setEnviando(false)
    }
  }

  // Remover foto atual
  async function handleRemoverFoto() {
    if (!userId || !fotoAtual) return

    setEnviando(true)
    setErro('')

    try {
      // 1. Remover do storage
      const pathAntigo = fotoAtual.split('/avatares/')[1]
      if (pathAntigo) {
        await supabase.storage
          .from('avatares')
          .remove([pathAntigo])
      }

      // 2. Atualizar perfil
      const { error: updateError } = await supabase
        .from('perfis')
        .update({
          foto_url: null,
          foto_atualizada_em: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // 3. Notificar componente pai
      if (onAtualizar) {
        await onAtualizar()
      }

      setPreviewUrl(null)
      setArquivoSelecionado(null)
    } catch (err) {
      console.error('Erro ao remover foto:', err)
      setErro(err.message || 'Erro ao remover foto.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Alterar foto de perfil</h3>
          <button 
            type="button" 
            onClick={onFechar}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Abas */}
        <div className="border-b border-gray-200 px-5">
          <div className="flex gap-1">
            {[
              { id: 'foto', label: 'Enviar foto', icon: Upload },
              { id: 'avatar', label: 'Escolher avatar', icon: Grid3x3 },
              { id: 'iniciais', label: 'Usar iniciais', icon: Type }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setAba(id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  aba === id
                    ? 'border-marca text-marca font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon size={16} />
                <span className="text-sm">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="p-5">
          {erro && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          )}

          {/* Aba: Enviar foto */}
          {aba === 'foto' && (
            <div className="space-y-4">
              {fotoAtual && !previewUrl && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <img 
                    src={fotoAtual} 
                    alt="Foto atual" 
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Foto atual</p>
                    <p className="text-xs text-gray-500">Carregada anteriormente</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoverFoto}
                    disabled={enviando}
                    className="text-red-600 hover:text-red-700 p-2"
                    title="Remover foto"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )}

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              {previewUrl ? (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <img 
                      src={previewUrl} 
                      alt="Preview" 
                      className="w-32 h-32 rounded-full object-cover border-4 border-marca-100"
                    />
                  </div>
                  <p className="text-sm text-center text-gray-600">
                    Pré-visualização da foto selecionada
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={enviando}
                      className="flex-1 btn-secondary text-sm"
                    >
                      Escolher outra
                    </button>
                    <button
                      type="button"
                      onClick={handleUploadFoto}
                      disabled={enviando}
                      className="flex-1 btn-primary text-sm flex items-center justify-center gap-2"
                    >
                      {enviando ? (
                        <><Loader2 size={16} className="animate-spin" /> Enviando...</>
                      ) : (
                        <><Check size={16} /> Confirmar</>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={enviando}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 hover:border-marca hover:bg-marca-100/20 transition-colors"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-marca-100 flex items-center justify-center">
                      <Camera size={28} className="text-marca" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">Selecionar foto</p>
                      <p className="text-sm text-gray-500 mt-1">
                        JPG, PNG ou WebP • Máximo 5MB
                      </p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* Aba: Escolher avatar */}
          {aba === 'avatar' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Escolha um avatar predefinido para representar seu perfil
              </p>
              <div className="grid grid-cols-3 gap-3">
                {AVATARES_PREDEFINIDOS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleEscolherAvatar(avatar.id)}
                    disabled={enviando}
                    className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${
                      avatarAtual === avatar.id
                        ? 'border-marca bg-marca-100/20'
                        : 'border-gray-200 hover:border-marca'
                    }`}
                  >
                    <div 
                      className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-3xl"
                      style={{ background: avatar.cor + '20' }}
                    >
                      {avatar.emoji}
                    </div>
                    <p className="text-xs text-center text-gray-600 mt-2">
                      {avatar.nome}
                    </p>
                    {avatarAtual === avatar.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-marca rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Aba: Usar iniciais */}
          {aba === 'iniciais' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Use as iniciais do seu nome como foto de perfil
              </p>
              <div className="flex justify-center">
                <div 
                  className="w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#801D39,#420D1D)' }}
                >
                  {(perfil?.nome || usuario?.email?.split('@')[0] || 'U').slice(0, 2).toUpperCase()}
                </div>
              </div>
              <button
                type="button"
                onClick={handleUsarIniciais}
                disabled={enviando}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                {enviando ? (
                  <><Loader2 size={16} className="animate-spin" /> Salvando...</>
                ) : (
                  <><Check size={16} /> Usar iniciais</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
