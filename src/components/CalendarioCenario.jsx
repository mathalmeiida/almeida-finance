import React, { useMemo, useState, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'

// Recebe saldos DIÁRIOS já calculados pela projeção existente.
// Exemplo de item: { data: '2026-11-01', saldo: 1200.25 }
// Também aceita { date, saldoFinal } ou { data, saldoProjetado }.
// Não cria saldos, juros ou lançamentos fictícios.
function normalizarLinha(linha) {
  if (!linha || typeof linha !== 'object') return null
  const data = String(linha.data ?? linha.date ?? linha.dia ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  const bruto = linha.saldoFinal ?? linha.saldoProjetado ?? linha.saldo_final ?? linha.saldo ?? null
  if (bruto === null || bruto === undefined || bruto === '') return null
  const saldo = Number(bruto)
  if (!Number.isFinite(saldo)) return null
  return { data, saldo }
}

const dinheiro = valor => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
const compacto = valor => {
  const arredondado = Math.round(valor)
  // Em telas pequenas, evite cortar os números dentro das células.
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0, notation: 'compact', compactDisplay: 'short' }).format(arredondado)
}
const isoLocal = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

export default function CalendarioCenario({
  diasAtual = [],
  diasSimulado = [],
  dataInicial,
  titulo = 'Calendário da simulação',
  descricao = 'Saldo projetado ao final de cada dia',
  onSelecionarDia,
}) {
  const inicio = useMemo(() => {
    const valor = /^\d{4}-\d{2}-\d{2}$/.test(String(dataInicial || ''))
      ? String(dataInicial).slice(0, 10)
      : isoLocal(new Date().getFullYear(), new Date().getMonth(), 1)
    const [ano, mes] = valor.split('-').map(Number)
    return new Date(ano, mes - 1, 1, 12)
  }, [dataInicial])
  const [indiceMes, setIndiceMes] = useState(0)
  const [tipo, setTipo] = useState('simulado')
  const [diaSelecionado, setDiaSelecionado] = useState(null)

  const mapas = useMemo(() => {
    const converter = linhas => new Map((Array.isArray(linhas) ? linhas : [])
      .map(normalizarLinha).filter(Boolean).map(item => [item.data, item.saldo]))
    return { atual: converter(diasAtual), simulado: converter(diasSimulado) }
  }, [diasAtual, diasSimulado])

  const mes = useMemo(() => new Date(inicio.getFullYear(), inicio.getMonth() + indiceMes, 1, 12), [inicio, indiceMes])
  const ano = mes.getFullYear()
  const numeroMes = mes.getMonth()
  const diasNoMes = new Date(ano, numeroMes + 1, 0).getDate()
  const deslocamento = mes.getDay()
  const nomeMes = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const celulas = [...Array(deslocamento).fill(null), ...Array.from({length:diasNoMes},(_,i)=>i+1)]
  const mostrar = mapas[tipo]
  const ultimoDia = isoLocal(ano, numeroMes, diasNoMes)
  const ultimoSaldo = mostrar.get(ultimoDia)
  const diferencaFinal = mapas.atual.has(ultimoDia) && mapas.simulado.has(ultimoDia)
    ? mapas.simulado.get(ultimoDia) - mapas.atual.get(ultimoDia) : null

  useEffect(() => { setDiaSelecionado(null) }, [indiceMes, tipo])
  const selecionado = diaSelecionado ? isoLocal(ano, numeroMes, diaSelecionado) : null
  const valorDia = selecionado ? mostrar.get(selecionado) : undefined
  const diferencaDia = selecionado && mapas.simulado.has(selecionado) && mapas.atual.has(selecionado)
    ? mapas.simulado.get(selecionado) - mapas.atual.get(selecionado) : null

  return (
    <section className="min-w-0 w-full rounded-2xl border border-white/10 bg-[#1f2937] p-3 sm:p-5 text-white space-y-4" aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="text-marca flex-shrink-0" size={20} />
          <div><h3 className="text-base font-semibold">{titulo}</h3><p className="text-xs text-gray-400">{descricao}</p></div>
        </div>
        <div className="flex gap-1 rounded-lg bg-black/20 p-1">
          {[['atual','Atual'],['simulado','Simulado']].map(([id,label]) => (
            <button key={id} type="button" aria-pressed={tipo===id}
              onClick={()=>setTipo(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tipo===id?'bg-marca text-white':'text-gray-300 hover:bg-white/10'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={indiceMes===0} onClick={()=>setIndiceMes(v=>v-1)} aria-label="Mês anterior"
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronLeft size={19}/></button>
        <h4 className="text-sm font-semibold capitalize text-center">{nomeMes}</h4>
        <button type="button" disabled={indiceMes===11} onClick={()=>setIndiceMes(v=>v+1)} aria-label="Próximo mês"
          className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-30"><ChevronRight size={19}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-0">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className="text-center text-[10px] sm:text-xs text-gray-400">{d}</div>)}
        {celulas.map((dia,i)=> dia===null ? <div key={`vazio-${i}`} /> : (()=>{
          const chave=isoLocal(ano,numeroMes,dia)
          const valor=mostrar.get(chave)
          const disponivel=valor!==undefined
          const ativo=diaSelecionado===dia
          return <button key={chave} type="button" onClick={()=>{setDiaSelecionado(dia);onSelecionarDia?.(chave,tipo)}}
            title={disponivel?`${chave}: ${dinheiro(valor)}`:`${chave}: sem projeção`}
            aria-label={`${dia} de ${nomeMes}, ${disponivel?dinheiro(valor):'sem projeção'}`}
            className={`min-w-0 rounded-lg p-0.5 sm:p-1 border text-center ${ativo?'border-blue-400 bg-blue-400/15':'border-white/10 bg-black/10 hover:border-white/30'}`}>
            <span className="block text-[10px] sm:text-xs text-gray-200 mb-1">{dia}</span>
            <span className={`block w-full truncate rounded-full px-0.5 py-1 text-[9px] sm:text-xs font-semibold tabular-nums ${!disponivel?'bg-white/5 text-gray-500':valor<0?'bg-red-500/20 text-red-300':'bg-emerald-500/20 text-emerald-300'}`}>
              {disponivel?compacto(valor):'—'}
            </span>
          </button>
        })())}
      </div>
      <div className="flex flex-wrap gap-4 text-[11px] text-gray-300">
        <span><span className="text-emerald-400">●</span> Saldo positivo</span>
        <span><span className="text-red-400">●</span> Saldo negativo</span>
        <span>— Sem dados</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/20 px-3 py-3">
          <div className="text-xs text-gray-400">{selecionado?`Saldo em ${selecionado.split('-').reverse().join('/')}`:'Acumulado ao final do mês'}</div>
          <div className="text-lg font-bold mt-1">{(selecionado?valorDia:ultimoSaldo)===undefined?'Sem dados':dinheiro(selecionado?valorDia:ultimoSaldo)}</div>
        </div>
        <div className="rounded-xl bg-black/20 px-3 py-3">
          <div className="text-xs text-gray-400">Diferença: simulado − atual</div>
          {(() => { const diff=selecionado?diferencaDia:diferencaFinal; return <div className={`text-lg font-bold mt-1 ${diff===null?'text-gray-300':diff<0?'text-red-300':'text-emerald-300'}`}>{diff===null?'Sem dados':dinheiro(diff)}</div> })()}
        </div>
      </div>
      <p className="flex items-start gap-2 text-xs text-gray-400"><Info size={15} className="shrink-0 mt-0.5"/>Estimativa ilustrativa com distribuição uniforme do resultado mensal. Não representa os vencimentos, recebimentos ou saldo bancário real de cada dia. A simulação não altera seus dados.</p>
    </section>
  )
}