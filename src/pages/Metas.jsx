import React, { useState } from 'react'
import { Target, Plus, Calendar, TrendingUp, Trash2, Loader2, Pencil } from 'lucide-react'
import { useMetas } from '../hooks/useMetas'
import Modal from '../components/Modal'
import { formatCurrency, formatDate } from '../lib/utils'

const CORES_PRESET = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#be185d']

function ProgressRing({ value, max, color, size = 80 }) {
  const pct = Math.min(100, (value / max) * 100)
  const r = (size / 2) - 8
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  )
}

function calcularMesesRestantes(prazo) {
  if (!prazo) return 0
  const hoje = new Date()
  const fim = new Date(prazo)
  return Math.max(0, (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth()))
}

function FormMeta({ meta, onSalvar, onCancelar, carregando }) {
  const [form, setForm] = useState({
    nome: meta?.nome || '',
    valor_desejado: meta?.valor_desejado || '',
    valor_atual: meta?.valor_atual || '0',
    prazo: meta?.prazo || '',
    cor: meta?.cor || '#2563eb',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      nome: form.nome,
      valor_desejado: parseFloat(form.valor_desejado),
      valor_atual: parseFloat(form.valor_atual) || 0,
      prazo: form.prazo || null,
      cor: form.cor,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome da meta</label>
        <input name="nome" value={form.nome} onChange={handleChange}
          className="input" placeholder="Ex: Reserva de emergência, Viagem..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor desejado (R$)</label>
          <input name="valor_desejado" value={form.valor_desejado} onChange={handleChange}
            type="number" min="0.01" step="0.01" className="input" placeholder="0,00" required />
        </div>
        <div>
          <label className="label">Já tenho (R$)</label>
          <input name="valor_atual" value={form.valor_atual} onChange={handleChange}
            type="number" min="0" step="0.01" className="input" placeholder="0,00" />
        </div>
      </div>
      <div>
        <label className="label">Prazo <span className="text-gray-400">(opcional)</span></label>
        <input name="prazo" value={form.prazo} onChange={handleChange} type="date" className="input" />
      </div>
      <div>
        <label className="label">Cor</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {CORES_PRESET.map(cor => (
            <button key={cor} type="button" onClick={() => setForm(p => ({ ...p, cor }))}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${form.cor === cor ? 'border-gray-800 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: cor }} />
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar meta'}
        </button>
      </div>
    </form>
  )
}

function FormAporte({ meta, onSalvar, onCancelar, carregando }) {
  const [valor, setValor] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const novoValor = Math.min(
      Number(meta.valor_desejado),
      Number(meta.valor_atual) + parseFloat(valor)
    )
    onSalvar({ valor_atual: novoValor })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        Atualize o valor acumulado em <strong>{meta.nome}</strong>.
        Atual: <strong>{formatCurrency(meta.valor_atual)}</strong>
      </p>
      <div>
        <label className="label">Valor do aporte (R$)</label>
        <input value={valor} onChange={e => setValor(e.target.value)}
          type="number" min="0.01" step="0.01" className="input" placeholder="0,00" required />
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Registrar aporte'}
        </button>
      </div>
    </form>
  )
}

export default function Metas() {
  const { metas, carregando, criar, atualizar, remover } = useMetas()
  const [modal, setModal] = useState(null) // null | 'nova' | { tipo: 'aporte'|'editar', meta }
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  const totalDesejado = metas.reduce((acc, m) => acc + Number(m.valor_desejado), 0)
  const totalAcumulado = metas.reduce((acc, m) => acc + Number(m.valor_atual), 0)

  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      if (modal === 'nova') {
        await criar(dados)
      } else if (modal?.tipo === 'editar') {
        await atualizar(modal.meta.id, dados)
      } else if (modal?.tipo === 'aporte') {
        await atualizar(modal.meta.id, dados)
      }
      setModal(null)
    } catch {
      setErroAcao('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta meta?')) return
    setRemovendo(id)
    try {
      await remover(id)
    } catch {
      setErroAcao('Erro ao remover. Tente novamente.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metas financeiras</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe seu progresso rumo aos seus objetivos</p>
        </div>
        <button onClick={() => setModal('nova')} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Nova meta
        </button>
      </div>

      {metas.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Total acumulado</p>
            <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAcumulado)}</p>
            <p className="text-xs text-gray-400 mt-1">em {metas.length} meta{metas.length > 1 ? 's' : ''}</p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500 mb-1">Total planejado</p>
            <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalDesejado)}</p>
            <p className="text-xs text-gray-400 mt-1">
              {totalDesejado > 0 ? Math.round((totalAcumulado / totalDesejado) * 100) : 0}% concluído
            </p>
          </div>
        </div>
      )}

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}

      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : metas.length === 0 ? (
        <div className="card text-center py-12">
          <Target size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhuma meta cadastrada ainda.</p>
          <button onClick={() => setModal('nova')} className="mt-3 text-sm text-blue-600 hover:underline">
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {metas.map(meta => {
            const pct = meta.valor_desejado > 0
              ? Math.min(100, Math.round((Number(meta.valor_atual) / Number(meta.valor_desejado)) * 100))
              : 0
            const mesesRestantes = calcularMesesRestantes(meta.prazo)
            const valorFaltante = Number(meta.valor_desejado) - Number(meta.valor_atual)
            const aporteMensal = mesesRestantes > 0 ? valorFaltante / mesesRestantes : null
            const concluida = pct >= 100

            return (
              <div key={meta.id} className="card group">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <ProgressRing value={Number(meta.valor_atual)} max={Number(meta.valor_desejado)} color={meta.cor} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold text-gray-700">{pct}%</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{meta.nome}</p>
                        {meta.prazo && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-400">
                            <Calendar size={11} />
                            <span>Prazo: {formatDate(meta.prazo)}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="text-right mr-1">
                          <p className="text-xs text-gray-400">Meta</p>
                          <p className="text-sm font-bold text-gray-800">{formatCurrency(meta.valor_desejado)}</p>
                        </div>
                        <button onClick={() => setModal({ tipo: 'editar', meta })}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleRemover(meta.id)} disabled={removendo === meta.id}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                          {removendo === meta.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{formatCurrency(meta.valor_atual)} acumulado</span>
                        <span className="text-gray-400">faltam {formatCurrency(Math.max(0, valorFaltante))}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: meta.cor }} />
                      </div>
                    </div>

                    {!concluida && (
                      <div className="mt-3 flex items-center justify-between gap-2">
                        {aporteMensal !== null && (
                          <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2 flex-1">
                            <TrendingUp size={13} style={{ color: meta.cor }} />
                            <p className="text-xs text-gray-600">
                              Guardar <strong>{formatCurrency(aporteMensal)}/mês</strong> para atingir em {mesesRestantes} meses
                            </p>
                          </div>
                        )}
                        <button onClick={() => setModal({ tipo: 'aporte', meta })}
                          className="flex-shrink-0 text-xs font-medium px-3 py-2 rounded-lg border border-gray-200 hover:border-blue-300 hover:text-blue-600 transition-colors">
                          + Aporte
                        </button>
                      </div>
                    )}

                    {concluida && (
                      <div className="mt-3 flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2">
                        <span className="text-green-600">🎉</span>
                        <p className="text-xs text-green-700 font-medium">Meta atingida!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal aberto={modal === 'nova'} onFechar={() => setModal(null)} titulo="Nova meta">
        <FormMeta onSalvar={handleSalvar} onCancelar={() => setModal(null)} carregando={salvando} />
      </Modal>
      <Modal aberto={modal?.tipo === 'editar'} onFechar={() => setModal(null)} titulo="Editar meta">
        {modal?.tipo === 'editar' && (
          <FormMeta meta={modal.meta} onSalvar={handleSalvar} onCancelar={() => setModal(null)} carregando={salvando} />
        )}
      </Modal>
      <Modal aberto={modal?.tipo === 'aporte'} onFechar={() => setModal(null)} titulo="Registrar aporte">
        {modal?.tipo === 'aporte' && (
          <FormAporte meta={modal.meta} onSalvar={handleSalvar} onCancelar={() => setModal(null)} carregando={salvando} />
        )}
      </Modal>
    </div>
  )
}
