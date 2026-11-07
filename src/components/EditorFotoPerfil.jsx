import React, { useEffect, useRef, useState } from 'react'
import { Camera, ImageIcon, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import Modal from './Modal'
import AvatarUsuario from './AvatarUsuario'
import { useAuth } from '../contexts/AuthContext'
import { processarImagemAvatar } from '../lib/avatar'

// ─── Editor da foto de perfil (página "Meu perfil") ──────────────────────────
// Toque no avatar → opções:
//   • Escolher foto da galeria (no computador: escolher arquivo)
//   • Tirar uma foto (celular: câmera nativa; computador: webcam)
//   • Remover foto (quando já existe uma)
// Quando já há foto, o painel se chama "Alterar foto atual" e mostra a foto.
// Antes de salvar, a imagem (já recortada e comprimida) é exibida para
// confirmação. O envio vai para o Supabase Storage e a URL fica em
// perfis.avatar_url — o AuthContext atualiza todas as telas na hora.

// Celular/tablet: o <input capture> abre a câmera nativa. Computador: usamos a
// webcam via getUserMedia (o atributo capture é ignorado no desktop).
function usarCameraNativa() {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return true
  } catch { /* ignora */ }
  return !navigator.mediaDevices?.getUserMedia
}

export default function EditorFotoPerfil({ nome, onMensagem }) {
  const { perfilProprio, salvarFotoPerfil, removerFotoPerfil, somenteLeitura } = useAuth()
  const fotoAtual = perfilProprio?.avatar_url || null

  // null | 'opcoes' | 'webcam' | 'previa' | 'remover'
  const [painel, setPainel] = useState(null)
  const [processando, setProcessando] = useState(false) // comprimindo a imagem
  const [enviando, setEnviando] = useState(false)       // upload / remoção
  const [imagem, setImagem] = useState(null)            // { blob, tipo, extensao }
  const [previaUrl, setPreviaUrl] = useState(null)
  const [erro, setErro] = useState('')
  // Sucesso é exibido pela página (fora do card do avatar) via onMensagem.
  const setSucesso = (texto) => onMensagem?.(texto ? { tipo: 'sucesso', texto } : null)

  const inputGaleria = useRef(null)
  const inputCamera = useRef(null)

  // Libera a URL temporária da prévia.
  useEffect(() => () => { if (previaUrl) URL.revokeObjectURL(previaUrl) }, [previaUrl])

  function limparSelecao() {
    setImagem(null)
    setPreviaUrl(null)
  }

  function fechar() {
    if (enviando) return
    setPainel(null)
    limparSelecao()
  }

  function abrirOpcoes() {
    if (somenteLeitura) return
    setErro('')
    setSucesso('')
    setPainel('opcoes')
  }

  function escolherDaGaleria() {
    setErro('')
    inputGaleria.current?.click()
  }

  function tirarFoto() {
    setErro('')
    if (usarCameraNativa()) inputCamera.current?.click()
    else setPainel('webcam')
  }

  // Arquivo escolhido (galeria, câmera nativa ou webcam) → comprime → prévia.
  async function prepararImagem(arquivo) {
    if (!arquivo) return
    setProcessando(true)
    setErro('')
    try {
      const resultado = await processarImagemAvatar(arquivo)
      setImagem(resultado)
      setPreviaUrl(URL.createObjectURL(resultado.blob))
      setPainel('previa')
    } catch (e) {
      setErro(e?.message || 'Não foi possível usar esta imagem.')
      setPainel('opcoes')
    } finally {
      setProcessando(false)
    }
  }

  function aoSelecionarArquivo(e) {
    const arquivo = e.target.files?.[0]
    // Zera o valor para permitir escolher o MESMO arquivo de novo depois.
    e.target.value = ''
    prepararImagem(arquivo)
  }

  async function salvar() {
    if (!imagem || enviando) return
    setEnviando(true)
    setErro('')
    try {
      await salvarFotoPerfil(imagem)
      setPainel(null)
      limparSelecao()
      setSucesso(fotoAtual ? 'Foto de perfil atualizada.' : 'Foto de perfil adicionada.')
    } catch (e) {
      setErro(e?.message || 'Não foi possível salvar a foto. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  async function remover() {
    if (enviando) return
    setEnviando(true)
    setErro('')
    try {
      await removerFotoPerfil()
      setPainel(null)
      setSucesso('Foto de perfil removida.')
    } catch (e) {
      setErro(e?.message || 'Não foi possível remover a foto. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  const avatar = (
    <AvatarUsuario url={fotoAtual} nome={nome} variante="gradiente"
      className="w-16 h-16" textoClassName="text-xl" />
  )

  return (
    <>
      {somenteLeitura ? avatar : (
        <button
          type="button"
          onClick={abrirOpcoes}
          className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-marca focus-visible:ring-offset-2"
          aria-label={fotoAtual ? 'Alterar foto de perfil' : 'Adicionar foto de perfil'}
          aria-haspopup="dialog"
        >
          {avatar}
          {/* Ícone de câmera sobreposto */}
          <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white border border-gray-200 shadow flex items-center justify-center">
            {processando
              ? <Loader2 size={13} className="text-marca animate-spin" />
              : <Camera size={13} className="text-marca" />}
          </span>
        </button>
      )}

      {/* Entradas de arquivo (ocultas). accept="image/*" faz o iOS converter
          fotos HEIC para JPEG automaticamente. */}
      <input ref={inputGaleria} type="file" accept="image/*" className="hidden"
        onChange={aoSelecionarArquivo} data-testid="input-foto-galeria" />
      <input ref={inputCamera} type="file" accept="image/*" capture="user" className="hidden"
        onChange={aoSelecionarArquivo} data-testid="input-foto-camera" />

      {/* Opções */}
      <Modal
        aberto={painel === 'opcoes'}
        onFechar={fechar}
        titulo={fotoAtual ? 'Alterar foto atual' : 'Adicionar foto de perfil'}
      >
        {fotoAtual && (
          <div className="flex justify-center mb-4">
            <AvatarUsuario url={fotoAtual} nome={nome} variante="gradiente"
              className="w-28 h-28" textoClassName="text-3xl" />
          </div>
        )}
        {erro && <AlertaErro texto={erro} />}
        {processando ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin text-marca" /> Preparando imagem...
          </div>
        ) : (
          <div className="space-y-2">
            <OpcaoFoto Icone={ImageIcon} titulo="Escolher foto da galeria"
              detalhe="Do celular ou um arquivo do computador" onClick={escolherDaGaleria} />
            <OpcaoFoto Icone={Camera} titulo="Tirar uma foto"
              detalhe="Usar a câmera do dispositivo" onClick={tirarFoto} />
            {fotoAtual && (
              <OpcaoFoto Icone={Trash2} titulo="Remover foto" detalhe="Voltar a exibir suas iniciais"
                perigo onClick={() => { setErro(''); setPainel('remover') }} />
            )}
            <p className="text-[11px] text-gray-400 text-center pt-1">
              JPG, PNG, WEBP ou HEIC, até 15 MB. A imagem é recortada e otimizada antes do envio.
            </p>
          </div>
        )}
      </Modal>

      {/* Webcam (computador) */}
      {painel === 'webcam' && (
        <CapturaWebcam
          onFechar={() => setPainel('opcoes')}
          onCapturar={(arquivo) => prepararImagem(arquivo)}
          onErro={(msg) => { setErro(msg); setPainel('opcoes') }}
        />
      )}

      {/* Prévia antes de salvar */}
      <Modal aberto={painel === 'previa'} onFechar={fechar} titulo="Pré-visualização">
        <div className="flex flex-col items-center">
          {previaUrl && (
            <img src={previaUrl} alt="Pré-visualização da nova foto de perfil"
              className="w-40 h-40 rounded-full object-cover shadow-md ring-4 ring-marca-100" />
          )}
          <p className="text-xs text-gray-500 mt-3 text-center">
            Assim sua foto vai aparecer no app.
            {imagem?.blob && <> ({Math.max(1, Math.round(imagem.blob.size / 1024))} KB)</>}
          </p>
          {erro && <div className="w-full mt-3"><AlertaErro texto={erro} /></div>}
          <div className="w-full flex flex-col gap-2 mt-5">
            <button type="button" onClick={salvar} disabled={enviando}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
              {enviando ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : 'Salvar foto'}
            </button>
            <button type="button" onClick={() => { limparSelecao(); setErro(''); setPainel('opcoes') }}
              disabled={enviando} className="btn-secondary w-full flex items-center justify-center gap-2">
              <RefreshCw size={14} /> Escolher outra
            </button>
            <button type="button" onClick={fechar} disabled={enviando}
              className="text-sm text-gray-500 py-2 hover:text-gray-700">
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmação de remoção */}
      <Modal aberto={painel === 'remover'} onFechar={fechar} titulo="Remover foto de perfil?">
        <p className="text-sm text-gray-600">
          Sua foto será apagada e o app voltará a exibir suas iniciais.
        </p>
        {erro && <div className="mt-3"><AlertaErro texto={erro} /></div>}
        <div className="flex flex-col sm:flex-row gap-2 mt-5">
          <button type="button" onClick={remover} disabled={enviando}
            className="w-full rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
            {enviando ? <><Loader2 size={16} className="animate-spin" /> Removendo...</> : 'Remover foto'}
          </button>
          <button type="button" onClick={() => setPainel('opcoes')} disabled={enviando}
            className="btn-secondary w-full">
            Cancelar
          </button>
        </div>
      </Modal>
    </>
  )
}

function OpcaoFoto({ Icone, titulo, detalhe, onClick, perigo = false }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 rounded-xl border border-gray-100 px-3.5 py-3 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${perigo ? 'bg-red-50' : 'bg-marca-100'}`}>
        <Icone size={18} className={perigo ? 'text-red-600' : 'text-marca'} />
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${perigo ? 'text-red-600' : 'text-gray-900'}`}>{titulo}</span>
        <span className="block text-xs text-gray-500">{detalhe}</span>
      </span>
    </button>
  )
}

function AlertaErro({ texto }) {
  return (
    <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3 mb-3">
      <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
      <span>{texto}</span>
    </div>
  )
}

// ─── Webcam (computador) ─────────────────────────────────────────────────────
function CapturaWebcam({ onFechar, onCapturar, onErro }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [pronta, setPronta] = useState(false)

  useEffect(() => {
    let cancelado = false
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(stream => {
        if (cancelado) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      })
      .catch(e => {
        if (cancelado) return
        const nome = e?.name || ''
        onErro(nome === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere o acesso à câmera no navegador ou escolha uma foto da galeria.'
          : 'Nenhuma câmera disponível. Escolha uma foto da galeria.')
      })
    return () => {
      cancelado = true
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function capturar() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    // Espelha como o usuário vê na prévia (câmera frontal).
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      if (!blob) { onErro('Não foi possível capturar a foto.'); return }
      streamRef.current?.getTracks().forEach(t => t.stop())
      onCapturar(new File([blob], 'webcam.jpg', { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  return (
    <Modal aberto onFechar={onFechar} titulo="Tirar uma foto">
      <div className="flex flex-col items-center">
        <div className="relative w-full aspect-square max-w-xs rounded-full overflow-hidden bg-gray-900">
          <video ref={videoRef} playsInline muted onLoadedData={() => setPronta(true)}
            className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
          {!pronta && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm gap-2">
              <Loader2 size={18} className="animate-spin" /> Abrindo câmera...
            </div>
          )}
        </div>
        <div className="w-full flex flex-col gap-2 mt-5">
          <button type="button" onClick={capturar} disabled={!pronta}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60">
            <Camera size={16} /> Capturar
          </button>
          <button type="button" onClick={onFechar} className="btn-secondary w-full">Voltar</button>
        </div>
      </div>
    </Modal>
  )
}
