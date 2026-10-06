import React, { useState } from 'react'
import { MessageCircle, Loader2, CalendarPlus } from 'lucide-react'
import { mascararTelefone, linkWhatsApp } from '../../lib/utils'

// Rótulos e cores de cada status do interesse (discreto, sem excesso de cor).
const STATUS = {
  novo:      { label: 'Novo interesse', classe: 'bg-blue-50 text-blue-700' },
  contatado: { label: 'Contatado',      classe: 'bg-amber-50 text-amber-700' },
  agendado:  { label: 'Agendado',       classe: 'bg-indigo-50 text-indigo-700' },
  concluido: { label: 'Concluído',      classe: 'bg-emerald-50 text-emerald-700' },
  cancelado: { label: 'Cancelado',      classe: 'bg-gray-100 text-gray-500' },
}
const ORDEM_STATUS = ['novo', 'contatado', 'agendado', 'concluido', 'cancelado']

function fmtDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Seletor de status reutilizável.
function SeletorStatus({ valor, onChange, disabled }) {
  return (
    <select
      value={valor} disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {ORDEM_STATUS.map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
    </select>
  )
}

// Recebe a FONTE ÚNICA de interesses do componente Admin (via props), para que
// o badge de "novas solicitações" e esta lista compartilhem o mesmo estado —
// mudar o status aqui reflete no indicador imediatamente.
// onAgendar(interesse): abre o fluxo de criar agendamento (na aba Agenda).
export default function AdminConsultorias({ interesses = [], carregando, atualizarStatus, onAgendar }) {
  const [salvandoId, setSalvandoId] = useState(null)

  async function mudarStatus(id, status) {
    setSalvandoId(id)
    try { await atualizarStatus(id, status) } finally { setSalvandoId(null) }
  }

  if (carregando) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        Clientes interessados ({interesses.length})
      </h2>

      {interesses.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum interesse registrado ainda.</p>
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Nome</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-500">WhatsApp</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Solicitação</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Status</th>
                  <th className="pb-2 text-xs font-medium text-gray-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {interesses.map(i => (
                  <tr key={i.id} className={i.status === 'novo' ? 'bg-red-50/40' : ''}>
                    <td className="py-2.5 pr-4 text-gray-800">
                      {i.status === 'novo' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 align-middle" aria-label="Novo" />}
                      {i.nome}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{mascararTelefone(i.whatsapp)}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{fmtDataHora(i.criado_em)}</td>
                    <td className="py-2.5 pr-4">
                      <SeletorStatus valor={i.status} disabled={salvandoId === i.id}
                        onChange={(s) => mudarStatus(i.id, s)} />
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      <a href={linkWhatsApp(i.whatsapp)} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg transition-colors">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      {onAgendar && (
                        <button onClick={() => onAgendar(i)}
                          className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors">
                          <CalendarPlus size={13} /> Agendar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-3">
            {interesses.map(i => (
              <div key={i.id} className={`rounded-xl border p-3 ${i.status === 'novo' ? 'border-red-200 bg-red-50/40' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {i.status === 'novo' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 align-middle" aria-label="Novo" />}
                      {i.nome}
                    </p>
                    <p className="text-xs text-gray-500">{mascararTelefone(i.whatsapp)}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS[i.status]?.classe || ''}`}>
                    {STATUS[i.status]?.label || i.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Solicitado em {fmtDataHora(i.criado_em)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <SeletorStatus valor={i.status} disabled={salvandoId === i.id}
                    onChange={(s) => mudarStatus(i.id, s)} />
                  <a href={linkWhatsApp(i.whatsapp)} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1.5 rounded-lg">
                    <MessageCircle size={13} /> Chamar no WhatsApp
                  </a>
                  {onAgendar && (
                    <button onClick={() => onAgendar(i)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg">
                      <CalendarPlus size={13} /> Agendar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
