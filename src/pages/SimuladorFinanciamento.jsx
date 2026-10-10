import React, { useState } from 'react'
import {
  Home, Info, AlertTriangle, PiggyBank, Landmark, TrendingDown, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import InputMoeda from '../components/InputMoeda'
import DestaqueValor from '../components/DestaqueValor'
import {
  taxaAnualParaMensal, prazoEmMeses, calcularPrice, calcularSac,
  calcularEntrada, simularAmortizacao, comprometimentoRenda,
} from '../lib/financiamento'

// Mostra a taxa mensal com 4 casas (ex.: 0,9123% a.m.).
const fmtPct = (v, casas = 2) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`

// Alias local para manter o JSX existente (<Destaque .../>) sem reescrever tudo.
const Destaque = DestaqueValor

// Seção expansível simples (hierarquia visual clara, sem poluir a tela).
function Secao({ titulo, icone: Icone, children, aberta, onToggle }) {
  return (
    <div className="card">
      <button type="button" onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {Icone && <Icone size={18} className="text-blue-600" />} {titulo}
        </span>
        {aberta ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>
      {aberta && <div className="mt-4">{children}</div>}
    </div>
  )
}

export default function SimuladorFinanciamento() {
  const { resumoMes } = useProjecao()
  const { perfil } = useAuth()

  const reservaDisponivel = Number(perfil?.reserva_atual) || 0
  const rendaMensal = Number(resumoMes?.receitaTotal) || 0

  // ── Formulário ──
  const [valorImovel, setValorImovel] = useState('')
  const [prazoValor, setPrazoValor] = useState('30')
  const [prazoUnidade, setPrazoUnidade] = useState('anos') // 'anos' | 'meses'
  const [taxaAnual, setTaxaAnual] = useState('11,5')
  const [sistema, setSistema] = useState('sac') // 'sac' | 'price'

  // ── Entrada ──
  const [recursosProprios, setRecursosProprios] = useState('')
  const [usarReserva, setUsarReserva] = useState(false)
  const [reservaUsada, setReservaUsada] = useState('')
  const [usarFgts, setUsarFgts] = useState(false)
  const [fgts, setFgts] = useState('')

  // ── Resultado / seções ──
  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')
  const [secaoComparar, setSecaoComparar] = useState(false)
  const [secaoAmortizar, setSecaoAmortizar] = useState(false)

  // ── Amortização ──
  const [amortExtra, setAmortExtra] = useState('')
  const [amortMes, setAmortMes] = useState('12')
  const [amortModo, setAmortModo] = useState('prazo') // 'prazo' | 'parcela'
  const [amortResultado, setAmortResultado] = useState(null)

  // Taxa anual aceita vírgula; converte para número.
  const taxaAnualNum = parseFloat(String(taxaAnual).replace(',', '.')) || 0

  // Reserva usada limitada ao disponível (não permite usar mais do que tem).
  const reservaUsadaNum = usarReserva ? Math.min(Number(reservaUsada) || 0, reservaDisponivel) : 0
  const fgtsNum = usarFgts ? (Number(fgts) || 0) : 0

  function limparResultado() {
    setResultado(null); setAmortResultado(null); setErro('')
    setSecaoComparar(false); setSecaoAmortizar(false)
  }

  function handleSimular(e) {
    e.preventDefault()
    setErro('')
    const imovel = Number(valorImovel) || 0
    const n = prazoEmMeses(prazoValor, prazoUnidade)
    if (imovel <= 0) { setErro('Informe o valor do imóvel.'); return }
    if (n <= 0) { setErro('Informe o prazo do financiamento.'); return }
    if (taxaAnualNum <= 0) { setErro('Informe a taxa de juros anual.'); return }

    const entrada = calcularEntrada({
      valorImovel: imovel,
      recursosProprios: Number(recursosProprios) || 0,
      reservaUsada: reservaUsadaNum,
      fgts: fgtsNum,
    })
    if (entrada.entradaExcedeImovel) {
      setErro('A entrada não pode ser maior que o valor do imóvel.')
      return
    }

    const i = taxaAnualParaMensal(taxaAnualNum)
    const sac = calcularSac(entrada.valorFinanciado, i, n)
    const price = calcularPrice(entrada.valorFinanciado, i, n)
    const escolhido = sistema === 'sac' ? sac : price

    setResultado({ entrada, i, n, sac, price, escolhido, sistema, taxaAnual: taxaAnualNum })
    setAmortResultado(null)
  }

  function handleAmortizar() {
    if (!resultado) return
    const r = simularAmortizacao({
      sistema: resultado.sistema,
      valorFinanciado: resultado.entrada.valorFinanciado,
      i: resultado.i,
      n: resultado.n,
      extra: Number(amortExtra) || 0,
      mesAmortizacao: Number(amortMes) || 1,
      modo: amortModo,
    })
    setAmortResultado(r)
  }

  // Parcela de referência para comprometimento (SAC usa a 1ª, maior).
  const parcelaRef = resultado
    ? (resultado.sistema === 'sac' ? resultado.sac.primeira : resultado.price.parcela)
    : 0
  const pctRenda = resultado ? comprometimentoRenda(parcelaRef, rendaMensal) : null
  const reservaRestante = Math.max(0, reservaDisponivel - reservaUsadaNum)
  const usoRelevanteReserva = reservaDisponivel > 0 && reservaUsadaNum >= reservaDisponivel * 0.3

  // Cor do comprometimento (alerta discreto, sem dizer aprovado/recusado).
  const corPct = pctRenda == null ? 'text-gray-900'
    : pctRenda >= 40 ? 'text-red-600'
    : pctRenda >= 30 ? 'text-amber-600'
    : 'text-green-600'

  return (
    <div className="space-y-6">
      {/* Resumo rápido: reserva disponível + renda (leitura dos dados do app) */}
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
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={handleSimular} className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Home size={18} className="text-blue-600" /> Dados do financiamento
        </h2>

        <div>
          <label className="label">Valor do imóvel (R$)</label>
          <InputMoeda valor={valorImovel}
            onChangeValor={(n) => { setValorImovel(n); limparResultado() }}
            className="input" prefixo={null} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prazo</label>
            <input type="number" min="1" inputMode="numeric" value={prazoValor}
              onChange={(e) => { setPrazoValor(e.target.value); limparResultado() }}
              className="input" placeholder="Ex: 30" />
          </div>
          <div>
            <label className="label">Em</label>
            <select value={prazoUnidade} onChange={(e) => { setPrazoUnidade(e.target.value); limparResultado() }} className="input">
              <option value="anos">Anos</option>
              <option value="meses">Meses</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Taxa de juros anual (% a.a.)</label>
          <input type="text" inputMode="decimal" value={taxaAnual}
            onChange={(e) => { setTaxaAnual(e.target.value); limparResultado() }}
            className="input" placeholder="Ex: 11,5" />
          <p className="text-xs text-gray-500 mt-1">
            Informe a taxa de juros anual oferecida pelo banco (% a.a.). Consulte sua proposta de financiamento.
          </p>
          {taxaAnualNum > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Equivale a <strong>{fmtPct(taxaAnualParaMensal(taxaAnualNum) * 100, 4)}</strong> ao mês.
            </p>
          )}
        </div>

        <div>
          <label className="label">Sistema de amortização</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ id: 'sac', nome: 'SAC', desc: 'parcelas diminuem' }, { id: 'price', nome: 'PRICE', desc: 'parcela fixa' }].map(op => (
              <label key={op.id}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-center ${
                  sistema === op.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <input type="radio" name="sistema" value={op.id} checked={sistema === op.id}
                  onChange={(e) => { setSistema(e.target.value); limparResultado() }} className="hidden" />
                <span className="text-sm font-semibold">{op.nome}</span>
                <span className="text-xs text-gray-400">{op.desc}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Entrada ── */}
        <div className="pt-2 border-t border-gray-100">
          <p className="text-base font-semibold text-gray-900 mb-3">Como será sua entrada?</p>

          <label className="label">Recursos próprios (R$)</label>
          <InputMoeda valor={recursosProprios}
            onChangeValor={(n) => { setRecursosProprios(n); limparResultado() }}
            className="input" prefixo={null} />

          {/* Reserva de emergência */}
          <div className="mt-3 rounded-xl border border-gray-200 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={usarReserva}
                onChange={(e) => { setUsarReserva(e.target.checked); limparResultado() }}
                className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <PiggyBank size={15} className="text-emerald-600" /> Usar parte da minha reserva
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Reserva disponível: <strong>{formatCurrency(reservaDisponivel)}</strong>
                </span>
              </span>
            </label>
            {usarReserva && (
              <div className="mt-3">
                <InputMoeda valor={reservaUsada}
                  onChangeValor={(n) => { setReservaUsada(Math.min(Number(n) || 0, reservaDisponivel)); limparResultado() }}
                  className="input" prefixo={null} />
                <p className="text-xs text-gray-400 mt-1">
                  Máximo: {formatCurrency(reservaDisponivel)}. Isto é só uma simulação — sua reserva real não muda.
                </p>
              </div>
            )}
          </div>

          {/* FGTS */}
          <div className="mt-3 rounded-xl border border-gray-200 p-3">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" checked={usarFgts}
                onChange={(e) => { setUsarFgts(e.target.checked); limparResultado() }}
                className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
                  <Landmark size={15} className="text-sky-600" /> Usar FGTS na entrada
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Informe o saldo manualmente (sem integração externa).
                </span>
              </span>
            </label>
            {usarFgts && (
              <div className="mt-3">
                <label className="label">Saldo de FGTS disponível (R$)</label>
                <InputMoeda valor={fgts}
                  onChangeValor={(n) => { setFgts(n); limparResultado() }}
                  className="input" prefixo={null} />
              </div>
            )}
          </div>

          {/* Prévia da entrada */}
          {Number(valorImovel) > 0 && (
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-blue-700">Entrada total</span>
                <strong className="text-blue-800">
                  {formatCurrency((Number(recursosProprios) || 0) + reservaUsadaNum + fgtsNum)}
                </strong>
              </div>
              <div className="flex justify-between gap-3 mt-1">
                <span className="text-blue-700">Valor financiado</span>
                <strong className="text-blue-800">
                  {formatCurrency(Math.max(0, (Number(valorImovel) || 0) - ((Number(recursosProprios) || 0) + reservaUsadaNum + fgtsNum)))}
                </strong>
              </div>
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

        <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          <Home size={18} /> Simular financiamento
        </button>
      </form>

      {/* ── Resultado ── */}
      {resultado && (
        <>
          <div className="card border-2 border-blue-200">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-3">Resultado da simulação</p>

            {/* Imóvel + entrada */}
            <div className="grid grid-cols-2 gap-3">
              <Destaque rotulo="Valor do imóvel" valor={formatCurrency(resultado.entrada.imovel)} />
              <Destaque rotulo="Entrada total" valor={formatCurrency(resultado.entrada.entradaTotal)} cor="text-emerald-600" />
            </div>
            {/* Detalhe da entrada */}
            <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-600 space-y-1">
              <div className="flex justify-between"><span>Recursos próprios</span><span>{formatCurrency(resultado.entrada.recursosProprios)}</span></div>
              <div className="flex justify-between"><span>Reserva utilizada</span><span>{formatCurrency(resultado.entrada.reservaUsada)}</span></div>
              <div className="flex justify-between"><span>FGTS</span><span>{formatCurrency(resultado.entrada.fgts)}</span></div>
            </div>

            {/* Financiado + sistema */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Destaque rotulo="Valor financiado" valor={formatCurrency(resultado.entrada.valorFinanciado)} cor="text-blue-600" />
              <Destaque
                rotulo="Sistema / Prazo"
                valor={resultado.sistema.toUpperCase()}
                sub={`${resultado.n} meses • ${fmtPct(resultado.taxaAnual, 2)} a.a.`}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Taxa mensal usada nos cálculos: <strong>{fmtPct(resultado.i * 100, 4)} a.m.</strong>
            </p>

            {/* Parcela(s) */}
            <div className="mt-4">
              {resultado.sistema === 'sac' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Destaque rotulo="1ª parcela" valor={formatCurrency(resultado.sac.primeira)} cor="text-blue-700" />
                    <Destaque rotulo="Última parcela" valor={formatCurrency(resultado.sac.ultima)} cor="text-blue-700" />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    No SAC as prestações <strong>diminuem ao longo do tempo</strong>. Parcela intermediária estimada:{' '}
                    <strong>{formatCurrency(resultado.sac.intermediaria)}</strong>.
                  </p>
                </>
              ) : (
                <Destaque rotulo="Parcela fixa" valor={formatCurrency(resultado.price.parcela)} cor="text-blue-700" />
              )}
            </div>

            {/* Juros e total */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Destaque rotulo="Juros totais estimados" valor={formatCurrency(resultado.escolhido.jurosTotais)} cor="text-red-500" />
              <Destaque rotulo="Total estimado pago" valor={formatCurrency(resultado.escolhido.totalPago)} />
            </div>

            {/* Reserva restante + comprometimento */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Destaque rotulo="Reserva restante" valor={formatCurrency(reservaRestante)} cor="text-emerald-600" />
              <Destaque
                rotulo="Comprometimento da renda"
                valor={pctRenda == null ? '—' : fmtPct(pctRenda, 0)}
                cor={corPct}
                sub={resultado.sistema === 'sac' ? 'pela 1ª parcela' : 'pela parcela'}
              />
            </div>

            {/* Alertas discretos */}
            {usoRelevanteReserva && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  Atenção: utilizar sua reserva de emergência na entrada reduz sua proteção para imprevistos.
                </p>
              </div>
            )}
            {pctRenda != null && pctRenda >= 30 && (
              <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  A parcela compromete uma parte elevada da sua renda ({fmtPct(pctRenda, 0)}). Avalie com calma antes de decidir.
                </p>
              </div>
            )}
          </div>

          {/* ── Comparar SAC × PRICE ── */}
          <Secao titulo="Comparar SAC e PRICE" icone={TrendingDown}
            aberta={secaoComparar} onToggle={() => setSecaoComparar(v => !v)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900 mb-2">SAC</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">1ª parcela</span><strong>{formatCurrency(resultado.sac.primeira)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Última parcela</span><strong>{formatCurrency(resultado.sac.ultima)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Juros totais</span><strong className="text-red-500">{formatCurrency(resultado.sac.jurosTotais)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Total pago</span><strong>{formatCurrency(resultado.sac.totalPago)}</strong></div>
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900 mb-2">PRICE</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Parcela</span><strong>{formatCurrency(resultado.price.parcela)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Juros totais</span><strong className="text-red-500">{formatCurrency(resultado.price.jurosTotais)}</strong></div>
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Total pago</span><strong>{formatCurrency(resultado.price.totalPago)}</strong></div>
                </div>
              </div>
            </div>
            <div className="mt-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-600">
              Diferença de juros: <strong>{formatCurrency(Math.abs(resultado.sac.jurosTotais - resultado.price.jurosTotais))}</strong>{' '}
              • Diferença no total pago: <strong>{formatCurrency(Math.abs(resultado.sac.totalPago - resultado.price.totalPago))}</strong>.
              <span className="block mt-1 text-gray-400">
                No SAC a 1ª parcela costuma ser maior e os juros totais menores; no PRICE a parcela é fixa. A melhor escolha depende do seu caso.
              </span>
            </div>
          </Secao>

          {/* ── E se eu amortizar? ── */}
          <Secao titulo="E se eu amortizar?" icone={PiggyBank}
            aberta={secaoAmortizar} onToggle={() => setSecaoAmortizar(v => !v)}>
            <div className="space-y-3">
              <div>
                <label className="label">Valor da amortização extra (R$)</label>
                <InputMoeda valor={amortExtra} onChangeValor={setAmortExtra} className="input" prefixo={null} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Em qual mês?</label>
                  <input type="number" min="1" max={resultado.n} inputMode="numeric" value={amortMes}
                    onChange={(e) => setAmortMes(e.target.value)} className="input" placeholder="Ex: 12" />
                </div>
                <div>
                  <label className="label">Objetivo</label>
                  <select value={amortModo} onChange={(e) => setAmortModo(e.target.value)} className="input">
                    <option value="prazo">Reduzir prazo</option>
                    <option value="parcela">Reduzir parcela</option>
                  </select>
                </div>
              </div>
              <button type="button" onClick={handleAmortizar} className="btn-secondary w-full">
                Calcular impacto
              </button>

              {amortResultado && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500">Economia de juros</span>
                    <strong className="text-emerald-600">{formatCurrency(amortResultado.economiaJuros)}</strong>
                  </div>
                  {amortResultado.modo === 'prazo' ? (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Prazo</span>
                      <strong>{amortResultado.novoPrazo} meses (−{amortResultado.mesesReduzidos})</strong>
                    </div>
                  ) : (
                    <div className="flex justify-between gap-2">
                      <span className="text-gray-500">Nova parcela {resultado.sistema === 'sac' ? '(1ª)' : ''}</span>
                      <strong>{amortResultado.novaParcela != null ? formatCurrency(amortResultado.novaParcela) : '—'}</strong>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    Estimativa simplificada aplicando a amortização no mês {amortResultado.mesAmortizacao}.
                  </p>
                </div>
              )}
            </div>
          </Secao>
        </>
      )}

      {/* Aviso legal */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Esta é uma simulação financeira para planejamento. O financiamento real pode incluir seguros,
          tarifas, indexadores, custos cartorários e condições específicas da instituição financeira.
        </p>
      </div>
    </div>
  )
}
