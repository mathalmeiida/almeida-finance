import React, { useState } from 'react'
import { ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Calculator, Info, Loader2 } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { formatCurrency } from '../lib/utils'

// ─────────────────────────────────────────────
// Motor de simulação (usa dados reais)
// ─────────────────────────────────────────────
function simularCompra({ projecao, valorTotal, tipo, numeroParcelas }) {
  if (!projecao || projecao.length === 0) return null

  const custoPorMes = tipo === 'avista' ? valorTotal : valorTotal / numeroParcelas
  const mesesDeImpacto = tipo === 'avista' ? 1 : numeroParcelas

  // Projeção SEM a compra
  const semCompra = projecao.map(m => ({ ...m }))

  // Projeção COM a compra
  const comCompra = projecao.map((m, i) => {
    const temImpacto = i < mesesDeImpacto
    return {
      ...m,
      despesas: temImpacto ? m.despesas + custoPorMes : m.despesas,
      saldo: temImpacto ? m.saldo - custoPorMes : m.saldo,
    }
  })

  // Indicadores
  const sobraMesAtual = semCompra[0]?.saldo ?? 0
  const novaSobra = comCompra[0]?.saldo ?? 0
  const mesesNegativosSem = semCompra.filter(m => m.saldo < 0).length
  const mesesNegativosCom = comCompra.filter(m => m.saldo < 0).length
  const novosNegativo = mesesNegativosCom - mesesNegativosSem
  const percentualConsumo = sobraMesAtual > 0 ? (custoPorMes / sobraMesAtual) * 100 : 100
  const piorSaldoCom = Math.min(...comCompra.map(m => m.saldo))

  // Classificação conforme regras do planejamento aprovado
  let classificacao = 'saudavel'
  if (mesesNegativosCom > 0 && novosNegativo > 0) {
    classificacao = 'arriscado'
  } else if (
    percentualConsumo > 50 ||
    novaSobra < 300 ||
    piorSaldoCom < 0
  ) {
    classificacao = 'atencao'
  }

  return {
    custoPorMes,
    mesesDeImpacto,
    sobraMesAtual,
    novaSobra,
    percentualConsumo,
    mesesNegativosCom,
    novosNegativo,
    piorSaldoCom,
    classificacao,
    comCompra,
  }
}

// ─────────────────────────────────────────────
// Gerador de explicação em linguagem natural
// ─────────────────────────────────────────────
function gerarExplicacao(res, nome) {
  const compra = nome || 'esta compra'
  const { custoPorMes, mesesDeImpacto, sobraMesAtual, novaSobra,
          novosNegativo, mesesNegativosCom, classificacao } = res

  const impactoTexto = mesesDeImpacto > 1
    ? `adicionará ${formatCurrency(custoPorMes)} por mês durante ${mesesDeImpacto} meses`
    : `custará ${formatCurrency(custoPorMes)} à vista`

  if (classificacao === 'saudavel') {
    return `${compra.charAt(0).toUpperCase() + compra.slice(1)} ${impactoTexto}. ` +
      `Sua sobra mensal passará de ${formatCurrency(sobraMesAtual)} para ${formatCurrency(novaSobra)} ` +
      `e nenhum dos próximos meses ficará negativo.`
  }

  if (classificacao === 'atencao') {
    return `${compra.charAt(0).toUpperCase() + compra.slice(1)} ${impactoTexto}. ` +
      `Sua sobra mensal passará de ${formatCurrency(sobraMesAtual)} para ${formatCurrency(novaSobra)}. ` +
      (mesesNegativosCom > 0
        ? `Atenção: ${mesesNegativosCom} mês(es) da projeção já apresentam saldo negativo.`
        : `Você ainda terá saldo positivo, mas com menos folga para imprevistos.`)
  }

  return `${compra.charAt(0).toUpperCase() + compra.slice(1)} ${impactoTexto}. ` +
    `Isso tornará ${novosNegativo} mês(es) negativo(s) no seu orçamento. ` +
    `A sobra cairia de ${formatCurrency(sobraMesAtual)} para ${formatCurrency(novaSobra)}. ` +
    `Recomendamos revisar o valor, as condições ou adiar a compra.`
}

const resultConfig = {
  saudavel: {
    label: 'Saudável',
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconColor: 'text-green-500',
  },
  atencao: {
    label: 'Atenção',
    icon: AlertTriangle,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconColor: 'text-yellow-500',
  },
  arriscado: {
    label: 'Arriscado',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
  },
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
export default function PossoComprar() {
  const { projecao, carregando, resumoMes } = useProjecao()

  const [form, setForm] = useState({
    nome: '',
    valor: '',
    tipo: 'avista',
    parcelas: '12',
  })
  const [resultado, setResultado] = useState(null)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setResultado(null)
  }

  function handleSimular(e) {
    e.preventDefault()
    const valorNum = parseFloat(form.valor.replace(',', '.'))
    if (!valorNum || valorNum <= 0) return

    const sim = simularCompra({
      projecao,
      valorTotal: valorNum,
      tipo: form.tipo,
      numeroParcelas: parseInt(form.parcelas),
    })
    if (sim) setResultado({ ...sim, nomeCompra: form.nome })
  }

  const config = resultado ? resultConfig[resultado.classificacao] : null
  const semDados = !carregando && resumoMes.receitaTotal === 0 && resumoMes.despesaTotal === 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posso Comprar?</h1>
        <p className="text-sm text-gray-500 mt-1">Simule o impacto de uma compra no seu orçamento</p>
      </div>

      {/* Aviso legal */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Esta é uma <strong>simulação de orçamento</strong> baseada nos seus dados cadastrados.
          Não se trata de aconselhamento financeiro profissional.
        </p>
      </div>

      {/* Aviso sem dados */}
      {semDados && (
        <div className="flex items-start gap-2.5 bg-yellow-50 border border-yellow-100 rounded-xl p-3">
          <AlertTriangle size={16} className="text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700">
            Nenhuma receita ou despesa cadastrada. A simulação ficará mais precisa depois de você cadastrar seus dados financeiros.
          </p>
        </div>
      )}

      {/* Resumo do orçamento atual */}
      {!carregando && !semDados && (
        <div className="card bg-gray-50 border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Seu orçamento atual</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-400">Receitas</p>
              <p className="text-sm font-bold text-green-600">{formatCurrency(resumoMes.receitaTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Despesas</p>
              <p className="text-sm font-bold text-red-500">{formatCurrency(resumoMes.despesaTotal + resumoMes.parcelasTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Sobra</p>
              <p className={`text-sm font-bold ${resumoMes.sobraPrevista >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(resumoMes.sobraPrevista)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calculator size={18} className="text-blue-600" />
          Dados da compra
        </h2>

        {carregando ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={22} className="animate-spin text-blue-500" />
            <span className="ml-2 text-sm text-gray-500">Carregando seus dados...</span>
          </div>
        ) : (
          <form onSubmit={handleSimular} className="space-y-4">
            <div>
              <label className="label">Nome da compra <span className="text-gray-400">(opcional)</span></label>
              <input type="text" name="nome" value={form.nome} onChange={handleChange}
                placeholder="Ex: Notebook, Geladeira, Viagem..." className="input" />
            </div>

            <div>
              <label className="label">Valor total (R$)</label>
              <input type="number" name="valor" value={form.valor} onChange={handleChange}
                placeholder="0,00" min="0" step="0.01" className="input" required />
            </div>

            <div>
              <label className="label">Forma de pagamento</label>
              <div className="flex gap-3">
                {['avista', 'parcelado'].map(opcao => (
                  <label key={opcao} className={`flex-1 flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium ${
                    form.tipo === opcao ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                    <input type="radio" name="tipo" value={opcao} checked={form.tipo === opcao}
                      onChange={handleChange} className="hidden" />
                    {opcao === 'avista' ? 'À vista' : 'Parcelado'}
                  </label>
                ))}
              </div>
            </div>

            {form.tipo === 'parcelado' && (
              <div>
                <label className="label">Número de parcelas</label>
                <select name="parcelas" value={form.parcelas} onChange={handleChange} className="input">
                  {[2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
                {form.valor && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Parcela estimada: {formatCurrency(parseFloat(form.valor || 0) / parseInt(form.parcelas))} / mês
                  </p>
                )}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
              <ShoppingCart size={18} />
              Simular agora
            </button>
          </form>
        )}
      </div>

      {/* Resultado */}
      {resultado && config && (
        <div className={`card border-2 ${config.border} ${config.bg}`}>
          <div className="flex items-center gap-3 mb-4">
            <config.icon size={32} className={config.iconColor} />
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Resultado da simulação</p>
              <p className={`text-2xl font-bold ${config.color}`}>{config.label}</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed mb-4">
            {gerarExplicacao(resultado, resultado.nomeCompra)}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Custo por mês</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(resultado.custoPorMes)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Nova sobra mensal</p>
              <p className={`text-base font-bold ${resultado.novaSobra >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(resultado.novaSobra)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">Sobra atual</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(resultado.sobraMesAtual)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 mb-1">% da sobra consumida</p>
              <p className={`text-base font-bold ${
                resultado.percentualConsumo > 80 ? 'text-red-600' :
                resultado.percentualConsumo > 50 ? 'text-yellow-600' : 'text-green-600'}`}>
                {Math.min(100, resultado.percentualConsumo).toFixed(0)}%
              </p>
            </div>
          </div>

          {resultado.mesesNegativosCom > 0 && (
            <div className="mt-3 flex items-center gap-2 bg-red-100 rounded-xl px-3 py-2">
              <XCircle size={14} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">
                {resultado.mesesNegativosCom} mês(es) com saldo negativo na projeção após esta compra
              </p>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-4 text-center italic">
            Simulação de orçamento — não constitui aconselhamento financeiro profissional.
          </p>
        </div>
      )}
    </div>
  )
}
