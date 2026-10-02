import React, { useState } from 'react'
import { ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Calculator, Info, Loader2 } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { formatCurrency } from '../lib/utils'
import Modal from '../components/Modal'

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
  const Compra = compra.charAt(0).toUpperCase() + compra.slice(1)
  const { custoPorMes, mesesDeImpacto, sobraMesAtual, novaSobra,
          novosNegativo, mesesNegativosCom, classificacao, tipo, valorTotal } = res

  // ── À VISTA ──
  if (tipo === 'avista') {
    const falta = Math.max(0, (valorTotal ?? custoPorMes) - sobraMesAtual)
    const valorCompra = valorTotal ?? custoPorMes
    if (classificacao === 'saudavel') {
      return `${Compra} custa ${formatCurrency(valorCompra)}. ` +
        `Você tem ${formatCurrency(sobraMesAtual)} disponíveis e, após a compra, ainda sobrariam ` +
        `${formatCurrency(novaSobra)} no mês.`
    }
    if (classificacao === 'atencao') {
      return `${Compra} custa ${formatCurrency(valorCompra)}. ` +
        `Cabe no seu orçamento, mas o disponível cairia de ${formatCurrency(sobraMesAtual)} ` +
        `para ${formatCurrency(novaSobra)}, deixando pouca folga para imprevistos.`
    }
    // arriscado / não cabe
    return `Esta compra custa ${formatCurrency(valorCompra)}. ` +
      `Com base no seu orçamento atual, faltariam ${formatCurrency(falta)} para realizar essa compra ` +
      `sem comprometer o planejamento do mês. O orçamento ficaria em ${formatCurrency(novaSobra)}.`
  }

  // ── PARCELADA ──
  const impactoTexto = `adicionará ${formatCurrency(custoPorMes)} por mês durante ${mesesDeImpacto} meses`

  if (classificacao === 'saudavel') {
    return `${Compra} ${impactoTexto}. ` +
      `Sua sobra mensal passará de ${formatCurrency(sobraMesAtual)} para ${formatCurrency(novaSobra)} ` +
      `e nenhum dos próximos meses ficará negativo.`
  }

  if (classificacao === 'atencao') {
    return `${Compra} ${impactoTexto}. ` +
      `Sua sobra mensal passará de ${formatCurrency(sobraMesAtual)} para ${formatCurrency(novaSobra)}. ` +
      (mesesNegativosCom > 0
        ? `Atenção: ${mesesNegativosCom} mês(es) da projeção já apresentam saldo negativo.`
        : `Você ainda terá saldo positivo, mas com menos folga para imprevistos.`)
  }

  return `${Compra} ${impactoTexto}. ` +
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
// Conteúdo do resultado (reutilizado no desktop e no bottom sheet mobile)
// ─────────────────────────────────────────────
function ConteudoResultado({ resultado, config }) {
  const ehAvista = resultado.tipo === 'avista'
  const valorCompra = resultado.valorTotal ?? resultado.custoPorMes
  const falta = Math.max(0, valorCompra - resultado.sobraMesAtual)
  const orcamentoNegativo = resultado.novaSobra < 0

  // Título: para à vista que não cabe, usar "Não cabe no orçamento atual"
  const titulo = (ehAvista && resultado.classificacao === 'arriscado')
    ? 'Não cabe no orçamento atual'
    : config.label

  // Célula de métrica com bom contraste (rótulo escuro, valor forte)
  const Metric = ({ rotulo, valor, cor = 'text-gray-900' }) => (
    <div className="bg-white rounded-xl p-3 text-center shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{rotulo}</p>
      <p className={`text-base font-bold ${cor}`}>{valor}</p>
    </div>
  )

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <config.icon size={32} className={config.iconColor} />
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Resultado da simulação</p>
          <p className={`text-2xl font-bold ${config.color}`}>{titulo}</p>
        </div>
      </div>

      {/* Texto explicativo com contraste reforçado (gray-800 em vez de claro) */}
      <p className="text-sm text-gray-800 leading-relaxed mb-4">
        {gerarExplicacao(resultado, resultado.nomeCompra)}
      </p>

      {ehAvista ? (
        /* ── À VISTA ── */
        <div className="grid grid-cols-2 gap-3">
          <Metric rotulo="Valor da compra" valor={formatCurrency(valorCompra)} />
          <Metric rotulo="Disponível hoje" valor={formatCurrency(resultado.sobraMesAtual)} />
          <Metric
            rotulo="Valor que falta"
            valor={falta > 0 ? formatCurrency(falta) : '—'}
            cor={falta > 0 ? 'text-red-600' : 'text-green-600'}
          />
          <Metric
            rotulo="Impacto no orçamento"
            valor={formatCurrency(resultado.novaSobra)}
            cor={orcamentoNegativo ? 'text-red-600' : 'text-blue-600'}
          />
        </div>
      ) : (
        /* ── PARCELADA ── */
        <div className="grid grid-cols-2 gap-3">
          <Metric rotulo="Valor da parcela" valor={`${formatCurrency(resultado.custoPorMes)}/mês`} />
          <Metric rotulo="Sobra atual" valor={formatCurrency(resultado.sobraMesAtual)} />
          <Metric
            rotulo="Sobra após a parcela"
            valor={formatCurrency(resultado.novaSobra)}
            cor={resultado.novaSobra >= 0 ? 'text-blue-600' : 'text-red-600'}
          />
          <Metric rotulo="Meses impactados" valor={`${resultado.mesesDeImpacto}`} />
        </div>
      )}

      {/* À vista: destaque de orçamento negativo. */}
      {ehAvista && orcamentoNegativo && (
        <div className="mt-3 flex items-center gap-2 bg-red-100 rounded-xl px-3 py-2">
          <XCircle size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">
            Após a compra, o orçamento do mês ficaria em {formatCurrency(resultado.novaSobra)}.
          </p>
        </div>
      )}

      {/* Parcelada: mantém a análise da projeção dos meses futuros. */}
      {!ehAvista && resultado.mesesNegativosCom > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-red-100 rounded-xl px-3 py-2">
          <XCircle size={14} className="text-red-600 flex-shrink-0" />
          <p className="text-xs text-red-800 font-medium">
            {resultado.mesesNegativosCom} mês(es) com saldo negativo na projeção após esta compra
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-4 text-center italic">
        Simulação de orçamento — não constitui aconselhamento financeiro profissional.
      </p>
    </>
  )
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
  // No mobile, o resultado abre em bottom sheet (Modal). No desktop, fica inline.
  const [mostrarSheet, setMostrarSheet] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setResultado(null)
    setMostrarSheet(false)
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
    if (sim) {
      // tipo e valorTotal são apenas metadados de APRESENTAÇÃO (não entram no cálculo)
      setResultado({ ...sim, nomeCompra: form.nome, tipo: form.tipo, valorTotal: valorNum })
      setMostrarSheet(true) // abre o sheet no mobile; no desktop é ignorado (inline)
    }
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

      {/* Resultado — DESKTOP (md+): inline abaixo do formulário, como antes */}
      {resultado && config && (
        <div className={`hidden md:block card border-2 ${config.border} ${config.bg}`}>
          <ConteudoResultado resultado={resultado} config={config} />
        </div>
      )}

      {/* Resultado — MOBILE (<md): bottom sheet sobre a tela, com scroll interno */}
      <div className="md:hidden">
        {resultado && config && (
          <Modal
            aberto={mostrarSheet}
            onFechar={() => setMostrarSheet(false)}
            titulo="Resultado da simulação"
          >
            <div className={`-m-5 p-5 ${config.bg}`}>
              <ConteudoResultado resultado={resultado} config={config} />
              <button
                onClick={() => setMostrarSheet(false)}
                className="btn-secondary w-full mt-4"
              >
                Fechar
              </button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
