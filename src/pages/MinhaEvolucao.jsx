import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, PiggyBank, Target, CalendarDays, ChevronDown, ChevronUp, Info, Eye, EyeOff } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import { exibirMoeda } from '../lib/utils'

const n = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0

function CartaoResumo({ titulo, valor, Icone, ocultar, classe = '' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-[#202838] p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-300"><Icone size={17} className="text-marca" />{titulo}</div>
      <div className={`break-words text-xl sm:text-2xl font-bold ${classe}`}>{exibirMoeda(n(valor), ocultar)}</div>
    </div>
  )
}

export default function MinhaEvolucao() {
  const { resumoMes = {}, projecao = [], carregando } = useProjecao()
  const { perfil } = useAuth()
  const { ocultar, alternar } = useOcultarValores()
  const [verTodos, setVerTodos] = useState(false)
  const [expandido, setExpandido] = useState(-1)

  const meses = useMemo(() => (Array.isArray(projecao) ? projecao.slice(0, 12) : []), [projecao])
  const receitas = n(resumoMes.receitaTotal)
  const despesas = n(resumoMes.despesaTotal) + n(resumoMes.parcelasTotal) + n(resumoMes.faturasTotal)
  const sobra = n(resumoMes.sobraPrevista)
  const reserva = n(perfil?.reserva_atual)
  const comDeficit = meses.filter(m => n(m.saldo) < 0).length
  const visiveis = verTodos ? meses : meses.slice(0, 4)
  const maior = Math.max(1, ...meses.map(m => Math.abs(n(m.saldo))))

  return (
    <main className="w-full min-w-0 max-w-none space-y-5 pb-24 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-marca hover:underline"><ArrowLeft size={16} /> Voltar para a Home</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Minha evolução financeira</h1>
          <p className="mt-1 text-sm text-slate-400">Entenda seu orçamento e acompanhe o planejamento dos próximos meses.</p>
        </div>
        <button type="button" onClick={alternar} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#273347] px-3 py-2 text-sm" aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}>
          {ocultar ? <EyeOff size={17} /> : <Eye size={17} />}{ocultar ? 'Mostrar valores' : 'Ocultar valores'}
        </button>
      </div>

      {carregando ? <div className="rounded-2xl bg-[#202838] p-6 text-sm">Carregando seu planejamento...</div> : <>
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-white">Resumo do mês atual</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CartaoResumo titulo="Receitas previstas" valor={receitas} Icone={TrendingUp} ocultar={ocultar} classe="text-emerald-400" />
            <CartaoResumo titulo="Despesas e compromissos" valor={despesas} Icone={TrendingDown} ocultar={ocultar} classe="text-rose-400" />
            <CartaoResumo titulo="Sobra prevista" valor={sobra} Icone={Wallet} ocultar={ocultar} classe={sobra < 0 ? 'text-rose-400' : 'text-marca'} />
            <CartaoResumo titulo="Reserva cadastrada" valor={reserva} Icone={PiggyBank} ocultar={ocultar} />
          </div>
          <p className="text-xs text-slate-400">A sobra prevista é uma estimativa do mês; não é o mesmo que seu saldo disponível agora. A reserva cadastrada não representa necessariamente uma transferência feita neste mês.</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#202838] p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold"><CalendarDays size={18} className="text-marca" /> Tendência dos próximos meses</h2>
              <p className="mt-1 text-xs text-slate-400">Projeção futura do motor financeiro existente, não histórico de gastos.</p>
            </div>
            <Link to="/projecao" className="text-sm font-medium text-marca hover:underline">Abrir Projeção</Link>
          </div>
          {meses.length === 0 ? <p className="text-sm text-slate-400">Ainda não há projeções suficientes para mostrar sua tendência.</p> : <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Resumo dos primeiros seis períodos">
              {meses.slice(0, 6).map((m, i) => {
                const v = n(m.saldo)
                return <div key={`${m.mes}-${i}`} className="min-w-0 rounded-xl bg-[#293345] p-3">
                  <div className="mb-3 truncate text-xs text-slate-300">{m.mes || `Mês ${i + 1}`}</div>
                  <div className="flex h-20 items-end"><div className={`w-full rounded-t-md ${v < 0 ? 'bg-rose-500/70' : 'bg-marca'}`} style={{ height: `${Math.max(6, Math.abs(v) / maior * 100)}%` }} /></div>
                  <p className={`mt-2 break-words text-xs font-semibold ${v < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{exibirMoeda(v, ocultar)}</p>
                </div>
              })}
            </div>
            <p className="text-sm text-slate-300">{comDeficit > 0 ? `${comDeficit} dos ${meses.length} meses projetados apresentam resultado negativo.` : 'Nenhum dos meses projetados apresenta resultado negativo com os dados atuais.'}</p>
            <div className="space-y-2">
              {visiveis.map((m, i) => <div key={`${m.mes}-${i}`} className="overflow-hidden rounded-xl bg-[#293345]">
                <button type="button" onClick={() => setExpandido(expandido === i ? -1 : i)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm">
                  <span className="min-w-0 truncate capitalize font-medium">{m.mes || `Mês ${i + 1}`}</span>
                  <span className={`ml-auto font-semibold ${n(m.saldo) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{exibirMoeda(n(m.saldo), ocultar)}</span>
                  {expandido === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {expandido === i && <div className="space-y-2 border-t border-white/10 px-4 py-3 text-sm text-slate-300">
                  <div className="flex justify-between gap-3"><span>Receitas</span><strong className="text-emerald-400">{exibirMoeda(n(m.receitas), ocultar)}</strong></div>
                  <div className="flex justify-between gap-3"><span>Despesas e compromissos</span><strong className="text-rose-400">{exibirMoeda(n(m.despesas), ocultar)}</strong></div>
                  <p className="text-xs text-slate-400">Valores mensais fornecidos pela projeção existente.</p>
                </div>}
              </div>)}
            </div>
            {meses.length > 4 && <button type="button" onClick={() => setVerTodos(v => !v)} className="w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-marca">{verTodos ? 'Mostrar menos' : `Ver todos os ${meses.length} meses`}</button>}
          </>}
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Link to="/metas" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#202838] p-5 hover:border-marca">
            <Target size={22} className="shrink-0 text-marca" /><div><h3 className="font-semibold">Minhas metas</h3><p className="mt-1 text-xs text-slate-400">Veja as metas que você cadastrou e seu progresso.</p></div><span className="ml-auto text-marca">›</span>
          </Link>
          <Link to="/investimentos" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#202838] p-5 hover:border-marca">
            <PiggyBank size={22} className="shrink-0 text-marca" /><div><h3 className="font-semibold">Patrimônio e reserva</h3><p className="mt-1 text-xs text-slate-400">Consulte seus investimentos e valores reservados.</p></div><span className="ml-auto text-marca">›</span>
          </Link>
        </section>
        <div className="flex items-start gap-2 text-xs text-slate-400"><Info size={15} className="shrink-0"/><span>Esta primeira versão mostra dados atuais e projeções futuras. Uma comparação histórica real entre meses exigirá consultar os registros de períodos anteriores sem misturá-los com previsões.</span></div>
      </>}
    </main>
  )
}
