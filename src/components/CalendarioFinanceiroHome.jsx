import React, { useMemo, useState } from 'react'

import {

  CalendarDays, ChevronLeft, ChevronRight, TrendingUp, TrendingDown,

  Wallet, CreditCard, ReceiptText, CalendarClock,

} from 'lucide-react'

import { exibirMoeda, partesHojeBrasil } from '../lib/utils'

import { useOcultarValores } from '../contexts/OcultarValoresContext'



// Almeida Finance — Calendário financeiro (visual Dashboard Financeiro).*

// Apenas EXIBE os lançamentos e saldos de src/lib/horizonteFinanceiro.js.*

// Não altera cálculos, recorrências, lançamentos, banco ou orçamento.*

const chaveData = (ano, mes, dia) =>

  `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`



const inicioMes = () => {

  const hoje = partesHojeBrasil()

  return new Date(hoje.ano, hoje.mes - 1, 1, 12)

}



// Apenas formata o número exibido nos quadrinhos pequenos do calendário.*

// O saldo real e todos os cálculos permanecem inalterados.*

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

  // Mantidos por compatibilidade com chamadas antigas. Fonte única: horizonte.*

  receitas = [], despesas = [], mesVisivel, onMudarMes, horizonte = [],

}) {

  const { ocultar } = useOcultarValores()

  const mesAtual = mesVisivel || inicioMes()

  const ano = mesAtual.getFullYear()

  const mes = mesAtual.getMonth() + 1

  const hoje = partesHojeBrasil()

  const chaveHoje = chaveData(hoje.ano, hoje.mes, hoje.dia)

  const [diaSelecionado, setDiaSelecionado] = useState(chaveHoje)



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

    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950 p-3 text-slate-100 shadow-lg sm:p-5">

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca">

            <CalendarDays size={21} />

          </div>

          <div className="min-w-0">

            <h2 className="text-base font-semibold text-slate-50">Calendário financeiro</h2>

            <p className="text-xs text-slate-400">Seu fluxo de caixa, dia a dia</p>

          </div>

        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">

          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Entradas

          <span className="ml-1 h-2 w-2 rounded-full bg-rose-400" /> Saídas

        </div>

      </header>



      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-5">

        <div className="min-w-0 xl:col-span-3">

          <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-700/70 bg-slate-900 px-2 py-2">

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

              if (dia == null) return <div key={`vazio-${i}`} className="min-h-[58px] sm:min-h-[76px]" />

              const chave = chaveData(ano, mes, dia)

              const registroDia = diasPorNumero.get(dia)

              const saldoValido = chave >= chaveHoje && Number.isFinite(Number(registroDia?.saldo)) && !!registroDia

              const saldo = saldoValido ? Number(registroDia.saldo) : null

              const eventosDia = Array.isArray(registroDia?.eventos) ? registroDia.eventos : []

              const possuiEntrada = eventosDia.some(ev => ev.tipo === 'entrada')

              const possuiSaida = eventosDia.some(ev => ev.tipo === 'saida')

              const selecionado = diaSelecionado === chave

              const atual = chave === chaveHoje



              return (

                <button key={chave} type="button" aria-pressed={selecionado}

                  aria-label={`${dia} de ${nomeMes}${saldo == null ? ', sem saldo projetado' : ', saldo projetado disponível'}`}

                  onClick={() => setDiaSelecionado(chave)}

                  title={saldo != null && !ocultar ? `Saldo projetado: ${exibirMoeda(saldo, false)}` : undefined}

                  className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-lg border px-0.5 py-1.5 transition sm:min-h-[76px] sm:rounded-xl sm:px-1

                    ${selecionado ? 'border-marca bg-marca-100 ring-2 ring-marca' : 'border-slate-700 bg-slate-800/80 hover:border-marca hover:bg-slate-700'}

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

                  </span>

                </button>

              )

            })}

          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">

            Números: saldo projetado abreviado · Pontos verdes: receitas · Pontos vermelhos: despesas e faturas · Traço: sem projeção ou data passada.

          </p>

        </div>



        <aside className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:p-4 xl:col-span-2" aria-label="Detalhes do dia selecionado">

          <div className="mb-3 flex items-center gap-2 text-marca">

            <CalendarClock size={17} />

            <h3 className="text-sm font-semibold capitalize text-slate-100">{dataSelecionadaTexto}</h3>

          </div>



          <div className={`mb-3 rounded-xl border p-3 ${saldoSelecionado == null

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



          <div className="mb-2 flex items-center justify-between gap-2">

            <h4 className="text-xs font-semibold text-slate-200">Movimentações do dia</h4>

            <span className="text-[11px] text-slate-400">{eventos.length} {eventos.length === 1 ? 'lançamento' : 'lançamentos'}</span>

          </div>

          {eventos.length ? (

            <div className="max-h-[340px] space-y-2 overflow-y-auto pr-0.5">

              {eventos.map((ev, i) => (

                <div key={`${ev.tipo}-${ev.categoria}-${i}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-800/70 p-2.5 text-xs">

                  <div className="flex min-w-0 items-center gap-2">

                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ev.categoria === 'cartao'

                      ? 'bg-sky-400/10 text-sky-300'

                      : ev.tipo === 'entrada'

                        ? 'bg-emerald-400/10 text-emerald-300'

                        : 'bg-rose-400/10 text-rose-300'}`}>

                      {ev.categoria === 'cartao' ? <CreditCard size={15} /> : <ReceiptText size={15} />}

                    </span>

                    <div className="min-w-0">

                      <p className="truncate font-medium text-slate-100" title={ev.descricao}>{ev.descricao || (ev.tipo === 'entrada' ? 'Receita' : 'Despesa')}</p>

                      <p className="text-[11px] text-slate-400">{descricaoEvento(ev)}</p>

                    </div>

                  </div>

                  <span className={`max-w-[48%] shrink-0 break-words text-right font-semibold tabular-nums ${ev.tipo === 'entrada' ? 'text-emerald-300' : 'text-rose-300'}`}>

                    {ev.tipo === 'entrada' ? '+' : '−'} {exibirMoeda(ev.valor, ocultar)}

                  </span>

                </div>

              ))}

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