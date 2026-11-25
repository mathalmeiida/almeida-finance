import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

/**
 * Hook para gerenciar pagamentos de faturas de cartão de crédito.
 * 
 * SISTEMA DESABILITADO - aguardando validação completa
 */

// Flag de controle do sistema
const SISTEMA_ATIVO = true

export function usePagamentosFatura(faturaId = null) {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [pagamentos, setPagamentos] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('Sistema de pagamentos em desenvolvimento')

  // ─────────────────────────────────────────────────────────
  // Buscar pagamentos
  // ─────────────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    if (!SISTEMA_ATIVO || !idEfetivo) return
    
    setCarregando(true)
    setErro(null)
    
    try {
      let query = supabase
        .from('pagamentos_fatura')
        .select(`
          *,
          faturas_cartao!inner(
            id,
            cartao_id,
            ano_mes,
            valor_total,
            valor_pago_acumulado,
            limite_liberado,
            pago
          )
        `)
        .eq('usuario_id', idEfetivo)
        .order('data_pagamento', { ascending: false })

      if (faturaId) {
        query = query.eq('fatura_id', faturaId)
      }

      const { data, error } = await query

      if (error) throw error

      setPagamentos(data || [])
    } catch (err) {
      console.error('Erro ao buscar pagamentos:', err)
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo, faturaId])

  useEffect(() => {
    if (idEfetivo) buscar()
  }, [idEfetivo, faturaId, buscar])

  // ─────────────────────────────────────────────────────────
  // Validar pagamento antes de registrar
  // ─────────────────────────────────────────────────────────
  async function validarPagamento(faturaId, valorPago) {
    const { data, error } = await supabase.rpc('validar_pagamento_fatura', {
      p_fatura_id: faturaId,
      p_valor_pago: valorPago
    })

    if (error) {
      console.error('Erro ao validar pagamento:', error)
      throw new Error('Erro ao validar pagamento')
    }

    return data
  }

  // ─────────────────────────────────────────────────────────
  // Registrar novo pagamento
  // ─────────────────────────────────────────────────────────
  /**
   * Registra um pagamento de fatura.
   * 
   * @param {Object} params
   * @param {string} params.fatura_id - UUID da fatura
   * @param {number} params.valor_pago - Valor pago (deve ser > 0)
   * @param {string} params.data_pagamento - Data no formato YYYY-MM-DD
   * @param {string} params.tipo_pagamento - 'parcial' | 'total' | 'antecipado'
   * @param {string} [params.observacao] - Observações opcionais
   * 
   * @returns {Promise<Object>} Pagamento criado
   * @throws {Error} Se validação falhar ou houver erro no banco
   */
  async function registrarPagamento({
    fatura_id,
    valor_pago,
    data_pagamento,
    tipo_pagamento,
    observacao = null
  }) {
    bloquearSeConsultoria(modoConsultoria)

    if (!usuario?.id) {
      throw new Error('Usuário não autenticado')
    }

    // Validação prévia
    const validacao = await validarPagamento(fatura_id, valor_pago)
    
    if (!validacao.valido) {
      throw new Error(validacao.erro || 'Pagamento inválido')
    }

    // Registra o pagamento
    const { data, error } = await supabase
      .from('pagamentos_fatura')
      .insert({
        usuario_id: usuario.id,
        fatura_id,
        valor_pago: Number(valor_pago),
        data_pagamento,
        tipo_pagamento,
        observacao
      })
      .select(`
        *,
        faturas_cartao!inner(
          id,
          cartao_id,
          ano_mes,
          valor_total,
          valor_pago_acumulado,
          limite_liberado,
          pago
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao registrar pagamento:', error)
      throw new Error('Erro ao registrar pagamento: ' + error.message)
    }

    // Atualiza lista local
    setPagamentos(prev => [data, ...prev])

    return data
  }

  // ─────────────────────────────────────────────────────────
  // Estornar pagamento
  // ─────────────────────────────────────────────────────────
  /**
   * Estorna um pagamento já realizado.
   * 
   * @param {string} pagamentoId - UUID do pagamento
   * @param {string} [motivo] - Motivo do estorno (opcional)
   * 
   * @returns {Promise<Object>} Pagamento atualizado (estornado=true)
   * @throws {Error} Se pagamento não existir, já estiver estornado ou houver erro
   */
  async function estornarPagamento(pagamentoId, motivo = null) {
    bloquearSeConsultoria(modoConsultoria)

    if (!usuario?.id) {
      throw new Error('Usuário não autenticado')
    }

    // Verifica se o pagamento existe e não está estornado
    const { data: pagamentoExistente, error: erroConsulta } = await supabase
      .from('pagamentos_fatura')
      .select('id, estornado')
      .eq('id', pagamentoId)
      .eq('usuario_id', usuario.id)
      .single()

    if (erroConsulta || !pagamentoExistente) {
      throw new Error('Pagamento não encontrado')
    }

    if (pagamentoExistente.estornado) {
      throw new Error('Este pagamento já foi estornado')
    }

    // Estorna
    const { data, error } = await supabase
      .from('pagamentos_fatura')
      .update({
        estornado: true,
        estornado_em: new Date().toISOString(),
        motivo_estorno: motivo
      })
      .eq('id', pagamentoId)
      .eq('usuario_id', usuario.id)
      .select(`
        *,
        faturas_cartao!inner(
          id,
          cartao_id,
          ano_mes,
          valor_total,
          valor_pago_acumulado,
          limite_liberado,
          pago
        )
      `)
      .single()

    if (error) {
      console.error('Erro ao estornar pagamento:', error)
      throw new Error('Erro ao estornar pagamento: ' + error.message)
    }

    // Atualiza lista local
    setPagamentos(prev => 
      prev.map(p => p.id === pagamentoId ? data : p)
    )

    return data
  }

  // ─────────────────────────────────────────────────────────
  // Buscar resumo de pagamentos de uma fatura
  // ─────────────────────────────────────────────────────────
  /**
   * Retorna resumo dos pagamentos de uma fatura específica.
   * 
   * @param {string} faturaId - UUID da fatura
   * @returns {Promise<Object>} Resumo com total pago, restante, etc
   */
  async function buscarResumoFatura(faturaId) {
    if (!idEfetivo) {
      throw new Error('Usuário não autenticado')
    }

    // Busca a fatura
    const { data: fatura, error: erroFatura } = await supabase
      .from('faturas_cartao')
      .select('*')
      .eq('id', faturaId)
      .eq('usuario_id', idEfetivo)
      .single()

    if (erroFatura || !fatura) {
      throw new Error('Fatura não encontrada')
    }

    // Busca pagamentos não estornados
    const { data: pagamentosAtivos, error: erroPagamentos } = await supabase
      .from('pagamentos_fatura')
      .select('*')
      .eq('fatura_id', faturaId)
      .eq('usuario_id', idEfetivo)
      .eq('estornado', false)

    if (erroPagamentos) {
      throw new Error('Erro ao buscar pagamentos')
    }

    const valorTotal = Number(fatura.valor_total) || 0
    const valorPagoAcumulado = Number(fatura.valor_pago_acumulado) || 0
    const valorRestante = Math.max(0, valorTotal - valorPagoAcumulado)
    const percentualPago = valorTotal > 0 
      ? Math.min(100, Math.round((valorPagoAcumulado / valorTotal) * 100))
      : 0

    return {
      fatura,
      pagamentos: pagamentosAtivos || [],
      valorTotal,
      valorPagoAcumulado,
      valorRestante,
      percentualPago,
      quitada: fatura.pago === true,
      limiteLiberado: Number(fatura.limite_liberado) || 0
    }
  }

  // ─────────────────────────────────────────────────────────
  // Calcular limite disponível real do cartão
  // ─────────────────────────────────────────────────────────
  /**
   * Calcula o limite disponível real do cartão, considerando pagamentos parciais.
   * 
   * Fórmula: limite_total - (comprometido_total - soma(limite_liberado_faturas))
   * 
   * @param {string} cartaoId - UUID do cartão
   * @param {number} limiteTotal - Limite total do cartão
   * @param {number} comprometidoTotal - Total comprometido (sem considerar pagamentos)
   * @returns {Promise<number>} Limite disponível real
   */
  async function calcularLimiteDisponivel(cartaoId, limiteTotal, comprometidoTotal) {
    if (!idEfetivo) return Math.max(0, limiteTotal - comprometidoTotal)

    // Busca soma de limites liberados de todas as faturas do cartão
    const { data: faturas, error } = await supabase
      .from('faturas_cartao')
      .select('limite_liberado')
      .eq('cartao_id', cartaoId)
      .eq('usuario_id', idEfetivo)

    if (error) {
      console.error('Erro ao calcular limite disponível:', error)
      return Math.max(0, limiteTotal - comprometidoTotal)
    }

    const totalLiberado = (faturas || []).reduce(
      (acc, f) => acc + (Number(f.limite_liberado) || 0), 
      0
    )

    const limiteDisponivel = limiteTotal - (comprometidoTotal - totalLiberado)

    return Math.max(0, limiteDisponivel)
  }

  return {
    pagamentos,
    carregando,
    erro,
    registrarPagamento,
    estornarPagamento,
    buscarResumoFatura,
    calcularLimiteDisponivel,
    recarregar: buscar
  }
}
