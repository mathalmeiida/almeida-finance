import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useMetas() {
  const { usuario } = useAuth()
  const [metas, setMetas] = useState([])
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
        .from('metas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('criado_em', { ascending: false })
      if (error) throw error
      setMetas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('metas')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    setMetas(prev => [data, ...prev])
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('metas')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setMetas(prev => prev.map(m => m.id === id ? data : m))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('metas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setMetas(prev => prev.filter(m => m.id !== id))
  }

  return { metas, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
