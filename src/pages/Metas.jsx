import React, { useState } from 'react'
import {
  Target, Plus, Minus, Calendar, TrendingUp, Trash2, Loader2, Pencil, CheckCircle2,
  PiggyBank, Eye, Wallet, Home, Plane, Car, GraduationCap, Heart, Smartphone, Gift,
} from 'lucide-react'
import { useMetas } from '../hooks/useMetas'
import { useInvestimentos, labelCategoriaInvestimento } from '../hooks/useInvestimentos'
import { useMetaInvestimentos } from '../hooks/useMetaInvestimentos'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate } from '../lib/utils'
import { Link2, AlertTriangle } from 'lucide-react'

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

// Painel "Ver detalhes" — mostra guardado manual, vinculado a investimentos,
// progresso TOTAL (sem duplicar) e a lista de vínculos com ações.
function DetalheMeta({ meta, investimentos, inv, onVincular, onEditarVinculo, onDesvincular }) {
  const manual = numero(meta.valor_atual)
  const desejado = numero(meta.valor_desejado)
  const vinculado = inv.totalVinculadoMeta(meta.id)
  // Progresso total = guardado manual + vinculado a investimentos (recortes do
  // valor_atual das posições — não duplicam patrimônio nem viram aporte).
  const totalMeta = manual + vinculado
  const pct = progresso(totalMeta, desejado)
  const faltante = Math.max(0, desejado - totalMeta)
  const meses = calcularMesesRestantes(meta.prazo)
  const sugestao = sugestaoMensal(faltante, meses)
  const { Icone, label } = categoriaDaMeta(meta.nome)
  const vinculos = inv.vinculosDaMeta(meta.id)
  const mapaInv = new Map((investimentos || []).map(i => [i.id, i]))
  // Inconsistências nos investimentos usados por esta meta (saldo reduzido depois).
  const invsDaMeta = vinculos.map(v => mapaInv.get(v.investimento_id)).filter(Boolean)
  const inconsistentes = inv.inconsistencias(invsDaMeta)
  const idsInconsistentes = new Set(inconsistentes.map(x => x.investimento.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{backgroundColor:`${meta.cor || '#059669'}1A`}}><Icone size={22} style={{color:meta.cor || '#059669'}} /></div>
        <div><p className="font-semibold text-gray-900">{meta.nome}</p><p className="text-xs text-gray-500">{label}{meta.prazo ? ` · Prazo: ${formatDate(meta.prazo)}` : ''}</p></div>
      </div>

      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:meta.cor || '#059669'}} /></div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Guardado manual</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(manual)}</dd>
        <dt className="text-gray-500">Vinculado a investimentos</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(vinculado)}</dd>
        <dt className="text-gray-500">Progresso total</dt><dd className="text-right font-semibold text-gray-900">{formatCurrency(totalMeta)} · {Math.round(pct)}%</dd>
        <dt className="text-gray-500">Objetivo</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(desejado)}</dd>
        <dt className="text-gray-500">Falta</dt><dd className="text-right font-medium text-gray-900">{formatCurrency(faltante)}</dd>
        {sugestao != null && <><dt className="text-gray-500">Sugestão mensal</dt><dd className="text-right font-medium text-marca">{formatCurrency(sugestao)}/mês</dd></>}
      </dl>

      {/* Investimentos vinculados */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Link2 size={15} className="text-marca" /> Investimentos vinculados</h3>
          {!inv.indisponivel && (
            <button type="button" onClick={onVincular} className="btn-secondary text-xs inline-flex items-center gap-1 px-2.5 py-1.5"><Plus size={13}/> Vincular</button>
          )}
        </div>

        {inv.indisponivel ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2.5">A vinculação com investimentos requer a migração do banco (2026-10_metas_investimentos.sql). Aplique-a no Supabase para ativar este recurso.</p>
        ) : vinculos.length === 0 ? (
          <p className="text-xs text-gray-500">Nenhum investimento vinculado. Use “Vincular” para destinar parte de um investimento a esta meta (não movimenta dinheiro).</p>
        ) : (
          <ul className="space-y-2">
            {vinculos.map(v => {
              const i = mapaInv.get(v.investimento_id)
              const nome = i?.nome || 'Investimento'
              const cat = i ? labelCategoriaInvestimento(i.categoria) : ''
              const problema = idsInconsistentes.has(v.investimento_id)
              return (
                <li key={v.id} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                    <p className="text-xs text-gray-500">{cat}{i ? ` · Saldo atual ${formatCurrency(numero(i.valor_atual))}` : ' · investimento removido'}</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 flex-shrink-0">{formatCurrency(numero(v.valor_alocado))}</span>
                  <button type="button" title="Editar valor" aria-label="Editar valor vinculado" onClick={() => onEditarVinculo(v, i)} disabled={!i} className="touch-target text-gray-500 hover:text-marca rounded-lg disabled:opacity-40"><Pencil size={15}/></button>
                  <button type="button" title="Desvincular" aria-label="Desvincular investimento" onClick={() => onDesvincular(v)} className="touch-target text-gray-500 hover:text-red-600 rounded-lg"><Trash2 size={15}/></button>
                  {problema && <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" title="Alocação acima do saldo disponível" />}
                </li>
              )
            })}
          </ul>
        )}

        {inconsistentes.length > 0 && (
          <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg p-2.5 flex items-start gap-2">
            <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Um ou mais investimentos tiveram o saldo reduzido abaixo do valor vinculado. Ajuste o valor alocado ou desvincule para corrigir — nada foi alterado automaticamente.</span>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400">Vincular um investimento apenas destina parte do saldo dele a esta meta. Não é um aporte manual, não movimenta saldo, reserva ou patrimônio.</p>
    </div>
  )
}

// Formulário de vínculo (criar ou editar). Mostra o disponível do investimento
// e bloqueia valores acima dele (a validação forte está no banco via trigger).
function FormVinculo({ meta, investimentos, inv, vinculoEditar, onSalvar, onCancelar, carregando }) {
  const jaVinculados = new Set(inv.vinculosDaMeta(meta.id).map(v => v.investimento_id))
  const editando = !!vinculoEditar
  const [investimentoId, setInvestimentoId] = useState(vinculoEditar?.investimento_id || '')
  const [valor, setValor] = useState(vinculoEditar ? numero(vinculoEditar.valor_alocado) : 0)

  // Opções: no modo criar, só investimentos ainda não vinculados a esta meta.
  const opcoes = (investimentos || []).filter(i => editando ? i.id === investimentoId : !jaVinculados.has(i.id))
  const invSel = (investimentos || []).find(i => i.id === investimentoId) || null
  const disponivel = invSel ? inv.disponivelInvestimento(invSel, vinculoEditar?.id || null) : 0
  const v = numero(valor)
  const invalido = !investimentoId || v <= 0 || v > disponivel + 0.001

  function enviar(e) {
    e.preventDefault()
    if (invalido) return
    onSalvar({ investimento_id: investimentoId, valor_alocado: v })
  }

  if (!editando && opcoes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Não há investimentos disponíveis para vincular a esta meta. Cadastre um investimento ou ajuste os vínculos existentes.</p>
        <button type="button" className="btn-secondary w-full" onClick={onCancelar}>Fechar</button>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div>
        <label className="label">Investimento</label>
        <select className="input" value={investimentoId} disabled={editando} onChange={e => { setInvestimentoId(e.target.value); setValor(0) }} required>
          <option value="">Selecione...</option>
          {opcoes.map(i => <option key={i.id} value={i.id}>{i.nome} — {labelCategoriaInvestimento(i.categoria)}</option>)}
        </select>
      </div>
      {invSel && (
        <div className="rounded-xl bg-marca-100 p-3 text-sm text-gray-700">
          Saldo disponível para alocar: <strong className="text-marca">{formatCurrency(disponivel)}</strong>
          <p className="text-xs text-gray-500 mt-1">Já descontados a reserva e outras metas vinculadas a este investimento.</p>
        </div>
      )}
      <div>
        <label className="label">Valor a vincular (R$)</label>
        <InputMoeda valor={valor} onChangeValor={setValor} className="input" autoFocus />
        {invSel && v > disponivel + 0.001 && <p className="text-xs text-red-600 mt-1">O valor excede o saldo disponível deste investimento.</p>}
      </div>
      <p className="text-xs text-gray-500">O vínculo é apenas um recorte informativo do investimento para esta meta. Não movimenta saldo, reserva nem gera aporte.</p>
      <div className="flex gap-3">
        <button type="button" className="btn-secondary flex-1" onClick={onCancelar}>Cancelar</button>
        <button type="submit" disabled={carregando || invalido} className="btn-primary flex-1">{carregando ? 'Salvando...' : (editando ? 'Salvar valor' : 'Vincular')}</button>
      </div>
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
  const { metas, carregando, criar, atualizar, remover, ajustarValor } = useMetas()
  const { investimentos } = useInvestimentos()
  const inv = useMetaInvestimentos()
  const [modal, setModal] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [erroAcao, setErroAcao] = useState('')

  // Total da meta = guardado manual + vinculado a investimentos (sem duplicar).
  const totalDaMeta = (m) => numero(m.valor_atual) + inv.totalVinculadoMeta(m.id)

  // ── Totais com dados REAIS do usuário ──
  const totalDesejado = metas.reduce((s, m) => s + numero(m.valor_desejado), 0)
  const totalAcumulado = metas.reduce((s, m) => s + totalDaMeta(m), 0)
  const metasAtivas = metas.filter(m => totalDaMeta(m) < numero(m.valor_desejado)).length

  // Metas ativas com sugestão mensal calculável, para a seção de aportes.
  const sugestoes = metas
    .map(m => {
      const faltante = Math.max(0, numero(m.valor_desejado) - totalDaMeta(m))
      const sugestao = sugestaoMensal(faltante, calcularMesesRestantes(m.prazo))
      return sugestao != null ? { meta: m, faltante, sugestao } : null
    })
    .filter(Boolean)

  async function salvarVinculo(dados) {
    setSalvando(true); setErroAcao('')
    try {
      if (modal?.vinculoEditar) await inv.editarValor(modal.vinculoEditar.id, dados.valor_alocado)
      else await inv.vincular({ meta_id: modal.meta.id, investimento_id: dados.investimento_id, valor_alocado: dados.valor_alocado })
      setModal({ tipo: 'detalhes', meta: modal.meta })
    } catch (e) { setErroAcao(e?.message || 'Não foi possível salvar o vínculo.') }
    finally { setSalvando(false) }
  }
  async function desvincular(v) {
    if (!window.confirm('Desvincular este investimento da meta? O investimento não é alterado.')) return
    setErroAcao('')
    try { await inv.desvincular(v.id) }
    catch (e) { setErroAcao(e?.message || 'Não foi possível desvincular.') }
  }

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
              const manual = numero(meta.valor_atual)
              const vinculado = inv.totalVinculadoMeta(meta.id)
              const atual = manual + vinculado // progresso total (sem duplicar)
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
                    <div>
                      <p className="text-xs text-gray-500">Já guardado</p>
                      <p className="font-bold text-base sm:text-xl text-gray-900 break-words">{formatCurrency(atual)}</p>
                      {vinculado > 0 && <p className="text-[11px] text-gray-500 mt-0.5">{formatCurrency(manual)} manual + {formatCurrency(vinculado)} investido</p>}
                    </div>
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
                    <button type="button" onClick={() => setModal({tipo:'retirada',meta})} disabled={manual <= 0} className="btn-secondary flex justify-center items-center gap-1.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><Minus size={15}/> Retirar</button>
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
      <Modal aberto={modal?.tipo === 'detalhes'} onFechar={() => setModal(null)} titulo="Detalhes da meta">
        {modal?.tipo === 'detalhes' && (
          <DetalheMeta
            meta={modal.meta}
            investimentos={investimentos}
            inv={inv}
            onVincular={() => setModal({ tipo: 'vincular', meta: modal.meta })}
            onEditarVinculo={(vinculo) => setModal({ tipo: 'vincular', meta: modal.meta, vinculoEditar: vinculo })}
            onDesvincular={desvincular}
          />
        )}
      </Modal>
      <Modal aberto={modal?.tipo === 'vincular'} onFechar={() => setModal({ tipo: 'detalhes', meta: modal?.meta })} titulo={modal?.vinculoEditar ? 'Editar valor vinculado' : 'Vincular investimento'}>
        {modal?.tipo === 'vincular' && (
          <FormVinculo
            meta={modal.meta}
            investimentos={investimentos}
            inv={inv}
            vinculoEditar={modal.vinculoEditar}
            onSalvar={salvarVinculo}
            onCancelar={() => setModal({ tipo: 'detalhes', meta: modal.meta })}
            carregando={salvando}
          />
        )}
      </Modal>
    </div>
  )
}
