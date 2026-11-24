import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

// ─── Pagamentos de fatura (tabela pagamentos_fatura) ──────────────────────────
// Leitura direta (RLS: só os próprios registros). Escrita SOMENTE pelas RPCs
// transacionais pagar_fatura_cartao / estornar_pagamento_fatura.
// O pagamento não é despesa: debita o saldo da conta (derivado em
// lib/saldoDisponivel.js) e reduz o saldo em aberto/limite comprometido.
//
// Sincronização:
//  • Entre telas do mesmo aparelho: evento interno após pagar/estornar.
//  • Entre aparelhos: realtime (quando habilitado) + refetch ao focar a janela.

const EVENTO = 'af:pagamentos-fatura'
const barramento = typeof window !== 'undefined' ? window : null

export function novaChaveIdempotencia() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function mensagemAmigavel(err) {
  const m = String(err?.message || err || '')
  if (/excede o saldo em aberto/i.test(m)) return m
  if (/j[aá] estornado/i.test(m)) return 'Este pagamento já foi estornado.'
  if (/n[aã]o encontrado/i.test(m)) return 'Cartão ou pagamento não encontrado.'
  if (/futura/i.test(m)) return 'A data do pagamento não pode ser futura.'
  if (/function .*does not exist|schema cache/i.test(m)) {
    return 'Pagamento de fatura indisponível: a migração 2026-11_pagamentos_fatura.sql ainda não foi aplicada neste ambiente.'
  }
  return m || 'Erro ao registrar o pagamento.'
}

export function usePagamentosFatura(cartaoId = null) {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS exigem usuário real.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [pagamentos, setPagamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const emAndamento = useRef(false)

  const buscar = useCallback(async ({ silencioso = false } = {}) => {
    if (!idEfetivo) return
    if (!silencioso) setCarregando(true)
    setErro(null)
    try {
      let query = supabase
        .from('pagamentos_fatura')
        .select('*')
        .eq('usuario_id', idEfetivo)
        .order('data_pagamento', { ascending: false })
        .order('criado_em', { ascending: false })
      if (cartaoId) query = query.eq('cartao_id', cartaoId)
      const { data, error } = await query
      if (error) throw error
      setPagamentos(data || [])
    } catch (err) {
      // Tabela ausente (migração pendente) não derruba a tela: lista vazia + erro informativo.
      setErro(mensagemAmigavel(err))
      setPagamentos([])
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo, cartaoId])

  useEffect(() => { if (idEfetivo) buscar() }, [idEfetivo, cartaoId, buscar])

  // Sincronização entre telas, janelas e aparelhos.
  useEffect(() => {
    if (!idEfetivo || !barramento) return undefined
    const recarregar = () => buscar({ silencioso: true })
    const aoVisivel = () => { if (document.visibilityState === 'visible') recarregar() }
    barramento.addEventListener(EVENTO, recarregar)
    barramento.addEventListener('focus', recarregar)
    document.addEventListener('visibilitychange', aoVisivel)

    let canal = null
    try {
      canal = supabase
        .channel(`pagamentos-fatura-${idEfetivo}-${cartaoId || 'todos'}-${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'pagamentos_fatura', filter: `usuario_id=eq.${idEfetivo}` },
          recarregar)
        .subscribe()
    } catch { canal = null }

    return () => {
      barramento.removeEventListener(EVENTO, recarregar)
      barramento.removeEventListener('focus', recarregar)
      document.removeEventListener('visibilitychange', aoVisivel)
      if (canal) supabase.removeChannel(canal)
    }
  }, [idEfetivo, cartaoId, buscar])

  function avisarOutrasTelas() {
    barramento?.dispatchEvent(new Event(EVENTO))
  }

  // Registra um pagamento. `totalCiclo` é o total da fatura (projetada) usado pelo
  // servidor para limitar a soma dos pagamentos do ciclo. A chave de idempotência
  // torna o envio repetido (duplo clique, retry, 2 abas) seguro.
  async function pagar({ cartaoId: cid, anoMes, valor, data, totalCiclo, chave }) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) throw new Error('Usuário não autenticado')
    if (emAndamento.current) throw new Error('Já existe um pagamento sendo registrado. Aguarde.')
    emAndamento.current = true
    setEnviando(true)
    try {
      const { data: linha, error } = await supabase.rpc('pagar_fatura_cartao', {
        p_cartao_id: cid,
        p_ano_mes: anoMes,
        p_valor: valor,
        p_data_pagamento: data,
        p_origem: 'saldo_principal',
        p_conta_nome: null,
        p_total_ciclo: totalCiclo,
        p_idempotency_key: chave || novaChaveIdempotencia(),
      })
      if (error) throw new Error(mensagemAmigavel(error))
      setPagamentos(prev => [linha, ...prev.filter(p => p.id !== linha.id)])
      avisarOutrasTelas()
      return linha
    } finally {
      emAndamento.current = false
      setEnviando(false)
    }
  }

  async function estornar(id) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) throw new Error('Usuário não autenticado')
    if (emAndamento.current) throw new Error('Aguarde a operação em andamento.')
    emAndamento.current = true
    setEnviando(true)
    try {
      const { data: linha, error } = await supabase.rpc('estornar_pagamento_fatura', { p_pagamento_id: id })
      if (error) throw new Error(mensagemAmigavel(error))
      setPagamentos(prev => prev.map(p => (p.id === id ? linha : p)))
      avisarOutrasTelas()
      return linha
    } finally {
      emAndamento.current = false
      setEnviando(false)
    }
  }

  return { pagamentos, carregando, erro, enviando, pagar, estornar, recarregar: buscar }
}
