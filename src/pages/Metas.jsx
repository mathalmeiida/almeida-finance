import React, { useState } from 'react'
import {
  Target, Plus, Minus, Calendar, TrendingUp, Trash2, Loader2, Pencil, CheckCircle2,
  PiggyBank, Eye, Wallet, Home, Plane, Car, GraduationCap, Heart, Smartphone, Gift,
} from 'lucide-react'
import { useMetas } from '../hooks/useMetas'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate } from '../lib/utils'

const CORES_PRESET = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#be185d']
const numero = value => Number(value) || 0
const progresso = (atual, objetivo) => objetivo > 0 ? Math.min(100, Math.max(0, atual / objetivo * 100)) : 0

// Ícone/rótulo de "categoria" derivados do NOME da meta (apenas visual — não há
// coluna de categoria na tabela; nada é inventado/persistido). Fallback: Target.
const REGRAS_CATEGORIA = [
  { re: /(casa|apart|imóvel|imovel|moradia|reforma)/i, icon: Home, label: 'Moradia' },
  { re: /(viage|viaj|férias|ferias|trip|turismo)/i, icon: Plane, label: 'Viagem' },
  { re: /(carro|moto|veículo|veiculo|auto)/i, icon: Car, label: 'Veículo' },
  { re: /(curso|facul|estudo|educa|mba|pós|pos)/i, icon: GraduationCap, label: 'Educação' },
  { re: /(saúde|saude|médic|medic|dent|academia)/i, icon: Heart, label: 'Saúde' },
  { re: /(iphone|celular|notebook|pc|eletr|tv|fone)/i, icon: Smartphone, label: 'Eletrônicos' },
  { re: /(reserva|emerg|poupança|poupanca|fundo)/i, icon: Wallet, label: 'Reserva' },
  { re: /(presente|casamento|festa|natal)/i, icon: Gift, label: 'Presente' },
]
function categoriaDaMeta(nome) {
  const r = REGRAS_CATEGORIA.find(x => x.re.test(nome || ''))
  return r ? { Icone: r.icon, label: r.label } : { Icone: Target, label: 'Objetivo' }
}

// Meses inteiros entre hoje e o prazo (data interpretada em horário local).
function calcularMesesRestantes(prazo) {
  if (!prazo) return 0
  const partes = String(prazo).split('-').map(Number)
  if (partes.length !== 3 || partes.some(n => !Number.isFinite(n))) return 0
  const hoje = new Date()
  return Math.max(0, (partes[0] - hoje.getFullYear()) * 12 + (partes[1] - 1 - hoje.getMonth()))
}
// Sugestão mensal só quando há dados suficientes (prazo futuro e falta valor).
function sugestaoMensal(faltante, meses) {
  if (faltante <= 0 || meses <= 0) return null
  return faltante / meses
}

function FormMeta({ meta, onSalvar, onCancelar, carregando }) {
  const [form, setForm] = useState({
    nome: meta?.nome || '',
    valor_desejado: meta?.valor_desejado ?? '',
    valor_atual: meta?.valor_atual ?? 0,
    prazo: meta?.prazo || '',
    cor: meta?.cor || '#059669',
  })
  const faltante = Math.max(0, numero(form.valor_desejado) - numero(form.valor_atual))
  const meses = calcularMesesRestantes(form.prazo)
  function enviar(e) {
    e.preventDefault()
    if (!form.nome.trim() || numero(form.valor_desejado) <= 0 || numero(form.valor_atual) < 0) return
    onSalvar({
      nome: form.nome.trim(),
      valor_desejado: numero(form.valor_desejado),
      valor_atual: numero(form.valor_atual),
      prazo: form.prazo || null,
      cor: form.cor,
    })
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label">Nome da meta</label>
        <input className="input" required value={form.nome} onChange={e => setForm(p => ({...p, nome: e.target.value}))} placeholder="Ex.: iPhone, viagem, casa..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="label">Valor desejado (R$)</label><InputMoeda valor={form.valor_desejado} onChangeValor={v => setForm(p => ({...p, valor_desejado:v}))} className="input" /></div>
        <div><label className="label">Já tenho guardado (R$)</label><InputMoeda valor={form.valor_atual} onChangeValor={v => setForm(p => ({...p, valor_atual:v}))} className="input" /></div>
      </div>
      <div>
        <label className="label">Quero alcançar até <span className="text-gray-400">(opcional)</span></label>
        <input type="date" className="input" value={form.prazo} onChange={e => setForm(p => ({...p, prazo:e.target.value}))} />
      </div>
      {form.prazo && (
        <div className="rounded-xl bg-marca-100 p-3 text-sm text-gray-700">
          {faltante <= 0 ? 'Essa meta já está atingida.' : meses > 0
            ? <>Para alcançar seu objetivo, reserve aproximadamente <strong className="text-marca">{formatCurrency(faltante / meses)} por mês</strong> durante {meses} {meses === 1 ? 'mês' : 'meses'}.</>
            : 'O prazo selecionado é este mês ou já passou. Escolha um mês futuro para calcular o aporte mensal.'}
          <p className="text-xs text-gray-500 mt-1">Estimativa sem considerar rendimentos ou inflação.</p>
        </div>
      )}
      <div>
        <label className="label">Cor da meta</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {CORES_PRESET.map(c => <button key={c} type="button" aria-label={`Selecionar cor ${c}`} aria-pressed={form.cor === c} onClick={() => setForm(p => ({...p, cor:c}))} className={`w-8 h-8 rounded-full border-2 transition-transform ${form.cor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`} style={{backgroundColor:c}} />)}
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
        <button type="submit" disabled={carregando || numero(form.valor_desejado) <= 0} className="btn-primary flex-1 flex justify-center items-center gap-2">{carregando ? <Loader2 size={16} className="animate-spin" /> : null} Salvar meta</button>
      </div>
    </form>
  )
}

// Aporte (tipo='aporte') ou retirada (tipo='retirada'). Valida valor e, na
// retirada, bloqueia retirar mais do que o acumulado. Retorna um delta assinado.
function FormMovimento({ meta, tipo, onSalvar, onCancelar, carregando }) {
  const [valor, setValor] = useState(0)
  const atual = numero(meta.valor_atual)
  const desejado = numero(meta.valor_desejado)
  const faltante = Math.max(0, desejado - atual)
  const ehAporte = tipo === 'aporte'
  const v = numero(valor)
  const invalido = v <= 0 || (ehAporte ? faltante <= 0 : v > atual)
  function enviar(e) {
    e.preventDefault()
    if (invalido) return
    onSalvar(ehAporte ? v : -v)
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      {ehAporte ? (
        <>
          <p className="text-sm text-gray-600">Acumule mais dinheiro na meta <strong>{meta.nome}</strong>. Atual: <strong>{formatCurrency(atual)}</strong>.</p>
          <p className="text-sm text-gray-500">Ainda faltam {formatCurrency(faltante)} para concluir.</p>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">Retire um valor guardado na meta <strong>{meta.nome}</strong>. Atual: <strong>{formatCurrency(atual)}</strong>.</p>
          <p className="text-sm text-gray-500">Você pode retirar até {formatCurrency(atual)}.</p>
        </>
      )}
      <div><label className="label">Valor {ehAporte ? 'do aporte' : 'da retirada'} (R$)</label><InputMoeda valor={valor} onChangeValor={setValor} className="input" autoFocus /></div>
      {!ehAporte && v > atual && <p className="text-xs text-red-600">A retirada não pode ser maior que o valor acumulado.</p>}
      <p className="text-xs text-gray-500">Esta operação atualiza apenas o acompanhamento da meta; não movimenta automaticamente seu saldo bancário, reserva ou investimentos.</p>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
        <button type="submit" disabled={carregando || invalido} className="btn-primary flex-1">{carregando ? 'Salvando...' : (ehAporte ? 'Registrar aporte' : 'Registrar retirada')}</button>
      </div>
    </form>
  )
}

// Painel "Ver detalhes" — leitura (sem histórico persistido de movimentações).
function DetalheMeta({ meta }) {
  const atual = numero(meta.valor_atual)
  const desejado = numero(meta.valor_desejado)
  const pct = progresso(atual, desejado)
  const faltante = Math.max(0, desejado - atual)
  const meses = calcularMesesRestantes(meta.prazo)
  const sugestao = sugestaoMensal(faltante, meses)
  const { Icone, label } = categoriaDaMeta(meta.nome)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${meta.cor || '#059669'}1A`}}><Icone size={22} style={{color:meta.cor || '#059669'}} /></div>
        <div><p className="font-semibold text-gray-900">{meta.nome}</p><p className="text-xs text-gray-500">{label}{meta.prazo ? ` · Prazo: ${formatDate(meta.prazo)}` : ''}</p></div>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:meta.cor || '#059669'}} /></div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Guardado</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(atual)}</dd>
        <dt className="text-gray-500">Objetivo</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(desejado)}</dd>
        <dt className="text-gray-500">Progresso</dt><dd className="text-right font-medium text-gray-900">{Math.round(pct)}%</dd>
        <dt className="text-gray-500">Falta</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(faltante)}</dd>
        {meta.prazo && <><dt className="text-gray-500">Prazo</dt><dd className="text-right font-medium text-gray-900">{formatDate(meta.prazo)}</dd></>}
        {sugestao != null && <><dt className="text-gray-500">Sugestão mensal</dt><dd className="text-right font-medium text-marca">{formatCurrency(sugestao)}/mês</dd></>}
      </dl>
      <p className="text-xs text-gray-400">O histórico detalhado de aportes e retiradas não é armazenado nesta versão.</p>
    </div>
  )
}

function Indicador({ titulo, valor, icone: Icone, cor }) {
  return (
    <div className="card !p-3 sm:!p-4 min-w-0">
      <div className="flex items-center gap-1.5 text-gray-500 mb-2"><Icone size={15} className={cor} /><span className="text-[11px] sm:text-xs">{titulo}</span></div>
      <p className={`font-bold text-sm sm:text-xl break-words ${cor}`}>{valor}</p>
    </div>
  )
}

export default function Metas() {
  const { metas, carregando, criar, atualizar, remover, ajustarValor } = useMetas()
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  // ── Totais com dados REAIS do usuário ──
  const totalDesejado = metas.reduce((s, m) => s + numero(m.valor_desejado), 0)
  const totalAcumulado = metas.reduce((s, m) => s + numero(m.valor_atual), 0)
  const metasAtivas = metas.filter(m => numero(m.valor_atual) < numero(m.valor_desejado)).length

  // Metas ativas com sugestão mensal calculável, para a seção de aportes.
  const sugestoes = metas
    .map(m => {
      const faltante = Math.max(0, numero(m.valor_desejado) - numero(m.valor_atual))
      const sugestao = sugestaoMensal(faltante, calcularMesesRestantes(m.prazo))
      return sugestao != null ? { meta: m, faltante, sugestao } : null
    })
    .filter(Boolean)

  async function salvarMeta(dados) {
    setSalvando(true); setErroAcao('')
    try {
      if (modal === 'nova') await criar(dados)
      else if (modal?.tipo === 'editar') await atualizar(modal.meta.id, dados)
      setModal(null)
    } catch (e) { setErroAcao(e?.message || 'Não foi possível salvar. Tente novamente.') }
    finally { setSalvando(false) }
  }
  async function salvarMovimento(delta) {
    setSalvando(true); setErroAcao('')
    try {
      await ajustarValor(modal.meta.id, delta)
      setModal(null)
    } catch (e) { setErroAcao(e?.message || 'Não foi possível registrar a operação.') }
    finally { setSalvando(false) }
  }
  async function excluir(id) {
    if (!window.confirm('Remover esta meta?')) return
    setRemovendo(id); setErroAcao('')
    try { await remover(id) }
    catch (e) { setErroAcao(e?.message || 'Não foi possível excluir a meta.') }
    finally { setRemovendo(null) }
  }

  return (
    <div className="space-y-5 pb-mobilenav md:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Metas financeiras</h1><p className="text-sm text-gray-500 mt-1">Planeje seus objetivos e acompanhe sua evolução.</p></div>
        <button type="button" onClick={() => setModal('nova')} className="btn-primary inline-flex gap-2 items-center text-sm flex-shrink-0"><Plus size={16} /> <span className="hidden sm:inline">Nova meta</span><span className="sm:hidden">Nova</span></button>
      </div>

      {erroAcao && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{erroAcao}</p>}

      {/* ── Resumo superior (3 cards, dados reais) ── */}
      {metas.length > 0 && <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Indicador titulo="Metas ativas" valor={String(metasAtivas)} icone={Target} cor="text-marca" />
        <Indicador titulo="Total guardado" valor={formatCurrency(totalAcumulado)} icone={PiggyBank} cor="text-gray-900" />
        <Indicador titulo="Objetivo total" valor={formatCurrency(totalDesejado)} icone={TrendingUp} cor="text-gray-900" />
      </div>}

      {carregando ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-marca" /></div>
      : metas.length === 0 ? (
        // ── Estado vazio convidativo (sem metas fictícias) ──
        <div className="card py-12 text-center">
          <Target size={38} className="text-marca mx-auto mb-3" />
          <h2 className="text-gray-900 font-semibold">Comece a planejar seus sonhos</h2>
          <p className="text-gray-600 text-sm mt-1 max-w-md mx-auto">Crie sua primeira meta e acompanhe o progresso. Alguns exemplos: reserva de emergência, uma viagem, a entrada de um carro ou um novo celular.</p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {[{t:'Reserva de emergência',I:Wallet},{t:'Viagem',I:Plane},{t:'Carro',I:Car},{t:'Eletrônicos',I:Smartphone}].map(({t,I}) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-full px-3 py-1.5"><I size={13} className="text-marca" />{t}</span>
            ))}
          </div>
          <button onClick={() => setModal('nova')} className="btn-primary mt-5 inline-flex items-center gap-2"><Plus size={16} /> Nova meta</button>
        </div>
      ) : (
        <>
          {/* ── Grade de metas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {metas.map(meta => {
              const atual = numero(meta.valor_atual)
              const desejado = numero(meta.valor_desejado)
              const pct = progresso(atual, desejado)
              const faltante = Math.max(0, desejado - atual)
              const meses = calcularMesesRestantes(meta.prazo)
              const sugestao = sugestaoMensal(faltante, meses)
              const concluida = desejado > 0 && atual >= desejado
              const { Icone, label } = categoriaDaMeta(meta.nome)
              return (
                <section key={meta.id} className="card !p-4 sm:!p-5 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-3 min-w-0 items-center">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${meta.cor || '#059669'}1A`}}><Icone size={22} style={{color:meta.cor || '#059669'}} /></div>
                      <div className="min-w-0">
                        <h2 className="font-semibold text-gray-900 break-words">{meta.nome}</h2>
                        <p className="text-xs text-gray-500">{label}{meta.prazo ? ` · Prazo: ${formatDate(meta.prazo)}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button type="button" title="Editar meta" aria-label="Editar meta" onClick={() => setModal({tipo:'editar',meta})} className="touch-target text-gray-500 hover:text-marca rounded-lg"><Pencil size={16}/></button>
                      <button type="button" title="Excluir meta" aria-label="Excluir meta" onClick={() => excluir(meta.id)} disabled={removendo === meta.id} className="touch-target text-gray-500 hover:text-red-600 rounded-lg">{removendo === meta.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div><p className="text-xs text-gray-500">Já guardado</p><p className="font-bold text-base sm:text-xl text-gray-900 break-words">{formatCurrency(atual)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-500">Objetivo</p><p className="font-bold text-base sm:text-xl text-gray-900 break-words">{formatCurrency(desejado)}</p></div>
                  </div>

                  <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3"><div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,backgroundColor:meta.cor || '#059669'}} /></div>
                  <div className="flex items-center justify-between gap-2 mt-2"><span className="text-xs text-gray-500">{Math.round(pct)}% concluído</span><span className="text-xs text-gray-500">Faltam {formatCurrency(faltante)}</span></div>

                  {concluida ? (
                    <div className="mt-4 bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2"><CheckCircle2 size={16}/> Meta atingida!</div>
                  ) : sugestao != null && (
                    <div className="mt-4 bg-gray-50 rounded-xl px-3 py-3 flex items-start gap-2">
                      <Calendar size={16} className="text-marca mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">Guarde <strong>{formatCurrency(sugestao)}/mês</strong> para alcançar sua meta em {meses} {meses === 1 ? 'mês' : 'meses'}.</p>
                        <p className="text-xs text-gray-500 mt-1">Estimativa sem rendimentos.</p>
                      </div>
                    </div>
                  )}

                  {/* Ações: Adicionar valor · Retirar · Ver detalhes */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <button type="button" onClick={() => setModal({tipo:'aporte',meta})} disabled={concluida} className="btn-primary flex justify-center items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Plus size={15}/> <span className="hidden sm:inline">Adicionar</span><span className="sm:hidden">+</span></button>
                    <button type="button" onClick={() => setModal({tipo:'retirada',meta})} disabled={atual <= 0} className="btn-secondary flex justify-center items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Minus size={15}/> Retirar</button>
                    <button type="button" onClick={() => setModal({tipo:'detalhes',meta})} className="btn-secondary flex justify-center items-center gap-1.5 text-sm"><Eye size={15}/> <span className="hidden sm:inline">Detalhes</span><span className="sm:hidden">Ver</span></button>
                  </div>
                </section>
              )
            })}
          </div>

          {/* ── Próximos aportes sugeridos (compacto) ── */}
          {sugestoes.length > 0 && (
            <section className="card !p-4 sm:!p-5">
              <div className="flex items-center gap-2 mb-3"><TrendingUp size={18} className="text-marca" /><h2 className="font-semibold text-gray-900">Próximos aportes sugeridos</h2></div>
              <p className="text-xs text-gray-500 mb-3">Valores estimados para manter o ritmo das metas com prazo. Nenhum lançamento é criado automaticamente.</p>
              <ul className="divide-y divide-gray-100">
                {sugestoes.map(({ meta, sugestao }) => {
                  const { Icone } = categoriaDaMeta(meta.nome)
                  return (
                    <li key={meta.id} className="flex items-center gap-3 py-2.5">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${meta.cor || '#059669'}1A`}}><Icone size={17} style={{color:meta.cor || '#059669'}} /></div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900 truncate">{meta.nome}</p><p className="text-xs text-gray-500">Sugestão: <strong className="text-marca">{formatCurrency(sugestao)}/mês</strong></p></div>
                      <button type="button" onClick={() => setModal({tipo:'aporte',meta})} className="btn-primary text-xs inline-flex items-center gap-1 flex-shrink-0 px-3 py-2"><Plus size={14}/> Adicionar</button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <p className="text-xs text-gray-500">Os valores das metas representam objetivos registrados e não são descontados automaticamente do saldo bancário, reserva ou investimentos.</p>

      <Modal aberto={modal === 'nova'} onFechar={() => setModal(null)} titulo="Nova meta"><FormMeta onSalvar={salvarMeta} onCancelar={() => setModal(null)} carregando={salvando}/></Modal>
      <Modal aberto={modal?.tipo === 'editar'} onFechar={() => setModal(null)} titulo="Editar meta">{modal?.tipo === 'editar' && <FormMeta meta={modal.meta} onSalvar={salvarMeta} onCancelar={() => setModal(null)} carregando={salvando}/>}</Modal>
      <Modal aberto={modal?.tipo === 'aporte'} onFechar={() => setModal(null)} titulo="Adicionar valor">{modal?.tipo === 'aporte' && <FormMovimento meta={modal.meta} tipo="aporte" onSalvar={salvarMovimento} onCancelar={() => setModal(null)} carregando={salvando}/>}</Modal>
      <Modal aberto={modal?.tipo === 'retirada'} onFechar={() => setModal(null)} titulo="Retirar valor">{modal?.tipo === 'retirada' && <FormMovimento meta={modal.meta} tipo="retirada" onSalvar={salvarMovimento} onCancelar={() => setModal(null)} carregando={salvando}/>}</Modal>
      <Modal aberto={modal?.tipo === 'detalhes'} onFechar={() => setModal(null)} titulo="Detalhes da meta">{modal?.tipo === 'detalhes' && <DetalheMeta meta={modal.meta} />}</Modal>
    </div>
  )
}
