import React, { useEffect, useMemo, useState } from 'react'

import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wallet, Pencil, Eye, EyeOff, TrendingUp, TrendingDown, Loader2, List, Info } from 'lucide-react'

import { useProjecao } from '../hooks/useProjecao'

import { useReceitas } from '../hooks/useReceitas'

import { useDespesas } from '../hooks/useDespesas'

import { gerarHorizonte } from '../lib/horizonteFinanceiro'

import { useAuth } from '../contexts/AuthContext'

import { useOcultarValores } from '../contexts/OcultarValoresContext'

import { formatCurrency, exibirMoeda, hojeISO } from '../lib/utils'

import HorizonteFinanceiro from '../components/HorizonteFinanceiro'

import Modal from '../components/Modal'

import InputMoeda from '../components/InputMoeda'

const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dinheiro = (n, ocultar) => exibirMoeda(Number(n) || 0, ocultar)

const numero = n => Number(n) || 0

const mesPorExtenso = d => d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

function Resumo({ titulo, valor, Icone, cor = 'text-gray-900', ocultar }) {

  return <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4 min-w-0 shadow-sm">

    <div className="flex items-center gap-2 mb-2"><Icone size={17} className="text-marca"/><span className="text-xs sm:text-sm text-gray-500">{titulo}</span></div>

    <p className={`text-base sm:text-xl font-bold break-words ${cor}`}>{dinheiro(valor, ocultar)}</p>

  </div>

}

export default function Projecao() {

  const {

    projecao = [], carregando, resumoMes = {}, receitas = [], despesas = [], recorrentes = [],

    parcelamentos = [], cartoes = [], comprasCartao = [], faturasInformadas = [], reservaPct,

  } = useProjecao()

  const { perfil, atualizarPreferenciasLimite, somenteLeitura } = useAuth()

  const { ocultar, alternar } = useOcultarValores()

  // Mesmas fontes e mesmo motor usados no calendário da Home.

  const { receitas: receitasCalendario, carregando: carregandoReceitasCalendario } = useReceitas()

  const { despesas: despesasCalendario, carregando: carregandoDespesasCalendario } = useDespesas()

  const [mesVisivel, setMesVisivel] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))

  const [diaSelecionado, setDiaSelecionado] = useState(() => isoLocal(new Date()))

  const [mesExpandido, setMesExpandido] = useState(-1)

  const [verTodosMeses, setVerTodosMeses] = useState(false)

  const [verFluxo, setVerFluxo] = useState(false)

  const [modalSaldo, setModalSaldo] = useState(false)

  const [valorSaldo, setValorSaldo] = useState(0)

  const [salvandoSaldo, setSalvandoSaldo] = useState(false)

  const [erroSaldo, setErroSaldo] = useState('')

  useEffect(() => {

    if (modalSaldo) { setValorSaldo(numero(perfil?.saldo_base)); setErroSaldo('') }

  }, [modalSaldo, perfil?.saldo_base])

  async function salvarSaldo(e) {

    e.preventDefault()

    if (somenteLeitura || !Number.isFinite(Number(valorSaldo)) || Number(valorSaldo) < 0) return

    setSalvandoSaldo(true); setErroSaldo('')

    try {

      await atualizarPreferenciasLimite({ saldo_base: Number(valorSaldo), saldo_base_data: hojeISO() })

      setModalSaldo(false)

    } catch (err) { setErroSaldo(err?.message || 'Não foi possível salvar o saldo.') }

    finally { setSalvandoSaldo(false) }

  }

  const saldoConfigurado = Boolean(resumoMes.saldoConfigurado)

  const saldoAgora = numero(resumoMes.saldoDisponivelAgora)

  // Projeção diária idêntica à da Home; não soma lançamentos novamente.

  const horizonteCalendario = useMemo(() => {

    if (carregando || carregandoReceitasCalendario || carregandoDespesasCalendario || !saldoConfigurado) return []

    return gerarHorizonte({

      receitas: receitasCalendario, despesas: despesasCalendario, recorrentes, parcelamentos,

      cartoes, comprasCartao, faturasInformadas,

      saldoInicial: saldoAgora, reservaPct, meses: 12,

    })

  }, [carregando, carregandoReceitasCalendario, carregandoDespesasCalendario,

    saldoConfigurado, saldoAgora, receitasCalendario, despesasCalendario,

    recorrentes, parcelamentos, cartoes, comprasCartao, faturasInformadas, reservaPct])

  const diasProjetados = useMemo(() => {

    const periodo = horizonteCalendario.find(p => p.ano === mesVisivel.getFullYear() && p.mes === mesVisivel.getMonth() + 1)

    return new Map((periodo?.dias || []).map(d => [Number(d.dia), d]))

  }, [horizonteCalendario, mesVisivel])

  const dataHoje = hojeISO()

  const selecionadoProjetado = diaSelecionado >= dataHoje ? diasProjetados.get(Number(diaSelecionado.slice(-2))) : null

  const saldoDiaProjetado = selecionadoProjetado && Number.isFinite(Number(selecionadoProjetado.saldo)) ? Number(selecionadoProjetado.saldo) : null

  function saldoCompacto(n) {

    if (ocultar) return '••••'

    const valor = Number(n)

    if (!Number.isFinite(valor)) return '—'

    if (Math.abs(valor) >= 1000000) return `${(valor / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`

    if (Math.abs(valor) >= 1000) return `${(valor / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`

    return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })

  }

  // O calendário lista SOMENTE registros originais datados. Recorrências, compras em

  // fatura e saldo projetado do dia permanecem no HorizonteFinanceiro original.

  // Isso evita somar projeções de maneira diferente do motor financeiro do aplicativo.

  const eventosPorData = useMemo(() => {

    const mapa = new Map()

    for (const [registros, tipo] of [[receitas, 'receita'], [despesas, 'despesa']]) {

      for (const item of registros || []) {

        const dia = typeof item?.data === 'string' ? item.data.slice(0, 10) : ''

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue

        const lista = mapa.get(dia) || []

        lista.push({ id: `${tipo}-${item.id || lista.length}`, tipo, nome: item.descricao || item.nome || (tipo === 'receita' ? 'Receita' : 'Despesa'), valor: numero(item.valor) })

        mapa.set(dia, lista)

      }

    }

    return mapa

  }, [receitas, despesas])

  const diasCalendario = useMemo(() => {

    const ano = mesVisivel.getFullYear(), mes = mesVisivel.getMonth()

    const inicioSemana = new Date(ano, mes, 1).getDay()

    const total = new Date(ano, mes + 1, 0).getDate()

    return [...Array(inicioSemana).fill(null), ...Array.from({ length: total }, (_, i) => new Date(ano, mes, i + 1))]

  }, [mesVisivel])

  const eventosSelecionados = eventosPorData.get(diaSelecionado) || []

  const totalReceitasDia = eventosSelecionados.filter(x => x.tipo === 'receita').reduce((s, x) => s + x.valor, 0)

  const totalDespesasDia = eventosSelecionados.filter(x => x.tipo === 'despesa').reduce((s, x) => s + x.valor, 0)

  function alterarMes(delta) {

    const novo = new Date(mesVisivel.getFullYear(), mesVisivel.getMonth() + delta, 1)

    setMesVisivel(novo)

    setDiaSelecionado(isoLocal(novo))

  }

  return <div className="w-full min-w-0 max-w-none space-y-5">

    <div className="flex flex-wrap justify-between items-start gap-3">

      <div><h1 className="text-2xl font-bold text-gray-900">Planejamento</h1><p className="text-sm text-gray-500 mt-1">Organize hoje, planeje o amanhã.</p></div>

      <div className="flex items-center gap-2">

        <button type="button" onClick={alternar} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'} className="btn-secondary p-2">{ocultar ? <EyeOff size={17}/> : <Eye size={17}/>}</button>

        {!somenteLeitura && <button type="button" onClick={() => setModalSaldo(true)} className="btn-secondary flex items-center gap-1.5 text-xs"><Pencil size={14}/> Atualizar saldo</button>}

      </div>

    </div>

    {carregando ? <div className="card flex items-center justify-center py-14"><Loader2 className="animate-spin text-marca"/></div> : <>

      {!saldoConfigurado && <div className="rounded-xl p-3 border border-amber-200 bg-amber-50 text-amber-800 text-sm">Informe seu saldo atual para obter previsões de fluxo de caixa com uma base confiável.</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">

        <Resumo titulo="Saldo atual" valor={saldoAgora} Icone={Wallet} ocultar={ocultar}/>

        <Resumo titulo="Receitas do mês" valor={resumoMes.receitaTotal} Icone={TrendingUp} cor="text-green-700" ocultar={ocultar}/>

        <Resumo titulo="Despesas do mês" valor={resumoMes.despesaTotal} Icone={TrendingDown} cor="text-red-600" ocultar={ocultar}/>

        <Resumo titulo="Sobra prevista" valor={resumoMes.sobraPrevista} Icone={Wallet} cor={numero(resumoMes.sobraPrevista) < 0 ? 'text-red-600' : 'text-marca'} ocultar={ocultar}/>

      </div>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-marca p-3 sm:p-5 text-marca shadow-lg" style={{ backgroundColor: 'color-mix(in srgb, currentColor 17%, #020617)' }}>

        <div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-marca-100"><CalendarDays className="text-marca" size={21}/></span><div><h2 className="text-base font-semibold text-white">Calendário financeiro</h2><p className="text-xs text-slate-400">Saldo projetado e movimentações de cada dia.</p></div></div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          <div className="min-w-0 lg:col-span-3">

            <div className="flex justify-between items-center mb-3 rounded-xl border border-marca px-2 py-2 text-white" style={{ backgroundColor: 'color-mix(in srgb, currentColor 12%, #111827)' }}>

              <button type="button" aria-label="Mês anterior" onClick={() => alterarMes(-1)} className="p-2 rounded-lg text-slate-200 hover:bg-white/10"><ChevronLeft size={18}/></button>

              <span className="capitalize font-semibold text-sm">{mesPorExtenso(mesVisivel)}</span>

              <button type="button" aria-label="Próximo mês" onClick={() => alterarMes(1)} className="p-2 rounded-lg text-slate-200 hover:bg-white/10"><ChevronRight size={18}/></button>

            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <span key={d} className="text-[11px] text-slate-400 text-center">{d}</span>)}</div>

            <div className="grid grid-cols-7 gap-1">{diasCalendario.map((dia, i) => {

              if (!dia) return <div key={`vazio-${i}`} className="min-h-[46px]"/>

              const chave = isoLocal(dia), items = eventosPorData.get(chave) || [], selecionado = diaSelecionado === chave

              const registroDia = chave >= dataHoje ? diasProjetados.get(dia.getDate()) : null

              const saldoProjetado = registroDia && Number.isFinite(Number(registroDia.saldo)) ? Number(registroDia.saldo) : null

              const eventosDia = Array.isArray(registroDia?.eventos) ? registroDia.eventos : []

              return <button type="button" key={chave} onClick={() => setDiaSelecionado(chave)} aria-pressed={selecionado}

                className={`min-w-0 min-h-[55px] sm:min-h-[66px] border rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${selecionado ? 'bg-marca-100 border-marca text-white ring-2 ring-marca' : 'border-slate-700 text-slate-100 hover:border-marca'}`}

                  style={!selecionado ? { backgroundColor: 'color-mix(in srgb, currentColor 13%, #1e293b)' } : undefined}>

                <span className="text-xs sm:text-sm font-semibold">{dia.getDate()}</span>

                <span className={`w-full truncate px-0.5 text-center text-[9px] sm:text-[11px] font-semibold tabular-nums ${saldoProjetado == null ? 'text-slate-400' : saldoProjetado < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>

                  {saldoProjetado == null ? '—' : saldoCompacto(saldoProjetado)}

                </span>

                <span className="flex gap-1 h-1.5">{eventosDia.some(x => x.tipo === 'entrada') && <i className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>} {eventosDia.some(x => x.tipo === 'saida') && <i className="w-1.5 h-1.5 rounded-full bg-rose-400"/>}</span>

              </button>

            })}</div>

            <p className="mt-2 text-[11px] text-slate-400">Valores: saldo projetado do fim do dia (abreviado). Verde: entradas. Vermelho: saídas. Datas passadas: sem projeção histórica.</p>

          </div>

          <div className="min-w-0 rounded-2xl border border-marca p-3 sm:p-4 lg:col-span-2 text-slate-100" style={{ backgroundColor: 'color-mix(in srgb, currentColor 13%, #111827)' }}>

            <h3 className="font-semibold text-sm text-inherit mb-3">{new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>

            <div className="mb-3 rounded-xl border border-marca bg-marca-100/20 p-3">

              <p className="text-xs text-slate-300">Saldo projetado ao fim do dia</p>

              <p className={`text-xl font-bold tabular-nums ${saldoDiaProjetado == null ? 'text-slate-300' : saldoDiaProjetado < 0 ? 'text-rose-300' : 'text-marca'}`}>{saldoDiaProjetado == null ? 'Sem projeção disponível' : exibirMoeda(saldoDiaProjetado, ocultar)}</p>

            </div>

            <div className="grid grid-cols-2 gap-2 mb-3"><div className="bg-white/5 border border-white/10 rounded-xl p-2"><p className="text-xs opacity-75">Receitas registradas</p><p className="text-sm font-semibold text-green-400">{dinheiro(totalReceitasDia, ocultar)}</p></div><div className="bg-white/5 border border-white/10 rounded-xl p-2"><p className="text-xs opacity-75">Despesas registradas</p><p className="text-sm font-semibold text-red-400">{dinheiro(totalDespesasDia, ocultar)}</p></div></div>

            {eventosSelecionados.length ? <div className="space-y-2 max-h-64 overflow-y-auto">{eventosSelecionados.map(ev => <div key={ev.id} className="flex justify-between items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2 text-xs"><span className="truncate text-slate-100">{ev.nome}</span><span className={`font-semibold shrink-0 ${ev.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>{ev.tipo === 'receita' ? '+' : '−'} {dinheiro(ev.valor, ocultar)}</span></div>)}</div> : <p className="text-sm opacity-70">Nenhum lançamento original com essa data.</p>}

            <p className="mt-3 text-xs opacity-70">Os números do calendário incluem as projeções de receitas, despesas, parcelas e faturas. A lista acima mostra somente os lançamentos originais; consulte o fluxo completo para ver todos os eventos.</p>

            <button type="button" onClick={() => setVerFluxo(v => !v)} className="w-full mt-3 flex items-center justify-center gap-2 rounded-xl border border-marca bg-marca-100 px-3 py-2.5 text-sm font-semibold text-marca hover:opacity-85"><List size={15}/>{verFluxo ? 'Ocultar fluxo de caixa' : 'Ver fluxo de caixa completo'}</button>

          </div>

        </div>

      </section>

      {verFluxo && projecao.length > 0 && <section className="card"><h2 className="font-semibold text-gray-900 mb-3">Fluxo de caixa detalhado</h2><HorizonteFinanceiro receitas={receitas} despesas={despesas} recorrentes={recorrentes} parcelamentos={parcelamentos} cartoes={cartoes} comprasCartao={comprasCartao} faturasInformadas={faturasInformadas} reservaPct={reservaPct} saldoInicial={saldoConfigurado ? saldoAgora : 0}/></section>}

      <section className="card space-y-3"><div className="flex items-center gap-2"><List size={19} className="text-marca"/><div><h2 className="font-semibold text-gray-900">Projeção dos próximos 12 meses</h2><p className="text-xs text-gray-500">Valores do motor financeiro atual, sem novos cálculos.</p></div></div>

        {projecao.length === 0 ? <p className="text-sm text-gray-500">Cadastre receitas e despesas para gerar sua projeção.</p> : <>

          {(verTodosMeses ? projecao : projecao.slice(0, 3)).map((m, i) => <div key={`${m.mes}-${i}`} className="rounded-xl border border-gray-200 overflow-hidden"><button type="button" onClick={() => setMesExpandido(mesExpandido === i ? -1 : i)} className="w-full flex items-center gap-3 justify-between p-3 text-left hover:bg-gray-50"><span className="capitalize font-semibold text-sm text-gray-800 min-w-0 truncate">{m.mes}{m.ehMesAtual ? ' · atual' : ''}</span><span className={`text-sm font-bold ml-auto ${numero(m.saldo) < 0 ? 'text-red-600' : 'text-green-700'}`}>{dinheiro(m.saldo, ocultar)}</span>{mesExpandido === i ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>{mesExpandido === i && <div className="border-t border-gray-100 p-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-gray-600">Receitas</span><strong className="text-green-700">{dinheiro(m.receitas, ocultar)}</strong></div><div className="flex justify-between"><span className="text-gray-600">Despesas e compromissos</span><strong className="text-red-600">{dinheiro(m.despesas, ocultar)}</strong></div><div className="flex justify-between border-t pt-2"><span className="font-medium">Sobra projetada</span><strong>{dinheiro(m.saldo, ocultar)}</strong></div></div>}</div>)}

          {projecao.length > 3 && <button type="button" onClick={() => setVerTodosMeses(v => !v)} className="btn-secondary w-full">{verTodosMeses ? 'Mostrar menos meses' : `Ver todos os ${projecao.length} meses`}</button>}

        </>}

      </section>

      <p className="text-xs text-gray-500 flex items-start gap-2"><Info size={15} className="shrink-0"/>O saldo disponível agora, a sobra mensal e o saldo diário projetado são indicadores diferentes. A reserva permanece separada conforme as regras já existentes.</p>

    </>}

    <Modal aberto={modalSaldo} onFechar={() => setModalSaldo(false)} titulo="Saldo atual"><form onSubmit={salvarSaldo} className="space-y-4"><div><label className="label">Quanto você tem disponível hoje?</label><InputMoeda valor={valorSaldo} onChangeValor={setValorSaldo} className="input text-2xl font-bold text-center py-3" prefixo={null} autoFocus/><p className="text-xs text-gray-500 mt-1">Não inclua sua reserva de emergência.</p></div>{erroSaldo && <p role="alert" className="text-sm text-red-600">{erroSaldo}</p>}<div className="flex gap-2"><button type="button" onClick={() => setModalSaldo(false)} className="btn-secondary flex-1">Cancelar</button><button type="submit" disabled={salvandoSaldo || somenteLeitura} className="btn-primary flex-1">{salvandoSaldo ? 'Salvando...' : 'Salvar saldo'}</button></div></form></Modal>

  </div>

}