import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp, Plus, RefreshCw, Calendar, Trash2, Loader2, Pencil, ChevronLeft, ChevronRight } from 'lucide-react'
import { useReceitas } from '../hooks/useReceitas'
import { useCategorias } from '../hooks/useCategorias'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate, corCategoria } from '../lib/utils'

const mesAtual = new Date().getMonth() + 1
const anoAtual = new Date().getFullYear()

function FormReceita({ onSalvar, onCancelar, carregando, receitaInicial, textoBotao, dataPadrao }) {
  const { categorias } = useCategorias('receita')
  const [form, setForm] = useState({
    descricao: receitaInicial?.descricao ?? '',
    valor: receitaInicial != null ? String(receitaInicial.valor) : '',
    data: receitaInicial?.data ?? dataPadrao ?? new Date().toISOString().split('T')[0],
    // padrão: recorrente (a maioria das receitas é mensal); na edição usa o valor salvo
    recorrente: receitaInicial != null ? !!receitaInicial.recorrente : true,
    categoria: receitaInicial?.categoria ?? '',
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      ...form,
      valor: Number(form.valor) || 0,
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
          <InputMoeda valor={form.valor}
            onChangeValor={(n) => setForm(prev => ({ ...prev, valor: n }))}
            className="input" />
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
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (textoBotao || 'Salvar receita')}
        </button>
      </div>
    </form>
  )
}

export default function Receitas() {
  // Mês/ano navegáveis: permite ver receitas cadastradas para meses futuros
  // (ou passados) sem alterar nenhum dado — apenas o período consultado.
  const [ref, setRef] = useState({ mes: mesAtual, ano: anoAtual })
  const { receitas, recorrentes, total, carregando, erro, criar, atualizar, remover } = useReceitas(ref.mes, ref.ano)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const [receitaEditando, setReceitaEditando] = useState(null) // null = modo criação

  const nomeMes = new Date(ref.ano, ref.mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const ehMesCorrente = ref.mes === mesAtual && ref.ano === anoAtual

  // Navega entre meses (−1 / +1), ajustando a virada de ano.
  function navegarMes(delta) {
    setRef(prev => {
      const total = (prev.ano * 12 + (prev.mes - 1)) + delta
      return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
    })
  }
  // Data padrão de nova receita = dia 1 do mês em visualização.
  const dataPadraoNova = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`

  // ─── Receitas recorrentes projetadas ───
  // Uma receita recorrente mensal (recorrente = true) deve aparecer no mês de
  // início E em todos os meses seguintes. Como existe só UMA linha no banco
  // (com a data do mês de início), projetamos aqui — sem gravar nada — as
  // recorrentes iniciadas em meses ANTERIORES ao visualizado. As do próprio mês
  // (incluindo recorrentes que começam neste mês) já vêm em `receitas`.
  const inicioMesVis = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`
  const projetadas = recorrentes
    // começou antes do mês visualizado (data < 1º dia do mês visualizado)
    .filter(r => r.data < inicioMesVis)
    // evita duplicar: se por algum motivo já estiver na lista do mês, ignora
    .filter(r => !receitas.some(x => x.id === r.id))
    .map(r => {
      // Projeta a data para o mês visualizado, mantendo o dia (limitado ao
      // último dia do mês). Sem new Date() sobre r.data para evitar timezone:
      // extrai o dia por fatiamento da string 'YYYY-MM-DD'.
      const diaOriginal = parseInt(r.data.slice(8, 10), 10) || 1
      const ultimoDia = new Date(ref.ano, ref.mes, 0).getDate()
      const dia = Math.min(diaOriginal, ultimoDia)
      const dataProjetada = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
      // Marca como projeção para a UI (ex.: desabilitar remover de item virtual).
      return { ...r, data: dataProjetada, _projetada: true }
    })

  // Lista exibida = receitas reais do mês + recorrentes projetadas de meses
  // anteriores. Ordena por data desc (mesmo critério da query).
  const receitasExibidas = [...receitas, ...projetadas]
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))
  // Total do mês visualizado considerando as recorrentes projetadas.
  const totalExibido = receitasExibidas.reduce((acc, r) => acc + Number(r.valor), 0)

  // Atalho do botão "+" (menu inferior mobile): ?novo=1 abre o modal já existente.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setReceitaEditando(null)
      setModalAberto(true)
      searchParams.delete('novo')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Abre o modal em modo criação
  function handleAbrirNova() {
    setReceitaEditando(null)
    setModalAberto(true)
  }

  // Abre o modal em modo edição, preenchido com a receita
  function handleEditar(receita) {
    setReceitaEditando(receita)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setReceitaEditando(null)
  }

  // Salva: cria uma nova OU atualiza a existente (sem duplicar)
  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      if (receitaEditando) {
        await atualizar(receitaEditando.id, dados)
      } else {
        await criar(dados)
      }
      fecharModal()
    } catch (err) {
      setErroAcao(receitaEditando
        ? 'Erro ao salvar alterações. Tente novamente.'
        : 'Erro ao salvar receita. Tente novamente.')
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
          {/* Navegação de mês: permite ver receitas de meses futuros/passados */}
          <div className="flex items-center gap-2 mt-1">
            <button onClick={() => navegarMes(-1)} aria-label="Mês anterior"
              className="touch-target -ml-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <ChevronLeft size={18} />
            </button>
            <p className="text-sm text-gray-500 capitalize min-w-[8rem] text-center">{nomeMes}</p>
            <button onClick={() => navegarMes(1)} aria-label="Próximo mês"
              className="touch-target rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100">
              <ChevronRight size={18} />
            </button>
            {!ehMesCorrente && (
              <button onClick={() => setRef({ mes: mesAtual, ano: anoAtual })}
                className="text-xs font-medium text-blue-600 hover:underline ml-1">
                Hoje
              </button>
            )}
          </div>
        </div>
        <button onClick={handleAbrirNova} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
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
            <p className="text-3xl font-bold text-green-800">{formatCurrency(totalExibido)}</p>
          </div>
        </div>
      </div>

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}

      {/* Lista */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Receitas cadastradas
          <span className="ml-2 text-sm font-normal text-gray-400">({receitasExibidas.length})</span>
        </h2>

        {carregando ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : receitasExibidas.length === 0 ? (
          <div className="text-center py-12">
            <TrendingUp size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhuma receita cadastrada este mês.</p>
            <button onClick={handleAbrirNova} className="mt-3 text-sm text-blue-600 hover:underline">
              Cadastrar primeira receita
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {receitasExibidas.map(r => (
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
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  {r.categoria && (
                    <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(r.categoria)}`}>
                      {r.categoria}
                    </span>
                  )}
                  <span className="text-sm font-bold text-green-600 whitespace-nowrap">+{formatCurrency(r.valor)}</span>
                  {/* Ações. Itens PROJETADOS (recorrência de meses anteriores)
                      não têm ações aqui: editar/remover deve ser feito no mês de
                      origem para afetar toda a recorrência de forma consistente. */}
                  {r._projetada ? (
                    <span className="text-xs text-gray-400 italic whitespace-nowrap pl-1">
                      recorrente
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEditar(r)}
                        title="Editar receita"
                        aria-label="Editar receita"
                        className="touch-target rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleRemover(r.id)}
                        disabled={removendo === r.id}
                        aria-label="Remover receita"
                        className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all"
                      >
                        {removendo === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        aberto={modalAberto}
        onFechar={fecharModal}
        titulo={receitaEditando ? 'Editar receita' : 'Nova receita'}
      >
        <FormReceita
          key={receitaEditando ? receitaEditando.id : 'nova'}
          onSalvar={handleSalvar}
          onCancelar={fecharModal}
          carregando={salvando}
          receitaInicial={receitaEditando}
          dataPadrao={dataPadraoNova}
          textoBotao={receitaEditando ? 'Salvar alterações' : 'Salvar receita'}
        />
      </Modal>
    </div>
  )
}
