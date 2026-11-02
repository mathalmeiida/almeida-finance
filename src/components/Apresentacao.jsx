import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard,
  UtensilsCrossed, PiggyBank, Target, BarChart2, ShoppingCart, Sparkles,
} from 'lucide-react'
import LogoMarca from './LogoMarca'

// ─── Apresentação inicial — 4 slides com auto-avanço ─────────────────────────
// Exibida UMA VEZ, antes do onboarding, no primeiro acesso.
// Números são ILUSTRATIVOS (nada gravado). Respeita prefers-reduced-motion.
// Botões fixos no rodapé: Cadastrar e Já tenho conta.

function MiniCard({ icone: Icone, cor, rotulo, valor }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-2.5 text-left shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cor}`}>
          <Icone size={14} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 leading-tight truncate">{rotulo}</p>
          {valor && <p className="text-xs font-bold text-gray-800 leading-tight truncate">{valor}</p>}
        </div>
      </div>
    </div>
  )
}

// Tela 1 — Home / Controle
function VisualControle() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
      <div className="bg-marca-grad rounded-xl p-3 text-white mb-3">
        <p className="text-[11px] text-white/80">Saldo disponível</p>
        <p className="text-lg font-bold">R$ 3.250,00 <span className="text-xs font-normal opacity-70">ilustrativo</span></p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniCard icone={TrendingUp}      cor="bg-green-100 text-green-600"     rotulo="Receitas"  valor="R$ 6.000" />
        <MiniCard icone={TrendingDown}    cor="bg-red-100 text-red-500"         rotulo="Despesas"  valor="R$ 2.750" />
        <MiniCard icone={CreditCard}      cor="bg-marca-100 text-marca"         rotulo="Cartões"   valor="R$ 1.200" />
        <MiniCard icone={UtensilsCrossed} cor="bg-amber-100 text-amber-600"     rotulo="VR / VA"   valor="R$ 850"  />
        <MiniCard icone={PiggyBank}       cor="bg-emerald-100 text-emerald-600" rotulo="Reserva"   valor="R$ 5.000"/>
        <MiniCard icone={BarChart2}       cor="bg-marca-100 text-marca"         rotulo="Projeção"  />
      </div>
    </div>
  )
}

// Tela 2 — E se? / Simulação de cenários
function VisualESe() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700 mb-1">Simulação de cenários</p>
      {[
        { label: 'Variação de renda',   delta: '+R$ 800',  cor: 'text-emerald-600 bg-emerald-50' },
        { label: 'Nova despesa fixa',   delta: '-R$ 300',  cor: 'text-red-600 bg-red-50'         },
        { label: 'Desligamento',        delta: 'R$ 0/mês', cor: 'text-amber-700 bg-amber-50'     },
      ].map(c => (
        <div key={c.label} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100">
          <span className="text-xs text-gray-700 flex items-center gap-1.5"><Sparkles size={12} className="text-marca"/>{c.label}</span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.cor}`}>{c.delta}</span>
        </div>
      ))}
    </div>
  )
}

// Tela 3 — Simular compra
function VisualSimular() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-3">
      <div className="bg-marca-grad rounded-xl p-3 text-white text-center">
        <ShoppingCart size={20} className="mx-auto mb-1 opacity-90" />
        <p className="text-[11px] text-white/80">Compra simulada</p>
        <p className="text-xl font-bold">R$ 1.500,00</p>
        <p className="text-[11px] text-white/70 mt-0.5">6× de R$ 250 · ilustrativo</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white rounded-xl p-2 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-500">Impacto mensal</p>
          <p className="text-sm font-bold text-red-500">-R$ 250</p>
        </div>
        <div className="bg-white rounded-xl p-2 border border-gray-100 text-center">
          <p className="text-[10px] text-gray-500">Novo limite/dia</p>
          <p className="text-sm font-bold text-marca">R$ 74</p>
        </div>
      </div>
    </div>
  )
}

// Tela 4 — Planejamento / Metas
function VisualPlanejamento() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-700 mb-1">Suas metas</p>
      {[
        { label: 'Reserva de emergência', pct: 64, cor: 'bg-emerald-500' },
        { label: 'Viagem',                pct: 38, cor: 'bg-marca'       },
        { label: 'Investimentos',         pct: 52, cor: 'bg-amber-500'   },
      ].map(m => (
        <div key={m.label} className="bg-white rounded-xl px-3 py-2 border border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-700 flex items-center gap-1"><Target size={11} className="text-marca"/>{m.label}</span>
            <span className="text-xs font-bold text-gray-800">{m.pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${m.cor}`} style={{ width: `${m.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const SLIDES = [
  {
    titulo: 'Controle total da sua vida financeira.',
    texto: 'Organize seu dinheiro, cartões, despesas e investimentos em um só lugar.',
    Visual: VisualControle,
  },
  {
    titulo: 'E se? Simule cenários e tome decisões melhores.',
    texto: 'Descubra como mudanças na sua renda e despesas podem transformar seu planejamento.',
    Visual: VisualESe,
  },
  {
    titulo: 'Antes de comprar, descubra se cabe no orçamento.',
    texto: 'Simule compras à vista ou parceladas e entenda o impacto no seu dinheiro.',
    Visual: VisualSimular,
  },
  {
    titulo: 'Planeje hoje. Conquiste mais amanhã.',
    texto: 'Acompanhe metas, investimentos e sua evolução financeira.',
    Visual: VisualPlanejamento,
  },
]

const INTERVALO_MS = 4000

export default function Apresentacao({ aoConcluir }) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(0)
  const timerRef = useRef(null)
  const totalSlides = SLIDES.length

  // Detecta preferência por movimento reduzido
  const prefereReducao = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const avancar = useCallback(() => {
    setIdx(n => (n + 1) % totalSlides)
  }, [totalSlides])

  // Auto-avanço — pausa quando a aba está inativa
  useEffect(() => {
    if (prefereReducao) return
    function iniciar() {
      timerRef.current = setInterval(avancar, INTERVALO_MS)
    }
    function pausar() {
      clearInterval(timerRef.current)
    }
    iniciar()
    document.addEventListener('visibilitychange', () => {
      document.hidden ? pausar() : iniciar()
    })
    return () => {
      pausar()
      document.removeEventListener('visibilitychange', pausar)
    }
  }, [avancar, prefereReducao])

  // Suporte a toque (swipe horizontal)
  const touchStartX = useRef(null)
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current == null) return
    const diff = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 40) setIdx(n => diff > 0 ? (n + 1) % totalSlides : (n - 1 + totalSlides) % totalSlides)
    touchStartX.current = null
  }

  const { titulo, texto, Visual } = SLIDES[idx]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Barra de progresso no topo */}
      <div className="flex gap-1 px-4 pt-safe pt-3" role="tablist" aria-label="Progresso da apresentação">
        {SLIDES.map((_, i) => (
          <button
            key={i} type="button"
            role="tab" aria-selected={i === idx}
            aria-label={`Ir para tela ${i + 1}`}
            onClick={() => setIdx(i)}
            className="h-1 flex-1 rounded-full overflow-hidden bg-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca"
          >
            <span
              className="block h-full rounded-full bg-marca transition-all duration-300"
              style={{ width: i < idx ? '100%' : i === idx ? '100%' : '0%', opacity: i <= idx ? 1 : 0.4 }}
            />
          </button>
        ))}
      </div>

      {/* Conteúdo do slide */}
      <div
        className="flex-1 flex flex-col px-4 py-4 max-w-md mx-auto w-full"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="flex justify-between items-center mb-6">
          <LogoMarca imgClassName="h-9 w-auto" padding="px-3 py-2" />
          <button
            onClick={() => aoConcluir?.()}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Pular
          </button>
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 leading-tight">{titulo}</h1>
        <p className="text-sm text-gray-500 mb-5 leading-relaxed">{texto}</p>

        <div className="flex-1 flex items-center">
          <div className="w-full">
            <Visual />
          </div>
        </div>

        {/* Indicadores (pontos) */}
        <div className="flex items-center justify-center gap-2 mt-5" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <button
              key={i} type="button"
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-marca' : 'w-2 bg-gray-300'}`}
            />
          ))}
        </div>
      </div>

      {/* Botões fixos no rodapé */}
      <div className="px-4 pb-safe pb-6 space-y-3 max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={() => navigate('/cadastro')}
          className="btn-primary w-full py-3 text-base font-semibold"
        >
          Cadastrar
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="btn-secondary w-full py-3 text-base font-semibold"
        >
          Já tenho conta
        </button>
      </div>
    </div>
  )
}
