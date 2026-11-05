import React, { useState } from 'react'
import {
  Bell, BellOff, Smartphone, Monitor,
  CheckCircle2, X, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { usePushNotificacoes } from '../hooks/usePushNotificacoes'

// ── NotificacoesPush ──────────────────────────────────────────────────────────
// Componente de notificações push. Usa exclusivamente as classes de tema do
// projeto (bg-white, bg-gray-50, text-gray-*, border-gray-*, bg-marca-100,
// text-marca, etc.) — as mesmas que o restante do app usa e que o sistema de
// tema (.tema-escuro, .tema-preto, .tema-automatico em index.css) já cobre.
// NÃO usa classes dark: do Tailwind (darkMode não está configurado no projeto).
// Não altera Service Worker, VAPID, Cron Job nem Supabase.
// ─────────────────────────────────────────────────────────────────────────────

// Seção expansível: usa .card do projeto (branco no claro, surface no escuro)
function SecaoInstrucao({ icone: Icone, titulo, badge, ativa, aberta, onToggle, children }) {
  return (
    <div className={`card p-0 overflow-hidden transition-colors ${ativa ? 'border-marca' : ''}`}>
      <button
        type="button"
        className="w-full flex items-center justify-between gap-3 p-4 cursor-pointer select-none text-left"
        onClick={onToggle}
        aria-expanded={aberta}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
            <Icone size={18} className="text-marca" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 leading-tight">{titulo}</p>
            {badge && (
              <span className="mt-0.5 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-marca-100 text-marca">
                {badge}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ativa && <span className="text-[10px] font-semibold text-marca hidden sm:block">Seu dispositivo</span>}
          {aberta
            ? <ChevronUp size={16} className="text-gray-400" />
            : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {aberta && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  )
}

// Passo numerado
function Passo({ n, children }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-marca text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
        {n}
      </span>
      <span className="text-sm text-gray-600 leading-snug">{children}</span>
    </div>
  )
}

// Nota informativa
function Nota({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
      <Info size={14} className="text-marca flex-shrink-0 mt-0.5" />
      <p className="text-xs text-gray-500 leading-snug">{children}</p>
    </div>
  )
}

// Cabeçalho reutilizável
function Cabecalho() {
  return (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-marca-100">
        <Bell size={20} className="text-marca" />
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-900">Notificações financeiras</h3>
        <p className="text-xs text-gray-500 mt-0.5">Alertas automáticos baseados nos seus dados reais.</p>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function NotificacoesPush({ contexto = 'configuracoes', onPular, onConcluir }) {
  const {
    suportado, ativado, permissao, carregando, erro,
    ehiOS, instalado, plataforma,
    ativar, desativar,
  } = usePushNotificacoes()

  const [erroLocal, setErroLocal] = useState('')
  const secaoAuto = ehiOS ? 'ios' : plataforma === 'android' ? 'android' : 'desktop'
  const [secaoAberta, setSecaoAberta] = useState(secaoAuto)

  const noOnboarding = contexto === 'onboarding'

  function toggleSecao(id) {
    setSecaoAberta(v => v === id ? null : id)
  }

  async function handleAtivar() {
    setErroLocal('')
    try {
      await ativar()
      if (noOnboarding) onConcluir?.()
    } catch (err) {
      setErroLocal(err.message || 'Não foi possível ativar. Tente novamente.')
    }
  }

  // ── Permissão negada ────────────────────────────────────────────────────────
  if (permissao === 'denied') {
    return (
      <div className="space-y-3">
        <Cabecalho />
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <X size={18} className="text-red-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">Notificações bloqueadas</p>
          </div>
          <p className="text-xs text-red-600">
            {ehiOS
              ? 'Vá em Ajustes → Notificações → Safari (ou Almeida Finance) e ative as notificações.'
              : 'Clique no ícone de cadeado (🔒) na barra de endereços do navegador e permita as notificações para este site.'}
          </p>
        </div>
        <InstrucoesExpandiveis secaoAberta={secaoAberta} onToggle={toggleSecao} plataforma={plataforma} ehiOS={ehiOS} instalado={instalado} />
        <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
      </div>
    )
  }

  // ── Já ativado ──────────────────────────────────────────────────────────────
  if (ativado && permissao === 'granted') {
    return (
      <div className="space-y-3">
        <Cabecalho />
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700">Notificações ativas</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Você receberá alertas diários de vencimentos, faturas e saldo.
            </p>
          </div>
        </div>
        {contexto === 'configuracoes' && (
          <button
            type="button"
            onClick={desativar}
            disabled={carregando}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2.5 text-sm text-gray-600 hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            <BellOff size={15} />
            {carregando ? 'Desativando...' : 'Desativar notificações'}
          </button>
        )}
        {noOnboarding && (
          <button type="button" onClick={onConcluir}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3">
            Continuar →
          </button>
        )}
      </div>
    )
  }

  // ── iOS não instalado ───────────────────────────────────────────────────────
  if (ehiOS && !instalado) {
    return (
      <div className="space-y-3">
        <Cabecalho />
        <div className="rounded-2xl border border-marca/30 bg-marca-100/30 p-4 flex items-start gap-3">
          <Info size={18} className="text-marca flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Instale o app para ativar</p>
            <p className="text-xs text-gray-600 mt-1">
              No iPhone, as notificações push exigem que o Almeida Finance esteja instalado na Tela de Início. Siga as instruções abaixo.
            </p>
          </div>
        </div>
        <InstrucoesExpandiveis secaoAberta={secaoAberta} onToggle={toggleSecao} plataforma={plataforma} ehiOS={ehiOS} instalado={instalado} />
        <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
      </div>
    )
  }

  // ── Navegador sem suporte ───────────────────────────────────────────────────
  if (!suportado) {
    return (
      <div className="space-y-3">
        <Cabecalho />
        <div className="card p-4 text-center">
          <BellOff size={26} className="text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-900 font-semibold">Notificações não disponíveis</p>
          <p className="text-xs text-gray-500 mt-1">
            Use Chrome, Edge ou Safari no iOS 16.4+ instalado na Tela de Início.
          </p>
        </div>
        <InstrucoesExpandiveis secaoAberta={secaoAberta} onToggle={toggleSecao} plataforma={plataforma} ehiOS={ehiOS} instalado={instalado} />
        <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
      </div>
    )
  }

  // ── Estado padrão: solicitar ativação ───────────────────────────────────────
  return (
    <div className="space-y-3">
      <Cabecalho />

      {/* Benefícios */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-2.5">
        {[
          { emoji: '📅', texto: 'Vencimentos e faturas próximas' },
          { emoji: '💰', texto: 'Alertas de saldo projetado baixo' },
          { emoji: '🎯', texto: 'Lembretes de metas e investimentos' },
        ].map(({ emoji, texto }) => (
          <div key={texto} className="flex items-center gap-3">
            <span className="text-base flex-shrink-0">{emoji}</span>
            <p className="text-sm text-gray-700">{texto}</p>
          </div>
        ))}
      </div>

      {/* Erro */}
      {(erroLocal || erro) && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {erroLocal || erro}
        </p>
      )}

      {/* CTA */}
      <button
        type="button"
        onClick={handleAtivar}
        disabled={carregando}
        className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-sm font-semibold disabled:opacity-60"
      >
        {carregando ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ativando...</>
        ) : (
          <><Bell size={16} /> Ativar notificações</>
        )}
      </button>

      {/* Instruções expansíveis */}
      <InstrucoesExpandiveis
        secaoAberta={secaoAberta}
        onToggle={toggleSecao}
        plataforma={plataforma}
        ehiOS={ehiOS}
        instalado={instalado}
      />

      <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
    </div>
  )
}

// ── Bloco de instruções para os 3 casos ─────────────────────────────────────
function InstrucoesExpandiveis({ secaoAberta, onToggle, plataforma, ehiOS, instalado }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide px-1">Como ativar</p>

      <SecaoInstrucao
        icone={Smartphone}
        titulo="iPhone (iOS 16.4+)"
        badge={ehiOS ? 'Seu dispositivo' : null}
        ativa={ehiOS}
        aberta={secaoAberta === 'ios'}
        onToggle={() => onToggle('ios')}
      >
        <Passo n={1}>Abra o <strong className="text-gray-900 font-semibold">Almeida Finance no Safari</strong></Passo>
        <Passo n={2}>Toque no ícone <strong className="text-gray-900 font-semibold">Compartilhar ↑</strong> na barra inferior do Safari</Passo>
        <Passo n={3}>Role para baixo e toque em <strong className="text-gray-900 font-semibold">"Adicionar à Tela de Início"</strong></Passo>
        <Passo n={4}>Confirme o nome e toque em <strong className="text-gray-900 font-semibold">"Adicionar"</strong></Passo>
        <Passo n={5}>Abra o Almeida Finance <strong className="text-gray-900 font-semibold">pelo ícone instalado</strong> (não pelo Safari)</Passo>
        <Passo n={6}>Acesse <strong className="text-gray-900 font-semibold">Configurações → Notificações financeiras</strong></Passo>
        <Passo n={7}>Toque em <strong className="text-gray-900 font-semibold">"Ativar notificações"</strong> e selecione <strong className="text-gray-900 font-semibold">"Permitir"</strong></Passo>
        <Nota>Notificações push no iPhone exigem iOS 16.4 ou superior e o app instalado na Tela de Início. Não funcionam via Safari diretamente.</Nota>
      </SecaoInstrucao>

      <SecaoInstrucao
        icone={Smartphone}
        titulo="Android (Chrome)"
        badge={plataforma === 'android' && !ehiOS ? 'Seu dispositivo' : null}
        ativa={plataforma === 'android' && !ehiOS}
        aberta={secaoAberta === 'android'}
        onToggle={() => onToggle('android')}
      >
        <Passo n={1}>Abra o <strong className="text-gray-900 font-semibold">Almeida Finance no Chrome</strong></Passo>
        <Passo n={2}>Acesse <strong className="text-gray-900 font-semibold">Configurações → Notificações financeiras</strong></Passo>
        <Passo n={3}>Toque em <strong className="text-gray-900 font-semibold">"Ativar notificações"</strong></Passo>
        <Passo n={4}>Autorize quando o Chrome solicitar permissão</Passo>
        <Passo n={5}><strong className="text-gray-900 font-semibold">Opcional:</strong> instale o app tocando em <strong className="text-gray-900 font-semibold">"Adicionar à tela inicial"</strong> no menu do Chrome (⋮)</Passo>
        <Nota>Se as notificações estiverem bloqueadas, vá em Ajustes do Android → Apps → Chrome → Notificações e ative as permissões do site.</Nota>
      </SecaoInstrucao>

      <SecaoInstrucao
        icone={Monitor}
        titulo="Computador (Chrome / Edge / Firefox)"
        badge={plataforma === 'desktop' ? 'Seu dispositivo' : null}
        ativa={plataforma === 'desktop'}
        aberta={secaoAberta === 'desktop'}
        onToggle={() => onToggle('desktop')}
      >
        <Passo n={1}>Abra o <strong className="text-gray-900 font-semibold">Almeida Finance no navegador</strong></Passo>
        <Passo n={2}>Acesse <strong className="text-gray-900 font-semibold">Configurações → Notificações financeiras</strong></Passo>
        <Passo n={3}>Clique em <strong className="text-gray-900 font-semibold">"Ativar notificações"</strong></Passo>
        <Passo n={4}>Permita o envio de notificações quando o navegador solicitar</Passo>
        <Passo n={5}>Se o botão de permissão não aparecer, clique no <strong className="text-gray-900 font-semibold">ícone de cadeado 🔒</strong> na barra de endereços e mude "Notificações" para <strong className="text-gray-900 font-semibold">"Permitir"</strong></Passo>
        <Nota>As notificações aparecem mesmo com o navegador minimizado. Para recebê-las com o navegador fechado, instale o app como PWA via "Instalar Almeida Finance" no menu do Chrome/Edge.</Nota>
      </SecaoInstrucao>
    </div>
  )
}

// ── Rodapé do onboarding ─────────────────────────────────────────────────────
function RodapePular({ noOnboarding, onPular, onConcluir }) {
  if (!noOnboarding) return null
  return (
    <div className="text-center pt-1">
      <button
        type="button"
        onClick={onPular || onConcluir}
        className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2 transition-colors"
      >
        Pular por enquanto
      </button>
      <p className="text-xs text-gray-400 mt-1">Você pode ativar depois em Configurações.</p>
    </div>
  )
}
