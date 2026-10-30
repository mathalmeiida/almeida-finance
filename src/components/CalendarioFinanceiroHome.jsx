import React, { useMemo, useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  CalendarDays, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Plus, MoreVertical, Pencil, Trash2, X,
  Wallet, CreditCard, ReceiptText, CalendarClock,
} from 'lucide-react'
import { exibirMoeda, partesHojeBrasil } from '../lib/utils'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
// Almeida Finance — Calendário financeiro (visual Dashboard Financeiro).
// Apenas EXIBE os lançamentos e saldos de src/lib/horizonteFinanceiro.js.// Não altera cálculos, recorrências, lançamentos, banco ou orçamento.
const chaveData = (ano, mes, dia) =>
  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
const inicioMes = () => {
  const hoje = partesHojeBrasil()
  return new Date(hoje.ano, hoje.mes - 1, 1, 12)
}
// Apenas formata o número exibido nos quadrinhos pequenos do calendário.
// O saldo real e todos os cálculos permanecem inalterados.
function valorCompacto(valor, ocultar) {
  if (ocultar) return '••••'
  if (!Number.isFinite(Number(valor))) return '—'
  const n = Number(valor)
  const absoluto = Math.abs(n)
  if (absoluto >= 1000000) {
    return `${(n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  }
  if (absoluto >= 1000) {
    return `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  }
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
}
export default function CalendarioFinanceiroHome({
// Mantidos por compatibilidade com chamadas antigas. Fonte única: horizonte.
  receitas = [], despesas = [], mesVisivel, onMudarMes, horizonte = [],
  onAdicionarMovimentacao, onEditarMovimentacao, onExcluirMovimentacao,
}) {
  const { ocultar } = useOcultarValores()
  const { corTema, usuario } = useAuth()
  const [preferenciaCalendario, setPreferenciaCalendario] = useState('claro')
  const [dispositivoEscuro, setDispositivoEscuro] = useState(false)
  useEffect(() => {
    const chave = `almeida_calendario_estilo_${usuario?.id || 'anon'}`
    const carregar = () => {
      try {
        const valor = localStorage.getItem(chave)
        setPreferenciaCalendario(['claro', 'escuro', 'automatico'].includes(valor) ? valor : 'claro')
      } catch { setPreferenciaCalendario('claro') }
    }
    carregar()
    const aoAlterar = () => carregar()
    window.addEventListener('almeida-calendario-estilo', aoAlterar)
    window.addEventListener('storage', aoAlterar)
    return () => {
      window.removeEventListener('almeida-calendario-estilo', aoAlterar)
      window.removeEventListener('storage', aoAlterar)
    }
  }, [usuario?.id])
  useEffect(() => {
    if (!window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const atualizar = () => setDispositivoEscuro(media.matches)
    atualizar()
    media.addEventListener?.('change', atualizar)
    return () => media.removeEventListener?.('change', atualizar)
  }, [])
  const calendarioEscuro = preferenciaCalendario === 'escuro' ||
    (preferenciaCalendario === 'automatico' && dispositivoEscuro)
  const coresDestaque = {
    azul: '#2563eb', rosa: '#be3676', verde: '#059669',
    roxo: '#7c3aed', laranja: '#ea7600', preto: '#374151',
  }
  const corDestaque = coresDestaque[corTema] || coresDestaque.azul
  const mesAtual = mesVisivel || inicioMes()
  const ano = mesAtual.getFullYear()
  const mes = mesAtual.getMonth() + 1
  const hoje = partesHojeBrasil()
  const chaveHoje = chaveData(hoje.ano, hoje.mes, hoje.dia)
  const [diaSelecionado, setDiaSelecionado] = useState(chaveHoje)
  const [menuAdicionar, setMenuAdicionar] = useState(false)
  const [menuEvento, setMenuEvento] = useState(null)
  const periodo = useMemo(() => (Array.isArray(horizonte) ? horizonte : [])
    .find(p => p.ano === ano && p.mes === mes), [horizonte, ano, mes])
  const diasPorNumero = useMemo(() => new Map((periodo?.dias || []).map(d => [Number(d.dia), d])), [periodo])
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const dias = [
    ...Array(new Date(ano, mes - 1, 1).getDay()).fill(null),
    ...Array.from({ length: ultimoDia }, (_, i) => i + 1),
  ]
  const diaDaSelecao = Number(diaSelecionado.slice(8, 10))
  const selecionadoNoMes = diaSelecionado.slice(0, 7) === chaveData(ano, mes, 1).slice(0, 7)
  const registro = selecionadoNoMes ? diasPorNumero.get(diaDaSelecao) : null
  const eventos = Array.isArray(registro?.eventos) ? registro.eventos : []
  const entradas = Number(registro?.entradas) || 0
  const saidas = Number(registro?.saidas) || 0
  const passado = diaSelecionado < chaveHoje
  const temSaldo = registro && Number.isFinite(Number(registro.saldo)) && !passado
  const saldoSelecionado = temSaldo ? Number(registro.saldo) : null
  function mudarMes(delta) {
    const novo = new Date(ano, mes - 1 + delta, 1, 12)
    onMudarMes?.(novo)
    setDiaSelecionado(chaveData(novo.getFullYear(), novo.getMonth() + 1, 1))
    setMenuAdicionar(false)
    setMenuEvento(null)
  }
  function descricaoEvento(evento) {
    if (evento.categoria === 'cartao') return 'Fatura do cartão'
    if (evento.categoria === 'parcela') return 'Parcelamento'
    if (evento.categoria === 'fixa') return 'Despesa fixa'
    if (evento.categoria === 'variavel') return 'Despesa variável'
    return evento.tipo === 'entrada' ? 'Receita' : 'Despesa'
  }
  const dataSelecionadaTexto = new Date(`${diaSelecionado}T12:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const nomeMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return (
    <section
      className={`af-calendar-fit af-calendar-theme min-w-0 overflow-hidden rounded-2xl border p-3 shadow-sm sm:p-5 ${calendarioEscuro ? 'af-calendar-dark' : 'af-calendar-light'}`}
      style={{ '--af-calendar-accent': corDestaque }}>
      <style>{`
        .af-calendar-theme { background: #fff; color: #172033; border-color: #e2e8f0; transition: background .2s, color .2s; }
        .af-calendar-theme.af-calendar-dark { background: #151b2a; color: #f8fafc; border-color: #3c465c; }
        .af-calendar-theme .af-calendar-heading { color: inherit !important; }
        .af-calendar-theme .af-calendar-muted { color: #64748b !important; }
        .af-calendar-theme.af-calendar-dark .af-calendar-muted { color: #b5c0d2 !important; }
        .af-calendar-theme .af-month-bar { background: #f8fafc !important; border-color: #e2e8f0 !important; color: #172033 !important; }
        .af-calendar-theme.af-calendar-dark .af-month-bar { background: #222b3e !important; border-color: #526078 !important; color: #f8fafc !important; }
        .af-calendar-theme .af-month-bar button, .af-calendar-theme .af-month-bar span { color: inherit !important; }
        .af-calendar-theme .af-day-cell { background: #f5f7fb !important; border-color: #e2e8f0 !important; color: #172033 !important; }
        .af-calendar-theme.af-calendar-dark .af-day-cell { background: #293348 !important; border-color: #3d4b63 !important; color: #f8fafc !important; }
        .af-calendar-theme .af-day-cell:hover { border-color: var(--af-calendar-accent) !important; }
        .af-calendar-theme .af-day-cell[aria-pressed="true"] { background: var(--af-calendar-accent) !important; color: white !important; border-color: var(--af-calendar-accent) !important; --tw-ring-color: var(--af-calendar-accent) !important; }
        .af-calendar-theme .af-day-cell > span:first-child { color: inherit !important; }
        .af-calendar-theme .af-day-details { background: #f8fafc !important; border-color: #e2e8f0 !important; color: #172033 !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details { background: #202b3d !important; border-color: #46536a !important; color: #f8fafc !important; }
        .af-calendar-theme .af-calendar-heading, .af-calendar-theme .af-day-details h3, .af-calendar-theme .af-day-details h4 { color: inherit !important; }
        .af-calendar-theme .af-day-details .text-slate-100, .af-calendar-theme .af-day-details .text-slate-200 { color: #243043 !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details .text-slate-100, .af-calendar-theme.af-calendar-dark .af-day-details .text-slate-200 { color: #f1f5f9 !important; }
        .af-calendar-theme .af-day-details .text-slate-300, .af-calendar-theme .af-day-details .text-slate-400 { color: #64748b !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details .text-slate-300, .af-calendar-theme.af-calendar-dark .af-day-details .text-slate-400 { color: #b5c0d2 !important; }
        .af-calendar-theme .af-day-details [class*="bg-slate-800"] { background-color: #eff3f9 !important; border-color: #dce3ed !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details [class*="bg-slate-800"] { background-color: #2c374c !important; border-color: #4c5970 !important; }
        .af-calendar-theme .af-day-details .border-slate-700 { border-color: #d6deea !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details .border-slate-700 { border-color: #4c5970 !important; }
        .af-calendar-theme .af-day-details .text-emerald-300 { color: #047857 !important; }
        .af-calendar-theme .af-day-details .text-rose-300 { color: #be123c !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details .text-emerald-300 { color: #6ee7b7 !important; }
        .af-calendar-theme.af-calendar-dark .af-day-details .text-rose-300 { color: #fda4af !important; }
        .af-calendar-theme .af-day-details button.border-marca, .af-calendar-theme .af-day-details .text-marca { color: var(--af-calendar-accent) !important; border-color: var(--af-calendar-accent) !important; }
        .af-calendar-theme .af-day-details .bg-marca-100 { background: color-mix(in srgb, var(--af-calendar-accent) 10%, transparent) !important; }

        /* Compacto no celular, sem esconder dias, valores ou movimentos. */
        @media (max-width: 639px) {
          .af-calendar-theme { padding: 10px !important; border-radius: 14px; }
          .af-calendar-theme > header { margin-bottom: 10px; gap: 8px; }
          .af-calendar-theme > header .h-10.w-10 { width: 34px; height: 34px; }
          .af-calendar-theme .af-month-bar { margin-bottom: 6px; padding-top: 3px; padding-bottom: 3px; }
          .af-calendar-theme .af-day-cell { min-height: 34px !important; padding: 2px 1px !important; gap: 1px; }
          .af-calendar-theme .af-day-cell > span:first-child { font-size: 11px; }
          .af-calendar-theme .af-day-cell > span:nth-child(2) { font-size: 9px; }
          .af-calendar-theme .af-calendar-empty { min-height: 34px !important; }
          .af-calendar-theme .af-calendar-footnote { margin-top: 7px; font-size: 10px; }
          .af-calendar-theme .af-day-details { padding: 10px; }
        }
        .af-calendar-theme .af-balance-summary {
          padding: 10px 12px !important;
          border-color: color-mix(in srgb, var(--af-calendar-accent) 22%, #e2e8f0) !important;
          background: color-mix(in srgb, var(--af-calendar-accent) 5%, #ffffff) !important;
        }
        .af-calendar-theme.af-calendar-dark .af-balance-summary {
          background: color-mix(in srgb, var(--af-calendar-accent) 12%, #202b3d) !important;
          border-color: #4c5970 !important;
        }
        .af-calendar-theme .af-balance-summary strong { font-size: 1.125rem !important; line-height: 1.5rem; }
        @media (min-width: 640px) { .af-calendar-theme .af-balance-summary strong { font-size: 1.25rem !important; } }
        .af-calendar-theme .af-calendar-footnote { color: #64748b !important; }
        .af-calendar-theme.af-calendar-dark .af-calendar-footnote { color: #b5c0d2 !important; }
        .af-calendar-theme .text-emerald-300 { color: #047857 !important; }
        .af-calendar-theme .text-rose-300 { color: #be123c !important; }
        .af-calendar-theme.af-calendar-dark .text-emerald-300 { color: #6ee7b7 !important; }
        .af-calendar-theme.af-calendar-dark .text-rose-300 { color: #fda4af !important; }
      `}</style>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca">
            <CalendarDays size={21} />
          </div>
          <div className="min-w-0">
            <h2 className="af-calendar-heading text-base font-semibold">Calendário financeiro</h2>
            <p className="af-calendar-muted text-xs">Seu fluxo de caixa, dia a dia</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Entradas
          <span className="ml-1 h-2 w-2 rounded-full bg-rose-400" /> Saídas
          <span className="ml-1 h-2 w-2 rounded-full bg-sky-400" /> Faturas
        </div>
      </header>
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <div className="af-month-bar mb-3 flex items-center justify-between rounded-xl border border-marca bg-slate-900 px-2 py-2 text-marca"
              style={{ backgroundColor: 'color-mix(in srgb, currentColor 12%, #111827)' }}>
            <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca">
              <ChevronLeft size={18} />
            </button>
            <span className="text-center text-sm font-semibold capitalize text-slate-100">{nomeMes}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)}
              className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(x => (
              <span key={x} className="py-1 text-center text-[10px] font-medium text-slate-400 sm:text-xs">{x}</span>
            ))}
          </div>
          <div className="grid min-w-0 grid-cols-7 gap-1 sm:gap-1.5">
            {dias.map((dia, i) => {
              if (dia == null) return <div key={`vazio-${i}`} className="af-calendar-empty min-h-[38px] sm:min-h-[76px]" />
              const chave = chaveData(ano, mes, dia)
              const registroDia = diasPorNumero.get(dia)
              const saldoValido = chave >= chaveHoje && Number.isFinite(Number(registroDia?.saldo)) && !!registroDia
              const saldo = saldoValido ? Number(registroDia.saldo) : null
              const eventosDia = Array.isArray(registroDia?.eventos) ? registroDia.eventos : []
              const possuiEntrada = eventosDia.some(ev => ev.tipo === 'entrada')
              // Fatura de cartão ganha marcador próprio (sky); as demais saídas
              // (fixas/variáveis/parcelas) seguem como "saída" (rose).
              const possuiFatura = eventosDia.some(ev => ev.categoria === 'cartao')
              const possuiSaida = eventosDia.some(ev => ev.tipo === 'saida' && ev.categoria !== 'cartao')
              const selecionado = diaSelecionado === chave
              const atual = chave === chaveHoje
              return (
                <button key={chave} type="button" aria-pressed={selecionado}
                  aria-label={`${dia} de ${nomeMes}${saldo == null ? ', sem saldo projetado' : ', saldo projetado disponível'}`}
                  onClick={() => { setDiaSelecionado(chave); setMenuAdicionar(false); setMenuEvento(null) }}
                    style={!selecionado ? { backgroundColor: 'color-mix(in srgb, currentColor 13%, #1e293b)' } : undefined}
                  title={saldo != null && !ocultar ? `Saldo projetado: ${exibirMoeda(saldo, false)}` : undefined}
                  className={`af-day-cell flex min-h-[38px] min-w-0 flex-col items-center justify-center gap-0 rounded-lg border px-0.5 py-0.5 transition sm:min-h-[76px] sm:gap-1 sm:rounded-xl sm:px-1 sm:py-1.5
                    ${selecionado ? 'border-marca bg-marca-100 ring-2 ring-marca' : 'border-slate-700 text-marca hover:border-marca'}
                    ${atual ? 'ring-1 ring-marca' : ''}`}
                >
                  <span className={`text-xs font-semibold ${atual ? 'text-marca' : 'text-slate-200'}`}>{dia}</span>
                  <span className={`block w-full truncate text-center text-[9px] font-semibold leading-tight tabular-nums sm:text-[11px]
                    ${saldo == null ? 'text-slate-500' : saldo < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                    {saldo == null ? '—' : valorCompacto(saldo, ocultar)}
                  </span>
                  <span className="flex h-1.5 items-center justify-center gap-1">
                    {possuiEntrada && <i aria-label="Receita" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                    {possuiSaida && <i aria-label="Despesa" className="h-1.5 w-1.5 rounded-full bg-rose-400" />}
                    {possuiFatura && <i aria-label="Fatura de cartão" className="h-1.5 w-1.5 rounded-full bg-sky-400" />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="af-calendar-footnote mt-3 text-[11px] leading-relaxed text-slate-400">
            Números: saldo projetado abreviado · Verde: receitas · Vermelho: despesas (fixas e variáveis) · Azul: faturas de cartão · Traço: sem projeção ou data passada.
          </p>
        </div>
        <aside className="af-day-details min-w-0 rounded-xl border border-marca bg-slate-900/80 p-3 text-marca sm:p-4 xl:col-span-2"
          style={{ backgroundColor: 'color-mix(in srgb, currentColor 13%, #111827)' }} aria-label="Detalhes do dia selecionado">
          <div className="mb-3 flex items-center gap-2 text-marca">
            <CalendarClock size={17} />
            <h3 className="text-sm font-semibold capitalize text-slate-100">{dataSelecionadaTexto}</h3>
          </div>
          <div className={`af-balance-summary mb-3 rounded-xl border p-3 ${saldoSelecionado == null
            ? 'border-slate-700 bg-slate-800'
            : saldoSelecionado < 0
              ? 'border-rose-500/30 bg-rose-500/10'
              : 'border-marca bg-marca-100'}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
              <Wallet size={15} /> Saldo projetado ao fim do dia
            </div>
            <strong className={`block break-words text-xl font-bold tabular-nums sm:text-2xl ${saldoSelecionado == null
              ? 'text-slate-300' : saldoSelecionado < 0 ? 'text-rose-300' : 'text-marca'}`}>
              {saldoSelecionado == null
                ? (passado ? 'Data passada: sem projeção histórica' : 'Sem projeção disponível')
                : exibirMoeda(saldoSelecionado, ocultar)}
            </strong>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-300"><TrendingUp size={14} className="text-emerald-300" /> Receitas</div>
              <strong className="block break-words text-sm font-semibold tabular-nums text-emerald-300">{exibirMoeda(entradas, ocultar)}</strong>
            </div>
            <div className="min-w-0 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-slate-300"><TrendingDown size={14} className="text-rose-300" /> Saídas</div>
              <strong className="block break-words text-sm font-semibold tabular-nums text-rose-300">{exibirMoeda(saidas, ocultar)}</strong>
            </div>
          </div>
            {/* Ações usam os formulários da Home; o calendário não cria lançamentos paralelos. */}
            <div className="mb-3 space-y-2">
              {typeof onAdicionarMovimentacao === 'function' && (
                <>
                  <button type="button" onClick={() => setMenuAdicionar(v => !v)}
                    aria-expanded={menuAdicionar}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-marca bg-marca-100 px-3 py-2.5 text-sm font-semibold text-marca transition hover:brightness-110">
                    {menuAdicionar ? <X size={16} /> : <Plus size={16} />}
                    {menuAdicionar ? 'Fechar opções' : 'Adicionar movimentação'}
                  </button>
                  {menuAdicionar && (
                    <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-700 bg-slate-800/70 p-2 sm:grid-cols-3">
                      {[['receita', 'Receita'], ['despesa', 'Despesa'], ['cartao', 'Cartão']].map(([tipo, rotulo]) => (
                        <button key={tipo} type="button" onClick={() => { onAdicionarMovimentacao({ tipo, data: diaSelecionado }); setMenuAdicionar(false) }}
                          className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-marca">
                          {rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
<div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold text-slate-200">Movimentações do dia</h4>
            <span className="text-[11px] text-slate-400">{eventos.length} {eventos.length === 1 ? 'lançamento' : 'lançamentos'}</span>
          </div>
          {eventos.length ? (
            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-0.5">
              {eventos.map((ev, i) => {
                // Cor/ícone por categoria para leitura rápida (só visual):
                //  cartão=sky, receita=verde, despesa fixa/variável/parcela=rose.
                const ehEntrada = ev.tipo === 'entrada'
                const ehCartao = ev.categoria === 'cartao'
                const estilo = ehCartao
                  ? 'bg-sky-400/10 text-sky-300'
                  : ehEntrada
                    ? 'bg-emerald-400/10 text-emerald-300'
                    : 'bg-rose-400/10 text-rose-300'
                const IconeEv = ehCartao ? CreditCard
                  : ehEntrada ? TrendingUp
                  : ev.categoria === 'fixa' ? CalendarClock
                  : ev.categoria === 'parcela' ? CreditCard
                  : ReceiptText
                return (
                <div key={`${ev.tipo}-${ev.categoria}-${i}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-800/70 p-2.5 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${estilo}`}>
                      <IconeEv size={15} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-100" title={ev.descricao}>{ev.descricao || (ev.tipo === 'entrada' ? 'Receita' : 'Despesa')}</p>
                      <p className="text-[11px] text-slate-400">{descricaoEvento(ev)}</p>
                    </div>
                  </div>
                  <span className={`max-w-[48%] shrink-0 break-words text-right font-semibold tabular-nums ${ev.tipo === 'entrada' ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {ev.tipo === 'entrada' ? '+' : '−'} {exibirMoeda(ev.valor, ocultar)}
                  </span>
                  {(typeof onEditarMovimentacao === 'function' || typeof onExcluirMovimentacao === 'function') && ev.id != null && (
                    <div className="relative shrink-0">
                      <button type="button" aria-label="Opções da movimentação" aria-expanded={menuEvento === `${diaSelecionado}-${i}`}
                        onClick={() => setMenuEvento(v => v === `${diaSelecionado}-${i}` ? null : `${diaSelecionado}-${i}`)}
                        className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-700">
                        <MoreVertical size={17} />
                      </button>
                      {menuEvento === `${diaSelecionado}-${i}` && (
                        <div className="absolute right-0 top-full z-20 min-w-[130px] rounded-lg border border-slate-600 bg-slate-900 p-1 shadow-xl">
                          {typeof onEditarMovimentacao === 'function' && (
                            <button type="button" onClick={() => { onEditarMovimentacao(ev); setMenuEvento(null) }}
                              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-slate-100 hover:bg-slate-700">
                              <Pencil size={13} /> Editar
                            </button>
                          )}
                          {typeof onExcluirMovimentacao === 'function' && (
                            <button type="button" onClick={() => { setMenuEvento(null); onExcluirMovimentacao(ev) }}
                              className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-rose-300 hover:bg-slate-700">
                              <Trash2 size={13} /> Excluir
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-700 bg-slate-800/40 px-3 py-4 text-center text-xs text-slate-400">
              Nenhuma movimentação futura calculada para este dia.
            </p>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Despesas, parcelas e faturas aparecem uma vez na data prevista. Dias passados não são descontados novamente do saldo atual.
          </p>
        </aside>
      </div>
    </section>
  )
}
