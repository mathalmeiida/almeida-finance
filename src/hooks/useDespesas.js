import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useDespesas(mes, ano) {
  const { usuario } = useAuth()
  const [despesas, setDespesas] = useState([])
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
        .from('despesas')
        .select(`
          *,
          categorias (id, nome, icone, cor)
        `)
        .eq('usuario_id', usuario.id)
        .order('data', { ascending: false })

      if (mes !== undefined && ano !== undefined) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0]
        query = query.gte('data', inicio).lte('data', fim)
      }

      const { data, error } = await query
      if (error) throw error
      setDespesas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    const { data, error } = await supabase
      .from('despesas')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setDespesas(prev => [data, ...prev])
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('despesas')
      .update(dados)
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setDespesas(prev => prev.map(d => d.id === id ? data : d))
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setDespesas(prev => prev.filter(d => d.id !== id))
  }

  // Permite corrigir manualmente a classificação automática (fixa/variavel)
  async function alterarTipo(id, tipo) {
    const { data, error } = await supabase
      .from('despesas')
      .update({ tipo_despesa: tipo })
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setDespesas(prev => prev.map(d => d.id === id ? data : d))
    return data
  }

  const total = despesas.reduce((acc, d) => acc + Number(d.valor), 0)

  return { despesas, total, carregando, erro, criar, atualizar, remover, alterarTipo, recarregar: buscar }
}
