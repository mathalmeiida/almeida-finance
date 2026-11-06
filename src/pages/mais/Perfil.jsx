import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, UserRound, Mail, Phone, Lock, Shield, ShieldCheck,
  ChevronRight, Loader2, CheckCircle2, Camera,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

// ─── Meu Perfil ───────────────────────────────────────────────────────────────
// Exibe dados reais do usuário autenticado (nome, e-mail) e oferece atalhos
// para alterar senha e gerenciar privacidade via Configurações.
// Não duplica lógica de autenticação — usa o AuthContext existente.
export default function Perfil() {
  const navigate = useNavigate()
  const { usuario, perfil, atualizarPreferenciasLimite } = useAuth()

  const nome = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const email = usuario?.email || ''
  const iniciais = nome.slice(0, 2).toUpperCase()

  // Edição inline do nome
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState(nome)
  const [salvando, setSalvando] = useState(false)
  const [erroNome, setErroNome] = useState('')
  const [nomeSalvo, setNomeSalvo] = useState(false)

  async function salvarNome(e) {
    e.preventDefault()
    const txt = novoNome.trim()
    if (!txt || txt === nome) { setEditandoNome(false); return }
    setSalvando(true); setErroNome('')
    try {
      await atualizarPreferenciasLimite({ nome: txt })
      setNomeSalvo(true)
      setTimeout(() => setNomeSalvo(false), 2000)
      setEditandoNome(false)
    } catch (err) {
      setErroNome(err.message || 'Não foi possível salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const cardBase =
    'flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-gray-200 bg-white cursor-pointer transition-colors hover:bg-gray-50 active:bg-gray-100'

  return (
    <div className="min-h-[100dvh] bg-gray-50 -mx-4 -mt-1">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white border-b border-gray-100 px-4 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => navigate(-1)} aria-label="Voltar"
          className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 text-center">Meu perfil</h1>
        <span className="w-9" /> {/* espaço para centralizar o título */}
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-marca-100 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#801D39,#420D1D)' }}>
              <span className="text-3xl font-bold text-white">{iniciais}</span>
            </div>
            {/* Ícone de câmera — visual apenas, alteração de foto requer storage */}
            <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
              <Camera size={15} className="text-gray-500" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-gray-900">{perfil?.nome || nome}</p>
            <p className="text-sm text-gray-500">{email}</p>
          </div>
        </div>

        {/* Card — Dados pessoais */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Dados pessoais</h2>
          <div className="card p-0 divide-y divide-gray-100 overflow-hidden">

            {/* Nome — editável inline */}
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
                  <UserRound size={17} className="text-marca" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">Nome</p>
                  {editandoNome ? (
                    <form onSubmit={salvarNome} className="flex items-center gap-2">
                      <input
                        value={novoNome}
                        onChange={e => setNovoNome(e.target.value)}
                        className="input py-1 text-sm"
                        autoFocus
                        maxLength={80}
                      />
                      <button type="submit" disabled={salvando}
                        className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 flex-shrink-0">
                        {salvando ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditandoNome(false)}
                        className="btn-secondary text-xs px-2 py-1.5 flex-shrink-0">
                        ✕
                      </button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => { setNovoNome(perfil?.nome || nome); setEditandoNome(true) }}
                      className="text-sm font-medium text-gray-900 text-left w-full flex items-center gap-1">
                      {perfil?.nome || nome}
                      {nomeSalvo && <CheckCircle2 size={14} className="text-green-500" />}
                    </button>
                  )}
                  {erroNome && <p className="text-xs text-red-500 mt-1">{erroNome}</p>}
                </div>
              </div>
            </div>

            {/* E-mail */}
            <div className="flex items-center gap-3 px-4 py-3.5">
              <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Mail size={17} className="text-blue-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">E-mail</p>
                <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
              </div>
            </div>

            {/* Telefone — campo informativo */}
            <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
              <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Phone size={17} className="text-gray-500" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 mb-0.5">Telefone</p>
                <p className="text-sm font-medium text-gray-500">Não informado</p>
              </div>
            </div>
          </div>
        </section>

        {/* Card — Segurança da conta */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Segurança da conta</h2>
          <div className="card p-0 divide-y divide-gray-100 overflow-hidden">
            {/* Senha — redireciona para Configurações (usuário já está autenticado;
                /recuperar-senha é rota pública e redireciona autenticados para /). */}
            <button type="button"
              onClick={() => navigate('/configuracoes')}
              className={cardBase + ' w-full border-0 rounded-none'}>
              <span className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Lock size={17} className="text-amber-600" />
              </span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900">Senha</p>
                <p className="text-xs text-gray-500">Alterar senha nas Configurações</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
            </button>

            <div className="flex items-center gap-3 px-4 py-3.5 opacity-50">
              <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={17} className="text-green-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">Autenticação</p>
                <p className="text-xs text-gray-500">Biometria e 2FA — em breve</p>
              </div>
            </div>
          </div>
        </section>

        {/* Card — Privacidade */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Privacidade</h2>
          <button type="button"
            onClick={() => navigate('/configuracoes')}
            className={cardBase + ' w-full card border-gray-200'}>
            <span className="w-9 h-9 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
              <Shield size={17} className="text-marca" />
            </span>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-gray-900">Privacidade</p>
              <p className="text-xs text-gray-500">Controle dos seus dados</p>
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          </button>
        </section>
      </div>
    </div>
  )
}
