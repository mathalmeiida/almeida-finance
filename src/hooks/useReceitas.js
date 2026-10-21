
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import {
  valorReceitaRecorrenteNoMes,
  frequenciaDaReceita,
  receitaRecorrenteAtivaNoMes,
} from '../lib/recorrenciaReceita'

export {
  valorReceitaRecorrenteNoMes,
  frequenciaDaReceita,
  receitaRecorrenteAtivaNoMes,
}

const FREQUENCIAS = new Set([
  'nao_repete',
  'semanal',
  'quinzenal',
  'mensal',
  'por_meses',
  'personalizado',
  'a_cada_10_dias',
  'a_cada_20_dias',
  'dias_especificos',
])

function prepararDados(dados) {
  const resultado = { ...dados }

  if (Object.prototype.hasOwnProperty.call(resultado, 'frequencia')) {
    if (!FREQUENCIAS.has(resultado.frequencia)) {
      throw new Error('Frequência de receita inválida.')
    }
    resultado.recorrente = resultado.frequencia !== 'nao_repete'
  }

  if (Object.prototype.hasOwnProperty.call(resultado, 'dias_do_mes')) {
    const dias = resultado.dias_do_mes
    if (dias != null && (
      !Array.isArray(dias) ||
      dias.length === 0 ||
      dias.some(d => !Number.isInteger(d) || d < 1 || d > 31) ||
      new Set(dias).size !== dias.length
    )) {
      throw new Error('Selecione dias do mês entre 1 e 31, sem repetições.')
    }
    resultado.dias_do_mes = dias == null
      ? null
      : [...dias].sort((a, b) => a - b)
  }

  if (
    resultado.frequencia === 'dias_especificos' &&
    (!Array.isArray(resultado.dias_do_mes) ||
      resultado.dias_do_mes.length === 0)
  ) {
    throw new Error('Selecione pelo menos um dia de recebimento.')
  }

  return resultado
}

function pertenceAoMes(dataISO, mes, ano) {
  if (mes == null || ano == null) return true
  if (!dataISO) return false
  const prefixo = `${ano}-${String(mes).padStart(2, '0')}-`
  return dataISO.startsWith(prefixo)
}

export function useReceitas(mes, ano) {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [receitas, setReceitas] = useState([])
  const [recorrentes, setRecorrentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!idEfetivo) {
      setReceitas([])
      setRecorrentes([])
      setCarregando(false)
      return
    }

    let cancelado = false
    setCarregando(true)
    setErro(null)

    async function carregar() {
      try {
        let query = supabase
          .from('receitas')
          .select('*')
          .eq('usuario_id', idEfetivo)
          .order('data', { ascending: false })

        if (mes != null && ano != null) {
          const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
          const ultimoDia = new Date(ano, mes, 0).getDate()
          const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
          query = query.gte('data', inicio).lte('data', fim)
        }

        const [lista, todas] = await Promise.all([
          query,
          supabase
            .from('receitas')
            .select('*')
            .eq('usuario_id', idEfetivo)
            .eq('recorrente', true),
        ])

        if (lista.error) throw lista.error
        if (todas.error) throw todas.error

        if (!cancelado) {
          setReceitas(lista.data || [])
          setRecorrentes(todas.data || [])
        }
      } catch (e) {
        if (!cancelado) {
          setErro(e.message || 'Erro ao carregar receitas.')
        }
      } finally {
        if (!cancelado) setCarregando(false)
      }
    }

    carregar()
    return () => { cancelado = true }
  }, [idEfetivo, mes, ano])

  async function buscar() {
    if (!idEfetivo) return

    setCarregando(true)
    setErro(null)

    try {
      let query = supabase
        .from('receitas')
        .select('*')
        .eq('usuario_id', idEfetivo)
        .order('data', { ascending: false })

      if (mes != null && ano != null) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const ultimoDia = new Date(ano, mes, 0).getDate()
        const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
        query = query.gte('data', inicio).lte('data', fim)
      }

      const { data, error } = await query
      if (error) throw error
      setReceitas(data || [])
    } catch (e) {
      setErro(e.message || 'Erro ao carregar receitas.')
      throw e
    } finally {
      setCarregando(false)
    }
  }

  async function buscarRecorrentes() {
    if (!idEfetivo) return

    const { data, error } = await supabase
      .from('receitas')
      .select('*')
      .eq('usuario_id', idEfetivo)
      .eq('recorrente', true)

    if (error) {
      setErro(error.message)
      throw error
    }

    setRecorrentes(data || [])
  }

  async function criar(dados) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) {
      throw new Error('Usuário não autenticado.')
    }

    const payload = prepararDados(dados)
    const { data, error } = await supabase
      .from('receitas')
      .insert([{ ...payload, usuario_id: usuario.id }])
      .select()
      .single()

    if (error) throw error

    if (pertenceAoMes(data.data, mes, ano)) {
      setReceitas(prev => [data, ...prev])
    }

    await buscarRecorrentes()
    return data
  }

  async function atualizar(id, dados) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) {
      throw new Error('Usuário não autenticado.')
    }

    const payload = prepararDados(dados)
    const { data, error } = await supabase
      .from('receitas')
      .update(payload)
      .eq('id', id)
      .eq('usuario_id', usuario.id)
      .select()
      .single()

    if (error) throw error

    setReceitas(prev => {
      const semAntiga = prev.filter(r => r.id !== id)
      return pertenceAoMes(data.data, mes, ano)
        ? [data, ...semAntiga]
        : semAntiga
    })

    await buscarRecorrentes()
    return data
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) {
      throw new Error('Usuário não autenticado.')
    }

    const { error } = await supabase
      .from('receitas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)

    if (error) throw error

    setReceitas(prev => prev.filter(r => r.id !== id))
    await buscarRecorrentes()
  }

  const total = receitas.reduce(
    (acc, r) => acc + (Number(r.valor) || 0),
    0
  )

  return {
    receitas,
    recorrentes,
    total,
    carregando,
    erro,
    criar,
    atualizar,
    remover,
    recarregar: buscar,
  }
}
