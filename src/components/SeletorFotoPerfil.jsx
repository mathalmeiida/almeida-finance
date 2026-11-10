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
import { validarArquivoFoto, ehHeic, caminhoFoto, caminhoNovaFoto, mensagemErroFoto } from '../lib/fotoPerfil'
import { useUrlFoto } from '../hooks/useUrlFoto'
import RecorteFoto from './RecorteFoto'

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
  const [imagem, setImagem] = useState(null)
  const [carregandoImagem, setCarregandoImagem] = useState(false)
  const inputRef = useRef(null)
  const recorteRef = useRef(null)

  const userId = usuario?.id
  const fotoAtual = perfil?.foto_url
  const urlFotoAtual = useUrlFoto(fotoAtual)
  const avatarAtual = perfil?.avatar_id

  // Remove o arquivo antigo do bucket (depois que a nova foto já foi salva).
  async function removerArquivoAntigo() {
    const caminho = caminhoFoto(fotoAtual)
    if (caminho) await supabase.storage.from('avatares').remove([caminho]).catch(() => {})
  }

  // Seleciona e decodifica a imagem no aparelho (a orientação EXIF é
  // respeitada pelo navegador). Fotos grandes são aceitas: o envio é sempre
  // um JPEG de 512 px.
  async function handleFileSelect(e) {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher a mesma foto de novo
    if (!arquivo) return
    const erroValidacao = validarArquivoFoto(arquivo)
    if (erroValidacao) { setErro(erroValidacao); return }
    setErro('')
    setCarregandoImagem(true)
    const url = URL.createObjectURL(arquivo)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('sem dimensões')
      setImagem(img)
      setPreviewUrl(url)
    } catch {
      URL.revokeObjectURL(url)
      setErro(ehHeic(arquivo)
        ? 'Este navegador não abre fotos HEIC. No iPhone, escolha a foto pela Fototeca; no computador, converta para JPG.'
        : 'Não foi possível abrir esta imagem. O arquivo pode estar corrompido.')
    } finally {
      setCarregandoImagem(false)
    }
  }

  function descartarSelecao() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setImagem(null)
  }

  // Envia a foto recortada. Ordem segura: 1) envia o arquivo novo; 2) grava o
  // caminho no perfil; 3) só então remove o antigo. Se o passo 2 falhar, o
  // arquivo novo é apagado e a foto atual continua valendo.
  async function handleUploadFoto() {
    if (!imagem || !userId || enviando) return
    setEnviando(true)
    setErro('')
    let caminhoNovo = null
    try {
      const blob = await recorteRef.current.gerarBlob()
      caminhoNovo = caminhoNovaFoto(userId)
      const { error: uploadError } = await supabase.storage
        .from('avatares')
        .upload(caminhoNovo, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      const { error: updateError } = await supabase
        .from('perfis')
        .update({ foto_url: caminhoNovo, avatar_id: null, foto_atualizada_em: new Date().toISOString() })
        .eq('id', userId)
      if (updateError) throw updateError
      caminhoNovo = null // gravado com sucesso: não apagar

      await removerArquivoAntigo()
      if (onAtualizar) await onAtualizar()
      descartarSelecao()
      onFechar()
    } catch (err) {
      if (caminhoNovo) await supabase.storage.from('avatares').remove([caminhoNovo]).catch(() => {})
      setErro(mensagemErroFoto(err))
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
        const pathAntigo = caminhoFoto(fotoAtual)
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
        const pathAntigo = caminhoFoto(fotoAtual)
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
      const pathAntigo = caminhoFoto(fotoAtual)
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

      descartarSelecao()
    } catch (err) {
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
                    src={urlFotoAtual || undefined}
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
                accept="image/*"
                data-testid="foto-arquivo"
                onChange={handleFileSelect}
                className="hidden"
              />

              {previewUrl && imagem ? (
                <div className="space-y-3">
                  <RecorteFoto ref={recorteRef} imagem={imagem} />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      disabled={enviando}
                      className="flex-1 btn-secondary text-sm"
                    >
                      Trocar foto
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
                        <><Check size={16} /> Salvar foto</>
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
                        {carregandoImagem ? 'Abrindo foto...' : 'JPG, PNG, WebP ou HEIC'}
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
