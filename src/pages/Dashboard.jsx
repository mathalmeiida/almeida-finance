import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Sun, Plus, Pencil,
  CheckCircle2, Circle, Rocket, Eye, EyeOff, Check, CalendarClock, ChevronDown, ChevronUp, PiggyBank, AlertTriangle, MessageCircle, BarChart2,
  Receipt, ReceiptText, Target, Bell, Moon, UtensilsCrossed, ShoppingBag, Zap, Info, X, MoreHorizontal, Sparkles
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useComprasCartao } from '../hooks/useComprasCartao'
import { useConsultoriaInteresses } from '../hooks/useConsultoria'
import { useBeneficios } from '../hooks/useBeneficios'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import InputMoeda from '../components/InputMoeda'
import SeletorCategoriaModerno from '../components/SeletorCategoriaModerno'
import { formatCurrency, exibirMoeda, FORMAS_PAGAMENTO, hojeISO as hojeISOBrasil, hojeDateBrasil } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import { parcelaCompraNoMes, totalFaturaComOverride } from '../lib/faturaCartao'
import Modal from '../components/Modal'
import ModalAnteciparPagamento from '../components/ModalAnteciparPagamento'
import HorizonteFinanceiro from '../components/HorizonteFinanceiro'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'
import CalendarioFinanceiroHome from '../components/CalendarioFinanceiroHome'

// Chaves lidas em App.jsx (AreaAutenticada) para reabrir o onboarding e saber
// em qual etapa começar. Mesmas chaves usadas pela tela de Configurações.
const CHAVE_REFAZER = 'almeida_refazer_onboarding'
const CHAVE_ETAPA_ONBOARDING = 'almeida_onboarding_etapa'

// ─── Modal de Gasto rápido ────────────────────────────────────────────────────
// Categorias comuns de gasto do dia a dia — aparecem primeiro no seletor
// rápido (apenas ordenação visual; não cria, renomeia nem apaga categorias).
const CATEGORIAS_COMUNS = ['Alimentação', 'Transporte', 'Lazer', 'Mercado', 'Saúde', 'Serviços']

function FormGastoRapido({ onSalvar, onCancelar, carregando, onMaisOpcoes, erro, beneficios = [], dataInicial }) {
  const { categorias } = useCategorias('despesa')
  const { cartoes } = useCartoes()
  const [form, setForm] = useState({
    descricao: '', valor: '', categoria_id: '', subcategoria_id: '',
    data: dataInicial || hojeISOBrasil(), forma_pagamento: '', cartao_id: '', beneficio_id: '',
  })

  const formaSelecionada = FORMAS_PAGAMENTO.find(f => f.value === form.forma_pagamento)
  const nomeForma = String(formaSelecionada?.label || '').toLowerCase()
  const valorForma = String(form.forma_pagamento || '').toLowerCase()
  const ehCartaoCredito = valorForma === 'cartao_credito'
  const tipoBeneficio = ['vr', 'vale_refeicao', 'vale_refeição'].includes(valorForma)
    || nomeForma.includes('refeição') ? 'VR'
    : ['va', 'vale_alimentacao', 'vale_alimentação'].includes(valorForma)
      || nomeForma.includes('alimentação') && (nomeForma.includes('vale') || nomeForma.includes('cartão')) ? 'VA' : null
  const beneficiosCompativeis = beneficios.filter(b => String(b.tipo).toUpperCase() === tipoBeneficio)

  const categoriasOrdenadas = [...categorias].sort((a, b) => {
    const ia = CATEGORIAS_COMUNS.indexOf(a.nome)
    const ib = CATEGORIAS_COMUNS.indexOf(b.nome)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.nome.localeCompare(b.nome)
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev, [name]: value,
      ...(name === 'categoria_id' ? { subcategoria_id: '' } : {}),
      ...(name === 'forma_pagamento' ? { cartao_id: '', beneficio_id: '' } : {}),
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (carregando) return
    const valorNum = Number(form.valor)
    if (!Number.isFinite(valorNum) || valorNum <= 0) return
    if (!form.forma_pagamento) return
    if (ehCartaoCredito && !form.cartao_id) return
    if (tipoBeneficio && !form.beneficio_id) return
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    const descricao = form.descricao.trim() || catSelecionada?.nome || 'Gasto'
    const tipo_despesa = classificarDespesa({ descricao, categoria: catSelecionada?.nome || '' })
    onSalvar({
      descricao, valor: valorNum,
      data: tipoBeneficio ? hojeISOBrasil() : form.data,
      recorrente: false,
      categoria_id: form.categoria_id || null,
      subcategoria_id: form.subcategoria_id || null,
      tipo_despesa,
      forma_pagamento: form.forma_pagamento,
      cartao_id: ehCartaoCredito ? form.cartao_id : null,
      beneficio_id: tipoBeneficio ? form.beneficio_id : null,
      tipo_beneficio: tipoBeneficio,
    }, catSelecionada?.nome || 'Sem categoria')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{erro}</p>}
      <div className="rounded-xl bg-gray-50 p-3 text-center">
        <label className="label">Quanto você gastou?</label>
        <InputMoeda valor={form.valor} onChangeValor={n => setForm(prev => ({ ...prev, valor: n }))}
          className="input text-2xl font-bold text-center py-3" prefixo={null} autoFocus />
      </div>
      <div>
        <label className="label">Descrição <span className="text-gray-400">(opcional)</span></label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex.: Almoço, mercado, transporte" />
      </div>
      <SeletorCategoriaModerno categorias={categoriasOrdenadas} value={form.categoria_id}
        onChange={categoria_id => setForm(prev => ({ ...prev, categoria_id, subcategoria_id: '' }))}
        subcategoriaValue={form.subcategoria_id}
        onSubcategoriaChange={subcategoria_id => setForm(prev => ({ ...prev, subcategoria_id }))} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Forma de pagamento</label>
          <select name="forma_pagamento" value={form.forma_pagamento} onChange={handleChange} className="input" required>
            <option value="">Selecionar forma</option>
            {FORMAS_PAGAMENTO.map(f => <option key={f.value} value={f.value}>{f.icone} {f.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Data do gasto</label>
          <input name="data" type="date" value={tipoBeneficio ? hojeISOBrasil() : form.data}
            onChange={handleChange} disabled={!!tipoBeneficio} className="input" required />
        </div>
      </div>
      {ehCartaoCredito && (
        <div>
          <label className="label">Em qual cartão?</label>
          {cartoes.length ? (
            <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input" required>
              <option value="">Selecionar cartão</option>
              {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>)}
            </select>
          ) : <p className="text-sm text-amber-600">Cadastre primeiro um cartão na aba Cartões.</p>}
          <p className="text-xs text-gray-500 mt-1">O valor entrará na fatura, não no saldo bancário imediato.</p>
        </div>
      )}
      {tipoBeneficio && (
        <div>
          <label className="label">Qual benefício {tipoBeneficio}?</label>
          {beneficiosCompativeis.length ? (
            <select name="beneficio_id" value={form.beneficio_id} onChange={handleChange} className="input" required>
              <option value="">Selecionar benefício</option>
              {beneficiosCompativeis.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </select>
          ) : <p className="text-sm text-amber-600">Nenhum benefício {tipoBeneficio} cadastrado.</p>}
          <p className="text-xs text-gray-500 mt-1">Será descontado apenas do saldo {tipoBeneficio}. Este registro usa a data de hoje.</p>
        </div>
      )}
      <button type="submit" disabled={carregando || !form.forma_pagamento || Number(form.valor) <= 0
        || (ehCartaoCredito && !form.cartao_id) || (tipoBeneficio && !form.beneficio_id)}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3">
        {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar gasto'}
      </button>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onCancelar} className="text-xs font-medium text-gray-500 py-1">Cancelar</button>
        <button type="button" onClick={onMaisOpcoes} className="text-xs font-medium text-blue-600 hover:text-blue-700 py-1">Mais opções</button>
      </div>
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

// ─── Limite diário dos benefícios na Home ────────────────────────────────────
// Mesma regra da aba Benefícios: saldo / dias até próxima recarga, ou limite manual.
// VR/VA independentes e separados do limite diário bancário.
function dataProximaRecargaBeneficio(b, agora = new Date()) {
  const dia = Number(b.recarga_dia)
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return null
  const a = agora.getFullYear(), m = agora.getMonth()
  for (let i = 0; i < 14; i++) {
    const mes = new Date(a, m + i, 1)
    const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    const candidato = new Date(mes.getFullYear(), mes.getMonth(), Math.min(dia, ultimo), 12)
    if (candidato > new Date(a, m, agora.getDate(), 12)) return candidato
  }
  return null
}

function diasAteRecargaBeneficio(data, agora = new Date()) {
  if (!data) return null
  const origem = Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())
  const destino = Date.UTC(data.getFullYear(), data.getMonth(), data.getDate())
  return Math.max(1, Math.round((destino - origem) / 86400000))
}

function CardLimiteBeneficioHome({ b, titulo, Icone, saldo, proximaRecarga, ocultar, usuarioId, somenteLeitura, onGastoRapido }) {
  const [manual, setManual] = useState(null)
  const [editando, setEditando] = useState(false)
  const [valorEditado, setValorEditado] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregandoLimite, setCarregandoLimite] = useState(true)
  const [erroLimite, setErroLimite] = useState('')

  useEffect(() => {
    let ativo = true
    setManual(null)
    setCarregandoLimite(true)
    setErroLimite('')
    if (!usuarioId || !b?.id) { setCarregandoLimite(false); return }
    async function carregar() {
      const { data, error } = await supabase
        .from('beneficios_limites_diarios')
        .select('limite_manual')
        .eq('usuario_id', usuarioId)
        .eq('beneficio_id', b.id)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        console.error('[Home] Erro ao carregar limite VR/VA:', error)
        setErroLimite('Não foi possível carregar o limite. Confira o SQL dos benefícios.')
      } else {
        setManual(data?.limite_manual == null ? null : Number(data.limite_manual))
      }
      setCarregandoLimite(false)
    }
    carregar()
    return () => { ativo = false }
  }, [usuarioId, b?.id])

  const prox = dataProximaRecargaBeneficio(b)
  const dias = diasAteRecargaBeneficio(prox)
  const automatico = dias ? Math.max(0, Number(saldo) || 0) / dias : null
  const personalizado = manual != null && Number(manual) > 0
  const limite = personalizado ? Number(manual) : automatico

  async function salvarLimite(e) {
    e.preventDefault()
    if (!usuarioId || somenteLeitura || salvando) return
    const valor = Number(valorEditado)
    if (!Number.isFinite(valor) || valor <= 0) {
      setErroLimite('Informe um limite maior que zero.')
      return
    }
    setSalvando(true)
    setErroLimite('')
    try {
      const { error } = await supabase.from('beneficios_limites_diarios').upsert({
        beneficio_id: b.id,
        usuario_id: usuarioId,
        limite_manual: valor,
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'beneficio_id' })
      if (error) throw error
      setManual(valor)
      setEditando(false)
    } catch (err) {
      setErroLimite(err.message || 'Não foi possível salvar o limite.')
    } finally {
      setSalvando(false)
    }
  }

  async function voltarAutomatico() {
    if (!usuarioId || somenteLeitura || salvando) return
    setSalvando(true)
    setErroLimite('')
    try {
      const { error } = await supabase.from('beneficios_limites_diarios')
        .delete().eq('beneficio_id', b.id).eq('usuario_id', usuarioId)
      if (error) throw error
      setManual(null)
      setEditando(false)
    } catch (err) {
      setErroLimite(err.message || 'Não foi possível voltar ao automático.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="rounded-xl bg-white border border-gray-200 px-3 py-3 min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icone size={15} className="text-marca flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate">{titulo}</span>
        </div>
        {!somenteLeitura && (
          <button type="button" aria-label={`Editar limite diário ${b.tipo}`}
            onClick={() => { setEditando(v => !v); setValorEditado(personalizado ? String(manual) : ''); setErroLimite('') }}
            className="text-marca rounded-lg p-1 hover:bg-gray-100" title="Editar limite diário">
            <Pencil size={14} />
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500">Saldo: <strong>{exibirMoeda(saldo, ocultar)}</strong></p>
      <div>
        <p className="text-[11px] text-gray-500">Limite diário {personalizado ? 'personalizado' : 'automático'}</p>
        <p className="text-lg sm:text-xl font-bold text-marca leading-tight break-words">
          {carregandoLimite ? 'Carregando...' : limite == null ? 'Não disponível' : exibirMoeda(limite, ocultar)}
          {!carregandoLimite && limite != null && <span className="text-xs font-normal text-gray-500"> /dia</span>}
        </p>
        <p className="text-[11px] text-gray-400 mt-1">
          {dias ? `${dias} dias até a próxima recarga` : 'Configure a data da recarga para cálculo automático'}
        </p>
      </div>
      {editando && !somenteLeitura && (
        <form onSubmit={salvarLimite} className="space-y-2 border-t border-gray-100 pt-2">
          <label className="text-xs font-medium text-gray-600 block">Meu limite por dia (R$)</label>
          <InputMoeda valor={valorEditado} onChangeValor={setValorEditado} className="input" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={salvando} className="btn-primary text-xs px-3 py-2">
              {salvando ? 'Salvando...' : 'Salvar limite'}
            </button>
            <button type="button" disabled={salvando} onClick={voltarAutomatico}
              className="btn-secondary text-xs px-3 py-2">Automático</button>
          </div>
        </form>
      )}
      {!somenteLeitura && (
        <button type="button" onClick={onGastoRapido}
          className="w-full rounded-lg bg-marca-100 text-marca hover:opacity-80 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5">
          <Plus size={14} /> Gasto rápido
        </button>
      )}
      {erroLimite && <p role="alert" className="text-xs text-red-600">{erroLimite}</p>}
    </div>
  )
}

// Gasto rápido específico do benefício, isolado do saldo bancário.
function FormGastoRapidoBeneficioHome({ beneficio, saldo, onSalvar, onCancelar, salvando, erro }) {
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const valorNum = Number(valor) || 0
  function enviar(e) {
    e.preventDefault()
    if (salvando || valorNum <= 0 || valorNum > saldo) return
    onSalvar({ beneficio_id: beneficio.id, valor: valorNum, descricao: descricao.trim() })
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-gray-600">{beneficio.nome} — saldo disponível: {formatCurrency(saldo)}</p>
      {erro && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{erro}</p>}
      <div>
        <label className="label">Valor gasto</label>
        <InputMoeda valor={valor} onChangeValor={setValor} className="input" autoFocus />
      </div>
      <div>
        <label className="label">Descrição (opcional)</label>
        <input className="input" value={descricao} onChange={e => setDescricao(e.target.value)}
          placeholder={beneficio.tipo === 'VR' ? 'Ex.: Almoço' : 'Ex.: Mercado'} />
      </div>
      {valorNum > saldo && <p className="text-xs text-red-600">Saldo insuficiente no benefício.</p>}
      <div className="flex gap-2">
        <button type="button" className="btn-secondary flex-1" disabled={salvando} onClick={onCancelar}>Cancelar</button>
        <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2"
          disabled={salvando || valorNum <= 0 || valorNum > saldo}>
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Confirmar gasto'}
        </button>
      </div>
    </form>
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
function calcularLimiteDiario({
  receitaMes,
  compromissosMes,
  reservaPct,
  modo,
  limiteManual,
  hoje,
  baseLivre,
  saldoConfigurado = false,
  dataProximaReceita
}) {
  if (!saldoConfigurado) return 0

  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )

  const fim = dataProximaReceita
    ? new Date(`${dataProximaReceita}T12:00:00`)
    : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const dias = Math.max(
    1,
    Math.ceil((fim - inicio) / 86400000)
  )

  // Reserva PLANEJADA descontada UMA vez (igual a derivarResumoGastar), para o
  // limite da Home e o do Planejamento completo nunca divergirem. baseLivre
  // (saldoSeguroHoje) já vem SEM reserva; aqui aplicamos o percentual salvo.
  const pctSeguro = Math.min(100, Math.max(0, Number(reservaPct) || 0))
  const reserva = Math.max(0, Number(receitaMes) || 0) * (pctSeguro / 100)
  const disponivel = Math.max(0, (Number(baseLivre) || 0) - reserva)
  const limiteSeguro = dias > 0 ? disponivel / dias : 0

  if (modo === 'manual') {
    return Math.max(0, Number(limiteManual) || 0)
  }

  return limiteSeguro
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
  saldoSeguroHoje = 0,
  dataProximaReceita = null,
}) {
  const inicio = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate()
  )

  const fim = dataProximaReceita
    ? new Date(`${dataProximaReceita}T12:00:00`)
    : new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

  const dias = Math.max(
    1,
    Math.ceil((fim - inicio) / 86400000)
  )

  const ehManual = modo === 'manual'
  // Reserva PLANEJADA (não é a já acumulada): percentual sobre a receita do mês.
  // Protege contra NaN/negativos e percentuais fora de 0–100.
  const pctSeguro = Math.min(100, Math.max(0, Number(pct) || 0))
  const receitaSegura = Math.max(0, Number(receitaMes) || 0)
  const reserva = receitaSegura > 0
    ? receitaSegura * (pctSeguro / 100)
    : 0

  // Saldo seguro já vem SEM reserva do useProjecao; aqui descontamos a reserva
  // planejada UMA única vez. Ao mudar o percentual, baseLivre (e tudo que
  // depende dela: disponível e gasto diário) recalcula imediatamente, pois usa
  // o `pct` local. Clamp em 0 evita disponível/limite negativos indevidos.
  const saldoSeguroNum = Math.max(0, Number(saldoSeguroHoje) || 0)
  // Disponível REAL (com SINAL), arredondado a centavos — pode ser negativo
  // quando a reserva + compromissos superam o saldo seguro. Fonte ÚNICA do
  // estado do orçamento (equilibrado/positivo/negativo), sem cálculo paralelo.
  const disponivelReal = saldoConfigurado
    ? Math.round((saldoSeguroNum - reserva) * 100) / 100
    : 0
  // Saldo seguro JÁ considerando a reserva planejada (reage ao percentual).
  // Clamp em 0 para exibição e para o gasto diário não ficar negativo.
  const saldoSeguroAjustado = Math.max(0, disponivelReal)
  const baseLivre = saldoSeguroAjustado

  const disponivelAuto = baseLivre
  const disponivelMes = baseLivre

  const limiteAuto = saldoConfigurado && dias > 0
    ? disponivelAuto / dias
    : 0

  const limiteManualNum = Number(limiteManual) || 0

  const limiteExibido = ehManual && saldoConfigurado
    ? Math.max(0, limiteManualNum)
    : limiteAuto

  const status = statusOrcamento(receitaMes, disponivelMes)
  // Estado do orçamento pelo disponível REAL arredondado (evita "Faltam R$ 0,00"
  // por diferença de centavos): < 0 negativo, == 0 equilibrado, > 0 positivo.
  const estadoOrcamento = !saldoConfigurado
    ? null
    : disponivelReal < 0 ? 'negativo'
    : disponivelReal === 0 ? 'equilibrado'
    : 'positivo'
  const orcamentoNegativo = estadoOrcamento === 'negativo'

  const manualAcimaDoRecomendado =
    ehManual && limiteManualNum > limiteAuto

  return {
    dias,
    ehManual,
    reserva,
    saldoSeguroAjustado,
    disponivelReal,
    estadoOrcamento,
    baseLivre,
    disponivelAuto,
    disponivelMes,
    limiteAuto,
    limiteManualNum,
    limiteExibido,
    status,
    orcamentoNegativo,
    manualAcimaDoRecomendado,
  }
}// (O resumo compacto "Quanto posso gastar?" foi substituído: o essencial do mês
//  vive agora no card azul do limite diário e os detalhes no planejamento completo.)

function CardQuantoPossoGastar({
  carregando, modo, onTrocarModo,
  receitaMes, compromissosMes, limiteManual, onEditarLimite, hoje,
  reservaPercentual, onTrocarReserva,
  reservaAtual = 0, metaReserva = 0, onEditarReservaAtual,
  saldoConfigurado = false,
  previsaoFimMes = 0,
  saldoSeguroHoje = 0,
  saldoAtual = 0,
  dataProximaReceita = null,
}) {
  const { ocultar } = useOcultarValores()
  const [personalizando, setPersonalizando] = useState(false)
  const [pctCustom, setPctCustom] = useState('')
  // Estado local do percentual (atualização otimista): o clique reflete na hora,
  // sem esperar o salvamento no banco. Sincroniza quando o perfil carrega/muda.
  const [pctLocal, setPctLocal] = useState(reservaPercentual != null ? Number(reservaPercentual) : 20)
  const [erroSalvar, setErroSalvar] = useState(false)
  const [salvo, setSalvo] = useState(false)
  const [detalhesLimiteAberto, setDetalhesLimiteAberto] = useState(false)

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
    dias, ehManual, reserva, saldoSeguroAjustado, limiteAuto, limiteManualNum,
    disponivelMes, limiteExibido, status, orcamentoNegativo, manualAcimaDoRecomendado,
 } = derivarResumoGastar({
  modo,
  receitaMes,
  compromissosMes,
  limiteManual,
  hoje,
  pct,
  saldoConfigurado,
  previsaoFimMes,
  saldoSeguroHoje,
  dataProximaReceita,
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
    <div className="planejamento-modal-conteudo rounded-2xl border border-white/10 bg-[#172339] p-4 sm:p-6 text-white space-y-4">
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
{/* Detalhamento do saldo seguro */}
{!ehManual && (
  <div className="bg-black/15 rounded-xl px-3 py-3 mb-3 space-y-1.5">
    <div className="flex justify-between text-sm">
      <span className="text-white/70">Saldo atual</span>
      <span className="font-medium">{formatCurrency(saldoAtual)}</span>
    </div>

    <div className="flex justify-between text-sm">
      <span className="text-white/70">
        Valor descontado até a próxima receita
      </span>
      <span className="font-medium">
        − {formatCurrency(Math.max(0, saldoAtual - saldoSeguroAjustado))}
      </span>
    </div>

    <div className="flex justify-between items-center text-sm pt-1.5 border-t border-white/15">
      <span className="font-semibold">
        Saldo seguro até a próxima receita
      </span>
      <span className="font-bold">
        {formatCurrency(saldoSeguroAjustado)}
      </span>
    </div>
  </div>
)}
      {/* Destaque do limite diário, com saldo disponível separado */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-3 rounded-xl bg-marca/20 border border-white/10 px-4 py-4">
          <p className="text-xs font-medium text-white/75">{ehManual ? 'Seu limite diário (manual)' : 'Limite diário recomendado'}</p>
          <p className="mt-1 text-3xl sm:text-4xl font-extrabold tabular-nums break-words">
            {formatCurrency(Math.max(0, limiteExibido))}
            <span className="text-sm font-normal text-white/65"> /dia</span>
          </p>
        </div>
        <div className="sm:col-span-2 rounded-xl bg-white/5 border border-white/10 px-4 py-4">
          <p className="text-xs text-white/70">Disponível até a próxima receita</p>
          <p className="text-xl sm:text-2xl font-bold mt-2 tabular-nums break-words">{formatCurrency(disponivelMes)}</p>
          <p className="text-xs text-white/60 mt-1">Saldo projetado para este período</p>
        </div>
      </div>
      {/* Explicação recolhível: usa os mesmos resultados do cálculo existente. */}
      <div className="rounded-xl border border-white/10 bg-black/15 overflow-hidden">
        <button
          type="button"
          aria-expanded={detalhesLimiteAberto}
          onClick={() => setDetalhesLimiteAberto(v => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-white/5"
        >
          <span className="flex items-center gap-2"><Info size={16} /> Entenda seu limite diário</span>
          <span className="text-white/70 text-lg" aria-hidden="true">{detalhesLimiteAberto ? '−' : '+'}</span>
        </button>
        {detalhesLimiteAberto && (
          <div className="border-t border-white/10 px-4 py-3 space-y-2 text-xs sm:text-sm text-white/80">
            <div className="flex justify-between gap-4"><span>Saldo atual informado</span><strong className="text-white">{exibirMoeda(saldoAtual, ocultar)}</strong></div>
            <div className="flex justify-between gap-4"><span>Base segura projetada (antes da reserva planejada)</span><strong className="text-white">{exibirMoeda(Math.max(0, Number(saldoSeguroHoje) || 0), ocultar)}</strong></div>
            <div className="flex justify-between gap-4"><span>Reserva planejada ({pct} % da renda do mês)</span><strong className="text-white">{exibirMoeda(reserva, ocultar)}</strong></div>
            <div className="flex justify-between gap-4 border-t border-white/10 pt-2"><span>Disponível após reserva planejada</span><strong className="text-white">{exibirMoeda(disponivelMes, ocultar)}</strong></div>
            <div className="flex justify-between gap-4"><span>Dias considerados até a próxima receita</span><strong className="text-white">{dias}</strong></div>
            <div className="flex justify-between gap-4"><span>Limite diário automático</span><strong className="text-white">{exibirMoeda(limiteAuto, ocultar)}</strong></div>
            {ehManual && <p className="text-white/70">Modo manual: seu limite definido é {exibirMoeda(limiteManualNum, ocultar)} por dia, independentemente da recomendação automática.</p>}
            <div className="border-t border-white/10 pt-2">
              <p>Reserva já acumulada: <strong className="text-white">{exibirMoeda(reservaAtual, ocultar)}</strong>.</p>
              <p className="mt-1 text-white/60">A reserva planejada é uma meta sobre a renda do mês; não significa que esse valor já esteja guardado ou tenha sido transferido.</p>
              <p className="mt-1 text-white/60">A base segura vem da projeção financeira existente. Este resumo não discrimina cada despesa ou fatura; consulte Projeção para verificar os compromissos.</p>
            </div>
          </div>
        )}
      </div>
      {/* Status */}
      {status && (
        <div className="flex items-center gap-2 mt-3 bg-black/15 rounded-xl px-3 py-2">
          <span>{status.cor}</span>
          <span className="text-sm font-medium">{status.texto}</span>
        </div>
      )}

      {ehManual && (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs sm:text-sm text-white/80">
          <Info size={15} className="inline-block mr-1.5 align-[-3px]" />
          Seu limite diário foi definido por você e pode ser diferente do cálculo automático.
          {manualAcimaDoRecomendado && <span className="block mt-1 text-amber-200">O valor manual está acima do recomendado para o período.</span>}
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
            className="flex items-center justify-center gap-2 text-sm font-semibold text-white bg-marca hover:opacity-90 px-4 py-2.5 rounded-xl transition-colors"
          >
            <Pencil size={14} /> {limiteManualNum > 0 ? 'Ajustar limite' : 'Definir limite'}
          </button>
          <button
            onClick={() => onTrocarModo('auto')}
            className="flex items-center justify-center gap-2 text-sm font-medium text-white/80 border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl transition-colors"
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
          <div className="mt-3 pt-4 border-t border-white/15">
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
function CardComecePorAqui({ itens, totalConcluidos, onIrPara, onContinuar, onDispensar }) {
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
    <div className={expandido ? 'card' : 'card !p-4'}>
      {/* Visão COMPACTA (faixa horizontal): título + pendências à esquerda,
          progresso e botão à direita no desktop; empilha no mobile. */}
      {!expandido ? (
        <div className="sm:flex sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">
              <Rocket size={17} className="text-marca flex-shrink-0" />
              <span className="truncate">Complete sua configuração</span>
              <span className="text-xs font-medium text-gray-500 flex-shrink-0">· {totalConcluidos} de {total}</span>
              {onDispensar && (
                <button
                  type="button"
                  onClick={onDispensar}
                  aria-label="Dispensar"
                  className="ml-auto sm:hidden text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X size={16} />
                </button>
              )}
            </h2>
            {pendentes.length > 0 && (
              <p className="text-xs sm:text-sm text-gray-500 mt-1 truncate">Faltam: {textoFaltam}</p>
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 sm:mt-0 flex-shrink-0">
            <button
              onClick={() => setExpandido(true)}
              className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 sm:px-5"
            >
              Continuar <ArrowRight size={16} />
            </button>
            {onDispensar && (
              <button
                type="button"
                onClick={onDispensar}
                aria-label="Dispensar"
                className="hidden sm:inline-flex text-gray-400 hover:text-gray-600 flex-shrink-0 p-1"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      ) : (
      <>
      {/* Cabeçalho compacto */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 min-w-0">
          <Rocket size={18} className="text-marca flex-shrink-0" />
          <span className="truncate">Complete sua configuração</span>
        </h2>
        <span className="text-xs font-medium text-gray-500 flex-shrink-0">
          {totalConcluidos} de {total} concluídos
        </span>
      </div>

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

      {/* Ações (expandido) */}
      <div className="flex gap-3 mt-4">
        <button onClick={() => setExpandido(false)} className="btn-secondary flex-1">
          Recolher
        </button>
        <button onClick={onContinuar} className="btn-primary flex-1 flex items-center justify-center gap-2">
          Continuar configuração <ArrowRight size={16} />
        </button>
      </div>
      </>
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
  saldoAtual = 0,
  onEditarSaldo,
  mostrarSaldo = false,
  configIncompleta = false,
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
  const { disponivelMes, disponivelReal, estadoOrcamento, status, orcamentoNegativo } = derivarResumoGastar({
    modo, receitaMes, compromissosMes, limiteManual, hoje,
    pct, saldoConfigurado, previsaoFimMes,
  })
  // Pontinho de status (semântico) legível sobre o azul.
  const corStatus = status?.cor === '🔴' ? 'bg-red-300'
    : status?.cor === '🟡' ? 'bg-amber-300'
    : 'bg-green-300'

  // Sem base financeira (sem renda informada E sem saldo configurado): o limite
  // é R$ 0 e exibimos a orientação para cadastrar a renda. Cobre o estado após
  // "zerar dados" e contas recém-criadas.
  const semBaseFinanceira = (Number(receitaMes) || 0) <= 0 && !saldoConfigurado

  // Anel do limite diário: % JÁ utilizado hoje (satura em 100 no anel, mas o
  // rótulo pode passar de 100% quando estoura o limite).
  const temLimite = limiteHoje > 0
  const pctUsadoReal = temLimite ? (gastosHoje / limiteHoje) * 100 : 0
  const pctAnel = Math.min(100, Math.max(0, pctUsadoReal))
  const pctLabel = Math.min(100, Math.round(pctUsadoReal))
  const statusDiario = !temLimite
  ? null
  : pctUsadoReal >= 100
    ? { cor: '🔴', texto: 'Limite diário ultrapassado' }
    : pctUsadoReal >= 80
      ? { cor: '🟡', texto: 'Atenção aos gastos' }
      : { cor: '🟢', texto: 'Dentro do limite diário' }
  // Cor do anel: branco dentro do planejado; amarelo em atenção; vermelho ao estourar.
  const corAnel =
    pctUsadoReal > 100 ? '#fecaca'          // red-200
    : pctUsadoReal >= 80 ? '#fde68a'        // amber-200
    : 'rgba(255,255,255,0.95)'

  return (
    <div className="af-money-card h-full bg-marca-grad-dark rounded-2xl p-3 sm:p-4 lg:!py-3 lg:shadow-lg lg:shadow-black/5 text-white">
      {/* Versão MOBILE compacta: mesmos dados e ações, sem cálculos paralelos. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-white/90 mb-2">
          <Wallet size={16} /> Meu dinheiro
        </div>
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="min-w-0 border-r border-white/20 pr-2">
            <p className="text-[11px] text-white/75">Saldo atual</p>
            <p className="text-xl font-extrabold tabular-nums tracking-tight leading-tight whitespace-nowrap">
              {mostrarSaldo ? exibirMoeda(saldoAtual, ocultar) : '—'}
            </p>
            {onEditarSaldo && mostrarSaldo && (
              <button type="button" onClick={onEditarSaldo} className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/80">
                <Pencil size={11} /> Editar saldo
              </button>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-white/75">Limite para hoje</p>
            <div className="flex items-center gap-1">
              <p className="text-xl font-extrabold tabular-nums tracking-tight leading-tight whitespace-nowrap">
                {exibirMoeda(Math.max(0, limiteHoje), ocultar)}
              </p>
              {onEditarLimite && (
                <button type="button" onClick={onEditarLimite} aria-label="Editar limite diário" className="shrink-0 text-white/80">
                  <Pencil size={12} />
                </button>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/80">{temLimite ? `${pctLabel}% utilizado hoje` : 'Sem limite definido'}</p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pctAnel}>
          <div className="h-full rounded-full" style={{ width: `${pctAnel}%`, backgroundColor: corAnel }} />
        </div>
      </div>

      {/* Desktop: resumo compacto, sem anel redundante quando o limite é zero.
          Os valores continuam vindo dos cálculos e props existentes. */}
      <div className="hidden sm:grid sm:grid-cols-2 items-start gap-3 lg:gap-5">
        {mostrarSaldo && (
          <div className="min-w-0 sm:border-r sm:border-white/20 sm:pr-4">
            <p className="text-xs font-semibold text-white/90 flex items-center gap-2"><Wallet size={15} /> Meu dinheiro</p>
            <p className="text-xs text-white/75 mt-1">Saldo atual</p>
            <p className="text-2xl sm:text-3xl font-extrabold tabular-nums leading-tight break-words">
              {exibirMoeda(saldoAtual, ocultar)}
            </p>
            {onEditarSaldo && (
              <button type="button" onClick={onEditarSaldo} className="inline-flex items-center gap-1 mt-1 text-xs text-white/85 hover:text-white">
                <Pencil size={12} /> Editar saldo
              </button>
            )}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-white/80">Limite para gastar hoje</p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-2xl sm:text-3xl font-bold leading-tight tabular-nums break-words">
              {exibirMoeda(Math.max(0, limiteHoje), ocultar)}
            </p>
            {onEditarLimite && (
              <button type="button" onClick={onEditarLimite} aria-label="Editar limite diário" className="text-white/85 hover:text-white flex-shrink-0">
                <Pencil size={15} />
              </button>
            )}
          </div>
          <button type="button" onClick={onVerCompleto} disabled={!onVerCompleto}
            className="inline-flex items-start gap-1.5 mt-1 text-xs text-white/90 hover:text-white text-left disabled:cursor-default">
            {semBaseFinanceira ? (
              <>Cadastre sua renda para calcular seu limite diário</>
            ) : configIncompleta ? (
              <>Finalize sua configuração para melhorar a estimativa</>
            ) : estadoOrcamento === 'negativo' ? (
              <><AlertTriangle size={14} className="shrink-0 mt-px text-amber-200" /> Orçamento projetado comprometido. Ver detalhes</>
            ) : estadoOrcamento === 'equilibrado' ? (
              <>Sem margem adicional no planejamento. Ver detalhes</>
            ) : estadoOrcamento === 'positivo' ? (
              <>Disponível projetado: {exibirMoeda(disponivelReal, ocultar)}. Ver detalhes</>
            ) : (
              <>Consultar seu planejamento</>
            )}
          </button>
        </div>
      </div>

      {/* Gasto de hoje × restante */}
      <div className="grid grid-cols-2 gap-2 lg:gap-3 mt-2 sm:mt-3">
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

      {/* Aviso discreto: configuração incompleta (faltam dados-base como saldo,
          renda ou despesas recorrentes). O número exibido é uma ESTIMATIVA
          provisória — não um orçamento validado. Não altera nenhum cálculo. */}
      {!semBaseFinanceira && configIncompleta && (
        <div className="mt-2.5 flex items-start gap-2 bg-black/20 rounded-xl px-3 py-2">
          <Info size={14} className="flex-shrink-0 mt-0.5 text-white/80" />
          <p className="text-[11px] lg:text-xs text-white/80 leading-snug">
            <span className="font-semibold text-white">Estimativa provisória.</span>{' '}
            Finalize sua configuração para ver um cálculo mais preciso.
          </p>
        </div>
      )}

      {/* Rodapé do card: "Ver planejamento completo" + (quando aplicável) o
          check-in "Não gastei hoje" alinhado à direita. Mesma função de antes
          (onNaoGasteiHoje/jaFezCheckin), só reposicionado para dentro do card. */}
      {(onVerCompleto || mostrarCheckin) && (
        <div className="mt-2 flex items-center justify-between gap-3">
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

// Resumo compacto da evolução da Home. Dados já fornecidos por useProjecao.
function EvolucaoFinanceiraHome({ projecao = [], ocultar }) {
  const [aberto, setAberto] = useState(false)
  const [verTodos, setVerTodos] = useState(false)
  const [mesAberto, setMesAberto] = useState(null)
  const meses = Array.isArray(projecao) ? projecao.slice(0, 12) : []
  const atual = meses[0]
  const numero = valor => Number.isFinite(Number(valor)) ? Number(valor) : 0
  // Resultado mensal: receitas menos despesas da projeção (não é saldo bancário).
  const resultado = m => numero(m?.receitas) - numero(m?.despesas)
  const resultadoAtual = atual ? resultado(atual) : null
  const itensVisiveis = verTodos ? meses : meses.slice(0, 4)

  return (
    <section className="af-dash-card min-w-0" aria-label="Evolução financeira">
      <button type="button" onClick={() => setAberto(v => !v)}
        aria-expanded={aberto} aria-controls="af-evolucao-home-detalhes"
        className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">Evolução financeira</span>
          <span className="block mt-1 text-xs text-slate-500">Resultado previsto do mês</span>
          <span className={`block mt-1 text-lg font-bold break-words ${resultadoAtual == null ? 'text-slate-500' : resultadoAtual < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
            {resultadoAtual == null ? 'Sem projeção' : exibirMoeda(resultadoAtual, ocultar)}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-2 text-xs font-semibold text-marca">
          {aberto ? 'Fechar' : 'Ver detalhes'}
          {aberto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </span>
      </button>
      {aberto && (
        <div id="af-evolucao-home-detalhes" className="mt-4 pt-4 border-t border-marca/15 space-y-3">
          {atual ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-800">Receitas previstas</p>
                <p className="mt-1 font-semibold text-sm text-emerald-800 break-words">{exibirMoeda(numero(atual.receitas), ocultar)}</p>
              </div>
              <div className="min-w-0 rounded-xl bg-rose-50 p-3">
                <p className="text-xs text-rose-700">Despesas previstas</p>
                <p className="mt-1 font-semibold text-sm text-rose-700 break-words">{exibirMoeda(numero(atual.despesas), ocultar)}</p>
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">Ainda não há dados de projeção.</p>}
          {itensVisiveis.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Próximos períodos projetados</p>
              {itensVisiveis.map((m, i) => (
                <div key={`${m.mes || 'mes'}-${i}`} className="rounded-xl border border-slate-200 overflow-hidden">
                  <button type="button" onClick={() => setMesAberto(v => v === i ? null : i)}
                    aria-expanded={mesAberto === i}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left">
                    <span className="text-sm text-slate-700 capitalize truncate">{m.mes || `Mês ${i + 1}`}</span>
                    <span className={`ml-auto text-sm font-semibold break-words ${resultado(m) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {exibirMoeda(resultado(m), ocultar)}
                    </span>
                    {mesAberto === i ? <ChevronUp size={15} className="shrink-0 text-marca" /> : <ChevronDown size={15} className="shrink-0 text-marca" />}
                  </button>
                  {mesAberto === i && (
                    <div className="px-3 py-3 border-t border-slate-200 bg-slate-50 space-y-2 text-xs">
                      <div className="flex justify-between gap-2"><span>Receitas previstas</span><strong className="text-emerald-700">{exibirMoeda(numero(m.receitas), ocultar)}</strong></div>
                      <div className="flex justify-between gap-2"><span>Despesas previstas</span><strong className="text-rose-600">{exibirMoeda(numero(m.despesas), ocultar)}</strong></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {meses.length > 4 && (
            <button type="button" onClick={() => setVerTodos(v => !v)} className="w-full py-2 text-xs font-semibold text-marca">
              {verTodos ? 'Mostrar menos' : `Ver todos os ${meses.length} meses`}
            </button>
          )}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-500">Estimativas, não histórico realizado.</span>
            <Link to="/projecao" className="shrink-0 text-xs font-semibold text-marca">Abrir projeção →</Link>
          </div>
        </div>
      )}
    </section>
  )
}

export default function Dashboard() {
  const [abaMovimentacoes, setAbaMovimentacoes] = useState('transacoes');
  const [paginaAtalhos, setPaginaAtalhos] = useState(0)
  const atalhosMobileRef = useRef(null)
  const { perfil, atualizarPreferenciasLimite, somenteLeitura, usuario, idUsuarioLogado, corTema } = useAuth()
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
    // antecipação reaproveitada no card "Próximos 7 dias"
    anteciparPagamento,
  } = useProjecao()
  // Fonte completa somente para o calendario; nao afeta useProjecao/orcamento.
  const { receitas: receitasCalendario, carregando: carregandoReceitasCalendario } = useReceitas()
  const { despesas: despesasCalendario, carregando: carregandoDespesasCalendario } = useDespesas()
  // Para gastos no cartão de crédito: grava em compras_cartao (entra na fatura,
  // não desconta do saldo à vista). Demais formas seguem em despesas.
  const { criar: criarCompraCartao } = useComprasCartao()
  // Consultoria — SOMENTE LEITURA aqui, para o card compacto da Home refletir o
  // estado (registrado ou não). O registro de interesse continua acontecendo na
  // página /consultoria (mesma fonte/hook, sem duplicar lógica).
  const { interesses: interessesConsultoria } = useConsultoriaInteresses()
  const jaRegistrouConsultoria = (interessesConsultoria?.length ?? 0) > 0
  // Benefícios (VR/VA) — dados reais do Supabase para os 2 cards compactos da
  // Home. Reutiliza o MESMO hook da aba Benefícios (sem duplicar lógica).
  const { beneficios, saldoDoBeneficio, proximaRecarga, registrarGastoRapido } = useBeneficios()
  const beneficioPorTipo = (tipo) => beneficios.find(b => b.tipo === tipo) || null
  // Patrimônio investido (card "Meu Patrimônio"). Reutiliza o hook da aba
  // Investimentos. NÃO entra no saldo/limite/receitas — é patrimônio separado.
  const { investimentos, patrimonioTotal, reservaVinculada } = useInvestimentos()
  // Modo da reserva: 'vinculada' soma reserva_valor dos investimentos; 'manual'
  // usa perfis.reserva_atual (comportamento atual). Default manual.
  const reservaModo = perfil?.reserva_modo === 'vinculada' ? 'vinculada' : 'manual'
  // Mesmo mês controla calendário e resumo; projeção vem do motor existente.
  const [mesCalendarioHome, setMesCalendarioHome] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1, 12)
  })
  const mesesAFrenteHome = (mesCalendarioHome.getFullYear() - new Date().getFullYear()) * 12
    + mesCalendarioHome.getMonth() - new Date().getMonth()
  const ehMesAtualHome = mesesAFrenteHome === 0
  const projecaoHome = mesesAFrenteHome >= 0 ? projecao?.[mesesAFrenteHome] : null
  const receitaResumoHome = ehMesAtualHome ? resumoMes.receitaTotal : projecaoHome?.receitas
  const despesaResumoHome = ehMesAtualHome ? resumoMes.despesaTotal : projecaoHome?.despesas
  const resultadoResumoHome = ehMesAtualHome ? resumoMes.sobraPrevista
    : (projecaoHome && Number(projecaoHome.receitas || 0) - Number(projecaoHome.despesas || 0))
  const valorResumoHome = valor => valor == null ? 'Sem projeção disponível' : exibirMoeda(valor, ocultar)
  const navigate = useNavigate()

  const [gastoRapidoBeneficio, setGastoRapidoBeneficio] = useState(null)
  const [salvandoGastoBeneficio, setSalvandoGastoBeneficio] = useState(false)
  const [erroGastoBeneficio, setErroGastoBeneficio] = useState('')
  async function salvarGastoBeneficio(dados) {
    if (salvandoGastoBeneficio || somenteLeitura) return
    setSalvandoGastoBeneficio(true)
    setErroGastoBeneficio('')
    try {
      await registrarGastoRapido(dados)
      setGastoRapidoBeneficio(null)
    } catch (err) {
      setErroGastoBeneficio(err?.message || 'Não foi possível registrar o gasto.')
    } finally {
      setSalvandoGastoBeneficio(false)
    }
  }
  const [dataGastoCalendario, setDataGastoCalendario] = useState(null)
  const [modalGasto, setModalGasto] = useState(false)
  const [salvandoGasto, setSalvandoGasto] = useState(false)
  const salvamentoGastoEmAndamento = useRef(false)
  const [erroGasto, setErroGasto] = useState('')
  const [confirmacaoGasto, setConfirmacaoGasto] = useState(null) // { msg, limite }
  const [modalLimite, setModalLimite] = useState(false)
  const [salvandoLimite, setSalvandoLimite] = useState(false)
  const [modalReservaAtual, setModalReservaAtual] = useState(false)
  const [salvandoReservaAtual, setSalvandoReservaAtual] = useState(false)
  const [modalSaldo, setModalSaldo] = useState(false)
  const [salvandoSaldo, setSalvandoSaldo] = useState(false)
  const [modalProjecao, setModalProjecao] = useState(false) // detalhes dos 12 meses
  const [modalPlanejamento, setModalPlanejamento] = useState(false) // "Quanto posso gastar?" completo

  const [modalNotificacoes, setModalNotificacoes] = useState(false) // central de notificações (sino)
  const [filtroNotificacoes, setFiltroNotificacoes] = useState('todas')
  const [notificacoesExpandidas, setNotificacoesExpandidas] = useState({ saldo: true })
  const [notificacoesLidas, setNotificacoesLidas] = useState({})
  const [modalCalendario, setModalCalendario] = useState(false) // calendário financeiro (abre pela linha "Calendário")
  // Cards móveis: fechados por padrão, cada um expande independentemente.
  const [cardsMobileAbertos, setCardsMobileAbertos] = useState({})
  const alternarCardMobile = (chave) => setCardsMobileAbertos(anterior => ({ ...anterior, [chave]: !anterior[chave] }))
  // Antecipação de pagamento a partir do card "Próximos 7 dias".
  const [despesaAntecipar, setDespesaAntecipar] = useState(null)
  const [antecipandoHome, setAntecipandoHome] = useState(false)

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
  const dataProximaReceita = resumoMes.dataProximaReceita
  const primeiroPendente = onboardingItens.find(i => !i.concluido)
  // Dispensa do card (persistida no perfil, não em localStorage). Enquanto a
  // coluna não existir no banco, o estado local (dispensadoLocal) segura a
  // dispensa na sessão e a gravação falha em silêncio (fallback).
  const [dispensadoLocal, setDispensadoLocal] = useState(false)
  const comeceDispensado = perfil?.comece_por_aqui_dispensado === true || dispensadoLocal
  // Mostra só até concluir os 4 OU até o usuário dispensar; some automaticamente
  // quando tudo estiver pronto.
  const mostrarComecePorAqui = !carregando && totalConcluidos < onboardingItens.length && !comeceDispensado

  async function handleDispensarComece() {
    setDispensadoLocal(true) // some imediatamente (otimista)
    try {
      await atualizarPreferenciasLimite({ comece_por_aqui_dispensado: true })
    } catch {
      // Coluna ausente ou falha de rede: mantém dispensado só nesta sessão.
    }
  }

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
  // Calendário: usa o mesmo motor de fluxo de caixa do Horizonte Financeiro.
  // Os valores são projetados a partir do saldo atual, sem alterar registros.
  const horizonteCalendario = useMemo(() => {
    if (carregando || carregandoReceitasCalendario || carregandoDespesasCalendario || !resumoMes.saldoConfigurado) return []
    return gerarHorizonte({
      receitas: receitasCalendario, despesas: despesasCalendario, recorrentes, parcelamentos,
      cartoes, comprasCartao, faturasInformadas,
      saldoInicial: Number(saldoDisponivelAgora) || 0,
      reservaPct,
      meses: 12,
    })
  }, [
    carregando, carregandoReceitasCalendario, carregandoDespesasCalendario, resumoMes.saldoConfigurado, saldoDisponivelAgora,
    receitasCalendario, despesasCalendario, recorrentes, parcelamentos,
    cartoes, comprasCartao, faturasInformadas, reservaPct,
  ])
  const previsaoFimMes = resumoMes.previsaoFimMes
  const saldoSeguroHoje = resumoMes.saldoSeguroHoje ?? 0
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
  // calcularLimiteDiario já deduz a reserva: não subtrair aqui novamente.
  baseLivre: Math.max(0, Number(saldoSeguroHoje) || 0),
  saldoConfigurado,
  dataProximaReceita,
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
          dataVencimento: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          tipoLancamento: 'Despesa',
          cor: 'bg-red-400',
          // Despesa à vista é antecipável: carrega o registro cru para o modal.
          antecipavel: true,
          despesa: d,
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
          dataVencimento: venc.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          tipoLancamento: 'Fatura',
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
    // Ref impede dois inserts mesmo em cliques feitos antes do próximo render.
    if (salvamentoGastoEmAndamento.current) return
    salvamentoGastoEmAndamento.current = true
    setSalvandoGasto(true)
    setErroGasto('')
    try {
      // Guarda-chuva: sem sessão/escrita (ou em modo consultoria somente leitura)
      // o insert falharia de forma silenciosa. Dá um erro claro em vez disso.
      if (somenteLeitura) {
        throw new Error('Modo consultoria é somente leitura — não é possível registrar gastos.')
      }
      if (!idUsuarioLogado) {
        throw new Error('Sessão expirada. Entre novamente para registrar o gasto.')
      }
      const valorGasto = Number(dados.valor)
      if (!Number.isFinite(valorGasto) || valorGasto <= 0) {
        throw new Error('Informe um valor maior que zero.')
      }
      if (dados.forma_pagamento === 'cartao_credito' && !dados.cartao_id) {
        throw new Error('Selecione o cartão de crédito para registrar esta compra.')
      }
      // Benefícios são movimentos separados: nunca lançá-los em despesas bancárias.
      if (dados.tipo_beneficio) {
        const beneficio = beneficios.find(b => String(b.id) === String(dados.beneficio_id))
        if (!beneficio || String(beneficio.tipo).toUpperCase() !== dados.tipo_beneficio) {
          throw new Error('Selecione um benefício VR/VA válido.')
        }
        await registrarGastoRapido({
          beneficio_id: dados.beneficio_id,
          valor: valorGasto,
          descricao: dados.descricao,
        })
        setModalGasto(false)
        setConfirmacaoGasto({
          msg: `✓ ${formatCurrency(valorGasto)} descontado do ${dados.tipo_beneficio}`,
          limite: Math.max(0, limiteHoje),
        })
        return
      }
      const noCartaoCredito = dados.forma_pagamento === 'cartao_credito' 

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
          subcategoria_id: dados.subcategoria_id || null,
        })
        // Sucesso: fecha o modal e mostra o banner de confirmação na Home
        // (feedback visível + modal não fica "preso" aberto).
        setModalGasto(false)
        setConfirmacaoGasto({
          msg: `✓ ${formatCurrency(valorGasto)} lançado na fatura do cartão`,
          limite: Math.max(0, limiteHoje),
        })
        return
      }

      // ── Demais formas (Pix, dinheiro, débito, boleto, etc.) ──
      // Fluxo atual: grava em despesas (à vista, hoje) e desconta do saldo.
      // Remove campos que não são colunas de "despesas".
      const { cartao_id, beneficio_id, tipo_beneficio, ...despesa } = dados
      await criarDespesa(despesa)   // atualiza o estado interno → indicadores recalculam
      // Sucesso: fecha o modal e mostra o banner de confirmação na Home.
      setModalGasto(false)
      setConfirmacaoGasto({
        msg: `✓ ${formatCurrency(valorGasto)} registrado em ${categoriaNome}`,
        limite: Math.max(0, disponivelHoje - valorGasto),
      })
    } catch (err) {
      // Mostra o MOTIVO real do Supabase (coluna/constraint/RLS) em vez de uma
      // mensagem genérica, para o erro deixar de ser silencioso. Log no console
      // ajuda no diagnóstico; a UI exibe o texto do erro quando houver.
      console.error('[gasto rápido] falha ao salvar:', err)
      const motivo = err?.message || err?.hint || err?.details
      setErroGasto(motivo ? `Erro ao salvar o gasto: ${motivo}` : 'Erro ao salvar o gasto. Tente novamente.')
    } finally {
      salvamentoGastoEmAndamento.current = false
      setSalvandoGasto(false)
    }
  }

  // Lançamento iniciado pelo calendário: reutiliza o fluxo de criação da Home.
  // Receitas e compras parceladas usam as telas próprias, sem gravação paralela.
  function adicionarPeloCalendario({ tipo, data }) {
    if (somenteLeitura) return
    setModalCalendario(false)
    if (tipo === 'despesa') {
      setDataGastoCalendario(data)
      setErroGasto('')
      setModalGasto(true)
      return
    }
    if (tipo === 'receita') {
      navigate(`/receitas?novo=1&data=${encodeURIComponent(data)}`)
      return
    }
    if (tipo === 'cartao') {
      navigate(`/cartoes?novo=1&data=${encodeURIComponent(data)}`)
    }
  }

  // Abre o cadastro COMPLETO de despesas (todos os campos avançados já existentes).
  function handleMaisOpcoes() {
    setModalGasto(false)
    navigate('/despesas?novo=1')
  }

  // ─── Antecipar pagamento a partir do card "Próximos 7 dias" (Home) ───
  // Reaproveita anteciparPagamento (mesma instância de useDespesas do
  // useProjecao), então os indicadores da Home recalculam sozinhos. Não cria
  // nova despesa nem duplica: apenas marca pago_em (ver useProjecao).
  async function handleConfirmarAntecipacaoHome({ pago_em, forma_pagamento }) {
    if (!despesaAntecipar) return
    setAntecipandoHome(true)
    try {
      await anteciparPagamento(despesaAntecipar.id, { pago_em, forma_pagamento })
      setDespesaAntecipar(null)
    } catch {
      // mantém o modal aberto; o usuário pode tentar de novo
    } finally {
      setAntecipandoHome(false)
    }
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
    if (carregando || carregandoReceitasCalendario || carregandoDespesasCalendario) return null
    const saldoInicial = resumoMes.saldoConfigurado ? resumoMes.saldoDisponivelAgora : 0
    const meses = gerarHorizonte({
      receitas: receitasCalendario, despesas: despesasCalendario, recorrentes, parcelamentos,
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
    let saldoNaDataNegativa = null
    for (const m of meses) {
      for (const d of m.dias) {
        const dataDia = new Date(m.ano, m.mes - 1, d.dia)
        if (dataDia < hojeData || dataDia > limite) continue
        if (d.saldo < 0) { dataNegativa = dataDia; saldoNaDataNegativa = d.saldo; break }
      }
      if (dataNegativa) break
    }
    return { saldoAtual, fimDoMes, proximoMes, dataNegativa, saldoNaDataNegativa }
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

  // Fundo escuro do cabeçalho que ACOMPANHA a cor do tema. Hex estáticos (sem
  // classes Tailwind dinâmicas), com contraste alto para texto branco (WCAG AA).
  // Enquanto a preferência carrega (corTema indefinido), usa um grafite escuro
  // legível como fallback. Atualiza na hora ao trocar a cor (corTema muda).
  const HEADER_BG = {
    azul:  'linear-gradient(135deg, #0b1f3a 0%, #0a1626 100%)', // azul-marinho escuro
    rosa:  'linear-gradient(135deg, #4a1130 0%, #2c0a1d 100%)', // rosa-escuro
    verde: 'linear-gradient(135deg, #0b3a2a 0%, #07241a 100%)', // verde-escuro
    roxo:  'linear-gradient(135deg, #2e1246 0%, #1d0b2d 100%)', // roxo-escuro
    laranja: 'linear-gradient(135deg, #743d17 0%, #43230f 100%)',
    preto: 'linear-gradient(135deg, #1f2937 0%, #0b0f17 100%)', // grafite escuro
  }
  const headerBg = HEADER_BG[corTema] || HEADER_BG.preto
  // Paleta exclusiva da Home. As variáveis CSS atualizam quando corTema muda.
  const PALETAS_HOME = {
    azul:  { fundo: '#f2f7ff', claro: '#eaf2ff', borda: '#c9dcff', principal: '#2563eb', escuro: '#0f2342', painel: '#1e3357', suave: '#dbeafe' },
    rosa:  { fundo: '#fff5f9', claro: '#fff0f6', borda: '#fbc4da', principal: '#c0266c', escuro: '#40152b', painel: '#57213b', suave: '#fce7f3' },
    verde: { fundo: '#f2fbf7', claro: '#e9f9ef', borda: '#bce8cf', principal: '#15803d', escuro: '#103428', painel: '#20503e', suave: '#dcfce7' },
    roxo:  { fundo: '#f7f3ff', claro: '#f2edff', borda: '#d7c6ff', principal: '#7c3aed', escuro: '#24143e', painel: '#382453', suave: '#ede9fe' },
    laranja: { fundo: '#fff8f0', claro: '#fff1df', borda: '#fed7aa', principal: '#ea7600', escuro: '#65330a', painel: '#834519', suave: '#ffedd5' },
    preto: { fundo: '#f4f5f7', claro: '#edf0f4', borda: '#cbd5e1', principal: '#374151', escuro: '#111827', painel: '#273244', suave: '#e5e7eb' },
  }
  const paletaHome = PALETAS_HOME[corTema] || PALETAS_HOME.preto
  const HEADER_MOBILE = {
    azul: 'linear-gradient(120deg, #243e63, #203454)',
    rosa: 'linear-gradient(120deg, #68284a, #54243e)',
    verde: 'linear-gradient(120deg, #285944, #234738)',
    roxo: 'linear-gradient(120deg, #44265f, #38204f)',
    laranja: 'linear-gradient(120deg, #8a4c20, #713e1e)',
    preto: 'linear-gradient(120deg, #374151, #283241)',
  }
  const variaveisHome = {
    '--af-home-bg': paletaHome.fundo,
    '--af-home-light': paletaHome.claro,
    '--af-home-border': paletaHome.borda,
    '--af-home-primary': paletaHome.principal,
    '--af-home-dark': paletaHome.escuro,
    '--af-home-panel': paletaHome.painel,
    '--af-home-soft': paletaHome.suave,
    '--af-home-header-mobile': HEADER_MOBILE[corTema] || HEADER_MOBILE.preto,
  }

  return (
    // pb extra no MOBILE: garante que o último card ("Seu dia financeiro" com o
    // botão "Registrar gasto de hoje") role totalmente acima da barra inferior
    // fixa (que tem o botão "+" saliente). Zera no desktop (md:pb-0).
    <div className="af-desktop-fit af-home-themed w-full max-w-none min-w-0 flex flex-col gap-2 sm:gap-4 lg:gap-3 md:space-y-0 pb-2 md:pb-0 af-mobile-polished rounded-2xl p-2" style={variaveisHome}>
      <style>{`
        .af-home-themed { background: var(--af-home-bg); transition: background-color .2s ease; }
        .af-home-themed .af-dash-card { background: #fff; border: 1px solid var(--af-home-border); border-radius: 16px; padding: 16px; min-width: 0; box-shadow: 0 2px 12px rgba(15,23,42,.035); }
        .af-home-themed .af-dash-icon { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .af-home-themed .af-dash-action { display: inline-flex; align-items: center; gap: 6px; border-radius: 10px; background: var(--af-home-primary); color: white; font-size: 12px; font-weight: 600; padding: 9px 13px; }
        .af-home-themed .af-dash-ring { width: 64px; height: 64px; border-radius: 50%; padding: 8px; flex-shrink: 0; }
        .af-home-themed .af-dash-ring span { display: flex; width: 100%; height: 100%; border-radius: 50%; justify-content: center; align-items: center; background: white; font-size: 12px; font-weight: 700; color: #0f172a; }
        .af-home-themed .af-dash-card .text-marca { color: var(--af-home-primary) !important; }
        .af-home-themed .af-dash-card .bg-slate-50 { background-color: var(--af-home-light) !important; }
        .af-home-themed .af-dash-card .text-sky-300 { color: var(--af-home-soft) !important; }
        .af-home-themed .af-home-card-brand { background: var(--af-home-dark); }
        /* Calendário embutido: apenas o fundo temático e o contorno, sem mexer na lógica. */
        .af-home-themed .af-home-calendar-theme { border-radius: 14px; overflow: hidden; background: var(--af-home-dark); }
        .af-home-themed .af-home-calendar-theme > * { --af-cor-fundo: var(--af-home-dark); --af-cor-painel: var(--af-home-panel); }
        @media(max-width: 639px) { .af-dash-card {padding: 13px;} .af-dash-ring{width:58px;height:58px;} }
      `}</style>
      {/* Ajustes visuais apenas no desktop: compacta cards, calendário e atalhos.
          Sem overflow forçado: em monitores baixos o scroll permanece possível. */}
      <style>{`
        /* Desktop compacto: evita rolagem desnecessária em monitores usuais.
           Não altera mobile, cálculos, datas nem visibilidade das informações. */
        @media (min-width: 1024px) {
          .af-home-themed.af-desktop-fit { gap: 7px !important; padding: 6px !important; }
          .af-home-themed .af-home-header { padding-top: 7px !important; padding-bottom: 7px !important; }
          .af-home-desktop-compact { row-gap: 8px !important; }
          .af-home-desktop-compact .af-dash-card { padding: 10px 12px; border-radius: 13px; }
          .af-home-desktop-compact > section:first-child { gap: 8px; }
          .af-home-desktop-compact > section:first-child .af-dash-card { min-height: 99px; }
          .af-home-desktop-compact > section:first-child .af-dash-card p.mt-2 { margin-top: 4px; }
          .af-home-desktop-compact > section:first-child .af-dash-card button.mt-2 { margin-top: 4px; }
          .af-home-desktop-compact .af-dash-ring { width: 52px; height: 52px; padding: 7px; }
          .af-home-desktop-compact > div.grid { gap: 8px; }
          .af-home-desktop-compact section[aria-label="Calendário financeiro"] { padding: 10px 12px !important; }
          .af-home-desktop-compact section[aria-label="Calendário financeiro"] > .flex:first-child { margin-bottom: 3px; }
          .af-home-desktop-compact .af-calendar-fit { padding: 7px 10px !important; box-shadow: none; }
          .af-home-desktop-compact .af-calendar-fit header { margin-bottom: 4px !important; }
          .af-home-desktop-compact .af-calendar-fit header .h-10 { width: 30px; height: 30px; }
          .af-home-desktop-compact .af-calendar-fit .af-month-bar { margin-bottom: 3px !important; padding-top: 2px !important; padding-bottom: 2px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-month-bar button { padding: 4px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-cell,
          .af-home-desktop-compact .af-calendar-fit .af-calendar-empty { min-height: 31px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-cell { padding-top: 1px !important; padding-bottom: 1px !important; gap: 0 !important; }
          .af-home-desktop-compact .af-calendar-fit .af-calendar-footnote { margin-top: 3px !important; line-height: 1.2; }
          .af-home-desktop-compact .af-calendar-fit .af-day-details { padding: 7px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-details > .mb-3 { margin-bottom: 5px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-details .p-3 { padding: 7px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-details .p-2\.5 { padding: 6px !important; }
          .af-home-desktop-compact .af-calendar-fit .af-day-details .py-4 { padding-top: 8px !important; padding-bottom: 8px !important; }
          .af-home-desktop-compact section[aria-label="Calendário financeiro"] > button.mt-3 { margin-top: 5px; }
          .af-home-desktop-compact aside[aria-label="Detalhes do dia selecionado"] { min-height: 0; }
          .af-home-desktop-compact aside.grid { gap: 8px; }
          .af-home-desktop-compact aside.grid .af-dash-card .mb-3 { margin-bottom: 6px; }
          .af-home-desktop-compact aside.grid .af-dash-card .mt-3 { margin-top: 6px; }
          .af-home-desktop-compact aside.grid .af-dash-card .p-3 { padding: 8px; }
          .af-home-desktop-compact > div.grid:last-of-type .af-dash-card .mb-4 { margin-bottom: 6px; }
          .af-home-desktop-compact > div.grid:last-of-type .af-dash-card .h-36 { height: 106px; }
          .af-home-desktop-compact > div.grid:last-of-type .af-dash-card .h-28 { height: 82px; }
          .af-home-desktop-compact > div.grid:last-of-type .af-dash-card .mt-3 { margin-top: 5px; }
        }
        /* Ajustes exclusivamente mobile. Desktop preservado. */
        @media (max-width: 639px) {
          /* O Layout já reserva espaço da barra fixa; não duplicar esse espaço na Home. */
          /* A Home termina naturalmente após o carrossel. Sem bloco lilás
             delimitando o conteúdo e sem padding duplicado da barra fixa.
             O espaço livre de telas altas fica com o fundo neutro do Layout,
             sem aparentar um card vazio ou um erro de renderização. */
          .af-home-themed.af-mobile-polished {
            background: transparent !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            /* Sem altura mínima: mantém os cards juntos, imediatamente
               abaixo do cabeçalho, em qualquer altura de celular. */
            min-height: 0 !important;
            height: auto !important;
            justify-content: flex-start !important;
            align-content: start !important;
            padding: 0 0 5px !important;
            margin-bottom: 0 !important;
            gap: 7px !important;
          }
          .af-home-themed.af-mobile-polished > section:last-of-type {
            margin-bottom: 0 !important;
          }
          .af-mobile-polished { gap: 7px; padding-bottom: 8px !important; min-height: 0 !important; }
          .af-mobile-polished .af-home-header { background-image: var(--af-home-header-mobile) !important; }
          .af-mobile-polished .af-home-header { padding: 6px 10px; min-height: 44px; border-radius: 12px; }
          .af-mobile-polished .af-home-header h1 { font-size: 15px; line-height: 18px; }
          .af-mobile-polished .af-home-header p { font-size: 10px; line-height: 13px; }
          .af-mobile-polished .af-home-header button { width: 29px; height: 29px; border-radius: 8px; }
          .af-mobile-polished .af-top-cards { gap: 5px; }
          .af-mobile-polished .af-money-card { padding: 8px 10px; border-radius: 13px; }
          .af-mobile-polished .af-money-card > div:first-child > div:first-child { margin-bottom: 2px; }
          .af-mobile-polished .af-money-card > div:first-child .grid { gap: 5px; }
          .af-mobile-polished .af-money-card > div:first-child .grid p.text-xl { font-size: 18px; }
          .af-mobile-polished .af-money-card > .grid { margin-top: 4px; gap: 5px; }
          .af-mobile-polished .af-money-card > .grid > div { padding: 4px 7px; }
          .af-mobile-polished .af-money-card > div:last-child { margin-top: 4px; }
          .af-mobile-polished .af-patrimonio { padding: 8px 10px; border-radius: 13px; display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); column-gap: 8px; row-gap: 2px; align-items: center; }
          .af-mobile-polished .af-patrimonio > div:first-child { grid-column: 1 / -1; }
          .af-mobile-polished .af-patrimonio > div:nth-child(2) { margin-top: 0; }
          .af-mobile-polished .af-patrimonio > div:nth-child(2) p.text-2xl { font-size: 20px; line-height: 25px; margin-top: 2px; }
          .af-mobile-polished .af-patrimonio > div:nth-child(3) { margin-top: 0; padding: 5px 7px; }
          .af-mobile-polished .af-patrimonio > div:nth-child(3) p { font-size: 10px; }
          .af-mobile-polished .af-patrimonio > div:nth-child(3) p.text-base { font-size: 16px; }
          .af-mobile-polished .af-patrimonio > div:nth-child(3) .h-1\.5 { margin-top: 2px; }
          .af-mobile-polished .af-calendar-fit { padding: 7px 9px; }
          .af-mobile-polished .af-calendar-fit header { margin-bottom: 5px; }
          .af-mobile-polished .af-calendar-fit .af-month-bar { margin-bottom: 4px; padding-top: 3px; padding-bottom: 3px; }
          .af-mobile-polished .af-calendar-fit .af-day-cell,
          .af-mobile-polished .af-calendar-fit .af-calendar-empty { min-height: 40px; }
          .af-mobile-polished .af-calendar-fit .af-day-cell { gap: 1px; padding-top: 2px; padding-bottom: 2px; }
          /* Esconde apenas decorações e comprime margens; dados e botões permanecem. */
          .af-mobile-polished .af-money-card .af-daily-status { display: none; }
          .af-mobile-polished .af-money-card .order-1 { padding-bottom: 2px; gap: 0; }
          .af-mobile-polished .af-money-card .order-1 p.mt-1 { margin-top: 1px; }
          .af-mobile-polished .af-money-card .order-3 p.mt-0\.5 { margin-top: 0; }
          .af-mobile-polished .af-patrimonio > div:nth-child(3) p.mt-1\.5 { margin-top: 2px; }
          .af-mobile-polished .af-calendar-fit .af-calendar-footnote { margin-top: 4px; }
          .af-mobile-polished .af-home-atalhos > * { padding: 8px 4px; gap: 4px; }
          .af-mobile-polished .af-home-atalhos > * > span:first-child { width: 30px; height: 30px; }
        }
        @media (min-width: 1024px) {
          .af-desktop-fit .af-home-header { padding-top: 9px; padding-bottom: 9px; }
          .af-desktop-fit .af-home-header h1 { font-size: 1.25rem; }
          .af-desktop-fit .af-top-cards { gap: 10px; }
          .af-desktop-fit .af-money-card { padding: 13px 16px; }
          .af-desktop-fit .af-money-card > div:nth-child(2) { column-gap: 10px; row-gap: 5px; }
          .af-desktop-fit .af-money-card .af-daily-status { display: none; }
          .af-desktop-fit .af-patrimonio { padding: 13px 16px; }
          .af-desktop-fit .af-patrimonio > div:nth-child(2),
          .af-desktop-fit .af-patrimonio > div:nth-child(3) { margin-top: 5px; }
          .af-desktop-fit .af-calendar-fit { padding: 10px 14px; }
          .af-desktop-fit .af-calendar-fit header { margin-bottom: 8px; }
          .af-desktop-fit .af-calendar-fit .af-month-bar { margin-bottom: 6px; padding-top: 4px; padding-bottom: 4px; }
          .af-desktop-fit .af-calendar-fit .af-day-cell,
          .af-desktop-fit .af-calendar-fit .af-calendar-empty { min-height: 42px; }
          .af-desktop-fit .af-calendar-fit .af-day-cell { padding-top: 2px; padding-bottom: 2px; gap: 1px; }
          .af-desktop-fit .af-calendar-fit .af-calendar-footnote { margin-top: 5px; font-size: 10px; }
          .af-desktop-fit .af-calendar-fit .af-day-details { padding: 9px; }
          .af-desktop-fit .af-home-atalhos > * { padding: 6px 10px; flex-direction: row; gap: 10px; }
          .af-desktop-fit .af-home-atalhos > * > span:first-child { width: 30px; height: 30px; }
          .af-desktop-fit .af-home-atalhos > * > span:first-child svg { width: 17px; height: 17px; }
        }
      `}</style>
      {/* 1 ─ Cabeçalho: saudação (horário de Brasília) + subtítulo fixo, sininho
          de notificações (ponto vermelho só quando há pendência real) e botão
          global de ocultar valores. */}
      <div
        className="af-home-header relative flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3 sm:py-3.5 -mx-1 shadow-sm overflow-hidden"
        style={{ backgroundImage: headerBg }}
      >
        {/* Estrelas (só à noite, decorativas) */}
        {ehNoite && <span className="sky-stars" aria-hidden="true" />}
        <div className="min-w-0 relative">
          <div className="flex items-center gap-1.5 min-w-0">
<h1 className="text-xl sm:text-2xl font-bold truncate leading-tight !text-white">{saudacao}</h1>
            {aparenciaDinamica && (
              ehNoite
                ? <Moon size={16} className="text-slate-200 flex-shrink-0" aria-hidden="true" />
                : <Sun size={16} className="text-amber-400 flex-shrink-0" aria-hidden="true" />
            )}
          </div>
          <p className="text-xs sm:text-sm truncate text-slate-300">Vamos cuidar das suas finanças hoje?</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 relative">
          <button
            onClick={() => setModalNotificacoes(true)}
            aria-label={temNotificacao ? 'Você tem notificações' : 'Notificações'}
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors bg-white/15 text-slate-100 hover:bg-white/25"
          >
            <Bell size={18} />
            {temNotificacao && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-slate-800" />
            )}
          </button>
          <button
            onClick={alternar}
            aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors bg-white/15 text-slate-100 hover:bg-white/25"
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
          onDispensar={handleDispensarComece}
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

      {/* HOME COMPACTA MOBILE: apenas apresentação; mantém as fontes de dados reais. */}
      <section className="md:hidden space-y-2" aria-label="Resumo compacto das finanças">
        <div className="af-dash-card !p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Saldo disponível</span>
            <button type="button" onClick={alternar} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'} className="text-slate-500">
              {ocultar ? <EyeOff size={17}/> : <Eye size={17}/>}
            </button>
          </div>
          <div className="flex items-center justify-between gap-2 mt-1">
            <strong className="text-2xl text-slate-900 break-all">{carregando ? 'Carregando...' : saldoConfigurado ? exibirMoeda(saldoDisponivelAgora, ocultar) : 'Não configurado'}</strong>
            {!somenteLeitura && <button type="button" onClick={() => setModalSaldo(true)} className="text-xs text-marca shrink-0"><Pencil size={15}/></button>}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 mt-3 pt-3">
            <button type="button" onClick={() => navigate('/receitas')} className="min-w-0 text-left">
              <span className="flex items-center gap-1 text-xs text-slate-500"><TrendingUp size={14} className="text-emerald-500"/> Receitas</span>
              <strong className="block mt-1 text-sm text-slate-900 break-words">{exibirMoeda(receitaMes, ocultar)}</strong>
            </button>
            <button type="button" onClick={() => navigate('/despesas')} className="min-w-0 text-left">
              <span className="flex items-center gap-1 text-xs text-slate-500"><TrendingDown size={14} className="text-rose-500"/> Compromissos</span>
              <strong className="block mt-1 text-sm text-slate-900 break-words">{exibirMoeda(compromissosMes, ocultar)}</strong>
            </button>
          </div>
        </div>

        <button type="button" onClick={() => setModalPlanejamento(true)} className="af-dash-card !p-4 w-full text-left flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs text-slate-500">Você pode gastar hoje</span>
            <strong className="block mt-1 text-xl text-slate-900 break-words">{exibirMoeda(Math.max(0, limiteHoje), ocultar)}</strong>
            <span className="text-[11px] text-marca">Ver planejamento <ArrowRight size={12} className="inline"/></span>
          </div>
          <div className="af-dash-ring" style={{background: `conic-gradient(${gastosDeHoje > limiteHoje ? '#ef4444' : '#10b981'} ${limiteHoje > 0 ? Math.min(100,Math.max(0,gastosDeHoje / limiteHoje * 100)) : 0}%, #e2e8f0 0)`}}>
            <span>{limiteHoje > 0 ? `${Math.round(Math.min(100,Math.max(0,gastosDeHoje / limiteHoje * 100)))}%` : '—'}</span>
          </div>
        </button>

        <section className="af-dash-card !p-3" aria-label="Calendário financeiro compacto">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-sm text-slate-900">Calendário financeiro</h2>
            <button type="button" onClick={() => setModalCalendario(true)} className="text-xs text-marca flex items-center gap-1">Ver mês <ArrowRight size={13}/></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({length:7},(_,i) => {
              const referencia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(),12)
              const inicio = new Date(referencia)
              inicio.setDate(inicio.getDate() - ((inicio.getDay()+6)%7))
              const data = new Date(inicio)
              data.setDate(inicio.getDate()+i)
              const selecionado = data.toDateString() === referencia.toDateString()
              return <button key={i} type="button" onClick={() => setModalCalendario(true)} className="flex flex-col items-center gap-1 min-w-0" aria-label={`Abrir calendário em ${data.toLocaleDateString('pt-BR')}`}>
                <span className="text-[10px] text-slate-500">{['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]}</span>
                <span className={`w-full py-2 rounded-lg text-xs font-medium text-center ${selecionado ? 'text-white' : 'text-slate-700 bg-slate-100'}`} style={selecionado ? {backgroundColor: 'var(--af-home-primary)'} : undefined}>{data.getDate()}</span>
              </button>
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 mt-3">
            <span className="text-xs text-slate-500">Toque em um dia para ver os lançamentos</span>
            {!somenteLeitura && <button type="button" onClick={() => {setDataGastoCalendario(null);setModalGasto(true)}} aria-label="Adicionar lançamento" className="text-marca"><Plus size={19}/></button>}
          </div>
        </section>

        {/* Ícones deslizantes: quatro por página, sem título. */}
        <section aria-label="Atalhos financeiros deslizantes" className="af-mobile-shortcuts af-dash-card !p-3">
          <div
            ref={atalhosMobileRef}
            onScroll={(e) => {
              const el = e.currentTarget
              const proxima = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
              setPaginaAtalhos(Math.min(2, Math.max(0, proxima)))
            }}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth overscroll-x-contain"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {[
              [
                { label: 'Simular compra', rota: '/posso-comprar', Icone: ShoppingCart },
                { label: 'E se...?', rota: '/e-se', Icone: Sparkles },
                { label: 'Calendário', rota: '/projecao', Icone: CalendarClock },
                { label: 'Minha evolução', rota: '/minha-evolucao', Icone: BarChart2 },
              ],
              [
                { label: 'Cartões', rota: '/cartoes', Icone: CreditCard },
                { label: 'VR / VA', rota: '/beneficios', Icone: UtensilsCrossed },
                { label: 'Investimentos', rota: '/investimentos', Icone: TrendingUp },
                { label: 'Metas', rota: '/metas', Icone: Target },
              ],
              [
                { label: 'Receitas', rota: '/receitas', Icone: TrendingUp },
                { label: 'Despesas', rota: '/despesas', Icone: ReceiptText },
                { label: 'Parcelamentos', rota: '/parcelamentos', Icone: CalendarClock },
                { label: 'Projeção', rota: '/projecao', Icone: BarChart2 },
              ],
            ].map((pagina, index) => (
              <div key={index} className="w-full min-w-full shrink-0 snap-start grid grid-cols-4 gap-1.5">
                {pagina.map(({ label, rota, Icone }) => (
                  <button key={rota} type="button" onClick={() => navigate(rota)}
                    className="min-w-0 flex flex-col items-center gap-1.5 rounded-xl px-0.5 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca"
                    aria-label={`Abrir ${label}`}>
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'var(--af-home-soft)', color: 'var(--af-home-primary)' }}>
                      <Icone size={21} strokeWidth={1.9}/>
                    </span>
                    <span className="text-[10px] leading-3 text-center font-medium text-slate-800 break-words">{label}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-2" aria-label="Páginas dos atalhos">
            {[0, 1, 2].map(i => (
              <button type="button" key={i} aria-label={`Ir para a página ${i + 1} dos atalhos`}
                aria-current={paginaAtalhos === i ? 'true' : undefined}
                onClick={() => {
                  atalhosMobileRef.current?.scrollTo({ left: i * atalhosMobileRef.current.clientWidth, behavior: 'smooth' })
                  setPaginaAtalhos(i)
                }}
                className="p-1.5">
                <span className="block h-1.5 rounded-full transition-all" style={{width: paginaAtalhos===i ? 16 : 6,
                  backgroundColor: paginaAtalhos===i ? 'var(--af-home-primary)' : '#d9d5e5'}} />
              </button>
            ))}
          </div>
        </section>
      </section>

      {/* Desktop permanece com o layout completo existente. */}
      <div className="af-home-desktop-compact hidden md:block space-y-2">
      {/* HOME 2026 — layout inspirado no mockup, conectado aos dados reais. */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3" aria-label="Resumo financeiro">
        <div className="af-dash-card col-span-2 sm:col-span-1">
          <div className="flex justify-between items-center gap-2"><span className="text-xs font-medium text-slate-500">Saldo atual</span><button type="button" onClick={alternar} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'} className="text-slate-600">{ocultar ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-2 break-words">{carregando ? 'Carregando...' : saldoConfigurado ? exibirMoeda(saldoDisponivelAgora, ocultar) : 'Não configurado'}</p>
          {!somenteLeitura && <button type="button" onClick={() => setModalSaldo(true)} className="text-xs text-marca mt-2 inline-flex items-center gap-1"><Pencil size={12}/> Editar saldo</button>}
        </div>
        <div className="af-dash-card">
          <div className="flex justify-between items-center gap-2"><span className="text-xs font-medium text-slate-500">Receitas do mês</span><span className="af-dash-icon bg-emerald-50 text-emerald-600"><TrendingUp size={18}/></span></div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-2 break-words">{carregando ? '...' : exibirMoeda(receitaMes, ocultar)}</p>
          <button type="button" onClick={() => navigate('/receitas')} className="text-xs text-slate-500 mt-2 text-left">Ver receitas <ArrowRight size={12} className="inline"/></button>
        </div>
        <div className="af-dash-card">
          <div className="flex justify-between items-center gap-2"><span className="text-xs font-medium text-slate-500">Despesas do mês</span><span className="af-dash-icon bg-rose-50 text-rose-600"><TrendingDown size={18}/></span></div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 mt-2 break-words">{carregando ? '...' : exibirMoeda(compromissosMes, ocultar)}</p>
          <button type="button" onClick={() => navigate('/despesas')} className="text-xs text-slate-500 mt-2 text-left">Inclui compromissos previstos <ArrowRight size={12} className="inline"/></button>
        </div>
        <div className="af-dash-card col-span-2 sm:col-span-1 xl:col-span-1">
          <div className="flex justify-between items-center gap-2"><span className="text-xs font-medium text-slate-500">Limite diário</span><button type="button" onClick={() => setModalPlanejamento(true)} className="text-marca"><ArrowRight size={17}/></button></div>
          <div className="flex justify-between items-center gap-2 mt-2"><div className="min-w-0"><p className="text-lg sm:text-2xl font-bold text-slate-900 break-words">{carregando ? '...' : exibirMoeda(Math.max(0, limiteHoje), ocultar)}</p><p className="text-xs text-slate-500 mt-1">Disponível hoje: {exibirMoeda(Math.max(0, disponivelHoje), ocultar)}</p></div><div className="af-dash-ring" style={{background: `conic-gradient(${gastosDeHoje > limiteHoje ? '#ef4444' : '#10b981'} ${limiteHoje > 0 ? Math.min(100, Math.max(0, gastosDeHoje / limiteHoje * 100)) : 0}%, #e2e8f0 0)`}}><span>{limiteHoje > 0 ? `${Math.round(Math.min(100, gastosDeHoje / limiteHoje * 100))}%` : '—'}</span></div></div>
        </div>
      </section>

      {/* Calendário é o conteúdo principal; no desktop recebe coluna ampla. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 lg:gap-4 items-start">
        <section className="xl:col-span-2 af-dash-card !p-3 sm:!p-5 min-w-0" aria-label="Calendário financeiro">
          <div className="flex flex-wrap items-center justify-end gap-2 mb-2">
            <span className="sr-only">Calendário financeiro</span>
            {!somenteLeitura && <button type="button" onClick={() => { setDataGastoCalendario(null); setModalGasto(true) }} className="af-dash-action"><Plus size={15}/> Adicionar gasto</button>}
          </div>
          {!carregando && !carregandoReceitasCalendario && !carregandoDespesasCalendario ? (
            <div className="af-home-calendar-theme">
            <CalendarioFinanceiroHome
              receitas={receitasCalendario}
              despesas={despesasCalendario}
              mesVisivel={mesCalendarioHome}
              onMudarMes={setMesCalendarioHome}
              horizonte={horizonteCalendario}
              onAdicionarMovimentacao={somenteLeitura ? undefined : adicionarPeloCalendario}
            />
            </div>
          ) : <div className="py-12 text-center text-sm text-slate-500">Carregando calendário...</div>}
          <button type="button" onClick={() => navigate('/projecao')} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-marca">Ver planejamento completo <ArrowRight size={14}/></button>
        </section>
        <aside className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-3 lg:gap-4 min-w-0">
          <section className="af-dash-card" aria-label="Meus cartões">
            <div className="flex justify-between items-center mb-3"><h2 className="text-sm font-bold text-slate-900">Meus cartões</h2><button type="button" onClick={() => navigate('/cartoes')} className="text-xs text-marca font-semibold">Ver todos</button></div>
            {cartoes.length ? <div className="space-y-2">{cartoes.slice(0, 2).map(c => <button key={c.id} type="button" onClick={() => navigate('/cartoes')} className="af-home-card-brand w-full rounded-xl text-white p-3 text-left flex items-center gap-3"><CreditCard size={22} className="text-sky-300 shrink-0"/><span className="min-w-0"><strong className="block text-sm truncate">{c.nome || 'Cartão'}</strong><span className="block text-xs text-slate-300 truncate">{c.banco || 'Consultar fatura e limite'}</span></span><ArrowRight size={15} className="ml-auto shrink-0"/></button>)}</div> : <p className="text-sm text-slate-500">Nenhum cartão cadastrado.</p>}
          </section>
          <section className="af-dash-card" aria-label="Metas e investimentos">
            <div className="flex justify-between items-center mb-3"><h2 className="text-sm font-bold text-slate-900">Metas financeiras</h2><button type="button" onClick={() => navigate('/metas')} className="text-xs text-marca font-semibold">Ver todas</button></div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3"><span className="af-dash-icon bg-emerald-100 text-emerald-700"><PiggyBank size={18}/></span><span className="min-w-0 flex-1"><span className="block text-xs text-slate-500">Reserva de emergência</span><strong className="block text-sm text-slate-900 break-words">{exibirMoeda(reservaAtual, ocultar)}</strong>{metaReserva > 0 && <span className="block text-xs text-slate-500">Meta: {exibirMoeda(metaReserva, ocultar)}</span>}</span></div>
            {metaReserva > 0 && <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width: `${Math.min(100, reservaAtual / metaReserva * 100)}%`}}/></div>}
            <button type="button" onClick={() => navigate('/investimentos')} className="mt-3 flex w-full items-center justify-between text-xs text-slate-600"><span>Investimentos cadastrados: {investimentos.length}</span><strong className="text-slate-900">{exibirMoeda(patrimonioTotal || 0, ocultar)}</strong></button>
          </section>
          <section className="af-dash-card" aria-label="Benefícios">
            <div className="flex justify-between items-center"><h2 className="text-sm font-bold text-slate-900">VR / VA</h2><button type="button" onClick={() => navigate('/beneficios')} className="text-xs text-marca font-semibold">Ver benefícios</button></div>
            <div className="grid grid-cols-2 gap-2 mt-3">{['VR','VA'].map(tipo => { const b = beneficioPorTipo(tipo); return <div key={tipo} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{tipo}</p><p className="text-sm font-bold text-slate-900 break-words mt-1">{b ? exibirMoeda(saldoDoBeneficio(b.id), ocultar) : '—'}</p></div> })}</div>
          </section>
        </aside>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        <section className="af-dash-card min-w-0" aria-label="Despesas e compromissos">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="min-w-0 text-sm font-bold text-slate-900">Despesas e compromissos</h2>
            <button type="button" onClick={() => navigate('/despesas')} className="shrink-0 text-xs text-marca font-semibold hover:underline">Ver detalhes</button>
          </div>
          <div className="rounded-xl bg-rose-50/60 px-4 py-3 min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <TrendingDown size={16} className="shrink-0 text-rose-500" /> Compromissos previstos do mês
            </p>
            <p className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 tabular-nums break-words">
              {exibirMoeda(compromissosMes, ocultar)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Total consolidado pela projeção financeira</p>
          </div>
        </section>
        <EvolucaoFinanceiraHome projecao={projecao} ocultar={ocultar} />
      </div>
      {!somenteLeitura && <button type="button" onClick={() => {setDataGastoCalendario(null);setModalGasto(true)}} className="af-dash-action w-full justify-center sm:hidden"><Plus size={16}/> Adicionar lançamento</button>}

      </div>

      {/* Modal: Calendário financeiro (preservado, mas não aberto pelo card da Home). Reutiliza o MESMO componente e os mesmos dados —
          nenhum cálculo novo, nada removido. */}
      <Modal aberto={modalCalendario} onFechar={() => setModalCalendario(false)} titulo="Calendário financeiro">
        {!carregando && (
          <CalendarioFinanceiroHome
            receitas={receitasCalendario}
            despesas={despesasCalendario}
            mesVisivel={mesCalendarioHome}
            onMudarMes={setMesCalendarioHome}
            horizonte={horizonteCalendario}
            onAdicionarMovimentacao={somenteLeitura ? undefined : adicionarPeloCalendario}
          />
        )}
      </Modal>

      {/* Modal: planejamento completo "Quanto posso gastar?" — todos os detalhes
          (modos, reserva, renda/compromissos/disponível, ajuste diário, meta,
          progresso e previsão) ficam aqui, fora da visão principal da Home.
          Reutiliza o MESMO componente/cálculos — nada foi removido. */}
      {/* Amplia somente a janela Planejamento, sem alterar outros modais do app. */}
      <style>{`
        @media (min-width: 640px) {
          .max-w-md:has(.planejamento-modal-conteudo),
          .max-w-lg:has(.planejamento-modal-conteudo),
          .max-w-xl:has(.planejamento-modal-conteudo),
          .max-w-sm:has(.planejamento-modal-conteudo),
          .max-w-2xl:has(.planejamento-modal-conteudo) {
            width: min(760px, calc(100vw - 32px)) !important;
            max-width: min(760px, calc(100vw - 32px)) !important;
          }
        }
        @media (max-width: 639px) {
          .planejamento-modal-conteudo { padding: 14px; }
        }
      `}</style>
      <Modal aberto={modalPlanejamento} onFechar={() => setModalPlanejamento(false)} titulo="Planejamento completo" tamanho="lg">
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
          saldoSeguroHoje={saldoSeguroHoje}
          saldoAtual={saldoDisponivelAgora}
          dataProximaReceita={dataProximaReceita}
        />
      </Modal>

      {/* Alertas derivados dos dados reais do app. Nada é inventado no painel. */}
      <Modal aberto={modalNotificacoes} onFechar={() => setModalNotificacoes(false)} titulo="Notificações">
        {(() => {
          const itens = []
          if (horizonteResumo?.dataNegativa) itens.push({
            id: 'saldo', tipo: 'risco', titulo: 'Risco de saldo negativo',
            texto: `Seu saldo pode ficar negativo em ${fmtDiaMes(horizonteResumo.dataNegativa)}.`,
            data: horizonteResumo.dataNegativa,
            valor: horizonteResumo.saldoNaDataNegativa,
          })
          if (mostrarComecePorAqui) itens.push({
            id: 'config', tipo: 'configuracao', titulo: 'Conclua sua configuração inicial',
            texto: 'Existem informações pendentes para completar seu planejamento.',
          })
          const exibidos = itens.filter(i => filtroNotificacoes === 'todas' || i.tipo === filtroNotificacoes)
          const filtros = [
            { id: 'todas', titulo: 'Todas' },
            { id: 'risco', titulo: 'Risco' },
            { id: 'configuracao', titulo: 'Configuração' },
          ]
          return (
            <div className="space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar notificações">
                {filtros.map(f => (
                  <button key={f.id} type="button" onClick={() => setFiltroNotificacoes(f.id)}
                    aria-pressed={filtroNotificacoes === f.id}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${filtroNotificacoes === f.id ? 'bg-marca text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {f.titulo} ({f.id === 'todas' ? itens.length : itens.filter(i => i.tipo === f.id).length})
                  </button>
                ))}
              </div>
              {exibidos.length === 0 ? (
                <div className="text-center py-6">
                  <Bell size={26} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Nenhuma notificação nesta categoria.</p>
                </div>
              ) : exibidos.map(n => {
                const aberta = Boolean(notificacoesExpandidas[n.id])
                const lida = Boolean(notificacoesLidas[n.id])
                const risco = n.tipo === 'risco'
                return (
                  <div key={n.id} className={`rounded-2xl border p-3 sm:p-4 ${risco && !lida ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'}`}>
                    <button type="button" onClick={() => setNotificacoesExpandidas(prev => ({...prev, [n.id]: !prev[n.id]}))}
                      aria-expanded={aberta} className="w-full flex items-start gap-3 text-left">
                      <span className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${lida ? 'bg-gray-300' : risco ? 'bg-red-500' : 'bg-amber-400'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-gray-900">{n.titulo}</span>
                        <span className="block text-xs text-gray-600 mt-1">{n.texto}</span>
                      </span>
                      <ChevronDown size={18} className={`text-gray-500 flex-shrink-0 transition-transform ${aberta ? 'rotate-180' : ''}`} />
                    </button>
                    {aberta && (
                      <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                        {risco && (
                          <>
                            {Number.isFinite(Number(n.valor)) && (
                              <div className="rounded-xl bg-white px-3 py-3">
                                <p className="text-xs text-gray-500">Saldo projetado em {fmtDiaMes(n.data)}</p>
                                <p className="font-bold text-lg text-red-600">{formatCurrency(n.valor)}</p>
                              </div>
                            )}
                            <p className="text-xs text-gray-600">Confira as receitas, despesas e faturas previstas no Horizonte financeiro. O alerta é uma projeção, não uma cobrança.</p>
                            <button type="button" className="w-full sm:w-auto btn-primary px-4 py-2 text-sm inline-flex items-center justify-center gap-2"
                              onClick={() => { setModalNotificacoes(false); setModalProjecao(true) }}>
                              Ver no Horizonte financeiro <ArrowRight size={15} />
                            </button>
                          </>
                        )}
                        {!risco && <button type="button" className="text-marca text-sm font-semibold"
                          onClick={() => { setModalNotificacoes(false); navigate('/configuracoes') }}>
                          Ir para Configurações <ArrowRight size={14} className="inline" />
                        </button>}
                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                          <input type="checkbox" checked={lida}
                            onChange={e => setNotificacoesLidas(prev => ({...prev, [n.id]: e.target.checked}))} />
                          Marcar como lida
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="text-[11px] text-gray-400">Os alertas são calculados a partir de seus dados financeiros disponíveis. Marcar como lida não elimina o risco nem altera lançamentos.</p>
            </div>
          )
        })()}
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
dataReferencia={hojeISO}
        />
      </Modal>

      {/* Gasto rápido exclusivo de VR/VA: não registra despesa bancária */}
      <Modal aberto={!!gastoRapidoBeneficio}
        onFechar={() => { if (!salvandoGastoBeneficio) setGastoRapidoBeneficio(null) }}
        titulo={gastoRapidoBeneficio ? `Gasto rápido — ${gastoRapidoBeneficio.tipo}` : 'Gasto rápido VR/VA'}>
        {gastoRapidoBeneficio && (
          <FormGastoRapidoBeneficioHome key={gastoRapidoBeneficio.id}
            beneficio={gastoRapidoBeneficio}
            saldo={saldoDoBeneficio(gastoRapidoBeneficio.id)}
            onSalvar={salvarGastoBeneficio}
            onCancelar={() => setGastoRapidoBeneficio(null)}
            salvando={salvandoGastoBeneficio} erro={erroGastoBeneficio} />
        )}
      </Modal>

      {/* Modal de Gasto rápido */}
      <Modal aberto={modalGasto} onFechar={() => setModalGasto(false)} titulo="Gasto rápido">
        <FormGastoRapido
          key={dataGastoCalendario || "gasto-rapido"}
          dataInicial={dataGastoCalendario}
          onSalvar={handleSalvarGasto}
          beneficios={beneficios}
          onCancelar={() => setModalGasto(false)}
          carregando={salvandoGasto}
          onMaisOpcoes={handleMaisOpcoes}
          erro={erroGasto}
        />
      </Modal>

      {/* Antecipar pagamento a partir do card "Próximos 7 dias" (mesmo modal
          compartilhado usado na página Despesas). */}
      <ModalAnteciparPagamento
        aberto={!!despesaAntecipar}
        despesa={despesaAntecipar}
        onConfirmar={handleConfirmarAntecipacaoHome}
        onFechar={() => setDespesaAntecipar(null)}
        salvando={antecipandoHome}
      />

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