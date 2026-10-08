import React, { useState, useEffect } from 'react'
import { Loader2, Plus, Pencil, Trash2, MessageCircle, CalendarClock } from 'lucide-react'
import { useAgendamentos } from '../../hooks/useConsultoria'
import Modal from '../../components/Modal'
import { mascararTelefone, somenteDigitosTelefone, linkWhatsApp, hojeISO as hojeISOBrasil } from '../../lib/utils'

const STATUS = {
  agendado:  { label: 'Agendado',  classe: 'bg-indigo-50 text-indigo-700' },
  concluido: { label: 'Concluído', classe: 'bg-emerald-50 text-emerald-700' },
  cancelado: { label: 'Cancelado', classe: 'bg-gray-100 text-gray-500' },
}

function fmtDataExtenso(dataISO) {
  if (!dataISO) return ''
  return new Date(dataISO + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })
}
const hojeISO = () => hojeISOBrasil()

// Formulário de agendamento (criar/editar).
function FormAgendamento({ inicial, onSalvar, onCancelar, salvando }) {
  const [form, setForm] = useState({
    nome: inicial?.nome ?? '',
    whatsapp: inicial?.whatsapp ?? '',
    data: inicial?.data ?? hojeISO(),
    horario: inicial?.horario ?? '09:00',
    observacoes: inicial?.observacoes ?? '',
    status: inicial?.status ?? 'agendado',
  })
  const [erro, setErro] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('Informe o nome do cliente.'); return }
    if (!form.data) { setErro('Informe a data.'); return }
    if (!form.horario) { setErro('Informe o horário.'); return }
    onSalvar({
      ...form,
      nome: form.nome.trim(),
      whatsapp: somenteDigitosTelefone(form.whatsapp) || null,
      interesse_id: inicial?.interesse_id ?? null,
      cliente_id: inicial?.cliente_id ?? null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Cliente</label>
        <input className="input" value={form.nome}
          onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do cliente" />
      </div>
      <div>
        <label className="label">WhatsApp</label>
        <input className="input" inputMode="numeric" value={mascararTelefone(form.whatsapp)}
          onChange={(e) => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data</label>
          <input type="date" className="input" value={form.data}
            onChange={(e) => setForm(p => ({ ...p, data: e.target.value }))} />
        </div>
        <div>
          <label className="label">Horário</label>
          <input type="time" className="input" value={form.horario}
            onChange={(e) => setForm(p => ({ ...p, horario: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input" value={form.status}
          onChange={(e) => setForm(p => ({ ...p, status: e.target.value }))}>
          <option value="agendado">Agendado</option>
          <option value="concluido">Concluído</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>
      <div>
        <label className="label">Observações <span className="text-gray-400">(opcional)</span></label>
        <textarea className="input" rows={3} value={form.observacoes}
          onChange={(e) => setForm(p => ({ ...p, observacoes: e.target.value }))}
          placeholder="Anotações sobre o atendimento" />
      </div>
      {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar agendamento'}
        </button>
      </div>
    </form>
  )
}

// interesseParaAgendar: quando vem da aba Consultorias, abre o modal já
// preenchido com os dados do cliente. onConsumido avisa o pai para limpar.
export default function AdminAgenda({ interesseParaAgendar, onConsumido }) {
  const { agendamentos, carregando, erro, criarAgendamento, atualizarAgendamento, removerAgendamento } = useAgendamentos()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  // Abre o modal pré-preenchido quando um interesse é enviado para agendar.
  useEffect(() => {
    if (interesseParaAgendar) {
      setEditando({
        nome: interesseParaAgendar.nome,
        whatsapp: interesseParaAgendar.whatsapp,
        interesse_id: interesseParaAgendar.id,
        cliente_id: interesseParaAgendar.usuario_id,
        data: hojeISO(), horario: '09:00', status: 'agendado', observacoes: '',
      })
      setModalAberto(true)
      onConsumido?.()
    }
  }, [interesseParaAgendar, onConsumido])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEdicao(a) { setEditando(a); setModalAberto(true) }
  function fechar() { setModalAberto(false); setEditando(null) }

  async function salvar(dados) {
    setSalvando(true); setErroAcao('')
    try {
      if (editando?.id) await atualizarAgendamento(editando.id, dados)
      else await criarAgendamento(dados)
      fechar()
    } catch {
      setErroAcao('Não foi possível salvar o agendamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function remover(id) {
    if (!confirm('Remover este agendamento?')) return
    try { await removerAgendamento(id) } catch { setErroAcao('Erro ao remover.') }
  }

  if (carregando) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
  }
  if (erro) {
    return <div className="card text-sm text-red-600">Não foi possível carregar a agenda: {erro}</div>
  }

  const hoje = hojeISO()
  const proximos = agendamentos.filter(a => a.data >= hoje && a.status !== 'cancelado')
  const passados = agendamentos.filter(a => a.data < hoje || a.status === 'cancelado')

  function Linha({ a }) {
    return (
      <div className="rounded-xl border border-gray-100 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{a.nome}</p>
            <p className="text-xs text-gray-500 capitalize">{fmtDataExtenso(a.data)} • {a.horario?.slice(0, 5)}</p>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS[a.status]?.classe || ''}`}>
            {STATUS[a.status]?.label || a.status}
          </span>
        </div>
        {a.observacoes && <p className="text-xs text-gray-500 mt-2 break-words">{a.observacoes}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {a.whatsapp && (
            <a href={linkWhatsApp(a.whatsapp)} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg">
              <MessageCircle size={13} /> WhatsApp
            </a>
          )}
          <button onClick={() => abrirEdicao(a)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg">
            <Pencil size={13} /> Editar
          </button>
          <button onClick={() => remover(a.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg">
            <Trash2 size={13} /> Remover
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-gray-900">Agenda</h2>
        <button onClick={abrirNovo} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Novo agendamento
        </button>
      </div>

      {erroAcao && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>}

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <CalendarClock size={18} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Próximos agendamentos ({proximos.length})</h3>
        </div>
        {proximos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum agendamento futuro.</p>
        ) : (
          <div className="space-y-3">{proximos.map(a => <Linha key={a.id} a={a} />)}</div>
        )}
      </div>

      {passados.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">Anteriores / cancelados ({passados.length})</h3>
          <div className="space-y-3">{passados.map(a => <Linha key={a.id} a={a} />)}</div>
        </div>
      )}

      <Modal aberto={modalAberto} onFechar={fechar} titulo={editando?.id ? 'Editar agendamento' : 'Novo agendamento'}>
        <FormAgendamento
          key={editando?.id || 'novo'}
          inicial={editando}
          onSalvar={salvar}
          onCancelar={fechar}
          salvando={salvando}
        />
      </Modal>
    </div>
  )
}
