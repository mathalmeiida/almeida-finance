import React, { useState, useEffect } from 'react'
import {
  UtensilsCrossed, ShoppingBag, Plus, Pencil, Trash2, Loader2, ArrowLeft,
  ArrowDownCircle, ArrowUpCircle, RotateCcw, SlidersHorizontal,
} from 'lucide-react'
import { useBeneficios } from '../hooks/useBeneficios'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import { formatCurrency, exibirMoeda, hojeISO, formatDate } from '../lib/utils'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'

// Rótulos dos tipos de movimentação (visual).
const TIPO_MOV = {
  compra:  { label: 'Compra',  icon: ArrowDownCircle, cor: 'text-red-500' },
  recarga: { label: 'Recarga', icon: ArrowUpCircle,   cor: 'text-green-600' },
  estorno: { label: 'Estorno', icon: RotateCcw,       cor: 'text-green-600' },
  ajuste:  { label: 'Ajuste',  icon: SlidersHorizontal, cor: 'text-gray-500' },
}

// ─── Formulário de benefício (cadastrar/editar) ───
function FormBeneficio({ inicial, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    nome: inicial?.nome ?? '',
    tipo: inicial?.tipo ?? 'VR',
    saldo_inicial: inicial ? '' : '',          // só no cadastro inicial
    recarga_valor: inicial?.recarga_valor != null ? String(inicial.recarga_valor) : '',
    recarga_dia: inicial?.recarga_dia ?? '',
    recarga_recorrente: inicial?.recarga_recorrente ?? false,
  })
  const ehEdicao = !!inicial

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const dados = {
      nome: form.nome.trim(),
      tipo: form.tipo,
      recarga_valor: Number(form.recarga_valor) || 0,
      recarga_dia: form.recarga_dia ? Math.min(31, Math.max(1, Number(form.recarga_dia))) : null,
      recarga_recorrente: !!form.recarga_recorrente,
    }
    if (!ehEdicao) dados.saldo_inicial = Number(form.saldo_inicial) || 0
    onSalvar(dados)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome do cartão ou operadora</label>
        <input className="input" value={form.nome}
          onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
          placeholder="Ex.: Alelo, VR Benefícios" autoFocus />
      </div>
      <div>
        <label className="label">Tipo</label>
        <div className="grid grid-cols-2 gap-2">
          {[{ v: 'VR', t: 'Vale-Refeição' }, { v: 'VA', t: 'Vale-Alimentação' }].map(op => (
            <button key={op.v} type="button"
              onClick={() => setForm(p => ({ ...p, tipo: op.v }))}
              className={`rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                form.tipo === op.v ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {op.t}
            </button>
          ))}
        </div>
      </div>
      {!ehEdicao && (
        <div>
          <label className="label">Saldo inicial</label>
          <InputMoeda valor={form.saldo_inicial} onChangeValor={n => setForm(p => ({ ...p, saldo_inicial: n }))} className="input" />
        </div>
      )}
      <div>
        <label className="label">Valor da recarga mensal <span className="text-gray-400">(opcional)</span></label>
        <InputMoeda valor={form.recarga_valor} onChangeValor={n => setForm(p => ({ ...p, recarga_valor: n }))} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dia da recarga</label>
          <input type="number" min="1" max="31" className="input" value={form.recarga_dia}
            onChange={e => setForm(p => ({ ...p, recarga_dia: e.target.value }))} placeholder="Ex.: 5" />
        </div>
        <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
          <input type="checkbox" checked={form.recarga_recorrente}
            onChange={e => setForm(p => ({ ...p, recarga_recorrente: e.target.checked }))}
            className="w-4 h-4 accent-current text-marca" />
          <span className="text-sm text-gray-700">Recarga automática</span>
        </label>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (ehEdicao ? 'Salvar' : 'Adicionar')}
        </button>
      </div>
    </form>
  )
}

// ─── Formulário de movimentação ───
function FormMovimentacao({ inicial, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    tipo: inicial?.tipo ?? 'compra',
    valor: inicial ? String(inicial.valor) : '',
    descricao: inicial?.descricao ?? '',
    data: inicial?.data ?? hojeISO(),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const valorNum = Number(form.valor) || 0
    if (valorNum <= 0) return
    onSalvar({ tipo: form.tipo, valor: valorNum, descricao: form.descricao.trim() || null, data: form.data })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Tipo de movimentação</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(TIPO_MOV).map(([v, info]) => (
            <button key={v} type="button"
              onClick={() => setForm(p => ({ ...p, tipo: v }))}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-sm font-medium transition-colors ${
                form.tipo === v ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              <info.icon size={15} /> {info.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Valor</label>
        <InputMoeda valor={form.valor} onChangeValor={n => setForm(p => ({ ...p, valor: n }))}
          className="input text-xl font-bold text-center py-3" prefixo={null} autoFocus />
      </div>
      <div>
        <label className="label">Descrição <span className="text-gray-400">(opcional)</span></label>
        <input className="input" value={form.descricao}
          onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex.: Mercado" />
      </div>
      <div>
        <label className="label">Data</label>
        <input type="date" className="input" value={form.data}
          onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
      </div>
      {form.tipo === 'ajuste' && (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          Ajuste SOMA ao saldo. Para reduzir o saldo manualmente, use "Compra" com a descrição "Ajuste".
        </p>
      )}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

// ─── Card de um benefício ───
function CardBeneficio({ b, saldo, recargaValor, proximaRecarga, totalMes, onMovimentar, onEditar, onRemover, onVerExtrato, somenteLeitura }) {
  const { ocultar } = useOcultarValores()
  const Icone = b.tipo === 'VR' ? UtensilsCrossed : ShoppingBag
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-10 h-10 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
            <Icone size={20} className="text-marca" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{b.nome}</p>
            <p className="text-xs text-gray-400">{b.tipo === 'VR' ? 'Vale-Refeição' : 'Vale-Alimentação'}</p>
          </div>
        </div>
        {!somenteLeitura && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onEditar} aria-label="Editar" className="touch-target rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={15} /></button>
            <button onClick={onRemover} aria-label="Remover" className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
          </div>
        )}
      </div>

      <div className="mt-3">
        <p className="text-xs text-gray-400">Saldo disponível</p>
        <p className={`text-2xl font-bold leading-tight break-words ${saldo < 0 ? 'text-red-600' : 'text-gray-900'}`}>
          {exibirMoeda(saldo, ocultar)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="bg-gray-50 rounded-xl px-2.5 py-2 min-w-0">
          <p className="text-[11px] text-gray-400">Recarga/mês</p>
          <p className="text-sm font-semibold text-gray-700 break-words">{exibirMoeda(recargaValor, ocultar)}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-2.5 py-2 min-w-0">
          <p className="text-[11px] text-gray-400">Próxima</p>
          <p className="text-sm font-semibold text-gray-700 break-words">{proximaRecarga || '—'}</p>
        </div>
        <div className="bg-gray-50 rounded-xl px-2.5 py-2 min-w-0">
          <p className="text-[11px] text-gray-400">Usado no mês</p>
          <p className="text-sm font-semibold text-red-500 break-words">{exibirMoeda(totalMes, ocultar)}</p>
        </div>
      </div>

      {!somenteLeitura && (
        <div className="flex gap-2 mt-3">
          <button onClick={onMovimentar} className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
            <Plus size={15} /> Movimentar
          </button>
          <button onClick={onVerExtrato} className="btn-secondary flex-1 text-sm py-2">Ver extrato</button>
        </div>
      )}
    </div>
  )
}

export default function Beneficios() {
  const { somenteLeitura } = useAuth()
  const { ocultar } = useOcultarValores()
  const {
    beneficios, carregando, erro,
    criarBeneficio, atualizarBeneficio, removerBeneficio,
    criarMovimentacao, removerMovimentacao, aplicarRecargasDoMes,
    saldoDoBeneficio, totalGastoNoMes, movsDeBeneficio, proximaRecarga,
  } = useBeneficios()

  const [modalBeneficio, setModalBeneficio] = useState(false)
  const [editando, setEditando] = useState(null)       // benefício em edição
  const [modalMov, setModalMov] = useState(null)        // benefício alvo da movimentação
  const [extratoDe, setExtratoDe] = useState(null)      // benefício do extrato
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  // Aplica recargas automáticas pendentes do mês ao abrir (idempotente).
  useEffect(() => {
    if (!carregando && beneficios.length > 0) aplicarRecargasDoMes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregando, beneficios.length])

  async function salvarBeneficio(dados) {
    setSalvando(true); setErroAcao('')
    try {
      if (editando) await atualizarBeneficio(editando.id, dados)
      else await criarBeneficio(dados)
      setModalBeneficio(false); setEditando(null)
    } catch (e) {
      setErroAcao(e.message || 'Erro ao salvar o benefício.')
    } finally { setSalvando(false) }
  }

  async function salvarMovimentacao(dados) {
    setSalvando(true); setErroAcao('')
    try {
      await criarMovimentacao({ beneficio_id: modalMov.id, ...dados })
      setModalMov(null)
    } catch (e) {
      setErroAcao(e.message || 'Erro ao registrar a movimentação.')
    } finally { setSalvando(false) }
  }

  async function excluirBeneficio(b) {
    if (!confirm(`Remover "${b.nome}" e todas as suas movimentações?`)) return
    try { await removerBeneficio(b.id) } catch (e) { setErroAcao(e.message || 'Erro ao remover.') }
  }

  async function excluirMov(id) {
    if (!confirm('Remover esta movimentação? O saldo será recalculado.')) return
    try { await removerMovimentacao(id) } catch (e) { setErroAcao(e.message || 'Erro ao remover a movimentação.') }
  }

  return (
    <div className="space-y-5 pb-mobilenav md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Benefícios</h1>
          <p className="text-sm text-gray-500 mt-1">Vale-Refeição e Vale-Alimentação, separados do seu saldo em conta.</p>
        </div>
        {!somenteLeitura && (
          <button onClick={() => { setEditando(null); setModalBeneficio(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 text-sm">
            <Plus size={16} /> Novo
          </button>
        )}
      </div>

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}
      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">Erro ao carregar: {erro}</p>}

      {carregando ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-marca" /></div>
      ) : beneficios.length === 0 ? (
        <div className="card text-center py-12">
          <UtensilsCrossed size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum benefício cadastrado ainda.</p>
          {!somenteLeitura && (
            <button onClick={() => { setEditando(null); setModalBeneficio(true) }}
              className="mt-3 text-sm text-marca font-medium hover:underline">+ Cadastrar VR ou VA</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {beneficios.map(b => (
            <CardBeneficio
              key={b.id}
              b={b}
              saldo={saldoDoBeneficio(b.id)}
              recargaValor={Number(b.recarga_valor) || 0}
              proximaRecarga={proximaRecarga(b)}
              totalMes={totalGastoNoMes(b.id)}
              somenteLeitura={somenteLeitura}
              onMovimentar={() => { setErroAcao(''); setModalMov(b) }}
              onEditar={() => { setEditando(b); setModalBeneficio(true) }}
              onRemover={() => excluirBeneficio(b)}
              onVerExtrato={() => setExtratoDe(b)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Os benefícios NÃO entram no seu saldo em conta, no limite diário nem no resultado do mês — são controlados aqui à parte.
      </p>

      {/* Modal: cadastrar/editar benefício */}
      <Modal aberto={modalBeneficio} onFechar={() => { setModalBeneficio(false); setEditando(null) }}
        titulo={editando ? 'Editar benefício' : 'Novo benefício'}>
        <FormBeneficio inicial={editando} onSalvar={salvarBeneficio}
          onCancelar={() => { setModalBeneficio(false); setEditando(null) }} salvando={salvando} />
      </Modal>

      {/* Modal: nova movimentação */}
      <Modal aberto={!!modalMov} onFechar={() => setModalMov(null)}
        titulo={modalMov ? `Movimentar — ${modalMov.nome}` : 'Movimentar'}>
        <FormMovimentacao onSalvar={salvarMovimentacao} onCancelar={() => setModalMov(null)} salvando={salvando} />
      </Modal>

      {/* Modal: extrato do benefício */}
      <Modal aberto={!!extratoDe} onFechar={() => setExtratoDe(null)}
        titulo={extratoDe ? `Extrato — ${extratoDe.nome}` : 'Extrato'}>
        {extratoDe && (() => {
          const movs = movsDeBeneficio(extratoDe.id)
          if (movs.length === 0) return <p className="text-sm text-gray-500">Nenhuma movimentação ainda.</p>
          return (
            <ul className="space-y-2">
              {movs.map(m => {
                const info = TIPO_MOV[m.tipo] || TIPO_MOV.ajuste
                const sinal = m.tipo === 'compra' ? '-' : '+'
                return (
                  <li key={m.id} className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <info.icon size={16} className={`${info.cor} flex-shrink-0`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.descricao || info.label}</p>
                        <p className="text-xs text-gray-400">{info.label} • {formatDate(m.data)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-semibold whitespace-nowrap ${m.tipo === 'compra' ? 'text-red-500' : 'text-green-600'}`}>
                        {sinal} {exibirMoeda(Number(m.valor) || 0, ocultar)}
                      </span>
                      {!somenteLeitura && (
                        <button onClick={() => excluirMov(m.id)} aria-label="Remover"
                          className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        })()}
      </Modal>
    </div>
  )
}
