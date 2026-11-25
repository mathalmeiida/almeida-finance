import { useMemo } from 'react'
import { useDespesas } from './useDespesas'

/**
 * Hook: Assinaturas
 * 
 * Identifica despesas recorrentes (assinaturas) com base em:
 * - Despesas marcadas como fixas
 * - Descrição contém palavras-chave de serviços de assinatura
 * - Mesmo valor e descrição se repetem mensalmente
 * 
 * Agrupa por status: ativas, canceladas (últimos 3 meses)
 */
export function useAssinaturas() {
  const { despesas } = useDespesas()

  const assinaturas = useMemo(() => {
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()

    // Palavras-chave para identificar assinaturas
    const palavrasChave = [
      'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'apple', 'youtube',
      'google', 'microsoft', 'adobe', 'dropbox', 'icloud', 'onedrive',
      'assinatura', 'mensalidade', 'academia', 'gym', 'internet', 'celular',
      'tv', 'streaming', 'plano', 'subscription'
    ]

    // Identificar despesas que são assinaturas
    const candidatas = despesas.filter(d => {
      // 1. Despesas fixas são automaticamente assinaturas
      if (d.fixa) return true

      // 2. Descrição contém palavra-chave de assinatura
      const descricao = (d.descricao || '').toLowerCase()
      return palavrasChave.some(palavra => descricao.includes(palavra))
    })

    // Agrupar por descrição similar e calcular recorrência
    const grupos = {}
    candidatas.forEach(d => {
      const chave = (d.descricao || '').toLowerCase().trim()
      if (!grupos[chave]) {
        grupos[chave] = []
      }
      grupos[chave].push(d)
    })

    // Montar lista de assinaturas com status
    const resultado = []
    Object.entries(grupos).forEach(([descricao, despesasGrupo]) => {
      // Ordenar por data
      const ordenadas = despesasGrupo.sort((a, b) => {
        const dataA = a.data_vencimento ? new Date(a.data_vencimento) : new Date(0)
        const dataB = b.data_vencimento ? new Date(b.data_vencimento) : new Date(0)
        return dataB - dataA
      })

      const maisRecente = ordenadas[0]
      const dataMaisRecente = maisRecente.data_vencimento 
        ? new Date(maisRecente.data_vencimento + 'T12:00:00')
        : null

      // Considerar ativa se última ocorrência foi nos últimos 60 dias
      const diasDesdeUltima = dataMaisRecente 
        ? Math.ceil((hoje - dataMaisRecente) / 86400000)
        : 999

      const ativa = diasDesdeUltima <= 60

      // Calcular valor mensal (média se houver variação)
      const valores = despesasGrupo.map(d => Number(d.valor) || 0)
      const valorMedio = valores.reduce((a, b) => a + b, 0) / valores.length

      // Próximo vencimento (se ativa)
      let proximoVencimento = null
      if (ativa && dataMaisRecente) {
        proximoVencimento = new Date(dataMaisRecente)
        proximoVencimento.setMonth(proximoVencimento.getMonth() + 1)
      }

      resultado.push({
        id: maisRecente.id,
        descricao: maisRecente.descricao,
        valorMensal: valorMedio,
        ativa,
        proximoVencimento: proximoVencimento ? proximoVencimento.toISOString().split('T')[0] : null,
        ultimaOcorrencia: maisRecente.data_vencimento,
        categoria: maisRecente.categoria,
        fixa: maisRecente.fixa,
        ocorrencias: despesasGrupo.length,
        diasDesdeUltima
      })
    })

    // Separar ativas e canceladas
    const ativas = resultado.filter(a => a.ativa).sort((a, b) => b.valorMensal - a.valorMensal)
    const canceladas = resultado.filter(a => !a.ativa).sort((a, b) => a.diasDesdeUltima - b.diasDesdeUltima)

    // Total mensal (apenas ativas)
    const totalMensal = ativas.reduce((acc, a) => acc + a.valorMensal, 0)

    return {
      ativas,
      canceladas,
      todas: resultado,
      totalMensal,
      totalAtivas: ativas.length,
      totalCanceladas: canceladas.length
    }
  }, [despesas])

  return assinaturas
}
