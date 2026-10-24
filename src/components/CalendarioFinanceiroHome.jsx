import React, { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { exibirMoeda, partesHojeBrasil } from '../lib/utils'
import { useOcultarValores } from '../contexts/OcultarValoresContext'

// Este componente so EXIBE os lancamentos e saldos ja calculados pelo
// src/lib/horizonteFinanceiro.js. Nao calcula recorrencias nem consulta o banco.
const chaveData = (ano, mes, dia) => `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
const inicioMes = () => {
  const hoje = partesHojeBrasil()
  return new Date(hoje.ano, hoje.mes - 1, 1, 12)
}

export default function CalendarioFinanceiroHome({
  // Mantidos por compatibilidade com chamadas antigas. A fonte para exibir
  // lancamentos e saldo e exclusivamente `horizonte`.
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
    if (evento.categoria === 'cartao') return 'Fatura do cartao'
    if (evento.categoria === 'parcela') return 'Parcelamento'
    if (evento.categoria === 'fixa') return 'Despesa fixa'
    if (evento.categoria === 'variavel') return 'Despesa variavel'
    return evento.tipo === 'entrada' ? 'Receita' : 'Despesa'
  }

  return (
    <section className="card !p-3 sm:!p-5 min-w-0 space-y-4">
      <header className="flex items-center gap-2">
        <CalendarDays className="text-marca shrink-0" size={21} />
        <div>
          <h2 className="text-base font-semibold text-gray-900">Calendário financeiro</h2>
          <p className="text-xs text-gray-500">Receitas, despesas, parcelas e faturas projetadas por data</p>
        </div>
      </header>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <div className="xl:col-span-3 min-w-0">
          <div className="flex justify-between items-center rounded-xl bg-gray-50 px-2 py-2 mb-3">
            <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18} /></button>
            <span className="capitalize text-sm font-semibold">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(x => <span key={x} className="text-[10px] sm:text-xs text-gray-500 text-center">{x}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia, i) => {
              if (dia == null) return <div key={`vazio-${i}`} className="min-h-[56px]" />
              const chave = chaveData(ano, mes, dia)
              const registroDia = diasPorNumero.get(dia)
              const saldoValido = chave >= chaveHoje && Number.isFinite(Number(registroDia?.saldo)) && !!registroDia
              const saldo = saldoValido ? Number(registroDia.saldo) : null
              const eventosDia = Array.isArray(registroDia?.eventos) ? registroDia.eventos : []
              const classe = saldo == null ? 'border-gray-200 bg-white text-gray-800'
                : saldo < 0 ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
              return (
                <button key={chave} type="button" aria-pressed={diaSelecionado === chave}
                  onClick={() => setDiaSelecionado(chave)}
                  title={saldo != null && !ocultar ? `Saldo projetado: ${exibirMoeda(saldo, false)}` : undefined}
                  className={`min-w-0 min-h-[56px] sm:min-h-[62px] border rounded-xl flex flex-col items-center justify-center gap-0.5 px-0.5 ${classe} ${diaSelecionado === chave ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:border-marca'}`}>
                  <span className="text-xs font-semibold">{dia}</span>
                  <span className="text-[9px] sm:text-[10px] font-semibold leading-tight max-w-full truncate tabular-nums">
                    {saldo == null ? '—' : exibirMoeda(saldo, ocultar)}
                  </span>
                  <span className="flex gap-0.5 h-1.5">
                    {eventosDia.some(ev => ev.tipo === 'entrada') && <i className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                    {eventosDia.some(ev => ev.tipo === 'saida') && <i className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">Verde: saldo positivo · Vermelho: saldo negativo · Traço: sem projeção ou data passada</p>
        </div>
        <div className="xl:col-span-2 rounded-xl border border-gray-200 p-3 min-w-0">
          <h3 className="text-sm font-semibold mb-3 capitalize">
            {new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })}
          </h3>
          <div className={`rounded-lg p-3 mb-3 ${saldoSelecionado == null ? 'bg-gray-50' : saldoSelecionado < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-xs text-gray-500">Saldo projetado ao fim do dia</p>
            <strong className={`text-lg ${saldoSelecionado == null ? 'text-gray-500' : saldoSelecionado < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {saldoSelecionado == null ? (passado ? 'Data passada: sem projeção histórica' : 'Sem projeção disponível') : exibirMoeda(saldoSelecionado, ocultar)}
            </strong>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="rounded-lg bg-green-500/10 px-2 py-2">
              <div className="flex gap-1 items-center text-xs text-gray-500"><TrendingUp size={13} /> Receitas</div>
              <strong className="text-green-600 text-sm">{exibirMoeda(entradas, ocultar)}</strong>
            </div>
            <div className="rounded-lg bg-red-500/10 px-2 py-2">
              <div className="flex gap-1 items-center text-xs text-gray-500"><TrendingDown size={13} /> Despesas e faturas</div>
              <strong className="text-red-500 text-sm">{exibirMoeda(saidas, ocultar)}</strong>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mb-2">Valores do fluxo de caixa: despesas, parcelas e faturas aparecem uma vez, na data prevista. Os dias passados não são descontados novamente do saldo atual.</p>
          {eventos.length ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {eventos.map((ev, i) => (
                <div key={`${ev.tipo}-${ev.categoria}-${i}`} className="rounded-lg bg-gray-50 px-2 py-2 flex justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{ev.descricao || (ev.tipo === 'entrada' ? 'Receita' : 'Despesa')}</p>
                    <p className="text-gray-500">{descricaoEvento(ev)}</p>
                  </div>
                  <span className={`shrink-0 font-semibold ${ev.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                    {ev.tipo === 'entrada' ? '+' : '−'} {exibirMoeda(ev.valor, ocultar)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Nenhuma movimentação futura calculada para este dia.</p>
          )}
        </div>
      </div>
    </section>
  )
}