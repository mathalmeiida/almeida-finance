
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { hojeISO } from '../lib/utils'

const CAMPOS = '*, categorias (id, nome, icone, cor)'

export function frequenciaDaDespesa(d) {
  if (d.frequencia) return d.frequencia
  if (d.recorrente) {
    return d.recorrencia_meses != null
      ? 'por_meses'
      : 'mensal'
  }
  return 'nao_repete'
}

function ocorrenciasSemanaisNoMes(
  ano, mes, diaSemana, diaInicialNoMes
) {
  const ultimoDia = new Date(ano, mes, 0).getDate()
  let count = 0

  for (let dia = diaInicialNoMes; dia <= ultimoDia; dia++) {
    if (
      new Date(ano, mes - 1, dia).getDay() === diaSemana
    ) {
      count++
    }
  }

  return count
}

export function valorDespesaRecorrenteNoMes(d, ano, mes) {
  const freq = frequenciaDaDespesa(d)

  if (freq === 'nao_repete' || !d.data) return 0

  const inicio = new Date(`${d.data}T12:00:00`)
  if (Number.isNaN(inicio.getTime())) return 0

  const valor = Number(d.valor)
  if (!Number.isFinite(valor)) return 0

  const indiceMes =
    (ano - inicio.getFullYear()) * 12 +
    (mes - 1 - inicio.getMonth())

  if (indiceMes < 0) return 0

  if (freq === 'mensal') return valor

  if (freq === 'por_meses') {
    const limite =
      d.recorrencia_meses != null
        ? Number(d.recorrencia_meses)
        : Infinity

    return indiceMes < limite ? valor : 0
  }

  const diaInicial =
    indiceMes === 0 ? inicio.getDate() : 1

  if (freq === 'diaria') {
    const ultimoDia = new Date(ano, mes, 0).getDate()
    return valor * (ultimoDia - diaInicial + 1)
  }

  if (freq === 'semanal') {
    const ocorrencias = ocorrenciasSemanaisNoMes(
      ano,
      mes,
      inicio.getDay(),
      diaInicial
    )

    return valor * ocorrencias
  }

  return 0
}

export function despesaRecorrenteAtivaNoMes(d, ano, mes) {
  return valorDespesaRecorrenteNoMes(d, ano, mes) > 0
}

export function useDespesas(mes, ano) {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()

  const [despesas, setDespesas] = useState([])
  const [recorrentes, setRecorrentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) {
      setDespesas([])
      setCarregando(false)
      return []
    }

    setCarregando(true)
    setErro(null)

    try {
      let query = supabase
        .from('despesas')
        .select(CAMPOS)
        .eq('usuario_id', idEfetivo)
        .order('data', { ascending: false })

      if (mes != null && ano != null) {
        const inicio =
          `${ano}-${String(mes).padStart(2, '0')}-01`

        const ultimoDia =
          new Date(ano, mes, 0).getDate()

        const fim =
          `${ano}-${String(mes).padStart(2, '0')}-` +
          String(ultimoDia).padStart(2, '0')

        query = query
          .gte('data', inicio)
          .lte('data', fim)
      }

      const { data, error } = await query

      if (error) throw error

      setDespesas(data || [])
      return data || []
    } catch (err) {
      console.error('[Despesas] Erro ao carregar:', err)
      setErro(err.message || 'Erro ao carregar despesas')
      throw err
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo, mes, ano])

  const buscarRecorrentes = useCallback(async () => {
    if (!idEfetivo) {
      setRecorrentes([])
      return []
    }

    try {
      const { data, error } = await supabase
        .from('despesas')
        .select(CAMPOS)
        .eq('usuario_id', idEfetivo)
        .eq('recorrente', true)

      if (error) throw error

      setRecorrentes(data || [])
      return data || []
    } catch (err) {
      console.error(
        '[Despesas] Erro ao carregar recorrentes:',
        err
      )
      setErro(err.message || 'Erro nas recorrências')
      throw err
    }
  }, [idEfetivo])

  useEffect(() => {
    let ativo = true

    if (!idEfetivo) {
      setDespesas([])
      setRecorrentes([])
      setCarregando(false)
      return
    }

    async function carregarTudo() {
      const resultados = await Promise.allSettled([
        buscar(),
        buscarRecorrentes()
      ])

      if (!ativo) return

      resultados.forEach(resultado => {
        if (resultado.status === 'rejected') {
          console.error(
            '[Despesas] Falha no carregamento:',
            resultado.reason
          )
        }
      })
    }

    carregarTudo()

    return () => {
      ativo = false
    }
  }, [idEfetivo, buscar, buscarRecorrentes])

  async function sincronizar() {
    const resultados = await Promise.allSettled([
      buscar(),
      buscarRecorrentes()
    ])

    const falha = resultados.find(
      resultado => resultado.status === 'rejected'
    )

    if (falha) {
      console.error(
        '[Despesas] Falha na sincronização:',
        falha.reason
      )
      setErro('Dados salvos, mas houve erro ao atualizar a tela.')
    }
  }

  function validarEscrita() {
    bloquearSeConsultoria(modoConsultoria)

    if (!usuario?.id) {
      throw new Error(
        'Sessão não encontrada. Entre novamente na sua conta.'
      )
    }
  }

  async function criar(dados) {
    validarEscrita()

    if (!dados || typeof dados !== 'object') {
      throw new Error('Dados da despesa inválidos.')
    }

    const payload = {
      ...dados,
      usuario_id: usuario.id
    }

    const { data, error } = await supabase
      .from('despesas')
      .insert([payload])
      .select(CAMPOS)
      .single()

    if (error) {
      console.error('[Despesas] Erro ao criar:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        payload
      })
      throw error
    }

    await sincronizar()
    return data
  }

  async function atualizar(id, dados) {
    validarEscrita()

    if (!id) throw new Error('Despesa não identificada.')

    const { data, error } = await supabase
      .from('despesas')
      .update(dados)
      .eq('id', id)
      .eq('usuario_id', usuario.id)
      .select(CAMPOS)
      .single()

    if (error) {
      console.error('[Despesas] Erro ao atualizar:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        dados
      })
      throw error
    }

    await sincronizar()
    return data
  }

  async function remover(id) {
    validarEscrita()

    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)

    if (error) {
      console.error('[Despesas] Erro ao remover:', error)
      throw error
    }

    await sincronizar()
  }

  async function alterarTipo(id, tipo) {
    return atualizar(id, { tipo_despesa: tipo })
  }

  async function anteciparPagamento(
    id, { pago_em, forma_pagamento } = {}
  ) {
    const campos = {
      pago_em: pago_em || hojeISO()
    }

    if (forma_pagamento) {
      campos.forma_pagamento = forma_pagamento
    }

    return atualizar(id, campos)
  }

  async function desfazerAntecipacao(id) {
    return atualizar(id, { pago_em: null })
  }

  const total = despesas.reduce(
    (acc, d) => acc + (Number(d.valor) || 0),
    0
  )

  return {
    despesas,
    recorrentes,
    total,
    carregando,
    erro,
    criar,
    atualizar,
    remover,
    alterarTipo,
    anteciparPagamento,
    desfazerAntecipacao,
    recarregar: buscar
  }
}
