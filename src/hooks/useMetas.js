import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

export function useMetas() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [metas, setMetas] = useState([])
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
        .from('metas')
        .select('*')
        .eq('usuario_id', idEfetivo)
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
    bloquearSeConsultoria(modoConsultoria)
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
    bloquearSeConsultoria(modoConsultoria)
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
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase
      .from('metas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setMetas(prev => prev.filter(m => m.id !== id))
  }

  // Aporte (delta > 0) ou retirada (delta < 0) sobre o valor acumulado da meta.
  // Persiste em metas.valor_atual (por usuário, via RLS existente). Regras:
  //  - aporte: nunca ultrapassa o objetivo (valor_desejado);
  //  - retirada: nunca deixa o acumulado abaixo de zero (bloqueia retirar mais
  //    do que o guardado).
  // NÃO movimenta saldo bancário, reserva, investimentos, receitas nem despesas.
  async function ajustarValor(id, delta) {
    bloquearSeConsultoria(modoConsultoria)
    const meta = metas.find(m => m.id === id)
    if (!meta) throw new Error('Meta não encontrada.')
    const atual = Number(meta.valor_atual) || 0
    const objetivo = Number(meta.valor_desejado) || 0
    const d = Number(delta) || 0
    if (d === 0) throw new Error('Informe um valor maior que zero.')
    if (d < 0 && atual + d < 0) {
      throw new Error('Não é possível retirar mais do que o valor acumulado.')
    }
    let novo = atual + d
    if (novo < 0) novo = 0
    if (objetivo > 0 && novo > objetivo) novo = objetivo // aporte não passa do objetivo
    return atualizar(id, { valor_atual: novo })
  }

  return { metas, carregando, erro, criar, atualizar, remover, ajustarValor, recarregar: buscar }
}
