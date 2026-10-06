import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Faturas informadas por TOTAL (tabela faturas_cartao) ─────────────────────
// Guarda o total da fatura por (cartao_id, ano_mes). Quando existe um total
// informado para um cartão/mês, ele SUBSTITUI a soma das compras daquele
// cartão/mês nos cálculos — nunca soma (ver helper totalFaturaComOverride).
// RLS garante que cada usuário só acessa as próprias faturas.
export function useFaturasCartao(cartaoId = null) {
  const { usuario } = useAuth()
  const [faturas, setFaturas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!usuario) return
    setCarregando(true); setErro(null)
    try {
      let query = supabase
        .from('faturas_cartao')
        .select('*')
        .eq('usuario_id', usuario.id)
      if (cartaoId) query = query.eq('cartao_id', cartaoId)
      const { data, error } = await query
      if (error) throw error
      setFaturas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [usuario, cartaoId])

  useEffect(() => { if (usuario) buscar() }, [usuario?.id, cartaoId, buscar])

  // Cria/atualiza o total de um cartão em um mês (upsert pela UNIQUE
  // (cartao_id, ano_mes) definida na migração). ano_mes no formato 'YYYY-MM'.
  async function salvarFatura({ cartao_id, ano_mes, valor_total, vencimento_dia = null }) {
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
    const { error } = await supabase.from('faturas_cartao').delete().eq('id', id)
    if (error) throw error
    setFaturas(prev => prev.filter(f => f.id !== id))
  }

  return { faturas, carregando, erro, salvarFatura, removerFatura, recarregar: buscar }
}
