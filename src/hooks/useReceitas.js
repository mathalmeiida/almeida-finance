import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useReceitas(mes, ano) {
  const { usuario } = useAuth()
  const [receitas, setReceitas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!usuario) return
    buscar()
  }, [usuario, mes, ano])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      let query = supabase
        .from('receitas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('data', { ascending: false })

      // Filtra pelo mês/ano se informado
      if (mes !== undefined && ano !== undefined) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0] // último dia do mês
        query = query.gte('data', inicio).lte('data', fim)
      }

      const { data, error } = await query
      if (error) throw error
      setReceitas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('receitas')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    setReceitas(prev => [data, ...prev])
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('receitas')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setReceitas(prev => prev.map(r => r.id === id ? data : r))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('receitas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setReceitas(prev => prev.filter(r => r.id !== id))
  }

  const total = receitas.reduce((acc, r) => acc + Number(r.valor), 0)

  return { receitas, total, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
