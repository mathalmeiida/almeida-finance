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

// Tela 1 — prévia da Home
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
        <p className="text-[11px] text-white/60">Você pode gastar hoje</p>
        <p className="text-lg font-extrabold text-white">R$ 87</p>
        <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-white/70" style={{ width: '38%' }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        <MiniCard icone={CreditCard} rotulo="Cartões" valor="R$ 1.200" />
        <MiniCard icone={UtensilsCrossed} rotulo="VR / VA" valor="R$ 850" />
      </div>
      <p className="text-[10px] text-white/40 text-center pb-2">Valores ilustrativos</p>
    </div>
  )
}

// Tela 2 — calendário e metas
function VisualCalendarioMetas() {
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
      <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <span className="text-xs text-white/80">Aluguel · em 3 dias</span>
        <span className="text-xs font-semibold text-white">R$ 1.200</span>
      </div>
      {[
        { label: 'Reserva de emergência', pct: 64, cor: 'rgba(34,197,94,0.8)' },
        { label: 'Viagem', pct: 38, cor: 'rgba(255,255,255,0.8)' },
      ].map(m => (
        <div key={m.label} className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white/80 flex items-center gap-1"><Target size={11} className="text-white/40" />{m.label}</span>
            <span className="text-xs font-bold text-white">{m.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
            <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.cor }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Tela 3 — investimentos
function VisualInvestimentos() {
  const carteira = [
    { label: 'Renda fixa', pct: 55, cor: 'rgba(255,255,255,0.85)' },
    { label: 'FIIs', pct: 25, cor: 'rgba(251,191,36,0.85)' },
    { label: 'Ações', pct: 20, cor: 'rgba(34,197,94,0.85)' },
  ]
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-3" style={painel}>
      <div className="rounded-xl px-3 py-2.5" style={painelForte}>
        <p className="text-[11px] text-white/60 flex items-center gap-1.5"><TrendingUp size={12} />Patrimônio investido</p>
        <p className="text-2xl font-bold text-white">R$ 18.500</p>
        <p className="text-[10px] text-emerald-300 font-semibold mt-0.5">+ R$ 142 em rendimentos no mês</p>
      </div>
      <div>
        <div className="flex h-2 rounded-full overflow-hidden">
          {carteira.map(c => <div key={c.label} style={{ width: `${c.pct}%`, background: c.cor }} />)}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {carteira.map(c => (
            <span key={c.label} className="flex items-center gap-1 text-[10px] text-white/70">
              <span className="w-2 h-2 rounded-full" style={{ background: c.cor }} />{c.label} {c.pct}%
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniCard icone={Landmark} rotulo="Tesouro Selic" valor="R$ 6.200" />
        <MiniCard icone={PiggyBank} rotulo="Reserva" valor="R$ 5.000" destaque />
      </div>
    </div>
  )
}

// Tela 4 — importação inteligente (prévia da conferência)
function VisualImportacao() {
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-2.5" style={painel}>
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={painelForte}>
        <span className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0"><FileText size={15} className="text-white" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">extrato-outubro.ofx</p>
          <p className="text-[10px] text-white/55">Extrato bancário</p>
        </div>
        <Upload size={14} className="text-white/50" />
      </div>
      <Rotulo>Conferência antes de salvar</Rotulo>
      {[
        { d: 'Supermercado', c: 'Alimentação', v: '- R$ 182,40' },
        { d: 'Salário', c: 'Receita', v: '+ R$ 4.800,00', pos: true },
        { d: 'Netflix', c: 'Assinaturas', v: '- R$ 39,90' },
      ].map(l => (
        <div key={l.d} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 size={12} className="text-emerald-300 flex-shrink-0" />
            <span className="text-xs text-white/85 truncate">{l.d}</span>
            <span className="text-[10px] text-white/45 truncate">· {l.c}</span>
          </span>
          <span className={`text-xs font-semibold flex-shrink-0 ${l.pos ? 'text-emerald-300' : 'text-white'}`}>{l.v}</span>
        </div>
      ))}
      <p className="text-[10px] text-white/45">Você revisa tudo. Nada é gravado sem sua confirmação.</p>
    </div>
  )
}

// Tela 5 — Simular compra e E se...?
function VisualSimular() {
  return (
    <div className="rounded-2xl overflow-hidden p-3 space-y-2" style={painel}>
      <div className="rounded-xl px-3 py-2.5" style={painelForte}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <ShoppingCart size={13} className="text-white/70" />
          <p className="text-[11px] text-white/70">Simular compra</p>
        </div>
        <p className="text-xl font-bold text-white">R$ 1.500 <span className="text-xs font-normal text-white/50">6× R$ 250</span></p>
        <div className="flex flex-wrap gap-2 mt-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}>-R$ 250/mês</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)' }}>Novo limite R$ 74/dia</span>
        </div>
      </div>
      <p className="text-[10px] text-white/50 px-0.5">Cenários "E se...?"</p>
      {[
        { label: 'Renda extra +R$ 800', delta: '+R$ 26/dia', cor: 'rgba(34,197,94,0.25)', txt: '#86EFAC' },
        { label: 'Nova despesa -R$ 300', delta: '-R$ 10/dia', cor: 'rgba(239,68,68,0.25)', txt: '#FCA5A5' },
      ].map(c => (
        <div key={c.label} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <span className="text-xs text-white/80 flex items-center gap-1"><Sparkles size={10} className="text-white/40" />{c.label}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: c.cor, color: c.txt }}>{c.delta}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-1">
        <BarChart2 size={12} className="text-white/50" />
        <span className="text-[10px] text-white/50">Veja o impacto antes de decidir</span>
      </div>
    </div>
  )
}

const TELAS = [
  { id: 'capa' },
  {
    id: 'controle',
    titulo: 'Tudo sob controle.',
    texto: 'Acompanhe suas receitas, despesas, saldos e descubra quanto pode gastar.',
    Visual: VisualControle,
  },
  {
    id: 'planejar',
    titulo: 'Planeje cada conquista.',
    texto: 'Visualize seus próximos compromissos e organize seus objetivos financeiros.',
    Visual: VisualCalendarioMetas,
  },
  {
    id: 'investimentos',
    titulo: 'Seu patrimônio em evolução.',
    texto: 'Organize seus investimentos, acompanhe sua carteira e registre seus rendimentos.',
    Visual: VisualInvestimentos,
  },
  {
    id: 'importacao',
    titulo: 'Menos trabalho. Mais controle.',
    texto: 'Importe extratos bancários, faturas de cartões e investimentos para facilitar sua organização financeira.',
    Visual: VisualImportacao,
    emBreve: !IMPORTACAO_DISPONIVEL,
  },
  {
    id: 'simular',
    titulo: 'Decisões melhores começam com planejamento.',
    texto: 'Simule compras, explore cenários e entenda o impacto das suas escolhas.',
    Visual: VisualSimular,
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
