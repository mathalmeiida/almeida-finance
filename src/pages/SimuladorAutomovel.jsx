import React, { useState } from 'react'
import { Car, Info, AlertTriangle, PiggyBank, ChevronDown, ChevronUp } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import InputMoeda from '../components/InputMoeda'
import DestaqueValor from '../components/DestaqueValor'
import { calcularPrice, comprometimentoRenda } from '../lib/financiamento'

const fmtPct = (v, casas = 0) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`

// Prazos comuns de financiamento de veículo (+ opção manual).
const PRAZOS = [12, 24, 36, 48, 60]

export default function SimuladorAutomovel() {
  const { resumoMes } = useProjecao()
  const { perfil } = useAuth()

  const reservaDisponivel = Number(perfil?.reserva_atual) || 0
  const rendaMensal = Number(resumoMes?.receitaTotal) || 0

  // ── Formulário ──
  const [valorVeiculo, setValorVeiculo] = useState('')
  const [entrada, setEntrada] = useState('')
  const [prazo, setPrazo] = useState(48)
  const [prazoManual, setPrazoManual] = useState(false)
  const [prazoManualValor, setPrazoManualValor] = useState('')
  const [taxaMensal, setTaxaMensal] = useState('1,9') // % a.m.

  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  // ── "E se eu der uma entrada maior?" ──
  const [secaoEntrada, setSecaoEntrada] = useState(false)
  const [entradaMaior, setEntradaMaior] = useState('')
  const [compEntrada, setCompEntrada] = useState(null)

  const taxaNum = parseFloat(String(taxaMensal).replace(',', '.')) || 0
  const prazoFinal = prazoManual ? Math.max(1, Math.floor(Number(prazoManualValor) || 0)) : prazo

  function limpar() { setResultado(null); setCompEntrada(null); setErro(''); setSecaoEntrada(false) }

  // Calcula uma simulação PRICE para um dado par (entrada) — reutilizável.
  function simular(valorVeic, entradaVal) {
    const financiado = Math.max(0, valorVeic - entradaVal)
    const i = taxaNum / 100 // taxa JÁ é mensal
    const price = calcularPrice(financiado, i, prazoFinal)
    const totalPago = entradaVal + price.totalPago // entrada + parcelas
    return {
      financiado,
      parcela: price.parcela,
      n: price.n,
      totalParcelas: price.totalPago,
      jurosTotais: price.jurosTotais,
      totalPagoVeiculo: totalPago,
      custoAdicional: Math.max(0, totalPago - valorVeic),
    }
  }

  function handleSimular(e) {
    e.preventDefault()
    setErro('')
    const veic = Number(valorVeiculo) || 0
    const ent = Number(entrada) || 0
    if (veic <= 0) { setErro('Informe o valor do veículo.'); return }
    if (ent > veic) { setErro('A entrada não pode ser maior que o valor do veículo.'); return }
    if (prazoFinal <= 0) { setErro('Informe o prazo em meses.'); return }
    if (taxaNum <= 0) { setErro('Informe a taxa de juros mensal.'); return }

    const sim = simular(veic, ent)
    const pctRenda = comprometimentoRenda(sim.parcela, rendaMensal)
    setResultado({ ...sim, veic, entrada: ent, pctRenda })
    setCompEntrada(null)
  }

  function handleEntradaMaior() {
    if (!resultado) return
    const novaEnt = Number(entradaMaior) || 0
    if (novaEnt > resultado.veic) { return }
    const sim = simular(resultado.veic, novaEnt)
    setCompEntrada({
      ...sim,
      entrada: novaEnt,
      economiaJuros: Math.max(0, resultado.jurosTotais - sim.jurosTotais),
      pctRenda: comprometimentoRenda(sim.parcela, rendaMensal),
    })
  }

  const corPct = resultado?.pctRenda == null ? 'text-gray-900'
    : resultado.pctRenda >= 40 ? 'text-red-600'
    : resultado.pctRenda >= 30 ? 'text-amber-600'
    : 'text-green-600'

  return (
    <div className="space-y-6">
      {/* Resumo: reserva + renda (apenas leitura; reserva NÃO entra como entrada) */}
      <div className="card bg-gray-50 border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Reserva disponível</p>
            <p className="text-sm font-bold text-emerald-600 break-words">{formatCurrency(reservaDisponivel)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sua renda mensal</p>
            <p className="text-sm font-bold text-green-600 break-words">{formatCurrency(rendaMensal)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          A reserva é mostrada apenas para referência e não é usada automaticamente como entrada.
        </p>
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={handleSimular} className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Car size={18} className="text-blue-600" /> Dados do financiamento
        </h2>

        <div>
          <label className="label">Valor do veículo (R$)</label>
          <InputMoeda valor={valorVeiculo} onChangeValor={(n) => { setValorVeiculo(n); limpar() }}
            className="input" prefixo={null} />
        </div>

        <div>
          <label className="label">Valor da entrada (R$)</label>
          <InputMoeda valor={entrada} onChangeValor={(n) => { setEntrada(n); limpar() }}
            className="input" prefixo={null} />
          {Number(valorVeiculo) > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Valor financiado: <strong>{formatCurrency(Math.max(0, (Number(valorVeiculo) || 0) - (Number(entrada) || 0)))}</strong>
            </p>
          )}
        </div>

        <div>
          <label className="label">Prazo (meses)</label>
          <div className="flex flex-wrap gap-2">
            {PRAZOS.map(p => (
              <button key={p} type="button"
                onClick={() => { setPrazoManual(false); setPrazo(p); limpar() }}
                className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                  !prazoManual && prazo === p ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}>
                {p}x
              </button>
            ))}
            <button type="button"
              onClick={() => { setPrazoManual(true); limpar() }}
              className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                prazoManual ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}>
              Outro
            </button>
          </div>
          {prazoManual && (
            <input type="number" min="1" max="120" inputMode="numeric" value={prazoManualValor}
              onChange={(e) => { setPrazoManualValor(e.target.value); limpar() }}
              className="input mt-2" placeholder="Nº de meses (ex: 72)" />
          )}
        </div>

        <div>
          <label className="label">Taxa de juros mensal (% a.m.)</label>
          <input type="text" inputMode="decimal" value={taxaMensal}
            onChange={(e) => { setTaxaMensal(e.target.value); limpar() }}
            className="input" placeholder="Ex: 1,9" />
          <p className="text-xs text-gray-500 mt-1">
            Informe a taxa de juros mensal oferecida pelo banco ou financeira (% a.m.).
          </p>
          <p className="text-xs text-gray-400 mt-1">Sistema PRICE (parcela fixa), padrão no financiamento de veículos.</p>
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

        <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          <Car size={18} /> Simular financiamento
        </button>
      </form>

      {/* ── Resultado ── */}
      {resultado && (
        <>
          <div className="card border-2 border-blue-200">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-3">Resultado da simulação</p>

            <div className="grid grid-cols-2 gap-3">
              <DestaqueValor rotulo="Veículo" valor={formatCurrency(resultado.veic)} />
              <DestaqueValor rotulo="Entrada" valor={formatCurrency(resultado.entrada)} cor="text-emerald-600" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DestaqueValor rotulo="Valor financiado" valor={formatCurrency(resultado.financiado)} cor="text-blue-600" />
              <DestaqueValor rotulo="Parcela" valor={`${resultado.n}x de ${formatCurrency(resultado.parcela)}`} cor="text-blue-700" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DestaqueValor rotulo="Juros totais" valor={formatCurrency(resultado.jurosTotais)} cor="text-red-500" />
              <DestaqueValor rotulo="Total pago pelo veículo" valor={formatCurrency(resultado.totalPagoVeiculo)} />
            </div>

            <div className="mt-3">
              <DestaqueValor
                rotulo="Comprometimento da renda"
                valor={resultado.pctRenda == null ? '—' : fmtPct(resultado.pctRenda, 0)}
                cor={corPct}
                sub="pela parcela mensal"
              />
            </div>

            {resultado.pctRenda != null && resultado.pctRenda >= 30 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  A parcela compromete uma parte elevada da sua renda ({fmtPct(resultado.pctRenda, 0)}). Avalie com calma antes de decidir.
                </p>
              </div>
            )}
          </div>

          {/* ── Custo do financiamento (quanto o carro custa "de verdade") ── */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Custo do financiamento</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Valor do veículo</span>
                <strong className="text-gray-900">{formatCurrency(resultado.veic)}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Total desembolsado</span>
                <strong className="text-gray-900">{formatCurrency(resultado.totalPagoVeiculo)}</strong>
              </div>
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Custo adicional estimado</span>
                <strong className="text-red-600">{formatCurrency(resultado.custoAdicional)}</strong>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              É quanto você pagaria além do preço do veículo por causa dos juros do financiamento.
            </p>
          </div>

          {/* ── E se eu der uma entrada maior? ── */}
          <div className="card">
            <button type="button" onClick={() => setSecaoEntrada(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <span className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <PiggyBank size={18} className="text-emerald-600" /> E se eu der uma entrada maior?
              </span>
              {secaoEntrada ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>
            {secaoEntrada && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="label">Nova entrada (R$)</label>
                  <InputMoeda valor={entradaMaior} onChangeValor={setEntradaMaior} className="input" prefixo={null} />
                  <p className="text-xs text-gray-400 mt-1">Máximo: {formatCurrency(resultado.veic)}.</p>
                </div>
                <button type="button" onClick={handleEntradaMaior} className="btn-secondary w-full">
                  Comparar
                </button>

                {compEntrada && (
                  <div className="grid grid-cols-2 gap-3">
                    <DestaqueValor rotulo="Nova parcela" valor={`${compEntrada.n}x de ${formatCurrency(compEntrada.parcela)}`} cor="text-blue-700" />
                    <DestaqueValor rotulo="Novo valor financiado" valor={formatCurrency(compEntrada.financiado)} cor="text-blue-600" />
                    <DestaqueValor rotulo="Novos juros totais" valor={formatCurrency(compEntrada.jurosTotais)} cor="text-red-500" />
                    <DestaqueValor rotulo="Economia de juros" valor={formatCurrency(compEntrada.economiaJuros)} cor="text-emerald-600" />
                  </div>
                )}

                {/* Alerta se a nova entrada usa parte relevante da reserva */}
                {compEntrada && reservaDisponivel > 0 && compEntrada.entrada > resultado.entrada &&
                 (compEntrada.entrada - resultado.entrada) >= reservaDisponivel * 0.3 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Usar sua reserva para comprar um veículo reduz sua proteção financeira para imprevistos.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Aviso legal */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Esta é uma simulação para planejamento financeiro. As condições reais podem incluir tarifas,
          IOF, seguros, CET e outras cobranças da instituição financeira.
        </p>
      </div>
    </div>
  )
}
