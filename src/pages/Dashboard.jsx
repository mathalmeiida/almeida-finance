import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Sun, Plus, Pencil,
  CheckCircle2, Circle, Rocket, Eye, EyeOff, Check, CalendarClock, PiggyBank, AlertTriangle, MessageCircle, BarChart2,
  Receipt, ReceiptText, Target, Bell, Moon, UtensilsCrossed, ShoppingBag, Zap, Info, X, MoreHorizontal
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

function FormGastoRapido({ onSalvar, onCancelar, carregando, onMaisOpcoes, erro, beneficios = [] }) {
  const { categorias } = useCategorias('despesa')
  const { cartoes } = useCartoes()
  const [form, setForm] = useState({
    descricao: '', valor: '', categoria_id: '', subcategoria_id: '',
    data: hojeISOBrasil(), forma_pagamento: '', cartao_id: '', beneficio_id: '',
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
      {/* Valores principais */}
<div className="grid grid-cols-2 gap-3">
  <div className="bg-black/15 rounded-xl px-3 py-3">
    <p className="text-xs text-white/70">
      Disponível até a próxima receita
    </p>
    <p className="text-xl font-bold">
      {formatCurrency(disponivelMes)}
    </p>
  </div>

  <div className="bg-black/15 rounded-xl px-3 py-3">
    <p className="text-xs text-white/70">
      {ehManual ? 'Seu limite diário' : 'Você pode gastar por dia'}
    </p>
    <p className="text-xl font-bold">
      {formatCurrency(Math.max(0, limiteExibido))}
      <span className="text-xs font-normal text-white/70">/dia</span>
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
    <div className="af-money-card h-full bg-marca-grad-dark rounded-2xl p-3 sm:p-5 lg:shadow-lg lg:shadow-black/5 text-white">
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

      {/* Compacto: anel do % à esquerda + limite diário em destaque com Editar.
          Sem o "Resumo do mês" (movido para a aba Planejamento). No desktop
          (lg) cresce um pouco, mantendo a Home dentro de uma tela. */}
      <div className="hidden sm:grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.25fr)] sm:gap-x-4">
        {/* Anel do % utilizado */}
        <div className="order-2 shrink-0">
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
        <div className="order-3 min-w-0">
          <p className="text-xs sm:text-sm text-white/80 mb-0.5">Limite para gastar hoje</p>
          <div className="flex min-w-0 items-center gap-1.5 lg:gap-2">
            <p className="min-w-0 whitespace-nowrap text-[clamp(1.25rem,2.3vw,1.875rem)] font-bold leading-tight tracking-tight tabular-nums">
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
          <p className={`text-xs lg:text-sm mt-0.5 ${orcamentoNegativo && !semBaseFinanceira && !configIncompleta ? 'text-red-100 font-medium' : 'text-white/80'}`}>
            {semBaseFinanceira
              ? 'Cadastre sua renda para calcular seu limite diário'
              : configIncompleta
                ? 'Finalize sua configuração para ver um cálculo mais preciso.'
                : estadoOrcamento === 'negativo'
                  ? `Faltam ${exibirMoeda(Math.abs(disponivelReal), ocultar)} para equilibrar seu orçamento`
                  : estadoOrcamento === 'equilibrado'
                    ? 'Seu orçamento está equilibrado'
                    : estadoOrcamento === 'positivo'
                      ? `Você tem ${exibirMoeda(disponivelReal, ocultar)} disponíveis até a próxima receita`
                      : 'Sem comprometer seu planejamento'}
          </p>
        </div>
        {/* Saldo atual dentro do card azul */}
{mostrarSaldo && (
  <div className="order-1 col-span-2 flex min-w-0 flex-col items-start gap-1 border-b border-white/15 pb-3 sm:col-span-1 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
    <p className="text-xs font-semibold text-white/90 flex items-center gap-2"><Wallet size={17} /> Meu dinheiro</p>
    <p className="text-xs text-white/75 mt-1">
      Saldo atual
    </p>
    <p className="max-w-full text-2xl sm:text-[clamp(1.25rem,2.2vw,1.875rem)] font-extrabold text-white leading-tight tabular-nums break-words">
      {exibirMoeda(saldoAtual, ocultar)}
    </p>
    {onEditarSaldo && (
      <button
        type="button"
        onClick={onEditarSaldo}
        className="inline-flex items-center gap-1 text-xs text-white/90 hover:text-white"
      >
        <Pencil size={12} />
        Editar saldo
      </button>
    )}
  </div>
)}

{/* Status do orçamento (compacto, quando couber) */}
       {(statusDiario || status) && (
  <div className="af-daily-status order-4 col-span-2 hidden items-center gap-1.5 rounded-full bg-black/15 px-2.5 py-1 sm:col-span-3 xl:flex xl:w-fit">
    <span
      className={`w-2 h-2 rounded-full ${
        statusDiario?.cor === '🔴'
          ? 'bg-red-300'
          : statusDiario?.cor === '🟡'
          ? 'bg-amber-300'
          : 'bg-green-300'
      }`}
    />
    <span className="text-xs lg:text-sm font-medium text-white/90">
      {statusDiario?.texto || status?.texto}
    </span>
  </div>
)}
      </div>

      {/* Gasto de hoje × restante */}
      <div className="grid grid-cols-2 gap-2 lg:gap-3 mt-2.5 lg:mt-3">
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
  const [abaMovimentacoes, setAbaMovimentacoes] = useState('transacoes');
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
  const [modalCalendario, setModalCalendario] = useState(false) // calendário financeiro (abre pela linha "Calendário")
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

  // Fundo escuro do cabeçalho que ACOMPANHA a cor do tema. Hex estáticos (sem
  // classes Tailwind dinâmicas), com contraste alto para texto branco (WCAG AA).
  // Enquanto a preferência carrega (corTema indefinido), usa um grafite escuro
  // legível como fallback. Atualiza na hora ao trocar a cor (corTema muda).
  const HEADER_BG = {
    azul:  'linear-gradient(135deg, #0b1f3a 0%, #0a1626 100%)', // azul-marinho escuro
    rosa:  'linear-gradient(135deg, #4a1130 0%, #2c0a1d 100%)', // rosa-escuro
    verde: 'linear-gradient(135deg, #0b3a2a 0%, #07241a 100%)', // verde-escuro
    roxo:  'linear-gradient(135deg, #2e1246 0%, #1d0b2d 100%)', // roxo-escuro
    preto: 'linear-gradient(135deg, #1f2937 0%, #0b0f17 100%)', // grafite escuro
  }
  const headerBg = HEADER_BG[corTema] || HEADER_BG.preto

  return (
    // pb extra no MOBILE: garante que o último card ("Seu dia financeiro" com o
    // botão "Registrar gasto de hoje") role totalmente acima da barra inferior
    // fixa (que tem o botão "+" saliente). Zera no desktop (md:pb-0).
    <div className="af-desktop-fit flex flex-col gap-2 sm:gap-4 lg:gap-2 md:space-y-0 pb-mobilenav md:pb-0 af-mobile-polished">
      {/* Ajustes visuais apenas no desktop: compacta cards, calendário e atalhos.
          Sem overflow forçado: em monitores baixos o scroll permanece possível. */}
      <style>{`
        /* Ajustes exclusivamente mobile. Desktop preservado. */
        @media (max-width: 639px) {
          .af-mobile-polished { gap: 5px; padding-bottom: max(110px, calc(env(safe-area-inset-bottom) + 95px)); }
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

      {/* ── MEU DINHEIRO ── Saldo + "Quanto posso gastar hoje?" em destaque.
          Reutiliza o CardGastoHoje (clique abre detalhes/ações: editar saldo,
          limite e planejamento completo via os modais já existentes). */}
      <div className="af-top-cards">
        <div className="min-w-0">
          <CardGastoHoje
            carregando={carregando}
            limiteHoje={limiteHoje}
            saldoAtual={saldoDisponivelAgora}
            mostrarSaldo={saldoConfigurado}
            configIncompleta={mostrarComecePorAqui}
            onEditarSaldo={somenteLeitura ? undefined : () => setModalSaldo(true)}
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
        </div>
      </div>

      {/* ── ATALHOS RÁPIDOS ── 4 ícones circulares: Adicionar, Despesas,
          Simular, Mais. Reutilizam fluxos/rotas reais (gasto rápido via modal
          existente; rotas /despesas, /posso-comprar, /mais). */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Adicionar', Icon: Plus,         onClick: () => (somenteLeitura ? null : setModalGasto(true)), disabled: somenteLeitura },
          { label: 'Despesas',  Icon: TrendingDown, onClick: () => navigate('/despesas') },
          { label: 'Simular',   Icon: ShoppingCart, onClick: () => navigate('/posso-comprar') },
          { label: 'Mais',      Icon: MoreHorizontal, onClick: () => navigate('/mais') },
        ].map(({ label, Icon, onClick, disabled }) => (
          <button key={label} type="button" onClick={onClick} disabled={disabled}
            className="flex flex-col items-center gap-1.5 py-1 disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="w-12 h-12 rounded-full bg-marca-100 text-marca flex items-center justify-center">
              <Icon size={20} />
            </span>
            <span className="text-[11px] font-medium text-gray-700">{label}</span>
          </button>
        ))}
      </div>

      {/* ── MINHAS FINANÇAS ── linhas compactas clicáveis, em coluna única.
          Cartões/Investimentos/Benefícios navegam para as páginas reais;
          Calendário abre o modal (mesmo componente/dados, sem rota nova). */}
      <div className="card !p-2 divide-y divide-gray-100">
        {[
          { label: 'Cartões',       Icon: CreditCard,      onClick: () => navigate('/cartoes') },
          { label: 'Investimentos', Icon: PiggyBank,       onClick: () => navigate('/investimentos') },
          { label: 'Benefícios',    Icon: UtensilsCrossed, onClick: () => navigate('/beneficios') },
          { label: 'Calendário',    Icon: CalendarClock,   onClick: () => setModalCalendario(true) },
        ].map(({ label, Icon, onClick }) => (
          <button key={label} type="button" onClick={onClick}
            className="w-full flex items-center gap-3 px-2.5 py-3 hover:bg-gray-50 transition-colors text-left rounded-lg">
            <span className="w-9 h-9 rounded-lg bg-marca-100 text-marca flex items-center justify-center flex-shrink-0">
              <Icon size={18} />
            </span>
            <span className="flex-1 text-sm font-medium text-gray-900">{label}</span>
            <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* ── Meus Benefícios (VR/VA) — seção COMPACTA na Home ──
          Mostra o saldo de VR e VA separadamente, usando os dados REAIS do
          hook useBeneficios (saldoDoBeneficio/proximaRecarga) — sem cálculo
          paralelo e sem misturar com saldo bancário/cartões. Só aparece quando
          há pelo menos um benefício VR ou VA cadastrado (nada fictício).
          Respeita a privacidade (ocultar) e segue a cor do tema (.card/text-marca). */}
      {/* Home minimalista: patrimônio/benefícios detalhados, calendário inline,
          "Próximos 7 dias", "Movimentações recentes" e os atalhos de cards
          foram retirados da visão principal. Nada foi excluído: os dados e
          componentes seguem acessíveis pelas linhas "Minhas finanças" (ex.:
          Calendário abre o modal abaixo) e pelas páginas reais (Investimentos,
          Benefícios, Despesas) e pela página "Mais". */}

      {/* O "Horizonte Financeiro", o card de Consultoria e o "Resumo do mês"
          foram movidos para a aba Planejamento (/projecao), deixando a Home mais
          limpa. A consultoria continua acessível pelo atalho "Consultoria".
          O modal do Horizonte (abaixo) é mantido para o sininho de notificações. */}

      {/* Modal: Calendário financeiro (aberto pela linha "Calendário" em
          "Minhas finanças"). Reutiliza o MESMO componente e os mesmos dados —
          nenhum cálculo novo, nada removido. */}
      <Modal aberto={modalCalendario} onFechar={() => setModalCalendario(false)} titulo="Calendário financeiro">
        {!carregando && (
          <CalendarioFinanceiroHome
            receitas={receitas}
            despesas={despesas}
            mesVisivel={mesCalendarioHome}
            onMudarMes={setMesCalendarioHome}
            horizonte={horizonteCalendario}
          />
        )}
      </Modal>

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
          saldoSeguroHoje={saldoSeguroHoje}
          saldoAtual={saldoDisponivelAgora}
          dataProximaReceita={dataProximaReceita}
        />
      </Modal>

      {/* Modal: Central de notificações (aberta pelo sino). Lista pendências
          REAIS já derivadas (configuração incompleta e risco de saldo negativo),
          sem backend novo. O Horizonte NÃO é mais aberto pelo sino — fica no seu
          botão original (aba Planejamento). */}
      <Modal aberto={modalNotificacoes} onFechar={() => setModalNotificacoes(false)} titulo="Notificações">
        {(() => {
          const itens = []
          if (mostrarComecePorAqui) {
            itens.push({
              id: 'config',
              cor: 'bg-amber-400',
              titulo: 'Conclua a configuração inicial',
              texto: 'Faltam etapas para o app calcular tudo com precisão.',
            })
          }
          if (horizonteResumo?.dataNegativa) {
            itens.push({
              id: 'saldo',
              cor: 'bg-red-500',
              titulo: 'Risco de saldo negativo',
              texto: `Seu saldo pode ficar negativo em ${fmtDiaMes(horizonteResumo.dataNegativa)}.`,
            })
          }
          if (itens.length === 0) {
            return (
              <div className="text-center py-6">
                <Bell size={28} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Nenhuma notificação no momento.</p>
              </div>
            )
          }
          return (
            <ul className="space-y-2">
              {itens.map(n => (
                <li key={n.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${n.cor}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.texto}</p>
                    {n.id === 'saldo' && (
                      <button
                        onClick={() => { setModalNotificacoes(false); setModalProjecao(true) }}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-marca hover:opacity-80"
                      >
                        Ver no Horizonte financeiro <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
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