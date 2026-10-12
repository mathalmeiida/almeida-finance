import React, { useState, useMemo } from 'react'
import { CalendarPlus, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useParcelamentos } from '../hooks/useParcelamentos'
import { formatCurrency, hojeISO } from '../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Ação OPCIONAL compartilhada pelos simuladores de financiamento (imóvel e
// automóvel). Converte uma simulação em um PARCELAMENTO real no planejamento,
// SOMENTE após confirmação explícita do usuário.
//
// Preserva o caráter de "ferramenta de planejamento": nada é registrado
// automaticamente. Antes de criar, verifica se já existe um parcelamento com a
// mesma descrição e valor total aproximado (guarda contra duplicidade, caso o
// usuário já tenha cadastrado o mesmo financiamento).
//
// NÃO cria tabelas nem colunas novas no Supabase: usa a tabela "parcelamentos"
// já existente, via useParcelamentos().criar — a mesma usada na tela de
// Parcelamentos. Os custos de uso/manutenção NÃO são lançados aqui para evitar
// duplicar despesas recorrentes; registramos apenas a parcela do financiamento.
// ─────────────────────────────────────────────────────────────────────────────
export default function CadastrarNoPlanejamento({ descricao, valorTotal, numeroParcelas }) {
  const { parcelamentos, criar } = useParcelamentos()
  const [estado, setEstado] = useState('idle') // idle | salvando | ok | erro
  const [erro, setErro] = useState('')

  const total = Number(valorTotal) || 0
  const nParcelas = Math.max(1, Math.floor(Number(numeroParcelas) || 0))

  // Guarda de duplicidade: mesmo rótulo (case-insensitive) e valor total
  // próximo (tolerância de R$ 1 para arredondamentos) entre os ativos.
  const jaExiste = useMemo(() => {
    const alvo = String(descricao || '').trim().toLowerCase()
    return (parcelamentos || []).some(p =>
      !p.quitado_em &&
      String(p.descricao || '').trim().toLowerCase() === alvo &&
      Math.abs(Number(p.valor_total || 0) - total) <= 1
    )
  }, [parcelamentos, descricao, total])

  async function handleCadastrar() {
    if (total <= 0 || nParcelas <= 0) return
    setEstado('salvando'); setErro('')
    try {
      await criar({
        descricao: String(descricao || 'Financiamento').slice(0, 120),
        valor_total: total,
        numero_parcelas: nParcelas,
        // Primeira parcela no mês atual (dia 01, padrão da tela de Parcelamentos).
        primeira_parcela: hojeISO().slice(0, 7) + '-01',
        categoria_id: null,
        // Sem forma/cartão: evita qualquer constraint e não vincula fatura.
        forma_pagamento: null,
        cartao_id: null,
      })
      setEstado('ok')
    } catch (e) {
      setEstado('erro')
      setErro(e?.message || 'Não foi possível cadastrar agora.')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">
        <Check size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800">
          Adicionado ao planejamento como parcelamento. Você pode ajustá-lo ou removê-lo na tela de Parcelamentos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {jaExiste && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Já existe um parcelamento parecido no seu planejamento ({formatCurrency(total)}). Cadastrar de novo pode duplicar o compromisso.
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={handleCadastrar}
        disabled={estado === 'salvando' || total <= 0}
        className="btn-secondary w-full flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {estado === 'salvando'
          ? <><Loader2 size={16} className="animate-spin" /> Cadastrando…</>
          : <><CalendarPlus size={16} /> {jaExiste ? 'Cadastrar mesmo assim' : 'Cadastrar no planejamento'}</>}
      </button>
      {estado === 'erro' && <p className="text-xs text-red-600">{erro}</p>}
      <p className="text-xs text-gray-400">
        Opcional. Registra apenas a parcela do financiamento como parcelamento. Os custos de uso não são lançados para não duplicar despesas.
      </p>
    </div>
  )
}
