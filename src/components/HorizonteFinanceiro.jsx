import React, { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '../lib/utils'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'

// Resumo do topo (uma métrica): título ACIMA, valor ABAIXO. O valor pode
// quebrar em até duas linhas quando for grande (ex.: acima de R$ 100.000,00),
// evitando sobreposição em colunas estreitas. tabular-nums mantém os dígitos
// alinhados. Respeita o "ocultar valores" (via formatCurrency).
function ResumoItem({ rotulo, valor, cor = 'text-gray-900' }) {
  return (
    <div className="min-w-0 text-center rounded-lg bg-gray-50 px-2 py-2">
      <p className="text-[11px] text-gray-400 leading-tight mb-1">{rotulo}</p>
      <p className={`text-xs sm:text-sm font-bold tabular-nums leading-tight break-words ${cor}`}>
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
      className={`shrink-0 basis-full w-full sm:basis-auto sm:w-44 snap-center rounded-xl border ${
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
 reservaPct, saldoInicial, dataReferencia,
}) {
  const horizonte = useMemo(() => gerarHorizonte({
  receitas, despesas, recorrentes, parcelamentos,
  cartoes, comprasCartao, faturasInformadas,
  saldoInicial, reservaPct, meses: 12,
}), [
  receitas, despesas, recorrentes, parcelamentos,
  cartoes, comprasCartao, faturasInformadas,
  saldoInicial, reservaPct
])
  // Mês selecionado para o RESUMO do topo. Atualiza conforme o carrossel desliza.
  const [idxSel, setIdxSel] = useState(0)
  const mesSel = horizonte[idxSel] || horizonte[0]

  // Ref do trilho do carrossel (usado em aoRolar/irPara). Faltava declarar —
  // sua ausência quebrava a renderização da página /projecao.
  const trilhoRef = useRef(null)

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
        {/* Grid responsivo com cada indicador em sua "caixa": celular 2 colunas
            (2+2+1), tablet 3 colunas, desktop 5 colunas lado a lado. Como o
            modal agora é mais largo (tamanho="lg"), as 5 colunas têm espaço
            folgado e os valores não se sobrepõem — mesmo acima de R$ 100.000,00
            (quebram em 2 linhas se necessário). */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          <ResumoItem rotulo="Saldo inicial" valor={mesSel.saldoInicial} cor="text-gray-700" />
          <ResumoItem rotulo="Entradas" valor={mesSel.entradas} cor="text-green-600" />
          <ResumoItem rotulo="Compromissos" valor={mesSel.saidas} cor="text-red-500" />
          <ResumoItem rotulo="Reserva" valor={mesSel.reserva} cor="text-amber-600" />
          <ResumoItem rotulo="Saldo final" valor={mesSel.saldoFinal} cor={mesSel.saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'} />
        </div>
      </div>

      {/* ── Navegação ‹ › do carrossel (apenas desktop; no mobile os cartões
          já listam todos os meses). ── */}
      <div className="hidden md:flex items-center justify-between gap-2">
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

      {/* ── DESKTOP (md+): carrossel de meses com o detalhe dia a dia. ── */}
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="hidden md:flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory"
        style={{ scrollPadding: '0' }}
      >
        {horizonte.map(m => (
          <ColunaMes key={`${m.ano}-${m.mes}`} mes={m} />
        ))}
      </div>

      {/* ── MOBILE (<md): cartões compactos por mês (sem rolagem horizontal).
          Usa os MESMOS agregados do mês (entradas/saídas/saldo final) — nenhum
          cálculo novo. Ocupam toda a largura disponível. ── */}
      <div className="md:hidden space-y-2.5">
        {horizonte.map(m => {
          const positivo = m.saldoFinal >= 0
          return (
            <div
              key={`${m.ano}-${m.mes}`}
              className={`rounded-xl border p-3 ${m.ehMesAtual ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="capitalize font-semibold text-gray-800 text-sm">{m.label}</span>
                {m.ehMesAtual && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-x-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">Receitas</p>
                  <p className="text-sm font-semibold text-green-600 tabular-nums break-words">{formatCurrency(m.entradas)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">Despesas</p>
                  <p className="text-sm font-semibold text-red-500 tabular-nums break-words">{formatCurrency(m.saidas)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400">Saldo projetado</p>
                  <p className={`text-sm font-bold tabular-nums break-words ${positivo ? 'text-blue-600' : 'text-red-600'}`}>
                    {formatCurrency(m.saldoFinal)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400">
        <span className="hidden md:inline">Deslize para o lado para ver os próximos meses. </span>
        O saldo acumula dia a dia conforme entradas e
        compromissos com data definida. A reserva aparece no resumo e não é descontada do fluxo diário.
      </p>
    </div>
  )
}
