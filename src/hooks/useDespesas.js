import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Normaliza a frequência de uma despesa, com retrocompatibilidade:
// despesas antigas só têm "recorrente" + "recorrencia_meses".
export function frequenciaDaDespesa(d) {
  if (d.frequencia) return d.frequencia
  if (d.recorrente) return d.recorrencia_meses != null ? 'por_meses' : 'mensal'
  return 'nao_repete'
}

// Conta quantas vezes um dia da semana (0-6) ocorre em um mês/ano,
// a partir de um dia inicial (para o primeiro mês, conta só a partir dele).
function ocorrenciasSemanaisNoMes(ano, mes, diaSemana, diaInicialNoMes) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  let count = 0
  for (let dia = diaInicialNoMes; dia <= ultimoDia; dia++) {
    if (new Date(ano, mes - 1, dia).getDay() === diaSemana) count++
  }
  return count
}

/**
 * Calcula o valor total que uma despesa recorrente representa em um mês/ano,
 * considerando a frequência:
 *   - 'mensal'     → o próprio valor, 1x no mês
 *   - 'por_meses'  → o próprio valor, 1x no mês, limitado à duração
 *   - 'semanal'    → valor × número real de ocorrências do dia da semana no mês
 *   - 'diaria'     → valor × número real de dias do mês (ou dias restantes, no 1º mês)
 *   - 'nao_repete' → 0 (conta apenas no mês de origem, tratado à parte)
 *
 * A coluna "data" é a primeira ocorrência.
 *
 * @param {object} d    despesa
 * @param {number} ano
 * @param {number} mes  1-12
 * @returns {number} valor do mês (0 se não ativa nesse mês)
 */
export function valorDespesaRecorrenteNoMes(d, ano, mes) {
  const freq = frequenciaDaDespesa(d)
  if (freq === 'nao_repete') return 0

  const inicio = new Date(d.data + 'T12:00:00')
  const valor = Number(d.valor)

  const indiceMes =
    (ano - inicio.getFullYear()) * 12 + ((mes - 1) - inicio.getMonth())
  if (indiceMes < 0) return 0 // antes da primeira ocorrência

  const ehPrimeiroMes = indiceMes === 0
  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate()

  if (freq === 'mensal') {
    return valor
  }

  if (freq === 'por_meses') {
    const limite = d.recorrencia_meses != null ? Number(d.recorrencia_meses) : Infinity
    return indiceMes < limite ? valor : 0
  }

  if (freq === 'diaria') {
    // nº de dias do mês; no primeiro mês, conta a partir do dia de início
    const diaInicial = ehPrimeiroMes ? inicio.getDate() : 1
    const dias = ultimoDiaDoMes - diaInicial + 1
    return valor * dias
  }

  if (freq === 'semanal') {
    const diaSemana = inicio.getDay()
    const diaInicial = ehPrimeiroMes ? inicio.getDate() : 1
    const ocorrencias = ocorrenciasSemanaisNoMes(ano, mes, diaSemana, diaInicial)
    return valor * ocorrencias
  }

  return 0
}

/**
 * Mantida por compatibilidade: indica se a despesa recorrente tem valor neste mês.
 */
export function despesaRecorrenteAtivaNoMes(d, ano, mes) {
  return valorDespesaRecorrenteNoMes(d, ano, mes) > 0
}

export function useDespesas(mes, ano) {
  const { usuario } = useAuth()
  const [despesas, setDespesas] = useState([])
  // Todas as despesas recorrentes do usuário (sem filtro de mês).
  // Necessário para a projeção considerar recorrências com início em
  // qualquer mês e com duração definida.
  const [recorrentes, setRecorrentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!usuario) return
    buscar()
    buscarRecorrentes()
    // Depende do ID (não do objeto) para não refazer o fetch quando o Supabase
    // apenas renova o token e recria o objeto `usuario` com o mesmo id.
  }, [usuario?.id, mes, ano])

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

  // Busca todas as despesas recorrentes (independente do mês selecionado)
  async function buscarRecorrentes() {
    try {
      const { data, error } = await supabase
        .from('despesas')
        .select(`*, categorias (id, nome, icone, cor)`)
        .eq('usuario_id', usuario.id)
        .eq('recorrente', true)
      if (error) throw error
      setRecorrentes(data || [])
    } catch {
      // silencioso: a projeção apenas não considerará recorrências se falhar
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
    buscarRecorrentes()
    return data
  }

  async function atualizar(id, dados) {
    const { data, error } = await supabase
      .from('despesas')
      .update(dados)
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) {
      // Log detalhado do erro real do Supabase (message, details, hint, code)
      console.error('[atualizar despesa] erro Supabase:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      })
      throw error
    }
    setDespesas(prev => prev.map(d => d.id === id ? data : d))
    buscarRecorrentes()
    return data
  }

  async function remover(id) {
    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setDespesas(prev => prev.filter(d => d.id !== id))
    buscarRecorrentes()
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
    buscarRecorrentes()
    return data
  }

  // ─── Pagamento antecipado ───
  // Marca a despesa como paga em "pago_em" (data do pagamento), SEM alterar a
  // "data" (vencimento original). Opcionalmente registra a forma/conta usada.
  // O saldo passa a considerar pago_em (ver useProjecao), evitando dupla baixa.
  async function anteciparPagamento(id, { pago_em, forma_pagamento } = {}) {
    const campos = { pago_em: pago_em || new Date().toISOString().split('T')[0] }
    // Só sobrescreve a forma de pagamento se o usuário escolher uma.
    if (forma_pagamento) campos.forma_pagamento = forma_pagamento
    const { data, error } = await supabase
      .from('despesas')
      .update(campos)
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setDespesas(prev => prev.map(d => d.id === id ? data : d))
    buscarRecorrentes()
    return data
  }

  // Desfaz a antecipação (volta pago_em para NULL). Mantido para permitir
  // corrigir um pagamento marcado por engano, sem apagar a despesa.
  async function desfazerAntecipacao(id) {
    const { data, error } = await supabase
      .from('despesas')
      .update({ pago_em: null })
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    setDespesas(prev => prev.map(d => d.id === id ? data : d))
    buscarRecorrentes()
    return data
  }

  const total = despesas.reduce((acc, d) => acc + Number(d.valor), 0)

  return {
    despesas, recorrentes, total, carregando, erro,
    criar, atualizar, remover, alterarTipo,
    anteciparPagamento, desfazerAntecipacao,
    recarregar: buscar,
  }
}
