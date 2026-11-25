import React, { useState, useEffect } from 'react'
import { DollarSign, Calendar, FileText, Loader2, AlertCircle, CheckCircle2, Info } from 'lucide-react'
import Modal from './Modal'
import InputMoeda from './InputMoeda'
import { formatCurrency, hojeISO } from '../lib/utils'

/**
 * Modal para registrar pagamento de fatura (parcial, total ou antecipado).
 * 
 * Props:
 * - aberto: boolean
 * - onFechar: function
 * - onSalvar: function(dadosPagamento) - recebe { fatura_id, valor_pago, data_pagamento, tipo_pagamento, observacao }
 * - carregando: boolean
 * - fatura: object com { id, valor_total, valor_pago_acumulado }
 * - limiteCartao: number - limite total do cartão (para cálculo de liberação)
 * - erro: string | null
 */
export default function ModalPagamentoFatura({
  aberto,
  onFechar,
  onSalvar,
  carregando,
  fatura,
  limiteCartao = 0,
  erro
}) {
  const [form, setForm] = useState({
    valor_pago: '',
    data_pagamento: hojeISO(),
    tipo_pagamento: 'parcial', // 'parcial' | 'total' | 'antecipado'
    observacao: ''
  })

  const [avisos, setAvisos] = useState([])

  // Calcula valores derivados
  const valorTotal = Number(fatura?.valor_total) || 0
  const valorPagoAcumulado = Number(fatura?.valor_pago_acumulado) || 0
  const valorRestante = Math.max(0, valorTotal - valorPagoAcumulado)
  const valorPagoAtual = Number(form.valor_pago) || 0

  // Validações e avisos
  useEffect(() => {
    const novosAvisos = []

    if (valorPagoAtual > 0) {
      // Aviso: pagamento maior que o restante
      if (valorPagoAtual > valorRestante + 0.01) {
        novosAvisos.push({
          tipo: 'erro',
          mensagem: `Valor ultrapassa o restante da fatura (${formatCurrency(valorRestante)})`
        })
      }

      // Aviso: pagamento quitará a fatura
      if (valorPagoAtual >= valorRestante - 0.01 && valorRestante > 0) {
        novosAvisos.push({
          tipo: 'sucesso',
          mensagem: 'Este pagamento quitará a fatura integralmente'
        })
      }

      // Calcula liberação proporcional do limite
      const novoValorPago = valorPagoAcumulado + valorPagoAtual
      const percentualPago = valorTotal > 0 
        ? Math.min(1, novoValorPago / valorTotal) 
        : 0
      const limiteLiberadoTotal = Math.round(limiteCartao * percentualPago * 100) / 100
      const limiteLiberadoAnterior = valorTotal > 0 
        ? Math.round(limiteCartao * (valorPagoAcumulado / valorTotal) * 100) / 100
        : 0
      const limiteLiberadoAdicional = limiteLiberadoTotal - limiteLiberadoAnterior

      if (limiteLiberadoAdicional > 0) {
        novosAvisos.push({
          tipo: 'info',
          mensagem: `Liberará ${formatCurrency(limiteLiberadoAdicional)} do limite do cartão`
        })
      }
    }

    setAvisos(novosAvisos)
  }, [valorPagoAtual, valorRestante, valorTotal, valorPagoAcumulado, limiteCartao])

  // Resetar form ao abrir
  useEffect(() => {
    if (aberto) {
      setForm({
        valor_pago: '',
        data_pagamento: hojeISO(),
        tipo_pagamento: 'parcial',
        observacao: ''
      })
    }
  }, [aberto])

  // Atalho: preencher com valor restante
  function preencherValorTotal() {
    setForm(prev => ({
      ...prev,
      valor_pago: String(valorRestante),
      tipo_pagamento: 'total'
    }))
  }

  // Submit
  function handleSubmit(e) {
    e.preventDefault()
    
    if (carregando) return

    // Validações finais
    if (valorPagoAtual <= 0) {
      return
    }

    if (valorPagoAtual > valorRestante + 0.01) {
      return
    }

    // Determina tipo automaticamente se não foi escolhido
    let tipoPagamento = form.tipo_pagamento
    if (valorPagoAtual >= valorRestante - 0.01) {
      tipoPagamento = 'total'
    } else if (new Date(form.data_pagamento) > new Date()) {
      tipoPagamento = 'antecipado'
    } else if (tipoPagamento === 'total') {
      // Se escolheu "total" mas valor não é 100%, corrige para "parcial"
      tipoPagamento = 'parcial'
    }

    onSalvar({
      fatura_id: fatura.id,
      valor_pago: valorPagoAtual,
      data_pagamento: form.data_pagamento,
      tipo_pagamento: tipoPagamento,
      observacao: form.observacao.trim() || null
    })
  }

  if (!fatura) return null

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Registrar pagamento">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Resumo da fatura */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Valor total da fatura</span>
            <span className="font-bold text-gray-900">{formatCurrency(valorTotal)}</span>
          </div>
          
          {valorPagoAcumulado > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Já pago</span>
              <span className="font-semibold text-emerald-600">
                -{formatCurrency(valorPagoAcumulado)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
            <span className="text-gray-900 font-medium">Valor restante</span>
            <span className="font-bold text-marca text-base">
              {formatCurrency(valorRestante)}
            </span>
          </div>
        </div>

        {/* Valor do pagamento */}
        <div>
          <label className="label flex items-center justify-between">
            <span className="flex items-center gap-2">
              <DollarSign size={16} />
              Valor do pagamento (R$)
            </span>
            {valorRestante > 0 && (
              <button
                type="button"
                onClick={preencherValorTotal}
                className="text-xs text-marca hover:underline font-medium"
              >
                Pagar total ({formatCurrency(valorRestante)})
              </button>
            )}
          </label>
          <InputMoeda
            valor={form.valor_pago}
            onChangeValor={(valor) => setForm(prev => ({ ...prev, valor_pago: valor }))}
            className="input"
            placeholder="0,00"
            autoFocus
          />
        </div>

        {/* Data do pagamento */}
        <div>
          <label className="label flex items-center gap-2">
            <Calendar size={16} />
            Data do pagamento
          </label>
          <input
            type="date"
            value={form.data_pagamento}
            onChange={(e) => setForm(prev => ({ ...prev, data_pagamento: e.target.value }))}
            className="input"
            required
          />
        </div>

        {/* Tipo de pagamento */}
        <div>
          <label className="label flex items-center gap-2">
            <FileText size={16} />
            Tipo de pagamento
          </label>
          <select
            value={form.tipo_pagamento}
            onChange={(e) => setForm(prev => ({ ...prev, tipo_pagamento: e.target.value }))}
            className="input"
          >
            <option value="parcial">Pagamento parcial</option>
            <option value="total">Pagamento total</option>
            <option value="antecipado">Pagamento antecipado</option>
          </select>
          <p className="text-xs text-gray-400 mt-1">
            O tipo é ajustado automaticamente conforme o valor e a data
          </p>
        </div>

        {/* Observações */}
        <div>
          <label className="label">Observações (opcional)</label>
          <textarea
            value={form.observacao}
            onChange={(e) => setForm(prev => ({ ...prev, observacao: e.target.value }))}
            className="input resize-none"
            rows="2"
            placeholder="Ex: Pagamento via PIX, Antecipado por desconto..."
          />
        </div>

        {/* Avisos */}
        {avisos.length > 0 && (
          <div className="space-y-2">
            {avisos.map((aviso, idx) => {
              const Icon = aviso.tipo === 'erro' 
                ? AlertCircle 
                : aviso.tipo === 'sucesso' 
                  ? CheckCircle2 
                  : Info

              const cores = aviso.tipo === 'erro'
                ? 'bg-red-50 border-red-200 text-red-700'
                : aviso.tipo === 'sucesso'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-blue-50 border-blue-200 text-blue-700'

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${cores}`}
                >
                  <Icon size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{aviso.mensagem}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Erro geral */}
        {erro && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-600">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {/* Botões */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="btn-secondary flex-1"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={carregando || valorPagoAtual <= 0 || avisos.some(a => a.tipo === 'erro')}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {carregando ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Registrando...
              </>
            ) : (
              'Registrar pagamento'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
