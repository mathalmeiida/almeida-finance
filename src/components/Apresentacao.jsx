import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  TrendingUp, CreditCard, UtensilsCrossed, PiggyBank, Target, BarChart2,
  ShoppingCart, Sparkles, ArrowRight, ChevronLeft, ChevronRight, CalendarDays,
  FileText, CheckCircle2, Landmark, Upload,
} from 'lucide-react'

// ─── Apresentação do Almeida Finance ──────────────────────────────────────────
// Capa (marca + frase) seguida de 5 telas de funcionalidades.
// Usada em três lugares, com o MESMO conteúdo:
//   • Login (visitante, primeiro acesso) → modo público: botões "Começar agora"
//     (cadastro) e "Já tenho uma conta" (login) sempre visíveis.
//   • Onboarding e "Rever apresentação" (autenticado) → aoConcluir.
// Navegação: deslizar (CSS Scroll Snap nativo), setas Voltar/Avançar, teclado
// (← →), indicadores clicáveis e "Pular". Sem auto-avanço.
// Respeita prefers-reduced-motion (sem rolagem suave nem animação de entrada).
//
// Props:
//   aoConcluir   — chamado em "Pular" e no "Começar agora" do último slide (modo autenticado)
//   rodapeCustom — rodapé alternativo no último slide (compatibilidade)
//   onComecar    — modo público: botão "Começar agora"
//   onEntrar     — modo público: botão "Já tenho uma conta"

// A Importação Inteligente é entregue na Parte C. Até lá a tela de
// apresentação a mostra com o selo "Em breve", sem prometer disponibilidade.
const IMPORTACAO_DISPONIVEL = true

const painel = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }
const painelForte = { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }

function MiniCard({ icone: Icone, rotulo, valor, destaque }) {
  return (
    <div className={`rounded-xl border p-2.5 text-left ${destaque ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/10'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${destaque ? 'bg-white/20' : 'bg-white/10'}`}>
          <Icone size={14} className="text-white" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-white/60 leading-tight truncate">{rotulo}</p>
          <p className="text-xs font-bold text-white leading-tight truncate">{valor}</p>
        </div>
      </div>
    </div>
  )
}

function Rotulo({ children }) {
  return <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wide">{children}</p>
}

// Tela 1 — Controle financeiro completo e visão do patrimônio
function VisualControle() {
  return (
    <div className="rounded-2xl overflow-hidden" style={painel}>
      <div className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <p className="text-[11px] text-white/60">Saldo disponível</p>
        <p className="text-2xl font-bold text-white">R$ 3.250</p>
        <div className="flex gap-3 mt-1.5">
          <span className="text-[10px] text-emerald-300 font-semibold">↑ R$ 6.000 receitas</span>
          <span className="text-[10px] text-red-300 font-semibold">↓ R$ 2.750 despesas</span>
        </div>
      </div>
      <div className="mx-3 mt-3 rounded-xl px-3 py-2.5" style={painelForte}>
        <p className="text-[11px] text-white/60">Patrimônio total</p>
        <p className="text-lg font-extrabold text-white">R$ 24.500</p>
        <p className="text-[10px] text-white/50 mt-0.5">Saldo + Investimentos + VR/VA</p>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <MiniCard icone={TrendingUp} rotulo="Investimentos" valor="R$ 18.500" />
        <MiniCard icone={CreditCard} rotulo="Cartões" valor="R$ 1.200" />
        <MiniCard icone={UtensilsCrossed} rotulo="VR / VA" valor="R$ 850" />
        <MiniCard icone={PiggyBank} rotulo="Reserva" valor="R$ 5.000" destaque />
      </div>
      <p className="text-[10px] text-white/40 text-center pb-2">Valores ilustrativos</p>
    </div>
  )
}

// Tela 2 — Quanto posso gastar hoje?
function VisualQuantoPosso() {
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-3" style={painel}>
      <div className="rounded-xl px-4 py-4 text-center" style={painelForte}>
        <p className="text-xs text-white/60 mb-2">Você pode gastar hoje</p>
        <p className="text-4xl font-extrabold text-white">R$ 87</p>
        <p className="text-[11px] text-white/50 mt-1">Considerando receitas, despesas e metas</p>
        <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-white" style={{ width: '38%' }} />
        </div>
        <p className="text-[10px] text-white/50 mt-1.5">38% do mês restante</p>
      </div>
      <div className="space-y-1.5">
        <Rotulo>Impacto no orçamento</Rotulo>
        {[
          { label: 'Cartão Nubank', valor: 'R$ 1.200', pct: 45 },
          { label: 'Aluguel em 5 dias', valor: 'R$ 1.200', pct: 35 },
          { label: 'Meta: Reserva', valor: 'R$ 500', pct: 20 },
        ].map(i => (
          <div key={i.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs text-white/80 truncate">{i.label}</span>
            <span className="text-xs font-semibold text-white flex-shrink-0 ml-2">{i.valor}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/45 text-center">Atualizado em tempo real conforme suas movimentações</p>
    </div>
  )
}

// Tela 3 — Simular compra e parcelamentos
function VisualSimularCompra() {
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-2.5" style={painel}>
      <div className="rounded-xl px-3 py-3" style={painelForte}>
        <div className="flex items-center gap-1.5 mb-2">
          <ShoppingCart size={14} className="text-white/70" />
          <p className="text-xs text-white/70">Simular compra</p>
        </div>
        <p className="text-2xl font-bold text-white">R$ 1.500</p>
        <p className="text-xs text-white/60 mt-0.5">Quanto ficaria em cada opção?</p>
      </div>
      <div className="space-y-1.5">
        {[
          { parcelas: 'À vista', valor: 'R$ 1.500', delta: 'Sobram R$ 67/dia', ok: true },
          { parcelas: '3× sem juros', valor: 'R$ 500/mês', delta: 'Sobram R$ 71/dia', ok: true },
          { parcelas: '6× sem juros', valor: 'R$ 250/mês', delta: 'Sobram R$ 79/dia', ok: true },
          { parcelas: '12× com juros', valor: 'R$ 145/mês', delta: 'Total R$ 1.740', ok: false },
        ].map(o => (
          <div key={o.parcelas} className="rounded-lg px-2.5 py-2" style={{ background: o.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{o.parcelas}</span>
              <span className={`text-xs font-bold ${o.ok ? 'text-emerald-300' : 'text-red-300'}`}>{o.valor}</span>
            </div>
            <p className={`text-[10px] mt-0.5 ${o.ok ? 'text-emerald-200/70' : 'text-red-200/70'}`}>{o.delta}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-white/45 text-center">Veja o impacto real antes de comprar</p>
    </div>
  )
}

// Tela 4 — Simulador E SE
function VisualESe() {
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-2.5" style={painel}>
      <div className="rounded-xl px-3 py-3 text-center" style={painelForte}>
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Sparkles size={14} className="text-white/70" />
          <p className="text-xs text-white/70">E se...?</p>
        </div>
        <p className="text-xl font-bold text-white">Explore cenários</p>
        <p className="text-xs text-white/60 mt-1">Veja como mudanças afetam seu orçamento</p>
      </div>
      <Rotulo>Cenários simulados</Rotulo>
      {[
        { 
          label: 'Renda extra +R$ 800', 
          icon: TrendingUp,
          delta: '+R$ 26/dia', 
          novoLimite: 'R$ 113/dia',
          cor: 'rgba(34,197,94,0.15)', 
          txt: '#86EFAC' 
        },
        { 
          label: 'Nova assinatura -R$ 50', 
          icon: CreditCard,
          delta: '-R$ 1,60/dia', 
          novoLimite: 'R$ 85/dia',
          cor: 'rgba(239,68,68,0.15)', 
          txt: '#FCA5A5' 
        },
        { 
          label: 'Aplicar R$ 500 na reserva', 
          icon: PiggyBank,
          delta: 'Meta 80%', 
          novoLimite: 'R$ 70/dia',
          cor: 'rgba(168,85,247,0.15)', 
          txt: '#E9D5FF' 
        },
      ].map(c => (
        <div key={c.label} className="rounded-lg px-2.5 py-2" style={{ background: c.cor, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/90 flex items-center gap-1.5">
              <c.icon size={11} className="text-white/50" />
              {c.label}
            </span>
            <span className="text-xs font-bold" style={{ color: c.txt }}>{c.delta}</span>
          </div>
          <p className="text-[10px] text-white/60">Novo limite: {c.novoLimite}</p>
        </div>
      ))}
      <p className="text-[10px] text-white/45 text-center">Simule antes de tomar decisões importantes</p>
    </div>
  )
}

// Tela 8 — Calendário e Projeções Financeiras
function VisualCalendarioProjecoes() {
  const dias = Array.from({ length: 14 }, (_, i) => i + 1)
  const marcados = { 3: '#22c55e', 5: '#ef4444', 8: '#eab308', 10: '#ef4444', 12: '#a855f7' }
  
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-3" style={painel}>
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="text-white/70" />
        <Rotulo>Próximos dias</Rotulo>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map(d => (
          <div key={d} className={`rounded-md py-1.5 text-center ${d === 4 ? 'bg-white/25' : 'bg-white/5'}`}>
            <span className="text-[11px] font-semibold text-white">{d}</span>
            <span className="block mx-auto mt-0.5 w-1 h-1 rounded-full" style={{ background: marcados[d] || 'transparent' }} />
          </div>
        ))}
      </div>
      <Rotulo>Próximos compromissos</Rotulo>
      {[
        { desc: 'Aluguel', dias: 3, valor: 'R$ 1.200', cor: 'rgba(239,68,68,0.8)' },
        { desc: 'Fatura Nubank', dias: 5, valor: 'R$ 850', cor: 'rgba(251,191,36,0.8)' },
        { desc: 'Recarga VR', dias: 8, valor: 'R$ 350', cor: 'rgba(34,197,94,0.8)' },
      ].map(c => (
        <div key={c.desc} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.cor }} />
            <span className="text-xs text-white/80 truncate">{c.desc}</span>
            <span className="text-[10px] text-white/50 flex-shrink-0">· em {c.dias} dias</span>
          </span>
          <span className="text-xs font-semibold text-white flex-shrink-0 ml-2">{c.valor}</span>
        </div>
      ))}
      <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs text-white/70">Projeção de saldo (30 dias)</span>
          <span className="text-xs font-bold text-emerald-300">R$ 3.840</span>
        </div>
        <p className="text-[9px] text-white/50">Baseado em receitas e despesas recorrentes</p>
      </div>
    </div>
  )
}

const TELAS = [
  { id: 'capa' },
  {
    id: 'controle',
    titulo: 'Controle financeiro completo.',
    texto: 'Acompanhe seu saldo, patrimônio total e todos os seus recursos em um só lugar.',
    Visual: VisualControle,
  },
  {
    id: 'quanto-posso',
    titulo: 'Quanto você pode gastar hoje?',
    texto: 'Descubra seu limite diário considerando suas receitas, despesas e objetivos.',
    Visual: VisualQuantoPosso,
  },
  {
    id: 'simular-compra',
    titulo: 'Simule antes de comprar.',
    texto: 'Veja o impacto de cada opção de pagamento no seu orçamento antes de decidir.',
    Visual: VisualSimularCompra,
  },
  {
    id: 'e-se',
    titulo: 'E se...? Explore cenários.',
    texto: 'Simule mudanças no seu orçamento e veja como cada decisão afeta suas finanças.',
    Visual: VisualESe,
  },
  {
    id: 'custo-vida',
    titulo: 'Entenda seu custo de vida.',
    texto: 'Visualize suas despesas essenciais e planeje mudanças com clareza.',
    Visual: VisualCustoVida,
  },
  {
    id: 'importacao',
    titulo: 'Importação inteligente.',
    texto: 'Importe extratos bancários, faturas, investimentos e VR/VA. Revise tudo antes de confirmar.',
    Visual: VisualImportacao,
  },
  {
    id: 'investimentos',
    titulo: 'Invista e conquiste suas metas.',
    texto: 'Organize seus investimentos e acompanhe o progresso dos seus objetivos financeiros.',
    Visual: VisualInvestimentosMetas,
  },
  {
    id: 'calendario',
    titulo: 'Planeje com o calendário.',
    texto: 'Visualize compromissos futuros e projeções do seu saldo para tomar decisões melhores.',
    Visual: VisualCalendarioProjecoes,
  },
]

function usePrefereMenosMovimento() {
  const [reduz, setReduz] = useState(() =>
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const ao = () => setReduz(mq.matches)
    mq.addEventListener?.('change', ao)
    return () => mq.removeEventListener?.('change', ao)
  }, [])
  return reduz
}

export default function Apresentacao({ aoConcluir, rodapeCustom = null, onComecar, onEntrar }) {
  const publico = typeof onComecar === 'function' && typeof onEntrar === 'function'
  const total = TELAS.length
  const [idx, setIdx] = useState(0)
  const trilhoRef = useRef(null)
  const reduzMovimento = usePrefereMenosMovimento()
  const ehUltimo = idx === total - 1

  // Destino da última navegação programática. Enquanto a rolagem suave não
  // chega lá, cliques/teclas seguidos partem do destino (e não da posição
  // intermediária), para não "perder" um avanço.
  const alvoRef = useRef(null)
  const posicaoBase = useCallback(() => {
    const el = trilhoRef.current
    if (!el) return 0
    const w = Math.max(1, el.clientWidth)
    const alvo = alvoRef.current
    if (alvo != null && Math.abs(el.scrollLeft - alvo * w) > 2) return alvo
    return Math.round(el.scrollLeft / w)
  }, [])

  const irPara = useCallback((i) => {
    const el = trilhoRef.current
    if (!el) return
    const alvo = Math.max(0, Math.min(total - 1, i))
    alvoRef.current = alvo
    el.scrollTo({ left: alvo * el.clientWidth, behavior: reduzMovimento ? 'auto' : 'smooth' })
  }, [total, reduzMovimento])
  const avancar = useCallback(() => irPara(posicaoBase() + 1), [irPara, posicaoBase])
  const voltar = useCallback(() => irPara(posicaoBase() - 1), [irPara, posicaoBase])

  // Índice atual derivado da posição real da rolagem (deslizar, setas e teclado).
  useEffect(() => {
    const el = trilhoRef.current
    if (!el) return
    let fim = null
    const ao = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
      setIdx(Math.max(0, Math.min(total - 1, i)))
      // Rolagem parou (deslize manual ou programática concluída): a posição
      // real passa a ser a referência para o próximo Avançar/Voltar.
      clearTimeout(fim)
      fim = setTimeout(() => { alvoRef.current = null }, 150)
    }
    el.addEventListener('scroll', ao, { passive: true })
    return () => { el.removeEventListener('scroll', ao); clearTimeout(fim) }
  }, [total])

  // Mantém a tela atual alinhada ao girar o aparelho / redimensionar.
  useEffect(() => {
    const ao = () => {
      const el = trilhoRef.current
      if (el) el.scrollTo({ left: idx * el.clientWidth, behavior: 'auto' })
    }
    window.addEventListener('resize', ao)
    return () => window.removeEventListener('resize', ao)
  }, [idx])

  useEffect(() => {
    const ao = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); avancar() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); voltar() }
    }
    window.addEventListener('keydown', ao)
    return () => window.removeEventListener('keydown', ao)
  }, [avancar, voltar])

  const pular = () => (aoConcluir ? aoConcluir() : onEntrar?.())
  const animacao = reduzMovimento ? '' : 'af-apres-entrada'

  return (
    <div
      className="min-h-[100dvh] h-[100dvh] flex flex-col overflow-hidden text-white"
      style={{ background: 'linear-gradient(160deg, #3d0a18 0%, #250610 100%)' }}
      data-testid="apresentacao"
    >
      {/* Topo: marca compacta (fora da capa) + Pular */}
      <div className="flex items-center justify-between px-5 max-w-5xl mx-auto w-full flex-shrink-0"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 14px)', minHeight: 52 }}>
        <div className={`transition-opacity duration-300 ${idx === 0 ? 'opacity-0' : 'opacity-100'}`} aria-hidden={idx === 0}>
          <img src="/branding/af-icone.png" alt="" className="h-9 w-auto object-contain" />
        </div>
        {!ehUltimo && (
          <button type="button" onClick={pular}
            className="text-xs text-white/60 hover:text-white transition-colors py-2 px-1" data-testid="apresentacao-pular">
            Pular
          </button>
        )}
      </div>

      {/* Telas deslizantes */}
      <div
        ref={trilhoRef}
        className="flex-1 min-h-0 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide overscroll-x-contain"
        style={{ scrollbarWidth: 'none', touchAction: 'manipulation' }}
        aria-roledescription="carrossel"
        aria-label="Apresentação do Almeida Finance"
        data-testid="apresentacao-trilho"
      >
        {TELAS.map((t, i) => (
          <section
            key={t.id}
            className="w-full flex-shrink-0 snap-center snap-always overflow-y-auto"
            aria-roledescription="slide"
            aria-label={`${i + 1} de ${total}`}
            data-tela={t.id}
          >
            {t.id === 'capa' ? (
              <div className={`h-full flex flex-col items-center justify-center text-center px-6 max-w-md mx-auto ${i === idx ? animacao : ''}`}>
                <img src="/branding/af-icone.png" alt="Almeida Finance" className="w-[132px] h-auto object-contain" />
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-4">Almeida Finance</h1>
                <p className="text-base sm:text-lg font-semibold text-white/90 mt-2">Seu dinheiro. Seu controle. Seu futuro.</p>
                <p className="text-sm text-white/65 mt-3 leading-relaxed">
                  Organize suas finanças, acompanhe seu patrimônio e planeje suas próximas conquistas em um só lugar.
                </p>
                <button type="button" onClick={() => irPara(1)}
                  className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-white/70 hover:text-white">
                  Conheça o app <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <div className={`min-h-full flex flex-col justify-center px-5 py-3 max-w-md lg:max-w-5xl mx-auto lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center ${i === idx ? animacao : ''}`}>
                <div>
                  {t.emBreve && (
                    <span className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2"
                      style={{ background: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}>
                      Em breve
                    </span>
                  )}
                  <h2 className="text-2xl lg:text-4xl font-bold leading-tight">{t.titulo}</h2>
                  <p className="text-sm lg:text-base text-white/65 mt-2 mb-4 leading-relaxed">{t.texto}</p>
                </div>
                <div className="w-full max-w-sm mx-auto lg:max-w-md">
                  <t.Visual />
                </div>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Rodapé: navegação + ações */}
      <div className="px-5 max-w-md mx-auto w-full flex-shrink-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 18px)' }}>
        <div className="flex items-center justify-between gap-3 py-3">
          <button type="button" onClick={voltar} disabled={idx === 0}
            aria-label="Tela anterior"
            className="w-10 h-10 rounded-full flex items-center justify-center border border-white/15 text-white/85 disabled:opacity-0 transition-opacity"
            data-testid="apresentacao-voltar">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Progresso da apresentação">
            {TELAS.map((t, i) => (
              <button key={t.id} type="button" role="tab" aria-selected={i === idx}
                aria-label={`Ir para a tela ${i + 1} de ${total}`}
                onClick={() => irPara(i)}
                className="py-2"
                data-testid="apresentacao-indicador">
                <span className="block rounded-full transition-all duration-300"
                  style={{ width: i === idx ? 20 : 6, height: 6, background: i === idx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)' }} />
              </button>
            ))}
          </div>
          <button type="button" onClick={avancar} disabled={ehUltimo}
            aria-label="Próxima tela"
            className="w-10 h-10 rounded-full flex items-center justify-center border border-white/15 text-white/85 disabled:opacity-0 transition-opacity"
            data-testid="apresentacao-avancar">
            <ChevronRight size={18} />
          </button>
        </div>

        {publico ? (
          <div className="flex flex-col gap-2">
            <button type="button" onClick={onComecar}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.96)', color: '#3d0a18' }}
              data-testid="apresentacao-comecar">
              Começar agora <ArrowRight size={16} />
            </button>
            <button type="button" onClick={onEntrar}
              className="w-full rounded-xl py-3 text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.9)', border: '1px solid rgba(255,255,255,0.16)' }}
              data-testid="apresentacao-entrar">
              Já tenho uma conta
            </button>
          </div>
        ) : ehUltimo ? (
          rodapeCustom || (
            <button type="button" onClick={() => aoConcluir?.()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
              style={{ background: 'rgba(255,255,255,0.96)', color: '#3d0a18' }}>
              Começar agora <ArrowRight size={16} />
            </button>
          )
        ) : (
          <button type="button" onClick={avancar}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.92)', border: '1px solid rgba(255,255,255,0.16)' }}>
            Próximo <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
