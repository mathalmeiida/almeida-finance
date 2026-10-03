import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { CreditCard, Plus, Calendar, CheckCircle2, Trash2, Loader2, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { useParcelamentos, calcularParcelas } from '../hooks/useParcelamentos'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate, corCategoria, FORMAS_PAGAMENTO, formaPagamentoLabel } from '../lib/utils'

// ─── Barra de progresso ───────────────────────────────────────────────────────
export function ProgressBar({ value, max }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  const cor = pct >= 75 ? '#22c55e' : pct >= 40 ? '#f97316' : '#fb923c'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: cor }}
      />
    </div>
  )
}

// ─── Formulário de cadastro ───────────────────────────────────────────────────
export function FormParcelamento({ onSalvar, onCancelar, carregando, parcelamentoInicial, textoBotao }) {
  const { categorias } = useCategorias('ambos')
  const { cartoes } = useCartoes()
  const [form, setForm] = useState({
    descricao: parcelamentoInicial?.descricao ?? '',
    valor_total: parcelamentoInicial != null ? String(parcelamentoInicial.valor_total) : '',
    numero_parcelas: parcelamentoInicial != null ? String(parcelamentoInicial.numero_parcelas) : '12',
    // "primeira_parcela" no banco é uma data (YYYY-MM-DD); o input month usa YYYY-MM
    primeira_parcela: parcelamentoInicial?.primeira_parcela
      ? parcelamentoInicial.primeira_parcela.slice(0, 7)
      : new Date().toISOString().split('T')[0].slice(0, 7),
    categoria_id: parcelamentoInicial?.categoria_id ?? '',
    forma_pagamento: parcelamentoInicial?.forma_pagamento ?? 'cartao_credito',
    cartao_id: parcelamentoInicial?.cartao_id ?? '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const { base: parcelaBase, ultima: parcelaUltima } =
    Number(form.valor_total) > 0 && form.numero_parcelas
      ? calcularParcelas(Number(form.valor_total), parseInt(form.numero_parcelas))
      : { base: 0, ultima: 0 }
  const temAjuste = parcelaBase > 0 && parcelaUltima !== parcelaBase

  const ehCartaoCredito = form.forma_pagamento === 'cartao_credito'

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      descricao: form.descricao,
      valor_total: Number(form.valor_total) || 0,
      numero_parcelas: parseInt(form.numero_parcelas),
      primeira_parcela: form.primeira_parcela + '-01',
      categoria_id: form.categoria_id || null,
      forma_pagamento: form.forma_pagamento || null,
      // Só vincula cartão quando a forma é cartão de crédito; caso contrário NULL
      cartao_id: ehCartaoCredito ? (form.cartao_id || null) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição da compra</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Notebook, Sofá, Curso..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor total (R$)</label>
          <InputMoeda valor={form.valor_total}
            onChangeValor={(n) => setForm(prev => ({ ...prev, valor_total: n }))}
            className="input" />
        </div>
        <div>
          <label className="label">Parcelas</label>
          <select name="numero_parcelas" value={form.numero_parcelas} onChange={handleChange} className="input">
            {[2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(n =>
              <option key={n} value={n}>{n}x</option>
            )}
          </select>
        </div>
      </div>
      {parcelaBase > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
          <p className="text-xs text-blue-700">
            Valor de cada parcela: <strong>{formatCurrency(parcelaBase)}/mês</strong>
          </p>
          {temAjuste && (
            <p className="text-xs text-blue-600 mt-0.5">
              Última parcela: <strong>{formatCurrency(parcelaUltima)}</strong> (ajuste de centavos)
            </p>
          )}
        </div>
      )}
      <div>
        <label className="label">Mês da 1ª parcela</label>
        <input name="primeira_parcela" value={form.primeira_parcela} onChange={handleChange}
          type="month" className="input" required />
      </div>
      <div>
        <label className="label">Categoria</label>
        <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input">
          <option value="">Sem categoria</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Forma de pagamento</label>
        <select name="forma_pagamento" value={form.forma_pagamento} onChange={handleChange} className="input">
          <option value="">Não informado</option>
          {FORMAS_PAGAMENTO.map(f => (
            <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
          ))}
        </select>
      </div>

      {/* Campo "Em qual cartão?" — só aparece ao escolher Cartão de crédito */}
      {ehCartaoCredito && (
        <div>
          <label className="label">Em qual cartão?</label>
          {cartoes.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-500">
              Você ainda não possui cartões cadastrados.
              <Link to="/cartoes" className="block mt-2 text-blue-600 font-medium hover:underline">
                + Cadastrar cartão
              </Link>
            </div>
          ) : (
            <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input">
              <option value="">Selecione o cartão</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (textoBotao || 'Salvar')}
        </button>
      </div>
    </form>
  )
}

// ─── Card de parcelamento ─────────────────────────────────────────────────────
export function CardParcelamento({ p, onQuitar, onRemover, onEditar, quitando, removendo, cartoes = [] }) {
  const pct = Math.round((p.parcelasPagas / p.numero_parcelas) * 100)
  // valorPagoReal vem do hook com arredondamento correto; fallback para o cálculo antigo
  const valorPago = p.valorPagoReal ?? (p.parcelasPagas * Number(p.valor_parcela))
  // valor da parcela a exibir (base com arredondamento correto; fallback ao valor do banco)
  const valorParcelaExibir = p.valorParcelaBase ?? Number(p.valor_parcela)
  const nomeCategoria = p.categorias?.nome

  // Se vinculado a um cartão cadastrado, mostra o nome real do cartão (💳 Nome • Banco);
  // caso contrário, mostra o rótulo genérico da forma de pagamento.
  const cartaoVinculado = p.cartao_id ? cartoes.find(c => c.id === p.cartao_id) : null
  const textoPagamento = cartaoVinculado
    ? `💳 ${cartaoVinculado.nome}${cartaoVinculado.banco ? ` • ${cartaoVinculado.banco}` : ''}`
    : (p.forma_pagamento ? formaPagamentoLabel(p.forma_pagamento) : '')

  return (
    <div className={`card group ${!p.ativo ? 'opacity-70' : ''}`}>
      {/* Cabeçalho do card */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
            {p.categorias?.icone
              ? <span className="text-lg">{p.categorias.icone}</span>
              : <CreditCard size={18} className="text-orange-600" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{p.descricao}</p>
            {textoPagamento && (
              <p className="text-xs text-gray-400 mt-0.5">{textoPagamento}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {nomeCategoria && (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${corCategoria(nomeCategoria)}`}>
                  {nomeCategoria}
                </span>
              )}
              {p.quitado_em && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={11} /> Quitado antecipadamente em {formatDate(p.quitado_em)}
                </span>
              )}
              {!p.ativo && !p.quitado_em && (
                <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={11} /> Concluído
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Valor parcela + ações */}
        <div className="flex items-start gap-1.5 flex-shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              {formatCurrency(valorParcelaExibir)}
              <span className="text-xs font-normal text-gray-400">/mês</span>
            </p>
            <p className="text-xs text-gray-400">{formatCurrency(p.valor_total)} total</p>
          </div>
          {onEditar && (
            <button
              onClick={() => onEditar(p)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
              title="Editar parcelamento"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            onClick={() => onRemover(p.id)}
            disabled={removendo === p.id}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all mt-0.5"
            title="Remover parcelamento"
          >
            {removendo === p.id
              ? <Loader2 size={14} className="animate-spin" />
              : <Trash2 size={14} />}
          </button>
        </div>
      </div>

      {/* Parcela atual / total em destaque */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
          Parcela {p.parcelaAtual}/{p.numero_parcelas}
        </span>
        <span className="text-xs text-gray-500">{pct}% pago</span>
      </div>

      {/* Barra de progresso */}
      <div className="mt-2">
        <ProgressBar value={p.parcelasPagas} max={p.numero_parcelas} />
      </div>

      {/* Grade de informações */}
      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-xs text-gray-400">Restam</p>
          <p className="text-sm font-semibold text-gray-700">
            {p.ativo ? `${p.parcelasRestantes}x` : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Pago</p>
          <p className="text-sm font-semibold text-green-600">{formatCurrency(valorPago)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">A pagar</p>
          <p className="text-sm font-semibold text-orange-600">
            {formatCurrency(p.valorRestante)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Término</p>
          <p className="text-sm font-semibold text-gray-600">{p.mesTermino}</p>
        </div>
      </div>

      {/* Data de início */}
      <div className="mt-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={11} /> Início: {formatDate(p.primeira_parcela)}
        </span>

        {/* Botão quitar antecipadamente — só para ativos não quitados */}
        {p.ativo && !p.quitado_em && (
          <button
            onClick={() => onQuitar(p.id)}
            disabled={quitando === p.id}
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            {quitando === p.id
              ? <><Loader2 size={12} className="animate-spin" /> Quitando...</>
              : <><CheckCircle2 size={13} /> Quitar antecipadamente</>}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Parcelamentos() {
  const { parcelamentos, totalMesAtual, carregando, criar, quitar, remover } = useParcelamentos()
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)

  const ativos = parcelamentos.filter(p => p.ativo)
  const concluidos = parcelamentos.filter(p => !p.ativo)

  const totalEmAberto = ativos.reduce((acc, p) => acc + p.valorRestante, 0)

  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      await criar(dados)
      setModalAberto(false)
    } catch {
      setErroAcao('Erro ao salvar parcelamento. Tente novamente.')
    } finally {
      setSalvando(false)
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

  async function handleRemover(id) {
    if (!confirm('Remover este parcelamento definitivamente?')) return
    setRemovendo(id)
    setErroAcao('')
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
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelamentos</h1>
          <p className="text-sm text-gray-500 mt-1">Compras parceladas em andamento</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Novo parcelamento
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Compromisso este mês</p>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalMesAtual)}</p>
          <p className="text-xs text-gray-400 mt-1">{ativos.length} ativo{ativos.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-1">Total ainda a pagar</p>
          <p className="text-2xl font-bold text-gray-800">{formatCurrency(totalEmAberto)}</p>
          <p className="text-xs text-gray-400 mt-1">Em parcelamentos ativos</p>
        </div>
      </div>

      {erroAcao && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>
      )}

      {/* Lista de ativos */}
      {carregando ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : ativos.length === 0 && concluidos.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum parcelamento cadastrado.</p>
          <button onClick={() => setModalAberto(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            Cadastrar primeiro parcelamento
          </button>
        </div>
      ) : (
        <>
          {ativos.length > 0 && (
            <div className="space-y-4">
              {ativos.map(p => (
                <CardParcelamento
                  key={p.id}
                  p={p}
                  onQuitar={handleQuitar}
                  onRemover={handleRemover}
                  quitando={quitando}
                  removendo={removendo}
                />
              ))}
            </div>
          )}

          {ativos.length === 0 && (
            <div className="card text-center py-8">
              <CheckCircle2 size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum parcelamento ativo no momento.</p>
            </div>
          )}

          {/* Seção de concluídos/quitados — colapsável */}
          {concluidos.length > 0 && (
            <div>
              <button
                onClick={() => setMostrarConcluidos(v => !v)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
              >
                {mostrarConcluidos
                  ? <ChevronUp size={16} />
                  : <ChevronDown size={16} />}
                {mostrarConcluidos ? 'Ocultar' : 'Ver'} concluídos e quitados ({concluidos.length})
              </button>

              {mostrarConcluidos && (
                <div className="space-y-4 mt-4">
                  {concluidos.map(p => (
                    <CardParcelamento
                      key={p.id}
                      p={p}
                      onQuitar={handleQuitar}
                      onRemover={handleRemover}
                      quitando={quitando}
                      removendo={removendo}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal aberto={modalAberto} onFechar={() => setModalAberto(false)} titulo="Novo parcelamento">
        <FormParcelamento
          onSalvar={handleSalvar}
          onCancelar={() => setModalAberto(false)}
          carregando={salvando}
        />
      </Modal>
    </div>
  )
}
