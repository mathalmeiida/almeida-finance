import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import { formatCurrency, formatDate, FORMAS_PAGAMENTO, hojeISO } from '../lib/utils'

// ─── Modal: confirmar antecipação de pagamento ───────────────────────────────
// Compartilhado entre a página Despesas e a Home ("Próximos 7 dias"), para não
// duplicar lógica/UX. Mostra valor, data original (vencimento), data do
// pagamento (editável, padrão hoje) e a forma/conta usada. Ao confirmar, chama
// onConfirmar({ pago_em, forma_pagamento }); o chamador grava via
// useDespesas().anteciparPagamento — o saldo reflete a saída sem contar duas
// vezes (ver useProjecao: dataEfetivaDespesa = pago_em || data).
export default function ModalAnteciparPagamento({ aberto, despesa, onConfirmar, onFechar, salvando }) {
  const hojeStr = hojeISO() // data de hoje no fuso de Brasília
  const [dataPagamento, setDataPagamento] = useState(hojeStr)
  const [forma, setForma] = useState('')

  useEffect(() => {
    if (aberto && despesa) {
      setDataPagamento(hojeStr)
      setForma(despesa.forma_pagamento || '')
    }
  }, [aberto, despesa, hojeStr])

  if (!despesa) return null

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Antecipar pagamento">
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Despesa</span>
            <span className="text-sm font-medium text-gray-900 truncate">{despesa.descricao}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Valor</span>
            <span className="text-sm font-bold text-red-500 whitespace-nowrap">-{formatCurrency(despesa.valor)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Vencimento original</span>
            <span className="text-sm font-medium text-gray-900">{formatDate(despesa.data)}</span>
          </div>
        </div>

        <div>
          <label className="label">Data do pagamento</label>
          <input
            type="date" value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Forma / conta utilizada <span className="text-gray-400">(opcional)</span></label>
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="input">
            <option value="">Não informado</option>
            {FORMAS_PAGAMENTO.map(f => (
              <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400 leading-snug">
          A despesa será marcada como <strong>paga antecipadamente</strong> e o seu saldo será
          atualizado. O vencimento original é mantido para o histórico.
        </p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => onConfirmar({ pago_em: dataPagamento || hojeStr, forma_pagamento: forma || null })}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Confirmando...</> : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
