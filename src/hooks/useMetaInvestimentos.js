import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

// Vínculos (alocações) entre metas e investimentos. Um vínculo é um RECORTE do
// valor_atual de um investimento destinado a uma meta — não é aporte manual,
// não movimenta dinheiro. A validação forte (soma não excede o saldo) é feita
// no BANCO por trigger; aqui fazemos a validação de UX e a leitura derivada.
//
// Requer a migration 2026-10_metas_investimentos.sql aplicada. Enquanto a
// tabela não existir, o hook degrada com segurança (lista vazia + flag
// `indisponivel`) para não quebrar a página de Metas.
export function useMetaInvestimentos() {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [vinculos, setVinculos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [indisponivel, setIndisponivel] = useState(false) // migration pendente
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) return
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('metas_investimentos')
        .select('*')
        .eq('usuario_id', idEfetivo)
      if (error) {
        // 42P01 = tabela inexistente (migration ainda não aplicada).
        if (error.code === '42P01' || /does not exist/i.test(error.message)) {
          setIndisponivel(true)
          setVinculos([])
          return
        }
        throw error
      }
      setIndisponivel(false)
      setVinculos(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo])

  useEffect(() => { buscar() }, [buscar])

  // Cria um vínculo (ou retorna erro se já existir o par — então use editar).
  async function vincular({ meta_id, investimento_id, valor_alocado }) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('metas_investimentos')
      .insert([{ usuario_id: usuario.id, meta_id, investimento_id, valor_alocado: Number(valor_alocado) || 0 }])
      .select()
      .single()
    if (error) throw error
    setVinculos(prev => [...prev, data])
    return data
  }

  // Edita o valor alocado de um vínculo existente.
  async function editarValor(id, valor_alocado) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('metas_investimentos')
      .update({ valor_alocado: Number(valor_alocado) || 0 })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setVinculos(prev => prev.map(v => v.id === id ? data : v))
    return data
  }

  // Desvincula (remove o vínculo) — não exclui meta nem investimento.
  async function desvincular(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('metas_investimentos').delete().eq('id', id)
    if (error) throw error
    setVinculos(prev => prev.filter(v => v.id !== id))
  }

  // ─── Derivações ───
  const vinculosDaMeta = (metaId) => vinculos.filter(v => v.meta_id === metaId)
  const totalVinculadoMeta = (metaId) =>
    vinculosDaMeta(metaId).reduce((s, v) => s + (Number(v.valor_alocado) || 0), 0)
  const totalAlocadoInvestimento = (invId) =>
    vinculos.filter(v => v.investimento_id === invId).reduce((s, v) => s + (Number(v.valor_alocado) || 0), 0)

  // Saldo de um investimento disponível para alocar a metas:
  //   valor_atual - reserva_valor - (outros vínculos, exclui `exceto`).
  // Espelha exatamente a regra do trigger no banco.
  const disponivelInvestimento = (inv, exceto = null) => {
    if (!inv) return 0
    const base = (Number(inv.valor_atual) || 0) - (Number(inv.reserva_valor) || 0)
    const alocadoOutros = vinculos
      .filter(v => v.investimento_id === inv.id && v.id !== exceto)
      .reduce((s, v) => s + (Number(v.valor_alocado) || 0), 0)
    return Math.max(0, base - alocadoOutros)
  }

  // Inconsistências: vínculos cujo investimento teve o saldo reduzido depois,
  // de modo que a soma alocada passou do disponível. Retorna por investimento.
  const inconsistencias = (investimentos) => {
    const out = []
    for (const inv of investimentos || []) {
      const base = (Number(inv.valor_atual) || 0) - (Number(inv.reserva_valor) || 0)
      const alocado = totalAlocadoInvestimento(inv.id)
      if (alocado > base + 0.001) {
        out.push({ investimento: inv, alocado, disponivel: base, excesso: alocado - base })
      }
    }
    return out
  }

  return {
    vinculos, carregando, indisponivel, erro,
    vincular, editarValor, desvincular,
    vinculosDaMeta, totalVinculadoMeta, totalAlocadoInvestimento,
    disponivelInvestimento, inconsistencias,
    recarregar: buscar,
  }
}
