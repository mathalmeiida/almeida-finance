import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, CreditCard,
  UtensilsCrossed, PiggyBank, Target, BarChart2, ShoppingCart, Sparkles,
  ArrowRight, ChevronRight,
} from 'lucide-react'
import LogoMarca from './LogoMarca'

// ─── Apresentação inicial ─────────────────────────────────────────────────────
// Exibida antes do onboarding: 4 slides com visual vinho premium.
// Prop aoConcluir: chamada ao pular OU ao clicar "Começar" no último slide.
// NÃO tem botões de autenticação — esses estão no fluxo de cadastro/login.
// Respeita prefers-reduced-motion (desabilita auto-avanço e animações).

// ─── Componentes visuais dos slides ───────────────────────────────────────────

function MiniCardVinho({ icone: Icone, rotulo, valor, destaque }) {
  return (
    <div className={`rounded-xl border p-2.5 text-left ${
      destaque
        ? 'bg-white/15 border-white/20'
        : 'bg-white/8 border-white/10'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          destaque ? 'bg-white/20' : 'bg-white/10'
        }`}>
          <Icone size={14} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-white/60 leading-tight truncate">{rotulo}</p>
          {valor && <p className="text-xs font-bold text-white leading-tight truncate">{valor}</p>}
        </div>
      </div>
    </div>
  )
}

// Slide 1 — Controle total
function VisualControle() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
      {/* Cabeçalho saldo */}
      <div className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <p className="text-[11px] text-white/60">Saldo disponível</p>
        <p className="text-2xl font-bold text-white">R$ 3.250 <span className="text-xs font-normal text-white/50">ilustrativo</span></p>
        <div className="flex gap-2 mt-1.5">
          <span className="text-[10px] text-emerald-300 font-semibold">↑ R$ 6.000 receitas</span>
          <span className="text-[10px] text-red-300 font-semibold">↓ R$ 2.750 despesas</span>
        </div>
      </div>
      {/* Grid de cards */}
      <div className="grid grid-cols-2 gap-2 p-3">
        <MiniCardVinho icone={CreditCard}      rotulo="Cartões"   valor="R$ 1.200" />
        <MiniCardVinho icone={UtensilsCrossed} rotulo="VR / VA"   valor="R$ 850"  />
        <MiniCardVinho icone={PiggyBank}       rotulo="Reserva"   valor="R$ 5.000" destaque />
        <MiniCardVinho icone={BarChart2}       rotulo="Projeção"  valor="+ R$ 480" destaque />
      </div>
    </div>
  )
}

// Slide 2 — Planejamento inteligente
function VisualPlanejamento() {
  return (
    <div className="rounded-2xl overflow-hidden space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wide">Planejamento do mês</p>
      </div>
      {/* Limite diário */}
      <div className="mx-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <p className="text-[11px] text-white/60">Posso gastar hoje</p>
        <p className="text-2xl font-extrabold text-white">R$ 87 <span className="text-xs font-normal text-white/50">/dia</span></p>
        {/* Barra de uso */}
        <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-white/70" style={{ width: '38%' }} />
        </div>
        <p className="text-[10px] text-white/50 mt-1">38% utilizado hoje · R$ 33 gastos</p>
      </div>
      {/* Próximos vencimentos */}
      <div className="px-3 pb-3 space-y-1.5">
        {[
          { label: 'Aluguel', data: 'em 3 dias', valor: 'R$ 1.200' },
          { label: 'Fatura Nubank', data: 'em 8 dias', valor: 'R$ 480' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-white/80">{item.label}</span>
            <div className="text-right">
              <span className="text-[10px] text-white/50 block">{item.data}</span>
              <span className="text-xs font-semibold text-white">{item.valor}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Slide 3 — Simular compra e "E se?"
function VisualSimular() {
  return (
    <div className="rounded-2xl overflow-hidden space-y-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="px-4 pt-3 pb-0">
        <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wide">Simule antes de decidir</p>
      </div>
      {/* Posso comprar? */}
      <div className="mx-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShoppingCart size={13} className="text-white/70" />
          <p className="text-[11px] text-white/70">Simular compra</p>
        </div>
        <p className="text-xl font-bold text-white">R$ 1.500 <span className="text-xs font-normal text-white/50">6× R$ 250</span></p>
        <div className="flex gap-2 mt-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}>
            -R$ 250/mês
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>
            Novo limite R$ 74/dia
          </span>
        </div>
      </div>
      {/* E se? */}
      <div className="px-3 pb-3 space-y-1.5">
        <p className="text-[10px] text-white/50 px-0.5">Cenários "E se?"</p>
        {[
          { label: 'Variação de renda +R$ 800', delta: '+R$ 26/dia', cor: 'rgba(34,197,94,0.25)', txtCor: '#86EFAC' },
          { label: 'Nova despesa -R$ 300',       delta: '-R$ 10/dia', cor: 'rgba(239,68,68,0.25)', txtCor: '#FCA5A5' },
        ].map(c => (
          <div key={c.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-white/80 flex items-center gap-1"><Sparkles size={10} className="text-white/40" />{c.label}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c.cor, color: c.txtCor }}>{c.delta}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Slide 4 — Investimentos e metas
function VisualMetas() {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="px-4 pt-3 pb-1">
        <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wide">Metas e evolução</p>
      </div>
      <div className="px-3 pb-3 space-y-2 mt-1">
        {[
          { label: 'Reserva de emergência', pct: 64, cor: 'rgba(34,197,94,0.8)'  },
          { label: 'Viagem',                pct: 38, cor: 'rgba(255,255,255,0.8)' },
          { label: 'Investimentos',         pct: 52, cor: 'rgba(251,191,36,0.8)' },
        ].map(m => (
          <div key={m.label} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/80 flex items-center gap-1">
                <Target size={11} className="text-white/40" />{m.label}
              </span>
              <span className="text-xs font-bold text-white">{m.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
              <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.cor }} />
            </div>
          </div>
        ))}
        {/* Patrimônio investido */}
        <div className="rounded-lg px-2.5 py-2 flex items-center justify-between"
          style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <span className="text-xs text-white/80 flex items-center gap-1.5"><TrendingUp size={12} className="text-white/60" />Patrimônio investido</span>
          <span className="text-sm font-bold text-white">R$ 18.500</span>
        </div>
      </div>
    </div>
  )
}

const SLIDES = [
  {
    titulo: 'Todas as suas finanças em um só lugar.',
    texto: 'Saldo, receitas, despesas, cartões e benefícios — organizados e sempre atualizados.',
    Visual: VisualControle,
  },
  {
    titulo: 'Planejamento e decisões melhores.',
    texto: 'Saiba exatamente quanto pode gastar por dia, com alertas de vencimentos e projeções reais.',
    Visual: VisualPlanejamento,
  },
  {
    titulo: '"Posso comprar?" e "E se...?"',
    texto: 'Simule compras parceladas e cenários financeiros antes de comprometer seu orçamento.',
    Visual: VisualSimular,
  },
  {
    titulo: 'Investimentos, metas e evolução.',
    texto: 'Acompanhe seu patrimônio, conquiste suas metas e visualize sua evolução financeira.',
    Visual: VisualMetas,
  },
]

const INTERVALO_MS = 4500

export default function Apresentacao({ aoConcluir, rodapeCustom = null }) {
  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)
  const totalSlides = SLIDES.length
  const ehUltimo = idx === totalSlides - 1

  const prefereReducao = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const avancar = useCallback(() => {
    setIdx(n => (n + 1) % totalSlides)
  }, [totalSlides])

  // Auto-avanço — pausa quando a aba está inativa ou no último slide
  useEffect(() => {
    if (prefereReducao || ehUltimo) return
    function iniciar() { timerRef.current = setInterval(avancar, INTERVALO_MS) }
    function pausar() { clearInterval(timerRef.current) }
    iniciar()
    const onVisibility = () => document.hidden ? pausar() : iniciar()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      pausar()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [avancar, prefereReducao, ehUltimo])

  // Swipe horizontal
  const touchStartX = useRef(null)
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) {
      setIdx(n => diff > 0
        ? Math.min(n + 1, totalSlides - 1)
        : Math.max(n - 1, 0))
    }
    touchStartX.current = null
  }

  const { titulo, texto, Visual } = SLIDES[idx]

  return (
    <div
      className="min-h-[100dvh] flex flex-col overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #3d0a18 0%, #250610 100%)' }}
    >
      {/* ── Barra de progresso + botão pular ── */}
      <div className="flex items-center gap-3 px-4 pt-safe" style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
        {/* Barras de progresso */}
        <div className="flex gap-1.5 flex-1" role="tablist" aria-label="Progresso da apresentação">
          {SLIDES.map((_, i) => (
            <button
              key={i} type="button"
              role="tab" aria-selected={i === idx}
              aria-label={`Slide ${i + 1} de ${totalSlides}`}
              onClick={() => setIdx(i)}
              className="h-1 flex-1 rounded-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/50"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <span
                className="block h-full rounded-full transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  width: i < idx ? '100%' : i === idx ? '100%' : '0%',
                  opacity: i <= idx ? 1 : 0,
                }}
              />
            </button>
          ))}
        </div>
        {/* Pular — só visível antes do último slide */}
        {!ehUltimo && (
          <button
            type="button"
            onClick={() => aoConcluir?.()}
            className="text-xs text-white/50 hover:text-white/80 transition-colors flex-shrink-0 py-1"
          >
            Pular
          </button>
        )}
      </div>

      {/* ── Logo ── */}
      <div className="px-4 mt-3">
        <LogoMarca imgClassName="h-8 w-auto" />
      </div>

      {/* ── Conteúdo do slide ── */}
      <div
        className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Texto */}
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2 leading-tight">
          {titulo}
        </h1>
        <p className="text-sm text-white/65 mb-5 leading-relaxed">
          {texto}
        </p>

        {/* Visual do slide */}
        <div className="flex-1 flex items-center">
          <div className="w-full">
            <Visual />
          </div>
        </div>

        {/* Indicadores de posição */}
        <div className="flex items-center justify-center gap-2 mt-5" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <button
              key={i} type="button"
              onClick={() => setIdx(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 24 : 8,
                height: 8,
                background: i === idx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Rodapé: Próximo ou Começar ── */}
      <div
        className="px-4 max-w-md mx-auto w-full"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 20px)', marginBottom: 4 }}
      >
        {!ehUltimo ? (
          // Slides intermediários: botão Próximo + dica de swipe
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-white/35">Deslize para navegar</p>
            <button
              type="button"
              onClick={() => setIdx(n => Math.min(n + 1, totalSlides - 1))}
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Próximo <ChevronRight size={16} />
            </button>
          </div>
        ) : rodapeCustom ? (
          // Último slide com rodapé customizado (ex.: botões Cadastrar/Login)
          rodapeCustom
        ) : (
          // Último slide: botão de ação principal padrão
          <button
            type="button"
            onClick={() => aoConcluir?.()}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.95)', color: '#3d0a18' }}
          >
            Começar agora <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
