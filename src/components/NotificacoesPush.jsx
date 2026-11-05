import React, { useState } from 'react'
import { Bell, BellOff, Smartphone, Share, Download, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react'
import { usePushNotificacoes } from '../hooks/usePushNotificacoes'

// ── NotificacoesPush ──────────────────────────────────────────────────────────
// Componente único que se adapta ao contexto (onboarding ou configurações),
// plataforma (iOS/Android/Desktop) e estado da permissão.
//
// Props:
//   contexto  'onboarding' | 'configuracoes'  — ajusta textos e layout
//   onPular   () => void                       — callback para "Pular" (onboarding)
//   onConcluir () => void                      — callback para avançar (onboarding)
//
// Não toca em dados financeiros, autenticação ou outras funcionalidades.
// ─────────────────────────────────────────────────────────────────────────────

export default function NotificacoesPush({ contexto = 'configuracoes', onPular, onConcluir }) {
  const {
    suportado, ativado, permissao, carregando, erro,
    ehiOS, instalado, plataforma,
    ativar, desativar,
  } = usePushNotificacoes()

  const [erroLocal, setErroLocal] = useState('')
  const [instrucaoExpandida, setInstrucaoExpandida] = useState(false)
  const noOnboarding = contexto === 'onboarding'

  // ── Caso: não suportado ────────────────────────────────────────────────────
  if (!suportado) {
    // iOS: suporta push desde 16.4, mas SOMENTE quando instalado como PWA
    if (ehiOS && !instalado) {
      return (
        <div className="space-y-4">
          <CabecalhoCard />

          {/* Instrução de instalação no iOS */}
          <div className="rounded-2xl border border-[#502838] bg-[#21121F] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-[#3d1528] flex items-center justify-center flex-shrink-0">
                <Smartphone size={20} className="text-[#C4507A]" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Instale para receber alertas</p>
                <p className="text-xs text-[#D4A8B6]">iPhone requer instalação na Tela de Início</p>
              </div>
            </div>

            {/* Passo a passo iOS */}
            <button
              type="button"
              onClick={() => setInstrucaoExpandida(v => !v)}
              className="w-full flex items-center justify-between text-sm text-[#C4507A] font-semibold"
            >
              Como instalar no iPhone
              {instrucaoExpandida ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>

            {instrucaoExpandida && (
              <ol className="space-y-2 text-sm text-[#D4A8B6] pl-1">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C4507A] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                  <span>Toque no ícone <Share size={14} className="inline text-[#C4507A]" /> <strong className="text-white">Compartilhar</strong> no Safari</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C4507A] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                  <span>Selecione <strong className="text-white">"Adicionar à Tela de Início"</strong></span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C4507A] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</span>
                  <span>Abra o Almeida Finance pelo ícone instalado</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#C4507A] text-white text-[10px] font-bold flex items-center justify-center mt-0.5">4</span>
                  <span>Volte aqui para ativar as notificações</span>
                </li>
              </ol>
            )}
          </div>

          <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
        </div>
      )
    }

    // Navegador sem suporte (Firefox antigo, IE, etc.)
    return (
      <div className="space-y-4">
        <CabecalhoCard />
        <div className="rounded-2xl border border-[#502838] bg-[#21121F] p-4 text-center">
          <BellOff size={28} className="text-[#D4A8B6] mx-auto mb-2" />
          <p className="text-sm text-white font-semibold">Notificações não disponíveis</p>
          <p className="text-xs text-[#D4A8B6] mt-1">Seu navegador não suporta push notifications. Use Chrome, Edge ou Safari no iOS 16.4+.</p>
        </div>
        <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
      </div>
    )
  }

  // ── Caso: permissão negada pelo sistema ────────────────────────────────────
  if (permissao === 'denied') {
    return (
      <div className="space-y-4">
        <CabecalhoCard />
        <div className="rounded-2xl border border-rose-800/50 bg-rose-900/20 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <X size={18} className="text-rose-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-rose-300">Notificações bloqueadas</p>
          </div>
          <p className="text-xs text-[#D4A8B6]">
            {plataforma === 'ios'
              ? 'Vá em Ajustes → Notificações → Almeida Finance e ative as notificações.'
              : 'Para reativar: clique no ícone de cadeado na barra de endereços do navegador e permita as notificações.'}
          </p>
        </div>
        <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
      </div>
    )
  }

  // ── Caso: já ativado ───────────────────────────────────────────────────────
  if (ativado && permissao === 'granted') {
    return (
      <div className="space-y-4">
        <CabecalhoCard />
        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-900/20 p-4 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-300">Notificações ativas</p>
            <p className="text-xs text-[#D4A8B6] mt-0.5">Você receberá alertas de vencimentos, faturas e saldo.</p>
          </div>
        </div>

        {/* Opção de desativar (configurações) */}
        {contexto === 'configuracoes' && (
          <button
            type="button"
            onClick={desativar}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#502838] bg-[#21121F] py-2.5 text-sm text-[#D4A8B6] hover:border-rose-700 hover:text-rose-400 transition-colors disabled:opacity-60"
          >
            <BellOff size={15} />
            {carregando ? 'Desativando...' : 'Desativar notificações'}
          </button>
        )}

        {noOnboarding && (
          <button
            type="button"
            onClick={onConcluir}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3"
          >
            Continuar <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    )
  }

  // ── Caso principal: solicitar ativação ─────────────────────────────────────
  async function handleAtivar() {
    setErroLocal('')
    try {
      await ativar()
      // Em onboarding, avança automaticamente após ativar
      if (noOnboarding) onConcluir?.()
    } catch (err) {
      setErroLocal(err.message || 'Não foi possível ativar. Tente novamente.')
    }
  }

  return (
    <div className="space-y-4">
      <CabecalhoCard />

      {/* Benefícios */}
      <div className="rounded-2xl border border-[#502838] bg-[#21121F] p-4 space-y-3">
        {[
          { emoji: '📅', texto: 'Vencimentos e faturas próximas' },
          { emoji: '💰', texto: 'Alertas de saldo projetado baixo' },
          { emoji: '🎯', texto: 'Lembretes de metas e investimentos' },
        ].map(({ emoji, texto }) => (
          <div key={texto} className="flex items-center gap-3">
            <span className="text-lg flex-shrink-0">{emoji}</span>
            <p className="text-sm text-[#FAF7F8]">{texto}</p>
          </div>
        ))}
      </div>

      {/* Erro */}
      {(erroLocal || erro) && (
        <p className="text-xs text-rose-400 bg-rose-900/20 border border-rose-800/40 rounded-xl px-3 py-2">
          {erroLocal || erro}
        </p>
      )}

      {/* CTA principal */}
      <button
        type="button"
        onClick={handleAtivar}
        disabled={carregando}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-60"
        style={{ background: carregando ? '#3d1528' : 'linear-gradient(135deg,#C4507A,#801D39)' }}
      >
        {carregando ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Ativando...
          </>
        ) : (
          <>
            <Bell size={16} />
            Ativar notificações
          </>
        )}
      </button>

      <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function CabecalhoCard() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg,#3d1528,#21121F)', border: '1px solid #502838' }}>
        <Bell size={22} className="text-[#C4507A]" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white">Notificações financeiras</h3>
        <p className="text-xs text-[#D4A8B6] mt-0.5">Alertas inteligentes baseados nos seus dados reais.</p>
      </div>
    </div>
  )
}

function RodapePular({ noOnboarding, onPular, onConcluir }) {
  if (!noOnboarding) return null
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onPular || onConcluir}
        className="text-sm text-[#D4A8B6] hover:text-white underline underline-offset-2 transition-colors"
      >
        Pular por enquanto
      </button>
      <p className="text-xs text-[#6b3050] mt-1">Você pode ativar depois em Configurações.</p>
    </div>
  )
}
