import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Sun, Plus, Pencil,
  CheckCircle2, Circle, Rocket, Eye, EyeOff, Check, CalendarClock, PiggyBank, AlertTriangle, MessageCircle, BarChart2,
  Receipt, Target, Bell, Moon
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

// (O resumo compacto "Quanto posso gastar?" foi substituído: o essencial do mês
//  vive agora no card azul do limite diário e os detalhes no planejamento completo.)

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
// Card PRINCIPAL e ÚNICO do limite diário (visual azul). Consolida tudo o que
// o usuário precisa ver sobre "quanto posso gastar hoje", sem repetir cards:
//   • Limite diário (limiteHoje) em destaque.
//   • Anel de progresso com o % do limite JÁ utilizado hoje.
//   • Gasto de HOJE e valor RESTANTE (disponível) de hoje.
//   • Lápis para editar o limite (abre o planejamento com Automático/Personalizado).
//   • Disponível no MÊS + status real do orçamento como apoio.
// Reaproveita os MESMOS cálculos (limiteHoje, gastosHoje, disponivelHoje,
// derivarResumoGastar) — nada é recalculado aqui.
function CardGastoHoje({
  carregando, limiteHoje, onVerCompleto, onEditarLimite,
  gastosHoje = 0, gastosCartaoHoje = 0, disponivelHoje = 0,
  modo, receitaMes, compromissosMes, limiteManual, hoje,
  reservaPercentual, saldoConfigurado = false, previsaoFimMes = 0,
  mostrarCheckin = false, jaFezCheckin = false, onNaoGasteiHoje,
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
  // regra).
  const pct = reservaPercentual != null ? Number(reservaPercentual) : 20
  const { disponivelMes, status, orcamentoNegativo } = derivarResumoGastar({
    modo, receitaMes, compromissosMes, limiteManual, hoje,
    pct, saldoConfigurado, previsaoFimMes,
  })
  // Pontinho de status (semântico) legível sobre o azul.
  const corStatus = status?.cor === '🔴' ? 'bg-red-300'
    : status?.cor === '🟡' ? 'bg-amber-300'
    : 'bg-green-300'

  // Anel do limite diário: % JÁ utilizado hoje (satura em 100 no anel, mas o
  // rótulo pode passar de 100% quando estoura o limite).
  const temLimite = limiteHoje > 0
  const pctUsadoReal = temLimite ? (gastosHoje / limiteHoje) * 100 : 0
  const pctAnel = Math.min(100, Math.max(0, pctUsadoReal))
  const pctLabel = Math.round(pctUsadoReal)
  // Cor do anel: branco dentro do planejado; amarelo em atenção; vermelho ao estourar.
  const corAnel =
    pctUsadoReal > 100 ? '#fecaca'          // red-200
    : pctUsadoReal >= 80 ? '#fde68a'        // amber-200
    : 'rgba(255,255,255,0.95)'

  return (
    <div className="bg-marca-grad rounded-2xl p-2.5 sm:p-4 lg:p-4 lg:shadow-lg lg:shadow-black/5 text-white">
      {/* Compacto: anel do % à esquerda + limite diário em destaque com Editar.
          Sem o "Resumo do mês" (movido para a aba Planejamento). No desktop
          (lg) cresce um pouco, mantendo a Home dentro de uma tela. */}
      <div className="flex items-center gap-3 sm:gap-4 lg:gap-5">
        {/* Anel do % utilizado */}
        <div className="flex-shrink-0">
          <div
            className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-[72px] lg:h-[72px] rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(${corAnel} ${pctAnel * 3.6}deg, rgba(0,0,0,0.18) 0deg)` }}
            role="img"
            aria-label={temLimite ? `${pctLabel}% do limite diário utilizado` : 'Limite diário indisponível'}
          >
            <div className="absolute inset-[5px] lg:inset-[6px] rounded-full bg-marca flex flex-col items-center justify-center">
              <span className="text-sm lg:text-lg font-bold leading-none">{temLimite ? `${pctLabel}%` : '—'}</span>
              <span className="text-[9px] lg:text-[10px] text-white/70 leading-none mt-0.5">usado</span>
            </div>
          </div>
        </div>
        {/* Limite diário + Editar */}
        <div className="min-w-0 flex-1">
          <p className="hidden lg:block text-sm text-white/80 mb-0.5">Limite para gastar hoje</p>
          <div className="flex items-center gap-1.5 lg:gap-2">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight break-words min-w-0">
              {exibirMoeda(Math.max(0, limiteHoje), ocultar)}
            </p>
            {onEditarLimite && (
              <button
                onClick={onEditarLimite}
                aria-label="Editar limite diário"
                className="inline-flex items-center text-white/80 hover:text-white flex-shrink-0"
              >
                <Pencil size={14} className="lg:hidden" />
                <Pencil size={18} className="hidden lg:block" />
              </button>
            )}
          </div>
          <p className="text-xs lg:text-sm text-white/80 mt-0.5">Sem comprometer seu planejamento</p>
        </div>
        {/* Status do orçamento (compacto, quando couber) */}
        {status && (
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 bg-black/15 rounded-full px-2.5 py-1 lg:px-3 lg:py-1.5 self-start">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${corStatus}`} />
            <span className="text-xs lg:text-sm font-medium text-white/90">{status.texto}</span>
          </div>
        )}
      </div>

      {/* Gasto de hoje × restante */}
      <div className="grid grid-cols-2 gap-2.5 lg:gap-3 mt-2.5 lg:mt-3">
        <div className="bg-black/15 rounded-xl px-3 py-1.5 lg:px-4 lg:py-2 min-w-0">
          <p className="text-xs lg:text-sm text-white/70">Gasto de hoje</p>
          <p className="text-base sm:text-lg lg:text-xl font-bold leading-tight break-words">{exibirMoeda(gastosHoje, ocultar)}</p>
          {gastosCartaoHoje > 0 && (
            <p className="text-[11px] lg:text-xs text-white/70 flex items-center gap-1 mt-0.5">
              <CreditCard size={11} className="flex-shrink-0" />
              Cartão — {exibirMoeda(gastosCartaoHoje, ocultar)}
            </p>
          )}
        </div>
        <div className="bg-black/15 rounded-xl px-3 py-1.5 lg:px-4 lg:py-2 min-w-0">
          <p className="text-xs lg:text-sm text-white/70">Restante hoje</p>
          <p className={`text-base sm:text-lg lg:text-xl font-bold leading-tight break-words ${disponivelHoje < 0 ? 'text-red-200' : ''}`}>
            {exibirMoeda(Math.max(0, disponivelHoje), ocultar)}
          </p>
        </div>
      </div>

      {/* Rodapé do card: "Ver planejamento completo" + (quando aplicável) o
          check-in "Não gastei hoje" alinhado à direita. Mesma função de antes
          (onNaoGasteiHoje/jaFezCheckin), só reposicionado para dentro do card. */}
      {(onVerCompleto || mostrarCheckin) && (
        <div className="mt-2 lg:mt-3 flex items-center justify-between gap-3">
          {onVerCompleto ? (
            <button
              onClick={onVerCompleto}
              className="inline-flex items-center gap-1 text-xs sm:text-sm lg:text-base font-medium text-white/90 hover:text-white transition-colors"
            >
              Ver planejamento completo <ArrowRight size={14} />
            </button>
          ) : <span />}
          {mostrarCheckin && (
            <button
              onClick={onNaoGasteiHoje}
              disabled={jaFezCheckin}
              className={`inline-flex items-center justify-center gap-1.5 font-medium text-xs lg:text-sm px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg border transition-colors flex-shrink-0 ${
                jaFezCheckin
                  ? 'bg-white/10 text-white/50 border-transparent cursor-default'
                  : 'bg-white/10 text-white border-white/30 hover:bg-white/20'
              }`}
            >
              <Check size={14} /> {jaFezCheckin ? 'Dia sem gastos' : 'Não gastei hoje'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card "Seu dia financeiro" ────────────────────────────────────────────────
// (O antigo "Seu dia financeiro" foi consolidado dentro do card azul do limite
//  diário — anel do % utilizado + gasto de hoje + restante vivem lá agora.)

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
  const { perfil, atualizarPreferenciasLimite, somenteLeitura, usuario } = useAuth()
  const { ocultar, alternar } = useOcultarValores()

  // ── Aparência dinâmica dia/noite (só o FUNDO do cabeçalho da Home) ──
  // Preferência por usuário no localStorage (padrão: ativada). Período pelo
  // relógio LOCAL do navegador: dia 06:00–17:59, noite 18:00–05:59. Atualiza ao
  // mudar a hora e ao voltar para a aba (visibilitychange).
  const chaveAparencia = `almeida_aparencia_dinamica_${usuario?.id || 'anon'}`
  const [aparenciaDinamica, setAparenciaDinamica] = useState(() => {
    try { return localStorage.getItem(chaveAparencia) !== '0' } catch { return true }
  })
  useEffect(() => {
    try { setAparenciaDinamica(localStorage.getItem(chaveAparencia) !== '0') } catch { /* ignora */ }
  }, [chaveAparencia])
  const calcPeriodoDiaNoite = () => {
    const h = new Date().getHours()
    return (h >= 6 && h < 18) ? 'dia' : 'noite'
  }
  const [periodoVisual, setPeriodoVisual] = useState(calcPeriodoDiaNoite)
  useEffect(() => {
    const atualizar = () => setPeriodoVisual(calcPeriodoDiaNoite())
    atualizar()
    const timer = setInterval(atualizar, 60 * 1000) // reavalia a cada minuto
    const aoVoltar = () => { if (!document.hidden) atualizar() }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', atualizar)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', atualizar)
    }
  }, [])
  const ehNoite = aparenciaDinamica && periodoVisual === 'noite'
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

  // ─── Últimas transações (Home) ───
  // 3 lançamentos mais recentes: une receitas + despesas JÁ carregadas (sem
  // nova consulta), normaliza para { tipo, descricao, valor, data } e ordena da
  // data mais recente para a mais antiga. Rótulo "quando" em dd/mm.
  const ultimasTransacoes = (() => {
    const norm = (arr, tipo) => (arr || []).map(x => ({
      id: `${tipo}-${x.id}`,
      tipo,
      descricao: x.descricao || (tipo === 'receita' ? 'Receita' : 'Despesa'),
      valor: Number(x.valor) || 0,
      data: x.data || '',
    }))
    const fmtQuando = (iso) => {
      if (!iso) return ''
      const [a, m, d] = iso.split('-')
      return d && m ? `${d}/${m}` : iso
    }
    return [...norm(receitas, 'receita'), ...norm(despesas, 'despesa')]
      .filter(t => t.data)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
      .slice(0, 3)
      .map(t => ({ ...t, quando: fmtQuando(t.data) }))
  })()

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

  // Notificação pendente (ponto vermelho do sininho): sinais REAIS já derivados,
  // sem inventar backend — configuração incompleta OU risco de saldo negativo
  // nos próximos 30 dias (Horizonte). No modo consultoria (somente leitura),
  // não notifica. Clicar no sininho abre o Horizonte para ver o detalhe.
  const temNotificacao = !somenteLeitura && (
    (mostrarComecePorAqui) || Boolean(horizonteResumo?.dataNegativa)
  )

  return (
    // pb extra no MOBILE: garante que o último card ("Seu dia financeiro" com o
    // botão "Registrar gasto de hoje") role totalmente acima da barra inferior
    // fixa (que tem o botão "+" saliente). Zera no desktop (md:pb-0).
    <div className="flex flex-col gap-2.5 sm:gap-5 lg:gap-3 md:space-y-0 pb-mobilenav md:pb-0 min-h-[calc(100dvh-7rem)] md:min-h-0">
      {/* 1 ─ Cabeçalho: saudação (horário de Brasília) + subtítulo fixo, sininho
          de notificações (ponto vermelho só quando há pendência real) e botão
          global de ocultar valores. */}
      <div className={`flex items-center justify-between gap-3 transition-colors duration-500 ${
        aparenciaDinamica ? `sky-dyn ${ehNoite ? 'sky-night' : 'sky-day'} px-3 py-2 sm:py-2.5 -mx-1` : ''
      }`}>
        {/* Estrelas (só à noite, decorativas) */}
        {ehNoite && <span className="sky-stars" aria-hidden="true" />}
        <div className="min-w-0 relative">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className={`text-xl sm:text-2xl font-bold truncate leading-tight ${ehNoite ? 'text-white' : 'text-gray-900'}`}>{saudacao}</h1>
            {aparenciaDinamica && (
              ehNoite
                ? <Moon size={16} className="text-slate-200 flex-shrink-0" aria-hidden="true" />
                : <Sun size={16} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
          <p className={`text-xs sm:text-sm truncate ${ehNoite ? 'text-slate-300' : 'text-gray-500'}`}>Vamos cuidar das suas finanças hoje?</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          <button
            onClick={() => { if (temNotificacao) setModalProjecao(true) }}
            aria-label={temNotificacao ? 'Você tem notificações' : 'Sem notificações'}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
              ehNoite ? 'bg-white/15 text-slate-100 hover:bg-white/25' : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            <Bell size={18} />
            {temNotificacao && (
              <span className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ${ehNoite ? 'ring-slate-800' : 'ring-white'}`} />
            )}
          </button>
          <button
            onClick={alternar}
            aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors ${
              ehNoite ? 'bg-white/15 text-slate-100 hover:bg-white/25' : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200'
            }`}
          >
            {ocultar ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
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

      {/* 2 ─ Card azul do LIMITE DIÁRIO (consolidado): limite + anel do % usado
          + gasto de hoje + restante + lápis para editar (Automático/Personalizado
          no planejamento completo). Mesmos cálculos de sempre. */}
      <CardGastoHoje
        carregando={carregando}
        limiteHoje={limiteHoje}
        gastosHoje={gastosDeHoje}
        gastosCartaoHoje={gastosCartaoHoje}
        disponivelHoje={disponivelHoje}
        modo={modoLimite}
        receitaMes={receitaMes}
        compromissosMes={compromissosMes}
        limiteManual={limiteManual}
        hoje={hoje}
        reservaPercentual={reservaPercentual}
        saldoConfigurado={saldoConfigurado}
        previsaoFimMes={previsaoFimMes}
        onVerCompleto={() => setModalPlanejamento(true)}
        onEditarLimite={somenteLeitura ? undefined : () => setModalPlanejamento(true)}
        mostrarCheckin={!somenteLeitura && gastosDeHoje <= 0}
        jaFezCheckin={jaFezCheckin}
        onNaoGasteiHoje={marcarNaoGasteiHoje}
      />

      {/* 3 ─ Acesso rápido: 5 atalhos compactos para as funcionalidades
          existentes. Mesma linha no celular (grid-cols-5). Reaproveitam
          rotas/modais já existentes, sem duplicar lógica. */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5 lg:gap-4">
        {[
          { label: 'Transações',   icon: Receipt,       onClick: () => navigate('/despesas') },
          { label: 'Cartões',      icon: CreditCard,    onClick: () => navigate('/cartoes') },
          { label: 'Planejamento', icon: BarChart2,     onClick: () => setModalPlanejamento(true) },
          { label: 'Metas',        icon: Target,        onClick: () => navigate('/metas') },
          { label: 'Consultoria',  icon: MessageCircle, onClick: () => navigate('/consultoria') },
        ].map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            aria-label={a.label}
            className="group flex flex-col items-center gap-1 lg:gap-1.5 min-w-0 rounded-xl lg:rounded-2xl bg-gray-100 border border-gray-200 py-1.5 px-0.5 lg:py-3 lg:px-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md hover:shadow-black/10 active:translate-y-0"
          >
            <span className="w-7 h-7 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full bg-marca-100 flex items-center justify-center flex-shrink-0">
              <a.icon size={16} className="text-marca lg:hidden" />
              <a.icon size={20} className="text-marca hidden lg:block" />
            </span>
            <span className="text-[10px] sm:text-[11px] lg:text-sm font-medium text-gray-600 group-hover:text-gray-800 w-full text-center leading-tight hyphens-auto transition-colors">{a.label}</span>
          </button>
        ))}
      </div>

      {/* O card "Saldo disponível agora" foi movido para a aba Planejamento
          (/projecao), deixando a Home mais compacta. */}

      {/* 4 ─ Botão principal (largura total) logo abaixo dos atalhos: abre o
          fluxo de registro de compra/gasto já existente. 5 ─ Botão secundário
          "Posso comprar?" logo abaixo. Reaproveitam os fluxos existentes. */}
      {!somenteLeitura && (
        <div className="space-y-1.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4">
          <button
            onClick={() => setModalGasto(true)}
            className="btn-primary w-full flex items-center justify-center gap-2 text-sm lg:text-base text-center leading-tight py-2 lg:py-2.5"
          >
            <Plus size={16} strokeWidth={2.5} className="flex-shrink-0" /> Registrar uma compra ou gasto
          </button>
          <Link
            to="/posso-comprar"
            className="w-full flex items-center justify-center gap-2 bg-white border border-marca text-marca font-semibold text-sm lg:text-base px-4 py-2 lg:py-2.5 rounded-xl hover:bg-marca-100 transition-colors text-center leading-tight"
          >
            <ShoppingCart size={16} className="flex-shrink-0" /> Posso comprar?
          </Link>
        </div>
      )}

      {/* 6 ─ Movimentações e próximos pagamentos: une as 2 transações mais
          recentes + os 2 compromissos pendentes mais próximos num único card
          compacto. Dados reais já carregados (ultimasTransacoes / proximos7Dias),
          sem recalcular nada. Links separados: "Ver todas" (transações) e
          "Ver todos" (compromissos) → /despesas. */}
      {!carregando && (
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
        <div className="card !p-3 sm:!p-5 lg:!p-5 lg:col-span-2">
          <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 min-w-0 truncate">Movimentações e próximos pagamentos</h2>

          {/* No desktop, as duas seções ficam lado a lado para aproveitar a
              largura e melhorar a leitura; no mobile seguem empilhadas. */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:mt-2">
          <div>
          {/* Últimas transações (2) */}
          <div className="flex items-center justify-between gap-2 mt-2 lg:mt-0 mb-1 lg:mb-2">
            <p className="text-xs lg:text-sm font-medium text-gray-500">Últimas transações</p>
            <button
              onClick={() => navigate('/despesas')}
              className="flex items-center gap-1 text-xs lg:text-sm font-medium text-marca hover:opacity-80 flex-shrink-0"
            >
              Ver todas <ArrowRight size={13} />
            </button>
          </div>
          {ultimasTransacoes.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma transação registrada ainda.</p>
          ) : (
            <ul className="space-y-1 lg:space-y-1.5">
              {ultimasTransacoes.slice(0, 2).map(t => (
                <li key={t.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg lg:rounded-xl px-2.5 py-1.5 lg:px-3 lg:py-2">
                  <div className="min-w-0 flex items-center gap-2 lg:gap-3">
                    <span className={`w-6 h-6 lg:w-9 lg:h-9 rounded-full flex items-center justify-center flex-shrink-0 ${t.tipo === 'receita' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                      {t.tipo === 'receita'
                        ? <TrendingUp size={14} className="text-green-600 lg:w-[18px] lg:h-[18px]" />
                        : <TrendingDown size={14} className="text-red-500 lg:w-[18px] lg:h-[18px]" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm lg:text-base font-medium text-gray-900 truncate leading-tight">{t.descricao}</p>
                      <p className="text-[11px] lg:text-xs text-gray-500 leading-tight">{t.quando}</p>
                    </div>
                  </div>
                  <span className={`text-sm lg:text-base font-semibold flex-shrink-0 whitespace-nowrap ${t.tipo === 'receita' ? 'text-green-600' : 'text-gray-900'}`}>
                    {t.tipo === 'receita' ? '+' : '−'} {exibirMoeda(t.valor, ocultar)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </div>

          {/* Divisória discreta (só no mobile; no desktop as colunas separam) */}
          <div className="border-t border-gray-100 my-1.5 lg:hidden" />

          <div>
          {/* Próximos 7 dias (2) */}
          <div className="flex items-center justify-between gap-2 mb-1 lg:mb-2">
            <p className="text-xs lg:text-sm font-medium text-gray-500">Próximos 7 dias</p>
            {proximos7Dias.length > 0 && (
              <button
                onClick={() => navigate('/despesas')}
                className="flex items-center gap-1 text-xs lg:text-sm font-medium text-marca hover:opacity-80 flex-shrink-0"
              >
                Ver todos <ArrowRight size={13} />
              </button>
            )}
          </div>
          {proximos7Dias.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum compromisso previsto para os próximos 7 dias.</p>
          ) : (
            <ul className="space-y-1 lg:space-y-1.5">
              {proximos7Dias.slice(0, 2).map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg lg:rounded-xl px-2.5 py-1.5 lg:px-3 lg:py-2">
                  <div className="min-w-0 flex items-center gap-2 lg:gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.cor || 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <p className="text-sm lg:text-base font-medium text-gray-900 truncate leading-tight">{item.descricao}</p>
                      <p className="text-[11px] lg:text-xs text-gray-500 leading-tight">{item.quando}</p>
                    </div>
                  </div>
                  <span className="text-sm lg:text-base font-semibold text-gray-900 flex-shrink-0 whitespace-nowrap">
                    {exibirMoeda(item.valor, ocultar)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          </div>
          </div>
        </div>

        {/* 4b ─ Resumo do mês — SOMENTE no desktop (hidden lg:block), ao lado do
            card de movimentações. Reutiliza resumoMes/limiteHoje já calculados;
            nenhum cálculo novo. No mobile não aparece (Home continua compacta). */}
        <div className="hidden lg:block card !p-5">
          <h2 className="text-lg font-semibold text-gray-900">Resumo do mês</h2>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp size={16} className="text-green-600" />
                </span>
                Receitas
              </span>
              <span className="text-base font-bold text-green-600 whitespace-nowrap">{exibirMoeda(resumoMes.receitaTotal, ocultar)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-gray-600">
                <span className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown size={16} className="text-red-500" />
                </span>
                Despesas
              </span>
              <span className="text-base font-bold text-red-500 whitespace-nowrap">{exibirMoeda(resumoMes.despesaTotal, ocultar)}</span>
            </div>
            <div className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${resumoMes.sobraPrevista >= 0 ? 'bg-marca-100' : 'bg-red-50'}`}>
              <span className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${resumoMes.sobraPrevista >= 0 ? 'bg-marca-100' : 'bg-red-500/10'}`}>
                  <Wallet size={16} className={resumoMes.sobraPrevista >= 0 ? 'text-marca' : 'text-red-600'} />
                </span>
                Resultado previsto
              </span>
              <span className={`text-lg font-bold whitespace-nowrap ${resumoMes.sobraPrevista >= 0 ? 'text-marca' : 'text-red-600'}`}>
                {exibirMoeda(resumoMes.sobraPrevista, ocultar)}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm text-gray-500">
                <Sun size={16} className="text-amber-500 flex-shrink-0" /> Gasto diário sugerido
              </span>
              <span className="text-base font-bold text-gray-900 whitespace-nowrap">{exibirMoeda(Math.max(0, limiteHoje), ocultar)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Receitas e compromissos deste mês. A reserva de emergência é separada.</p>
          </div>
        </div>
      </div>
      )}

      {/* Espaçador flexível (só mobile): absorve a sobra vertical para distribuir
          o conteúdo e aproveitar o espaço vazio acima da navegação inferior, sem
          esticar os cards nem usar altura fixa. Zero no desktop. */}
      <div className="grow md:hidden" aria-hidden="true" />

      {/* O "Horizonte Financeiro", o card de Consultoria e o "Resumo do mês"
          foram movidos para a aba Planejamento (/projecao), deixando a Home mais
          limpa. A consultoria continua acessível pelo atalho "Consultoria".
          O modal do Horizonte (abaixo) é mantido para o sininho de notificações. */}

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

      {/* Modal de Gasto rápido */}
      <Modal aberto={modalGasto} onFechar={() => setModalGasto(false)} titulo="Gasto rápido">
        <FormGastoRapido
          onSalvar={handleSalvarGasto}
          onCancelar={() => setModalGasto(false)}
          carregando={salvandoGasto}
          onMaisOpcoes={handleMaisOpcoes}
        />
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