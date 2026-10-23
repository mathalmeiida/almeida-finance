import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

// Categorias de produto suportadas (rótulos fixos; o valor é salvo em
// investimentos.categoria). NÃO inventa preços/rentabilidade — tudo vem do que
// o usuário informar (valor_aplicado / valor_atual / movimentações).
export const CATEGORIAS_INVESTIMENTO = [
  { v: 'tesouro',     t: 'Tesouro Direto' },
  { v: 'cdb',         t: 'CDB' },
  { v: 'lci',         t: 'LCI' },
  { v: 'lca',         t: 'LCA' },
  { v: 'acoes',       t: 'Ações' },
  { v: 'fii',         t: 'Fundos Imobiliários' },
  { v: 'etf',         t: 'ETFs' },
  { v: 'fundo',       t: 'Fundos de Investimento' },
  { v: 'previdencia', t: 'Previdência Privada' },
  { v: 'outro',       t: 'Outros' },
]

export const labelCategoriaInvestimento = (v) =>
  CATEGORIAS_INVESTIMENTO.find(c => c.v === v)?.t || v || 'Outros'

// Tipos de movimentação (devem bater com o CHECK da tabela).
export const TIPOS_MOV_INVESTIMENTO = ['aporte', 'resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao']

export function useInvestimentos() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [investimentos, setInvestimentos] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!idEfetivo) return
    setCarregando(true)
    setErro(null)
    try {
      const [inv, mov] = await Promise.all([
        supabase.from('investimentos').select('*').eq('usuario_id', idEfetivo).order('criado_em', { ascending: true }),
        supabase.from('investimentos_movimentacoes').select('*').eq('usuario_id', idEfetivo).order('data', { ascending: false }),
      ])
      if (inv.error) throw inv.error
      if (mov.error) throw mov.error
      setInvestimentos(inv.data || [])
      setMovimentacoes(mov.data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo])

  useEffect(() => { buscar() }, [buscar])

  // ─── Investimentos (CRUD) ───
  async function criar(dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('investimentos')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    setInvestimentos(prev => [...prev, data])
    return data
  }

  async function atualizar(id, dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('investimentos')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setInvestimentos(prev => prev.map(i => i.id === id ? data : i))
    return data
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    // As movimentações caem por ON DELETE CASCADE no banco.
    const { error } = await supabase.from('investimentos').delete().eq('id', id)
    if (error) throw error
    setInvestimentos(prev => prev.filter(i => i.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.investimento_id !== id))
  }

  // ─── Movimentações (CRUD) ───
  async function criarMovimentacao({ investimento_id, tipo, valor, data, descricao = null }) {
    bloquearSeConsultoria(modoConsultoria)
    const { data: nova, error } = await supabase
      .from('investimentos_movimentacoes')
      .insert([{
        usuario_id: usuario.id, investimento_id, tipo,
        valor: Math.abs(Number(valor) || 0), data, descricao: descricao || null,
      }])
      .select()
      .single()
    if (error) throw error
    setMovimentacoes(prev => [nova, ...prev])
    return nova
  }

  async function removerMovimentacao(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('investimentos_movimentacoes').delete().eq('id', id)
    if (error) throw error
    setMovimentacoes(prev => prev.filter(m => m.id !== id))
  }

  // ─── Derivações (reais, sem inventar nada) ───
  // Patrimônio total = soma do valor ATUAL informado de cada posição.
  const patrimonioTotal = investimentos.reduce((acc, i) => acc + (Number(i.valor_atual) || 0), 0)
  const totalAplicado = investimentos.reduce((acc, i) => acc + (Number(i.valor_aplicado) || 0), 0)
  // Reserva vinculada = soma de reserva_valor (parte OU total de cada posição,
  // nunca mais que valor_atual). Não duplica patrimônio: reserva_valor é um
  // recorte do valor_atual que já compõe o patrimônio.
  const reservaVinculada = investimentos
    .reduce((acc, i) => acc + (Number(i.reserva_valor) || 0), 0)

  // Movimentações de um mês/ano (1-12). Usado em aportes/rendimentos do mês.
  const movsNoMes = (ano, mes) => movimentacoes.filter(m => {
    if (!m.data) return false
    const [a, mm] = m.data.split('-').map(Number)
    return a === ano && mm === mes
  })
  const somaPorTipo = (lista, tipos) =>
    lista.filter(m => tipos.includes(m.tipo)).reduce((acc, m) => acc + (Number(m.valor) || 0), 0)

  const aportesNoMes = (ano, mes) => somaPorTipo(movsNoMes(ano, mes), ['aporte'])
  // Rendimento informado no mês = rendimentos + dividendos + juros (proventos/
  // valorização que o USUÁRIO registrou; não é estimativa de mercado).
  const rendimentoNoMes = (ano, mes) => somaPorTipo(movsNoMes(ano, mes), ['rendimento', 'dividendo', 'juros'])
  const rendimentoAcumulado = somaPorTipo(movimentacoes, ['rendimento', 'dividendo', 'juros'])

  // Distribuição por categoria (valor atual). Retorna [{categoria, total, pct}].
  const distribuicaoPorCategoria = () => {
    const mapa = new Map()
    for (const i of investimentos) {
      const c = i.categoria || 'outro'
      mapa.set(c, (mapa.get(c) || 0) + (Number(i.valor_atual) || 0))
    }
    const total = patrimonioTotal || 0
    return [...mapa.entries()]
      .map(([categoria, valor]) => ({ categoria, total: valor, pct: total > 0 ? (valor / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)
  }

  const movsDeInvestimento = (id) => movimentacoes.filter(m => m.investimento_id === id)

  return {
    investimentos, movimentacoes, carregando, erro,
    criar, atualizar, remover, criarMovimentacao, removerMovimentacao,
    // derivações
    patrimonioTotal, totalAplicado, reservaVinculada, rendimentoAcumulado,
    aportesNoMes, rendimentoNoMes, distribuicaoPorCategoria, movsDeInvestimento,
    recarregar: buscar,
  }
}
