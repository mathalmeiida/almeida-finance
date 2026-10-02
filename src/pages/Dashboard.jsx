import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Zap, Sun, Plus, Pencil
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useCategorias } from '../hooks/useCategorias'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import Modal from '../components/Modal'

// ─── Modal de Gasto rápido ────────────────────────────────────────────────────
function FormGastoRapido({ onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('despesa')
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria_id: '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    // Gasto rápido: à vista, não recorrente. Classificação automática (padrão variável).
    const tipo_despesa = classificarDespesa({
      descricao: form.descricao,
      categoria: catSelecionada?.nome || '',
    })
    onSalvar({
      descricao: form.descricao,
      valor: parseFloat(form.valor.replace(',', '.')),
      data: form.data,
      recorrente: false,
      categoria_id: form.categoria_id || null,
      tipo_despesa,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Café, Almoço, Uber..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor (R$)</label>
          <input name="valor" value={form.valor} onChange={handleChange}
            type="number" min="0.01" step="0.01" className="input" placeholder="0,00" required />
        </div>
        <div>
          <label className="label">Data</label>
          <input name="data" value={form.data} onChange={handleChange}
            type="date" className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Categoria</label>
        <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input">
          <option value="">Sem categoria</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Zap size={12} /> Registrado como despesa à vista no dia selecionado.
      </p>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando
            ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            : 'Salvar gasto'}
        </button>
      </div>
    </form>
  )
}

function SummaryCard({ title, value, icon: Icon, color, bgColor, subtitle, carregando }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <div>
        {carregando ? (
          <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
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
}) {
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

  // Disponível no modo automático = receita − reserva − compromissos
  const disponivelAuto = receitaMes - reserva - compromissosMes
  // No modo manual, a reserva não entra: disponível = receita − compromissos
  const disponivelManual = receitaMes - compromissosMes
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
    </div>
  )
}

// ─── Modal para editar o limite diário manual ─────────────────────────────────
function ModalLimiteDiario({ aberto, onFechar, valorAtual, onSalvar, salvando }) {
  const [valor, setValor] = useState('')

  useEffect(() => {
    if (aberto) setValor(valorAtual != null && Number(valorAtual) > 0 ? String(valorAtual) : '')
  }, [aberto, valorAtual])

  function handleSubmit(e) {
    e.preventDefault()
    const num = parseFloat(String(valor).replace(',', '.'))
    if (!num || num <= 0) return
    onSalvar(num)
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Meu limite diário">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Quanto você quer poder gastar por dia?</label>
          <input
            type="number" min="0.01" step="0.01"
            value={valor}
            onChange={e => setValor(e.target.value)}
            className="input"
            placeholder="Ex: 100,00"
            autoFocus
            required
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

export default function Dashboard() {
  const { perfil, atualizarPreferenciasLimite } = useAuth()
  const {
    resumoMes, projecao, carregando, receitas, despesas, criarDespesa,
  } = useProjecao()

  const [modalGasto, setModalGasto] = useState(false)
  const [salvandoGasto, setSalvandoGasto] = useState(false)
  const [erroGasto, setErroGasto] = useState('')
  const [modalLimite, setModalLimite] = useState(false)
  const [salvandoLimite, setSalvandoLimite] = useState(false)

  const sobraPositiva = resumoMes.sobraPrevista >= 0
  const hoje = new Date()
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const saudacao = perfil?.nome ? `Olá, ${perfil.nome.split(' ')[0]}` : 'Olá'

  // Aviso de projeção zerada: há dados mas nenhum é recorrente
  const temReceitas = receitas.length > 0
  const temReceitasRecorrentes = receitas.some(r => r.recorrente)
  const temDespesas = despesas.length > 0
  const temDespesasRecorrentes = despesas.some(d => d.recorrente)
  const mostrarAvisoProjecao = !carregando && (
    (temReceitas && !temReceitasRecorrentes) ||
    (temDespesas && !temDespesasRecorrentes)
  )

  // ─── "Quanto posso gastar?" ───
  // Compromissos do mês = despesas + parcelas + faturas de cartão, SEM duplicar.
  // resumoMes.sobraPrevista = receita − compromissos (já consolidado no useProjecao).
  // Então: compromissosMes = receita − sobraPrevista. A reserva é aplicada no card.
  const receitaMes = resumoMes.receitaTotal
  const compromissosMes = receitaMes - resumoMes.sobraPrevista
  const limiteManual = perfil?.limite_diario ?? null
  const modoLimite = perfil?.modo_limite === 'manual' ? 'manual' : 'auto' // padrão: automático
  const reservaPercentual = perfil?.reserva_percentual ?? 20 // padrão 20%
  const carregandoLimite = carregando

  // ─── Handler do Gasto rápido ───
  async function handleSalvarGasto(dados) {
    setSalvandoGasto(true)
    setErroGasto('')
    try {
      await criarDespesa(dados)   // atualiza o estado interno → indicadores recalculam
      setModalGasto(false)
    } catch {
      setErroGasto('Erro ao salvar o gasto. Tente novamente.')
    } finally {
      setSalvandoGasto(false)
    }
  }

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

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao} 👋</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">Resumo financeiro de {nomeMes}</p>
        </div>
        <button
          onClick={() => setModalGasto(true)}
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <Zap size={16} /> <span className="hidden sm:inline">Gasto rápido</span><span className="sm:hidden">Gasto</span>
        </button>
      </div>

      {erroGasto && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroGasto}</p>
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
        onTrocarReserva={handleTrocarReserva}
      />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receitas do mês"
          value={resumoMes.receitaTotal}
          icon={TrendingUp}
          color="text-green-600"
          bgColor="bg-green-50"
          subtitle={carregando ? '' : `${resumoMes.qtdReceitas} receita${resumoMes.qtdReceitas !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Despesas do mês"
          value={resumoMes.despesaTotal}
          icon={TrendingDown}
          color="text-red-500"
          bgColor="bg-red-50"
          subtitle={carregando ? '' : `${resumoMes.qtdDespesas} despesa${resumoMes.qtdDespesas !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Parcelas do mês"
          value={resumoMes.parcelasTotalExibicao}
          icon={CreditCard}
          color="text-orange-500"
          bgColor="bg-orange-50"
          subtitle={carregando ? '' : `${resumoMes.qtdParcelasExibicao} ativo${resumoMes.qtdParcelasExibicao !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Saldo após compromissos"
          value={resumoMes.sobraPrevista}
          icon={Wallet}
          color={sobraPositiva ? 'text-blue-600' : 'text-red-600'}
          bgColor={sobraPositiva ? 'bg-blue-50' : 'bg-red-50'}
          subtitle={carregando ? '' : 'Antes da reserva de emergência'}
          carregando={carregando}
        />
      </div>

      {/* Banner "Posso Comprar?" */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">Vai fazer uma compra?</p>
            <p className="text-blue-200 text-sm">Simule o impacto no seu orçamento antes de decidir.</p>
          </div>
        </div>
        <Link
          to="/posso-comprar"
          className="flex items-center gap-2 bg-white text-blue-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          Simular agora <ArrowRight size={16} />
        </Link>
      </div>

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
    </div>
  )
}
