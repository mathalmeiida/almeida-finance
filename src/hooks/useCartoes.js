import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useCartoes() {
  const { usuario } = useAuth()
  const [cartoes, setCartoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!usuario) return
    buscar()
  }, [usuario])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('criado_em', { ascending: true })
      if (error) throw error
      setCartoes(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('cartoes')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    setCartoes(prev => [...prev, data])
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('cartoes')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setCartoes(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('cartoes')
      .delete()
      .eq('id', id)
    if (error) throw error
    setCartoes(prev => prev.filter(c => c.id !== id))
  }

  return { cartoes, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
