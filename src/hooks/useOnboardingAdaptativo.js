/**
 * useOnboardingAdaptativo.js
 * Hook para gerenciar onboarding adaptativo com importação inteligente.
 * 
 * IMPORTANTE: ImportacaoInteligente JÁ GRAVA dados no Supabase antes de chamar onConcluir.
 * Este hook apenas RASTREIA o que foi importado para rehidratar as etapas corretamente.
 * 
 * COMPORTAMENTO:
 * - Registra IDs dos itens já gravados pela importação
 * - Rehidrata formulários com dados já salvos
 * - Identifica etapas que precisam complemento (campos faltantes)
 * - Persiste apenas REFERÊNCIAS no localStorage (não dados completos)
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

const CHAVE_IMPORTACAO_IDS = (id) => `almeida_onboarding_importacao_${id}`
const CHAVE_ETAPAS_STATUS = (id) => `almeida_onboarding_status_${id}`

/**
 * Estrutura de rastreamento (localStorage):
 * {
 *   receitas: [id1, id2, id3],  // IDs já gravados
 *   despesas: [id1, id2],
 *   cartoes: [id1],
 *   timestamp: Date.now()
 * }
 */

export function useOnboardingAdaptativo() {
  const { perfil } = useAuth()
  const [idsImportados, setIdsImportados] = useState(null)
  const [statusEtapas, setStatusEtapas] = useState({})
  const [carregando, setCarregando] = useState(true)

  // Carrega IDs importados do localStorage
  useEffect(() => {
    if (!perfil?.id) return

    try {
      const chaveIds = CHAVE_IMPORTACAO_IDS(perfil.id)
      const chaveStatus = CHAVE_ETAPAS_STATUS(perfil.id)

      const ids = localStorage.getItem(chaveIds)
      const status = localStorage.getItem(chaveStatus)

      setIdsImportados(ids ? JSON.parse(ids) : {})
      setStatusEtapas(status ? JSON.parse(status) : {})
    } catch (erro) {
      console.error('Erro ao carregar IDs importados:', erro)
      setIdsImportados({})
      setStatusEtapas({})
    } finally {
      setCarregando(false)
    }
  }, [perfil?.id])

  // Persiste IDs no localStorage
  const persistir = useCallback((novosIds, novoStatus) => {
    if (!perfil?.id) return

    try {
      const chaveIds = CHAVE_IMPORTACAO_IDS(perfil.id)
      const chaveStatus = CHAVE_ETAPAS_STATUS(perfil.id)

      if (novosIds !== undefined) {
        localStorage.setItem(chaveIds, JSON.stringify(novosIds))
        setIdsImportados(novosIds)
      }

      if (novoStatus !== undefined) {
        localStorage.setItem(chaveStatus, JSON.stringify(novoStatus))
        setStatusEtapas(novoStatus)
      }
    } catch (erro) {
      console.error('Erro ao persistir IDs:', erro)
    }
  }, [perfil?.id])

  // Registra importação (chamado após ImportacaoInteligente gravar)
  const registrarImportacao = useCallback((resultado) => {
    if (!perfil?.id || !resultado?.itens) return

    const novosIds = { ...(idsImportados || {}) }
    const novoStatus = { ...statusEtapas }

    // Agrupa itens por tabela
    const porTabela = resultado.itens.reduce((acc, item) => {
      if (!acc[item.tabela]) acc[item.tabela] = []
      if (item.id) acc[item.tabela].push(item.id)
      return acc
    }, {})

    // Mapeia para etapas do onboarding
    if (porTabela.receitas?.length > 0) {
      novosIds.receitas = [...(novosIds.receitas || []), ...porTabela.receitas]
      novoStatus.receitas = 'importado'
    }

    if (porTabela.despesas?.length > 0) {
      novosIds.despesas = [...(novosIds.despesas || []), ...porTabela.despesas]
      novoStatus.despesas = 'parcial' // precisa tipo_despesa e forma_pagamento
    }

    if (porTabela.compras_cartao?.length > 0) {
      novosIds.compras_cartao = [...(novosIds.compras_cartao || []), ...porTabela.compras_cartao]
      // Extrai cartões únicos (se possível do resultado)
      novoStatus.cartoes = 'parcial' // precisa limite e vencimento
    }

    if (porTabela.investimentos_movimentacoes?.length > 0) {
      novosIds.investimentos_movimentacoes = [
        ...(novosIds.investimentos_movimentacoes || []), 
        ...porTabela.investimentos_movimentacoes
      ]
      novoStatus.investimentos = 'parcial'
    }

    novosIds.timestamp = Date.now()
    persistir(novosIds, novoStatus)
  }, [perfil?.id, idsImportados, statusEtapas, persistir])

  // Marca etapa como confirmada
  const confirmarEtapa = useCallback((etapa) => {
    const novoStatus = { ...statusEtapas, [etapa]: 'confirmado' }
    persistir(undefined, novoStatus)
  }, [statusEtapas, persistir])

  // Verifica se etapa tem dados importados
  const temDadosImportados = useCallback((etapa) => {
    if (!idsImportados) return false
    
    const mapa = {
      receitas: 'receitas',
      despesas: 'despesas',
      cartoes: 'compras_cartao',
      investimentos: 'investimentos_movimentacoes'
    }
    
    const chave = mapa[etapa]
    return chave && idsImportados[chave]?.length > 0
  }, [idsImportados])

  // Verifica se etapa precisa revisão
  const etapaPrecisaRevisao = useCallback((etapa) => {
    const status = statusEtapas[etapa]
    return status === 'importado' || status === 'parcial'
  }, [statusEtapas])

  // Obtém status da etapa
  const statusEtapa = useCallback((etapa) => {
    return statusEtapas[etapa] || null
  }, [statusEtapas])

  // Limpa dados (após conclusão)
  const limpar = useCallback(() => {
    if (!perfil?.id) return

    try {
      const chaveIds = CHAVE_IMPORTACAO_IDS(perfil.id)
      const chaveStatus = CHAVE_ETAPAS_STATUS(perfil.id)

      localStorage.removeItem(chaveIds)
      localStorage.removeItem(chaveStatus)

      setIdsImportados({})
      setStatusEtapas({})
    } catch (erro) {
      console.error('Erro ao limpar IDs:', erro)
    }
  }, [perfil?.id])

  // Estatísticas
  const estatisticas = useMemo(() => {
    if (!idsImportados) return null

    const total = Object.values(idsImportados)
      .filter(v => Array.isArray(v))
      .reduce((sum, arr) => sum + arr.length, 0)

    return {
      total,
      receitas: idsImportados.receitas?.length || 0,
      despesas: idsImportados.despesas?.length || 0,
      compras_cartao: idsImportados.compras_cartao?.length || 0,
      investimentos: idsImportados.investimentos_movimentacoes?.length || 0
    }
  }, [idsImportados])

  return {
    idsImportados,
    statusEtapas: statusEtapas,
    etapasPreenchidas: statusEtapas, // alias para compatibilidade
    carregando,
    registrarImportacao,
    confirmarEtapa,
    temDadosImportados,
    etapaPrecisaRevisao,
    statusEtapa,
    limpar,
    estatisticas
  }
}
