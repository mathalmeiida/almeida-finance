import React, { useState } from 'react'
import {
  ArrowRight, ArrowLeft, TrendingUp, TrendingDown, CreditCard,
  UtensilsCrossed, PiggyBank, Landmark, CalendarClock, Receipt,
} from 'lucide-react'
import LogoMarca from './LogoMarca'

// ─── Apresentação inicial (3 telas) ──────────────────────────────────────────
// Carrossel exibido UMA VEZ antes do onboarding, no primeiro acesso. Puramente
// informativo: apresenta visualmente o Almeida Finance e o que o usuário vai
// configurar. Não toca em dados nem autenticação; os números abaixo são apenas
// ILUSTRATIVOS (nada é gravado). Ao concluir (ou pular), chama aoConcluir() e o
// fluxo segue para a configuração (Onboarding). O controle de "já viu" fica no
// componente que o renderiza (Onboarding), via localStorage por usuário.

// Mini-card visual reutilizado nas telas (ícone + rótulo + valor ilustrativo).
function MiniCard({ icone: Icone, cor, rotulo, valor }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-2.5 text-left shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cor}`}>
          <Icone size={15} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-gray-500 leading-tight truncate">{rotulo}</p>
          {valor && <p className="text-xs font-bold text-gray-800 leading-tight truncate">{valor}</p>}
        </div>
      </div>
    </div>
  )
}

// ── TELA 1: representação da Home com os módulos do app ──
function VisualHome() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
      {/* "Hero" de saldo (acompanha o tema via bg-marca-grad). */}
      <div className="bg-marca-grad rounded-xl p-3 text-left text-white mb-3">
        <p className="text-[11px] text-white/80">Saldo disponível</p>
        <p className="text-lg font-bold leading-tight">R$ 3.250,00</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniCard icone={TrendingUp}      cor="bg-green-100 text-green-600"   rotulo="Receitas"  valor="R$ 6.000" />
        <MiniCard icone={TrendingDown}    cor="bg-red-100 text-red-500"       rotulo="Despesas"  valor="R$ 2.750" />
        <MiniCard icone={CreditCard}      cor="bg-indigo-100 text-indigo-600" rotulo="Cartões"   valor="R$ 1.200" />
        <MiniCard icone={UtensilsCrossed} cor="bg-amber-100 text-amber-600"   rotulo="VR / VA"   valor="R$ 850" />
        <MiniCard icone={PiggyBank}       cor="bg-emerald-100 text-emerald-600" rotulo="Reserva" valor="R$ 5.000" />
        <MiniCard icone={Landmark}        cor="bg-marca-100 text-marca"       rotulo="Financiamentos" valor="imóvel • veículo" />
      </div>
    </div>
  )
}

// ── TELA 2: card de gasto diário em destaque ──
function VisualGastoDiario() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 space-y-3">
      {/* Card de gasto diário em destaque (segue o tema). */}
      <div className="bg-marca-grad rounded-xl p-4 text-white">
        <div className="flex items-center justify-center gap-2 mb-1">
          <CalendarClock size={16} className="text-white/90" />
          <p className="text-xs text-white/80">Você pode gastar hoje</p>
        </div>
        <p className="text-3xl font-bold leading-none">R$ 83<span className="text-lg">,00</span></p>
        <p className="text-[11px] text-white/70 mt-1">valor ilustrativo</p>
      </div>
      {/* Como o cálculo é formado. */}
      <div className="grid grid-cols-3 gap-2">
        <MiniCard icone={TrendingUp}  cor="bg-green-100 text-green-600"     rotulo="Receitas" />
        <MiniCard icone={TrendingDown} cor="bg-red-100 text-red-500"        rotulo="Despesas" />
        <MiniCard icone={PiggyBank}   cor="bg-emerald-100 text-emerald-600" rotulo="Reserva" />
      </div>
    </div>
  )
}

// ── TELA 3: módulos a configurar ──
function VisualConfigurar() {
  return (
    <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniCard icone={TrendingUp}      cor="bg-green-100 text-green-600"     rotulo="Receitas" />
        <MiniCard icone={TrendingDown}    cor="bg-red-100 text-red-500"         rotulo="Despesas" />
        <MiniCard icone={CreditCard}      cor="bg-indigo-100 text-indigo-600"   rotulo="Cartões" />
        <MiniCard icone={UtensilsCrossed} cor="bg-amber-100 text-amber-600"     rotulo="VR / VA" />
        <MiniCard icone={PiggyBank}       cor="bg-emerald-100 text-emerald-600" rotulo="Reserva" />
        <MiniCard icone={Receipt}         cor="bg-marca-100 text-marca"         rotulo="Planejamento" />
      </div>
    </div>
  )
}

const SLIDES = [
  {
    titulo: 'Bem-vindo ao Almeida Finance',
    texto: 'Seu dinheiro organizado em um só lugar.',
    visual: VisualHome,
  },
  {
    titulo: 'Saiba quanto pode gastar todos os dias',
    texto: 'Calculamos um limite diário a partir das suas receitas, despesas e reserva financeira.',
    visual: VisualGastoDiario,
  },
  {
    titulo: 'Organize suas finanças com facilidade',
    texto: 'Configure suas informações e acompanhe tudo em um só lugar.',
    visual: VisualConfigurar,
  },
]

export default function Apresentacao({ aoConcluir }) {
  const [i, setI] = useState(0)
  const ultimo = i === SLIDES.length - 1
  const Slide = SLIDES[i]
  const Visual = Slide.visual

  const avancar = () => (ultimo ? aoConcluir?.() : setI(n => Math.min(n + 1, SLIDES.length - 1)))
  const voltar = () => setI(n => Math.max(n - 1, 0))

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card text-center py-6 relative">
          {/* "Pular" SEMPRE disponível (todas as telas), discreto no topo. */}
          <button
            onClick={() => aoConcluir?.()}
            className="absolute top-3 right-4 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2"
          >
            Pular
          </button>

          {/* Logo da marca no topo (acompanha o tema). */}
          <div className="flex justify-center mb-5">
            <LogoMarca imgClassName="h-12 w-auto" padding="px-5 py-3" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-1.5 px-2">{Slide.titulo}</h1>
          <p className="text-sm text-gray-500 mb-4 px-2 leading-relaxed">{Slide.texto}</p>

          {/* Representação visual da tela */}
          <div className="mb-5">
            <Visual />
          </div>

          {/* Indicadores (bolinhas) das 3 telas */}
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            {SLIDES.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === i ? 'w-6 bg-marca' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Voltar: habilitado a partir da 2ª tela. Fica sempre no layout
                (desabilitado na 1ª) para a posição do botão não "pular". */}
            <button
              onClick={voltar}
              disabled={i === 0}
              className="btn-secondary flex items-center gap-1 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <button onClick={avancar} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {ultimo ? <>Começar agora <ArrowRight size={16} /></> : <>Próximo <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
      </div>
    </div>
  )
}
