import React, { useState } from 'react'

import { TrendingUp, Plus, Pencil, Trash2, Loader2, PiggyBank, Wallet, BarChart2, ArrowDownCircle, Eye, EyeOff, History, Landmark } from 'lucide-react'

import { useInvestimentos, CATEGORIAS_INVESTIMENTO, labelCategoriaInvestimento, TIPOS_MOV_INVESTIMENTO } from '../hooks/useInvestimentos'

import { useAuth } from '../contexts/AuthContext'

import { useOcultarValores } from '../contexts/OcultarValoresContext'

import { formatCurrency, exibirMoeda, hojeISO, formatDate } from '../lib/utils'

import Modal from '../components/Modal'

import InputMoeda from '../components/InputMoeda'

// Cores ligadas ao tema global do Almeida Finance (variável CSS --marca).
// O mesmo tom é usado no gráfico e na legenda.
const CORES_DISTRIBUICAO = [
  'rgb(var(--marca))',
  'color-mix(in srgb, rgb(var(--marca)) 75%, white)',
  'color-mix(in srgb, rgb(var(--marca)) 65%, black)',
  'color-mix(in srgb, rgb(var(--marca)) 55%, white)',
  'color-mix(in srgb, rgb(var(--marca)) 45%, black)',
  'color-mix(in srgb, rgb(var(--marca)) 35%, white)',
]

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

  // Modo da reserva (só UI; o dado persistido continua sendo reserva_valor):
  //  'nao'    → reserva_valor = 0
  //  'todo'   → reserva_valor = valor_atual (o total compõe a reserva)
  //  'parte'  → reserva_valor = valor informado no campo
  const [reservaModo, setReservaModo] = useState(() => {

    const rv = Number(inicial?.reserva_valor) || 0

    if (rv <= 0) return 'nao'

    const va = Number(inicial?.valor_atual) || 0

    return va > 0 && rv >= va ? 'todo' : 'parte'

  })

  // Categorias com quantidade/preço (renda variável)
  const usaQtd = ['acoes', 'fii', 'etf', 'fundo'].includes(form.categoria)

  function handleSubmit(e) {

    e.preventDefault()

    if (!form.nome.trim()) return

    const num = (v) => (v === '' || v == null ? null : Number(v))

    const valorAtual = Number(form.valor_atual) || Number(form.valor_aplicado) || 0

    // Deriva reserva_valor a partir do modo escolhido.
    let reservaValor = 0

    if (reservaModo === 'todo') reservaValor = valorAtual

    else if (reservaModo === 'parte') reservaValor = Number(form.reserva_valor) || 0

    // Rejeita (mensagem clara) quando a parte vinculada à reserva passa do saldo
    // atual — mesma regra do CHECK no banco, sem ajuste silencioso.
    if (reservaValor < 0) {

      setErroReserva('O valor vinculado à reserva não pode ser negativo.')

      return

    }

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div>

          <label className="label">Quanto você investiu?</label>

          <InputMoeda valor={form.valor_aplicado} onChangeValor={n => setForm(p => ({ ...p, valor_aplicado: n }))} className="input" />

          <p className="text-[11px] text-gray-400 mt-1">Valor aplicado: o total que você colocou neste investimento.</p>

        </div>

        <div>

          <label className="label">Quanto vale hoje?</label>

          <InputMoeda valor={form.valor_atual} onChangeValor={n => setForm(p => ({ ...p, valor_atual: n }))} className="input" />

          <p className="text-[11px] text-gray-400 mt-1">Valor atual: quanto a posição vale agora (saldo da posição).</p>

        </div>

      </div>

      <div>

        <label className="label">Data da aplicação</label>

        <input type="date" className="input" value={form.data_aplicacao}

          onChange={e => setForm(p => ({ ...p, data_aplicacao: e.target.value }))} />

      </div>

      {/* Reserva de emergência: escolha clara (Não / Sim, todo / Sim, parte). */}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">

        <p className="text-sm font-medium text-gray-800">Este investimento faz parte da sua reserva de emergência?</p>

        <div className="flex flex-col gap-1.5">

          {[

            { v: 'nao',   t: 'Não' },

            { v: 'todo',  t: 'Sim, todo o valor' },

            { v: 'parte', t: 'Sim, apenas uma parte' },

          ].map(op => (

            <label key={op.v} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">

              <input type="radio" name="reserva_modo" value={op.v} checked={reservaModo === op.v}

                onChange={() => { setReservaModo(op.v); setErroReserva('') }} className="accent-[rgb(var(--marca))]" />

              {op.t}

            </label>

          ))}

        </div>

        {reservaModo === 'parte' && (

          <div>

            <label className="label">Valor destinado à reserva (R$)</label>

            <InputMoeda valor={form.reserva_valor} onChangeValor={n => setForm(p => ({ ...p, reserva_valor: n }))} className="input" />

            <p className="text-[11px] text-gray-400 mt-1">Não pode exceder o valor atual. Compõe sua reserva sem duplicar o patrimônio.</p>

          </div>

        )}

        {erroReserva && <p className="text-xs text-red-500">{erroReserva}</p>}

      </div>

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

  const [mostrarTodasMovs, setMostrarTodasMovs] = useState(false)

  const dist = distribuicaoPorCategoria()

  const aportesMes = aportesNoMes(anoAtual, mesAtual)

  const rendMes = rendimentoNoMes(anoAtual, mesAtual)

  // Usa exclusivamente movimentações já disponíveis no hook, sem estimar histórico.
  const ultimasMovimentacoes = (investimentos || [])

    .flatMap(investimento => (movsDeInvestimento(investimento.id) || []).map(m => ({

      ...m, nomeInvestimento: investimento.nome, instituicao: investimento.instituicao || ''

    })))

    .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))

  const movimentosVisiveis = mostrarTodasMovs ? ultimasMovimentacoes : ultimasMovimentacoes.slice(0, 4)

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

      {/* Resumo patrimonial e painel informativo: nenhuma série histórica é inventada. */}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <section className="bg-marca-grad-dark text-white rounded-2xl p-5 sm:p-6 min-w-0 shadow-lg">

          <div className="flex justify-between gap-3 items-start">

            <div>

              <p className="text-xs uppercase tracking-wide text-white/80">Meu patrimônio investido</p>

              <p className="text-3xl sm:text-4xl font-extrabold mt-2 break-words">{exibirMoeda(patrimonioTotal, ocultar)}</p>

            </div>

            <span className="rounded-xl bg-white/10 p-3"><PiggyBank size={23}/></span>

          </div>

          <p className={`text-sm mt-3 font-medium ${patrimonioTotal - totalAplicado >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>

            {totalAplicado > 0 ? <>{patrimonioTotal - totalAplicado >= 0 ? '+' : '−'} {exibirMoeda(Math.abs(patrimonioTotal - totalAplicado), ocultar)} {!ocultar && `(${((patrimonioTotal - totalAplicado) / totalAplicado * 100).toFixed(2)}%)`} em relação ao valor aplicado</> : 'Cadastre o valor aplicado para comparar'}

          </p>

          <div className="grid grid-cols-2 gap-2 mt-5">

            <div className="rounded-xl bg-black/15 p-3 min-w-0"><p className="text-xs text-white/75">Valor aplicado</p><p className="text-lg font-bold mt-1 break-words">{exibirMoeda(totalAplicado, ocultar)}</p></div>

            <div className="rounded-xl bg-black/15 p-3 min-w-0"><p className="text-xs text-white/75">Valor atual</p><p className="text-lg font-bold mt-1 break-words">{exibirMoeda(patrimonioTotal, ocultar)}</p></div>

            <div className="rounded-xl bg-black/15 p-3 min-w-0"><p className="text-xs text-white/75">Rendimento no mês</p><p className="text-lg font-bold mt-1 break-words">{exibirMoeda(rendMes, ocultar)}</p></div>

            <div className="rounded-xl bg-black/15 p-3 min-w-0"><p className="text-xs text-white/75">Aportes no mês</p><p className="text-lg font-bold mt-1 break-words">{exibirMoeda(aportesMes, ocultar)}</p></div>

          </div>

          <p className="mt-3 text-xs text-white/70">Patrimônio separado do saldo em conta e do limite diário.</p>

        </section>

        <section className="card min-w-0 !p-5 sm:!p-6 flex flex-col gap-3">

          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><History size={19} className="text-marca"/> Evolução do patrimônio</h2>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-start gap-3 px-4 py-4">

            <BarChart2 size={21} className="text-marca shrink-0 mt-0.5"/>

            <div className="min-w-0">

              <p className="text-sm font-semibold text-gray-700">Gráfico histórico ainda indisponível</p>

              <p className="text-xs text-gray-500 mt-1">Para mostrar a evolução real, o aplicativo precisa registrar valores da carteira por data. Seus saldos e movimentações atuais permanecem disponíveis.</p>

            </div>

          </div>

        </section>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <section className="card min-w-0 !p-5 sm:!p-6">

          <h2 className="text-base font-semibold text-gray-900 mb-4">Distribuição da carteira</h2>

          {dist.length > 0 && patrimonioTotal > 0 ? (

            <div className="flex flex-col sm:flex-row items-center gap-6">

              <div className="relative w-44 h-44 rounded-full shrink-0" style={{ background: `conic-gradient(${dist.map((d, i) => { const cores = CORES_DISTRIBUICAO; const inicio = dist.slice(0,i).reduce((a, x) => a + Math.max(0,Number(x.pct)||0),0); return `${cores[i % cores.length]} ${inicio}% ${inicio + Math.max(0,Number(d.pct)||0)}%`; }).join(', ')})` }}>

                <div className="absolute inset-7 rounded-full bg-[#1f2735] flex flex-col items-center justify-center text-white">

                  <strong className="text-base">{exibirMoeda(patrimonioTotal, ocultar)}</strong>

                  <span className="text-[11px] text-white/70">Carteira</span>

                </div>

              </div>

              <div className="flex-1 min-w-0 w-full space-y-3">

                {dist.map((d,i) => <div key={d.categoria} className="flex justify-between gap-3 text-sm items-center">

                  <div className="flex gap-2 min-w-0 items-center"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background:CORES_DISTRIBUICAO[i % CORES_DISTRIBUICAO.length]}}/><span className="truncate">{labelCategoriaInvestimento(d.categoria)}</span></div>

                  <span className="text-gray-500 shrink-0">{ocultar ? '••••' : `${d.pct.toFixed(0)}%`}</span>

                </div>)}

              </div>

            </div>

          ) : <p className="text-sm text-gray-500">Cadastre investimentos para visualizar sua distribuição.</p>}

        </section>

        <section className="card min-w-0 !p-5 sm:!p-6 space-y-4">

          <h2 className="text-base font-semibold text-gray-900">Resumo dos investimentos</h2>

          <div className="grid grid-cols-2 gap-3">

            <Indicador icone={BarChart2} rotulo="Rendimento acumulado" valor={rendimentoAcumulado} cor="text-green-600" ocultar={ocultar}/>

            <Indicador icone={PiggyBank} rotulo="Reserva vinculada" valor={reservaVinculada} cor="text-amber-600" ocultar={ocultar}/>

          </div>

          <p className="text-xs text-gray-500">A reserva vinculada já está incluída no patrimônio total; ela não é somada novamente.</p>

        </section>

      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 items-start gap-4">

        <section className="min-w-0 space-y-3">

          <h2 className="text-lg font-bold text-gray-900">Seus investimentos ({investimentos.length})</h2>

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

        <div className="grid grid-cols-1 gap-4">

          {investimentos.map(i => {

            const aplicado = Number(i.valor_aplicado) || 0

            const atual = Number(i.valor_atual) || 0

            const variacao = atual - aplicado

            // Só exibe variação/valorização quando há BASE (valor aplicado > 0);
            // sem isso, a comparação e o percentual não seriam corretos.
            const temBaseVariacao = aplicado > 0

            const pctVariacao = temBaseVariacao ? (variacao / aplicado) * 100 : null

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

                <p className="text-[11px] text-gray-400 mt-0.5">Aplicado: {exibirMoeda(aplicado, ocultar)}</p>

                {temBaseVariacao ? (

                  <p className={`text-xs mt-0.5 ${variacao >= 0 ? 'text-green-600' : 'text-red-600'}`}>

                    {variacao >= 0 ? '+' : '−'}{exibirMoeda(Math.abs(variacao), ocultar)}

                    {!ocultar && ` (${variacao >= 0 ? '+' : '−'}${Math.abs(pctVariacao).toFixed(1)}%)`} vs. aplicado

                  </p>

                ) : (

                  <p className="text-xs mt-0.5 text-gray-400">Informe o valor aplicado para ver a valorização.</p>

                )}

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

        </section>

        <section className="card min-w-0 !p-5 sm:!p-6 space-y-3">

          <div className="flex items-center justify-between gap-3">

            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><History size={18} className="text-marca"/> Últimas movimentações</h2>

            {ultimasMovimentacoes.length > 4 && (

              <button type="button" className="text-xs font-semibold text-marca hover:underline" onClick={() => setMostrarTodasMovs(v => !v)}>

                {mostrarTodasMovs ? 'Mostrar menos' : 'Ver todas'}

              </button>

            )}

          </div>

          {carregando ? (

            <p className="text-sm text-gray-500">Carregando movimentações...</p>

          ) : movimentosVisiveis.length === 0 ? (

            <p className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-500">Nenhuma movimentação registrada. Ao cadastrar aportes, resgates ou rendimentos, eles aparecerão aqui.</p>

          ) : (

            <div className="divide-y divide-gray-100">

              {movimentosVisiveis.map((m, indice) => (

                <div key={`${m.id || m.investimento_id}-${indice}`} className="flex items-center justify-between gap-3 py-3">

                  <div className="min-w-0">

                    <p className="text-sm font-medium text-gray-900">{TIPO_MOV_LABEL[m.tipo] || m.tipo || 'Movimentação'}</p>

                    <p className="text-xs text-gray-500 truncate">{m.nomeInvestimento}{m.instituicao ? ` · ${m.instituicao}` : ''} · {m.data ? formatDate(m.data) : 'Sem data'}</p>

                  </div>

                  <strong className="text-sm text-gray-900 shrink-0">{exibirMoeda(m.valor, ocultar)}</strong>

                </div>

              ))}

            </div>

          )}

          <p className="text-[11px] text-gray-500">Valores correspondem aos registros de movimentação, não a uma evolução histórica do patrimônio.</p>

        </section>

      </div>

      <Modal aberto={modal} onFechar={() => { setModal(false); setEditando(null) }} titulo={editando ? 'Editar investimento' : 'Novo investimento'}>

        <FormInvestimento inicial={editando} onSalvar={salvar} onCancelar={() => { setModal(false); setEditando(null) }} salvando={salvando} />

      </Modal>

      <Modal aberto={!!movDe} onFechar={() => setMovDe(null)} titulo={`Movimentar — ${movDe?.nome || ''}`}>

        {movDe && <FormMovimentacao onSalvar={salvarMov} onCancelar={() => setMovDe(null)} salvando={salvando} />}

      </Modal>

    </div>

  )

}