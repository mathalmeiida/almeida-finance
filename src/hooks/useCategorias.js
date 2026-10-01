import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useCategorias(tipo = null) {
  const { usuario } = useAuth()
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!usuario) return
    buscar()
  }, [usuario, tipo])

  async function buscar() {
    setCarregando(true)
    try {
      let query = supabase
        .from('categorias')
        .select('*')
        .or(`usuario_id.is.null,usuario_id.eq.${usuario.id}`)
        .order('nome')

      if (tipo) {
        query = query.in('tipo', [tipo, 'ambos'])
      }

      const { data, error } = await query
      if (error) throw error
      setCategorias(data || [])
    } catch (err) {
      console.error('Erro ao buscar categorias:', err)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('categorias')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    setCategorias(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    return data
  }

  return { categorias, carregando, criar, recarregar: buscar }
}
