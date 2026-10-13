import React, { useState } from 'react'
import { Car, Info, AlertTriangle, PiggyBank, ChevronDown, ChevronUp, Fuel, Wallet } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import InputMoeda from '../components/InputMoeda'
import DestaqueValor from '../components/DestaqueValor'
import CadastrarNoPlanejamento from '../components/CadastrarNoPlanejamento'
import SimuladorAmortizacao from '../components/SimuladorAmortizacao'
import {
  calcularPrice, comprometimentoRenda, calcularCustosVeiculoMensais,
  calcularCustoVeiculoPeriodo, estimarIpvaAnual, estimarSeguroAnual, IPVA_ALIQUOTAS_UF,
} from '../lib/financiamento'

const fmtPct = (v, casas = 0) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`

// Prazos comuns de financiamento de veículo (+ opção manual).
const PRAZOS = [12, 24, 36, 48, 60]

// UFs em ordem para o seletor de IPVA (a tabela de alíquotas vem da lib).
const UFS = Object.keys(IPVA_ALIQUOTAS_UF).sort()

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
  const [taxa, setTaxa] = useState('1,9')
  const [taxaPeriodo, setTaxaPeriodo] = useState('mensal') // 'mensal' | 'anual'

  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  // ── Custos do veículo (opcionais) ──
  const [secaoCustos, setSecaoCustos] = useState(false)
  const [uf, setUf] = useState('SP')
  const [ipvaAnual, setIpvaAnual] = useState('')         // editável; preenchível pela estimativa
  const [seguroValor, setSeguroValor] = useState('')
  const [seguroPeriodo, setSeguroPeriodo] = useState('anual') // 'mensal' | 'anual'
  const [manutencaoValor, setManutencaoValor] = useState('')
  const [manutencaoPeriodo, setManutencaoPeriodo] = useState('mensal') // 'mensal' | 'anual'
  const [combustivelMensal, setCombustivelMensal] = useState('')
  const [licenciamentoAnual, setLicenciamentoAnual] = useState('')
  const [outrosMensal, setOutrosMensal] = useState('')

  // ── Amortização (reutiliza o simulador compartilhado) ──
  const [secaoAmort, setSecaoAmort] = useState(false)

  // ── "E se eu der uma entrada maior?" ──
  const [secaoEntrada, setSecaoEntrada] = useState(false)
  const [entradaMaior, setEntradaMaior] = useState('')
  const [compEntrada, setCompEntrada] = useState(null)

  // Taxa informada em % — convertida para mensal (decimal) conforme o período.
  // Anual → mensal equivalente por juros compostos (padrão de mercado).
  const taxaInformada = parseFloat(String(taxa).replace(',', '.')) || 0
  const taxaMensalDecimal = taxaPeriodo === 'anual'
    ? (taxaInformada > 0 ? Math.pow(1 + taxaInformada / 100, 1 / 12) - 1 : 0)
    : taxaInformada / 100
  const prazoFinal = prazoManual ? Math.max(1, Math.floor(Number(prazoManualValor) || 0)) : prazo

  function limpar() { setResultado(null); setCompEntrada(null); setErro(''); setSecaoEntrada(false) }

  // Calcula uma simulação PRICE para um dado par (entrada) — reutilizável.
  function simular(valorVeic, entradaVal) {
    const financiado = Math.max(0, valorVeic - entradaVal)
    const i = taxaMensalDecimal
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

  // Estimativa de IPVA conforme a UF e o valor do veículo (editável no campo).
  const ipvaEstimativa = estimarIpvaAnual({ valorVeiculo: Number(valorVeiculo) || 0, uf })
  const seguroEstimativa = estimarSeguroAnual({ valorVeiculo: Number(valorVeiculo) || 0 })

  function usarEstimativaIpva() {
    if (ipvaEstimativa.ipva > 0) setIpvaAnual(Math.round(ipvaEstimativa.ipva))
  }
  function usarEstimativaSeguro() {
    if (seguroEstimativa > 0) { setSeguroValor(Math.round(seguroEstimativa)); setSeguroPeriodo('anual') }
  }

  function handleSimular(e) {
    e.preventDefault()
    setErro('')
    const veic = Number(valorVeiculo) || 0
    const ent = Number(entrada) || 0
    if (veic <= 0) { setErro('Informe o valor do veículo.'); return }
    if (ent > veic) { setErro('A entrada não pode ser maior que o valor do veículo.'); return }
    if (prazoFinal <= 0) { setErro('Informe o prazo em meses.'); return }
    if (taxaInformada <= 0) { setErro('Informe a taxa de juros.'); return }

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

  // Custos mensais de uso (opcionais): converte anuais → mensais. Independente
  // da simulação da parcela, atualiza em tempo real conforme o usuário digita.
  const custosMensais = calcularCustosVeiculoMensais({
    seguroValor: Number(seguroValor) || 0,
    seguroPeriodo,
    manutencaoValor: Number(manutencaoValor) || 0,
    manutencaoPeriodo,
    ipvaAnual: Number(ipvaAnual) || 0,
    licenciamentoAnual: Number(licenciamentoAnual) || 0,
    combustivelMensal: Number(combustivelMensal) || 0,
    outrosMensal: Number(outrosMensal) || 0,
  })

  // Consolidação do período (parcela + uso ao longo do prazo). Só com resultado.
  const periodo = resultado
    ? calcularCustoVeiculoPeriodo({
        prazoMeses: resultado.n,
        entrada: resultado.entrada,
        parcelaMensal: resultado.parcela,
        jurosTotais: resultado.jurosTotais,
        custosUsoMensal: custosMensais.total,
        valorVeiculo: resultado.veic,
      })
    : null

  // Custo mensal total = parcela + custos de uso (só quando há simulação).
  const custoMensalTotal = periodo ? periodo.custoMensalTotal : null

  // Comprometimento da renda pelo CUSTO MENSAL TOTAL (parcela + manutenção/uso).
  const pctRendaCusto = resultado ? comprometimentoRenda(custoMensalTotal, rendaMensal) : null
  const corPctCusto = pctRendaCusto == null ? 'text-gray-900'
    : pctRendaCusto >= 40 ? 'text-red-600'
    : pctRendaCusto >= 30 ? 'text-amber-600'
    : 'text-green-600'

  // "Cabe no meu orçamento?" — compara o custo mensal total com a sobra mensal
  // já calculada (receitas − despesas − parcelas − faturas), sem duplicar dados.
  const orcamentoDisponivel = Number(resumoMes?.sobraPrevista) || 0
  const sobraAposCusto = resultado ? orcamentoDisponivel - custoMensalTotal : null

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
          <Car size={18} className="text-marca" /> Dados do financiamento
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
                  !prazoManual && prazo === p ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                }`}>
                {p}x
              </button>
            ))}
            <button type="button"
              onClick={() => { setPrazoManual(true); limpar() }}
              className={`px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                prazoManual ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
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
          <label className="label">Taxa de juros</label>
          <div className="flex gap-2">
            <input type="text" inputMode="decimal" value={taxa}
              onChange={(e) => { setTaxa(e.target.value); limpar() }}
              className="input flex-1" placeholder={taxaPeriodo === 'mensal' ? 'Ex: 1,9' : 'Ex: 25'} />
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
          <p className="text-xs text-gray-500 mt-1">
            Informe a taxa oferecida pelo banco ou financeira {taxaPeriodo === 'mensal' ? '(% ao mês)' : '(% ao ano)'}.
          </p>
          {taxaPeriodo === 'anual' && taxaInformada > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              Equivale a <strong>{fmtPct(taxaMensalDecimal * 100, 2)} ao mês</strong>.
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">Sistema PRICE (parcela fixa), padrão no financiamento de veículos.</p>
        </div>

        {/* ── Custos do veículo (opcionais): IPVA, seguro, manutenção, etc. ── */}
        <div className="pt-2 border-t border-gray-100">
          <button type="button" onClick={() => setSecaoCustos(v => !v)}
            className="w-full flex items-center justify-between gap-2 text-left">
            <span className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Fuel size={16} className="text-marca" /> Custos do veículo (opcional)
            </span>
            {secaoCustos ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
          </button>
          {secaoCustos && (
            <div className="mt-3 space-y-3">
              {/* IPVA: estimativa por estado + edição manual */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">IPVA anual</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Estado (UF)</label>
                    <select value={uf} onChange={(e) => { setUf(e.target.value); limpar() }} className="input">
                      {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Valor (R$)</label>
                    <InputMoeda valor={ipvaAnual} onChangeValor={setIpvaAnual} className="input" prefixo={null} />
                  </div>
                </div>
                {Number(valorVeiculo) > 0 && ipvaEstimativa.ipva > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-400">
                      Estimativa {uf} ({fmtPct(ipvaEstimativa.aliquota, 1)}): <strong>{formatCurrency(ipvaEstimativa.ipva)}</strong>
                    </span>
                    <button type="button" onClick={usarEstimativaIpva} className="text-marca font-medium hover:underline flex-shrink-0">
                      Usar estimativa
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400">Estimativa conforme a alíquota do estado para carro de passeio; edite se necessário.</p>
              </div>

              {/* Seguro: manual ou estimativa */}
              <div className="rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-medium text-gray-900">Seguro</p>
                <InputMoeda valor={seguroValor} onChangeValor={setSeguroValor} className="input" prefixo={null} />
                <div className="flex gap-2">
                  {[{ id: 'mensal', nome: 'Mensal' }, { id: 'anual', nome: 'Anual' }].map(op => (
                    <button key={op.id} type="button" onClick={() => setSeguroPeriodo(op.id)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        seguroPeriodo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                      }`}>
                      {op.nome}
                    </button>
                  ))}
                </div>
                {Number(valorVeiculo) > 0 && seguroEstimativa > 0 && (
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-gray-400">Estimativa (~4% a.a.): <strong>{formatCurrency(seguroEstimativa)}</strong>/ano</span>
                    <button type="button" onClick={usarEstimativaSeguro} className="text-marca font-medium hover:underline flex-shrink-0">
                      Usar estimativa
                    </button>
                  </div>
                )}
              </div>

              {/* Manutenção preventiva: mensal ou anual */}
              <div>
                <label className="label">Manutenção preventiva</label>
                <InputMoeda valor={manutencaoValor} onChangeValor={setManutencaoValor} className="input" prefixo={null} />
                <div className="flex gap-2 mt-2">
                  {[{ id: 'mensal', nome: 'Mensal' }, { id: 'anual', nome: 'Anual' }].map(op => (
                    <button key={op.id} type="button" onClick={() => setManutencaoPeriodo(op.id)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium border-2 transition-all ${
                        manutencaoPeriodo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                      }`}>
                      {op.nome}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Combustível mensal (R$)</label>
                <InputMoeda valor={combustivelMensal} onChangeValor={setCombustivelMensal} className="input" prefixo={null} />
              </div>
              <div>
                <label className="label">Licenciamento anual (R$)</label>
                <InputMoeda valor={licenciamentoAnual} onChangeValor={setLicenciamentoAnual} className="input" prefixo={null} />
              </div>
              <div>
                <label className="label">Outros custos mensais (R$)</label>
                <InputMoeda valor={outrosMensal} onChangeValor={setOutrosMensal} className="input" prefixo={null} />
                <p className="text-xs text-gray-400 mt-1">Opcional: estacionamento, pedágios, lavagem etc.</p>
              </div>
              <p className="text-xs text-gray-400">
                Os valores anuais (IPVA, licenciamento e seguro/manutenção quando anuais) são convertidos automaticamente para o equivalente mensal.
              </p>
            </div>
          )}
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

        <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          <Car size={18} /> Simular financiamento
        </button>
      </form>

      {/* ── Resultado ── */}
      {resultado && (
        <>
          <div className="card border-2 border-marca">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-3">Resultado da simulação</p>

            <div className="grid grid-cols-2 gap-3">
              <DestaqueValor rotulo="Veículo" valor={formatCurrency(resultado.veic)} />
              <DestaqueValor rotulo="Entrada" valor={formatCurrency(resultado.entrada)} cor="text-emerald-600" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DestaqueValor rotulo="Valor financiado" valor={formatCurrency(resultado.financiado)} cor="text-marca" />
              <DestaqueValor rotulo="Parcela" valor={`${resultado.n}x de ${formatCurrency(resultado.parcela)}`} cor="text-marca" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DestaqueValor rotulo="Juros totais" valor={formatCurrency(resultado.jurosTotais)} cor="text-red-500" />
              <DestaqueValor rotulo="Total pago pelo veículo" valor={formatCurrency(resultado.totalPagoVeiculo)} />
            </div>
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

          {/* ── Resumo financeiro: quanto o carro custa por mês ── */}
          <div className="card border-2 border-marca">
            <h3 className="text-base font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Fuel size={18} className="text-marca" /> Quanto esse carro realmente vai custar por mês?
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Separamos a parcela do financiamento dos custos de manutenção e utilização.
            </p>

            {/* Parcela do financiamento */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <div className="flex justify-between gap-2 text-sm">
                <span className="text-gray-600 font-medium">Parcela do financiamento</span>
                <strong className="text-marca">{formatCurrency(resultado.parcela)}</strong>
              </div>
            </div>

            {/* Custos de manutenção e utilização (detalhados) */}
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">Manutenção e utilização</p>
              <div className="space-y-1.5 text-sm">
                {custosMensais.ipva > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">IPVA (anual ÷ 12)</span><strong className="text-gray-900">{formatCurrency(custosMensais.ipva)}</strong></div>
                )}
                {custosMensais.seguro > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Seguro{seguroPeriodo === 'anual' ? ' (anual ÷ 12)' : ''}</span><strong className="text-gray-900">{formatCurrency(custosMensais.seguro)}</strong></div>
                )}
                {custosMensais.manutencao > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Manutenção{manutencaoPeriodo === 'anual' ? ' (anual ÷ 12)' : ''}</span><strong className="text-gray-900">{formatCurrency(custosMensais.manutencao)}</strong></div>
                )}
                {custosMensais.combustivel > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Combustível</span><strong className="text-gray-900">{formatCurrency(custosMensais.combustivel)}</strong></div>
                )}
                {custosMensais.licenciamento > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Licenciamento (anual ÷ 12)</span><strong className="text-gray-900">{formatCurrency(custosMensais.licenciamento)}</strong></div>
                )}
                {custosMensais.outros > 0 && (
                  <div className="flex justify-between gap-2"><span className="text-gray-500">Outros</span><strong className="text-gray-900">{formatCurrency(custosMensais.outros)}</strong></div>
                )}
                {custosMensais.total === 0 && (
                  <p className="text-xs text-gray-400">Nenhum custo de uso informado. Preencha "Custos do veículo" acima para uma estimativa completa.</p>
                )}
                {custosMensais.total > 0 && (
                  <div className="flex justify-between gap-2 pt-1.5 border-t border-gray-200">
                    <span className="text-gray-600 font-medium">Subtotal de uso</span>
                    <strong className="text-gray-900">{formatCurrency(custosMensais.total)}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Total mensal */}
            <div className="mt-3">
              <DestaqueValor
                rotulo="Custo mensal total"
                valor={formatCurrency(custoMensalTotal)}
                cor="text-marca"
                sub="parcela + manutenção e utilização"
              />
            </div>

            {/* Comprometimento da renda pelo custo total */}
            <div className="mt-3">
              <DestaqueValor
                rotulo="Comprometimento da renda"
                valor={pctRendaCusto == null ? '—' : fmtPct(pctRendaCusto, 0)}
                cor={corPctCusto}
                sub="pelo custo mensal total"
              />
            </div>
            {pctRendaCusto != null && pctRendaCusto >= 30 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  O custo mensal do veículo compromete uma parte elevada da sua renda ({fmtPct(pctRendaCusto, 0)}). Avalie com calma — a simulação continua disponível.
                </p>
              </div>
            )}
          </div>

          {/* ── Custo total estimado no período + cabe no orçamento ── */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3">Custo total no período</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Entrada</span>
                <strong className="text-gray-900">{formatCurrency(resultado.entrada)}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Parcelas ({periodo.prazoMeses}x)</span>
                <strong className="text-gray-900">{formatCurrency(periodo.totalParcelas)}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Juros do financiamento</span>
                <strong className="text-red-500">{formatCurrency(periodo.jurosTotais)}</strong>
              </div>
              {periodo.totalUsoPeriodo > 0 && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Manutenção e uso ({periodo.prazoMeses} meses)</span>
                  <strong className="text-gray-900">{formatCurrency(periodo.totalUsoPeriodo)}</strong>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Custo total estimado</span>
                <strong className="text-marca">{formatCurrency(periodo.custoTotalPeriodo)}</strong>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Soma a entrada, todas as parcelas e os custos de manutenção/uso ao longo de {periodo.prazoMeses} meses. Sem recontar valores já incluídos.
            </p>
          </div>

          {/* ── Cabe no meu orçamento? ── */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" /> Cabe no meu orçamento?
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Sobra mensal atual</span>
                <strong className="text-gray-900">{formatCurrency(orcamentoDisponivel)}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Custo mensal do veículo</span>
                <strong className="text-gray-900">{formatCurrency(custoMensalTotal)}</strong>
              </div>
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Sobraria por mês</span>
                <strong className={sobraAposCusto >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(sobraAposCusto)}
                </strong>
              </div>
            </div>
            {sobraAposCusto < 0 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  O custo mensal ultrapassa a sua sobra mensal atual. Reveja o orçamento antes de assumir o financiamento.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Estimativa com base na sua sobra mensal (receitas − despesas − parcelas − faturas), sem duplicar despesas já cadastradas.
            </p>

            {/* Cadastrar no planejamento (opcional, com confirmação) */}
            <div className="mt-4 pt-3 border-t border-gray-100">
              <CadastrarNoPlanejamento
                descricao={`Financiamento veículo${resultado.veic > 0 ? ` ${formatCurrency(resultado.veic)}` : ''}`}
                valorTotal={resultado.totalParcelas}
                numeroParcelas={resultado.n}
              />
            </div>
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
                    <DestaqueValor rotulo="Nova parcela" valor={`${compEntrada.n}x de ${formatCurrency(compEntrada.parcela)}`} cor="text-marca" />
                    <DestaqueValor rotulo="Novo valor financiado" valor={formatCurrency(compEntrada.financiado)} cor="text-marca" />
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

          {/* ── Simular amortização (reutiliza o componente compartilhado) ── */}
          <div className="card">
            <button type="button" onClick={() => setSecaoAmort(v => !v)}
              className="w-full flex items-center justify-between gap-2 text-left">
              <span className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <PiggyBank size={18} className="text-marca" /> Simular amortização
              </span>
              {secaoAmort ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>
            {secaoAmort && (
              <div className="mt-4">
                <SimuladorAmortizacao
                  inicial={{
                    saldo: Math.round(resultado.financiado),
                    parcelasRestantes: resultado.n,
                    prestacao: Math.round(resultado.parcela),
                    sistema: 'price',
                    taxa: String(taxaMensalDecimal ? (taxaMensalDecimal * 100).toFixed(2).replace('.', ',') : ''),
                    taxaPeriodo: 'mensal',
                  }}
                />
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
