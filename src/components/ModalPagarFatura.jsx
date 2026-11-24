import React, { useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import Modal from './Modal'
import InputMoeda from './InputMoeda'
import { formatCurrency, hojeISO } from '../lib/utils'
import { validarPagamento } from '../lib/faturaCartao'
import { novaChaveIdempotencia } from '../hooks/usePagamentosFatura'

// ─── Modal: pagar fatura (total, parcial ou antecipado) ───────────────────────
// Reaproveita Modal, InputMoeda e as classes .input/.label/.btn-* do app.
// O pagamento é do CICLO selecionado e nunca abate compras de outro ciclo.
// A chave de idempotência é gerada ao abrir e só muda após sucesso, então
// duplo clique ou novo envio da mesma tentativa não gera pagamento repetido.
export default function ModalPagarFatura({ aberto, ciclo, cartao, onConfirmar, onFechar }) {
  const [valor, setValor] = useState(0)
  const [data, setData] = useState(hojeISO())
  const [origem, setOrigem] = useState('saldo_principal')
  const [contaNome, setContaNome] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const chave = useRef(novaChaveIdempotencia())

  useEffect(() => {
    if (aberto && ciclo) {
      setValor(ciclo.emAberto)
      setData(hojeISO())
      setOrigem('saldo_principal')
      setContaNome('')
      setErro('')
      chave.current = novaChaveIdempotencia()
    }
  }, [aberto, ciclo?.ano, ciclo?.mes]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ciclo) return null

  const antecipado = ciclo.status === 'Aberta'
  const restante = Math.max(0, Math.round((ciclo.emAberto - Number(valor || 0)) * 100) / 100)

  async function confirmar() {
    if (salvando) return
    const msg = validarPagamento({ valor, emAberto: ciclo.emAberto, data })
    if (msg) { setErro(msg); return }
    setSalvando(true)
    setErro('')
    try {
      await onConfirmar({
        anoMes: `${ciclo.ano}-${String(ciclo.mes).padStart(2, '0')}`,
        valor: Number(valor),
        data,
        origem,
        contaNome: origem === 'outra_conta' ? contaNome.trim() || null : null,
        totalCiclo: ciclo.total,
        chave: chave.current,
      })
    } catch (e) {
      setErro(e?.message || 'Erro ao registrar o pagamento.')
      setSalvando(false)
      return
    }
    setSalvando(false)
  }

  return (
    <Modal aberto={aberto} onFechar={salvando ? () => {} : onFechar} titulo="Pagar fatura">
      <div className="space-y-4">
        <div className="rounded-xl bg-marca-100/50 border border-marca/20 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Cartão</span>
            <span className="text-sm font-medium text-gray-900 truncate">{cartao?.nome}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Total da fatura</span>
            <span className="text-sm font-medium text-gray-900">{formatCurrency(ciclo.total)}</span>
          </div>
          {ciclo.pago > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-500">Já pago</span>
              <span className="text-sm font-medium text-emerald-700">{formatCurrency(ciclo.pago)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Em aberto</span>
            <span className="text-base font-bold text-marca">{formatCurrency(ciclo.emAberto)}</span>
          </div>
          {antecipado && (
            <p className="text-xs text-gray-500 pt-1">Pagamento antecipado: o ciclo ainda está aberto.</p>
          )}
          {ciclo.saldoAnterior > 0 && (
            <p className="text-xs text-amber-700 pt-1">
              Há {formatCurrency(ciclo.saldoAnterior)} em aberto no ciclo anterior. Pague aquele ciclo separadamente.
            </p>
          )}
        </div>

        <div>
          <label className="label">Valor do pagamento (R$)</label>
          <InputMoeda valor={valor} onChangeValor={setValor} className="input" />
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn-secondary !py-1.5 !px-3 !text-xs"
              onClick={() => setValor(ciclo.emAberto)}>Pagar total</button>
            <button type="button" className="btn-secondary !py-1.5 !px-3 !text-xs"
              onClick={() => setValor(Math.round(ciclo.emAberto * 50) / 100)}>Metade</button>
          </div>
          {Number(valor) > 0 && restante > 0 && (
            <p className="text-xs text-gray-500 mt-2">Pagamento parcial: restarão {formatCurrency(restante)} em aberto.</p>
          )}
        </div>

        <div>
          <label className="label">Data do pagamento</label>
          <input type="date" value={data} max={hojeISO()} onChange={(e) => setData(e.target.value)} className="input" />
        </div>

        <div>
          <label className="label">Conta de origem</label>
          <select value={origem} onChange={(e) => setOrigem(e.target.value)} className="input">
            <option value="saldo_principal">Saldo principal (debita do saldo do app)</option>
            <option value="outra_conta">Outra conta (não altera o saldo do app)</option>
          </select>
          {origem === 'outra_conta' && (
            <input type="text" maxLength={80} value={contaNome} onChange={(e) => setContaNome(e.target.value)}
              className="input mt-2" placeholder="Nome da conta (opcional)" />
          )}
        </div>

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2" role="alert">{erro}</p>}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} disabled={salvando} className="btn-secondary flex-1">Cancelar</button>
          <button type="button" disabled={salvando || !(Number(valor) > 0)} onClick={confirmar}
            className="btn-primary flex-1 flex items-center justify-center gap-2">
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Registrando...</> : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
