import React, { useState } from 'react'
import { validarItem as validarResumo } from '../lib/importacaoRegras'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  CreditCard, Info, Repeat2, ShieldCheck,
} from 'lucide-react'

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL',
})

const numero = valor => {
  const n = Number(valor)
  return Number.isFinite(n) ? n : 0
}

export default function ResumoConciliacao({ resumo, itens = [], incluidos, revisar }) {
  const [detalhes, setDetalhes] = useState(false)
  if (!resumo) return null

  // Exibe o que está realmente marcado, e não a soma de candidatos da conciliação.
  const selecionados = itens.filter(i => i.incluir)
  const quantidade = selecionados.length
  const somaSelecionada = selecionados.reduce((total, i) => total + Math.abs(numero(i.valor)), 0)
  const prontos = selecionados.filter(i => !validarResumo(i)).length
  const bloqueados = quantidade - prontos
  const pendentes = typeof revisar === 'number'
    ? revisar
    : itens.filter(i => i.revisar || (i.avisos?.length > 0) || (i.incluir && validarResumo(i))).length
  const duplicados = numero(resumo.duplicatasProvaveis) + numero(resumo.duplicatasPossiveis)
  const divergentes = numero(resumo.divergentes)

  const fora = [
    { rotulo: 'Transferências', quantidade: numero(resumo.transferencias), Icone: Repeat2 },
    { rotulo: 'Pagamentos de fatura', quantidade: numero(resumo.pagamentosFatura), Icone: CreditCard },
    { rotulo: 'Já importados', quantidade: numero(resumo.jaImportados), Icone: CheckCircle2 },
  ].filter(x => x.quantidade > 0)

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4" aria-label="Resumo da seleção">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Sua importação</h2>
          <p className="mt-1 text-xs text-gray-500">Confira a seleção antes de salvar.</p>
        </div>
        <span className="rounded-full bg-[#821C3E]/10 px-3 py-1 text-xs font-medium text-[#821C3E]">
          {quantidade} {quantidade === 1 ? 'selecionado' : 'selecionados'}
        </span>
      </div>

      <div className="rounded-xl bg-[#821C3E]/[0.055] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-gray-600">Soma dos itens marcados</p>
            <p className="mt-1 text-[11px] text-gray-500">Inclui itens ainda pendentes; não é o valor pronto para gravar</p>
          </div>
          <p className="text-xl font-bold tabular-nums text-[#821C3E] sm:text-2xl">{brl.format(somaSelecionada)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Identificados', itens.length],
          ['Prontos', prontos],
          ['Para revisar', pendentes],
          ['Duplicidades', duplicados + divergentes],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p  className="text-xl font-semibold tabular-nums text-gray-900">{valor}</p>
            <p className="mt-1 text-xs text-gray-600">{rotulo}</p>
          </div>
        ))}
      </div>

      {bloqueados > 0 && (
        <p className="text-xs font-medium text-amber-800" role="alert">
          {bloqueados} {bloqueados === 1 ? 'selecionado ainda precisa' : 'selecionados ainda precisam'} de correção antes de salvar.
        </p>
      )}

      {pendentes > 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900" role="status">
          <AlertTriangle className="mt-0.5 shrink-0" size={17} />
          <p className="text-xs leading-5">{pendentes} {pendentes === 1 ? 'lançamento precisa' : 'lançamentos precisam'} de conferência. Abra os avisos de cada item e corrija os campos necessários antes de confirmar.</p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-emerald-800" role="status">
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          <p className="text-xs leading-5">Nenhum lançamento marcado para revisão. Confira os dados antes de salvar.</p>
        </div>
      )}

      {fora.length > 0 && (
        <div className="rounded-xl border border-gray-200">
          <button type="button" aria-expanded={detalhes} onClick={() => setDetalhes(v => !v)}
            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left">
            <span className="flex items-center gap-2 text-xs font-medium text-gray-700">
              <Info size={16} /> Itens que não entram como novos lançamentos
            </span>
            {detalhes ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
          </button>
          {detalhes && (
            <ul className="space-y-2 border-t border-gray-100 p-3">
              {fora.map(({ rotulo, quantidade: qtd, Icone }) => (
                <li key={rotulo} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                  <span className="flex items-center gap-2"><Icone size={15} />{rotulo}</span>
                  <strong>{qtd}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
