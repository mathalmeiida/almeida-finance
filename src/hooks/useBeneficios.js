import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { hojeISO, partesHojeBrasil } from '../lib/utils'
import { efeitoNoSaldo, calcularSaldo, totalGastoNoMesCompetencia } from '../lib/beneficiosCalculos'

// Reexporta a função pura (compat. com quem importava daqui).
export { efeitoNoSaldo }

/**
 * Hook de Benefícios (VR/VA). Lê benefícios + movimentações do usuário e expõe
 * o saldo derivado (soma assinada das movimentações) e o total gasto no mês.
 * Totalmente separado do saldo bancário/limite diário (nada aqui alimenta o
 * useProjecao).
 */
export function useBeneficios() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [beneficios, setBeneficios] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) return
    setCarregando(true); setErro(null)
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

  useEffect(() => { if (idEfetivo) buscar() }, [idEfetivo, buscar])

  // ─── Benefícios (CRUD) ───
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
      .select()
      .single()
    if (error) throw error
    setBeneficios(prev => [...prev, data])
    // Saldo inicial > 0 vira a 1ª movimentação (recarga manual), para o extrato
    // refletir de onde veio o saldo.
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
      .from('beneficios').update(campos).eq('id', id).select().single()
    if (error) throw error
    setBeneficios(prev => prev.map(b => b.id === id ? data : b))
    return data
  }

  async function removerBeneficio(id) {
    bloquearSeConsultoria(modoConsultoria)
    // As movimentações caem por ON DELETE CASCADE no banco.
    const { error } = await supabase.from('beneficios').delete().eq('id', id)
    if (error) throw error
    setBeneficios(prev => prev.filter(b => b.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.beneficio_id !== id))
  }

  // ─── Movimentações (CRUD) ───
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
      .select()
      .single()
    if (error) throw error
    setMovimentacoes(prev => [data, ...prev])
    return data
  }

  async function atualizarMovimentacao(id, campos) {
    bloquearSeConsultoria(modoConsultoria)
    const limpo = { ...campos }
    if (limpo.valor != null) limpo.valor = Math.abs(Number(limpo.valor) || 0)
    const { data, error } = await supabase
      .from('beneficios_movimentacoes').update(limpo).eq('id', id).select().single()
    if (error) throw error
    setMovimentacoes(prev => prev.map(m => m.id === id ? data : m))
    return data
  }

  async function removerMovimentacao(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('beneficios_movimentacoes').delete().eq('id', id)
    if (error) throw error
    setMovimentacoes(prev => prev.filter(m => m.id !== id))
  }

  // ─── Recarga automática do mês (idempotente) ───
  // Para benefícios com recarga recorrente, lança a recarga do mês corrente SE:
  //   • hoje >= recarga_dia; e
  //   • ainda não existe recarga automática para (benefício, competência).
  // O índice único parcial no banco é a trava final contra duplicidade; aqui
  // evitamos a tentativa quando já há uma na memória.
  async function aplicarRecargasDoMes() {
    if (modoConsultoria || !usuario) return
    const { ano, mes, dia } = partesHojeBrasil()
    const competencia = `${ano}-${String(mes).padStart(2, '0')}`
    for (const b of beneficios) {
      if (!b.recarga_recorrente) continue
      const valor = Number(b.recarga_valor) || 0
      if (valor <= 0) continue
      const diaRecarga = Number(b.recarga_dia) || 1
      if (dia < diaRecarga) continue // ainda não chegou o dia da recarga
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
        // Conflito do índice único (corrida/duplicata) é ignorado com segurança.
      }
    }
  }

  // ─── Derivações (saldo e total do mês) ───
  const movsDeBeneficio = (bid) => movimentacoes.filter(m => m.beneficio_id === bid)

  function saldoDoBeneficio(bid) {
    return calcularSaldo(movsDeBeneficio(bid))
  }

  function totalGastoNoMes(bid, ref = partesHojeBrasil()) {
    const competencia = `${ref.ano}-${String(ref.mes).padStart(2, '0')}`
    return totalGastoNoMesCompetencia(movsDeBeneficio(bid), competencia)
  }

  // Próxima data de recarga (texto curto) a partir de recarga_dia.
  function proximaRecarga(b) {
    if (!b.recarga_recorrente || !b.recarga_dia) return null
    const { ano, mes, dia } = partesHojeBrasil()
    let alvoAno = ano, alvoMes = mes
    if (dia >= b.recarga_dia) { alvoMes += 1; if (alvoMes > 12) { alvoMes = 1; alvoAno += 1 } }
    const diaStr = String(b.recarga_dia).padStart(2, '0')
    return `${diaStr}/${String(alvoMes).padStart(2, '0')}/${alvoAno}`
  }

  return {
    beneficios, movimentacoes, carregando, erro,
    criarBeneficio, atualizarBeneficio, removerBeneficio,
    criarMovimentacao, atualizarMovimentacao, removerMovimentacao,
    aplicarRecargasDoMes,
    saldoDoBeneficio, totalGastoNoMes, movsDeBeneficio, proximaRecarga,
    recarregar: buscar,
  }
}
