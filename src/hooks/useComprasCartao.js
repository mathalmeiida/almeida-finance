import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Compras de cartão do usuário.
 * Pode filtrar por cartaoId (ex: ao abrir a fatura de um cartão específico)
 * ou buscar todas (para somar faturas no resumo e no Dashboard).
 */
export function useComprasCartao(cartaoId = null) {
  const { usuario } = useAuth()
  const [compras, setCompras] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!usuario) return
    buscar()
  }, [usuario, cartaoId])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      let query = supabase
        .from('compras_cartao')
        .select(`*, categorias (id, nome, icone, cor)`)
        .eq('usuario_id', usuario.id)
        .order('data_compra', { ascending: false })

      if (cartaoId) query = query.eq('cartao_id', cartaoId)

      const { data, error } = await query
      if (error) throw error
      setCompras(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('compras_cartao')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setCompras(prev => [data, ...prev])
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('compras_cartao')
      .update(dados)
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setCompras(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('compras_cartao')
      .delete()
      .eq('id', id)
    if (error) throw error
    setCompras(prev => prev.filter(c => c.id !== id))
  }

  return { compras, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
