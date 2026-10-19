import React, { useState } from 'react'
import { Target, Plus, Calendar, TrendingUp, Trash2, Loader2, Pencil, CheckCircle2, PiggyBank } from 'lucide-react'
import { useMetas } from '../hooks/useMetas'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate } from '../lib/utils'

const CORES_PRESET = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#dc2626', '#0891b2', '#be185d']
const numero = value => Number(value) || 0
const progresso = (atual, objetivo) => objetivo > 0 ? Math.min(100, Math.max(0, atual / objetivo * 100)) : 0

// Mantém a lógica de prazo mensal usada anteriormente, mas interpreta a data em horário local.
function calcularMesesRestantes(prazo) {
  if (!prazo) return 0
  const partes = String(prazo).split('-').map(Number)
  if (partes.length !== 3 || partes.some(n => !Number.isFinite(n))) return 0
  const hoje = new Date()
  return Math.max(0, (partes[0] - hoje.getFullYear()) * 12 + (partes[1] - 1 - hoje.getMonth()))
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

function FormAporte({ meta, onSalvar, onCancelar, carregando }) {
  const [valor, setValor] = useState(0)
  const faltante = Math.max(0, numero(meta.valor_desejado) - numero(meta.valor_atual))
  function enviar(e) {
    e.preventDefault()
    if (numero(valor) <= 0) return
    // Mantém a regra anterior: o valor acumulado não ultrapassa o objetivo.
    onSalvar({valor_atual: Math.min(numero(meta.valor_desejado), numero(meta.valor_atual) + numero(valor))})
  }
  return (
    <form onSubmit={enviar} className="space-y-4">
      <p className="text-sm text-gray-600">Acumule mais dinheiro na meta <strong>{meta.nome}</strong>. Atual: <strong>{formatCurrency(meta.valor_atual)}</strong>.</p>
      <p className="text-sm text-gray-500">Ainda faltam {formatCurrency(faltante)} para concluir.</p>
      <div><label className="label">Valor do aporte (R$)</label><InputMoeda valor={valor} onChangeValor={setValor} className="input" autoFocus /></div>
      <p className="text-xs text-gray-500">O aporte atualiza o acompanhamento desta meta; não movimenta automaticamente seu saldo bancário.</p>
      <div className="flex gap-3"><button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button><button type="submit" disabled={carregando || numero(valor) <= 0 || faltante <= 0} className="btn-primary flex-1">{carregando ? 'Salvando...' : 'Registrar aporte'}</button></div>
    </form>
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
  const {metas, carregando, criar, atualizar, remover} = useMetas()
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const totalDesejado = metas.reduce((s,m) => s + numero(m.valor_desejado), 0)
  const totalAcumulado = metas.reduce((s,m) => s + numero(m.valor_atual), 0)
  const pctTotal = progresso(totalAcumulado,totalDesejado)

  async function salvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      if (modal === 'nova') await criar(dados)
      else if (modal?.tipo === 'editar' || modal?.tipo === 'aporte') await atualizar(modal.meta.id, dados)
      setModal(null)
    } catch (e) {
      setErroAcao(e?.message || 'Não foi possível salvar. Tente novamente.')
    } finally {setSalvando(false)}
  }
  async function excluir(id) {
    if (!window.confirm('Remover esta meta?')) return
    setRemovendo(id)
    setErroAcao('')
    try { await remover(id) }
    catch (e) { setErroAcao(e?.message || 'Não foi possível excluir a meta.') }
    finally {setRemovendo(null)}
  }

  return (
    <div className="space-y-5 pb-mobilenav md:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Metas financeiras</h1><p className="text-sm text-gray-500 mt-1">Planeje seus objetivos e acompanhe sua evolução.</p></div>
        <button type="button" onClick={() => setModal('nova')} className="btn-primary inline-flex gap-2 items-center text-sm flex-shrink-0"><Plus size={16} /> <span className="hidden sm:inline">Nova meta</span><span className="sm:hidden">Nova</span></button>
      </div>
      {erroAcao && <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-xl p-3">{erroAcao}</p>}
      {metas.length > 0 && <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Indicador titulo="Acumulado" valor={formatCurrency(totalAcumulado)} icone={PiggyBank} cor="text-marca" />
        <Indicador titulo="Planejado" valor={formatCurrency(totalDesejado)} icone={Target} cor="text-gray-900" />
        <Indicador titulo="Progresso" valor={`${Math.round(pctTotal)}%`} icone={TrendingUp} cor="text-marca" />
      </div>}
      {carregando ? <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-marca" /></div>
      : metas.length === 0 ? <div className="card py-12 text-center"><Target size={38} className="text-marca mx-auto mb-3" /><p className="text-gray-600 text-sm">Você ainda não criou nenhuma meta.</p><button onClick={() => setModal('nova')} className="btn-primary mt-4">Criar primeira meta</button></div>
      : <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {metas.map(meta => {
          const atual = numero(meta.valor_atual)
          const desejado = numero(meta.valor_desejado)
          const pct = progresso(atual,desejado)
          const faltante = Math.max(0,desejado-atual)
          const meses = calcularMesesRestantes(meta.prazo)
          const concluida = desejado > 0 && atual >= desejado
          return <section key={meta.id} className="card !p-4 sm:!p-5 min-w-0">
            <div className="flex justify-between items-start gap-3">
              <div className="flex gap-3 min-w-0 items-center">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${meta.cor || '#059669'}1A`}}><Target size={22} style={{color:meta.cor || '#059669'}} /></div>
                <div className="min-w-0"><h2 className="font-semibold text-gray-900 break-words">{meta.nome}</h2><p className="text-xs text-gray-500">{meta.prazo ? `Prazo: ${formatDate(meta.prazo)}` : 'Sem prazo definido'}</p></div>
              </div>
              <div className="flex gap-1 flex-shrink-0"><button type="button" title="Editar meta" aria-label="Editar meta" onClick={() => setModal({tipo:'editar',meta})} className="touch-target text-gray-500 hover:text-marca rounded-lg"><Pencil size={16}/></button><button type="button" title="Excluir meta" aria-label="Excluir meta" onClick={() => excluir(meta.id)} disabled={removendo === meta.id} className="touch-target text-gray-500 hover:text-red-600 rounded-lg">{removendo === meta.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}</button></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4"><div><p className="text-xs text-gray-500">Já acumulado</p><p className="font-bold text-base sm:text-xl text-gray-900 break-words">{formatCurrency(atual)}</p></div><div className="text-right"><p className="text-xs text-gray-500">Objetivo</p><p className="font-bold text-base sm:text-xl text-gray-900 break-words">{formatCurrency(desejado)}</p></div></div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3"><div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`,backgroundColor:meta.cor || '#059669'}} /></div>
            <div className="flex items-center justify-between gap-2 mt-2"><span className="text-xs text-gray-500">{Math.round(pct)}% concluído</span><span className="text-xs text-gray-500">Faltam {formatCurrency(faltante)}</span></div>
            {concluida ? <div className="mt-4 bg-green-50 text-green-700 rounded-lg px-3 py-2 text-sm flex items-center gap-2"><CheckCircle2 size={16}/> Meta atingida!</div>
              : <>
                {meta.prazo && <div className="mt-4 bg-gray-50 rounded-xl px-3 py-3 flex items-start gap-2"><Calendar size={16} className="text-marca mt-0.5 flex-shrink-0" /><div><p className="text-sm text-gray-700">{meses > 0 ? <>Guarde <strong>{formatCurrency(faltante / meses)}/mês</strong> para alcançar sua meta.</> : 'Prazo neste mês ou vencido. Edite a data para recalcular.'}</p><p className="text-xs text-gray-500 mt-1">Estimativa sem rendimentos.</p></div></div>}
                <button type="button" onClick={() => setModal({tipo:'aporte',meta})} className="btn-primary w-full flex justify-center items-center gap-2 mt-4"><Plus size={16}/> Registrar aporte</button>
              </>}
          </section>
        })}
      </div>}
      <p className="text-xs text-gray-500">Os valores das metas representam objetivos registrados e não são descontados automaticamente do saldo bancário.</p>
      <Modal aberto={modal === 'nova'} onFechar={() => setModal(null)} titulo="Nova meta"><FormMeta onSalvar={salvar} onCancelar={() => setModal(null)} carregando={salvando}/></Modal>
      <Modal aberto={modal?.tipo === 'editar'} onFechar={() => setModal(null)} titulo="Editar meta">{modal?.tipo === 'editar' && <FormMeta meta={modal.meta} onSalvar={salvar} onCancelar={() => setModal(null)} carregando={salvando}/>}</Modal>
      <Modal aberto={modal?.tipo === 'aporte'} onFechar={() => setModal(null)} titulo="Registrar aporte">{modal?.tipo === 'aporte' && <FormAporte meta={modal.meta} onSalvar={salvar} onCancelar={() => setModal(null)} carregando={salvando}/>}</Modal>
    </div>
  )
}
