import React, { useMemo, useState, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

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
  const { corTema, usuario } = useAuth()
  const [estilo, setEstilo] = useState('claro')
  const [prefereEscuro, setPrefereEscuro] = useState(false)
  useEffect(() => {
    const chave = `almeida_calendario_estilo_${usuario?.id || 'anon'}`
    const sincronizar = () => {
      try {
        const salvo = localStorage.getItem(chave)
        setEstilo(['claro', 'escuro', 'automatico'].includes(salvo) ? salvo : 'claro')
      } catch { setEstilo('claro') }
    }
    sincronizar()
    window.addEventListener('storage', sincronizar)
    window.addEventListener('almeida-calendario-estilo', sincronizar)
    return () => {
      window.removeEventListener('storage', sincronizar)
      window.removeEventListener('almeida-calendario-estilo', sincronizar)
    }
  }, [usuario?.id])
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const atualizar = () => setPrefereEscuro(media.matches)
    atualizar()
    media.addEventListener?.('change', atualizar)
    return () => media.removeEventListener?.('change', atualizar)
  }, [])
  const escuro = estilo === 'escuro' || (estilo === 'automatico' && prefereEscuro)
  const cor = ({ azul:'#2563eb', roxo:'#7c3aed', rosa:'#be3676', verde:'#059669', laranja:'#ea7600', preto:'#374151' })[corTema] || '#7c3aed'
  const texto = escuro ? 'text-slate-100' : 'text-slate-900'
  const secundario = escuro ? 'text-slate-400' : 'text-slate-500'
  const painel = escuro ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'


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
    <section className={`min-w-0 w-full rounded-2xl border p-3 sm:p-5 space-y-4 ${escuro ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} ${texto}` } aria-label={titulo}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="flex-shrink-0" style={{color:cor}} size={20} />
          <div><h3 className="text-base font-semibold">{titulo}</h3><p className={`text-xs ${secundario}`}>Saldo projetado ao final de cada dia</p></div>
        </div>
        <div className={`flex gap-1 rounded-lg p-1 ${escuro ? 'bg-slate-800' : 'bg-slate-100'}`}>
          {[['atual','Atual'],['simulado','Simulado']].map(([id,label]) => (
            <button key={id} type="button" aria-pressed={tipo===id}
              onClick={()=>setTipo(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tipo===id?'text-white':secundario}` } style={tipo===id ? {backgroundColor:cor} : undefined}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={indiceMes===0} onClick={()=>setIndiceMes(v=>v-1)} aria-label="Mês anterior"
          className="p-2 rounded-lg hover:opacity-70 disabled:opacity-30"><ChevronLeft size={19}/></button>
        <h4 className="text-sm font-semibold capitalize text-center">{nomeMes}</h4>
        <button type="button" disabled={indiceMes===11} onClick={()=>setIndiceMes(v=>v+1)} aria-label="Próximo mês"
          className="p-2 rounded-lg hover:opacity-70 disabled:opacity-30"><ChevronRight size={19}/></button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-0">
        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div key={d} className={`text-center text-[10px] sm:text-xs ${secundario}`}>{d}</div>)}
        {celulas.map((dia,i)=> dia===null ? <div key={`vazio-${i}`} /> : (()=>{
          const chave=isoLocal(ano,numeroMes,dia)
          const valor=mostrar.get(chave)
          const disponivel=valor!==undefined
          const ativo=diaSelecionado===dia
          return <button key={chave} type="button" onClick={()=>{setDiaSelecionado(dia);onSelecionarDia?.(chave,tipo)}}
            title={disponivel?`${chave}: ${dinheiro(valor)}`:`${chave}: sem projeção`}
            aria-label={`${dia} de ${nomeMes}, ${disponivel?dinheiro(valor):'sem projeção'}`}
            className={`min-w-0 rounded-lg p-0.5 sm:p-1 border text-center ${ativo ? 'ring-2' : painel}`} style={ativo ? {borderColor:cor, backgroundColor:escuro?'#312e47':'#f3efff', outlineColor:cor, '--tw-ring-color':cor} : undefined}>
            <span className={`block text-[10px] sm:text-xs mb-1 ${texto}`}>{dia}</span>
            <span className={`block w-full truncate rounded-full px-0.5 py-1 text-[9px] sm:text-xs font-semibold tabular-nums ${!disponivel?'text-slate-400':valor<0?'bg-red-500/10 text-red-600':'bg-emerald-500/10 text-emerald-700'}`}>
              {disponivel?compacto(valor):'—'}
            </span>
          </button>
        })())}
      </div>
      <div className={`flex flex-wrap gap-4 text-[11px] ${secundario}`}>
        <span><span className="text-emerald-400">●</span> Saldo positivo</span>
        <span><span className="text-red-400">●</span> Saldo negativo</span>
        <span>— Sem dados</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className={`rounded-xl border px-3 py-3 ${painel}`}>
          <div className={`text-xs ${secundario}`}>{selecionado?`Saldo em ${selecionado.split('-').reverse().join('/')}`:'Saldo no último dia do mês'}</div>
          <div className="text-lg font-bold mt-1">{(selecionado?valorDia:ultimoSaldo)===undefined?'Sem dados':dinheiro(selecionado?valorDia:ultimoSaldo)}</div>
        </div>
        <div className={`rounded-xl border px-3 py-3 ${painel}`}>
          <div className={`text-xs ${secundario}`}>Diferença: simulado − atual</div>
          {(() => { const diff=selecionado?diferencaDia:diferencaFinal; return <div className={`text-lg font-bold mt-1 ${diff===null?secundario:diff<0?'text-red-600':'text-emerald-700'}`}>{diff===null?'Sem dados':dinheiro(diff)}</div> })()}
        </div>
      </div>
      <p className={`flex items-start gap-2 text-xs ${secundario}`}><Info size={15} className="shrink-0 mt-0.5"/>O calendário mostra somente saldos enviados pelo cálculo de projeção. Não altera lançamentos nem salva a simulação.</p>
    </section>
  )
}