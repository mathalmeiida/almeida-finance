import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'

// Resumo do topo (uma métrica) — valor SEMPRE em uma linha (sem quebrar centavos).
function ResumoItem({ rotulo, valor, cor = 'text-gray-900' }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[11px] text-gray-400 leading-tight mb-0.5">{rotulo}</p>
      <p className={`text-sm font-bold whitespace-nowrap tabular-nums ${cor}`}>
        {formatCurrency(valor)}
      </p>
    </div>
  )
}

// Coluna de um mês: cabeçalho + lista de dias (sem rolagem vertical própria —
// os dias fluem na rolagem normal do modal/página).
function ColunaMes({ mes }) {
  return (
    <div
      className={`shrink-0 w-[86vw] sm:w-44 snap-center rounded-xl border ${
        mes.ehMesAtual ? 'border-blue-300' : 'border-gray-200'
      } overflow-hidden`}
    >
      {/* Cabeçalho do mês (destaca o mês atual em azul) */}
      <div
        className={`px-3 py-2 text-sm font-semibold uppercase tracking-wide text-center ${
          mes.ehMesAtual ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-600'
        }`}
      >
        {mes.label}
      </div>

      {/* Dias — saldo acumulado; verde positivo / vermelho negativo.
          Dia com evento em negrito; dia de hoje com fundo azul claro. */}
      <div className="divide-y divide-gray-50">
        {mes.dias.map(d => (
          <div
            key={d.dia}
            className={`flex items-center justify-between gap-2 px-3 py-1.5 ${
              d.ehHoje ? 'bg-blue-50/60' : ''
            }`}
          >
            <span className={`text-xs tabular-nums ${d.ehHoje ? 'font-bold text-blue-700' : 'text-gray-400'}`}>
              {String(d.dia).padStart(2, '0')}
            </span>
            <span className={`text-xs tabular-nums whitespace-nowrap ${
              d.temEvento ? 'font-bold' : 'font-medium'
            } ${d.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(d.saldo)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Props: dados brutos vindos do useProjecao + saldo inicial.
export default function HorizonteFinanceiro({
  receitas, despesas, recorrentes, parcelamentos,
  cartoes, comprasCartao, faturasInformadas,
  reservaPct, saldoInicial,
}) {
  const horizonte = useMemo(() => gerarHorizonte({
    receitas, despesas, recorrentes, parcelamentos,
    cartoes, comprasCartao, faturasInformadas,
    saldoInicial, reservaPct, meses: 12,
  }), [receitas, despesas, recorrentes, parcelamentos, cartoes, comprasCartao, faturasInformadas, saldoInicial, reservaPct])

  const trilhoRef = useRef(null)
  // Mês selecionado para o RESUMO do topo. Atualiza conforme o carrossel desliza.
  const [idxSel, setIdxSel] = useState(0)
  const mesSel = horizonte[idxSel] || horizonte[0]

  // Descobre qual coluna está centralizada no carrossel (sincroniza o resumo).
  const aoRolar = useCallback(() => {
    const trilho = trilhoRef.current
    if (!trilho) return
    const colunas = trilho.children
    const centro = trilho.scrollLeft + trilho.clientWidth / 2
    let maisProx = 0, menorDist = Infinity
    for (let i = 0; i < colunas.length; i++) {
      const col = colunas[i]
      const colCentro = col.offsetLeft + col.offsetWidth / 2
      const dist = Math.abs(colCentro - centro)
      if (dist < menorDist) { menorDist = dist; maisProx = i }
    }
    setIdxSel(prev => (prev !== maisProx ? maisProx : prev))
  }, [])

  // Setas: rola o carrossel até a coluna alvo (snap suave).
  const irPara = useCallback((idx) => {
    const trilho = trilhoRef.current
    if (!trilho) return
    const alvo = Math.min(Math.max(0, idx), horizonte.length - 1)
    const col = trilho.children[alvo]
    if (col) trilho.scrollTo({ left: col.offsetLeft, behavior: 'smooth' })
  }, [horizonte.length])

  if (!horizonte.length) {
    return <p className="text-sm text-gray-500">Sem dados para projetar.</p>
  }

  return (
    <div className="space-y-4">
      {/* ── Resumo compacto do mês selecionado (valores em uma linha) ── */}
      <div className="card">
        <p className="text-xs text-gray-500 mb-2">
          Resumo de <span className="capitalize font-semibold text-gray-700">{mesSel.label}</span>
        </p>
        {/* Grid responsivo: mobile 2 col (2+2+1), tablet 3 col (3+2),
            desktop 5 col ocupando toda a largura com espaçamento maior. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 lg:gap-x-6">
          <ResumoItem rotulo="Saldo inicial" valor={mesSel.saldoInicial} cor="text-gray-700" />
          <ResumoItem rotulo="Entradas" valor={mesSel.entradas} cor="text-green-600" />
          <ResumoItem rotulo="Compromissos" valor={mesSel.saidas} cor="text-red-500" />
          <ResumoItem rotulo="Reserva" valor={mesSel.reserva} cor="text-amber-600" />
          <ResumoItem rotulo="Saldo final" valor={mesSel.saldoFinal} cor={mesSel.saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'} />
        </div>
      </div>

      {/* ── Navegação ‹ › + indicador do mês atual do carrossel ── */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => irPara(idxSel - 1)}
          disabled={idxSel === 0}
          className="touch-target rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-xs text-gray-400">{idxSel + 1} de {horizonte.length}</span>
        <button
          onClick={() => irPara(idxSel + 1)}
          disabled={idxSel === horizonte.length - 1}
          className="touch-target rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          aria-label="Próximo mês"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* ── Carrossel de meses: desliza horizontalmente, com snap e SEM barra
          de rolagem visível. Mobile: ~1 mês por vez (86vw). Desktop: vários
          lado a lado. Cada coluna NÃO tem rolagem vertical própria. ── */}
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory"
        style={{ scrollPadding: '0' }}
      >
        {horizonte.map(m => (
          <ColunaMes key={`${m.ano}-${m.mes}`} mes={m} />
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Deslize para o lado para ver os próximos meses. O saldo acumula dia a dia conforme entradas e
        compromissos com data definida. A reserva aparece no resumo e não é descontada do fluxo diário.
      </p>
    </div>
  )
}
