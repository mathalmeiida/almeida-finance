import React, { useState } from 'react'
import { TrendingUp, Plus, Pencil, Trash2, Loader2, PiggyBank, Wallet, BarChart2, ArrowDownCircle } from 'lucide-react'
import { useInvestimentos, CATEGORIAS_INVESTIMENTO, labelCategoriaInvestimento, TIPOS_MOV_INVESTIMENTO } from '../hooks/useInvestimentos'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import { formatCurrency, exibirMoeda, hojeISO, formatDate } from '../lib/utils'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'

const mesAtual = new Date().getMonth() + 1
const anoAtual = new Date().getFullYear()

const TIPO_MOV_LABEL = {
  aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento',
  dividendo: 'Dividendo', juros: 'Juros', amortizacao: 'Amortização',
}

// ─── Formulário de investimento (cadastrar/editar) ───
function FormInvestimento({ inicial, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    nome: inicial?.nome ?? '',
    instituicao: inicial?.instituicao ?? '',
    categoria: inicial?.categoria ?? 'tesouro',
    data_aplicacao: inicial?.data_aplicacao ?? hojeISO(),
    valor_aplicado: inicial?.valor_aplicado != null ? String(inicial.valor_aplicado) : '',
    valor_atual: inicial?.valor_atual != null ? String(inicial.valor_atual) : '',
    quantidade: inicial?.quantidade != null ? String(inicial.quantidade) : '',
    preco_unitario: inicial?.preco_unitario != null ? String(inicial.preco_unitario) : '',
    taxa_contratada: inicial?.taxa_contratada ?? '',
    indexador: inicial?.indexador ?? '',
    vencimento: inicial?.vencimento ?? '',
    liquidez: inicial?.liquidez ?? '',
    objetivo: inicial?.objetivo ?? '',
    reserva_valor: inicial?.reserva_valor != null ? String(inicial.reserva_valor) : '',
  })
  const [erroReserva, setErroReserva] = useState('')
  const [avancado, setAvancado] = useState(false)
  // Categorias com quantidade/preço (renda variável)
  const usaQtd = ['acoes', 'fii', 'etf', 'fundo'].includes(form.categoria)

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) return
    const num = (v) => (v === '' || v == null ? null : Number(v))
    const valorAtual = Number(form.valor_atual) || Number(form.valor_aplicado) || 0
    const reservaValor = Number(form.reserva_valor) || 0
    // Rejeita (mensagem clara) quando a parte vinculada à reserva passa do saldo
    // atual — mesma regra do CHECK no banco, sem ajuste silencioso.
    if (reservaValor > valorAtual) {
      setErroReserva('O valor vinculado à reserva não pode ser maior que o valor atual do investimento.')
      return
    }
    setErroReserva('')
    onSalvar({
      nome: form.nome.trim(),
      instituicao: form.instituicao.trim() || null,
      categoria: form.categoria,
      data_aplicacao: form.data_aplicacao || null,
      valor_aplicado: Number(form.valor_aplicado) || 0,
      valor_atual: valorAtual,
      quantidade: usaQtd ? num(form.quantidade) : null,
      preco_unitario: usaQtd ? num(form.preco_unitario) : null,
      taxa_contratada: form.taxa_contratada.trim() || null,
      indexador: form.indexador.trim() || null,
      vencimento: form.vencimento || null,
      liquidez: form.liquidez.trim() || null,
      objetivo: form.objetivo.trim() || null,
      reserva_valor: reservaValor,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome</label>
        <input className="input" value={form.nome} autoFocus
          onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
          placeholder="Ex.: Tesouro IPCA+ 2029, PETR4..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Categoria</label>
          <select className="input" value={form.categoria}
            onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
            {CATEGORIAS_INVESTIMENTO.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Instituição <span className="text-gray-400">(opcional)</span></label>
          <input className="input" value={form.instituicao}
            onChange={e => setForm(p => ({ ...p, instituicao: e.target.value }))} placeholder="Ex.: Nubank, XP" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor aplicado (R$)</label>
          <InputMoeda valor={form.valor_aplicado} onChangeValor={n => setForm(p => ({ ...p, valor_aplicado: n }))} className="input" />
        </div>
        <div>
          <label className="label">Valor atual (R$)</label>
          <InputMoeda valor={form.valor_atual} onChangeValor={n => setForm(p => ({ ...p, valor_atual: n }))} className="input" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data da aplicação</label>
          <input type="date" className="input" value={form.data_aplicacao}
            onChange={e => setForm(p => ({ ...p, data_aplicacao: e.target.value }))} />
        </div>
        <div>
          <label className="label">Vincular à reserva (R$) <span className="text-gray-400">(opcional)</span></label>
          <InputMoeda valor={form.reserva_valor} onChangeValor={n => setForm(p => ({ ...p, reserva_valor: n }))} className="input" />
        </div>
      </div>
      <p className="text-xs text-gray-400 -mt-1">
        Informe quanto deste investimento compõe sua reserva de emergência (parte ou total). Não pode exceder o valor atual.
      </p>
      {erroReserva && <p className="text-xs text-red-500 -mt-1">{erroReserva}</p>}

      {usaQtd && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Quantidade</label>
            <input type="number" step="any" min="0" className="input" value={form.quantidade}
              onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="Ex.: 100" />
          </div>
          <div>
            <label className="label">Preço unitário (R$)</label>
            <InputMoeda valor={form.preco_unitario} onChangeValor={n => setForm(p => ({ ...p, preco_unitario: n }))} className="input" />
          </div>
        </div>
      )}

      {/* Opções avançadas (expansível) */}
      <button type="button" onClick={() => setAvancado(v => !v)}
        className="text-xs font-medium text-marca hover:underline">
        {avancado ? 'Ocultar' : 'Mostrar'} opções avançadas
      </button>
      {avancado && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Indexador <span className="text-gray-400">(opcional)</span></label>
              <input className="input" value={form.indexador}
                onChange={e => setForm(p => ({ ...p, indexador: e.target.value }))} placeholder="CDI, IPCA, PREFIXADO" />
            </div>
            <div>
              <label className="label">Taxa contratada <span className="text-gray-400">(opcional)</span></label>
              <input className="input" value={form.taxa_contratada}
                onChange={e => setForm(p => ({ ...p, taxa_contratada: e.target.value }))} placeholder="Ex.: 110% CDI" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vencimento <span className="text-gray-400">(opcional)</span></label>
              <input type="date" className="input" value={form.vencimento}
                onChange={e => setForm(p => ({ ...p, vencimento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Liquidez <span className="text-gray-400">(opcional)</span></label>
              <input className="input" value={form.liquidez}
                onChange={e => setForm(p => ({ ...p, liquidez: e.target.value }))} placeholder="Diária, no vencimento..." />
            </div>
          </div>
          <div>
            <label className="label">Objetivo <span className="text-gray-400">(opcional)</span></label>
            <input className="input" value={form.objetivo}
              onChange={e => setForm(p => ({ ...p, objetivo: e.target.value }))} placeholder="Ex.: Aposentadoria" />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (inicial ? 'Salvar' : 'Adicionar')}
        </button>
      </div>
    </form>
  )
}

// ─── Formulário de movimentação ───
function FormMovimentacao({ onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({ tipo: 'aporte', valor: '', data: hojeISO(), descricao: '' })
  function enviar(e) {
    e.preventDefault()
    const v = Number(form.valor) || 0
    if (v <= 0) return
    onSalvar({ tipo: form.tipo, valor: v, data: form.data, descricao: form.descricao.trim() || null })
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label">Tipo</label>
        <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
          {TIPOS_MOV_INVESTIMENTO.map(t => <option key={t} value={t}>{TIPO_MOV_LABEL[t]}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor (R$)</label>
          <InputMoeda valor={form.valor} onChangeValor={n => setForm(p => ({ ...p, valor: n }))} className="input" autoFocus />
        </div>
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="label">Descrição <span className="text-gray-400">(opcional)</span></label>
        <input className="input" value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
      </div>
      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
        As movimentações servem de histórico (aportes, resgates, rendimentos). O saldo da posição é o
        "Valor atual" informado no cadastro — atualize-o para refletir o mercado.
      </p>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Registrar'}
        </button>
      </div>
    </form>
  )
}

function Indicador({ icone: Ic, rotulo, valor, cor = 'text-gray-900', ocultar }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 min-w-0">
      <p className="text-xs text-gray-400 flex items-center gap-1.5">{Ic && <Ic size={13} />} {rotulo}</p>
      <p className={`text-lg font-bold break-words ${cor}`}>{exibirMoeda(valor, ocultar)}</p>
    </div>
  )
}

export default function Investimentos() {
  const { somenteLeitura } = useAuth()
  const { ocultar } = useOcultarValores()
  const {
    investimentos, carregando, erro,
    criar, atualizar, remover, criarMovimentacao, removerMovimentacao,
    patrimonioTotal, totalAplicado, reservaVinculada, rendimentoAcumulado,
    aportesNoMes, rendimentoNoMes, distribuicaoPorCategoria, movsDeInvestimento,
  } = useInvestimentos()

  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [movDe, setMovDe] = useState(null)
  const [extratoDe, setExtratoDe] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  const dist = distribuicaoPorCategoria()
  const aportesMes = aportesNoMes(anoAtual, mesAtual)
  const rendMes = rendimentoNoMes(anoAtual, mesAtual)

  async function salvar(dados) {
    setSalvando(true); setErroAcao('')
    try {
      if (editando) await atualizar(editando.id, dados)
      else await criar(dados)
      setModal(false); setEditando(null)
    } catch (e) { setErroAcao(e.message || 'Erro ao salvar o investimento.') }
    finally { setSalvando(false) }
  }
  async function salvarMov(dados) {
    setSalvando(true); setErroAcao('')
    try {
      await criarMovimentacao({ investimento_id: movDe.id, ...dados })
      setMovDe(null)
    } catch (e) { setErroAcao(e.message || 'Erro ao registrar a movimentação.') }
    finally { setSalvando(false) }
  }
  async function excluir(i) {
    if (!confirm(`Remover "${i.nome}" e suas movimentações?`)) return
    try { await remover(i.id) } catch (e) { setErroAcao(e.message || 'Erro ao remover.') }
  }

  return (
    <div className="space-y-5 pb-mobilenav md:pb-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Investimentos</h1>
          <p className="text-sm text-gray-500 mt-1">Seu patrimônio investido, separado do saldo em conta.</p>
        </div>
        {!somenteLeitura && (
          <button onClick={() => { setEditando(null); setModal(true) }}
            className="btn-primary flex items-center gap-2 flex-shrink-0 text-sm">
            <Plus size={16} /> Novo
          </button>
        )}
      </div>

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}
      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">Erro ao carregar: {erro}</p>}

      {/* Painel principal (valores reais informados) */}
      <div className="bg-marca-grad-dark text-white rounded-2xl p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-white/85">Patrimônio total</p>
        <p className="text-3xl font-extrabold mt-1 break-words">{exibirMoeda(patrimonioTotal, ocultar)}</p>
        <p className="text-xs text-white/80 mt-1">Aplicado: {exibirMoeda(totalAplicado, ocultar)} · Não entra no saldo disponível.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Indicador icone={TrendingUp} rotulo="Rendimento (mês)" valor={rendMes} cor="text-green-600" ocultar={ocultar} />
        <Indicador icone={BarChart2} rotulo="Rend. acumulado" valor={rendimentoAcumulado} cor="text-green-600" ocultar={ocultar} />
        <Indicador icone={Wallet} rotulo="Aportes (mês)" valor={aportesMes} ocultar={ocultar} />
        <Indicador icone={PiggyBank} rotulo="Na reserva" valor={reservaVinculada} cor="text-amber-600" ocultar={ocultar} />
      </div>

      {/* Distribuição da carteira */}
      {dist.length > 0 && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Distribuição da carteira</h2>
          <div className="space-y-2">
            {dist.map(d => (
              <div key={d.categoria}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{labelCategoriaInvestimento(d.categoria)}</span>
                  <span className="text-gray-500">{exibirMoeda(d.total, ocultar)} · {d.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-marca" style={{ width: `${Math.min(100, d.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de investimentos */}
      {carregando ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-marca" /></div>
      ) : investimentos.length === 0 ? (
        <div className="card text-center py-12">
          <TrendingUp size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nenhum investimento cadastrado ainda.</p>
          {!somenteLeitura && (
            <button onClick={() => { setEditando(null); setModal(true) }}
              className="mt-3 text-sm text-marca font-medium hover:underline">+ Cadastrar investimento</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {investimentos.map(i => {
            const variacao = (Number(i.valor_atual) || 0) - (Number(i.valor_aplicado) || 0)
            return (
              <div key={i.id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{i.nome}</p>
                    <p className="text-xs text-gray-400">{labelCategoriaInvestimento(i.categoria)}{i.instituicao ? ` · ${i.instituicao}` : ''}{Number(i.reserva_valor) > 0 ? ' · reserva' : ''}</p>
                  </div>
                  {!somenteLeitura && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => { setEditando(i); setModal(true) }} aria-label="Editar" className="touch-target rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Pencil size={15} /></button>
                      <button onClick={() => excluir(i)} aria-label="Remover" className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-2 break-words">{exibirMoeda(i.valor_atual, ocultar)}</p>
                <p className={`text-xs mt-0.5 ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {variacao >= 0 ? '+' : '−'}{exibirMoeda(Math.abs(variacao), ocultar)} vs. aplicado
                </p>
                {!somenteLeitura && (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button onClick={() => { setErroAcao(''); setMovDe(i) }} className="btn-primary flex items-center justify-center gap-1.5 text-sm py-2"><Plus size={15} /> Movimentar</button>
                    <button onClick={() => setExtratoDe(extratoDe?.id === i.id ? null : i)} className="btn-secondary text-sm py-2">
                      {extratoDe?.id === i.id ? 'Ocultar' : 'Ver extrato'}
                    </button>
                  </div>
                )}
                {extratoDe?.id === i.id && (
                  <div className="mt-3 border-t border-gray-100 pt-3 space-y-1.5">
                    {movsDeInvestimento(i.id).length === 0
                      ? <p className="text-xs text-gray-400">Sem movimentações.</p>
                      : movsDeInvestimento(i.id).map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-gray-600 flex items-center gap-1.5">
                            <ArrowDownCircle size={12} className="text-gray-400" />
                            {TIPO_MOV_LABEL[m.tipo]} · {formatDate(m.data)}
                          </span>
                          <span className="flex items-center gap-2">
                            <strong className="text-gray-800">{exibirMoeda(m.valor, ocultar)}</strong>
                            {!somenteLeitura && (
                              <button onClick={() => removerMovimentacao(m.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal aberto={modal} onFechar={() => { setModal(false); setEditando(null) }} titulo={editando ? 'Editar investimento' : 'Novo investimento'}>
        <FormInvestimento inicial={editando} onSalvar={salvar} onCancelar={() => { setModal(false); setEditando(null) }} salvando={salvando} />
      </Modal>

      <Modal aberto={!!movDe} onFechar={() => setMovDe(null)} titulo={`Movimentar — ${movDe?.nome || ''}`}>
        {movDe && <FormMovimentacao onSalvar={salvarMov} onCancelar={() => setMovDe(null)} salvando={salvando} />}
      </Modal>
    </div>
  )
}
