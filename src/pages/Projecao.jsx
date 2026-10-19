import React, { useEffect, useMemo, useState } from 'react'

import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Wallet, Pencil, Eye, EyeOff, TrendingUp, TrendingDown, Loader2, List, Info } from 'lucide-react'

import { useProjecao } from '../hooks/useProjecao'

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



  return <div className="space-y-5 max-w-6xl">

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



      <section className="card space-y-4">

        <div className="flex items-center gap-2"><CalendarDays className="text-marca" size={21}/><div><h2 className="text-base font-semibold text-gray-900">Calendário financeiro</h2><p className="text-xs text-gray-500">Consulte lançamentos originais por data.</p></div></div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          <div className="min-w-0">

            <div className="flex justify-between items-center mb-3 rounded-xl bg-gray-50 px-2 py-2">

              <button type="button" aria-label="Mês anterior" onClick={() => alterarMes(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18}/></button>

              <span className="capitalize font-semibold text-sm">{mesPorExtenso(mesVisivel)}</span>

              <button type="button" aria-label="Próximo mês" onClick={() => alterarMes(1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18}/></button>

            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <span key={d} className="text-[11px] text-gray-500 text-center">{d}</span>)}</div>

            <div className="grid grid-cols-7 gap-1">{diasCalendario.map((dia, i) => {

              if (!dia) return <div key={`vazio-${i}`} className="min-h-[46px]"/>

              const chave = isoLocal(dia), items = eventosPorData.get(chave) || [], selecionado = diaSelecionado === chave

              return <button type="button" key={chave} onClick={() => setDiaSelecionado(chave)} aria-pressed={selecionado}

                className={`min-w-0 min-h-[46px] sm:min-h-[54px] border rounded-xl flex flex-col items-center justify-center gap-1 transition-colors ${selecionado ? 'bg-marca text-white border-transparent' : 'bg-white border-gray-100 text-gray-700 hover:border-gray-300'}`}>

                <span className="text-xs sm:text-sm font-semibold">{dia.getDate()}</span>

                <span className="flex gap-0.5 h-1.5">{items.some(x => x.tipo === 'receita') && <i className={`w-1.5 h-1.5 rounded-full ${selecionado ? 'bg-white' : 'bg-green-500'}`}/>} {items.some(x => x.tipo === 'despesa') && <i className={`w-1.5 h-1.5 rounded-full ${selecionado ? 'bg-white/60' : 'bg-red-400'}`}/>}</span>

              </button>

            })}</div>

            <p className="mt-2 text-[11px] text-gray-500">Pontos verdes: receitas cadastradas. Vermelhos: despesas cadastradas.</p>

          </div>

          <div className="rounded-2xl border border-slate-500/15 bg-transparent p-3 sm:p-4 min-w-0">

            <h3 className="font-semibold text-sm text-inherit mb-3">{new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>

            <div className="grid grid-cols-2 gap-2 mb-3"><div className="bg-transparent border border-slate-500/15 rounded-xl p-2"><p className="text-xs opacity-75">Receitas registradas</p><p className="text-sm font-semibold text-green-400">{dinheiro(totalReceitasDia, ocultar)}</p></div><div className="bg-transparent border border-slate-500/15 rounded-xl p-2"><p className="text-xs opacity-75">Despesas registradas</p><p className="text-sm font-semibold text-red-400">{dinheiro(totalDespesasDia, ocultar)}</p></div></div>

            {eventosSelecionados.length ? <div className="space-y-2 max-h-64 overflow-y-auto">{eventosSelecionados.map(ev => <div key={ev.id} className="flex justify-between items-center gap-2 bg-transparent border border-slate-500/15 rounded-xl p-2 text-xs"><span className="truncate text-inherit">{ev.nome}</span><span className={`font-semibold shrink-0 ${ev.tipo === 'receita' ? 'text-green-400' : 'text-red-400'}`}>{ev.tipo === 'receita' ? '+' : '−'} {dinheiro(ev.valor, ocultar)}</span></div>)}</div> : <p className="text-sm opacity-70">Nenhum lançamento original com essa data.</p>}

            <p className="mt-3 text-xs opacity-70">Recorrências, parcelas, faturas e saldo diário projetado estão no fluxo de caixa detalhado abaixo.</p>

            <button type="button" onClick={() => setVerFluxo(v => !v)} className="btn-secondary w-full mt-3 flex items-center justify-center gap-2"><List size={15}/>{verFluxo ? 'Ocultar fluxo de caixa' : 'Ver fluxo de caixa completo'}</button>

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