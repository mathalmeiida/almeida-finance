import React, { useState } from 'react'
import {
  Bell, BellOff, Smartphone, Monitor,
  CheckCircle2, X, ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import { usePushNotificacoes } from '../hooks/usePushNotificacoes'

// ── NotificacoesPush ──────────────────────────────────────────────────────────
// Componente de notificações push com suporte a tema claro/escuro.
// Usa classes Tailwind responsivas ao tema (dark:) para compatibilidade com
// corTema='claro', 'escuro' e 'automatico' do AuthContext.
// Não altera Service Worker, VAPID, Cron Job nem Supabase.
// ─────────────────────────────────────────────────────────────────────────────

const ESTILO = {
  // card: tema claro = branco/borda suave | escuro = vinho escuro/borda vinho
  card:    'rounded-2xl border border-gray-200 dark:border-[#502838] bg-white dark:bg-[#21121F] overflow-hidden',
  header:  'flex items-center justify-between gap-3 p-4 cursor-pointer select-none',
  body:    'px-4 pb-4 space-y-3',
  passo:   'flex items-start gap-2.5',
  num:     'flex-shrink-0 w-5 h-5 rounded-full bg-marca text-white text-[10px] font-bold flex items-center justify-center mt-0.5',
  txt:     'text-sm text-gray-600 dark:text-[#D4A8B6] leading-snug',
  txtemph: 'text-gray-900 dark:text-white font-semibold',
  badge:   'text-[10px] font-semibold px-2 py-0.5 rounded-full',
}

// ── Seção expansível genérica ────────────────────────────────────────────────
function SecaoInstrucao({ icone: Icone, titulo, badge, badgeCor, ativa, aberta, onToggle, children }) {
  return (
    <div className={`${ESTILO.card} ${ativa ? 'border-marca/60 dark:border-[#C4507A]/60' : ''}`}>
      <button type="button" className={ESTILO.header} onClick={onToggle} aria-expanded={aberta}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-marca-100 dark:bg-[#3d1528] flex items-center justify-center flex-shrink-0">
            <Icone size={18} className="text-marca dark:text-[#C4507A]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{titulo}</p>
            {badge && (
              <span className={`${ESTILO.badge} mt-0.5 inline-block ${badgeCor || 'bg-marca-100 dark:bg-[#3d1528] text-marca dark:text-[#C4507A]'}`}>
                {badge}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ativa && <span className="text-[10px] font-semibold text-marca dark:text-[#C4507A] hidden sm:block">Seu dispositivo</span>}
          {aberta
            ? <ChevronUp size={16} className="text-gray-400 dark:text-[#D4A8B6]"/>
            : <ChevronDown size={16} className="text-gray-400 dark:text-[#D4A8B6]"/>}
        </div>
      </button>
      {aberta && <div className={ESTILO.body}>{children}</div>}
    </div>
  )
}

// ── Passo numerado ───────────────────────────────────────────────────────────
function Passo({ n, children }) {
  return (
    <div className={ESTILO.passo}>
      <span className={ESTILO.num}>{n}</span>
      <span className={ESTILO.txt}>{children}</span>
    </div>
  )
}

// ── Nota informativa ─────────────────────────────────────────────────────────
function Nota({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-[#140B10] border border-gray-200 dark:border-[#502838] p-3">
      <Info size={14} className="text-marca dark:text-[#C4507A] flex-shrink-0 mt-0.5" />
      <p className="text-xs text-gray-500 dark:text-[#D4A8B6] leading-snug">{children}</p>
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
  // Qual seção de instrução está aberta: 'ios' | 'android' | 'desktop' | null
  // Por padrão abre a seção correspondente ao dispositivo atual
  const secaoAuto = ehiOS ? 'ios' : plataforma === 'android' ? 'android' : 'desktop'
  const [secaoAberta, setSecaoAberta] = useState(secaoAuto)

  const noOnboarding = contexto === 'onboarding'

  function toggleSecao(id) {
    setSecaoAberta(v => v === id ? null : id)
  }

  // ── Ativar ──────────────────────────────────────────────────────────────────
  async function handleAtivar() {
    setErroLocal('')
    try {
      await ativar()
      if (noOnboarding) onConcluir?.()
    } catch (err) {
      setErroLocal(err.message || 'Não foi possível ativar. Tente novamente.')
    }
  }

  // ── Cabeçalho do componente ─────────────────────────────────────────────────
  const Cabecalho = () => (
    <div className="flex items-center gap-3">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-marca-100 dark:bg-[#3d1528] border border-gray-200 dark:border-[#502838]">
        <Bell size={20} className="text-marca dark:text-[#C4507A]" />
      </div>
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Notificações financeiras</h3>
        <p className="text-xs text-gray-500 dark:text-[#D4A8B6] mt-0.5">Alertas automáticos baseados nos seus dados reais.</p>
      </div>
    </div>
  )

  // ── Permissão negada ────────────────────────────────────────────────────────
  if (permissao === 'denied') {
    return (
      <div className="space-y-3">
        <Cabecalho />
        <div className="rounded-2xl border border-red-200 dark:border-rose-800/50 bg-red-50 dark:bg-rose-900/20 p-4 space-y-2">
          <div className="flex items-center gap-3">
            <X size={18} className="text-red-500 dark:text-rose-400 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700 dark:text-rose-300">Notificações bloqueadas</p>
          </div>
          <p className="text-xs text-gray-600 dark:text-[#D4A8B6]">
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
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-center gap-3">
          <CheckCircle2 size={22} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Notificações ativas</p>
            <p className="text-xs text-gray-500 dark:text-[#D4A8B6] mt-0.5">
              Você receberá alertas diários de vencimentos, faturas e saldo.
            </p>
          </div>
        </div>
        {contexto === 'configuracoes' && (
          <button type="button" onClick={desativar} disabled={carregando}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-[#502838] bg-white dark:bg-[#21121F] py-2.5 text-sm text-gray-600 dark:text-[#D4A8B6] hover:border-red-300 dark:hover:border-rose-700 hover:text-red-600 dark:hover:text-rose-400 transition-colors disabled:opacity-60">
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
        <div className="rounded-2xl border border-marca/40 dark:border-[#C4507A]/40 bg-marca-100/40 dark:bg-[#3d1528]/30 p-4 flex items-start gap-3">
          <Info size={18} className="text-marca dark:text-[#C4507A] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Instale o app para ativar</p>
            <p className="text-xs text-gray-600 dark:text-[#D4A8B6] mt-1">
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
        <div className="rounded-2xl border border-gray-200 dark:border-[#502838] bg-gray-50 dark:bg-[#21121F] p-4 text-center">
          <BellOff size={26} className="text-gray-400 dark:text-[#D4A8B6] mx-auto mb-2" />
          <p className="text-sm text-gray-900 dark:text-white font-semibold">Notificações não disponíveis</p>
          <p className="text-xs text-gray-500 dark:text-[#D4A8B6] mt-1">
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
      <div className="rounded-2xl border border-gray-200 dark:border-[#502838] bg-gray-50 dark:bg-[#21121F] p-4 space-y-2.5">
        {[
          { emoji: '📅', texto: 'Vencimentos e faturas próximas' },
          { emoji: '💰', texto: 'Alertas de saldo projetado baixo' },
          { emoji: '🎯', texto: 'Lembretes de metas e investimentos' },
        ].map(({ emoji, texto }) => (
          <div key={texto} className="flex items-center gap-3">
            <span className="text-base flex-shrink-0">{emoji}</span>
            <p className="text-sm text-gray-700 dark:text-[#FAF7F8]">{texto}</p>
          </div>
        ))}
      </div>

      {/* Erro */}
      {(erroLocal || erro) && (
        <p className="text-xs text-red-600 dark:text-rose-400 bg-red-50 dark:bg-rose-900/20 border border-red-200 dark:border-rose-800/40 rounded-xl px-3 py-2">
          {erroLocal || erro}
        </p>
      )}

      {/* CTA */}
      <button type="button" onClick={handleAtivar} disabled={carregando}
        className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-60 bg-marca hover:bg-marca-hover"
        style={carregando ? { opacity: 0.7 } : {}}>
        {carregando ? (
          <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Ativando...</>
        ) : (
          <><Bell size={16} /> Ativar notificações</>
        )}
      </button>

      {/* Instruções expansíveis */}
      <InstrucoesExpandiveis secaoAberta={secaoAberta} onToggle={toggleSecao} plataforma={plataforma} ehiOS={ehiOS} instalado={instalado} />

      <RodapePular noOnboarding={noOnboarding} onPular={onPular} onConcluir={onConcluir} />
    </div>
  )
}

// ── Bloco de instruções para os 3 casos ─────────────────────────────────────
function InstrucoesExpandiveis({ secaoAberta, onToggle, plataforma, ehiOS, instalado }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 dark:text-[#D4A8B6] font-semibold uppercase tracking-wide px-1">Como ativar</p>

      {/* iOS */}
      <SecaoInstrucao
        icone={Smartphone}
        titulo="iPhone (iOS 16.4+)"
        badge={ehiOS ? 'Seu dispositivo' : null}
        badgeCor="bg-marca-100 dark:bg-[#C4507A]/20 text-marca dark:text-[#C4507A]"
        ativa={ehiOS}
        aberta={secaoAberta === 'ios'}
        onToggle={() => onToggle('ios')}
      >
        <Passo n={1}>Abra o <strong className={ESTILO.txtemph}>Almeida Finance no Safari</strong></Passo>
        <Passo n={2}>Toque no ícone <strong className={ESTILO.txtemph}>Compartilhar ↑</strong> na barra inferior do Safari</Passo>
        <Passo n={3}>Role para baixo e toque em <strong className={ESTILO.txtemph}>"Adicionar à Tela de Início"</strong></Passo>
        <Passo n={4}>Confirme o nome e toque em <strong className={ESTILO.txtemph}>"Adicionar"</strong></Passo>
        <Passo n={5}>Abra o Almeida Finance <strong className={ESTILO.txtemph}>pelo ícone instalado</strong> (não pelo Safari)</Passo>
        <Passo n={6}>Acesse <strong className={ESTILO.txtemph}>Configurações → Notificações financeiras</strong></Passo>
        <Passo n={7}>Toque em <strong className={ESTILO.txtemph}>"Ativar notificações"</strong> e selecione <strong className={ESTILO.txtemph}>"Permitir"</strong></Passo>
        <Nota>Notificações push no iPhone exigem iOS 16.4 ou superior e o app instalado na Tela de Início. Não funcionam via Safari diretamente.</Nota>
      </SecaoInstrucao>

      {/* Android */}
      <SecaoInstrucao
        icone={Smartphone}
        titulo="Android (Chrome)"
        badge={plataforma === 'android' && !ehiOS ? 'Seu dispositivo' : null}
        badgeCor="bg-marca-100 dark:bg-[#C4507A]/20 text-marca dark:text-[#C4507A]"
        ativa={plataforma === 'android' && !ehiOS}
        aberta={secaoAberta === 'android'}
        onToggle={() => onToggle('android')}
      >
        <Passo n={1}>Abra o <strong className={ESTILO.txtemph}>Almeida Finance no Chrome</strong></Passo>
        <Passo n={2}>Acesse <strong className={ESTILO.txtemph}>Configurações → Notificações financeiras</strong></Passo>
        <Passo n={3}>Toque em <strong className={ESTILO.txtemph}>"Ativar notificações"</strong></Passo>
        <Passo n={4}>Autorize quando o Chrome solicitar permissão</Passo>
        <Passo n={5}><strong className={ESTILO.txtemph}>Opcional:</strong> instale o app tocando em <strong className={ESTILO.txtemph}>"Adicionar à tela inicial"</strong> no menu do Chrome (⋮)</Passo>
        <Nota>Se as notificações estiverem bloqueadas, vá em Ajustes do Android → Apps → Chrome → Notificações e ative as permissões do site.</Nota>
      </SecaoInstrucao>

      {/* Desktop */}
      <SecaoInstrucao
        icone={Monitor}
        titulo="Computador (Chrome / Edge / Firefox)"
        badge={plataforma === 'desktop' ? 'Seu dispositivo' : null}
        badgeCor="bg-marca-100 dark:bg-[#C4507A]/20 text-marca dark:text-[#C4507A]"
        ativa={plataforma === 'desktop'}
        aberta={secaoAberta === 'desktop'}
        onToggle={() => onToggle('desktop')}
      >
        <Passo n={1}>Abra o <strong className={ESTILO.txtemph}>Almeida Finance no navegador</strong></Passo>
        <Passo n={2}>Acesse <strong className={ESTILO.txtemph}>Configurações → Notificações financeiras</strong></Passo>
        <Passo n={3}>Clique em <strong className={ESTILO.txtemph}>"Ativar notificações"</strong></Passo>
        <Passo n={4}>Permita o envio de notificações quando o navegador solicitar</Passo>
        <Passo n={5}>Se o botão de permissão não aparecer, clique no <strong className={ESTILO.txtemph}>ícone de cadeado 🔒</strong> na barra de endereços e mude "Notificações" para <strong className={ESTILO.txtemph}>"Permitir"</strong></Passo>
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
      <button type="button" onClick={onPular || onConcluir}
        className="text-sm text-gray-500 dark:text-[#D4A8B6] hover:text-gray-900 dark:hover:text-white underline underline-offset-2 transition-colors">
        Pular por enquanto
      </button>
      <p className="text-xs text-gray-400 dark:text-[#6b3050] mt-1">Você pode ativar depois em Configurações.</p>
    </div>
  )
}
