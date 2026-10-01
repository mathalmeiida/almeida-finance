import React, { useState } from 'react'
import { TrendingUp, Plus, RefreshCw, Calendar, Trash2, Loader2 } from 'lucide-react'
import { useReceitas } from '../hooks/useReceitas'
import { useCategorias } from '../hooks/useCategorias'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, corCategoria } from '../lib/utils'

const mesAtual = new Date().getMonth() + 1
const anoAtual = new Date().getFullYear()

function FormReceita({ onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('receita')
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    recorrente: true,   // padrão: recorrente (a maioria das receitas é mensal)
    categoria: '',
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      ...form,
      valor: parseFloat(form.valor.replace(',', '.')),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Salário, Freelance..." required />
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
        <select name="categoria" value={form.categoria} onChange={handleChange} className="input">
          <option value="">Sem categoria</option>
          {categorias.map(c => <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}
        </select>
      </div>

      {/* Seletor de recorrência visível */}
      <div>
        <label className="label">Esta receita se repete todo mês?</label>
        <div className="flex gap-3 mt-1">
          <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            form.recorrente ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input type="radio" name="recorrente" checked={form.recorrente === true}
              onChange={() => setForm(p => ({ ...p, recorrente: true }))} className="hidden" />
            <span className="text-lg">🔁</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Sim, todo mês</p>
              <p className="text-xs text-gray-400">Ex: salário, aluguel recebido</p>
            </div>
          </label>
          <label className={`flex-1 flex items-center gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-all ${
            !form.recorrente ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
          }`}>
            <input type="radio" name="recorrente" checked={form.recorrente === false}
              onChange={() => setForm(p => ({ ...p, recorrente: false }))} className="hidden" />
            <span className="text-lg">1️⃣</span>
            <div>
              <p className="text-sm font-medium text-gray-900">Não, só este mês</p>
              <p className="text-xs text-gray-400">Ex: bônus, venda pontual</p>
            </div>
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-start gap-1">
          <span>ℹ️</span>
          <span>Receitas recorrentes aparecem na projeção dos próximos meses. Pontuais, apenas neste mês.</span>
        </p>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar receita'}
        </button>
      </div>
    </form>
  )
}

export default function Receitas() {
  const { receitas, total, carregando, erro, criar, remover } = useReceitas(mesAtual, anoAtual)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  const nomeMes = new Date(anoAtual, mesAtual - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      await criar(dados)
      setModalAberto(false)
    } catch (err) {
      setErroAcao('Erro ao salvar receita. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta receita?')) return
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
          <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{nomeMes}</p>
        </div>
        <button onClick={() => setModalAberto(true)} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Nova receita
        </button>
      </div>

      {/* Card total */}
      <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-green-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-green-700 font-medium">Total de receitas no mês</p>
            <p className="text-3xl font-bold text-green-800">{formatCurrency(total)}</p>
          </div>
        </div>
      </div>

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}

      {/* Lista */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Receitas cadastradas
          <span className="ml-2 text-sm font-normal text-gray-400">({receitas.length})</span>
        </h2>

        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : receitas.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhuma receita cadastrada este mês.</p>
            <button onClick={() => setModalAberto(true)} className="mt-3 text-sm text-blue-600 hover:underline">
              Cadastrar primeira receita
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {receitas.map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp size={16} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar size={11} />{formatDate(r.data)}
                      </span>
                      {r.recorrente && (
                        <span className="flex items-center gap-1 text-xs text-blue-500">
                          <RefreshCw size={10} />Recorrente
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.categoria && (
                    <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(r.categoria)}`}>
                      {r.categoria}
                    </span>
                  )}
                  <span className="text-sm font-bold text-green-600">+{formatCurrency(r.valor)}</span>
                  <button
                    onClick={() => handleRemover(r.id)}
                    disabled={removendo === r.id}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    {removendo === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Nova receita">
        <FormReceita onSalvar={handleSalvar} onCancelar={() => setModalAberto(false)} carregando={salvando} />
      </Modal>
    </div>
  )
}
