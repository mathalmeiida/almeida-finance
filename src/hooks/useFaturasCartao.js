import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { alterarHistoricoFatura } from '../lib/historicoFatura'

// ─── Faturas informadas por TOTAL (tabela faturas_cartao) ─────────────────────
// Guarda o total da fatura por (cartao_id, ano_mes). Quando existe um total
// informado para um cartão/mês, ele SUBSTITUI a soma das compras daquele
// cartão/mês nos cálculos — nunca soma (ver helper totalFaturaComOverride).
// RLS garante que cada usuário só acessa as próprias faturas.
export function useFaturasCartao(cartaoId = null) {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [faturas, setFaturas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) return
    setCarregando(true); setErro(null)
    try {
      let query = supabase
        .from('faturas_cartao')
        .select('*')
        .eq('usuario_id', idEfetivo)
      if (cartaoId) query = query.eq('cartao_id', cartaoId)
      const { data, error } = await query
      if (error) throw error
      setFaturas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo, cartaoId])

  useEffect(() => { if (idEfetivo) buscar() }, [idEfetivo, cartaoId, buscar])

  // Cria/atualiza o total de um cartão em um mês (upsert pela UNIQUE
  // (cartao_id, ano_mes) definida na migração). ano_mes no formato 'YYYY-MM'.
  async function salvarFatura({ cartao_id, ano_mes, valor_total, vencimento_dia = null }) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('faturas_cartao')
      .upsert(
        { usuario_id: usuario.id, cartao_id, ano_mes, valor_total, vencimento_dia },
        { onConflict: 'cartao_id,ano_mes' }
      )
      .select()
      .single()
    if (error) throw error
    setFaturas(prev => {
      const resto = prev.filter(f => !(f.cartao_id === cartao_id && f.ano_mes === ano_mes))
      return [...resto, data]
    })
    return data
  }

  // Remove o total informado (volta a valer a soma das compras daquele mês).
  async function removerFatura(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('faturas_cartao').delete()
      .eq('id', id).eq('usuario_id', usuario.id)
    if (error) throw error
    setFaturas(prev => prev.filter(f => f.id !== id))
  }

async function marcarFaturaPaga(id, pago = true) {
  bloquearSeConsultoria(modoConsultoria)

  if (!usuario?.id) {
    throw new Error('Usuário não autenticado')
  }

  const { data, error } = await supabase
    .from('faturas_cartao')
    .update({
      pago,
      pago_em: pago
        ? new Date().toLocaleDateString('en-CA', {
            timeZone: 'America/Sao_Paulo'
          })
        : null
    })
    .eq('id', id)
    .eq('usuario_id', usuario.id)
    .select()
    .single()

  if (error) throw error

  setFaturas(prev =>
    prev.map(f => f.id === id ? data : f)
  )

  return data
  }

  // Fatura quitada: o banco recusa o DML direto (FP001). Estes métodos usam a RPC
  // alterar_historico_fatura (motivo obrigatório, com auditoria). Na RPC, so valor_total é editável.
  async function atualizarComMotivo(id, dados, motivo) {
    bloquearSeConsultoria(modoConsultoria)
    const r = await alterarHistoricoFatura(supabase, { tabela: 'faturas_cartao', id, acao: 'editar', dados, motivo })
    await buscar()
    return r
  }

  async function removerComMotivo(id, motivo) {
    bloquearSeConsultoria(modoConsultoria)
    const r = await alterarHistoricoFatura(supabase, { tabela: 'faturas_cartao', id, acao: 'excluir', motivo })
    setFaturas(prev => prev.filter(f => f.id !== id))
    return r
  }

return { faturas, carregando, erro, salvarFatura, removerFatura, marcarFaturaPaga, atualizarComMotivo, removerComMotivo, recarregar: buscar }}