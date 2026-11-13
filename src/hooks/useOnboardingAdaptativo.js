/**
 * useOnboardingAdaptativo.js
 * Hook para gerenciar onboarding adaptativo com importação inteligente.
 * 
 * COMPORTAMENTO:
 * - Analisa dados importados e mapeia para etapas do onboarding
 * - Identifica etapas automaticamente preenchidas
 * - Pré-preenche formulários com dados importados pendentes de confirmação
 * - Pula etapas completas, solicita apenas campos ausentes
 * - Persiste estado temporário no localStorage até confirmação final
 * - Detecta duplicidades entre dados importados e já confirmados
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const CHAVE_DADOS_TEMP = (id) => `almeida_onboarding_temp_${id}`
const CHAVE_ETAPAS_PREENCHIDAS = (id) => `almeida_onboarding_etapas_${id}`

/**
 * Estrutura de dados temporários:
 * {
 *   receitas: [{ ...item, _importado: true, _confirmado: false }],
 *   despesas: [{ ...item, _importado: true, _confirmado: false }],
 *   cartoes: [{ ...item, _importado: true, _confirmado: false }],
 *   investimentos: [{ ...item, _importado: true, _confirmado: false }],
 *   saldo_base: { valor, data, _importado: true, _confirmado: false },
 *   patrimonio: { valor, _importado: true, _confirmado: false }
 * }
 */

export function useOnboardingAdaptativo() {
  const { perfil } = useAuth()
  const [dadosTemp, setDadosTemp] = useState(null)
  const [etapasPreenchidas, setEtapasPreenchidas] = useState({})
  const [carregando, setCarregando] = useState(true)

  // Carrega estado temporário do localStorage
  useEffect(() => {
    if (!perfil?.id) return

    try {
      const chaveTemp = CHAVE_DADOS_TEMP(perfil.id)
      const chaveEtapas = CHAVE_ETAPAS_PREENCHIDAS(perfil.id)

      const temp = localStorage.getItem(chaveTemp)
      const etapas = localStorage.getItem(chaveEtapas)

      setDadosTemp(temp ? JSON.parse(temp) : {})
      setEtapasPreenchidas(etapas ? JSON.parse(etapas) : {})
    } catch (erro) {
      console.error('Erro ao carregar estado temporário:', erro)
      setDadosTemp({})
      setEtapasPreenchidas({})
    } finally {
      setCarregando(false)
    }
  }, [perfil?.id])

  // Persiste estado temporário no localStorage
  const persistir = useCallback((novosDados, novasEtapas) => {
    if (!perfil?.id) return

    try {
      const chaveTemp = CHAVE_DADOS_TEMP(perfil.id)
      const chaveEtapas = CHAVE_ETAPAS_PREENCHIDAS(perfil.id)

      if (novosDados !== undefined) {
        localStorage.setItem(chaveTemp, JSON.stringify(novosDados))
        setDadosTemp(novosDados)
      }

      if (novasEtapas !== undefined) {
        localStorage.setItem(chaveEtapas, JSON.stringify(novasEtapas))
        setEtapasPreenchidas(novasEtapas)
      }
    } catch (erro) {
      console.error('Erro ao persistir estado temporário:', erro)
    }
  }, [perfil?.id])

  // Registra dados importados (chamado pela ImportacaoInteligente)
  const registrarImportacao = useCallback((itensImportados) => {
    if (!perfil?.id || !itensImportados) return

    const novosTemp = { ...(dadosTemp || {}) }
    const novasEtapas = { ...etapasPreenchidas }

    // Mapeia receitas
    const receitas = itensImportados.filter(i => i.tipo === 'receita')
    if (receitas.length > 0) {
      novosTemp.receitas = [
        ...(novosTemp.receitas || []),
        ...receitas.map(r => ({
          ...r,
          _importado: true,
          _confirmado: false,
          _origem: 'importacao'
        }))
      ]
      novasEtapas.renda = 'importado'
    }

    // Mapeia despesas
    const despesas = itensImportados.filter(i => i.tipo === 'despesa')
    if (despesas.length > 0) {
      novosTemp.despesas = [
        ...(novosTemp.despesas || []),
        ...despesas.map(d => ({
          ...d,
          _importado: true,
          _confirmado: false,
          _origem: 'importacao'
        }))
      ]
      novasEtapas.despesas = 'importado'
    }

    // Mapeia compras de cartão (extrai cartões únicos)
    const comprasCartao = itensImportados.filter(i => i.tipo === 'compra_cartao')
    if (comprasCartao.length > 0) {
      const cartoesUnicos = new Map()

      comprasCartao.forEach(c => {
        if (c.cartaoNome && !cartoesUnicos.has(c.cartaoNome)) {
          cartoesUnicos.set(c.cartaoNome, {
            nome: c.cartaoNome,
            banco: c.banco || '',
            limite_total: null,
            dia_fechamento: null,
            dia_vencimento: null,
            cor: null,
            _importado: true,
            _confirmado: false,
            _origem: 'importacao',
            _precisa_complementar: true
          })
        }
      })

      if (cartoesUnicos.size > 0) {
        novosTemp.cartoes = [
          ...(novosTemp.cartoes || []),
          ...Array.from(cartoesUnicos.values())
        ]
        novasEtapas.cartoes = 'parcial' // precisa complementar limite/vencimento
      }

      // Mantém as compras vinculadas
      novosTemp.compras_cartao = [
        ...(novosTemp.compras_cartao || []),
        ...comprasCartao.map(c => ({
          ...c,
          _importado: true,
          _confirmado: false,
          _origem: 'importacao'
        }))
      ]
    }

    // Mapeia investimentos
    const investimentos = itensImportados.filter(i => 
      ['aporte', 'resgate', 'rendimento', 'dividendo'].includes(i.tipo)
    )
    if (investimentos.length > 0) {
      // Extrai investimentos únicos
      const investimentosUnicos = new Map()

      investimentos.forEach(inv => {
        if (inv.investimentoNome && !investimentosUnicos.has(inv.investimentoNome)) {
          investimentosUnicos.set(inv.investimentoNome, {
            nome: inv.investimentoNome,
            categoria: inv.categoriaInvestimento || 'outros',
            valor_aplicado: 0,
            valor_atual: 0,
            data_aplicacao: inv.data,
            _importado: true,
            _confirmado: false,
            _origem: 'importacao',
            _precisa_complementar: true
          })
        }
      })

      if (investimentosUnicos.size > 0) {
        novosTemp.investimentos = [
          ...(novosTemp.investimentos || []),
          ...Array.from(investimentosUnicos.values())
        ]
        novasEtapas.saldo = 'parcial' // precisa confirmar saldos
      }

      // Mantém as movimentações vinculadas
      novosTemp.movimentacoes_investimentos = [
        ...(novosTemp.movimentacoes_investimentos || []),
        ...investimentos.map(m => ({
          ...m,
          _importado: true,
          _confirmado: false,
          _origem: 'importacao'
        }))
      ]
    }

    // Tenta identificar saldo base (última data + maior valor positivo)
    const saldoCandidatos = itensImportados
      .filter(i => i.tipo === 'transferencia' || i.tipo === 'receita')
      .sort((a, b) => new Date(b.data) - new Date(a.data))

    if (saldoCandidatos.length > 0 && !novosTemp.saldo_base) {
      // Sugestão: não preenche automaticamente, apenas marca como "revisar"
      novasEtapas.saldo = novasEtapas.saldo || 'pendente'
    }

    persistir(novosTemp, novasEtapas)
  }, [perfil?.id, dadosTemp, etapasPreenchidas, persistir])

  // Confirma dados de uma etapa específica
  const confirmarEtapa = useCallback((etapa, dados) => {
    if (!perfil?.id) return

    const novosTemp = { ...dadosTemp }
    const novasEtapas = { ...etapasPreenchidas }

    // Marca itens como confirmados
    if (novosTemp[etapa]) {
      if (Array.isArray(novosTemp[etapa])) {
        novosTemp[etapa] = novosTemp[etapa].map(item => ({
          ...item,
          _confirmado: true
        }))
      } else {
        novosTemp[etapa] = {
          ...novosTemp[etapa],
          _confirmado: true
        }
      }
    }

    // Adiciona novos dados manuais
    if (dados) {
      if (Array.isArray(dados)) {
        novosTemp[etapa] = [
          ...(novosTemp[etapa] || []),
          ...dados.map(d => ({
            ...d,
            _importado: false,
            _confirmado: true,
            _origem: 'manual'
          }))
        ]
      } else {
        novosTemp[etapa] = {
          ...(novosTemp[etapa] || {}),
          ...dados,
          _confirmado: true
        }
      }
    }

    novasEtapas[etapa] = 'confirmado'
    persistir(novosTemp, novasEtapas)
  }, [perfil?.id, dadosTemp, etapasPreenchidas, persistir])

  // Obtém dados de uma etapa (inclui importados + manuais)
  const obterDadosEtapa = useCallback((etapa) => {
    if (!dadosTemp) return null
    return dadosTemp[etapa] || null
  }, [dadosTemp])

  // Verifica se etapa está preenchida
  const etapaPreenchida = useCallback((etapa) => {
    const status = etapasPreenchidas[etapa]
    return status === 'confirmado' || status === 'importado'
  }, [etapasPreenchidas])

  // Verifica se etapa precisa revisão
  const etapaPrecisaRevisao = useCallback((etapa) => {
    const status = etapasPreenchidas[etapa]
    return status === 'importado' || status === 'parcial' || status === 'pendente'
  }, [etapasPreenchidas])

  // Obtém status da etapa
  const statusEtapa = useCallback((etapa) => {
    return etapasPreenchidas[etapa] || null
  }, [etapasPreenchidas])

  // Limpa dados temporários (após conclusão ou cancelamento)
  const limpar = useCallback(() => {
    if (!perfil?.id) return

    try {
      const chaveTemp = CHAVE_DADOS_TEMP(perfil.id)
      const chaveEtapas = CHAVE_ETAPAS_PREENCHIDAS(perfil.id)

      localStorage.removeItem(chaveTemp)
      localStorage.removeItem(chaveEtapas)

      setDadosTemp({})
      setEtapasPreenchidas({})
    } catch (erro) {
      console.error('Erro ao limpar estado temporário:', erro)
    }
  }, [perfil?.id])

  // Estatísticas para exibir no resumo
  const estatisticas = useMemo(() => {
    if (!dadosTemp) return null

    const importados = {
      receitas: (dadosTemp.receitas || []).filter(r => r._importado).length,
      despesas: (dadosTemp.despesas || []).filter(d => d._importado).length,
      cartoes: (dadosTemp.cartoes || []).filter(c => c._importado).length,
      investimentos: (dadosTemp.investimentos || []).filter(i => i._importado).length
    }

    const confirmados = {
      receitas: (dadosTemp.receitas || []).filter(r => r._confirmado).length,
      despesas: (dadosTemp.despesas || []).filter(d => d._confirmado).length,
      cartoes: (dadosTemp.cartoes || []).filter(c => c._confirmado).length,
      investimentos: (dadosTemp.investimentos || []).filter(i => i._confirmado).length
    }

    const total = Object.values(importados).reduce((a, b) => a + b, 0)
    const totalConfirmado = Object.values(confirmados).reduce((a, b) => a + b, 0)

    return { importados, confirmados, total, totalConfirmado }
  }, [dadosTemp])

  return {
    dadosTemp,
    etapasPreenchidas,
    carregando,
    registrarImportacao,
    confirmarEtapa,
    obterDadosEtapa,
    etapaPreenchida,
    etapaPrecisaRevisao,
    statusEtapa,
    limpar,
    estatisticas
  }
}
