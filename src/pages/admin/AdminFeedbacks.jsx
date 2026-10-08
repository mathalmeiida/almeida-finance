import React, { useState, useEffect } from 'react'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

// Tipos e status com rótulos/cores discretos (sem excesso de cor).
const TIPO = {
  sugestao: { label: 'Sugestão', classe: 'bg-blue-50 text-blue-700' },
  duvida:   { label: 'Dúvida',   classe: 'bg-violet-50 text-violet-700' },
  problema: { label: 'Problema', classe: 'bg-red-50 text-red-700' },
}
const STATUS = {
  novo:        { label: 'Novo',       classe: 'bg-blue-50 text-blue-700' },
  em_analise:  { label: 'Em análise', classe: 'bg-amber-50 text-amber-700' },
  resolvido:   { label: 'Resolvido',  classe: 'bg-emerald-50 text-emerald-700' },
  arquivado:   { label: 'Arquivado',  classe: 'bg-gray-100 text-gray-500' },
}
const ORDEM_STATUS = ['novo', 'em_analise', 'resolvido', 'arquivado']

function fmtDataHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

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

// Recebe a FONTE ÚNICA de feedbacks do componente Admin (via props), para o
// badge de "novos" e esta lista compartilharem o mesmo estado.
export default function AdminFeedbacks({ feedbacks = [], carregando, atualizarStatus }) {
  const [salvandoId, setSalvandoId] = useState(null)
  const [nomes, setNomes] = useState({}) // usuario_id → nome/email

  // Busca o nome/email dos autores dos feedbacks (a tabela guarda só o id).
  useEffect(() => {
    let vivo = true
    async function buscarNomes() {
      const ids = [...new Set(feedbacks.map(f => f.usuario_id))]
      if (ids.length === 0) return
      const { data } = await supabase.from('perfis').select('id, nome, email').in('id', ids)
      if (vivo && data) {
        const mapa = {}
        for (const p of data) mapa[p.id] = p.nome || p.email || 'Usuário'
        setNomes(mapa)
      }
    }
    buscarNomes()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedbacks.length])

  async function mudarStatus(id, status) {
    setSalvandoId(id)
    try { await atualizarStatus(id, status) } finally { setSalvandoId(null) }
  }

  if (carregando) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
  }

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <MessageSquarePlus size={18} className="text-blue-600 flex-shrink-0" />
        Feedbacks ({feedbacks.length})
      </h2>

      {feedbacks.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum feedback recebido ainda.</p>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(f => {
            const novo = f.status === 'novo'
            return (
              <div key={f.id} className={`rounded-xl border p-3 ${novo ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate flex items-center gap-2">
                      {novo && <span className="inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" aria-label="Novo" />}
                      <span className="truncate">{nomes[f.usuario_id] || 'Usuário'}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">{fmtDataHora(f.criado_em)}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${TIPO[f.tipo]?.classe || ''}`}>
                    {TIPO[f.tipo]?.label || f.tipo}
                  </span>
                </div>

                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap break-words">{f.mensagem}</p>

                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Status:</span>
                  <SeletorStatus valor={f.status} disabled={salvandoId === f.id}
                    onChange={(s) => mudarStatus(f.id, s)} />
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS[f.status]?.classe || ''}`}>
                    {STATUS[f.status]?.label || f.status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
