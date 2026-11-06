import React, { useState, useEffect } from 'react'

import { useNavigate } from 'react-router-dom'

import { User, Mail, AlertTriangle, Loader2, Trash2, LogOut, Sparkles, Eye, EyeOff, Clock, MessageSquarePlus, CheckCircle2, Palette, Check, Moon, Lock, ShieldCheck, Fingerprint } from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'

import { useZerarDados } from '../hooks/useZerarDados'

import { useConsultoriaAcessos } from '../hooks/useConsultoriaAcessos'

import { useFeedbacks } from '../hooks/useFeedbacks'

import { supabase } from '../lib/supabase'

import { CORES_TEMA } from '../lib/utils'

import Modal from '../components/Modal'

import NotificacoesPush from '../components/NotificacoesPush'



// Card de SEGURANÇA: alteração de senha para usuário já autenticado.
// Usa supabase.auth.updateUser({ password }) via AuthContext.redefinirSenha.
// Não armazena senhas em tabelas nem localStorage.
function AlterarSenha() {
  const { redefinirSenha } = useAuth()
  const [aberto, setAberto] = useState(false)
  const [nova, setNova] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrarNova, setMostrarNova] = useState(false)
  const [mostrarConf, setMostrarConf] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  function abrir() { setNova(''); setConfirmar(''); setErro(''); setSucesso(false); setAberto(true) }
  function fechar() { if (!salvando) setAberto(false) }

  function forca(s) {
    if (!s) return null
    let pts = 0
    if (s.length >= 8) pts++
    if (s.length >= 12) pts++
    if (/[A-Z]/.test(s)) pts++
    if (/[0-9]/.test(s)) pts++
    if (/[^A-Za-z0-9]/.test(s)) pts++
    if (pts <= 1) return { texto: 'Fraca', cor: 'bg-red-500', largura: '25%' }
    if (pts <= 3) return { texto: 'Média', cor: 'bg-amber-500', largura: '60%' }
    return { texto: 'Forte', cor: 'bg-green-500', largura: '100%' }
  }

  async function handleSalvar(e) {
    e.preventDefault()
    setErro('')
    if (nova.length < 6) { setErro('A nova senha deve ter pelo menos 6 caracteres.'); return }
    if (nova !== confirmar) { setErro('As senhas não coincidem.'); return }
    setSalvando(true)
    try {
      await redefinirSenha(nova)
      setSucesso(true)
      setNova(''); setConfirmar('')
      setTimeout(() => { setAberto(false); setSucesso(false) }, 2500)
    } catch (err) {
      setErro(err.message || 'Não foi possível alterar a senha. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const f = forca(nova)

  return (
    <>
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
            <Lock size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-gray-900">Segurança e acesso</h2>
            <p className="text-sm text-gray-500 mt-1">Gerencie sua senha e opções de acesso à conta.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={abrir}
                className="inline-flex items-center gap-2 btn-secondary text-sm">
                <Lock size={15} /> Alterar senha
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal aberto={aberto} onFechar={fechar} titulo="Alterar senha">
        {sucesso ? (
          <div className="flex items-center gap-3 py-4">
            <CheckCircle2 size={22} className="text-green-500 flex-shrink-0" />
            <p className="text-sm font-medium text-green-700">Senha alterada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={handleSalvar} className="space-y-4">
            <div>
              <label className="label">Nova senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={mostrarNova ? 'text' : 'password'}
                  value={nova}
                  onChange={e => setNova(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setMostrarNova(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {mostrarNova ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {f && (
                <div className="mt-1.5">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${f.cor}`} style={{ width: f.largura }} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Força: {f.texto}</p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirmar nova senha</label>
              <div className="relative">
                <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={mostrarConf ? 'text' : 'password'}
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  className="input pl-9 pr-10"
                  placeholder="Repita a nova senha"
                  required
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setMostrarConf(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {mostrarConf ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmar && nova !== confirmar && (
                <p className="text-xs text-red-500 mt-1">As senhas não coincidem.</p>
              )}
            </div>

            {erro && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{erro}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={fechar} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" disabled={salvando || !nova || !confirmar}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                {salvando ? <><Loader2 size={15} className="animate-spin" />Salvando...</> : 'Salvar nova senha'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

// Card de BIOMETRIA: login biométrico usando Supabase Auth Passkeys (Beta)
// Documentação: https://supabase.com/docs/guides/auth/passkeys
// Usa WebAuthn/Passkeys nativos do Supabase — nenhum dado biométrico é armazenado.
// Requer: Passkeys habilitados no Dashboard (Authentication → Passkeys).
function ConfigurarBiometria() {
  const { usuario } = useAuth()
  const [suportaBio, setSuportaBio] = useState(false)
  const [credenciais, setCredenciais] = useState([])
  const [verificando, setVerificando] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function verificar() {
      // Verifica se WebAuthn está disponível no navegador
      const disponivel = typeof window !== 'undefined' && 
                        window.PublicKeyCredential !== undefined
      
      if (!disponivel) {
        setSuportaBio(false)
        setVerificando(false)
        return
      }

      try {
        // Verifica se há passkeys de plataforma (FaceID, TouchID, Windows Hello)
        const suporta = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        setSuportaBio(suporta)

        // Lista credenciais existentes do usuário
        if (usuario && suporta) {
          const { data, error } = await supabase.auth.mfa.passkey.list()
          if (!error && data) {
            setCredenciais(data.all_passkey_identities || [])
          }
        }
      } catch (err) {
        console.warn('[Biometria] Erro ao verificar suporte:', err)
        setSuportaBio(false)
      } finally {
        setVerificando(false)
      }
    }
    verificar()
  }, [usuario])

  async function registrarPasskey() {
    setErro('')
    setRegistrando(true)
    try {
      // Usa API nativa do Supabase para registrar passkey
      const { data, error } = await supabase.auth.mfa.passkey.startRegistration({
        // Opcionalmente, pode passar um nome personalizado:
        // credential_nickname: 'Meu iPhone',
      })

      if (error) throw error

      // Atualiza lista de credenciais
      const { data: lista } = await supabase.auth.mfa.passkey.list()
      if (lista) {
        setCredenciais(lista.all_passkey_identities || [])
      }
    } catch (err) {
      setErro(err.message || 'Erro ao registrar biometria. Tente novamente.')
      console.error('[Biometria] Erro ao registrar:', err)
    } finally {
      setRegistrando(false)
    }
  }

  async function removerCredencial(id) {
    try {
      const { error } = await supabase.auth.mfa.passkey.delete({ id })
      if (error) throw error
      setCredenciais(prev => prev.filter(c => c.id !== id))
    } catch (err) {
      setErro('Erro ao remover credencial.')
      console.error('[Biometria] Erro ao remover:', err)
    }
  }

  if (verificando) return null
  if (!suportaBio) return null

  const temCredenciais = credenciais.length > 0

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
          <Fingerprint size={16} className="text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Biometria e Passkeys</h2>
          <p className="text-sm text-gray-500 mt-1">
            {temCredenciais
              ? `${credenciais.length} credencial(is) ativa(s). Use biometria para fazer login.`
              : 'Ative o login por biometria para acessar sem digitar senha.'}
          </p>

          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle2 size={13} className="text-green-500" />
            <span>FaceID, TouchID e Windows Hello</span>
          </div>

          {temCredenciais ? (
            <div className="mt-4 space-y-2">
              {credenciais.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Fingerprint size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">
                      {c.credential_nickname || 'Passkey sem nome'}
                    </span>
                  </div>
                  <button
                    onClick={() => removerCredencial(c.id)}
                    className="text-xs text-red-600 hover:underline flex-shrink-0"
                    title="Remover credencial"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {erro && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
              {erro}
            </div>
          )}

          <button
            onClick={registrarPasskey}
            disabled={registrando}
            className="mt-3 inline-flex items-center gap-2 btn-secondary text-sm disabled:opacity-50"
          >
            {registrando ? (
              <><Loader2 size={15} className="animate-spin" /> Registrando...</>
            ) : (
              <><Fingerprint size={15} /> {temCredenciais ? 'Adicionar outra' : 'Ativar biometria'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Card de APARÊNCIA: escolha da cor do tema (Azul padrão / Rosa / Verde / Roxo).
// globalmente pela classe .tema-* no <html> (ver AuthContext + index.css). Só
// identidade visual — não altera cálculos nem dados.
// Preferência por usuário. O calendário completo lerá esta mesma chave.
// Salvar aqui não modifica automaticamente outros componentes.
export const chaveEstiloCalendario = (id) => `almeida_calendario_estilo_${id || 'anon'}`

function Aparencia() {
  const { corTema, atualizarCorTema, usuario } = useAuth()
  const [salvando, setSalvando] = useState('')
  const [erro, setErro] = useState('')
  const chaveAparencia = `almeida_aparencia_dinamica_${usuario?.id || 'anon'}`
  const [aparenciaDinamica, setAparenciaDinamica] = useState(true)
  const [estiloCalendario, setEstiloCalendario] = useState('claro')

  useEffect(() => {
    try {
      setAparenciaDinamica(localStorage.getItem(chaveAparencia) !== '0')
      const salvo = localStorage.getItem(chaveEstiloCalendario(usuario?.id))
      setEstiloCalendario(['claro', 'escuro', 'automatico'].includes(salvo) ? salvo : 'claro')
    } catch {
      setAparenciaDinamica(true)
      setEstiloCalendario('claro')
    }
  }, [chaveAparencia, usuario?.id])

  function alternarAparenciaDinamica() {
    const novo = !aparenciaDinamica
    setAparenciaDinamica(novo)
    try { localStorage.setItem(chaveAparencia, novo ? '1' : '0') } catch { /* armazenamento indisponível */ }
  }

  function escolherEstiloCalendario(valor) {
    setEstiloCalendario(valor)
    try {
      localStorage.setItem(chaveEstiloCalendario(usuario?.id), valor)
      window.dispatchEvent(new CustomEvent('almeida-calendario-estilo', { detail: { estilo: valor } }))
    } catch { /* armazenamento indisponível */ }
  }

  async function escolher(cor) {
    if (cor === corTema || salvando) return
    setSalvando(cor)
    setErro('')
    try { await atualizarCorTema(cor) }
    catch { setErro('Não foi possível salvar a cor agora. Tente novamente.') }
    finally { setSalvando('') }
  }

  const escuroNaPrevia = estiloCalendario === 'escuro' ||
    (estiloCalendario === 'automatico' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  // Destaque sempre vinho: #801D39 no claro, #B95572 legível no escuro
  const destaque = escuroNaPrevia ? '#B95572' : '#801D39'
  const celulas = Array.from({ length: 35 }, (_, i) => i < 4 ? null : i - 3)

  return (
    <div className="card space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-marca-100 rounded-xl flex items-center justify-center shrink-0">
          <Palette size={16} className="text-marca" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Aparência</h2>
          <p className="text-sm text-gray-500 mt-1">Identidade Almeida Finance — Vinho Premium. Escolha o modo de exibição.</p>
          {/* Swatch da cor de marca (vinho) — apenas informativo */}
          <div className="flex items-center gap-2 mt-3 mb-3">
            <span className="w-8 h-8 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg,#801D39,#420D1D)' }} aria-hidden="true" />
            <span className="text-sm font-medium text-gray-900">Vinho Premium <span className="text-xs text-gray-400 font-normal ml-1">Identidade fixa</span></span>
          </div>
          {/* Seletor de modo: Claro / Escuro / Automático */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            {CORES_TEMA.map(op => {
              const ativo = corTema === op.value
              const icone = op.value === 'escuro' ? '🌙' : op.auto ? '⚙️' : '☀️'
              return (
                <button key={op.value} type="button" onClick={() => escolher(op.value)}
                  disabled={!!salvando} aria-pressed={ativo}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all disabled:opacity-60 ${ativo ? 'border-marca ring-1 ring-marca bg-marca-100/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <span className="text-xl">{salvando === op.value ? '…' : icone}</span>
                  <span className="text-xs font-semibold text-gray-900">{op.label}</span>
                  {ativo && <Check size={12} className="text-marca" />}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {corTema === 'automatico' ? 'Segue a preferência do seu dispositivo.' : corTema === 'escuro' ? 'Fundo escuro em todas as telas.' : 'Fundo claro em todas as telas.'}
          </p>
          {erro && <p role="alert" className="text-xs text-red-600 mt-2">{erro}</p>}
        </div>
      </div>

      <div className="border-t border-gray-200 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Moon size={17} className="text-marca" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Aparência dos calendários</h3>
            <p className="text-xs text-gray-500">Escolha o visual para os calendários financeiros.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { value: 'claro', label: 'Claro', descricao: 'Fundo branco' },
            { value: 'escuro', label: 'Escuro', descricao: 'Fundo escuro' },
            { value: 'automatico', label: 'Automático', descricao: 'Segue o dispositivo' },
          ].map(op => (
            <button key={op.value} type="button" onClick={() => escolherEstiloCalendario(op.value)}
              aria-pressed={estiloCalendario === op.value}
              className={`rounded-xl border p-3 text-left transition-colors ${estiloCalendario === op.value ? 'border-marca bg-marca-100/40' : 'border-gray-200'}`}>
              <span className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
                {op.label} {estiloCalendario === op.value && <Check size={15} className="text-marca" />}
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">{op.descricao}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl border p-3 space-y-2"
          style={{ background: escuroNaPrevia ? '#140B10' : '#FFFFFF', borderColor: escuroNaPrevia ? '#502838' : '#E5BAC4', color: escuroNaPrevia ? '#FAF7F8' : '#25141B' }}>
          <div className="text-xs font-semibold flex items-center justify-between">
            <span>Prévia · Outubro 2026</span><span style={{ color: destaque }}>●</span>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
            {['D','S','T','Q','Q','S','S'].map((d,i) => <span key={i} style={{ opacity: 0.7 }}>{d}</span>)}
            {celulas.map((dia,i) => (
              <span key={i} className="rounded-md py-1.5"
                style={{ background: dia === 30 ? destaque : escuroNaPrevia ? '#2B171F' : '#FFF5F7', color: dia === 30 ? '#FFFFFF' : 'inherit' }}>
                {dia || ''}
              </span>
            ))}
          </div>
          <div className="text-[11px] flex flex-wrap gap-3" style={{ opacity: 0.85 }}>
            <span>🟢 Receitas</span><span>🔴 Despesas</span><span>🔵 Faturas</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">A escolha é aplicada imediatamente e fica salva neste dispositivo.</p>
      </div>

      <div className="border-t border-gray-200 pt-4 flex items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-marca-100 flex items-center justify-center shrink-0"><Moon size={15} className="text-marca" /></span>
          <div>
            <p className="text-sm font-medium text-gray-900">Aparência dinâmica</p>
            <p className="text-xs text-gray-500">Cabeçalho da Home muda conforme o horário.</p>
          </div>
        </div>
        <button type="button" role="switch" aria-label="Aparência dinâmica" aria-checked={aparenciaDinamica}
          onClick={alternarAparenciaDinamica}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${aparenciaDinamica ? 'bg-marca' : 'bg-gray-300'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${aparenciaDinamica ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}

// Card para o usuário ENVIAR um feedback (sugestão, dúvida ou problema).
// O envio usa a mesma fonte/hook do painel Admin (useFeedbacks).
function EnviarFeedback() {

  const { criar } = useFeedbacks()

  const [tipo, setTipo] = useState('sugestao')

  const [mensagem, setMensagem] = useState('')

  const [enviando, setEnviando] = useState(false)

  const [enviado, setEnviado] = useState(false)

  const [erro, setErro] = useState('')



  const TIPOS = [

    { value: 'sugestao', label: 'Sugestão' },

    { value: 'duvida',   label: 'Dúvida' },

    { value: 'problema', label: 'Problema' },

  ]



  async function handleEnviar(e) {

    e.preventDefault()

    if (!mensagem.trim() || enviando) return

    setEnviando(true); setErro('')

    try {

      await criar({ tipo, mensagem })

      setEnviado(true)

      setMensagem('')

      setTipo('sugestao')

    } catch {

      setErro('Não foi possível enviar seu feedback agora. Tente novamente.')

    } finally {

      setEnviando(false)

    }

  }



  return (

    <div className="card">

      <div className="flex items-start gap-3">

        <div className="w-9 h-9 bg-marca-100 rounded-xl flex items-center justify-center flex-shrink-0">

          <MessageSquarePlus size={16} className="text-marca" />

        </div>

        <div className="flex-1 min-w-0">

          <h2 className="text-base font-semibold text-gray-900">Enviar feedback</h2>

          <p className="text-sm text-gray-500 mt-1">

            Tem uma sugestão, dúvida ou encontrou um problema? Conte pra gente.

          </p>



          {enviado ? (

            <div className="flex items-center gap-2 mt-3">

              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />

              <p className="text-sm text-gray-600">

                <span className="font-medium text-gray-800">Feedback enviado com sucesso!</span>{' '}

                Obrigado! Vamos analisar com carinho.

              </p>

              <button

                onClick={() => setEnviado(false)}

                className="text-xs font-medium text-marca hover:text-marca-hover ml-auto flex-shrink-0"

              >

                Enviar outro

              </button>

            </div>

          ) : (

            <form onSubmit={handleEnviar} className="mt-3 space-y-3">

              <div className="grid grid-cols-3 gap-2">

                {TIPOS.map(t => (

                  <button

                    key={t.value}

                    type="button"

                    onClick={() => setTipo(t.value)}

                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${

                      tipo === t.value

                        ? 'bg-marca text-white border-marca'

                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'

                    }`}

                  >

                    {t.label}

                  </button>

                ))}

              </div>

              <textarea

                className="input min-h-[88px] resize-y"

                placeholder="Escreva aqui sua sugestão, dúvida ou problema..."

                value={mensagem}

                onChange={(e) => setMensagem(e.target.value)}

                maxLength={2000}

              />

              {erro && <p className="text-xs text-red-500">{erro}</p>}

              <button

                type="submit"

                disabled={enviando || !mensagem.trim()}

                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"

              >

                {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : 'Enviar feedback'}

              </button>

            </form>

          )}

        </div>

      </div>

    </div>

  )

}



// Card que lista os acessos de consultoria do CLIENTE (consultores autorizados
// ou com solicitação pendente) e permite revogar/recusar. Só aparece se houver
// algum vínculo relevante. Busca o nome dos consultores para exibir.
function AcessosConsultoria() {

  const { comoCliente, autorizar, recusar, revogar, carregando } = useConsultoriaAcessos()

  const [nomes, setNomes] = useState({}) // consultor_id → nome

  const [agindo, setAgindo] = useState(null) // id em processamento



  // Mostra apenas vínculos ativos/relevantes (autorizado ou pendente).
  const relevantes = comoCliente.filter(a => a.status === 'autorizado' || a.status === 'pendente')



  useEffect(() => {

    let vivo = true

    async function buscarNomes() {

      const ids = [...new Set(relevantes.map(a => a.consultor_id))]

      if (ids.length === 0) return

      const { data } = await supabase.from('perfis').select('id, nome, email').in('id', ids)

      if (vivo && data) {

        const mapa = {}

        for (const p of data) mapa[p.id] = p.nome || p.email || 'Consultor'

        setNomes(mapa)

      }

    }

    buscarNomes()

    return () => { vivo = false }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantes.length])



  async function acao(fn, id) {

    setAgindo(id)

    try { await fn(id) } finally { setAgindo(null) }

  }



  if (carregando || relevantes.length === 0) return null



  return (

    <div className="card">

      <h2 className="text-base font-semibold text-gray-900 mb-1">Acessos de consultoria</h2>

      <p className="text-sm text-gray-500 mb-4">

        Consultores que podem (ou pediram para) visualizar seus dados financeiros em

        modo somente leitura. Você controla o acesso aqui.

      </p>

      <div className="space-y-3">

        {relevantes.map(a => {

          const nome = nomes[a.consultor_id] || 'Consultor'

          const ocupado = agindo === a.id

          return (

            <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">

              <div className="min-w-0">

                <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>

                {a.status === 'autorizado' ? (

                  <span className="inline-flex items-center gap-1 text-xs text-green-700">

                    <Eye size={12} /> Acesso autorizado

                  </span>

                ) : (

                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">

                    <Clock size={12} /> Aguardando sua autorização

                  </span>

                )}

              </div>

              {a.status === 'autorizado' ? (

                <button

                  onClick={() => acao(revogar, a.id)}

                  disabled={ocupado}

                  className="btn-secondary flex items-center gap-1.5 !py-1.5 !px-3 text-sm flex-shrink-0"

                >

                  {ocupado ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}

                  Revogar

                </button>

              ) : (

                <div className="flex gap-2 flex-shrink-0">

                  <button onClick={() => acao(recusar, a.id)} disabled={ocupado}

                    className="btn-secondary !py-1.5 !px-3 text-sm">Recusar</button>

                  <button onClick={() => acao(autorizar, a.id)} disabled={ocupado}

                    className="btn-primary !py-1.5 !px-3 text-sm flex items-center gap-1.5">

                    {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} Autorizar

                  </button>

                </div>

              )}

            </div>

          )

        })}

      </div>

    </div>

  )

}



// Mesma chave lida em App.jsx (AreaAutenticada) para reabrir o onboarding.
const CHAVE_REFAZER = 'almeida_refazer_onboarding'



const PALAVRA_ENCERRAR = 'ENCERRAR'



export default function Configuracoes() {

  const { usuario, perfil, ehAdmin, encerrarMinhaConta } = useAuth()

  const { zerarDados } = useZerarDados()

  const navigate = useNavigate()



  // Reabre o fluxo de configuração financeira (onboarding). Não apaga dados:
  // é o mesmo fluxo do 1º acesso, útil para revisar/complementar informações.
  function refazerConfiguracao() {

    try { localStorage.setItem(CHAVE_REFAZER, '1') } catch { /* ignore */ }

    navigate('/') // a Home (AreaAutenticada) detecta a flag e abre o onboarding

  }



  const [modalAberto, setModalAberto] = useState(false)

  const [zerando, setZerando] = useState(false)

  const [erro, setErro] = useState('')

  // Confirmação explícita (checkbox) antes de habilitar a exclusão definitiva.
  const [confirmaApagar, setConfirmaApagar] = useState(false)



  // Encerrar conta (desativação da própria conta)
  const [modalEncerrar, setModalEncerrar] = useState(false)

  const [textoEncerrar, setTextoEncerrar] = useState('')

  const [encerrando, setEncerrando] = useState(false)

  const [erroEncerrar, setErroEncerrar] = useState('')



  const nome = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'

  const encerrarValido = textoEncerrar.trim().toUpperCase() === PALAVRA_ENCERRAR



  function abrirModal() {

    setErro('')

    setConfirmaApagar(false)

    setModalAberto(true)

  }



  function abrirModalEncerrar() {

    setTextoEncerrar('')

    setErroEncerrar('')

    setModalEncerrar(true)

  }



  async function handleZerar() {

    setZerando(true)

    setErro('')

    try {

      await zerarDados()

      // Recarrega o app inteiro: todos os hooks releem o banco (agora vazio),
      // o Dashboard aparece zerado e a sessão/login permanece ativa.
      window.location.assign('/')

    } catch (err) {

      setErro(err.message || 'Erro ao zerar os dados. Tente novamente.')

      setZerando(false)

    }

  }



  async function handleEncerrar() {

    if (!encerrarValido) return

    setEncerrando(true)

    setErroEncerrar('')

    try {

      await encerrarMinhaConta() // desativa o perfil (ativo=false) + signOut

      // Redireciona para o login. Ao tentar entrar de novo, a conta estará
      // desativada e o app mostra a tela "Conta desativada" já existente.
      window.location.assign('/login')

    } catch (err) {

      // Se um admin tentar encerrar a própria conta, o trigger do banco
      // (impedir_autodesativacao) lança erro e a conta NÃO é encerrada.
      setErroEncerrar(err.message || 'Não foi possível encerrar a conta. Tente novamente.')

      setEncerrando(false)

    }

  }



  return (
    <div className="w-full max-w-none px-0">

      {/* Título */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Minha conta e preferências</p>
      </div>

      {/* ── Grid principal: 2 colunas no lg, 1 no mobile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Coluna esquerda */}
        <div className="space-y-5">

          {/* Minha conta */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Minha conta</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-marca-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-marca" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Nome</p>
                  <p className="text-sm font-medium text-gray-900">{nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail size={16} className="text-blue-700" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">E-mail</p>
                  <p className="text-sm font-medium text-gray-900">{usuario?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Aparência */}
          <Aparencia />

          {/* Notificações push */}
          <div className="card">
            <NotificacoesPush contexto="configuracoes" />
          </div>

        </div>{/* /coluna esquerda */}

        {/* Coluna direita */}
        <div className="space-y-5">

          {/* Acessos de consultoria */}
          <AcessosConsultoria />

          {/* Segurança e acesso */}
          <AlterarSenha />

          {/* Biometria (se disponível no dispositivo) */}
          <ConfigurarBiometria />

          {/* Rever apresentação */}
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-marca-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-marca" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">Rever apresentação</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Veja novamente as telas de boas-vindas com os diferenciais do app. Não altera
                  nenhuma configuração nem reinicia o passo a passo financeiro.
                </p>
                <button onClick={() => navigate('/apresentacao')} className="mt-3 inline-flex items-center gap-2 btn-secondary text-sm">
                  <Sparkles size={15} /> Rever apresentação
                </button>
              </div>
            </div>
          </div>

          {/* Enviar feedback */}
          <EnviarFeedback />

          {/* Atualizar dados financeiros */}
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-blue-700" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">Atualizar meus dados financeiros</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Revise sua renda, despesas, cartões, benefícios e reserva financeira sem apagar seu histórico.
                </p>
                <button onClick={refazerConfiguracao}
                  className="mt-3 inline-flex items-center gap-2 bg-marca hover:bg-marca-hover text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                  <Sparkles size={15} /> Atualizar informações
                </button>
                <p className="mt-2 text-xs text-gray-400">Seus dados são preservados.</p>
              </div>
            </div>
          </div>

        </div>{/* /coluna direita */}

      </div>{/* /grid principal */}

      {/* ── Zona de perigo ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">

        <div className="card border-red-200">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={16} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Apagar dados financeiros</h2>
              <p className="text-sm text-gray-500 mt-1">
                Exclua seus registros financeiros e recomece a configuração do aplicativo. Sua conta e seu login serão mantidos.
              </p>
              <button onClick={abrirModal}
                className="mt-3 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                <Trash2 size={15} /> Apagar dados financeiros
              </button>
            </div>
          </div>
        </div>

        {/* Encerrar minha conta */}
        <div className="card border-red-300">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <LogOut size={16} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900">Encerrar minha conta</h2>
              <p className="text-sm text-gray-500 mt-1">
                Esta ação <strong>desativa o acesso</strong> à sua conta — não é uma exclusão
                definitiva. Você deixa de entrar no Almeida Finance, mas seus dados
                <strong> permanecem salvos</strong> e podem ser reativados pelo administrador.
              </p>
              {ehAdmin ? (
                <p className="mt-3 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                  Contas de administrador não podem ser encerradas por aqui.
                </p>
              ) : (
                <button onClick={abrirModalEncerrar}
                  className="mt-3 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm">
                  <LogOut size={15} /> Encerrar minha conta
                </button>
              )}
            </div>
          </div>
        </div>

      </div>{/* /zona de perigo */}

      {/* Sobre */}
      <div className="card mt-5">
        <h2 className="text-base font-semibold text-gray-900">Sobre o Almeida Finance</h2>
        <p className="text-sm text-gray-500 mt-1">
          Seu controle financeiro pessoal: saldo, receitas, despesas, cartões, benefícios,
          reserva e projeções em um só lugar.
        </p>
        <p className="text-xs text-gray-400 mt-3">Almeida Finance</p>
      </div>



      {/* Modal de confirmação — Zerar dados */}

      <Modal aberto={modalAberto} onFechar={() => !zerando && setModalAberto(false)} titulo="Apagar dados financeiros">

        <div className="space-y-4">

          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3">

            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />

            <p className="text-sm text-red-700">

              Esta ação <strong>exclui permanentemente</strong> seus registros financeiros e não pode ser desfeita.

              Sua conta e seu login serão mantidos.

            </p>

          </div>



          <label className="flex items-start gap-2.5 cursor-pointer select-none">

            <input

              type="checkbox"

              checked={confirmaApagar}

              onChange={(e) => setConfirmaApagar(e.target.checked)}

              disabled={zerando}

              className="w-4 h-4 mt-0.5 flex-shrink-0 accent-red-600"

            />

            <span className="text-sm text-gray-700">

              Entendo que esta exclusão é permanente e desejo apagar meus dados financeiros.

            </span>

          </label>



          {erro && (

            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erro}</p>

          )}



          <div className="flex flex-col sm:flex-row gap-3 pt-1">

            <button

              type="button"

              onClick={() => setModalAberto(false)}

              disabled={zerando}

              className="btn-secondary flex-1"

            >

              Cancelar

            </button>

            <button

              type="button"

              onClick={handleZerar}

              disabled={zerando || !confirmaApagar}

              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

            >

              {zerando

                ? <><Loader2 size={15} className="animate-spin" /> Apagando...</>

                : 'Apagar dados financeiros'}

            </button>

          </div>

        </div>

      </Modal>



      {/* Modal de confirmação — Encerrar conta */}

      <Modal aberto={modalEncerrar} onFechar={() => !encerrando && setModalEncerrar(false)} titulo="Encerrar minha conta">

        <div className="space-y-4">

          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3">

            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />

            <p className="text-sm text-red-700">

              Sua conta será desativada e você perderá o acesso ao Almeida Finance.

              Seus dados não serão apagados neste momento.

            </p>

          </div>



          <div>

            <label className="label">

              Para confirmar, digite <strong className="text-red-600">{PALAVRA_ENCERRAR}</strong>

            </label>

            <input

              type="text"

              value={textoEncerrar}

              onChange={e => setTextoEncerrar(e.target.value)}

              placeholder={PALAVRA_ENCERRAR}

              className="input"

              autoFocus

              disabled={encerrando}

            />

          </div>



          {erroEncerrar && (

            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroEncerrar}</p>

          )}



          <div className="flex gap-3 pt-1">

            <button

              type="button"

              onClick={() => setModalEncerrar(false)}

              disabled={encerrando}

              className="btn-secondary flex-1"

            >

              Cancelar

            </button>

            <button

              type="button"

              onClick={handleEncerrar}

              disabled={!encerrarValido || encerrando}

              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"

            >

              {encerrando

                ? <><Loader2 size={15} className="animate-spin" /> Encerrando...</>

                : 'Encerrar minha conta'}

            </button>

          </div>

        </div>

      </Modal>

    </div>

  )

}
