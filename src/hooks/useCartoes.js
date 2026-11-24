import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

export function useCartoes() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [cartoes, setCartoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!idEfetivo) return
    buscar()
  }, [idEfetivo])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('cartoes')
        .select('*')
        .eq('usuario_id', idEfetivo)
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
    bloquearSeConsultoria(modoConsultoria)
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
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('cartoes')
      .update(dados)
      .eq('id', id)
      .eq('usuario_id', usuario.id)   // garante que só o dono pode alterar
      .select()
      .single()
    if (error) throw error
    setCartoes(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    
    // SEGURANÇA: Verifica se cartão tem compras vinculadas antes de deletar
    const { data: compras, error: comprasError } = await supabase
      .from('compras_cartao')
      .select('id')
      .eq('cartao_id', id)
      .limit(1)
    
    if (comprasError) throw comprasError
    
    // Se tiver compras, bloqueia exclusão e sugere desativação
    if (compras && compras.length > 0) {
      throw new Error(
        'Este cartão possui compras vinculadas e não pode ser excluído. ' +
        'Considere desativá-lo ou arquivá-lo para preservar o histórico financeiro.'
      )
    }
    
    // Verifica parcelamentos vinculados
    const { data: parcelamentos, error: parcelamentosError } = await supabase
      .from('parcelamentos')
      .select('id')
      .eq('cartao_id', id)
      .limit(1)
    
    if (parcelamentosError) throw parcelamentosError
    
    if (parcelamentos && parcelamentos.length > 0) {
      throw new Error(
        'Este cartão possui parcelamentos vinculados e não pode ser excluído. ' +
        'Quite os parcelamentos ou desvincule-os antes de excluir o cartão.'
      )
    }
    
    // Verifica faturas informadas
    const { data: faturas, error: faturasError } = await supabase
      .from('faturas_cartao')
      .select('id')
      .eq('cartao_id', id)
      .limit(1)
    
    if (faturasError) throw faturasError
    
    if (faturas && faturas.length > 0) {
      throw new Error(
        'Este cartão possui faturas informadas e não pode ser excluído. ' +
        'Remova as faturas informadas antes de excluir o cartão.'
      )
    }
    
    // Só deleta se não houver nada vinculado (cartão vazio)
    const { error } = await supabase
      .from('cartoes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)
    
    if (error) throw error
    setCartoes(prev => prev.filter(c => c.id !== id))
  }

  return { cartoes, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
