import React, { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, CreditCard } from 'lucide-react'
import { exibirMoeda } from '../lib/utils'
import { useOcultarValores } from '../contexts/OcultarValoresContext'

const dataISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const lerData = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? new Date(`${v.slice(0,10)}T12:00:00`) : null
const diasNoMes = (a, m) => new Date(a, m+1, 0).getDate()
const inicioMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) }

// Exibe ocorrências previstas SEM gravá-las no Supabase. As recorrências mantêm
// a data de origem e nunca são lançadas em duplicidade no banco.
function gerarDatas(item, ano, mes) {
  const inicial = lerData(item.data || item.data_inicio || item.data_vencimento)
  if (!inicial) return []
  const inicio = new Date(ano, mes, 1, 12)
  const fim = new Date(ano, mes, diasNoMes(ano, mes), 12)
  const dataFim = lerData(item.data_fim || item.data_termino)
  const frequencia = item.frequencia || (item.recorrente ? (item.recorrencia_meses ? 'por_meses' : 'mensal') : 'nao_repete')
  if (frequencia === 'nao_repete' || frequencia === 'unica' || frequencia === 'única') {
    return inicial >= inicio && inicial <= fim ? [inicial] : []
  }
  const intervalo = frequencia === 'quinzenal' ? 15 : frequencia === 'semanal' ? 7 : null
  const intervaloMes = frequencia === 'por_meses' || frequencia === 'personalizado'
    ? Math.max(1, Number(item.recorrencia_meses || item.intervalo_meses || 1)) : 1
  const limite = Number(item.numero_ocorrencias || item.total_ocorrencias || 0)
  const datas = []
  if (intervalo) {
    for (let n = 0; n < 2000; n++) {
      const d = new Date(inicial.getFullYear(), inicial.getMonth(), inicial.getDate() + n * intervalo, 12)
      if (d > fim || (dataFim && d > dataFim) || (limite && n >= limite)) break
      if (d >= inicio) datas.push(d)
    }
  } else {
    const meses = (ano - inicial.getFullYear()) * 12 + (mes - inicial.getMonth())
    if (meses < 0 || meses % intervaloMes !== 0 || (limite && meses / intervaloMes >= limite)) return []
    const d = new Date(ano, mes, Math.min(inicial.getDate(), diasNoMes(ano, mes)), 12)
    if (!dataFim || d <= dataFim) datas.push(d)
  }
  return datas
}

export default function CalendarioFinanceiroHome({ receitas = [], despesas = [], mesVisivel, onMudarMes }) {
  const { ocultar } = useOcultarValores()
  const mesAtual = mesVisivel || inicioMes()
  const [diaSelecionado, setDiaSelecionado] = useState(() => dataISO(new Date()))
  const eventosPorData = useMemo(() => {
    const mapa = new Map()
    for (const [registros, tipo] of [[receitas, 'receita'], [despesas, 'despesa']]) {
      for (const item of registros || []) {
        for (const d of gerarDatas(item, mesAtual.getFullYear(), mesAtual.getMonth())) {
          const chave = dataISO(d)
          const lista = mapa.get(chave) || []
          lista.push({ id: `${tipo}-${item.id || item.descricao || 'item'}-${chave}`, tipo,
            nome: item.descricao || item.nome || (tipo === 'receita' ? 'Receita' : 'Despesa'),
            valor: Number(item.valor) || 0, previsto: chave !== String(item.data || '').slice(0,10),
            fixa: tipo === 'despesa' && (item.tipo_despesa === 'fixa' || item.tipo === 'fixa') })
          mapa.set(chave, lista)
        }
      }
    }
    return mapa
  }, [receitas, despesas, mesAtual.getFullYear(), mesAtual.getMonth()])
  const ano = mesAtual.getFullYear(), mes = mesAtual.getMonth()
  const dias = [...Array(new Date(ano, mes, 1).getDay()).fill(null),
    ...Array.from({length: diasNoMes(ano, mes)}, (_, i) => new Date(ano, mes, i+1, 12))]
  const selecionados = eventosPorData.get(diaSelecionado) || []
  const total = tipo => selecionados.filter(x => x.tipo === tipo).reduce((s,x) => s+x.valor, 0)
  const mudarMes = delta => {
    const d = new Date(ano, mes + delta, 1, 12)
    onMudarMes?.(d)
    setDiaSelecionado(dataISO(d))
  }
  return <section className="card !p-3 sm:!p-5 min-w-0 space-y-4">
    <header className="flex items-center gap-2">
      <CalendarDays className="text-marca shrink-0" size={21}/>
      <div><h2 className="text-base font-semibold text-gray-900">Calendário financeiro</h2>
      <p className="text-xs text-gray-500">Receitas e despesas registradas e previstas por data</p></div>
    </header>
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      <div className="xl:col-span-3 min-w-0">
        <div className="flex justify-between items-center rounded-xl bg-gray-50 px-2 py-2 mb-3">
          <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft size={18}/></button>
          <span className="capitalize text-sm font-semibold">{mesAtual.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span>
          <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight size={18}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 mb-1">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=><span key={x} className="text-[10px] sm:text-xs text-gray-500 text-center">{x}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">{dias.map((d,i) => {
          if (!d) return <div key={`vazio-${i}`} className="min-h-[43px]" />
          const chave = dataISO(d), items = eventosPorData.get(chave) || [], sel = diaSelecionado === chave
          return <button key={chave} type="button" onClick={() => setDiaSelecionado(chave)} aria-pressed={sel}
            className={`min-w-0 min-h-[43px] sm:min-h-[49px] border rounded-xl flex flex-col items-center justify-center gap-1 ${sel ? 'bg-marca text-white border-transparent' : 'border-gray-200 hover:border-marca'}`}>
              <span className="text-xs font-semibold">{d.getDate()}</span><span className="flex gap-0.5 h-1.5">
                {items.some(x=>x.tipo==='receita') && <i className={`w-1.5 h-1.5 rounded-full ${sel?'bg-white':'bg-green-500'}`}/>}
                {items.some(x=>x.tipo==='despesa') && <i className={`w-1.5 h-1.5 rounded-full ${sel?'bg-white/60':'bg-red-400'}`}/>}
              </span></button>
        })}</div>
        <p className="text-[11px] text-gray-500 mt-2">🟢 Receitas · 🔴 Despesas · Valores futuros são previsões</p>
      </div>
      <div className="xl:col-span-2 rounded-xl border border-gray-200 p-3 min-w-0">
        <h3 className="text-sm font-semibold mb-3 capitalize">{new Date(`${diaSelecionado}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'long'})}</h3>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg bg-green-500/10 px-2 py-2"><div className="flex gap-1 items-center text-xs text-gray-500"><TrendingUp size={13}/> Receitas</div><strong className="text-green-600 text-sm">{exibirMoeda(total('receita'), ocultar)}</strong></div>
          <div className="rounded-lg bg-red-500/10 px-2 py-2"><div className="flex gap-1 items-center text-xs text-gray-500"><TrendingDown size={13}/> Despesas</div><strong className="text-red-500 text-sm">{exibirMoeda(total('despesa'), ocultar)}</strong></div>
        </div>
        {selecionados.length ? <div className="space-y-2 max-h-[300px] overflow-y-auto">{selecionados.map((ev,i) => <div key={`${ev.id}-${i}`} className="rounded-lg bg-gray-50 px-2 py-2 flex justify-between gap-2 text-xs">
          <div className="min-w-0"><p className="font-medium text-gray-800 truncate">{ev.nome}</p><p className="text-gray-500">{ev.previsto?'Previsto':'Registrado'}{ev.tipo==='despesa' ? ` · ${ev.fixa?'Fixa':'Variável'}`:''}</p></div>
          <span className={`shrink-0 font-semibold ${ev.tipo==='receita'?'text-green-600':'text-red-500'}`}>{ev.tipo==='receita'?'+':'−'} {exibirMoeda(ev.valor,ocultar)}</span>
        </div>)}</div> : <p className="text-sm text-gray-500">Nenhum lançamento previsto para este dia.</p>}
      </div>
    </div>
  </section>
}