import { useState, useEffect, useMemo } from 'react'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useComprasCartao } from './useComprasCartao'
import { useFaturasCartao } from './useFaturasCartao'
import { useParcelamentos } from './useParcelamentos'
import { linhasFaturaCompleta, totalFaturaComOverride } from '../lib/faturaCartao'

/**
 * Hook para calcular o Custo de Vida mensal usando APENAS dados reais.
 * 
 * Regras:
 * 1. Usar despesas reais já cadastradas (tabela despesas)
 * 2. Incluir parcelas de cartão do mês (via linhasFaturaCompleta)
 * 3. Incluir despesas recorrentes projetadas para o mês
 * 4. NÃO inventar valores - se não há dados, retorna null
 * 5. Categorias essenciais: Alimentação, Moradia, Transporte, Saúde, Educação, Outros
 * 
 * @param {number} ano - Ano de referência
 * @param {number} mes - Mês de referência (1-12)
 * @returns {Object} Dados do custo de vida
 */
export function useCustoDeVida(ano, mes) {
  const { despesas, carregando: carregandoDespesas } = useDespesas()
  const { cartoes } = useCartoes()
  const { compras: todasComprasCartao } = useComprasCartao()
  const { faturas: faturasInformadas } = useFaturasCartao()
  const { parcelamentos } = useParcelamentos()

  const [custoMesAtual, setCustoMesAtual] = useState(null)
  const [porCategoria, setPorCategoria] = useState([])
  const [historicoMeses, setHistoricoMeses] = useState([])
  const [carregando, setCarregando] = useState(true)

  // ───────────────────────────────────────────────────────────
  // Categorias essenciais para custo de vida
  // ───────────────────────────────────────────────────────────
  const CATEGORIAS_ESSENCIAIS = [
    { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
    { id: 'moradia', nome: 'Moradia', icone: '🏠' },
    { id: 'transporte', nome: 'Transporte', icone: '🚗' },
    { id: 'saude', nome: 'Saúde', icone: '🏥' },
    { id: 'educacao', nome: 'Educação', icone: '📚' },
    { id: 'outros', nome: 'Outros', icone: '📦' }
  ]

  // ───────────────────────────────────────────────────────────
  // Mapear categoria real para categoria essencial
  // ───────────────────────────────────────────────────────────
  function mapearCategoria(nomeCategoria) {
    if (!nomeCategoria) return 'outros'

    const nome = nomeCategoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    if (nome.includes('alimenta') || nome.includes('mercado') || nome.includes('comida') || nome.includes('restaurante') || nome.includes('lanche')) {
      return 'alimentacao'
    }
    if (nome.includes('moradia') || nome.includes('aluguel') || nome.includes('condominio') || nome.includes('iptu') || nome.includes('agua') || nome.includes('luz') || nome.includes('gas') || nome.includes('internet')) {
      return 'moradia'
    }
    if (nome.includes('transporte') || nome.includes('combustivel') || nome.includes('gasolina') || nome.includes('onibus') || nome.includes('metro') || nome.includes('uber') || nome.includes('taxi') || nome.includes('estacionamento')) {
      return 'transporte'
    }
    if (nome.includes('saude') || nome.includes('medico') || nome.includes('farmacia') || nome.includes('remedio') || nome.includes('plano') || nome.includes('consulta') || nome.includes('exame')) {
      return 'saude'
    }
    if (nome.includes('educacao') || nome.includes('escola') || nome.includes('faculdade') || nome.includes('curso') || nome.includes('livro')) {
      return 'educacao'
    }

    return 'outros'
  }

  // ───────────────────────────────────────────────────────────
  // Calcular custo do mês específico
  // ───────────────────────────────────────────────────────────
  const calcularCustoMes = useMemo(() => {
    return (anoRef, mesRef) => {
      const categoriasMap = new Map()

      // Inicializa todas as categorias essenciais com 0
      CATEGORIAS_ESSENCIAIS.forEach(cat => {
        categoriasMap.set(cat.id, {
          ...cat,
          total: 0,
          itens: []
        })
      })

      // 1. DESPESAS FIXAS E VARIÁVEIS (tabela despesas)
      const despesasDoMes = despesas.filter(d => {
        if (!d.data_vencimento) return false
        const data = new Date(d.data_vencimento + 'T12:00:00')
        return data.getFullYear() === anoRef && data.getMonth() + 1 === mesRef
      })

      despesasDoMes.forEach(despesa => {
        const categoriaId = mapearCategoria(despesa.categorias?.nome)
        const cat = categoriasMap.get(categoriaId)
        
        if (cat) {
          cat.total += Number(despesa.valor) || 0
          cat.itens.push({
            id: despesa.id,
            descricao: despesa.descricao,
            valor: Number(despesa.valor) || 0,
            data: despesa.data_vencimento,
            tipo: 'despesa',
            categoriaOriginal: despesa.categorias?.nome || 'Sem categoria'
          })
        }
      })

      // 2. COMPRAS NO CARTÃO (linhas de fatura do mês)
      cartoes.forEach(cartao => {
        const comprasCartao = todasComprasCartao.filter(c => 
          String(c.cartao_id) === String(cartao.id)
        )

        const parcelamentosCartao = parcelamentos.filter(p => 
          String(p.cartao_id) === String(cartao.id)
        )

        const linhasDoMes = linhasFaturaCompleta(
          comprasCartao,
          parcelamentosCartao,
          cartao.dia_fechamento,
          anoRef,
          mesRef
        )

        linhasDoMes.forEach(linha => {
          const categoriaId = mapearCategoria(linha.categorias?.nome)
          const cat = categoriasMap.get(categoriaId)

          if (cat) {
            cat.total += linha.valor
            cat.itens.push({
              id: linha.id,
              descricao: linha.descricao,
              valor: linha.valor,
              data: linha.data,
              tipo: 'cartao',
              cartao: cartao.nome,
              parcela: linha.parcela,
              totalParcelas: linha.totalParcelas,
              categoriaOriginal: linha.categorias?.nome || 'Sem categoria'
            })
          }
        })
      })

      // 3. TOTAL GERAL
      const totalGeral = Array.from(categoriasMap.values())
        .reduce((acc, cat) => acc + cat.total, 0)

      // 4. Converter Map em array e calcular percentuais
      const categorias = Array.from(categoriasMap.values())
        .map(cat => ({
          ...cat,
          percentual: totalGeral > 0 
            ? Math.round((cat.total / totalGeral) * 100) 
            : 0
        }))
        .sort((a, b) => b.total - a.total)

      return {
        ano: anoRef,
        mes: mesRef,
        total: totalGeral,
        categorias,
        temDados: totalGeral > 0
      }
    }
  }, [despesas, cartoes, todasComprasCartao, parcelamentos])

  // ───────────────────────────────────────────────────────────
  // Calcular média de períodos anteriores
  // ───────────────────────────────────────────────────────────
  const calcularMediaPeriodo = useMemo(() => {
    return (mesesAtras) => {
      const custos = []
      const dataRef = new Date(ano, mes - 1, 1)

      for (let i = 1; i <= mesesAtras; i++) {
        const dataAnterior = new Date(dataRef)
        dataAnterior.setMonth(dataAnterior.getMonth() - i)
        
        const anoAnterior = dataAnterior.getFullYear()
        const mesAnterior = dataAnterior.getMonth() + 1

        const custo = calcularCustoMes(anoAnterior, mesAnterior)
        
        if (custo.temDados) {
          custos.push(custo.total)
        }
      }

      if (custos.length === 0) return null

      const soma = custos.reduce((acc, val) => acc + val, 0)
      const media = soma / custos.length

      return {
        media,
        mesesComDados: custos.length,
        mesesAnalisados: mesesAtras
      }
    }
  }, [ano, mes, calcularCustoMes])

  // ───────────────────────────────────────────────────────────
  // Calcular histórico dos últimos N meses
  // ───────────────────────────────────────────────────────────
  const calcularHistorico = useMemo(() => {
    return (numeroMeses = 12) => {
      const historico = []
      const dataRef = new Date(ano, mes - 1, 1)

      for (let i = 0; i < numeroMeses; i++) {
        const dataAtual = new Date(dataRef)
        dataAtual.setMonth(dataAtual.getMonth() - i)

        const anoAtual = dataAtual.getFullYear()
        const mesAtual = dataAtual.getMonth() + 1

        const custo = calcularCustoMes(anoAtual, mesAtual)
        
        historico.unshift({
          ano: anoAtual,
          mes: mesAtual,
          label: new Date(anoAtual, mesAtual - 1).toLocaleDateString('pt-BR', { 
            month: 'short', 
            year: '2-digit' 
          }),
          total: custo.total,
          temDados: custo.temDados
        })
      }

      return historico
    }
  }, [ano, mes, calcularCustoMes])

  // ───────────────────────────────────────────────────────────
  // Efeito: calcular dados ao carregar
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (carregandoDespesas) {
      setCarregando(true)
      return
    }

    try {
      // Custo do mês atual
      const custoAtual = calcularCustoMes(ano, mes)
      setCustoMesAtual(custoAtual)
      setPorCategoria(custoAtual.categorias)

      // Histórico
      const historico = calcularHistorico(12)
      setHistoricoMeses(historico)

      setCarregando(false)
    } catch (err) {
      console.error('Erro ao calcular custo de vida:', err)
      setCarregando(false)
    }
  }, [ano, mes, carregandoDespesas, calcularCustoMes, calcularHistorico])

  // ───────────────────────────────────────────────────────────
  // Retorno do hook
  // ───────────────────────────────────────────────────────────
  return {
    custoMesAtual,
    porCategoria,
    historicoMeses,
    carregando,
    calcularMediaPeriodo,
    calcularHistorico,
    temDados: custoMesAtual?.temDados || false
  }
}
