import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Zap, Sun, Plus, Pencil,
  CheckCircle2, Circle, Rocket, Eye, EyeOff, Check, CalendarClock, PiggyBank, AlertTriangle, MessageCircle, BarChart2, X
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useComprasCartao } from '../hooks/useComprasCartao'
import { useConsultoriaInteresses } from '../hooks/useConsultoria'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, exibirMoeda, FORMAS_PAGAMENTO, hojeISO as hojeISOBrasil, hojeDateBrasil } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import { parcelaCompraNoMes, totalFaturaComOverride } from '../lib/faturaCartao'
import Modal from '../components/Modal'
import HorizonteFinanceiro from '../components/HorizonteFinanceiro'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'

// Chaves lidas em App.jsx (AreaAutenticada) para reabrir o onboarding e saber
// em qual etapa começar. Mesmas chaves usadas pela tela de Configurações.
const CHAVE_REFAZER = 'almeida_refazer_onboarding'
const CHAVE_ETAPA_ONBOARDING = 'almeida_onboarding_etapa'

// ─── Modal de Gasto rápido ────────────────────────────────────────────────────
// Categorias comuns de gasto do dia a dia — aparecem primeiro no seletor
// rápido (apenas ordenação visual; não cria, renomeia nem apaga categorias).
const CATEGORIAS_COMUNS = ['Alimentação', 'Transporte', 'Lazer', 'Mercado', 'Saúde', 'Serviços']

function FormGastoRapido({ onSalvar, onCancelar, carregando, onMaisOpcoes }) {
  const { categorias } = useCategorias('despesa')
  const { cartoes } = useCartoes()
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    categoria_id: '',
    forma_pagamento: '',
    cartao_id: '',
  })

  const ehCartaoCredito = form.forma_pagamento === 'cartao_credito'

  // Ordena mostrando as categorias comuns primeiro (sem alterar os dados).
  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    const ia = CATEGORIAS_COMUNS.indexOf(a.nome)
    const ib = CATEGORIAS_COMUNS.indexOf(b.nome)
    const ra = ia === -1 ? 999 : ia
    const rb = ib === -1 ? 999 : ib
    return ra - rb || a.nome.localeCompare(b.nome)
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const valorNum = Number(form.valor) || 0
    if (valorNum <= 0) return
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    // Gasto rápido: à vista, não recorrente, data de hoje. Classificação
    // automática (padrão variável). Mesma função/estrutura das demais despesas.
    const tipo_despesa = classificarDespesa({
      descricao: form.descricao,
      categoria: catSelecionada?.nome || '',
    })
    const descricao = form.descricao?.trim() || (catSelecionada?.nome ?? 'Gasto')
    onSalvar({
      descricao,
      valor: valorNum,
      data: hojeISOBrasil(),
      recorrente: false,
      categoria_id: form.categoria_id || null,
      tipo_despesa,
      // Forma de pagamento escolhida. Quando for cartão de crédito, também vai
      // o cartão selecionado — o Dashboard decide gravar em compras_cartao
      // (entra na fatura, NÃO desconta do saldo à vista) em vez de despesas.
      forma_pagamento: form.forma_pagamento || null,
      cartao_id: ehCartaoCredito ? (form.cartao_id || null) : null,
    }, catSelecionada?.nome || 'Sem categoria')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Valor em destaque (foco imediato para registrar rápido) */}
      <div>
        <label className="label">Valor</label>
        <InputMoeda
          valor={form.valor}
          onChangeValor={(n) => setForm(prev => ({ ...prev, valor: n }))}
          className="input text-2xl font-bold text-center py-3"
          prefixo={null}
          autoFocus
        />
      </div>
      <div>
        <label className="label">Categoria</label>
        <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input">
          <option value="">Selecionar categoria</option>
          {categoriasOrdenadas.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Descrição <span className="text-gray-400">(opcional)</span></label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex.: Padaria" />
      </div>

      {/* Forma de pagamento. Reaproveita FORMAS_PAGAMENTO (mesma lista do app). */}
      <div>
        <label className="label">Forma de pagamento</label>
        <select name="forma_pagamento" value={form.forma_pagamento} onChange={handleChange} className="input">
          <option value="">Selecionar forma</option>
          {FORMAS_PAGAMENTO.map(f => (
            <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
          ))}
        </select>
      </div>

      {/* Cartão de crédito → escolher o cartão. A compra entra na FATURA do
          cartão (não desconta do saldo à vista). */}
      {ehCartaoCredito && (
        cartoes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-500">
            Você ainda não tem cartões cadastrados.
            <Link to="/cartoes" className="block mt-2 text-blue-600 font-medium hover:underline">
              + Cadastrar cartão
            </Link>
          </div>
        ) : (
          <div>
            <label className="label">Em qual cartão?</label>
            <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input" required>
              <option value="">Selecionar cartão</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Este gasto entrará na fatura do cartão, sem descontar do seu saldo disponível agora.
            </p>
          </div>
        )
      )}

      <button type="submit" disabled={carregando}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {carregando
          ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
          : 'Salvar gasto'}
      </button>

      {/* Atalho para o cadastro COMPLETO já existente (fixa/variável,
          recorrência, forma de pagamento, parcelamento etc.). */}
      <button type="button" onClick={onMaisOpcoes}
        className="w-full text-xs font-medium text-blue-600 hover:text-blue-700 py-1">
        Mais opções
      </button>
    </form>
  )
}

function SummaryCard({ title, value, icon: Icon, color, bgColor, subtitle, carregando }) {
  const { ocultar } = useOcultarValores()
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-500 min-w-0 truncate">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <div>
        {carregando ? (
          <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          // Fonte menor em telas estreitas (2 colunas) para o valor não cortar;
          // volta ao tamanho atual a partir de sm. Quebra segura como fallback.
          <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-words">
            {exibirMoeda(value, ocultar)}
          </p>
        )}
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Resumo da projeção: SÓ o card do próximo mês (versão compacta da Home) ───
// A tabela completa dos 12 meses foi movida para TabelaProjecao12Meses, exibida
// num modal via "Ver detalhes". Mesmos valores/cálculos — só a exibição mudou.
function ResumoProjecao({ projecao }) {
  // Próximo mês = índice 1 (índice 0 é o mês atual). Fallback para o atual se só houver 1.
  const proximo = projecao[1] || projecao[0]
  // "Disponível" agora considera a reserva de emergência: Receita − Compromissos − Reserva.
  const dispProx = proximo?.disponivel ?? 0
  const dispPositivo = dispProx >= 0

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs font-medium text-gray-500">
          Resumo de <span className="capitalize font-semibold text-gray-700">{proximo?.mes}</span> (próximo mês)
        </p>
        {!dispPositivo && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
            <AlertTriangle size={12} /> Negativo
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Receitas previstas</p>
          <p className="text-sm font-bold text-green-600 break-words">{formatCurrency(proximo?.receitas ?? 0)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Compromissos previstos</p>
          <p className="text-sm font-bold text-red-500 break-words">{formatCurrency(proximo?.despesas ?? 0)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Reserva planejada</p>
          <p className="text-sm font-bold text-amber-600 break-words">{formatCurrency(proximo?.reserva ?? 0)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-400">Disponível para gastar</p>
          <p className={`text-sm font-bold break-words ${dispPositivo ? 'text-blue-600' : 'text-red-600'}`}>
            {formatCurrency(dispProx)}
          </p>
        </div>
      </div>
      <p className={`text-sm font-semibold ${dispPositivo ? 'text-blue-600' : 'text-red-600'}`}>
        {dispPositivo
          ? `Você terá ${formatCurrency(dispProx)} livres após a reserva`
          : `Você ficará ${formatCurrency(Math.abs(dispProx))} no negativo após a reserva`}
      </p>
    </div>
  )
}

// (A tabela de 12 meses foi substituída pelo "Horizonte financeiro" — fluxo de
//  caixa diário — em src/components/HorizonteFinanceiro.jsx.)

// Dias restantes no mês, incluindo hoje
function diasRestantesNoMes(ref = new Date()) {
  const ultimoDia = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate()
  return ultimoDia - ref.getDate() + 1
}

// Cálculo do limite diário ("Você pode gastar por dia"). FONTE ÚNICA — usada
// pelo card "Quanto posso gastar?" e pela confirmação do gasto rápido, para
// nunca divergirem. Mesma fórmula de sempre: auto = (receita − reserva −
// compromissos)/dias; manual = valor fixo definido pelo usuário.
function calcularLimiteDiario({ receitaMes, compromissosMes, reservaPct, modo, limiteManual, hoje, baseLivre }) {
  const dias = diasRestantesNoMes(hoje)
  const ehManual = modo === 'manual'
  const reserva = receitaMes > 0 ? receitaMes * (reservaPct / 100) : 0
  // Se "baseLivre" for informado (orçamento livre já considerando saldo atual
  // e compromissos futuros), usa-o; senão, mantém a base antiga (receita −
  // compromissos) para compatibilidade com quem não configurou o saldo.
  const base = baseLivre != null ? baseLivre : (receitaMes - compromissosMes)
  const disponivelAuto = base - reserva
  const limiteAuto = disponivelAuto > 0 && dias > 0 ? disponivelAuto / dias : 0
  const limiteManualNum = Number(limiteManual) || 0
  return ehManual ? limiteManualNum : limiteAuto
}

// Status do orçamento com base no % de comprometimento da renda (educativo, não alarmista)
function statusOrcamento(receita, disponivel) {
  if (receita <= 0) return null
  const pctComprometido = (receita - disponivel) / receita
  if (disponivel < 0 || pctComprometido >= 1) {
    return { cor: '🔴', texto: 'Orçamento comprometido', classe: 'text-white' }
  }
  if (pctComprometido >= 0.8) {
    return { cor: '🟡', texto: 'Atenção aos gastos', classe: 'text-white' }
  }
  return { cor: '🟢', texto: 'Dentro do orçamento', classe: 'text-white' }
}

// ─── Card "Quanto posso gastar?" — modos Automático e Manual ──────────────────
const OPCOES_RESERVA = [10, 15, 20, 25, 30]

// Deriva os valores de exibição do "Quanto posso gastar?" a partir das MESMAS
// entradas usadas no card detalhado — NÃO é um cálculo novo, apenas a mesma
// fórmula consolidada em um lugar, para o resumo compacto e o detalhado nunca
// divergirem. (auto = (base − reserva); manual = base; limite = disp/dias.)
function derivarResumoGastar({
  modo, receitaMes, compromissosMes, limiteManual, hoje,
  pct, saldoConfigurado, previsaoFimMes,
}) {
  const dias = diasRestantesNoMes(hoje)
  const ehManual = modo === 'manual'
  const reserva = receitaMes > 0 ? receitaMes * (pct / 100) : 0
  const baseLivre = saldoConfigurado ? previsaoFimMes : (receitaMes - compromissosMes)
  const disponivelAuto = baseLivre - reserva
  const disponivelMes = ehManual ? baseLivre : disponivelAuto
  const limiteAuto = disponivelAuto > 0 && dias > 0 ? disponivelAuto / dias : 0
  const limiteManualNum = Number(limiteManual) || 0
  const limiteExibido = ehManual ? limiteManualNum : limiteAuto
  const status = statusOrcamento(receitaMes, disponivelMes)
  const orcamentoNegativo = disponivelMes < 0
  const manualAcimaDoRecomendado = ehManual && limiteManualNum > limiteAuto && limiteAuto > 0
  return {
    dias, ehManual, reserva, baseLivre, disponivelAuto,
    disponivelMes, limiteAuto, limiteManualNum, limiteExibido,
    status, orcamentoNegativo, manualAcimaDoRecomendado,
  }
}

// ─── Resumo compacto "Quanto posso gastar?" (Home) ────────────────────────────
// Visual escuro/neutro (sem o fundo azul predominante). Mostra só: Disponível no
// mês, gasto por dia e o status. Botão abre o planejamento completo (modal com o
// CardQuantoPossoGastar detalhado). Mesmos valores (derivarResumoGastar).
function CardResumoGastar({
  carregando, modo, receitaMes, compromissosMes, limiteManual, hoje,
  reservaPercentual, saldoConfigurado = false, previsaoFimMes = 0, onVerCompleto,
}) {
  const { ocultar } = useOcultarValores()
  if (carregando) {
    return (
      <div className="card">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-16 w-full bg-gray-100 rounded-xl animate-pulse mt-3" />
      </div>
    )
  }
  const pct = reservaPercentual != null ? Number(reservaPercentual) : 20
  const { disponivelMes, limiteExibido, status, orcamentoNegativo } = derivarResumoGastar({
    modo, receitaMes, compromissosMes, limiteManual, hoje,
    pct, saldoConfigurado, previsaoFimMes,
  })
  // Cor do pontinho de status conforme o emoji devolvido por statusOrcamento.
  const corStatus = status?.cor === '🔴' ? 'bg-red-500'
    : status?.cor === '🟡' ? 'bg-amber-500'
    : 'bg-green-500'

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Sun size={18} className="text-blue-500 flex-shrink-0" />
        <h2 className="text-base font-semibold text-gray-900">Quanto posso gastar?</h2>
      </div>

      {/* Área única: "Disponível no mês" em destaque e, abaixo, o equivalente
          por dia em texto menor. Mesmos cálculos (disponivelMes / limiteExibido). */}
      <div className="bg-gray-50 rounded-xl px-3 py-3 mt-3">
        <p className="text-xs text-gray-400">Disponível no mês</p>
        <p className={`text-2xl font-bold leading-tight break-words ${orcamentoNegativo ? 'text-red-500' : 'text-gray-900'}`}>
          {exibirMoeda(disponivelMes, ocultar)}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Equivale a <span className="font-medium text-gray-500">{exibirMoeda(Math.max(0, limiteExibido), ocultar)}</span> por dia
        </p>
      </div>

      {status && (
        <div className="flex items-center gap-2 mt-3">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${corStatus}`} />
          <span className="text-sm text-gray-600">{status.texto}</span>
        </div>
      )}

      <button
        onClick={onVerCompleto}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        Ver planejamento completo <ArrowRight size={14} />
      </button>
    </div>
  )
}

function CardQuantoPossoGastar({
  carregando, modo, onTrocarModo,
  receitaMes, compromissosMes, limiteManual, onEditarLimite, hoje,
  reservaPercentual, onTrocarReserva,
  reservaAtual = 0, metaReserva = 0, onEditarReservaAtual,
  saldoConfigurado = false, previsaoFimMes = 0,
}) {
  const { ocultar } = useOcultarValores()
  const [personalizando, setPersonalizando] = useState(false)
  const [pctCustom, setPctCustom] = useState('')
  // Estado local do percentual (atualização otimista): o clique reflete na hora,
  // sem esperar o salvamento no banco. Sincroniza quando o perfil carrega/muda.
  const [pctLocal, setPctLocal] = useState(reservaPercentual != null ? Number(reservaPercentual) : 20)
  const [erroSalvar, setErroSalvar] = useState(false)

  useEffect(() => {
    if (reservaPercentual != null) setPctLocal(Number(reservaPercentual))
  }, [reservaPercentual])

  // Seleciona um percentual: atualiza a UI imediatamente e tenta persistir
  async function selecionarPct(valor) {
    setPctLocal(valor)        // recálculo imediato (reserva, disponível, gasto diário)
    setErroSalvar(false)
    try {
      await onTrocarReserva(valor)  // persiste no banco
    } catch {
      setErroSalvar(true)
    }
  }

  if (carregando) {
    return (
      <div className="bg-marca-grad rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white/90 mb-3">
          <Sun size={18} />
          <span className="text-sm font-medium">Quanto posso gastar?</span>
        </div>
        <div className="h-9 w-40 bg-black/20 rounded-lg animate-pulse" />
      </div>
    )
  }

  // Reserva de emergência (só afeta o modo automático). Usa o estado local
  // otimista para refletir o clique imediatamente. Padrão 20%.
  const pct = pctLocal
  // Deriva TODOS os valores pela MESMA função do resumo compacto (sem duplicar
  // fórmula). A reserva fica separada e só é descontada no modo automático.
  const {
    dias, ehManual, reserva, limiteAuto, limiteManualNum,
    disponivelMes, limiteExibido, status, orcamentoNegativo, manualAcimaDoRecomendado,
  } = derivarResumoGastar({
    modo, receitaMes, compromissosMes, limiteManual, hoje,
    pct, saldoConfigurado, previsaoFimMes,
  })

  function aplicarCustom(e) {
    e.preventDefault()
    const n = parseFloat(String(pctCustom).replace(',', '.'))
    if (!isNaN(n) && n >= 0 && n <= 100) {
      selecionarPct(n)
      setPersonalizando(false)
      setPctCustom('')
    }
  }

  return (
    <div className="bg-marca-grad rounded-2xl p-5 text-white">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sun size={18} />
          <span className="text-sm font-medium text-white/90">Quanto posso gastar?</span>
        </div>
        {/* Alternador Automático | Manual */}
        <div className="flex bg-black/15 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          <button
            onClick={() => onTrocarModo('auto')}
            className={`px-3 py-1.5 rounded-md transition-colors ${!ehManual ? 'bg-white/90 text-marca' : 'text-white/80'}`}
          >
            Automático
          </button>
          <button
            onClick={() => onTrocarModo('manual')}
            className={`px-3 py-1.5 rounded-md transition-colors ${ehManual ? 'bg-white/90 text-marca' : 'text-white/80'}`}
          >
            Manual
          </button>
        </div>
      </div>

      {/* ── Reserva de emergência (só no modo automático) ── */}
      {!ehManual && (
        <div className="bg-black/15 rounded-xl px-3 py-3 mb-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-white/90 font-medium">Reserva de emergência — {pct}%</p>
            <p className="text-sm font-bold">{formatCurrency(reserva)}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {OPCOES_RESERVA.map(op => (
              <button key={op} type="button" onClick={() => { selecionarPct(op); setPersonalizando(false) }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !personalizando && pct === op ? 'bg-white/90 text-marca' : 'bg-black/20 text-white/80 hover:bg-black/30'
                }`}>
                {op}%
              </button>
            ))}
            <button type="button" onClick={() => setPersonalizando(v => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                personalizando || !OPCOES_RESERVA.includes(pct) ? 'bg-white/90 text-marca' : 'bg-black/20 text-white/80 hover:bg-black/30'
              }`}>
              Personalizado
            </button>
          </div>
          {personalizando && (
            <form onSubmit={aplicarCustom} className="flex gap-2 mt-2">
              <input type="number" min="0" max="100" step="1" value={pctCustom}
                onChange={e => setPctCustom(e.target.value)}
                placeholder="Ex: 18" autoFocus
                className="flex-1 bg-white/90 text-gray-900 rounded-md px-2 py-1 text-sm focus:outline-none" />
              <button type="submit" className="bg-white/90 text-marca text-xs font-semibold px-3 rounded-md">OK</button>
            </form>
          )}
          <p className="text-xs text-white/60 mt-2">Este valor está sendo separado do seu orçamento de gastos.</p>
          {erroSalvar && (
            <p className="text-xs text-amber-100 mt-1">
              Não foi possível salvar sua preferência. O cálculo está atualizado, mas pode não permanecer após recarregar.
            </p>
          )}
        </div>
      )}

      {/* ── Detalhamento (modo automático): renda → reserva → compromissos → disponível ── */}
      {!ehManual && (
        <div className="bg-black/15 rounded-xl px-3 py-3 mb-3 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Renda do mês</span>
            <span className="font-medium">{formatCurrency(receitaMes)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Reserva de emergência ({pct}%)</span>
            <span className="font-medium">− {formatCurrency(reserva)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-white/70">Compromissos do mês</span>
            <span className="font-medium">− {formatCurrency(compromissosMes)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1.5 border-t border-white/15">
            <span className="font-semibold">Disponível para gastar</span>
            <span className={`font-bold ${orcamentoNegativo ? 'text-red-200' : ''}`}>{formatCurrency(disponivelMes)}</span>
          </div>
        </div>
      )}

      {/* Valores principais */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-black/15 rounded-xl px-3 py-3">
          <p className="text-xs text-white/70">Disponível no mês</p>
          <p className={`text-xl font-bold ${orcamentoNegativo ? 'text-red-200' : ''}`}>
            {formatCurrency(disponivelMes)}
          </p>
        </div>
        <div className="bg-black/15 rounded-xl px-3 py-3">
          <p className="text-xs text-white/70">
            {ehManual ? 'Seu limite diário' : 'Você pode gastar por dia'}
          </p>
          <p className="text-xl font-bold">
            {formatCurrency(Math.max(0, limiteExibido))}<span className="text-xs font-normal text-white/70">/dia</span>
          </p>
        </div>
      </div>

      {/* Status */}
      {status && (
        <div className="flex items-center gap-2 mt-3 bg-black/15 rounded-xl px-3 py-2">
          <span>{status.cor}</span>
          <span className="text-sm font-medium">{status.texto}</span>
        </div>
      )}

      {/* Mensagens contextuais */}
      {orcamentoNegativo && (
        <p className="text-xs text-white/90 mt-2 bg-black/15 rounded-lg px-3 py-2">
          Seus compromissos do mês estão acima da renda cadastrada.
        </p>
      )}

      {/* Indica claramente que o valor exibido foi definido manualmente */}
      {ehManual && limiteManualNum > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-white/90">
          <Pencil size={12} />
          <span>Valor definido manualmente por você.</span>
        </div>
      )}

      {ehManual && !orcamentoNegativo && (
        <div className="mt-2 bg-black/15 rounded-lg px-3 py-2">
          <p className="text-xs text-white/90">
            {dias} dias restantes • Orçamento necessário até o fim do mês:{' '}
            <strong>{formatCurrency(limiteManualNum * dias)}</strong>
          </p>
          {manualAcimaDoRecomendado && (
            <p className="text-xs text-amber-100 mt-1">
              Seu limite diário definido está acima do valor recomendado pelo seu orçamento atual.
            </p>
          )}
        </div>
      )}

      {/* Ações do modo manual: ajustar o valor e voltar ao cálculo automático */}
      {ehManual && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={onEditarLimite}
            className="flex items-center gap-1 text-xs font-medium text-white/90 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Pencil size={12} /> {limiteManualNum > 0 ? 'Ajustar gasto diário' : 'Definir gasto diário'}
          </button>
          <button
            onClick={() => onTrocarModo('auto')}
            className="flex items-center gap-1 text-xs font-medium text-white/90 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            Voltar para cálculo automático
          </button>
        </div>
      )}

      {/* No modo automático, atalho para ativar o ajuste manual */}
      {!ehManual && (
        <button
          onClick={() => onTrocarModo('manual')}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-white/90 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Pencil size={12} /> Ajustar gasto diário
        </button>
      )}

      {/* Reserva de emergência: patrimônio já guardado + meta + progresso.
          Tudo INFORMATIVO — não entra em renda nem no disponível para gastar. */}
      {(() => {
        const temMeta = metaReserva > 0
        const pct = temMeta ? Math.min(100, (reservaAtual / metaReserva) * 100) : 0
        const faltaAcumular = temMeta ? Math.max(0, metaReserva - reservaAtual) : 0
        const metaAtingida = temMeta && reservaAtual >= metaReserva
        return (
          <div className="mt-3 pt-3 border-t border-white/15">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-white/80">
                Reserva de emergência atual: <strong className="text-white">{exibirMoeda(reservaAtual, ocultar)}</strong>
              </span>
              <button
                onClick={onEditarReservaAtual}
                className="flex items-center gap-1 text-xs font-medium text-white/90 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                <Pencil size={12} /> Editar
              </button>
            </div>

            {temMeta && (
              <>
                <div className="flex items-center justify-between text-xs text-white/80 mt-2">
                  <span>Meta: <strong className="text-white">{exibirMoeda(metaReserva, ocultar)}</strong></span>
                  <span>{pct.toFixed(1).replace('.', ',')}%</span>
                </div>
                {/* Barra de progresso */}
                <div className="w-full bg-black/20 rounded-full h-2 mt-1.5">
                  <div
                    className="h-2 rounded-full bg-white/90 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-white/80 mt-1.5">
                  {metaAtingida
                    ? <>Falta acumular: <strong className="text-white">{formatCurrency(0)}</strong> • <strong className="text-white">Meta atingida ✓</strong></>
                    : <>Falta acumular: <strong className="text-white">{formatCurrency(faltaAcumular)}</strong></>}
                </p>

                {/* Previsão de quando a meta será atingida (calculada dinamicamente).
                    aporte_mensal = renda × (reserva_percentual/100). Não altera cálculos. */}
                {(() => {
                  if (metaAtingida) {
                    return <p className="text-xs text-white/90 mt-1.5 font-medium">Meta atingida 🎉</p>
                  }
                  const aporteMensal = receitaMes > 0 ? receitaMes * (reservaPercentual / 100) : 0
                  if (aporteMensal <= 0) {
                    return (
                      <p className="text-xs text-white/70 mt-1.5">
                        Informe sua renda e defina um percentual de reserva para visualizar a previsão.
                      </p>
                    )
                  }
                  const meses = Math.ceil(faltaAcumular / aporteMensal)
                  // Mês/ano estimado (a partir do mês atual + meses).
                  const alvo = new Date()
                  alvo.setMonth(alvo.getMonth() + meses)
                  const mesAno = alvo.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                  return (
                    <div className="mt-2 bg-black/15 rounded-lg px-3 py-2">
                      <p className="text-xs text-white/90">
                        Mantendo seu aporte de <strong>{formatCurrency(aporteMensal)}/mês</strong>, você atingirá
                        sua meta em aproximadamente <strong>{meses} {meses === 1 ? 'mês' : 'meses'}</strong>.
                      </p>
                      <p className="text-xs text-white/70 mt-0.5 capitalize">
                        Previsão: {mesAno}.
                      </p>
                    </div>
                  )
                })()}
              </>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ─── Modal para editar o limite diário manual ─────────────────────────────────
function ModalLimiteDiario({ aberto, onFechar, valorAtual, onSalvar, salvando }) {
  const [valor, setValor] = useState(0)

  useEffect(() => {
    if (aberto) setValor(Number(valorAtual) || 0)
  }, [aberto, valorAtual])

  function handleSubmit(e) {
    e.preventDefault()
    if (!valor || valor <= 0) return
    onSalvar(valor)
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Meu limite diário">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Quanto você quer poder gastar por dia?</label>
          <InputMoeda
            valor={valor}
            onChangeValor={setValor}
            className="input"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">
            Esse valor fica salvo e continua o mesmo nos próximos dias até você alterar.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar limite'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal para informar/atualizar o SALDO ATUAL (dinheiro disponível hoje) ───
function ModalSaldo({ aberto, onFechar, valorAtual, onSalvar, salvando }) {
  const [valor, setValor] = useState(0)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (aberto) { setValor(Number(valorAtual) || 0); setErro('') }
  }, [aberto, valorAtual])

  async function handleSubmit(e) {
    e.preventDefault()
    if (valor < 0) return
    setErro('')
    try {
      // onSalvar pode ser assíncrono e lançar erro (ex.: coluna ausente no
      // banco). Nesse caso mostramos a mensagem em vez de um clique "morto".
      await onSalvar(valor)
    } catch (err) {
      setErro(err?.message || 'Não foi possível salvar o saldo. Tente novamente.')
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Saldo atual">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Quanto você tem disponível hoje?</label>
          <InputMoeda
            valor={valor}
            onChangeValor={setValor}
            className="input text-2xl font-bold text-center py-3"
            prefixo={null}
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">
            Informe o dinheiro que você possui disponível para utilizar.
            Não inclua sua reserva de emergência.
          </p>
        </div>

        {erro && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar saldo'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Modal para editar a reserva de emergência (valor atual + meta) ───────────
function ModalReservaAtual({ aberto, onFechar, valorAtual, metaAtual, onSalvar, salvando }) {
  const [valor, setValor] = useState(0)
  const [meta, setMeta] = useState(0)

  useEffect(() => {
    if (aberto) {
      setValor(Number(valorAtual) || 0)
      setMeta(Number(metaAtual) || 0)
    }
  }, [aberto, valorAtual, metaAtual])

  function handleSubmit(e) {
    e.preventDefault()
    // Ambos aceitam 0 e qualquer valor >= 0.
    onSalvar({ reserva_atual: Math.max(0, valor), meta_reserva: Math.max(0, meta) })
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Reserva de emergência">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Quanto você já tem guardado?</label>
          <InputMoeda valor={valor} onChangeValor={setValor} className="input" autoFocus />
        </div>
        <div>
          <label className="label">Meta da reserva <span className="text-gray-400">(objetivo total)</span></label>
          <InputMoeda valor={meta} onChangeValor={setMeta} className="input" />
          <p className="text-xs text-gray-400 mt-1">
            Esses valores são apenas um registro do seu patrimônio e do seu objetivo.
            Não são somados à renda nem ao disponível para gastar.
          </p>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button type="submit" disabled={salvando}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar reserva'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Card "Comece por aqui" (checklist de primeiro uso) ───────────────────────
// Versão compacta por padrão; o checklist completo expande ao tocar "Continuar".
function CardComecePorAqui({ itens, totalConcluidos, onIrPara, onContinuar }) {
  const total = itens.length
  const [expandido, setExpandido] = useState(false)

  // Resumo dos pendentes (labels curtos) para a visão compacta.
  const pendentes = itens.filter(i => !i.concluido)
  const resumoPendentes = pendentes
    .map(i => ({
      renda: 'renda',
      despesas: 'despesas recorrentes',
      parcelas: 'parcelamentos',
      reserva: 'reserva',
    }[i.chave] || i.label.toLowerCase()))
  // Junta com vírgulas e "e" antes do último.
  const textoFaltam = resumoPendentes.length === 1
    ? resumoPendentes[0]
    : resumoPendentes.slice(0, -1).join(', ') + ' e ' + resumoPendentes[resumoPendentes.length - 1]

  return (
    <div className="card">
      {/* Cabeçalho compacto */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">
          <Rocket size={18} className="text-blue-600 flex-shrink-0" />
          <span className="truncate">Complete sua configuração</span>
        </h2>
        <span className="text-xs font-medium text-gray-500 flex-shrink-0">
          {totalConcluidos} de {total} concluídos
        </span>
      </div>

      {/* Resumo dos pendentes — só na visão compacta */}
      {!expandido && pendentes.length > 0 && (
        <p className="text-sm text-gray-500 mt-2">
          Faltam: {textoFaltam}
        </p>
      )}

      {/* Checklist completo — expande ao tocar "Continuar" */}
      {expandido && (
        <ul className="space-y-2 mt-3">
          {itens.map(item => (
            <li key={item.chave}>
              <button
                type="button"
                onClick={() => !item.concluido && onIrPara(item)}
                disabled={item.concluido}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                  item.concluido
                    ? 'border-green-100 bg-green-50 cursor-default'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                {item.concluido
                  ? <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                  : <Circle size={18} className="text-gray-300 flex-shrink-0" />}
                <span className={`text-sm flex-1 ${item.concluido ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                  {item.label}
                </span>
                {!item.concluido && <ArrowRight size={15} className="text-gray-400 flex-shrink-0" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Ações */}
      {!expandido ? (
        <button
          onClick={() => setExpandido(true)}
          className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
        >
          Continuar <ArrowRight size={16} />
        </button>
      ) : (
        <div className="flex gap-3 mt-4">
          <button onClick={() => setExpandido(false)} className="btn-secondary flex-1">
            Recolher
          </button>
          <button onClick={onContinuar} className="btn-primary flex-1 flex items-center justify-center gap-2">
            Continuar configuração <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Card destaque "Quanto posso gastar hoje?" (foco principal da Home) ───────
// Reaproveita o limite diário (calcularLimiteDiario) e os gastos reais de hoje.
// NÃO recalcula regra nova: limiteHoje e os demais valores vêm da MESMA fonte
// do card detalhado (derivarResumoGastar) — nada é somado/descontado de novo.
//
// Card PRINCIPAL e ÚNICO "Quanto posso gastar?" (visual azul). Unifica o que
// antes eram dois cards (o azul "hoje" + o escuro "resumo"), sem repetir
// informação:
//   • Disponível para gastar HOJE (limiteHoje) em destaque + frase curta.
//   • Disponível no MÊS (disponivelMes) como informação complementar.
//   • Status real do orçamento.
//   • "Ver planejamento completo" → abre a visualização detalhada existente.
function CardGastoHoje({
  carregando, limiteHoje, onVerCompleto,
  modo, receitaMes, compromissosMes, limiteManual, hoje,
  reservaPercentual, saldoConfigurado = false, previsaoFimMes = 0,
}) {
  const { ocultar } = useOcultarValores()
  if (carregando) {
    return (
      <div className="bg-marca-grad rounded-2xl p-5">
        <div className="h-4 w-48 bg-black/20 rounded animate-pulse" />
        <div className="h-10 w-40 bg-black/20 rounded-lg animate-pulse mt-3" />
      </div>
    )
  }

  // Disponível no mês + status — MESMA derivação do card detalhado (sem recalcular
  // regra). "limiteExibido" (gasto/dia) não é mostrado aqui porque o destaque já
  // é o disponível de HOJE; evitamos repetir a mesma ideia duas vezes.
  const pct = reservaPercentual != null ? Number(reservaPercentual) : 20
  const { disponivelMes, status, orcamentoNegativo } = derivarResumoGastar({
    modo, receitaMes, compromissosMes, limiteManual, hoje,
    pct, saldoConfigurado, previsaoFimMes,
  })
  // Pontinho de status (semântico) legível sobre o azul.
  const corStatus = status?.cor === '🔴' ? 'bg-red-300'
    : status?.cor === '🟡' ? 'bg-amber-300'
    : 'bg-green-300'

  return (
    <div className="bg-marca-grad rounded-2xl p-4 text-white">
      <div className="flex items-center gap-2 text-white/90">
        <Sun size={16} />
        <span className="text-sm font-medium">Quanto posso gastar?</span>
      </div>

      {/* Principal: disponível para gastar HOJE */}
      <p className="text-xs text-white/80 mt-2">Disponível para gastar hoje</p>
      <p className="text-3xl sm:text-4xl font-bold mt-0.5 leading-tight break-words">
        {exibirMoeda(Math.max(0, limiteHoje), ocultar)}
      </p>
      <p className="text-xs text-white/80 mt-0.5">
        Sem comprometer seu planejamento
      </p>

      {/* Separador discreto */}
      <div className="border-t border-white/15 my-3" />

      {/* Complementar: disponível no mês + status */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-white/80">Disponível no mês</p>
          <p className={`text-lg font-bold leading-tight break-words ${orcamentoNegativo ? 'text-red-200' : ''}`}>
            {exibirMoeda(disponivelMes, ocultar)}
          </p>
        </div>
        {status && (
          <div className="flex items-center gap-1.5 flex-shrink-0 bg-black/15 rounded-full px-2.5 py-1">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${corStatus}`} />
            <span className="text-xs font-medium text-white/90">{status.texto}</span>
          </div>
        )}
      </div>

      {onVerCompleto && (
        <button
          onClick={onVerCompleto}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-white/90 hover:text-white transition-colors"
        >
          Ver planejamento completo <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}

// ─── Card "Seu dia financeiro" ────────────────────────────────────────────────
// Usa os MESMOS dados do cálculo diário (limiteHoje, gastosDeHoje) — não
// recalcula nada. Mostra "Gastou até agora" e "Ainda disponível", um anel de
// progresso em CSS puro (sem biblioteca) com o % do limite usado, uma mensagem
// contextual não alarmista e o botão que reaproveita o fluxo de gasto rápido.
function CardSeuDiaFinanceiro({
  carregando, limiteHoje, gastosHoje, gastosCartaoHoje = 0, disponivelHoje,
  onRegistrarGasto, onNaoGasteiHoje, jaFezCheckin, somenteLeitura,
}) {
  const { ocultar } = useOcultarValores()
  if (carregando) {
    return (
      <div className="card">
        <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        <div className="h-20 w-full bg-gray-100 rounded-xl animate-pulse mt-3" />
      </div>
    )
  }

  const temLimite = limiteHoje > 0
  // % do limite diário já utilizado (0–100 para o anel; o número real pode passar
  // de 100 quando estoura, mas o anel satura em 100).
  const pctUsadoReal = temLimite ? (gastosHoje / limiteHoje) * 100 : 0
  const pctAnel = Math.min(100, Math.max(0, pctUsadoReal))
  const pctLabel = Math.round(pctUsadoReal)

  // Cor do anel conforme o uso (laranja = atenção/gastos; vermelho = estourou).
  const corAnel =
    pctUsadoReal > 100 ? '#ef4444'          // red-500
    : pctUsadoReal >= 80 ? '#f59e0b'        // amber-500
    : '#3b82f6'                             // blue-500 (dentro do planejado)

  // Mensagem contextual, não alarmista.
  let mensagem
  if (!temLimite) {
    mensagem = 'Cadastre renda e saldo para acompanhar seu limite diário.'
  } else if (gastosHoje <= 0) {
    mensagem = 'Você ainda não registrou gastos hoje.'
  } else if (gastosHoje > limiteHoje) {
    mensagem = ocultar
      ? 'Você ultrapassou seu planejamento diário de hoje.'
      : `Você ultrapassou seu planejamento diário em ${formatCurrency(gastosHoje - limiteHoje)}.`
  } else {
    mensagem = ocultar
      ? 'Você ainda pode gastar hoje sem comprometer seu planejamento.'
      : `Você ainda pode gastar ${formatCurrency(Math.max(0, disponivelHoje))} hoje sem comprometer seu planejamento.`
  }

  // "Não gastei hoje" só faz sentido quando NÃO houve gasto algum hoje (inclui
  // cartão de crédito, pois gastosHoje já soma à vista + cartão de hoje). Se há
  // qualquer gasto, o botão não aparece.
  const semGastoHoje = gastosHoje <= 0

  return (
    <div className="card">
      <div className="flex items-center gap-3">
        {/* Anel de progresso em CSS (conic-gradient) — sem biblioteca */}
        <div
          className="relative w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: `conic-gradient(${corAnel} ${pctAnel * 3.6}deg, var(--anel-trilha, #2d333b) 0deg)` }}
          role="img"
          aria-label={temLimite ? `${pctLabel}% do limite diário utilizado` : 'Limite diário indisponível'}
        >
          <div className="absolute inset-[5px] rounded-full bg-white flex flex-col items-center justify-center">
            <span className="text-sm font-bold text-gray-900 leading-none">{temLimite ? `${pctLabel}%` : '—'}</span>
            <span className="text-[9px] text-gray-400 leading-none mt-0.5">do limite</span>
          </div>
        </div>

        {/* Gastou até agora × Ainda disponível — próximos ao anel */}
        <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Gastou até agora</p>
            <p className="text-lg font-bold text-gray-900 break-words leading-tight">{exibirMoeda(gastosHoje, ocultar)}</p>
            {gastosCartaoHoje > 0 && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <CreditCard size={11} className="flex-shrink-0" />
                Cartão — {exibirMoeda(gastosCartaoHoje, ocultar)}
              </p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Ainda disponível</p>
            <p className={`text-lg font-bold break-words leading-tight ${disponivelHoje < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {exibirMoeda(Math.max(0, disponivelHoje), ocultar)}
            </p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 mt-2.5">{mensagem}</p>

      {/* O botão "Registrar gasto de hoje" foi movido para logo abaixo do card
          principal (fica visível sem rolar no celular). Aqui mantemos só o
          check-in "Não gastei hoje", quando ainda não houve gasto hoje. */}
      {!somenteLeitura && semGastoHoje && (
        <div className="mt-2.5">
          <button
            onClick={onNaoGasteiHoje}
            disabled={jaFezCheckin}
            className={`w-full flex items-center justify-center gap-2 font-medium text-sm px-4 py-2.5 rounded-lg border transition-colors ${
              jaFezCheckin
                ? 'bg-gray-100 text-gray-400 border-transparent cursor-default'
                : 'bg-transparent text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <Check size={15} /> {jaFezCheckin ? 'Dia sem gastos' : 'Não gastei hoje'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Card "Próximos 7 dias" ───────────────────────────────────────────────────
// Compromissos previstos nos próximos 7 dias, a partir dos dados REAIS já
// carregados: despesas com vencimento no período (inclui recorrentes do mês,
// cuja "data" é o vencimento) + faturas de cartão cujo dia_vencimento cai no
// período (valor = fatura do mês do cartão, FONTE ÚNICA, sem duplicar com as
// despesas). Mostra o total e no máximo os 3 primeiros.
function CardProximos7Dias({ total, itens, onVerTodos }) {
  const { ocultar } = useOcultarValores()
  const tem = itens && itens.length > 0
  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">
        <CalendarClock size={18} className="text-blue-500 flex-shrink-0" />
        <span className="truncate">Próximos 7 dias</span>
      </h2>

      {!tem ? (
        <p className="text-sm text-gray-500 mt-3">Nenhum compromisso previsto para os próximos 7 dias.</p>
      ) : (
        <>
          {/* Total apresentado de forma clara, não isolado no canto. */}
          <p className="text-sm text-gray-600 mt-1">
            <span className="font-semibold text-gray-900">{exibirMoeda(total, ocultar)}</span> em compromissos previstos
          </p>
          <ul className="mt-3 space-y-2">
            {itens.slice(0, 3).map(item => (
              <li key={item.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <div className="min-w-0 flex items-center gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.cor || 'bg-gray-300'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.descricao}</p>
                    <p className="text-xs text-gray-500">{item.quando}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0 whitespace-nowrap">
                  {exibirMoeda(item.valor, ocultar)}
                </span>
              </li>
            ))}
          </ul>
          {onVerTodos && (
            <button
              onClick={onVerTodos}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Ver todos os compromissos <ArrowRight size={14} />
            </button>
          )}
        </>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { perfil, atualizarPreferenciasLimite, somenteLeitura, idUsuarioLogado } = useAuth()
  const { ocultar, alternar } = useOcultarValores()
  const {
    resumoMes, projecao, carregando, receitas, despesas, parcelamentos, criarDespesa,
    // dados brutos para o Horizonte financeiro (fluxo de caixa diário)
    recorrentes, cartoes, comprasCartao, faturasInformadas, reservaPct,
  } = useProjecao()
  // Para gastos no cartão de crédito: grava em compras_cartao (entra na fatura,
  // não desconta do saldo à vista). Demais formas seguem em despesas.
  const { criar: criarCompraCartao } = useComprasCartao()
  // Consultoria — SOMENTE LEITURA aqui, para o card compacto da Home refletir o
  // estado (registrado ou não). O registro de interesse continua acontecendo na
  // página /consultoria (mesma fonte/hook, sem duplicar lógica).
  const { interesses: interessesConsultoria } = useConsultoriaInteresses()
  const jaRegistrouConsultoria = (interessesConsultoria?.length ?? 0) > 0
  const navigate = useNavigate()

  // Dica de 1º acesso para o atalho "Registrar gasto". Guardada por usuário no
  // localStorage: aparece uma vez e some ao ser vista/dispensada ou ao usar o
  // atalho. Não reaparece para o mesmo usuário.
  const CHAVE_DICA_GASTO = `almeida_dica_gasto_${idUsuarioLogado || 'anon'}`
  const [mostrarDicaGasto, setMostrarDicaGasto] = useState(() => {
    try { return localStorage.getItem(CHAVE_DICA_GASTO) !== '1' } catch { return false }
  })
  function dispensarDicaGasto() {
    try { localStorage.setItem(CHAVE_DICA_GASTO, '1') } catch { /* ignora */ }
    setMostrarDicaGasto(false)
  }

  const [modalGasto, setModalGasto] = useState(false)
  const [salvandoGasto, setSalvandoGasto] = useState(false)
  const [erroGasto, setErroGasto] = useState('')
  const [confirmacaoGasto, setConfirmacaoGasto] = useState(null) // { msg, limite }
  // Tela de sucesso DENTRO do modal de gasto (com "Registrar outro"/"Voltar").
  const [gastoSucesso, setGastoSucesso] = useState(null) // { msg } | null
  const [modalLimite, setModalLimite] = useState(false)
  const [salvandoLimite, setSalvandoLimite] = useState(false)
  const [modalReservaAtual, setModalReservaAtual] = useState(false)
  const [salvandoReservaAtual, setSalvandoReservaAtual] = useState(false)
  const [modalSaldo, setModalSaldo] = useState(false)
  const [salvandoSaldo, setSalvandoSaldo] = useState(false)
  const [modalProjecao, setModalProjecao] = useState(false) // detalhes dos 12 meses
  const [modalPlanejamento, setModalPlanejamento] = useState(false) // "Quanto posso gastar?" completo

  // Atalho do botão "+" (menu inferior mobile): ?novo=gasto|reserva abre o
  // modal JÁ existente desta página. Depois limpa o parâmetro da URL.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const novo = searchParams.get('novo')
    if (novo === 'gasto') { setModalGasto(true); searchParams.delete('novo'); setSearchParams(searchParams, { replace: true }) }
    else if (novo === 'reserva') { setModalReservaAtual(true); searchParams.delete('novo'); setSearchParams(searchParams, { replace: true }) }
  }, [searchParams, setSearchParams])

  // "Hoje" ancorado no fuso de Brasília (meio-dia local) — usado em dias
  // restantes do mês, competência do cartão e no "hoje" dos cálculos do dia.
  const hoje = hojeDateBrasil()
  // Saudação automática pelo horário de BRASÍLIA (independe do fuso do aparelho).
  // 05–11: Bom dia | 12–17: Boa tarde | 18–04: Boa noite.
  const horaBrasilia = parseInt(
    new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' })
      .format(new Date()), 10) % 24  // normaliza eventual "24" para 0
  const periodo = horaBrasilia >= 5 && horaBrasilia < 12 ? 'Bom dia'
    : horaBrasilia >= 12 && horaBrasilia < 18 ? 'Boa tarde'
    : 'Boa noite'
  const primeiroNome = perfil?.nome ? perfil.nome.split(' ')[0] : ''
  const saudacao = primeiroNome ? `${periodo}, ${primeiroNome}` : periodo
  // Data de HOJE por extenso (pt-BR), SEMPRE no fuso de Brasília e independente
  // do mês selecionado no Dashboard. Ex.: "terça-feira, 06 de outubro de 2026"
  // (a 1ª letra vira maiúscula pelo CSS "capitalize" no parágrafo).
  const dataHojeExtenso = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date())

  // Aviso de projeção zerada: há dados mas nenhum é recorrente
  const temReceitas = receitas.length > 0
  const temReceitasRecorrentes = receitas.some(r => r.recorrente)
  const temDespesas = despesas.length > 0
  const temDespesasRecorrentes = despesas.some(d => d.recorrente)
  const mostrarAvisoProjecao = !carregando && (
    (temReceitas && !temReceitasRecorrentes) ||
    (temDespesas && !temDespesasRecorrentes)
  )

  // ─── Checklist "Comece por aqui" (primeiro uso) ───
  // Cada item apenas VERIFICA dados que já existem e aponta para o fluxo atual.
  // Não há cadastro novo aqui — reutiliza as telas/rotas existentes.
  const temParcelamentos = (parcelamentos?.length ?? 0) > 0
  // Reserva "concluída": o usuário RESPONDEU a etapa (marcador reserva_configurada,
  // válido inclusive para R$ 0,00 informado conscientemente) OU — retrocompat para
  // contas antigas, antes do marcador existir — já tem valor/meta de reserva.
  const temReserva =
    perfil?.reserva_configurada === true ||
    (Number(perfil?.reserva_atual) || 0) > 0 ||
    (Number(perfil?.meta_reserva) || 0) > 0
  // Ordem: 1) Saldo atual, 2) Receitas, 3) Despesas, 4) Reserva.
  const onboardingItens = [
    { chave: 'saldo',       label: 'Saldo atual',                  to: '/',         concluido: resumoMes.saldoConfigurado },
    { chave: 'renda',       label: 'Receitas futuras',             to: '/receitas', concluido: temReceitas },
    { chave: 'despesas',    label: 'Despesas e contas',            to: '/despesas', concluido: temDespesasRecorrentes },
    { chave: 'reserva',     label: 'Reserva de emergência',        to: '/',         concluido: temReserva },
  ]
  const totalConcluidos = onboardingItens.filter(i => i.concluido).length
  const primeiroPendente = onboardingItens.find(i => !i.concluido)
  // Mostra só até concluir os 4; some automaticamente quando tudo estiver pronto.
  const mostrarComecePorAqui = !carregando && totalConcluidos < onboardingItens.length

  // ─── "Quanto posso gastar?" ───
  // Compromissos do mês = despesas + parcelas + faturas de cartão, SEM duplicar.
  // resumoMes.sobraPrevista = receita − compromissos (já consolidado no useProjecao).
  // Então: compromissosMes = receita − sobraPrevista. A reserva é aplicada no card.
  const receitaMes = resumoMes.receitaTotal
  const compromissosMes = receitaMes - resumoMes.sobraPrevista
  const limiteManual = perfil?.limite_diario ?? null
  const modoLimite = perfil?.modo_limite === 'manual' ? 'manual' : 'auto' // padrão: automático
  const reservaPercentual = perfil?.reserva_percentual ?? 20 // padrão 20%
  // Valor JÁ guardado como reserva (patrimônio). NÃO entra em renda/disponível.
  const reservaAtual = Number(perfil?.reserva_atual) || 0
  // Meta TOTAL da reserva (objetivo). Também apenas informativa.
  const metaReserva = Number(perfil?.meta_reserva) || 0
  // ─── Saldo atual real (derivado no useProjecao) ───
  const saldoConfigurado = resumoMes.saldoConfigurado
  const saldoDisponivelAgora = resumoMes.saldoDisponivelAgora
  const previsaoFimMes = resumoMes.previsaoFimMes
  const compromissosFuturosMes = resumoMes.compromissosFuturosMes
  const carregandoLimite = carregando

  // ─── "Quanto posso gastar hoje?" (card destaque) ───
  const hojeISO = hojeISOBrasil() // 'YYYY-MM-DD' no fuso de Brasília
  // Limite diário de hoje — MESMA fonte do card detalhado (calcularLimiteDiario).
  const limiteHoje = calcularLimiteDiario({
    receitaMes,
    compromissosMes,
    reservaPct: reservaPercentual,
    modo: modoLimite,
    limiteManual,
    hoje,
    baseLivre: saldoConfigurado ? previsaoFimMes : undefined,
  })
  // Gastos de HOJE (à vista): despesas não-recorrentes com data de hoje.
  // Usa os dados já em memória — mesmo padrão do saldo disponível.
  const gastosAvistaHoje = despesas
    .filter(d => d.data === hojeISO && !d.recorrente)
    .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

  // Gastos de HOJE no CARTÃO DE CRÉDITO: compras lançadas em compras_cartao com
  // data_compra = hoje. IMPORTANTE (sem duplicidade e por competência):
  //  - usamos SOMENTE o valor da PARCELA do mês atual (parcelaCompraNoMes), não
  //    o valor total. Assim, uma compra de R$1.200 em 12x entra como ~R$100 hoje,
  //    e não R$1.200. À vista entra pelo valor cheio.
  //  - isto é apenas o reflexo em "Gastos de hoje"/"Disponível hoje". A compra
  //    continua projetada na fatura/orçamento do mês pela MESMA fonte única
  //    (faturasNoMes/totalFaturaComOverride), que já evita a dupla contagem
  //    entre compra e fatura. Não tocamos no saldo bancário (saldo_base).
  const anoHojeNum = hoje.getFullYear()
  const mesHojeNum = hoje.getMonth() + 1
  const gastosCartaoHoje = (comprasCartao || [])
    .filter(c => c.data_compra === hojeISO)
    .reduce((acc, c) => {
      const cartao = (cartoes || []).find(ct => ct.id === c.cartao_id)
      if (!cartao) return acc
      const p = parcelaCompraNoMes(c, cartao.dia_fechamento, anoHojeNum, mesHojeNum)
      return acc + (p ? p.valor : 0)
    }, 0)

  // Total exibido em "Gastos de hoje" = à vista + cartão de crédito de hoje.
  const gastosDeHoje = gastosAvistaHoje + gastosCartaoHoje
  const disponivelHoje = limiteHoje - gastosDeHoje

  // Check-in "Não gastei hoje": registro LOCAL por data (não cria despesa).
  const CHAVE_CHECKIN = 'almeida_checkin_sem_gasto'
  const [checkinData, setCheckinData] = useState(() => {
    try { return localStorage.getItem(CHAVE_CHECKIN) || '' } catch { return '' }
  })
  const jaFezCheckin = checkinData === hojeISO
  function marcarNaoGasteiHoje() {
    try { localStorage.setItem(CHAVE_CHECKIN, hojeISO) } catch { /* ignora */ }
    setCheckinData(hojeISO)
    setConfirmacaoGasto({
      msg: '✓ Dia sem gastos registrado. Continue assim!',
      limite: Math.max(0, limiteHoje),
    })
  }

  // ─── Próximos vencimentos ───
  // Despesas com data futura próxima (amanhã até +7 dias), dentro do que já foi
  // carregado do mês. Rótulo "Vence amanhã" / "Vence em X dias" / data.
  // ─── "Próximos 7 dias" (card da Home) ───
  // Compromissos previstos nos próximos 7 dias a partir dos dados REAIS, SEM
  // duplicar. Duas fontes complementares, que não se sobrepõem:
  //   (1) despesas com vencimento (data) em [hoje+1 .. hoje+7] — inclui as
  //       recorrentes do mês (a "data" é o vencimento). Despesas pagas via
  //       cartão de crédito NÃO entram em "despesas", então não há sobreposição
  //       com a fatura abaixo.
  //   (2) faturas de cartão: para cada cartão, se o dia_vencimento cair no
  //       período, uma linha com o TOTAL da fatura do mês (fonte única
  //       totalFaturaComOverride — mesma do orçamento, nunca somada às compras).
  const proximos7Dias = (() => {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const limiteDias = 7
    const rotuloQuando = (diffDias) =>
      diffDias === 1 ? 'Amanhã' : `Em ${diffDias} dias`

    // (1) Despesas por vencimento
    const deDespesas = (despesas || [])
      .map(d => {
        if (!d.data) return null
        const dt = new Date(d.data + 'T12:00:00')
        const dataDia = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
        const diffDias = Math.round((dataDia - base) / 86400000)
        if (diffDias < 1 || diffDias > limiteDias) return null
        return {
          id: `desp-${d.id}`,
          descricao: d.descricao || 'Despesa',
          valor: Number(d.valor) || 0,
          diffDias,
          quando: rotuloQuando(diffDias),
          cor: 'bg-red-400',
        }
      })
      .filter(Boolean)

    // (2) Faturas de cartão por dia_vencimento dentro do período
    const deFaturas = (cartoes || [])
      .map(c => {
        const diaVenc = Number(c.dia_vencimento)
        if (!(diaVenc >= 1 && diaVenc <= 31)) return null
        // Próxima ocorrência do dia de vencimento a partir de amanhã.
        let venc = new Date(base.getFullYear(), base.getMonth(), diaVenc)
        if (venc <= base) venc = new Date(base.getFullYear(), base.getMonth() + 1, diaVenc)
        const diffDias = Math.round((venc - base) / 86400000)
        if (diffDias < 1 || diffDias > limiteDias) return null
        const comprasDoCartao = (comprasCartao || []).filter(cp => cp.cartao_id === c.id)
        const parcelamentosDoCartao = (parcelamentos || []).filter(p => p.cartao_id === c.id)
        // Fatura referente à competência do mês de vencimento.
        const total = totalFaturaComOverride(
          comprasDoCartao, parcelamentosDoCartao, faturasInformadas,
          c.id, c.dia_fechamento, venc.getFullYear(), venc.getMonth() + 1
        )
        if (total <= 0) return null
        return {
          id: `fat-${c.id}`,
          descricao: `Cartão de crédito${c.nome ? ` — ${c.nome}` : ''}`,
          valor: total,
          diffDias,
          quando: rotuloQuando(diffDias),
          cor: 'bg-blue-400',
        }
      })
      .filter(Boolean)

    return [...deDespesas, ...deFaturas].sort((a, b) => a.diffDias - b.diffDias)
  })()
  const totalProximos7 = proximos7Dias.reduce((acc, i) => acc + (Number(i.valor) || 0), 0)

  // ─── Handler do Gasto rápido ───
  async function handleSalvarGasto(dados, categoriaNome) {
    setSalvandoGasto(true)
    setErroGasto('')
    try {
      const valorGasto = Number(dados.valor) || 0
      const noCartaoCredito = dados.forma_pagamento === 'cartao_credito' && dados.cartao_id

      if (noCartaoCredito) {
        // ── Gasto no CARTÃO DE CRÉDITO ──
        // Grava como compra à vista (1x) em compras_cartao. A fatura é projetada
        // pela regra de fechamento (faturaCartao). NÃO entra em "despesas", logo
        // NÃO desconta do saldo disponível agora — evita lançamento duplicado.
        await criarCompraCartao({
          cartao_id: dados.cartao_id,
          descricao: dados.descricao,
          valor_total: valorGasto,
          data_compra: dados.data, // hoje
          numero_parcelas: 1,
          categoria_id: dados.categoria_id || null,
        })
        // Sucesso: mantém o modal aberto mostrando a tela de confirmação.
        setGastoSucesso({ msg: `${formatCurrency(valorGasto)} lançado na fatura do cartão` })
        return
      }

      // ── Demais formas (Pix, dinheiro, débito, boleto, etc.) ──
      // Fluxo atual: grava em despesas (à vista, hoje) e desconta do saldo.
      // Remove campos que não são colunas de "despesas".
      const { cartao_id, ...despesa } = dados
      await criarDespesa(despesa)   // atualiza o estado interno → indicadores recalculam
      // Sucesso: mantém o modal aberto mostrando a tela de confirmação.
      setGastoSucesso({ msg: `${formatCurrency(valorGasto)} registrado em ${categoriaNome}` })
    } catch {
      setErroGasto('Erro ao salvar o gasto. Tente novamente.')
    } finally {
      setSalvandoGasto(false)
    }
  }

  // Abre o cadastro COMPLETO de despesas (todos os campos avançados já existentes).
  function handleMaisOpcoes() {
    setModalGasto(false)
    navigate('/despesas?novo=1')
  }

  // A confirmação do gasto rápido some sozinha após alguns segundos.
  useEffect(() => {
    if (!confirmacaoGasto) return
    const t = setTimeout(() => setConfirmacaoGasto(null), 5000)
    return () => clearTimeout(t)
  }, [confirmacaoGasto])

  // ─── Handlers do limite / modo / reserva ───
  async function handleTrocarModo(novoModo) {
    try {
      await atualizarPreferenciasLimite({ modo_limite: novoModo })
    } catch {
      // silencioso para não quebrar o layout
    }
  }

  async function handleTrocarReserva(pct) {
    // Propaga o erro para o card tratar (ex: coluna ausente no banco).
    // A UI já atualiza de forma otimista no próprio card.
    await atualizarPreferenciasLimite({ reserva_percentual: pct })
  }

  async function handleSalvarLimite(valor) {
    setSalvandoLimite(true)
    setErroGasto('')
    try {
      // Salvar um limite manual também fixa o modo em "manual"
      await atualizarPreferenciasLimite({ limite_diario: valor, modo_limite: 'manual' })
      setModalLimite(false)
    } catch {
      // Mostra o erro (em vez de falhar em silêncio): o motivo mais provável é
      // o banco ainda não ter as colunas limite_diario / modo_limite.
      setModalLimite(false)
      setErroGasto('Não foi possível salvar seu gasto diário. Verifique se o banco tem as colunas "limite_diario" e "modo_limite".')
    } finally {
      setSalvandoLimite(false)
    }
  }

  // Salva o saldo atual informado pelo usuário. Grava o valor E a data de hoje
  // como novo marco (reconciliação), evitando reaplicar histórico anterior.
  async function handleSalvarSaldo(valor) {
    setSalvandoSaldo(true)
    try {
      await atualizarPreferenciasLimite({
        saldo_base: valor,
        saldo_base_data: hojeISOBrasil(),
      })
      setModalSaldo(false) // fecha só em caso de sucesso
    } catch (err) {
      // Relança para o ModalSaldo exibir a mensagem (ex.: coluna ausente).
      throw err
    } finally {
      setSalvandoSaldo(false)
    }
  }

  // Salva o valor JÁ guardado e a META da reserva (ambos patrimônio/objetivo).
  // Não afetam nenhum cálculo financeiro — são apenas informativos.
  async function handleSalvarReservaAtual({ reserva_atual, meta_reserva }) {
    setSalvandoReservaAtual(true)
    try {
      await atualizarPreferenciasLimite({ reserva_atual, meta_reserva })
      setModalReservaAtual(false)
    } catch {
      // mantém o modal aberto; erro silencioso para não quebrar o layout
    } finally {
      setSalvandoReservaAtual(false)
    }
  }

  // Reabre o onboarding (mesmo fluxo do 1º acesso) na etapa pendente escolhida.
  // Não cria dados novos: grava a flag que o AreaAutenticada (App.jsx) observa e
  // abre o <Onboarding/> — e informa em qual etapa começar. Reutiliza o mesmo
  // mecanismo de "Refazer configuração" das Configurações, sem duplicar lógica.
  function continuarConfiguracao(chave) {
    try {
      localStorage.setItem(CHAVE_REFAZER, '1')
      if (chave) localStorage.setItem(CHAVE_ETAPA_ONBOARDING, chave)
      else localStorage.removeItem(CHAVE_ETAPA_ONBOARDING)
    } catch { /* ignora indisponibilidade do localStorage */ }
    // Dispara o 'storage' manualmente nesta mesma aba (o evento nativo só chega
    // em OUTRAS abas) para o AreaAutenticada reagir imediatamente.
    try { window.dispatchEvent(new Event('almeida-refazer-onboarding')) } catch { /* ignora */ }
    navigate('/')
  }

  // ─── Resumo do Horizonte Financeiro (reaproveita o MESMO motor do Horizonte,
  // gerarHorizonte — sem cálculo paralelo). Deriva: saldo atual, saldo no fim do
  // mês, saldo no próximo mês e a 1ª data (nos próximos 30 dias) em que o saldo
  // projetado fica negativo, se houver. */
  const horizonteResumo = (() => {
    if (carregando) return null
    const saldoInicial = resumoMes.saldoConfigurado ? resumoMes.saldoDisponivelAgora : 0
    const meses = gerarHorizonte({
      receitas, despesas, recorrentes, parcelamentos,
      cartoes, comprasCartao, faturasInformadas,
      saldoInicial, reservaPct, meses: 3,
    })
    if (!meses.length) return null
    const saldoAtual = meses[0].saldoInicial
    const fimDoMes = meses[0].saldoFinal
    const proximoMes = meses[1]?.saldoFinal ?? fimDoMes

    // Primeiro dia (de hoje até +30 dias) com saldo projetado negativo.
    const hojeData = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const limite = new Date(hojeData); limite.setDate(limite.getDate() + 30)
    let dataNegativa = null
    for (const m of meses) {
      for (const d of m.dias) {
        const dataDia = new Date(m.ano, m.mes - 1, d.dia)
        if (dataDia < hojeData || dataDia > limite) continue
        if (d.saldo < 0) { dataNegativa = dataDia; break }
      }
      if (dataNegativa) break
    }
    return { saldoAtual, fimDoMes, proximoMes, dataNegativa }
  })()
  const fmtDiaMes = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

  return (
    // pb extra no MOBILE: garante que o último card ("Seu dia financeiro" com o
    // botão "Registrar gasto de hoje") role totalmente acima da barra inferior
    // fixa (que tem o botão "+" saliente). Zera no desktop (md:pb-0).
    <div className="space-y-5 pb-24 md:pb-0">
      {/* 1 ─ Saudação (horário de Brasília) + botão global de ocultar valores.
          Enxuto, sem ocupar altura excessiva. */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 truncate">{saudacao}</h1>
          <p className="text-sm text-gray-500 capitalize truncate">{dataHojeExtenso}</p>
        </div>
        <button
          onClick={alternar}
          aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
          className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-colors"
        >
          {ocultar ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {/* Card "Complete sua configuração" — NO TOPO enquanto a configuração não
          está 100% concluída. Some ao concluir os 4 itens. Oculto no modo
          consultoria (somente leitura). */}
      {mostrarComecePorAqui && !somenteLeitura && (
        <CardComecePorAqui
          itens={onboardingItens}
          totalConcluidos={totalConcluidos}
          onIrPara={(item) => continuarConfiguracao(item?.chave)}
          onContinuar={() => continuarConfiguracao(primeiroPendente?.chave)}
        />
      )}

      {erroGasto && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroGasto}</p>
      )}

      {/* Confirmação curta do gasto rápido + limite diário restante */}
      {confirmacaoGasto && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-green-700">{confirmacaoGasto.msg}</p>
          <p className="text-xs text-green-600 mt-0.5">
            Você ainda pode gastar {exibirMoeda(confirmacaoGasto.limite, ocultar)} hoje.
          </p>
        </div>
      )}

      {/* 2 ─ PRINCIPAL e ÚNICO: "Quanto posso gastar?" (card azul). Unifica o
          disponível de HOJE + o disponível no MÊS + status, e abre o
          planejamento completo no modal. */}
      <CardGastoHoje
        carregando={carregando}
        limiteHoje={limiteHoje}
        modo={modoLimite}
        receitaMes={receitaMes}
        compromissosMes={compromissosMes}
        limiteManual={limiteManual}
        hoje={hoje}
        reservaPercentual={reservaPercentual}
        saldoConfigurado={saldoConfigurado}
        previsaoFimMes={previsaoFimMes}
        onVerCompleto={() => setModalPlanejamento(true)}
      />

      {/* 2b ─ Ação principal "Registrar gasto de hoje" logo abaixo do card, para
          ficar visível sem rolar no celular. Mesma função do botão que ficava
          no card "Seu dia financeiro" (setModalGasto → modal de gasto rápido).
          Oculto no modo consultoria (somente leitura). */}
      {!somenteLeitura && (
        <button
          onClick={() => setModalGasto(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus size={16} strokeWidth={2.5} /> Registrar gasto de hoje
        </button>
      )}

      {/* Dica de 1º acesso para o atalho "Registrar gasto" (some ao dispensar
          ou ao usar o atalho; não reaparece para o mesmo usuário). */}
      {!somenteLeitura && mostrarDicaGasto && (
        <div className="flex items-start gap-2.5 bg-marca-100 border border-marca/20 rounded-xl px-3 py-2.5">
          <Zap size={16} className="text-marca flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 flex-1 min-w-0">
            Comprou alguma coisa? Registre seu gasto aqui.
          </p>
          <button
            onClick={dispensarDicaGasto}
            aria-label="Dispensar dica"
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 3 ─ Atalhos rápidos — reaproveitam os fluxos JÁ existentes (modais/rotas),
          sem duplicar lógica. Ocultos no modo consultoria (somente leitura). */}
      {!somenteLeitura && (
      <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
        {[
          { label: 'Receita',  icon: TrendingUp,   cor: 'text-green-500',  anel: 'bg-green-500/10',  onClick: () => navigate('/receitas?novo=1') },
          { label: 'Despesa',  icon: TrendingDown, cor: 'text-red-500',    anel: 'bg-red-500/10',    onClick: () => navigate('/despesas?novo=1') },
          { label: 'Registrar gasto', curto: 'Registrar', icon: Zap, cor: 'text-amber-500', anel: 'bg-amber-500/10', onClick: () => { dispensarDicaGasto(); setModalGasto(true) } },
          { label: 'Cartão',   icon: CreditCard,   cor: 'text-blue-500',   anel: 'bg-blue-500/10',   onClick: () => navigate('/cartoes') },
          { label: 'Reserva',  icon: PiggyBank,    cor: 'text-violet-500', anel: 'bg-violet-500/10', onClick: () => setModalReservaAtual(true) },
        ].map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            aria-label={a.label}
            className="group flex flex-col items-center justify-center gap-1.5 min-w-0 rounded-xl bg-gray-100 border border-gray-200 py-2.5 px-1 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md hover:shadow-black/20 active:translate-y-0"
          >
            <span className={`w-8 h-8 rounded-full ${a.anel} flex items-center justify-center`}>
              <a.icon size={17} className={a.cor} />
            </span>
            <span className="text-[11px] font-medium text-gray-600 group-hover:text-gray-800 truncate w-full text-center transition-colors">{a.curto || a.label}</span>
          </button>
        ))}
      </div>
      )}

      {/* 3b ─ Posso Comprar? (simulador) — logo após os atalhos. */}
      <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={20} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-900 font-semibold">Posso Comprar?</p>
            <p className="text-gray-500 text-sm">Veja se cabe no seu orçamento.</p>
          </div>
        </div>
        <Link
          to="/posso-comprar"
          className="flex items-center gap-2 bg-marca hover:bg-marca-hover text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors whitespace-nowrap flex-shrink-0"
        >
          Simular compra <ArrowRight size={16} className="text-white" />
        </Link>
      </div>

      {/* 4 ─ Seu dia financeiro (anel do % do limite + gastou/disponível) */}
      <CardSeuDiaFinanceiro
        carregando={carregando}
        limiteHoje={limiteHoje}
        gastosHoje={gastosDeHoje}
        gastosCartaoHoje={gastosCartaoHoje}
        disponivelHoje={disponivelHoje}
        onRegistrarGasto={() => setModalGasto(true)}
        onNaoGasteiHoje={marcarNaoGasteiHoje}
        jaFezCheckin={jaFezCheckin}
        somenteLeitura={somenteLeitura}
      />

      {/* 5 ─ Próximos 7 dias (compromissos reais: despesas + faturas) */}
      {!carregando && (
        <CardProximos7Dias
          total={totalProximos7}
          itens={proximos7Dias}
          onVerTodos={() => navigate('/despesas')}
        />
      )}

      {/* 6 ─ Horizonte Financeiro (card-resumo + acesso ao Horizonte completo) */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">
            <BarChart2 size={18} className="text-blue-500 flex-shrink-0" />
            <span className="truncate">Horizonte Financeiro</span>
          </h2>
          <button
            type="button"
            onClick={() => setModalProjecao(true)}
            disabled={carregando || projecao.length === 0}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            Ver completo <ArrowRight size={14} />
          </button>
        </div>

        {/* Resumo do Horizonte: Saldo atual / Fim do mês / Próximo mês + status
            real (data de saldo negativo), reaproveitando gerarHorizonte. */}
        {horizonteResumo && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 min-w-0">
                <p className="text-xs text-gray-400">Saldo atual</p>
                <p className={`text-base sm:text-lg font-bold leading-tight break-words ${horizonteResumo.saldoAtual >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  {exibirMoeda(horizonteResumo.saldoAtual, ocultar)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 min-w-0">
                <p className="text-xs text-gray-400">Fim do mês</p>
                <p className={`text-base sm:text-lg font-bold leading-tight break-words ${horizonteResumo.fimDoMes >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  {exibirMoeda(horizonteResumo.fimDoMes, ocultar)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 min-w-0">
                <p className="text-xs text-gray-400">Próximo mês</p>
                <p className={`text-base sm:text-lg font-bold leading-tight break-words ${horizonteResumo.proximoMes >= 0 ? 'text-gray-900' : 'text-red-500'}`}>
                  {exibirMoeda(horizonteResumo.proximoMes, ocultar)}
                </p>
              </div>
            </div>

            {/* Status inteligente baseado nos dados reais do Horizonte */}
            {horizonteResumo.dataNegativa ? (
              <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
                <AlertTriangle size={16} className="flex-shrink-0" />
                <span>Saldo pode ficar negativo em {fmtDiaMes(horizonteResumo.dataNegativa)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>Saldo positivo nos próximos 30 dias</span>
              </div>
            )}
          </>
        )}

        <div className="mt-4 pt-4 border-t border-gray-200" />

        {/* Aviso quando não há itens recorrentes cadastrados */}
        {mostrarAvisoProjecao && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <span className="text-amber-500 text-base leading-none flex-shrink-0">⚠️</span>
            <div className="text-xs text-amber-800">
              <p className="font-semibold mb-0.5">A projeção dos próximos meses pode estar zerada.</p>
              <p>
                {!temReceitasRecorrentes && temReceitas && 'Nenhuma receita marcada como recorrente. '}
                {!temDespesasRecorrentes && temDespesas && 'Nenhuma despesa marcada como recorrente. '}
                Ao cadastrar, indique se o lançamento <strong>se repete todo mês</strong> para que apareça na projeção futura.
              </p>
              <div className="flex gap-3 mt-2">
                {!temReceitasRecorrentes && temReceitas && (
                  <Link to="/receitas" className="font-semibold underline hover:text-amber-900">
                    Revisar receitas →
                  </Link>
                )}
                {!temDespesasRecorrentes && temDespesas && (
                  <Link to="/despesas" className="font-semibold underline hover:text-amber-900">
                    Revisar despesas →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : projecao.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-sm text-gray-500">Cadastre receitas e despesas para ver a projeção.</p>
            <Link to="/receitas" className="mt-2 text-sm text-blue-600 hover:underline">Cadastrar receitas</Link>
          </div>
        ) : (
          <ResumoProjecao projecao={projecao} />
        )}
      </div>

      {/* 7 ─ Consultoria (card compacto; estado reflete o registro — ação na
          página /consultoria, sem duplicar a lógica de interesse). Oculto no
          modo consultoria (somente leitura). */}
      {!somenteLeitura && (
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageCircle size={19} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-gray-900 leading-snug">
                Consultoria financeira com Matheus Almeida
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Planejamento personalizado para organizar sua vida financeira.
              </p>

              {jaRegistrouConsultoria ? (
                <div className="flex items-center gap-2 mt-3">
                  <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                  <p className="text-sm text-gray-600 min-w-0">
                    <span className="font-medium text-gray-800">Interesse registrado.</span>{' '}
                    Você será avisado pelo WhatsApp quando houver disponibilidade.
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => navigate('/consultoria')}
                  className="btn-primary mt-3 inline-flex items-center justify-center gap-2 text-sm"
                >
                  Quero saber mais sobre a consultoria <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Apoio (abaixo da hierarquia principal) ── */}

      {/* Resumo do mês: Receitas, Despesas, Disponível, Gasto diário, Reserva. */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Resumo do mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard
            title="Receitas"
            value={resumoMes.receitaTotal}
            icon={TrendingUp}
            color="text-green-600"
            bgColor="bg-green-50"
            subtitle={carregando ? '' : `${resumoMes.qtdReceitas} receita${resumoMes.qtdReceitas !== 1 ? 's' : ''}`}
            carregando={carregando}
          />
          <SummaryCard
            title="Despesas"
            value={resumoMes.despesaTotal}
            icon={TrendingDown}
            color="text-red-500"
            bgColor="bg-red-50"
            subtitle={carregando ? '' : `${resumoMes.qtdDespesas} despesa${resumoMes.qtdDespesas !== 1 ? 's' : ''}`}
            carregando={carregando}
          />
          <SummaryCard
            title="Disponível para gastar"
            value={resumoMes.sobraPrevista}
            icon={Wallet}
            color={resumoMes.sobraPrevista >= 0 ? 'text-blue-600' : 'text-red-600'}
            bgColor={resumoMes.sobraPrevista >= 0 ? 'bg-blue-50' : 'bg-red-50'}
            subtitle={carregando ? '' : 'No mês, após compromissos'}
            carregando={carregando}
          />
          <SummaryCard
            title="Gasto diário sugerido"
            value={Math.max(0, limiteHoje)}
            icon={Sun}
            color="text-amber-600"
            bgColor="bg-amber-50"
            subtitle={carregando ? '' : 'Por dia até o fim do mês'}
            carregando={carregando}
          />
          <SummaryCard
            title="Reserva de emergência"
            value={reservaAtual}
            icon={PiggyBank}
            color="text-amber-600"
            bgColor="bg-amber-50"
            subtitle={carregando ? '' : (metaReserva > 0 ? `Meta: ${formatCurrency(metaReserva)}` : 'Sem meta definida')}
            carregando={carregando}
          />
        </div>
      </div>

      {/* Saldo disponível agora + Previsão até o fim do mês.
          A reserva de emergência NÃO entra aqui. */}
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
                  <p className={`text-3xl font-bold ${saldoDisponivelAgora >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {exibirMoeda(saldoDisponivelAgora, ocultar)}
                  </p>
                </div>
                <button
                  onClick={() => setModalSaldo(true)}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 flex-shrink-0 mt-1"
                >
                  <Pencil size={13} /> Atualizar saldo
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Saldo previsto no fim do mês</p>
                  <p className={`text-lg font-bold ${previsaoFimMes >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    {exibirMoeda(previsaoFimMes, ocultar)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">Compromissos a pagar</p>
                  <p className="text-lg font-bold text-red-500">{exibirMoeda(compromissosFuturosMes, ocultar)}</p>
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
              <button onClick={() => setModalSaldo(true)}
                className="btn-primary flex items-center justify-center gap-2 flex-shrink-0">
                <Wallet size={16} /> Informar saldo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: planejamento completo "Quanto posso gastar?" — todos os detalhes
          (modos, reserva, renda/compromissos/disponível, ajuste diário, meta,
          progresso e previsão) ficam aqui, fora da visão principal da Home.
          Reutiliza o MESMO componente/cálculos — nada foi removido. */}
      <Modal aberto={modalPlanejamento} onFechar={() => setModalPlanejamento(false)} titulo="Planejamento completo">
        <CardQuantoPossoGastar
          carregando={carregandoLimite}
          modo={modoLimite}
          onTrocarModo={handleTrocarModo}
          receitaMes={receitaMes}
          compromissosMes={compromissosMes}
          limiteManual={limiteManual}
          onEditarLimite={() => setModalLimite(true)}
          hoje={hoje}
          reservaPercentual={reservaPercentual}
          reservaAtual={reservaAtual}
          metaReserva={metaReserva}
          onEditarReservaAtual={() => setModalReservaAtual(true)}
          onTrocarReserva={handleTrocarReserva}
          saldoConfigurado={saldoConfigurado}
          previsaoFimMes={previsaoFimMes}
        />
      </Modal>

      {/* Modal: Horizonte financeiro (fluxo de caixa diário) — abre pelo "Ver detalhes".
          Painel mais largo (tamanho="lg") para os 5 indicadores do resumo caberem
          lado a lado no desktop sem sobreposição. */}
      <Modal aberto={modalProjecao} onFechar={() => setModalProjecao(false)} titulo="Horizonte financeiro" tamanho="lg">
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
      </Modal>

      {/* Modal de Gasto rápido — mostra o formulário OU a tela de sucesso. */}
      <Modal
        aberto={modalGasto}
        onFechar={() => { setModalGasto(false); setGastoSucesso(null) }}
        titulo={gastoSucesso ? 'Tudo certo!' : 'Registrar gasto'}
      >
        {gastoSucesso ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <p className="text-base font-semibold text-gray-900">Gasto registrado com sucesso!</p>
            <p className="text-sm text-gray-500 mt-1">{gastoSucesso.msg}</p>
            <div className="flex flex-col sm:flex-row gap-2 mt-5">
              <button
                onClick={() => setGastoSucesso(null)}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Plus size={16} strokeWidth={2.5} /> Registrar outro gasto
              </button>
              <button
                onClick={() => { setModalGasto(false); setGastoSucesso(null) }}
                className="btn-secondary flex-1"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        ) : (
          <FormGastoRapido
            onSalvar={handleSalvarGasto}
            onCancelar={() => setModalGasto(false)}
            carregando={salvandoGasto}
            onMaisOpcoes={handleMaisOpcoes}
          />
        )}
      </Modal>

      {/* Modal de edição do limite diário */}
      <ModalLimiteDiario
        aberto={modalLimite}
        onFechar={() => setModalLimite(false)}
        valorAtual={limiteManual}
        onSalvar={handleSalvarLimite}
        salvando={salvandoLimite}
      />

      <ModalReservaAtual
        aberto={modalReservaAtual}
        onFechar={() => setModalReservaAtual(false)}
        valorAtual={reservaAtual}
        metaAtual={metaReserva}
        onSalvar={handleSalvarReservaAtual}
        salvando={salvandoReservaAtual}
      />

      <ModalSaldo
        aberto={modalSaldo}
        onFechar={() => setModalSaldo(false)}
        valorAtual={perfil?.saldo_base}
        onSalvar={handleSalvarSaldo}
        salvando={salvandoSaldo}
      />
    </div>
  )
}
