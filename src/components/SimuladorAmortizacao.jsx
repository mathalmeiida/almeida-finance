import React, { useState } from 'react'
import { TrendingDown, Info, AlertTriangle, Landmark } from 'lucide-react'
import InputMoeda from './InputMoeda'
import DestaqueValor from './DestaqueValor'
import { taxaAnualParaMensal, amortizarSaldoDevedor } from '../lib/financiamento'

const fmtPct = (v, casas = 2) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`

// ─────────────────────────────────────────────────────────────────────────────
// Simulador de AMORTIZAÇÃO (reutilizável). Serve para financiamento imobiliário,
// financiamento de veículo e empréstimo. NÃO altera dados — só simula.
//
// Pré-preenche o que já se sabe do contrato (saldo devedor, parcelas restantes,
// prestação) via props `inicial`; o usuário completa o que faltar. Para imóvel
// (mostrarFgts) habilita o campo de FGTS, com aviso de elegibilidade.
//
// Compara as duas estratégias (reduzir prazo × reduzir parcela) com a MESMA
// lógica pura de SAC/PRICE (amortizarSaldoDevedor), trabalhando só sobre o
// principal — seguros/encargos ficam de fora, conforme solicitado.
// ─────────────────────────────────────────────────────────────────────────────
export default function SimuladorAmortizacao({ inicial = {}, mostrarFgts = false, estimado = false }) {
  const [saldo, setSaldo] = useState(inicial.saldo != null ? String(inicial.saldo) : '')
  const [parcelasRestantes, setParcelasRestantes] = useState(inicial.parcelasRestantes != null ? String(inicial.parcelasRestantes) : '')
  const [prestacao, setPrestacao] = useState(inicial.prestacao != null ? String(inicial.prestacao) : '')
  const [sistema, setSistema] = useState(inicial.sistema || 'price') // 'sac' | 'price'
  const [taxa, setTaxa] = useState(inicial.taxa != null ? String(inicial.taxa) : '')
  const [taxaPeriodo, setTaxaPeriodo] = useState(inicial.taxaPeriodo || 'mensal') // 'mensal' | 'anual'
  const [extra, setExtra] = useState('')
  const [fgts, setFgts] = useState('')
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  // Taxa informada → mensal (decimal). Anual converte por juros compostos.
  const taxaNum = parseFloat(String(taxa).replace(',', '.')) || 0
  const iMensal = taxaPeriodo === 'anual' ? taxaAnualParaMensal(taxaNum) : taxaNum / 100

  const valorAmortizar = (Number(extra) || 0) + (mostrarFgts ? (Number(fgts) || 0) : 0)

  function limpar() { setResultado(null); setErro('') }

  function simular() {
    setErro('')
    const PV = Number(saldo) || 0
    const n = Math.max(0, Math.floor(Number(parcelasRestantes) || 0))
    if (PV <= 0) { setErro('Informe o saldo devedor atual.'); return }
    if (n <= 0) { setErro('Informe a quantidade de parcelas restantes.'); return }
    if (taxaNum <= 0) { setErro('Informe a taxa de juros do contrato.'); return }
    if (valorAmortizar <= 0) { setErro('Informe o valor que deseja amortizar.'); return }

    const base = { sistema, saldo: PV, i: iMensal, n, extra: valorAmortizar }
    setResultado({
      prazo: amortizarSaldoDevedor({ ...base, modo: 'prazo' }),
      parcela: amortizarSaldoDevedor({ ...base, modo: 'parcela' }),
      valorAmortizar,
      usouFgts: mostrarFgts && (Number(fgts) || 0) > 0,
    })
  }

  return (
    <div className="space-y-4">
      {/* Dados do contrato (pré-preenchidos quando disponíveis) */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Saldo devedor atual (R$)</label>
          <InputMoeda valor={saldo} onChangeValor={(n) => { setSaldo(n); limpar() }} className="input" prefixo={null} />
        </div>
        <div>
          <label className="label">Parcelas restantes</label>
          <input type="number" min="1" inputMode="numeric" value={parcelasRestantes}
            onChange={(e) => { setParcelasRestantes(e.target.value); limpar() }} className="input" placeholder="Ex: 320" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prestação atual (R$)</label>
          <InputMoeda valor={prestacao} onChangeValor={(n) => { setPrestacao(n); limpar() }} className="input" prefixo={null} />
          <p className="text-xs text-gray-400 mt-1">Opcional — informativo (sem seguros/encargos).</p>
        </div>
        <div>
          <label className="label">Sistema</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ id: 'sac', nome: 'SAC' }, { id: 'price', nome: 'PRICE' }].map(op => (
              <button key={op.id} type="button" onClick={() => { setSistema(op.id); limpar() }}
                className={`p-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  sistema === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                }`}>
                {op.nome}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="label">Taxa de juros do contrato</label>
        <div className="flex gap-2">
          <input type="text" inputMode="decimal" value={taxa}
            onChange={(e) => { setTaxa(e.target.value); limpar() }}
            className="input flex-1" placeholder={taxaPeriodo === 'mensal' ? 'Ex: 0,9' : 'Ex: 11,5'} />
          <div className="flex gap-1 flex-shrink-0">
            {[{ id: 'mensal', nome: 'a.m.' }, { id: 'anual', nome: 'a.a.' }].map(op => (
              <button key={op.id} type="button" onClick={() => { setTaxaPeriodo(op.id); limpar() }}
                className={`px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  taxaPeriodo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                }`}>
                {op.nome}
              </button>
            ))}
          </div>
        </div>
        {taxaPeriodo === 'anual' && taxaNum > 0 && (
          <p className="text-xs text-gray-400 mt-1">Equivale a <strong>{fmtPct(iMensal * 100, 4)} ao mês</strong>.</p>
        )}
      </div>

      <div>
        <label className="label">Valor que deseja amortizar (R$)</label>
        <InputMoeda valor={extra} onChangeValor={(n) => { setExtra(n); limpar() }} className="input" prefixo={null} />
      </div>

      {/* FGTS — só para financiamento imobiliário */}
      {mostrarFgts && (
        <div className="rounded-xl border border-gray-200 p-3">
          <label className="label flex items-center gap-1.5">
            <Landmark size={15} className="text-sky-600" /> FGTS a utilizar (R$)
          </label>
          <InputMoeda valor={fgts} onChangeValor={(n) => { setFgts(n); limpar() }} className="input" prefixo={null} />
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
            A utilização do FGTS depende das regras e da elegibilidade do financiamento. Esta simulação não garante o uso.
          </p>
        </div>
      )}

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

      <button type="button" onClick={simular} className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
        <TrendingDown size={16} /> Simular amortização
      </button>

      {/* ── Resultado: compara reduzir prazo × reduzir parcela ── */}
      {resultado && (resultado.prazo || resultado.parcela) && (
        <div className="space-y-3">
          {(estimado) && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Resultado estimado. Contratos com taxa variável, indexadores ou regras específicas podem diferir. Confirme com a instituição.
              </p>
            </div>
          )}

          {resultado.prazo?.quitacaoTotal ? (
            <div className="card border-2 border-emerald-200">
              <p className="text-sm font-semibold text-gray-900 mb-2">Quitação total</p>
              <p className="text-sm text-gray-600">
                O valor informado ({formatCurrencyLocal(resultado.valorAmortizar)}) cobre todo o saldo devedor.
                Economia estimada de juros: <strong className="text-emerald-600">{formatCurrencyLocal(resultado.prazo.economiaJuros)}</strong>.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CardOpcao titulo="Reduzir prazo" r={resultado.prazo} destaque="meses" />
              <CardOpcao titulo="Reduzir parcela" r={resultado.parcela} destaque="parcela" />
            </div>
          )}

          <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <Info size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Simulação sobre o principal (sem seguros, tarifas e encargos). A economia considera os juros do cronograma, não apenas a prestação.
              {resultado.usouFgts && ' Parte do valor vem do FGTS — não sai do seu saldo bancário.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// Formata moeda local (evita import extra do utils; usa Intl pt-BR).
function formatCurrencyLocal(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function CardOpcao({ titulo, r, destaque }) {
  if (!r) return null
  return (
    <div className="card">
      <p className="text-sm font-semibold text-gray-900 mb-2">{titulo}</p>
      <div className="space-y-2">
        {destaque === 'meses' ? (
          <DestaqueValor rotulo="Novo prazo" valor={`${r.prazoDepois} meses`} cor="text-marca"
            sub={`${r.mesesEconomizados} meses a menos`} />
        ) : (
          <DestaqueValor rotulo="Nova prestação" valor={formatCurrencyLocal(r.prestacaoDepois)} cor="text-marca"
            sub={`−${formatCurrencyLocal(Math.max(0, r.prestacaoAntes - r.prestacaoDepois))}/mês`} />
        )}
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-1 border-t border-gray-100">
          <div><span className="text-gray-400 block">Saldo antes</span><strong>{formatCurrencyLocal(r.saldoAntes)}</strong></div>
          <div><span className="text-gray-400 block">Saldo depois</span><strong>{formatCurrencyLocal(r.saldoDepois)}</strong></div>
          <div><span className="text-gray-400 block">Juros antes</span><strong>{formatCurrencyLocal(r.jurosAntes)}</strong></div>
          <div><span className="text-gray-400 block">Juros depois</span><strong>{formatCurrencyLocal(r.jurosDepois)}</strong></div>
        </div>
        <div className="flex justify-between gap-2 text-sm pt-1 border-t border-gray-100">
          <span className="text-gray-600 font-medium">Economia de juros</span>
          <strong className="text-emerald-600">{formatCurrencyLocal(r.economiaJuros)}</strong>
        </div>
      </div>
    </div>
  )
}
