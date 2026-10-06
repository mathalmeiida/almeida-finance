import React, { useState } from 'react'
import {
  CreditCard, Plus, Pencil, Trash2, Loader2, ArrowLeft, Calendar, Receipt
} from 'lucide-react'
import { useCartoes } from '../hooks/useCartoes'
import { useComprasCartao } from '../hooks/useComprasCartao'
import { useCategorias } from '../hooks/useCategorias'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate, labelMes } from '../lib/utils'
import { calcularParcelas, useParcelamentos } from '../hooks/useParcelamentos'
import {
  valorFaturaCartaoNoMes, limiteComprometido, linhasFaturaCompleta,
} from '../lib/faturaCartao'

const hoje = new Date()
const mesAtual = hoje.getMonth() + 1
const anoAtual = hoje.getFullYear()

// ─── Barra de uso do limite ───────────────────────────────────────────────────
function BarraLimite({ usado, total, cor = '#6366f1' }) {
  const pct = total > 0 ? Math.min(100, Math.round((usado / total) * 100)) : 0
  const corBarra = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : cor
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
      <div className="h-2 rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: corBarra }} />
    </div>
  )
}

// ─── Formulário de cartão (cadastro/edição) ───────────────────────────────────
function FormCartao({ onSalvar, onCancelar, carregando, cartaoInicial, textoBotao }) {
  const [form, setForm] = useState({
    nome: cartaoInicial?.nome ?? '',
    banco: cartaoInicial?.banco ?? '',
    limite_total: cartaoInicial != null ? String(cartaoInicial.limite_total) : '',
    dia_fechamento: cartaoInicial != null ? String(cartaoInicial.dia_fechamento) : '',
    dia_vencimento: cartaoInicial != null ? String(cartaoInicial.dia_vencimento) : '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      nome: form.nome,
      banco: form.banco || null,
      limite_total: Number(form.limite_total) || 0,
      dia_fechamento: parseInt(form.dia_fechamento),
      dia_vencimento: parseInt(form.dia_vencimento),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome do cartão</label>
        <input name="nome" value={form.nome} onChange={handleChange}
          className="input" placeholder="Ex: Bradesco Visa, Nubank, Itaú Mastercard" required />
      </div>
      <div>
        <label className="label">Banco / Instituição <span className="text-gray-400">(opcional)</span></label>
        <input name="banco" value={form.banco} onChange={handleChange}
          className="input" placeholder="Ex: Bradesco, Nubank, Itaú" />
      </div>
      <div>
        <label className="label">Limite total (R$)</label>
        <InputMoeda valor={form.limite_total}
          onChangeValor={(n) => setForm(prev => ({ ...prev, limite_total: n }))}
          className="input" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Dia de fechamento</label>
          <input name="dia_fechamento" value={form.dia_fechamento} onChange={handleChange}
            type="number" min="1" max="31" className="input" placeholder="Ex: 20" required />
        </div>
        <div>
          <label className="label">Dia de vencimento</label>
          <input name="dia_vencimento" value={form.dia_vencimento} onChange={handleChange}
            type="number" min="1" max="31" className="input" placeholder="Ex: 28" required />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (textoBotao || 'Salvar cartão')}
        </button>
      </div>
    </form>
  )
}

// ─── Formulário de nova compra no cartão ──────────────────────────────────────
function FormCompra({ cartoes, cartaoIdFixo, onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('despesa')
  const [form, setForm] = useState({
    cartao_id: cartaoIdFixo ?? (cartoes[0]?.id ?? ''),
    descricao: '',
    valor_total: '',
    data_compra: new Date().toISOString().split('T')[0],
    categoria_id: '',
    tipo: 'avista',
    numero_parcelas: '2',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const nParc = form.tipo === 'parcelada' ? parseInt(form.numero_parcelas) : 1
  const { base: valorParcela } = Number(form.valor_total) > 0 && nParc
    ? calcularParcelas(Number(form.valor_total), nParc)
    : { base: 0 }

  function handleSubmit(e) {
    e.preventDefault()
    onSalvar({
      cartao_id: form.cartao_id,
      descricao: form.descricao,
      valor_total: Number(form.valor_total) || 0,
      data_compra: form.data_compra,
      categoria_id: form.categoria_id || null,
      numero_parcelas: form.tipo === 'parcelada' ? nParc : 1,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cartão (quando não vem fixo da fatura) */}
      {!cartaoIdFixo && (
        <div>
          <label className="label">Cartão</label>
          <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input" required>
            {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Mercado, Celular..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor da compra (R$)</label>
          <InputMoeda valor={form.valor_total}
            onChangeValor={(n) => setForm(prev => ({ ...prev, valor_total: n }))}
            className="input" />
        </div>
        <div>
          <label className="label">Data da compra</label>
          <input name="data_compra" value={form.data_compra} onChange={handleChange}
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

      {/* À vista / Parcelada */}
      <div>
        <label className="label">Pagamento</label>
        <div className="flex gap-3">
          {['avista', 'parcelada'].map(op => (
            <label key={op} className={`flex-1 flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all ${
              form.tipo === op ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
              <input type="radio" name="tipo" value={op} checked={form.tipo === op} onChange={handleChange} className="hidden" />
              {op === 'avista' ? 'À vista' : 'Parcelada'}
            </label>
          ))}
        </div>
      </div>

      {form.tipo === 'parcelada' && (
        <div>
          <label className="label">Número de parcelas</label>
          <select name="numero_parcelas" value={form.numero_parcelas} onChange={handleChange} className="input">
            {[2,3,4,5,6,7,8,9,10,11,12,18,24].map(n => <option key={n} value={n}>{n}x</option>)}
          </select>
          {valorParcela > 0 && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mt-2">
              {nParc}x de <strong>{formatCurrency(valorParcela)}</strong>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar compra'}
        </button>
      </div>
    </form>
  )
}

// Soma meses a um {ano, mes} (mes 1-12), retornando novo {ano, mes}
function somaMeses(ano, mes, delta) {
  const total = (ano * 12 + (mes - 1)) + delta
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }
}

// ─── Visão: Ver fatura de um cartão (atual ou projetada) ──────────────────────
function VerFatura({ cartao, onVoltar }) {
  const { compras, carregando, criar, remover } = useComprasCartao(cartao.id)
  const { parcelamentos } = useParcelamentos()
  const [modalCompra, setModalCompra] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erro, setErro] = useState('')
  // Mês/ano exibido: começa no atual; "Próximas faturas" muda isto
  const [refData, setRefData] = useState({ ano: anoAtual, mes: mesAtual })
  // Categoria expandida (mostra os lançamentos dela ao tocar). null = nenhuma.
  const [categoriaAberta, setCategoriaAberta] = useState(null)

  // Parcelamentos vinculados a ESTE cartão
  const parcelamentosDoCartao = parcelamentos.filter(p => p.cartao_id === cartao.id)

  // Linhas da fatura do mês/ano em foco (compras + parcelamentos), reutilizável
  const linhas = linhasFaturaCompleta(
    compras, parcelamentosDoCartao, cartao.dia_fechamento, refData.ano, refData.mes
  )
  const totalFatura = linhas.reduce((a, l) => a + l.valor, 0)

  // Limite disponível do cartão (mesma função usada nos cards da lista).
  const comprometido = limiteComprometido(compras, cartao.dia_fechamento, hoje)
  const limiteDisponivelCartao = Math.max(0, Number(cartao.limite_total) - comprometido)
  const pctUsado = Number(cartao.limite_total) > 0
    ? Math.min(100, Math.round((comprometido / Number(cartao.limite_total)) * 100))
    : 0

  // Status da fatura (discreto, sem excesso de cores). Prevista quando não é o
  // mês atual; senão, reflete o uso do limite do cartão.
  const ehMesAtual = refData.ano === anoAtual && refData.mes === mesAtual
  const statusFatura = !ehMesAtual
    ? { texto: 'Prevista', classe: 'bg-amber-50 text-amber-700' }
    : pctUsado >= 90
      ? { texto: 'Limite quase esgotado', classe: 'bg-red-50 text-red-600' }
      : pctUsado >= 70
        ? { texto: 'Atenção ao limite', classe: 'bg-amber-50 text-amber-700' }
        : { texto: 'Dentro do limite', classe: 'bg-emerald-50 text-emerald-700' }

  // ─── Agrupamento por CATEGORIA (para os cards de categoria) ───
  // Soma por categoria + guarda os lançamentos para exibir ao expandir.
  const categoriasFatura = (() => {
    const mapa = new Map()
    for (const l of linhas) {
      const chave = l.categorias?.id || 'sem-categoria'
      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          nome: l.categorias?.nome || 'Sem categoria',
          icone: l.categorias?.icone || null,
          total: 0,
          itens: [],
        })
      }
      const g = mapa.get(chave)
      g.total += l.valor
      g.itens.push(l)
    }
    return Array.from(mapa.values())
      .map(g => ({ ...g, pct: totalFatura > 0 ? Math.round((g.total / totalFatura) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
  })()
  const nomeMes = new Date(refData.ano, refData.mes - 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ── Próximos 6 meses (a partir do mês atual) ──
  const proximosMeses = Array.from({ length: 6 }, (_, i) => {
    const { ano, mes } = somaMeses(anoAtual, mesAtual, i)
    const ls = linhasFaturaCompleta(compras, parcelamentosDoCartao, cartao.dia_fechamento, ano, mes)
    const total = ls.reduce((a, l) => a + l.valor, 0)
    const qtdParcelas = ls.filter(l => l.totalParcelas > 1).length
    const qtdAvista = ls.length - qtdParcelas
    return {
      ano, mes, total,
      qtd: ls.length,
      qtdParcelas,
      qtdAvista,
      // Formato "Out/26" (via labelMes)
      label: labelMes(new Date(ano, mes - 1, 1)),
      ehAtual: i === 0,
    }
  })

  // Texto do card: "N parcelas previstas", "N itens previstos" se misturar à vista
  function textoPrevisto(m) {
    if (m.qtd === 0) return 'Sem lançamentos'
    if (m.qtdAvista > 0 && m.qtdParcelas > 0) {
      return `${m.qtd} ${m.qtd === 1 ? 'item previsto' : 'itens previstos'}`
    }
    // só parcelas (ou só à vista — usamos "parcela" quando houver parcelas)
    if (m.qtdParcelas > 0) {
      return `${m.qtdParcelas} ${m.qtdParcelas === 1 ? 'parcela prevista' : 'parcelas previstas'}`
    }
    return `${m.qtd} ${m.qtd === 1 ? 'item previsto' : 'itens previstos'}`
  }

  // Resumo do cartão
  const totalFaturaAtual = proximosMeses[0].total
  const totalProximaFatura = proximosMeses[1]?.total ?? 0
  // Compras futuras parceladas = parcelas que vencem DEPOIS da fatura atual
  const comprasFuturasParceladas = proximosMeses.slice(1).reduce((a, m) => a + m.total, 0)

  async function handleSalvar(dados) {
    setSalvando(true); setErro('')
    try {
      await criar(dados)
      setModalCompra(false)
    } catch {
      setErro('Erro ao salvar compra. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta compra?')) return
    setRemovendo(id)
    try { await remover(id) } catch { setErro('Erro ao remover.') } finally { setRemovendo(null) }
  }

  return (
    <div className="space-y-6">
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft size={16} /> Voltar aos cartões
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cartao.nome}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Fechamento: dia {cartao.dia_fechamento} • Vencimento: dia {cartao.dia_vencimento}
          </p>
          <p className="text-sm text-gray-500 mt-1 capitalize">
            {ehMesAtual ? 'Fatura de ' : 'Fatura prevista — '}{nomeMes}
          </p>
        </div>
        {ehMesAtual && (
          <button onClick={() => setModalCompra(true)} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
            <Plus size={16} /> Nova compra
          </button>
        )}
      </div>

      {/* Aviso de previsão quando não é o mês atual */}
      {!ehMesAtual && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <span className="text-amber-500 text-base leading-none flex-shrink-0">🔮</span>
          <p className="text-xs text-amber-800">
            Esta é uma <strong>previsão</strong> baseada nas parcelas já cadastradas. A fatura ainda não fechou.
          </p>
        </div>
      )}

      {/* ── Card principal da fatura ──
          Valor da fatura, limite disponível, fechamento, vencimento e status.
          Visual sóbrio, alinhado ao app; sem excesso de cores. */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-500">{ehMesAtual ? 'Valor da fatura atual' : 'Valor previsto'}</p>
            <p className="text-3xl font-bold text-gray-900 mt-0.5 break-words">{formatCurrency(totalFatura)}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusFatura.classe}`}>
            {statusFatura.texto}
          </span>
        </div>

        {/* Limite disponível + barra de uso */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Limite disponível</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(limiteDisponivelCartao)}
              <span className="text-gray-400 font-normal"> / {formatCurrency(cartao.limite_total)}</span>
            </span>
          </div>
          <BarraLimite usado={comprometido} total={Number(cartao.limite_total)} cor={cartao.cor || '#6366f1'} />
        </div>

        {/* Fechamento e vencimento */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">Fechamento</p>
            <p className="text-sm font-semibold text-gray-900">Dia {cartao.dia_fechamento}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-xs text-gray-400">Vencimento</p>
            <p className="text-sm font-semibold text-gray-900">Dia {cartao.dia_vencimento}</p>
          </div>
        </div>
      </div>

      {/* Resumo do cartão — valores com min-w-0/break-words p/ não cortar no mobile */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Fatura atual</p>
          <p className="text-sm font-bold text-indigo-600 break-words">{formatCurrency(totalFaturaAtual)}</p>
        </div>
        <div className="card min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Próxima fatura</p>
          <p className="text-sm font-bold text-gray-700 break-words">{formatCurrency(totalProximaFatura)}</p>
        </div>
        <div className="card min-w-0">
          <p className="text-xs text-gray-500 mb-0.5">Parcelas futuras</p>
          <p className="text-sm font-bold text-orange-600 break-words">{formatCurrency(comprasFuturasParceladas)}</p>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erro}</p>}

      {/* ── Gastos por categoria ──
          Cards compactos: nome, valor e % da categoria na fatura. Toque para
          ver os lançamentos daquela categoria (com opção de remover compra). */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-base font-semibold text-gray-900">
            Gastos por categoria <span className="text-sm font-normal text-gray-400">({categoriasFatura.length})</span>
          </h2>
          {ehMesAtual && linhas.length > 0 && (
            <button onClick={() => setModalCompra(true)} className="text-xs font-medium text-blue-600 hover:underline flex-shrink-0">
              + Nova compra
            </button>
          )}
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
        ) : linhas.length === 0 ? (
          <div className="card text-center py-12">
            <Receipt size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Nenhuma compra nesta fatura.</p>
            {ehMesAtual && (
              <button onClick={() => setModalCompra(true)} className="mt-3 text-sm text-blue-600 hover:underline">Lançar primeira compra</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {categoriasFatura.map(cat => {
              const aberta = categoriaAberta === cat.chave
              return (
                <div
                  key={cat.chave}
                  className={`card min-w-0 ${aberta ? 'col-span-2' : ''}`}
                >
                  {/* Cabeçalho tocável do card de categoria */}
                  <button
                    type="button"
                    onClick={() => setCategoriaAberta(aberta ? null : cat.chave)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {cat.icone ? <span className="text-sm">{cat.icone}</span> : <CreditCard size={14} className="text-gray-400" />}
                      </div>
                      <p className="text-sm font-medium text-gray-900 truncate min-w-0">{cat.nome}</p>
                    </div>
                    <p className="text-base font-bold text-gray-900 mt-2 break-words">{formatCurrency(cat.total)}</p>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs text-gray-400">{cat.pct}% da fatura</span>
                      <span className="text-xs text-gray-400">{cat.itens.length} {cat.itens.length === 1 ? 'item' : 'itens'}</span>
                    </div>
                    {/* Mini barra do percentual (discreta) */}
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                      <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${cat.pct}%` }} />
                    </div>
                  </button>

                  {/* Lançamentos da categoria (expandido) */}
                  {aberta && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {cat.itens.map(l => (
                        <div key={l.id} className="flex items-center justify-between gap-3 group">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.descricao}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="flex items-center gap-1 text-xs text-gray-400"><Calendar size={11} />{formatDate(l.data)}</span>
                              <span className="text-xs text-indigo-600 font-medium">
                                {l.totalParcelas > 1 ? `${l.parcela}/${l.totalParcelas}` : 'À vista'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatCurrency(l.valor)}</span>
                            {ehMesAtual && !l.origemParcelamento && (
                              <button onClick={() => handleRemover(l.id)} disabled={removendo === l.id}
                                aria-label="Remover compra"
                                className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                                {removendo === l.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Próximas faturas ── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Próximas faturas</h2>
        <p className="text-xs text-gray-400 mb-3">Previsão dos próximos 6 meses. Toque em um mês para ver os detalhes.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {proximosMeses.map(m => {
            const emFoco = m.ano === refData.ano && m.mes === refData.mes
            return (
              <button
                key={`${m.ano}-${m.mes}`}
                onClick={() => setRefData({ ano: m.ano, mes: m.mes })}
                className={`card text-left transition-all ${emFoco ? 'ring-2 ring-indigo-400' : 'hover:bg-gray-100'}`}
              >
                <p className="text-xs text-gray-400">{m.label}</p>
                <p className="text-base font-bold text-gray-900 mt-0.5">{formatCurrency(m.total)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {m.ehAtual ? 'Fatura atual' : textoPrevisto(m)}
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <Modal aberto={modalCompra} onFechar={() => setModalCompra(false)} titulo="Nova compra no cartão">
        <FormCompra cartoes={[cartao]} cartaoIdFixo={cartao.id} onSalvar={handleSalvar} onCancelar={() => setModalCompra(false)} carregando={salvando} />
      </Modal>
    </div>
  )
}

// ─── Card individual de cartão ────────────────────────────────────────────────
function CardCartao({ cartao, compras, onVerFatura, onEditar, onRemover, removendo }) {
  const fatura = valorFaturaCartaoNoMes(compras, cartao.dia_fechamento, anoAtual, mesAtual)
  const comprometido = limiteComprometido(compras, cartao.dia_fechamento, hoje)
  const disponivel = Math.max(0, Number(cartao.limite_total) - comprometido)

  return (
    <div className="card group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (cartao.cor || '#6366f1') + '22' }}>
            <CreditCard size={18} style={{ color: cartao.cor || '#6366f1' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{cartao.nome}</p>
            {cartao.banco && <p className="text-xs text-gray-400">{cartao.banco}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEditar(cartao)} title="Editar cartão" aria-label="Editar cartão"
            className="touch-target rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
            <Pencil size={15} />
          </button>
          <button onClick={() => onRemover(cartao.id)} disabled={removendo === cartao.id} title="Excluir cartão" aria-label="Excluir cartão"
            className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
            {removendo === cartao.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
        <div>
          <p className="text-xs text-gray-400">Fatura atual</p>
          <p className="text-sm font-bold text-indigo-600">{formatCurrency(fatura)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Disponível</p>
          <p className="text-sm font-bold text-green-600">{formatCurrency(disponivel)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Limite total</p>
          <p className="text-sm font-bold text-gray-700">{formatCurrency(cartao.limite_total)}</p>
        </div>
      </div>

      <BarraLimite usado={comprometido} total={Number(cartao.limite_total)} cor={cartao.cor || '#6366f1'} />

      <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
        <span>Fechamento: dia {cartao.dia_fechamento}</span>
        <span>Vencimento: dia {cartao.dia_vencimento}</span>
      </div>

      <button onClick={() => onVerFatura(cartao)}
        className="btn-secondary w-full mt-4 flex items-center justify-center gap-2">
        <Receipt size={15} /> Ver fatura
      </button>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Cartoes() {
  const { cartoes, carregando, criar, atualizar, remover } = useCartoes()
  const { compras } = useComprasCartao() // todas as compras (para resumo e cards)

  const [faturaAberta, setFaturaAberta] = useState(null) // cartão em visão de fatura
  const [modalCartao, setModalCartao] = useState(false)
  const [cartaoEditando, setCartaoEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erro, setErro] = useState('')

  // Compras agrupadas por cartão (para passar a cada card sem refazer query)
  const comprasPorCartao = (cartaoId) => compras.filter(c => c.cartao_id === cartaoId)

  // Resumo
  const faturasMes = cartoes.reduce((acc, c) =>
    acc + valorFaturaCartaoNoMes(comprasPorCartao(c.id), c.dia_fechamento, anoAtual, mesAtual), 0)
  const limiteTotal = cartoes.reduce((acc, c) => acc + Number(c.limite_total), 0)
  const limiteDisponivel = cartoes.reduce((acc, c) =>
    acc + Math.max(0, Number(c.limite_total) - limiteComprometido(comprasPorCartao(c.id), c.dia_fechamento, hoje)), 0)

  function abrirNovo() { setCartaoEditando(null); setModalCartao(true) }
  function abrirEdicao(c) { setCartaoEditando(c); setModalCartao(true) }
  function fecharModal() { setModalCartao(false); setCartaoEditando(null) }

  async function handleSalvar(dados) {
    setSalvando(true); setErro('')
    try {
      if (cartaoEditando) await atualizar(cartaoEditando.id, dados)
      else await criar(dados)
      fecharModal()
    } catch {
      setErro('Erro ao salvar cartão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Excluir este cartão? As compras vinculadas também serão removidas.')) return
    setRemovendo(id)
    try { await remover(id) } catch { setErro('Erro ao excluir cartão.') } finally { setRemovendo(null) }
  }

  // Visão de fatura de um cartão
  if (faturaAberta) {
    return <VerFatura cartao={faturaAberta} onVoltar={() => setFaturaAberta(null)} />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cartões de crédito</h1>
          <p className="text-sm text-gray-500 mt-1">Acompanhe suas faturas e limites</p>
        </div>
        <button onClick={abrirNovo} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Adicionar cartão
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500 mb-0.5">Faturas do mês</p>
          <p className="text-lg font-bold text-indigo-600">{formatCurrency(faturasMes)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-0.5">Limite total</p>
          <p className="text-lg font-bold text-gray-700">{formatCurrency(limiteTotal)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 mb-0.5">Limite disponível</p>
          <p className="text-lg font-bold text-green-600">{formatCurrency(limiteDisponivel)}</p>
        </div>
      </div>

      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erro}</p>}

      {carregando ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
      ) : cartoes.length === 0 ? (
        <div className="card text-center py-12">
          <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum cartão cadastrado.</p>
          <button onClick={abrirNovo} className="mt-3 text-sm text-blue-600 hover:underline">Adicionar primeiro cartão</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {cartoes.map(c => (
            <CardCartao
              key={c.id}
              cartao={c}
              compras={comprasPorCartao(c.id)}
              onVerFatura={setFaturaAberta}
              onEditar={abrirEdicao}
              onRemover={handleRemover}
              removendo={removendo}
            />
          ))}
        </div>
      )}

      <Modal aberto={modalCartao} onFechar={fecharModal} titulo={cartaoEditando ? 'Editar cartão' : 'Adicionar cartão'}>
        <FormCartao
          key={cartaoEditando ? cartaoEditando.id : 'novo'}
          onSalvar={handleSalvar}
          onCancelar={fecharModal}
          carregando={salvando}
          cartaoInicial={cartaoEditando}
          textoBotao={cartaoEditando ? 'Salvar alterações' : 'Salvar cartão'}
        />
      </Modal>
    </div>
  )
}
