import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { hojeISO, partesHojeBrasil } from '../lib/utils'
import { efeitoNoSaldo, calcularSaldo, totalGastoNoMesCompetencia } from '../lib/beneficiosCalculos'

export { efeitoNoSaldo }

/** Hook de benefícios (VR/VA), separado das contas bancárias. */
export function useBeneficios() {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [beneficios, setBeneficios] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) {
      setBeneficios([])
      setMovimentacoes([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const [b, m] = await Promise.all([
        supabase.from('beneficios').select('*').eq('usuario_id', idEfetivo).order('criado_em', { ascending: true }),
        supabase.from('beneficios_movimentacoes').select('*').eq('usuario_id', idEfetivo).order('data', { ascending: false }),
      ])
      if (b.error) throw b.error
      if (m.error) throw m.error
      setBeneficios(b.data || [])
      setMovimentacoes(m.data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo])

  useEffect(() => { buscar() }, [buscar])

  async function criarBeneficio({ nome, tipo, saldo_inicial = 0, recarga_valor = 0, recarga_dia = null, recarga_recorrente = false }) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('beneficios')
      .insert([{
        usuario_id: usuario.id,
        nome, tipo,
        saldo_inicial: Number(saldo_inicial) || 0,
        recarga_valor: Number(recarga_valor) || 0,
        recarga_dia: recarga_dia || null,
        recarga_recorrente: !!recarga_recorrente,
      }])
      .select().single()
    if (error) throw error
    setBeneficios(prev => [...prev, data])
    const ini = Number(saldo_inicial) || 0
    if (ini > 0) {
      await criarMovimentacao({
        beneficio_id: data.id, tipo: 'recarga', valor: ini,
        descricao: 'Saldo inicial', data: hojeISO(), automatica: false,
      })
    }
    return data
  }

  async function atualizarBeneficio(id, campos) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('beneficios').update(campos)
      .eq('id', id).eq('usuario_id', usuario.id)
      .select().single()
    if (error) throw error
    setBeneficios(prev => prev.map(b => b.id === id ? data : b))
    return data
  }

  async function removerBeneficio(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('beneficios').delete()
      .eq('id', id).eq('usuario_id', usuario.id)
    if (error) throw error
    setBeneficios(prev => prev.filter(b => b.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.beneficio_id !== id))
  }

  async function criarMovimentacao({ beneficio_id, tipo, valor, descricao = null, data: dataMov = null, competencia = null, automatica = false }) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('beneficios_movimentacoes')
      .insert([{
        usuario_id: usuario.id,
        beneficio_id, tipo,
        valor: Math.abs(Number(valor) || 0),
        descricao: descricao || null,
        data: dataMov || hojeISO(),
        competencia: competencia || null,
        automatica: !!automatica,
      }])
      .select().single()
    if (error) throw error
    setMovimentacoes(prev => [data, ...prev])
    return data
  }

  async function atualizarMovimentacao(id, campos) {
    bloquearSeConsultoria(modoConsultoria)
    const limpo = { ...campos }
    if (limpo.valor != null) limpo.valor = Math.abs(Number(limpo.valor) || 0)
    const { data, error } = await supabase
      .from('beneficios_movimentacoes').update(limpo)
      .eq('id', id).eq('usuario_id', usuario.id)
      .select().single()
    if (error) throw error
    setMovimentacoes(prev => prev.map(m => m.id === id ? data : m))
    return data
  }

  async function removerMovimentacao(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('beneficios_movimentacoes').delete()
      .eq('id', id).eq('usuario_id', usuario.id)
    if (error) throw error
    setMovimentacoes(prev => prev.filter(m => m.id !== id))
  }

  /** Registra um gasto simples e atualiza o saldo derivado pelo histórico. */
  async function registrarGastoRapido({ beneficio_id, valor, descricao = '' }) {
    bloquearSeConsultoria(modoConsultoria)
    if (!usuario?.id) throw new Error('Entre na sua conta para registrar o gasto.')
    if (!beneficio_id) throw new Error('Selecione um cartão VR ou VA.')

    const quantia = typeof valor === 'string'
      ? Number(valor.trim().includes(',') ? valor.trim().replace(/\./g, '').replace(',', '.') : valor.trim())
      : Number(valor)
    if (!Number.isFinite(quantia) || quantia <= 0) {
      throw new Error('Informe um valor maior que zero.')
    }
    const centavos = Math.round(quantia * 100)
    if (centavos <= 0) throw new Error('Informe um valor válido.')
    const valorFinal = centavos / 100

    const { data: beneficio, error: erroBeneficio } = await supabase
      .from('beneficios').select('id, tipo')
      .eq('id', beneficio_id).eq('usuario_id', usuario.id).single()
    if (erroBeneficio || !beneficio) throw new Error('Benefício não encontrado nesta conta.')
    if (!['vr', 'va'].includes(String(beneficio.tipo).toLowerCase())) {
      throw new Error('Escolha um benefício VR ou VA.')
    }

    // Consulta atualizada para evitar validar contra um saldo antigo da tela.
    const { data: movs, error: erroMovs } = await supabase
      .from('beneficios_movimentacoes').select('*')
      .eq('beneficio_id', beneficio_id).eq('usuario_id', usuario.id)
    if (erroMovs) throw erroMovs
    const saldoAtual = calcularSaldo(movs || [])
    if (centavos > Math.round(saldoAtual * 100)) {
      throw new Error('Saldo insuficiente neste benefício.')
    }

    return criarMovimentacao({
      beneficio_id,
      tipo: 'compra',
      valor: valorFinal,
      descricao: String(descricao || '').trim() || 'Gasto rápido',
      data: hojeISO(),
      automatica: false,
    })
  }

  async function aplicarRecargasDoMes() {
    if (modoConsultoria || !usuario) return
    const { ano, mes, dia } = partesHojeBrasil()
    const competencia = `${ano}-${String(mes).padStart(2, '0')}`
    for (const b of beneficios) {
      if (!b.recarga_recorrente) continue
      const valor = Number(b.recarga_valor) || 0
      if (valor <= 0) continue
      const diaRecarga = Number(b.recarga_dia) || 1
      if (dia < diaRecarga) continue
      const jaTem = movimentacoes.some(m =>
        m.beneficio_id === b.id && m.tipo === 'recarga' && m.automatica && m.competencia === competencia
      )
      if (jaTem) continue
      try {
        await criarMovimentacao({
          beneficio_id: b.id, tipo: 'recarga', valor,
          descricao: 'Recarga mensal', data: hojeISO(),
          competencia, automatica: true,
        })
      } catch {
        // O índice único no banco impede uma segunda recarga automática.
      }
    }
  }

  const movsDeBeneficio = (bid) => movimentacoes.filter(m => m.beneficio_id === bid)

  function saldoDoBeneficio(bid) {
    return calcularSaldo(movsDeBeneficio(bid))
  }

  function totalGastoNoMes(bid, ref = partesHojeBrasil()) {
    const competencia = `${ref.ano}-${String(ref.mes).padStart(2, '0')}`
    return totalGastoNoMesCompetencia(movsDeBeneficio(bid), competencia)
  }

  function proximaRecarga(b) {
    if (!b.recarga_recorrente || !b.recarga_dia) return null
    const { ano, mes, dia } = partesHojeBrasil()
    let alvoAno = ano, alvoMes = mes
    if (dia >= b.recarga_dia) {
      alvoMes += 1
      if (alvoMes > 12) { alvoMes = 1; alvoAno += 1 }
    }
    const diaStr = String(b.recarga_dia).padStart(2, '0')
    return `${diaStr}/${String(alvoMes).padStart(2, '0')}/${alvoAno}`
  }

  return {
    beneficios, movimentacoes, carregando, erro,
    criarBeneficio, atualizarBeneficio, removerBeneficio,
    criarMovimentacao, atualizarMovimentacao, removerMovimentacao,
    registrarGastoRapido,
    aplicarRecargasDoMes,
    saldoDoBeneficio, totalGastoNoMes, movsDeBeneficio, proximaRecarga,
    recarregar: buscar,
  }
}