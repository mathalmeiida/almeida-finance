import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Calculator, Info, Loader2,
  TrendingUp, Plus, RotateCcw, Home, Car
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import SimuladorFinanciamento from './SimuladorFinanciamento'
import SimuladorAutomovel from './SimuladorAutomovel'

// Dias restantes no mês (inclui hoje) — mesma regra usada na Home para o
// "disponível por dia". Reutilizada aqui para não criar cálculo conflitante.
function diasRestantesNoMes(ref = new Date()) {
  const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
  return ultimoDia - ref.getDate() + 1
}

// Classifica por PERCENTUAL RESTANTE do disponível após a compra.
//  verde   = restante >= 50%
//  amarelo = 20% <= restante < 50%
//  vermelho= restante < 20% OU saldo negativo OU disponível atual <= 0
function classificarPorRestante(disponivelAntes, disponivelDepois) {
  if (disponivelAntes <= 0) return 'vermelho'
  if (disponivelDepois < 0) return 'vermelho'
  const restante = (disponivelDepois / disponivelAntes) * 100
  if (restante >= 50) return 'verde'
  if (restante >= 20) return 'amarelo'
  return 'vermelho'
}

const PESO = { verde: 0, amarelo: 1, vermelho: 2 }
const piorEntre = (a, b) => (PESO[b] > PESO[a] ? b : a)

// ─────────────────────────────────────────────
// Motor de simulação — reutiliza a projeção existente (projecao[].disponivel,
// que é receita − compromissos − reserva). NÃO altera cálculos da Home.
// ─────────────────────────────────────────────
function simularCompra({ projecao, valorTotal, tipo, numeroParcelas, saldoAgora, reservaAtual = 0 }) {
  if (!projecao || projecao.length === 0) return null
  const dias = diasRestantesNoMes()

  if (tipo === 'avista') {
    const mesAtual = projecao[0]
    // Compra à vista é feita HOJE → a referência principal é o dinheiro
    // realmente disponível agora (quando o usuário informou o saldo). Receita
    // futura NÃO conta como já recebida. Fallback: disponível do mês (projeção).
    const temSaldo = saldoAgora != null
    const disponivelAntes = temSaldo ? saldoAgora : (mesAtual?.disponivel ?? 0)
    const saldoAntes = mesAtual?.saldo ?? 0 // antes da reserva (fallback)
    const disponivelDepois = disponivelAntes - valorTotal

    const classificacao = classificarPorRestante(disponivelAntes, disponivelDepois)
    const pctConsumido = disponivelAntes > 0
      ? Math.min(100, (valorTotal / disponivelAntes) * 100)
      : 100
    const pctRestante = disponivelAntes > 0
      ? Math.max(0, (disponivelDepois / disponivelAntes) * 100)
      : 0
    // "Depende da reserva": a compra não cabe no disponível de hoje (que já
    // exclui a reserva), mas caberia se o usuário usasse a reserva acumulada.
    const dependeReserva = temSaldo
      ? (disponivelDepois < 0 && reservaAtual > 0)
      : (disponivelDepois < 0 && (saldoAntes - valorTotal) >= 0)
    const falta = Math.max(0, valorTotal - disponivelAntes)
    const diaAntes = dias > 0 && disponivelAntes > 0 ? disponivelAntes / dias : 0
    const diaDepois = dias > 0 && disponivelDepois > 0 ? disponivelDepois / dias : 0

    return {
      tipo, classificacao, valorTotal,
      disponivelAntes, disponivelDepois, pctConsumido, pctRestante,
      dependeReserva, falta, diaAntes, diaDepois,
    }
  }

  // ── PARCELADA ──
  const n = Math.max(1, Number(numeroParcelas) || 1)
  const valorParcela = valorTotal / n
  // Analisa os meses com parcela (índices 0..n-1 da projeção disponível).
  const limite = Math.min(n, projecao.length)
  const meses = []
  for (let i = 0; i < limite; i++) {
    const m = projecao[i]
    const disponivelAntes = m?.disponivel ?? 0
    const disponivelDepois = disponivelAntes - valorParcela
    const classe = classificarPorRestante(disponivelAntes, disponivelDepois)
    meses.push({
      mes: m?.mes ?? `Mês ${i + 1}`,
      disponivelAntes,
      disponivelDepois,
      classificacao: classe,
    })
  }
  // Resultado geral = pior mês entre os afetados.
  const classificacao = meses.reduce((acc, x) => piorEntre(acc, x.classificacao), 'verde')

  return {
    tipo, classificacao, valorTotal,
    numeroParcelas: n, valorParcela, mesesImpacto: limite, meses,
  }
}

// Configuração visual por classificação (ícone vetorial + cores; nunca só cor).
const resultConfig = {
  verde: {
    label: 'Compra saudável',
    icon: CheckCircle2,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconColor: 'text-green-600',
    dot: 'text-green-600',
  },
  amarelo: {
    label: 'Atenção ao orçamento',
    icon: AlertTriangle,
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    iconColor: 'text-yellow-600',
    dot: 'text-yellow-600',
  },
  vermelho: {
    label: 'Compra não recomendada',
    icon: XCircle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-600',
    dot: 'text-red-600',
  },
}

// Frase de topo por classificação/tipo.
function fraseTopo(res) {
  if (res.tipo === 'avista') {
    if (res.classificacao === 'verde') return 'Essa compra cabe confortavelmente no seu orçamento atual.'
    if (res.classificacao === 'amarelo') return 'Esta compra cabe no orçamento, mas reduzirá significativamente seu dinheiro disponível.'
    return 'Esta compra comprometeria grande parte do seu orçamento atual.'
  }
  // parcelada
  if (res.classificacao === 'verde') return 'As parcelas cabem no seu orçamento ao longo dos meses afetados.'
  if (res.classificacao === 'amarelo') return 'As parcelas cabem, mas reduzirão de forma relevante o seu disponível em alguns meses.'
  return 'As parcelas comprometeriam grande parte do seu orçamento em um ou mais meses.'
}

// Célula de métrica (rótulo discreto + valor forte). Usa a surface do tema
// (bg-gray-50) para bom contraste tanto no claro quanto no escuro.
function Metric({ rotulo, valor, cor = 'text-gray-900' }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-500 mb-1">{rotulo}</p>
      <p className={`text-base font-bold ${cor}`}>{valor}</p>
    </div>
  )
}

// Pílula de classificação de um mês (ícone + cor; não depende só de cor).
function MesPill({ classificacao }) {
  const c = resultConfig[classificacao]
  const Icon = c.icon
  return <Icon size={16} className={c.dot} aria-label={c.label} />
}

// ─────────────────────────────────────────────
// Conteúdo do resultado (desktop inline + bottom sheet mobile)
// ─────────────────────────────────────────────
function ConteudoResultado({ resultado, config, onRegistrar, onSimularOutro }) {
  const ehAvista = resultado.tipo === 'avista'
  const [verTodos, setVerTodos] = useState(false)

  return (
    <>
      <div className="flex items-center gap-3 mb-3">
        <config.icon size={30} className={config.iconColor} />
        <div>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Resultado da simulação</p>
          <p className={`text-xl font-bold ${config.color}`}>{config.label}</p>
        </div>
      </div>

      <p className="text-sm text-gray-800 leading-relaxed mb-4">{fraseTopo(resultado)}</p>

      {ehAvista ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric rotulo="Valor da compra" valor={formatCurrency(resultado.valorTotal)} />
            <Metric rotulo="Disponível antes" valor={formatCurrency(resultado.disponivelAntes)} />
            <Metric
              rotulo="Disponível depois"
              valor={formatCurrency(resultado.disponivelDepois)}
              cor={resultado.disponivelDepois < 0 ? 'text-red-600' : 'text-blue-600'}
            />
            <Metric rotulo="Orçamento consumido" valor={`${resultado.pctConsumido.toFixed(2).replace('.', ',')}%`} />
          </div>

          {resultado.disponivelDepois >= 0 && (
            <p className="text-sm text-gray-700 mt-3">
              Após essa compra, ainda restariam{' '}
              <strong>{resultado.pctRestante.toFixed(2).replace('.', ',')}%</strong> do seu orçamento disponível.
            </p>
          )}

          {/* Impacto no disponível por dia (reutiliza dias restantes do mês) */}
          {resultado.diaAntes > 0 && (
            <p className="text-xs text-gray-600 mt-2">
              Seu valor disponível por dia passaria de <strong>{formatCurrency(resultado.diaAntes)}</strong> para{' '}
              <strong>{formatCurrency(resultado.diaDepois)}</strong>.
            </p>
          )}

          {resultado.classificacao === 'amarelo' && (
            <p className="text-sm text-gray-700 mt-3">Considere se esta compra é prioridade neste momento.</p>
          )}

          {/* Vermelho: falta de orçamento e/ou uso da reserva */}
          {resultado.classificacao === 'vermelho' && resultado.falta > 0 && (
            <div className="mt-3 flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2">
              <XCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">
                Faltariam <strong>{formatCurrency(resultado.falta)}</strong> para que essa compra coubesse no orçamento disponível.
              </p>
            </div>
          )}
          {resultado.dependeReserva && (
            <div className="mt-2 flex items-start gap-2 bg-red-100 rounded-xl px-3 py-2">
              <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-800">
                Para realizar esta compra dentro dos valores cadastrados, seria necessário comprometer sua reserva de emergência.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Metric rotulo="Valor da compra" valor={formatCurrency(resultado.valorTotal)} />
            <Metric rotulo="Parcelamento" valor={`${resultado.numeroParcelas}x de ${formatCurrency(resultado.valorParcela)}`} />
            <Metric rotulo="Comprometimento" valor={`${resultado.mesesImpacto} ${resultado.mesesImpacto === 1 ? 'mês' : 'meses'}`} />
            <Metric rotulo="Parcela / mês" valor={formatCurrency(resultado.valorParcela)} />
          </div>

          {/* Meses afetados — mostra os primeiros; "Ver todos" expande. */}
          <div className="mt-4 space-y-2">
            {(verTodos ? resultado.meses : resultado.meses.slice(0, 3)).map((m, i) => (
              <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 capitalize truncate">{m.mes}</p>
                  <p className="text-xs text-gray-500">
                    Parcela: {formatCurrency(resultado.valorParcela)} • Sobra projetada:{' '}
                    <span className={m.disponivelDepois < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>
                      {formatCurrency(m.disponivelDepois)}
                    </span>
                  </p>
                </div>
                <MesPill classificacao={m.classificacao} />
              </div>
            ))}
            {resultado.meses.length > 3 && (
              <button
                onClick={() => setVerTodos(v => !v)}
                className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-1"
              >
                {verTodos ? 'Mostrar menos' : `Ver todos os meses (${resultado.meses.length})`}
              </button>
            )}
          </div>

          {resultado.classificacao === 'amarelo' && (
            <p className="text-sm text-gray-700 mt-3">Considere se esta compra é prioridade neste momento.</p>
          )}
        </>
      )}

      {/* Ações — reutilizam os fluxos existentes; a simulação não altera dados. */}
      <div className="flex flex-col sm:flex-row gap-3 mt-5">
        <button onClick={onSimularOutro} className="btn-secondary flex-1 flex items-center justify-center gap-2">
          <RotateCcw size={15} /> Simular outro valor
        </button>
        <button onClick={onRegistrar} className="btn-primary flex-1 flex items-center justify-center gap-2">
          <Plus size={16} /> Registrar esta compra
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center italic">
        Simulação de orçamento — não constitui aconselhamento financeiro profissional.
      </p>
    </>
  )
}

// ─────────────────────────────────────────────
// Simulador de COMPRA (função original, preservada integralmente)
// ─────────────────────────────────────────────
function SimuladorCompra() {
  const { projecao, carregando, resumoMes } = useProjecao()
  const { perfil } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nome: '',
    valor: '',
    tipo: 'avista',
    parcelas: '12',
  })
  const [resultado, setResultado] = useState(null)
  const [mostrarSheet, setMostrarSheet] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setResultado(null)
    setMostrarSheet(false)
  }

  function handleSimular(e) {
    e.preventDefault()
    const valorNum = Number(form.valor) || 0
    if (!valorNum || valorNum <= 0) return

    const sim = simularCompra({
      projecao,
      valorTotal: valorNum,
      tipo: form.tipo,
      numeroParcelas: parseInt(form.parcelas),
      // À vista usa o saldo real de hoje (se informado); senão, cai no fallback.
      saldoAgora: resumoMes.saldoConfigurado ? resumoMes.saldoDisponivelAgora : null,
      reservaAtual: Number(perfil?.reserva_atual) || 0,
    })
    if (sim) {
      setResultado({ ...sim, nomeCompra: form.nome })
      setMostrarSheet(true)
    }
  }

  // "Registrar esta compra" → fluxos JÁ existentes (não cria lógica nova).
  function handleRegistrar() {
    setMostrarSheet(false)
    if (resultado?.tipo === 'avista') navigate('/despesas?novo=1')
    else navigate('/despesas?novo=parcelado')
  }

  // "Simular outro valor" → limpa o resultado e volta ao formulário.
  function handleSimularOutro() {
    setResultado(null)
    setMostrarSheet(false)
    setForm(prev => ({ ...prev, valor: '' }))
  }

  const config = resultado ? resultConfig[resultado.classificacao] : null
  const semDados = !carregando && resumoMes.receitaTotal === 0 && resumoMes.despesaTotal === 0

  return (
    <div className="space-y-6">
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
              <InputMoeda
                valor={form.valor}
                onChangeValor={(n) => { setForm(prev => ({ ...prev, valor: n })); setResultado(null); setMostrarSheet(false) }}
                className="input" />
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
                {Number(form.valor) > 0 && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Parcela estimada: {formatCurrency(Number(form.valor) / parseInt(form.parcelas))} / mês
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

      {/* Resultado — DESKTOP (md+): inline abaixo do formulário */}
      {resultado && config && (
        <div className={`hidden md:block card border-2 ${config.border}`}>
          <ConteudoResultado
            resultado={resultado} config={config}
            onRegistrar={handleRegistrar} onSimularOutro={handleSimularOutro}
          />
        </div>
      )}

      {/* Resultado — MOBILE (<md): bottom sheet sobre a tela */}
      <div className="md:hidden">
        {resultado && config && (
          <Modal
            aberto={mostrarSheet}
            onFechar={() => setMostrarSheet(false)}
            titulo="Resultado da simulação"
          >
            <div className="-m-5 p-5">
              <ConteudoResultado
                resultado={resultado} config={config}
                onRegistrar={handleRegistrar} onSimularOutro={handleSimularOutro}
              />
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente principal — alterna entre "Compra" (função original, intacta)
// e "Financiamento imobiliário" (novo simulador). A aba Compra é o padrão.
// ─────────────────────────────────────────────
export default function PossoComprar() {
  const [aba, setAba] = useState('compra') // 'compra' | 'imovel' | 'automovel'

  // Rótulos curtos p/ caber as 3 opções no mobile (320px) sem apertar.
  const ABAS = [
    { id: 'compra',    label: 'Compra',    icon: ShoppingCart },
    { id: 'imovel',    label: 'Imóvel',    icon: Home },
    { id: 'automovel', label: 'Automóvel', icon: Car },
  ]

  const subtitulo = {
    compra: 'Simule o impacto de uma compra no seu orçamento',
    imovel: 'Simule um financiamento imobiliário para planejar sua compra',
    automovel: 'Simule o financiamento de um veículo e veja o custo real',
  }[aba]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posso Comprar?</h1>
        <p className="text-sm text-gray-500 mt-1">{subtitulo}</p>
      </div>

      {/* Seletor de abas. Grid de 3 colunas no mobile (cabe em 320px);
          vira linha automática a partir de sm. Sem scroll horizontal. */}
      <div className="grid grid-cols-3 sm:flex gap-2">
        {ABAS.map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-xl text-sm font-medium transition-colors min-w-0 ${
              aba === t.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.icon size={15} className="flex-shrink-0" /> <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {aba === 'compra' && <SimuladorCompra />}
      {aba === 'imovel' && <SimuladorFinanciamento />}
      {aba === 'automovel' && <SimuladorAutomovel />}
    </div>
  )
}
