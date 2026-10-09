import React, { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, TrendingDown, Wallet, Loader2, Pencil, Eye, EyeOff } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { formatCurrency, exibirMoeda, hojeISO } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import HorizonteFinanceiro from '../components/HorizonteFinanceiro'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'

export default function Projecao() {
  const {
    projecao, carregando, resumoMes,
    // dados brutos para o Horizonte financeiro (fluxo de caixa diário)
    receitas, despesas, recorrentes, parcelamentos, cartoes, comprasCartao,
    faturasInformadas, reservaPct,
  } = useProjecao()

  // Saldo atual (movido da Home): reutiliza o MESMO mecanismo do Dashboard —
  // atualizarPreferenciasLimite({ saldo_base, saldo_base_data }). Nada de novo
  // cálculo: lê saldoDisponivelAgora/previsaoFimMes/compromissosFuturosMes já
  // derivados em resumoMes.
  const { perfil, atualizarPreferenciasLimite, somenteLeitura } = useAuth()
  const { ocultar, alternar } = useOcultarValores()
  const [modalSaldo, setModalSaldo] = useState(false)
  const [valorSaldo, setValorSaldo] = useState(0)
  const [salvandoSaldo, setSalvandoSaldo] = useState(false)
  const [erroSaldo, setErroSaldo] = useState('')

  useEffect(() => {
    if (modalSaldo) { setValorSaldo(Number(perfil?.saldo_base) || 0); setErroSaldo('') }
  }, [modalSaldo, perfil?.saldo_base])

  async function handleSalvarSaldo(e) {
    e?.preventDefault?.()
    if (valorSaldo < 0 || somenteLeitura) return
    setSalvandoSaldo(true); setErroSaldo('')
    try {
      await atualizarPreferenciasLimite({ saldo_base: valorSaldo, saldo_base_data: hojeISO() })
      setModalSaldo(false)
    } catch (err) {
      setErroSaldo(err?.message || 'Não foi possível salvar o saldo. Tente novamente.')
    } finally {
      setSalvandoSaldo(false)
    }
  }

  const saldoConfigurado = resumoMes?.saldoConfigurado
  const saldoDisponivelAgora = resumoMes?.saldoDisponivelAgora ?? 0
  const previsaoFimMes = resumoMes?.previsaoFimMes ?? 0
  const compromissosFuturosMes = resumoMes?.compromissosFuturosMes ?? 0



  const mediaSaldo = projecao.length
    ? projecao.reduce((acc, m) => acc + m.saldo, 0) / projecao.length
    : 0
  const piorMes = projecao.length
    ? projecao.reduce((prev, curr) => curr.saldo < prev.saldo ? curr : prev)
    : null
  const melhorMes = projecao.length
    ? projecao.reduce((prev, curr) => curr.saldo > prev.saldo ? curr : prev)
    : null
  const mesesNegativos = projecao.filter(m => m.saldo < 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Planejamento</h1>
        <p className="text-sm text-gray-500 mt-1">Saldo, resumo do mês, fluxo de caixa e previsão para os próximos 12 meses</p>
      </div>

      {/* Saldo atual (movido da Home): saldo disponível agora + Atualizar saldo +
          ocultar + previsão fim do mês + contas a pagar + nota da reserva.
          Mesmos valores de resumoMes — nada recalculado. */}
      {!carregando && (
        <div className="card">
          {saldoConfigurado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500">Saldo disponível agora</p>
                    <button
                      onClick={alternar}
                      aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
                      className="text-gray-400 hover:text-gray-700 p-0.5"
                    >
                      {ocultar ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className={`text-3xl font-bold leading-tight break-words ${saldoDisponivelAgora >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {exibirMoeda(saldoDisponivelAgora, ocultar)}
                  </p>
                </div>
                {!somenteLeitura && (
                  <button
                    onClick={() => setModalSaldo(true)}
                    className="flex items-center gap-1 text-xs font-medium text-marca hover:opacity-80 flex-shrink-0 mt-1"
                  >
                    <Pencil size={13} /> Atualizar saldo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-gray-50 rounded-xl p-3 min-w-0">
                  <p className="text-xs text-gray-400">Saldo previsto no fim do mês</p>
                  <p className={`text-lg font-bold leading-tight break-words ${previsaoFimMes >= 0 ? 'text-marca' : 'text-red-600'}`}>
                    {exibirMoeda(previsaoFimMes, ocultar)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 min-w-0">
                  <p className="text-xs text-gray-400">Contas a pagar no mês</p>
                  <p className="text-lg font-bold text-red-500 leading-tight break-words">{exibirMoeda(compromissosFuturosMes, ocultar)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                O saldo mostra o dinheiro que você já tem. A reserva de emergência é separada.
              </p>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">Informe seu saldo atual</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Diga quanto você tem disponível hoje para o app calcular seu dinheiro em tempo real.
                </p>
              </div>
              {!somenteLeitura && (
                <button onClick={() => setModalSaldo(true)}
                  className="btn-primary flex items-center justify-center gap-2 flex-shrink-0">
                  <Wallet size={16} /> Informar saldo
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resumo do mês (movido da Home): receitas, despesas e resultado previsto.
          Mesmos valores de resumoMes — sem recalcular nada. */}
      {!carregando && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Resumo do mês</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-500 truncate">Receitas</span>
                <span className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={18} className="text-green-600" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-words mt-2">{formatCurrency(resumoMes.receitaTotal)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{resumoMes.qtdReceitas} receita{resumoMes.qtdReceitas !== 1 ? 's' : ''}</p>
            </div>
            <div className="card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-500 truncate">Despesas</span>
                <span className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={18} className="text-red-500" />
                </span>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-words mt-2">{formatCurrency(resumoMes.despesaTotal)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{resumoMes.qtdDespesas} despesa{resumoMes.qtdDespesas !== 1 ? 's' : ''}</p>
            </div>
            <div className="card col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-500 truncate">Resultado previsto do mês</span>
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${resumoMes.sobraPrevista >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                  <Wallet size={18} className={resumoMes.sobraPrevista >= 0 ? 'text-blue-600' : 'text-red-600'} />
                </span>
              </div>
              <p className={`text-xl sm:text-2xl font-bold leading-tight break-words mt-2 ${resumoMes.sobraPrevista >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(resumoMes.sobraPrevista)}</p>
              <p className="text-xs text-gray-400 mt-0.5">Receitas menos compromissos do mês</p>
            </div>
          </div>
        </div>
      )}

      {/* Horizonte financeiro (fluxo de caixa diário) — movido da Home. Reusa o
          MESMO componente e dados; nenhuma fórmula alterada. */}
      {!carregando && projecao.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <BarChart2 size={18} className="text-violet-500 flex-shrink-0" />
            <span className="truncate">Horizonte financeiro</span>
          </h2>
          <HorizonteFinanceiro
            receitas={receitas}
            despesas={despesas}
            recorrentes={recorrentes}
            parcelamentos={parcelamentos}
            cartoes={cartoes}
            comprasCartao={comprasCartao}
            faturasInformadas={faturasInformadas}
            reservaPct={reservaPct}
            saldoInicial={resumoMes.saldoConfigurado ? resumoMes.saldoDisponivelAgora : 0}
          />
        </div>
      )}

      {carregando ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : projecao.length === 0 ? (
        <div className="card text-center py-16">
          <BarChart2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cadastre receitas e despesas para gerar a projeção.</p>
        </div>
      ) : (
        <>
          {/* Alerta se há meses negativos */}
          {mesesNegativos > 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <span className="text-red-500 text-lg leading-none">⚠️</span>
              <p className="text-sm text-red-700">
                <strong>{mesesNegativos} mês{mesesNegativos > 1 ? 'es' : ''} com saldo negativo</strong> na projeção.
                Considere revisar suas despesas ou parcelamentos.
              </p>
            </div>
          )}

          {/* Cards de destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Wallet size={18} className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Sobra média mensal</p>
              <p className={`text-xl font-bold ${mediaSaldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(mediaSaldo)}
              </p>
            </div>
            <div className="card text-center">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Melhor mês</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(melhorMes.saldo)}</p>
              <p className="text-xs text-gray-400">{melhorMes.mes}</p>
            </div>
            <div className="card text-center">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Mês mais apertado</p>
              <p className={`text-xl font-bold ${piorMes.saldo >= 0 ? 'text-red-500' : 'text-red-700'}`}>
                {formatCurrency(piorMes.saldo)}
              </p>
              <p className="text-xs text-gray-400">{piorMes.mes}</p>
            </div>
          </div>

          {/* Detalhamento mensal — tabela no desktop, cards no mobile */}
          <div className="card overflow-hidden">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Detalhamento mensal</h2>

            {/* Desktop (md+): tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-3 text-xs font-medium text-gray-500">Mês</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Receitas</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Despesas</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Sobra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projecao.map((m, i) => (
                    <tr key={i} className={m.ehMesAtual ? 'font-semibold bg-blue-50/50' : ''}>
                      <td className="py-2.5 text-gray-700">
                        {m.mes}
                        {m.ehMesAtual && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-green-600">{formatCurrency(m.receitas)}</td>
                      <td className="py-2.5 text-right text-red-500">{formatCurrency(m.despesas)}</td>
                      <td className={`py-2.5 text-right font-semibold ${m.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(m.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile (<md): cada mês como card vertical, sem scroll horizontal */}
            <div className="md:hidden space-y-2.5">
              {projecao.map((m, i) => {
                const positivo = m.saldo >= 0
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 ${m.ehMesAtual ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="capitalize font-semibold text-gray-800 text-sm">{m.mes}</span>
                      {m.ehMesAtual && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-x-3">
                      <div>
                        <p className="text-[11px] text-gray-400">Receitas</p>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(m.receitas)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Despesas</p>
                        <p className="text-sm font-semibold text-red-500">{formatCurrency(m.despesas)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Sobra</p>
                        <p className={`text-sm font-bold ${positivo ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(m.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Modal: informar/atualizar o saldo atual (movido da Home). Reutiliza o
          MESMO campo/handler (atualizarPreferenciasLimite). */}
      <Modal aberto={modalSaldo} onFechar={() => setModalSaldo(false)} titulo="Saldo atual">
        <form onSubmit={handleSalvarSaldo} className="space-y-4">
          <div>
            <label className="label">Quanto você tem disponível hoje?</label>
            <InputMoeda
              valor={valorSaldo}
              onChangeValor={setValorSaldo}
              className="input text-2xl font-bold text-center py-3"
              prefixo={null}
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              Informe o dinheiro que você possui disponível para utilizar.
              Não inclua sua reserva de emergência.
            </p>
          </div>
          {erroSaldo && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erroSaldo}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalSaldo(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" disabled={salvandoSaldo}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {salvandoSaldo ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar saldo'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
