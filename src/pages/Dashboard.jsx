import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Zap, Sun, Plus, Pencil,
  CheckCircle2, Circle, Rocket, Eye, EyeOff, Check, CalendarClock
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useComprasCartao } from '../hooks/useComprasCartao'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, exibirMoeda, FORMAS_PAGAMENTO } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import Modal from '../components/Modal'

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
      data: new Date().toISOString().split('T')[0],
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

// ─── Resumo da projeção em números (substitui o gráfico) ──────────────────────
function ResumoProjecao({ projecao }) {
  // Próximo mês = índice 1 (índice 0 é o mês atual). Fallback para o atual se só houver 1.
  const proximo = projecao[1] || projecao[0]
  // "Disponível" agora considera a reserva de emergência: Receita − Compromissos − Reserva.
  const dispProx = proximo?.disponivel ?? 0
  const dispPositivo = dispProx >= 0

  return (
    <div className="space-y-5">
      {/* Resumo do próximo mês */}
      <div className={`rounded-2xl p-4 border ${dispPositivo ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
        <p className="text-xs font-medium text-gray-500 mb-3">
          Resumo de <span className="capitalize font-semibold text-gray-700">{proximo?.mes}</span> (próximo mês)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-400">Receitas previstas</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(proximo?.receitas ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Compromissos previstos</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(proximo?.despesas ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Reserva planejada</p>
            <p className="text-sm font-bold text-amber-600">{formatCurrency(proximo?.reserva ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Disponível para gastar</p>
            <p className={`text-sm font-bold ${dispPositivo ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(dispProx)}
            </p>
          </div>
        </div>
        <p className={`text-sm font-semibold ${dispPositivo ? 'text-blue-700' : 'text-red-700'}`}>
          {dispPositivo
            ? `Você terá ${formatCurrency(dispProx)} livres após a reserva`
            : `Você ficará ${formatCurrency(Math.abs(dispProx))} no negativo após a reserva`}
        </p>
      </div>

      {/* Projeção dos 12 meses — tabela no desktop, cards no mobile */}
      {/* Desktop (md+): tabela */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-100">
              <th className="pb-2 text-xs font-medium text-gray-500">Mês</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Receitas</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Compromissos</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Reserva</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Disponível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projecao.map((m, i) => {
              const positivo = m.disponivel >= 0
              return (
                <tr key={i} className={m.ehMesAtual ? 'bg-blue-50/40' : ''}>
                  <td className="py-2.5 text-gray-700">
                    <span className="capitalize">{m.mes}</span>
                    {m.ehMesAtual && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-green-600">{formatCurrency(m.receitas)}</td>
                  <td className="py-2.5 text-right text-red-500">{formatCurrency(m.despesas)}</td>
                  <td className="py-2.5 text-right text-amber-600">{formatCurrency(m.reserva)}</td>
                  <td className="py-2.5 text-right">
                    {positivo ? (
                      <span className="font-semibold text-blue-600">{formatCurrency(m.disponivel)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg">
                        ⚠️ {formatCurrency(m.disponivel)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile (<md): cada mês como card vertical, sem scroll horizontal */}
      <div className="md:hidden space-y-2.5">
        {projecao.map((m, i) => {
          const positivo = m.disponivel >= 0
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
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <div>
                  <p className="text-[11px] text-gray-400">Receitas</p>
                  <p className="text-sm font-semibold text-green-600">{formatCurrency(m.receitas)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Compromissos</p>
                  <p className="text-sm font-semibold text-red-500">{formatCurrency(m.despesas)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Reserva</p>
                  <p className="text-sm font-semibold text-amber-600">{formatCurrency(m.reserva)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400">Disponível</p>
                  <p className={`text-sm font-bold ${positivo ? 'text-blue-600' : 'text-red-600'}`}>
                    {positivo ? '' : '⚠️ '}{formatCurrency(m.disponivel)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

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
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white/90 mb-3">
          <Sun size={18} />
          <span className="text-sm font-medium">Quanto posso gastar?</span>
        </div>
        <div className="h-9 w-40 bg-black/20 rounded-lg animate-pulse" />
      </div>
    )
  }

  const dias = diasRestantesNoMes(hoje)
  const ehManual = modo === 'manual'

  // Reserva de emergência (só afeta o modo automático). Usa o estado local
  // otimista para refletir o clique imediatamente. Padrão 20%.
  const pct = pctLocal
  const reserva = receitaMes > 0 ? receitaMes * (pct / 100) : 0

  // Base do orçamento livre:
  //  - Se o usuário informou o saldo atual, parte do dinheiro REAL de hoje e
  //    das entradas/compromissos futuros do mês (previsaoFimMes já é
  //    saldoAgora + receitas futuras − compromissos futuros). A reserva fica
  //    separada e só é descontada no modo automático.
  //  - Se ainda NÃO informou o saldo, mantém o comportamento anterior
  //    (receita do mês − compromissos), para não quebrar quem não configurou.
  const baseLivre = saldoConfigurado ? previsaoFimMes : (receitaMes - compromissosMes)

  const disponivelAuto = baseLivre - reserva
  const disponivelManual = baseLivre
  const disponivelMes = ehManual ? disponivelManual : disponivelAuto

  const limiteAuto = disponivelAuto > 0 && dias > 0 ? disponivelAuto / dias : 0
  const limiteManualNum = Number(limiteManual) || 0
  const limiteExibido = ehManual ? limiteManualNum : limiteAuto

  const status = statusOrcamento(receitaMes, disponivelMes)
  const orcamentoNegativo = disponivelMes < 0
  const manualAcimaDoRecomendado = ehManual && limiteManualNum > limiteAuto && limiteAuto > 0

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
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Sun size={18} />
          <span className="text-sm font-medium text-white/90">Quanto posso gastar?</span>
        </div>
        {/* Alternador Automático | Manual */}
        <div className="flex bg-black/15 rounded-lg p-0.5 text-xs font-medium flex-shrink-0">
          <button
            onClick={() => onTrocarModo('auto')}
            className={`px-3 py-1.5 rounded-md transition-colors ${!ehManual ? 'bg-white/90 text-emerald-700' : 'text-white/80'}`}
          >
            Automático
          </button>
          <button
            onClick={() => onTrocarModo('manual')}
            className={`px-3 py-1.5 rounded-md transition-colors ${ehManual ? 'bg-white/90 text-emerald-700' : 'text-white/80'}`}
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
                  !personalizando && pct === op ? 'bg-white/90 text-emerald-700' : 'bg-black/20 text-white/80 hover:bg-black/30'
                }`}>
                {op}%
              </button>
            ))}
            <button type="button" onClick={() => setPersonalizando(v => !v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                personalizando || !OPCOES_RESERVA.includes(pct) ? 'bg-white/90 text-emerald-700' : 'bg-black/20 text-white/80 hover:bg-black/30'
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
              <button type="submit" className="bg-white/90 text-emerald-700 text-xs font-semibold px-3 rounded-md">OK</button>
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

      {/* Botão editar limite — só no modo manual */}
      {ehManual && (
        <button
          onClick={onEditarLimite}
          className="mt-3 flex items-center gap-1 text-xs font-medium text-white/90 bg-black/15 hover:bg-black/25 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          <Pencil size={12} /> {limiteManualNum > 0 ? 'Editar meu limite' : 'Definir meu limite'}
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
// NÃO recalcula regra nova: limiteHoje vem da mesma fonte do card detalhado.
function CardGastoHoje({
  carregando, limiteHoje, gastosHoje, disponivelHoje,
  jaFezCheckin, onRegistrarGasto, onNaoGasteiHoje,
}) {
  if (carregando) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5">
        <div className="h-4 w-48 bg-black/20 rounded animate-pulse" />
        <div className="h-10 w-40 bg-black/20 rounded-lg animate-pulse mt-3" />
      </div>
    )
  }

  // Status do DIA, com base no quanto já foi gasto frente ao limite diário.
  // 🟢 dentro | 🟡 perto do limite (>= 80%) | 🔴 ultrapassou.
  let status
  if (limiteHoje <= 0) {
    // Sem limite calculado (sem renda/saldo). Mantém neutro.
    status = null
  } else if (gastosHoje > limiteHoje) {
    status = {
      cor: '🔴',
      texto: `Você ultrapassou seu planejamento diário em ${formatCurrency(gastosHoje - limiteHoje)}.`,
    }
  } else if (gastosHoje >= limiteHoje * 0.8) {
    status = { cor: '🟡', texto: 'Você está próximo do seu limite de hoje.' }
  } else {
    status = { cor: '🟢', texto: 'Você está dentro do planejado hoje.' }
  }

  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white">
      <div className="flex items-center gap-2 text-white/90">
        <Sun size={18} />
        <span className="text-sm font-medium">Quanto posso gastar hoje?</span>
      </div>

      {/* Valor diário em grande destaque */}
      <p className="text-3xl sm:text-4xl font-bold mt-1 leading-tight break-words">
        {formatCurrency(Math.max(0, limiteHoje))}
      </p>
      <p className="text-xs text-white/80 mt-1">
        Esse é o valor estimado que você pode gastar hoje sem comprometer seu planejamento.
      </p>

      {/* Gastos de hoje × Disponível hoje */}
      <div className="grid grid-cols-2 gap-2.5 mt-3">
        <div className="bg-black/15 rounded-xl px-3 py-2">
          <p className="text-xs text-white/70">Gastos de hoje</p>
          <p className="text-lg font-bold break-words">{formatCurrency(gastosHoje)}</p>
        </div>
        <div className="bg-black/15 rounded-xl px-3 py-2">
          <p className="text-xs text-white/70">Disponível hoje</p>
          <p className={`text-lg font-bold break-words ${disponivelHoje < 0 ? 'text-red-200' : ''}`}>
            {formatCurrency(disponivelHoje)}
          </p>
        </div>
      </div>

      {/* Status do dia */}
      {status && (
        <div className="flex items-start gap-2 mt-2.5 bg-black/15 rounded-xl px-3 py-2">
          <span className="flex-shrink-0">{status.cor}</span>
          <span className="text-sm font-medium">{status.texto}</span>
        </div>
      )}

      {/* Ações: "Registrar gasto" é a AÇÃO PRINCIPAL (destaque: botão branco,
          maior, com sombra). "Não gastei hoje" fica como ação secundária
          (contorno discreto sobre o verde). */}
      <div className="flex flex-col sm:flex-row gap-2 mt-3">
        <button
          onClick={onRegistrarGasto}
          className="flex-[1.4] flex items-center justify-center gap-2 bg-emerald-700 text-white font-bold text-base px-4 py-3 rounded-xl shadow-md hover:bg-emerald-800 active:scale-[0.99] transition-all"
        >
          <Plus size={18} strokeWidth={2.5} className="text-white" /> Registrar gasto
        </button>
        <button
          onClick={onNaoGasteiHoje}
          disabled={jaFezCheckin}
          className={`flex-1 flex items-center justify-center gap-2 font-medium text-sm px-4 py-2.5 rounded-xl border transition-colors ${
            jaFezCheckin
              ? 'bg-black/10 text-white/70 border-transparent cursor-default'
              : 'bg-transparent text-white/90 border-white/40 hover:bg-black/15'
          }`}
        >
          <Check size={15} /> {jaFezCheckin ? 'Dia sem gastos registrado' : 'Não gastei hoje'}
        </button>
      </div>
    </div>
  )
}

// ─── Card "Próximos vencimentos" ──────────────────────────────────────────────
// Mostra APENAS despesas com data futura próxima (hoje+1 .. hoje+7) já
// carregadas do mês. Não inventa nada: se a lista estiver vazia, nem renderiza.
function CardProximosVencimentos({ itens }) {
  if (!itens || itens.length === 0) return null
  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
        <CalendarClock size={18} className="text-blue-600 flex-shrink-0" />
        Próximos vencimentos
      </h2>
      <ul className="mt-3 space-y-2">
        {itens.map(item => (
          <li key={item.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.descricao}</p>
              <p className="text-xs text-gray-500">{item.quando}</p>
            </div>
            <span className="text-sm font-semibold text-gray-900 flex-shrink-0 whitespace-nowrap">
              {formatCurrency(item.valor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Dashboard() {
  const { perfil, atualizarPreferenciasLimite } = useAuth()
  const { ocultar, alternar } = useOcultarValores()
  const {
    resumoMes, projecao, carregando, receitas, despesas, parcelamentos, criarDespesa,
  } = useProjecao()
  // Para gastos no cartão de crédito: grava em compras_cartao (entra na fatura,
  // não desconta do saldo à vista). Demais formas seguem em despesas.
  const { criar: criarCompraCartao } = useComprasCartao()
  const navigate = useNavigate()

  const [modalGasto, setModalGasto] = useState(false)
  const [salvandoGasto, setSalvandoGasto] = useState(false)
  const [erroGasto, setErroGasto] = useState('')
  const [confirmacaoGasto, setConfirmacaoGasto] = useState(null) // { msg, limite }
  const [modalLimite, setModalLimite] = useState(false)
  const [salvandoLimite, setSalvandoLimite] = useState(false)
  const [modalReservaAtual, setModalReservaAtual] = useState(false)
  const [salvandoReservaAtual, setSalvandoReservaAtual] = useState(false)
  const [modalSaldo, setModalSaldo] = useState(false)
  const [salvandoSaldo, setSalvandoSaldo] = useState(false)

  // Atalho do botão "+" (menu inferior mobile): ?novo=gasto|reserva abre o
  // modal JÁ existente desta página. Depois limpa o parâmetro da URL.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const novo = searchParams.get('novo')
    if (novo === 'gasto') { setModalGasto(true); searchParams.delete('novo'); setSearchParams(searchParams, { replace: true }) }
    else if (novo === 'reserva') { setModalReservaAtual(true); searchParams.delete('novo'); setSearchParams(searchParams, { replace: true }) }
  }, [searchParams, setSearchParams])

  const hoje = new Date()
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
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
  const temReserva = (Number(perfil?.reserva_atual) || 0) > 0 || (Number(perfil?.meta_reserva) || 0) > 0
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
  const hojeISO = hoje.toISOString().split('T')[0]
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
  // Gastos de HOJE: soma das despesas (à vista, não recorrentes) com data de hoje.
  // Usa os dados já em memória — mesmo padrão do saldo disponível.
  const gastosDeHoje = despesas
    .filter(d => d.data === hojeISO && !d.recorrente)
    .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)
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
  const proximosVencimentos = (() => {
    const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
    const limiteDias = 7
    return despesas
      .map(d => {
        if (!d.data) return null
        const dt = new Date(d.data + 'T12:00:00')
        const dataDia = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
        const diffDias = Math.round((dataDia - base) / 86400000)
        if (diffDias < 1 || diffDias > limiteDias) return null
        const quando = diffDias === 1
          ? 'Vence amanhã'
          : `Vence em ${diffDias} dias`
        return {
          id: d.id,
          descricao: d.descricao || 'Despesa',
          valor: Number(d.valor) || 0,
          quando,
          diffDias,
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.diffDias - b.diffDias)
      .slice(0, 5)
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
        setModalGasto(false)
        // O limite diário NÃO muda (compra no crédito não sai do saldo de hoje).
        const limite = calcularLimiteDiario({
          receitaMes, compromissosMes,
          reservaPct: reservaPercentual, modo: modoLimite, limiteManual, hoje,
          baseLivre: saldoConfigurado ? previsaoFimMes : undefined,
        })
        setConfirmacaoGasto({
          msg: `✓ Gasto de ${formatCurrency(valorGasto)} lançado na fatura do cartão`,
          limite: Math.max(0, limite),
        })
        return
      }

      // ── Demais formas (Pix, dinheiro, débito, boleto, etc.) ──
      // Fluxo atual: grava em despesas (à vista, hoje) e desconta do saldo.
      // Remove campos que não são colunas de "despesas".
      const { cartao_id, ...despesa } = dados
      await criarDespesa(despesa)   // atualiza o estado interno → indicadores recalculam
      setModalGasto(false)
      // Confirmação curta + limite diário restante (MESMA fórmula do card,
      // via calcularLimiteDiario). O gasto é à vista → entra em compromissos,
      // então somamos o valor para refletir o limite JÁ atualizado.
      const limite = calcularLimiteDiario({
        receitaMes,
        compromissosMes: compromissosMes + valorGasto,
        reservaPct: reservaPercentual,
        modo: modoLimite,
        limiteManual,
        hoje,
        // Com saldo configurado, o gasto de hoje reduz a base livre.
        baseLivre: saldoConfigurado ? (previsaoFimMes - valorGasto) : undefined,
      })
      setConfirmacaoGasto({
        msg: `✓ Gasto de ${formatCurrency(valorGasto)} registrado em ${categoriaNome}`,
        limite: Math.max(0, limite),
      })
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
    try {
      // Salvar um limite manual também fixa o modo em "manual"
      await atualizarPreferenciasLimite({ limite_diario: valor, modo_limite: 'manual' })
      setModalLimite(false)
    } catch {
      // mantém o modal aberto; erro silencioso para não quebrar o layout
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
        saldo_base_data: new Date().toISOString().split('T')[0],
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

  return (
    <div className="space-y-6">
      {/* 1 ─ Saudação (por horário de Brasília) */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{saudacao}</h1>
        <p className="text-sm text-gray-500 mt-1 capitalize">Resumo financeiro de {nomeMes}</p>
      </div>

      {erroGasto && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroGasto}</p>
      )}

      {/* Confirmação curta do gasto rápido + limite diário restante */}
      {confirmacaoGasto && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <p className="text-sm font-medium text-green-700">{confirmacaoGasto.msg}</p>
          <p className="text-xs text-green-600 mt-0.5">
            Você ainda pode gastar {formatCurrency(confirmacaoGasto.limite)} hoje.
          </p>
        </div>
      )}

      {/* 2 ─ DESTAQUE: Quanto posso gastar hoje? (foco principal da Home) */}
      <CardGastoHoje
        carregando={carregando}
        limiteHoje={limiteHoje}
        gastosHoje={gastosDeHoje}
        disponivelHoje={disponivelHoje}
        jaFezCheckin={jaFezCheckin}
        onRegistrarGasto={() => setModalGasto(true)}
        onNaoGasteiHoje={marcarNaoGasteiHoje}
      />

      {/* 3 ─ Vai fazer uma compra? (simulação existente) — fundo escuro
          sofisticado para posicionar o simulador como ferramenta SECUNDÁRIA,
          deixando o card verde "Quanto posso gastar hoje?" como destaque. */}
      <div className="bg-gray-100 border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShoppingCart size={20} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold">Vai fazer uma compra?</p>
            <p className="text-gray-400 text-sm">Antes de comprar, veja como esse gasto pode impactar seu planejamento.</p>
          </div>
        </div>
        <Link
          to="/posso-comprar"
          className="flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
        >
          Simular compra <ArrowRight size={16} className="text-white" />
        </Link>
      </div>

      {/* 4 ─ Resumo do mês: Receitas, Despesas, Saldo Atual (com olho), Reserva */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Resumo do mês</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          {/* Saldo Atual — com ícone de olho para ocultar/exibir */}
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-500 min-w-0 truncate">Saldo atual</span>
              <button
                onClick={alternar}
                aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
                className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600 hover:bg-blue-100"
              >
                {ocultar ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div>
              {carregando ? (
                <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold break-words text-gray-900">
                  {exibirMoeda(saldoConfigurado ? saldoDisponivelAgora : resumoMes.sobraPrevista, ocultar)}
                </p>
              )}
              {!carregando && (
                <p className="text-xs text-gray-400 mt-1">
                  {saldoConfigurado ? 'Dinheiro disponível agora' : 'Saldo após compromissos'}
                </p>
              )}
            </div>
          </div>
          <SummaryCard
            title="Reserva de emergência"
            value={reservaAtual}
            icon={Wallet}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            subtitle={carregando ? '' : (metaReserva > 0 ? `Meta: ${formatCurrency(metaReserva)}` : 'Sem meta definida')}
            carregando={carregando}
          />
        </div>
      </div>

      {/* 5 ─ Próximos vencimentos (só se houver despesas com vencimento próximo) */}
      {!carregando && <CardProximosVencimentos itens={proximosVencimentos} />}

      {/* Card: Saldo disponível agora + Previsão até o fim do mês.
          A reserva de emergência NÃO entra aqui (fica no card abaixo). */}
      {!carregando && (
        <div className="card">
          {saldoConfigurado ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-500">Saldo disponível agora</p>
                    {/* Olho: oculta/mostra os valores financeiros (só visual) */}
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
                  <p className="text-xs text-gray-400">Previsão até o fim do mês</p>
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

      {/* Card "Comece por aqui" — some automaticamente quando os 4 itens
          estiverem concluídos. Cada item leva ao fluxo JÁ existente. */}
      {mostrarComecePorAqui && (
        <CardComecePorAqui
          itens={onboardingItens}
          totalConcluidos={totalConcluidos}
          onIrPara={(item) => {
            if (item.chave === 'saldo') setModalSaldo(true)
            else if (item.chave === 'reserva') setModalReservaAtual(true)
            else navigate(item.to)
          }}
          onContinuar={() => {
            if (!primeiroPendente) return
            if (primeiroPendente.chave === 'saldo') setModalSaldo(true)
            else if (primeiroPendente.chave === 'reserva') setModalReservaAtual(true)
            else navigate(primeiroPendente.to)
          }}
        />
      )}

      {/* Card: Quanto posso gastar? (Automático | Manual) */}
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

      {/* Gráfico de projeção */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Projeção dos próximos 12 meses</h2>
            <p className="text-xs text-gray-400 mt-0.5">Receitas e despesas recorrentes, parcelas, faturas e reserva de emergência</p>
          </div>
          <Link
            to="/projecao"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver detalhes <ArrowRight size={14} />
          </Link>
        </div>

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
