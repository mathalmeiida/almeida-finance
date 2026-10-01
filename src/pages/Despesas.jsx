import React, { useState, useEffect } from 'react'
import { TrendingDown, Plus, RefreshCw, Calendar, Trash2, Loader2, Pencil, CreditCard, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { useDespesas } from '../hooks/useDespesas'
import { useParcelamentos, valorParcelaNoMes } from '../hooks/useParcelamentos'
import { useCategorias } from '../hooks/useCategorias'
import { useProjecao } from '../hooks/useProjecao'
import Modal from '../components/Modal'
import { formatCurrency, formatDate, corCategoria } from '../lib/utils'
import { classificarDespesa, labelTipoDespesa } from '../lib/classificarDespesa'
import { FormParcelamento, CardParcelamento } from './Parcelamentos'

const mesAtual = new Date().getMonth() + 1
const anoAtual = new Date().getFullYear()

// ─── Formulário de despesa à vista ────────────────────────────────────────────
function FormDespesa({ onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('despesa')
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    recorrente: false,
    categoria_id: '',
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    const tipo_despesa = classificarDespesa({
      descricao: form.descricao,
      categoria: catSelecionada?.nome || '',
    })
    onSalvar({
      descricao: form.descricao,
      valor: parseFloat(form.valor.replace(',', '.')),
      data: form.data,
      recorrente: form.recorrente,
      categoria_id: form.categoria_id || null,
      tipo_despesa,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Aluguel, Supermercado, Netflix..." required />
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
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
          ))}
        </select>
      </div>

      <div className="bg-gray-50 rounded-xl p-3">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input type="checkbox" name="recorrente" checked={form.recorrente} onChange={handleChange}
            className="w-4 h-4 mt-0.5 rounded accent-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-800">Essa despesa se repete todo mês</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Marque se for uma despesa que acontece mensalmente (ex: aluguel, academia, mercado mensal).
              Despesas recorrentes aparecem na projeção dos próximos meses.
            </p>
          </div>
        </label>
      </div>

      <p className="text-xs text-gray-400 flex items-center gap-1">
        <span>✨</span>
        A classificação como <strong>Fixa</strong> ou <strong>Variável</strong> será feita automaticamente ao salvar.
      </p>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando
            ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            : 'Salvar despesa'}
        </button>
      </div>
    </form>
  )
}

// ─── Notificação de classificação automática ──────────────────────────────────
function NotificacaoClassificacao({ despesa, onAlterar, onFechar }) {
  const tipo = despesa?.tipo_despesa || 'variavel'
  const { label, icone, classes } = labelTipoDespesa(tipo)
  const tipoOposto = tipo === 'fixa' ? 'variavel' : 'fixa'
  const labelOposto = tipoOposto === 'fixa' ? 'Fixa' : 'Variável'

  useEffect(() => {
    const timer = setTimeout(onFechar, 6000)
    return () => clearTimeout(timer)
  }, [onFechar])

  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>{icone}</span>
        <span>
          Classificada automaticamente como:{' '}
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
            Despesa {label}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onAlterar(despesa.id, tipoOposto)}
          className="text-xs text-blue-600 hover:underline font-medium">
          Alterar para {labelOposto}
        </button>
        <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
    </div>
  )
}

// ─── Modal com escolha À vista / Parcelada ────────────────────────────────────
function ModalNovaDespesa({ aberto, onFechar, onSalvarVista, onSalvarParcelada, salvandoVista, salvandoParcelada }) {
  const [modo, setModo] = useState('avista')

  // Reseta para "à vista" sempre que reabre
  useEffect(() => {
    if (aberto) setModo('avista')
  }, [aberto])

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Nova despesa">
      {/* Seletor de tipo */}
      <div className="flex gap-3 mb-5">
        <button
          type="button"
          onClick={() => setModo('avista')}
          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
            modo === 'avista' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <TrendingDown size={16} /> À vista
        </button>
        <button
          type="button"
          onClick={() => setModo('parcelada')}
          className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
            modo === 'parcelada' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}
        >
          <CreditCard size={16} /> Parcelada
        </button>
      </div>

      {modo === 'avista' ? (
        <FormDespesa onSalvar={onSalvarVista} onCancelar={onFechar} carregando={salvandoVista} />
      ) : (
        <FormParcelamento onSalvar={onSalvarParcelada} onCancelar={onFechar} carregando={salvandoParcelada} />
      )}
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Despesas() {
  const { despesas, total, carregando, criar, remover, alterarTipo } = useDespesas(mesAtual, anoAtual)
  const {
    parcelamentos,
    totalMesAtual,
    carregando: carregandoParc,
    criar: criarParcelamento,
    quitar,
    remover: removerParcelamento,
  } = useParcelamentos()
  const { resumoMes } = useProjecao()

  const [filtro, setFiltro] = useState('Todas')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoParc, setSalvandoParc] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [removendoParc, setRemovendoParc] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const [ultimaDespesa, setUltimaDespesa] = useState(null)
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)

  const nomeMes = new Date(anoAtual, mesAtual - 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ─── Parcelas devidas no mês selecionado (sem duplicar o valor total da compra) ───
  // Cada parcelamento vira uma "linha de parcela" com o valor devido neste mês.
  const parcelasDoMes = parcelamentos
    .map(p => {
      const valor = valorParcelaNoMes(p, anoAtual, mesAtual)
      if (valor <= 0) return null
      return { parcelamento: p, valor, tipo_despesa: p.tipoDespesa }
    })
    .filter(Boolean)

  const totalParcelasMes = parcelasDoMes.reduce((a, x) => a + x.valor, 0)
  const totalParcelasFixasMes = parcelasDoMes
    .filter(x => x.tipo_despesa === 'fixa').reduce((a, x) => a + x.valor, 0)
  const totalParcelasVariaveisMes = parcelasDoMes
    .filter(x => x.tipo_despesa !== 'fixa').reduce((a, x) => a + x.valor, 0)

  // Totais por tipo — despesas à vista + parcela do mês
  const totalFixas =
    despesas.filter(d => d.tipo_despesa === 'fixa').reduce((a, d) => a + Number(d.valor), 0)
    + totalParcelasFixasMes
  const totalVariaveis =
    despesas.filter(d => d.tipo_despesa !== 'fixa').reduce((a, d) => a + Number(d.valor), 0)
    + totalParcelasVariaveisMes
  const totalGeral = totalFixas + totalVariaveis

  const receitaBase = resumoMes.receitaTotal || 0
  const pctFixas = receitaBase > 0 ? Math.round((totalFixas / receitaBase) * 100) : 0
  const pctVariaveis = receitaBase > 0 ? Math.round((totalVariaveis / receitaBase) * 100) : 0

  // Parcelamentos ativos / concluídos (para a aba Parceladas)
  const parcAtivos = parcelamentos.filter(p => p.ativo)
  const parcConcluidos = parcelamentos.filter(p => !p.ativo)

  // Filtros/abas
  const abas = ['Todas', 'Fixas', 'Variáveis', 'Parceladas']

  // Despesas (à vista) filtradas conforme a aba
  const despesasVisiveis = (() => {
    if (filtro === 'Fixas') return despesas.filter(d => d.tipo_despesa === 'fixa')
    if (filtro === 'Variáveis') return despesas.filter(d => d.tipo_despesa !== 'fixa')
    if (filtro === 'Parceladas') return [] // aba parceladas mostra os parcelamentos, não as despesas à vista
    return despesas // Todas
  })()

  // Parcelas do mês exibidas como linhas nas abas Todas/Fixas/Variáveis
  const parcelasVisiveis = (() => {
    if (filtro === 'Parceladas') return [] // na aba Parceladas usamos os cards completos
    if (filtro === 'Fixas') return parcelasDoMes.filter(x => x.tipo_despesa === 'fixa')
    if (filtro === 'Variáveis') return parcelasDoMes.filter(x => x.tipo_despesa !== 'fixa')
    return parcelasDoMes // Todas
  })()

  const mostrarParceladas = filtro === 'Parceladas'
  const totalLinhas = despesasVisiveis.length + parcelasVisiveis.length

  // ─── Handlers despesa à vista ───
  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      const nova = await criar(dados)
      setModalAberto(false)
      setUltimaDespesa(nova)
    } catch {
      setErroAcao('Erro ao salvar despesa. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta despesa?')) return
    setRemovendo(id)
    try {
      await remover(id)
      if (ultimaDespesa?.id === id) setUltimaDespesa(null)
    } catch {
      setErroAcao('Erro ao remover. Tente novamente.')
    } finally {
      setRemovendo(null)
    }
  }

  async function handleAlterarTipo(id, novoTipo) {
    try {
      await alterarTipo(id, novoTipo)
      if (ultimaDespesa?.id === id) {
        setUltimaDespesa(prev => ({ ...prev, tipo_despesa: novoTipo }))
      }
    } catch {
      setErroAcao('Erro ao alterar classificação.')
    }
  }

  // ─── Handlers parcelamento ───
  async function handleSalvarParcelado(dados) {
    setSalvandoParc(true)
    setErroAcao('')
    try {
      await criarParcelamento(dados)
      setModalAberto(false)
      setFiltro('Parceladas') // leva o usuário à aba onde o item aparece
    } catch {
      setErroAcao('Erro ao salvar parcelamento. Tente novamente.')
    } finally {
      setSalvandoParc(false)
    }
  }

  async function handleQuitar(id) {
    if (!confirm('Confirma a quitação antecipada? As parcelas futuras serão removidas da projeção.')) return
    setQuitando(id)
    setErroAcao('')
    try {
      await quitar(id)
    } catch {
      setErroAcao('Erro ao quitar parcelamento. Tente novamente.')
    } finally {
      setQuitando(null)
    }
  }

  async function handleRemoverParc(id) {
    if (!confirm('Remover este parcelamento definitivamente?')) return
    setRemovendoParc(id)
    setErroAcao('')
    try {
      await removerParcelamento(id)
    } catch {
      setErroAcao('Erro ao remover. Tente novamente.')
    } finally {
      setRemovendoParc(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{nomeMes}</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Nova despesa
        </button>
      </div>

      {/* Três cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-2">
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Total do mês</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalGeral)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {despesas.length} à vista
            {parcelasDoMes.length > 0 ? ` + ${parcelasDoMes.length} parcela${parcelasDoMes.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="card">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">📌</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Fixas</p>
          <p className="text-lg font-bold text-blue-700">{formatCurrency(totalFixas)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-blue-500 mt-0.5">{pctFixas}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
        <div className="card">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">🛒</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Variáveis</p>
          <p className="text-lg font-bold text-gray-700">{formatCurrency(totalVariaveis)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-gray-500 mt-0.5">{pctVariaveis}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
      </div>

      {/* Notificação de classificação automática */}
      {ultimaDespesa && (
        <NotificacaoClassificacao
          despesa={ultimaDespesa}
          onAlterar={handleAlterarTipo}
          onFechar={() => setUltimaDespesa(null)}
        />
      )}

      {erroAcao && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>
      )}

      {/* Abas de filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {abas.map(aba => {
          const qtd = aba === 'Parceladas' ? parcAtivos.length : null
          return (
            <button
              key={aba}
              onClick={() => setFiltro(aba)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filtro === aba
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {aba}{qtd !== null && qtd > 0 ? ` (${qtd})` : ''}
            </button>
          )
        })}
      </div>

      {/* ─── Lista de despesas à vista + parcelas do mês ─── */}
      {filtro !== 'Parceladas' && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {filtro === 'Todas' ? 'Despesas do mês' : `Despesas ${filtro.toLowerCase()}`}
            <span className="ml-2 text-sm font-normal text-gray-400">({totalLinhas})</span>
          </h2>

          {(carregando || carregandoParc) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : totalLinhas === 0 ? (
            <div className="text-center py-12">
              <TrendingDown size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhuma despesa nesta categoria.</p>
              <button onClick={() => setModalAberto(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                Cadastrar despesa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Linhas de parcela do mês */}
              {parcelasVisiveis.map(({ parcelamento: p, valor, tipo_despesa }) => {
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(tipo_despesa)
                const nomeCategoria = p.categorias?.nome
                return (
                  <div key={`parc-${p.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {p.categorias?.icone
                          ? <span className="text-base">{p.categorias.icone}</span>
                          : <CreditCard size={16} className="text-orange-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-orange-600">
                            <CreditCard size={11} />Parcela {p.parcelaAtual}/{p.numero_parcelas}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipoClasses}`}>
                            {tipoLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {nomeCategoria && (
                        <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(nomeCategoria)}`}>
                          {nomeCategoria}
                        </span>
                      )}
                      <span className="text-sm font-bold text-red-500 ml-1">-{formatCurrency(valor)}</span>
                    </div>
                  </div>
                )
              })}

              {/* Linhas de despesa à vista */}
              {despesasVisiveis.map(d => {
                const nomeCategoria = d.categorias?.nome
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(d.tipo_despesa)
                const tipoOposto = d.tipo_despesa === 'fixa' ? 'variavel' : 'fixa'
                const labelOposto = tipoOposto === 'fixa' ? 'Fixa' : 'Variável'
                return (
                  <div key={d.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {d.categorias?.icone
                          ? <span className="text-base">{d.categorias.icone}</span>
                          : <TrendingDown size={16} className="text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={11} />{formatDate(d.data)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipoClasses}`}>
                            {tipoLabel}
                          </span>
                          {d.recorrente && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <RefreshCw size={10} />Recorrente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {nomeCategoria && (
                        <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(nomeCategoria)}`}>
                          {nomeCategoria}
                        </span>
                      )}
                      <span className="text-sm font-bold text-red-500 ml-1">-{formatCurrency(d.valor)}</span>
                      <button onClick={() => handleAlterarTipo(d.id, tipoOposto)}
                        title={`Alterar para ${labelOposto}`}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleRemover(d.id)} disabled={removendo === d.id}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all">
                        {removendo === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Seção de parcelamentos ─── */}
      {mostrarParceladas && (
        <div className="space-y-4">
          {/* Resumo de parcelamentos */}
          {parcAtivos.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Parcelas este mês</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(totalMesAtual)}</p>
                <p className="text-xs text-gray-400 mt-1">{parcAtivos.length} ativo{parcAtivos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
                <p className="text-xl font-bold text-gray-800">
                  {formatCurrency(parcAtivos.reduce((a, p) => a + p.valorRestante, 0))}
                </p>
                <p className="text-xs text-gray-400 mt-1">Em parcelamentos ativos</p>
              </div>
            </div>
          )}

          {carregandoParc ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : parcAtivos.length === 0 && parcConcluidos.length === 0 ? (
            filtro === 'Parceladas' && (
              <div className="card text-center py-12">
                <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma compra parcelada cadastrada.</p>
                <button onClick={() => setModalAberto(true)} className="mt-3 text-sm text-blue-600 hover:underline">
                  Cadastrar parcelamento
                </button>
              </div>
            )
          ) : (
            <>
              {parcAtivos.length > 0 && (
                <>
                  {parcAtivos.map(p => (
                    <CardParcelamento key={p.id} p={p}
                      onQuitar={handleQuitar} onRemover={handleRemoverParc}
                      quitando={quitando} removendo={removendoParc} />
                  ))}
                </>
              )}

              {/* Concluídos/quitados — colapsável */}
              {parcConcluidos.length > 0 && (
                <div>
                  <button onClick={() => setMostrarConcluidos(v => !v)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                    {mostrarConcluidos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {mostrarConcluidos ? 'Ocultar' : 'Ver'} concluídos e quitados ({parcConcluidos.length})
                  </button>
                  {mostrarConcluidos && (
                    <div className="space-y-4 mt-4">
                      {parcConcluidos.map(p => (
                        <CardParcelamento key={p.id} p={p}
                          onQuitar={handleQuitar} onRemover={handleRemoverParc}
                          quitando={quitando} removendo={removendoParc} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal com escolha À vista / Parcelada */}
      <ModalNovaDespesa
        aberto={modalAberto}
        onFechar={() => setModalAberto(false)}
        onSalvarVista={handleSalvar}
        onSalvarParcelada={handleSalvarParcelado}
        salvandoVista={salvando}
        salvandoParcelada={salvandoParc}
      />
    </div>
  )
}
