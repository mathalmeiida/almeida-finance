import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

// Gera UUID v4 para chave de idempotência de UI (bloco de duplo-clique).
// Usa crypto.randomUUID() quando disponível; fallback sem dependência externa.
function gerarUUID() {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch { /* ignora */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export const CATEGORIAS_INVESTIMENTO = [
  { v: 'tesouro', t: 'Tesouro Direto' },
  { v: 'cdb', t: 'CDB' },
  { v: 'lci', t: 'LCI' },
  { v: 'lca', t: 'LCA' },
  { v: 'acoes', t: 'Ações' },
  { v: 'fii', t: 'Fundos Imobiliários' },
  { v: 'etf', t: 'ETFs' },
  { v: 'fundo', t: 'Fundos de Investimento' },
  { v: 'previdencia', t: 'Previdência Privada' },
  { v: 'outro', t: 'Outros' },
]

export const labelCategoriaInvestimento = v =>
  CATEGORIAS_INVESTIMENTO.find(c => c.v === v)?.t || v || 'Outros'

export const TIPOS_MOV_INVESTIMENTO = ['aporte', 'resgate', 'rendimento', 'dividendo', 'juros', 'amortizacao']

// Converte string monetária brasileira ("1.200,50" ou "1200.50") ou número
// em um float com 2 casas decimais. Lança se não for positivo.
function valorPositivo(valor) {
  const texto = typeof valor === 'string' ? valor.trim() : valor
  let n
  if (typeof texto === 'string') {
    const limpo = texto.replace(/\s/g, '').replace(/^R\$/i, '')
    const normalizado = limpo.includes(',')
      ? limpo.replace(/\./g, '').replace(',', '.')
      : limpo
    n = Number(normalizado)
  } else {
    n = Number(texto)
  }
  if (!Number.isFinite(n) || n <= 0) throw new Error('Informe um valor positivo válido.')
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// Arredonda para 2 casas decimais (evita drift de ponto flutuante).
const r2 = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100

export function useInvestimentos() {
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [investimentos, setInvestimentos] = useState([])
  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  // Impede clique duplo: Map<investimento_id, true> enquanto operação pendente.
  const opPendente = useRef(new Map())

  // ── Leitura ────────────────────────────────────────────────────────────────
  const buscar = useCallback(async () => {
    if (!idEfetivo) {
      setInvestimentos([])
      setMovimentacoes([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    setErro(null)
    try {
      const [inv, mov] = await Promise.all([
        supabase
          .from('investimentos')
          .select('*')
          .eq('usuario_id', idEfetivo)
          .order('criado_em', { ascending: true }),
        supabase
          .from('investimentos_movimentacoes')
          .select('*')
          .eq('usuario_id', idEfetivo)
          .order('data', { ascending: false }),
      ])
      if (inv.error) throw inv.error
      if (mov.error) throw mov.error
      setInvestimentos(inv.data || [])
      setMovimentacoes(mov.data || [])
    } catch (err) {
      setErro(err.message)
      throw err
    } finally {
      setCarregando(false)
    }
  }, [idEfetivo])

  useEffect(() => { buscar().catch(() => {}) }, [buscar])

  // ── CRUD de investimentos (sem RPC — operações diretas) ────────────────────

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
      .eq('usuario_id', usuario.id)
      .select()
      .single()
    if (error) throw error
    setInvestimentos(prev => prev.map(i => (i.id === id ? data : i)))
    return data
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase
      .from('investimentos')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)
    if (error) throw error
    setInvestimentos(prev => prev.filter(i => i.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.investimento_id !== id))
  }

  // ── Movimentações (sem RPC — lógica executada no frontend + 2 writes) ──────
  //
  // REGRAS FINANCEIRAS:
  //   aporte     → valor_aplicado += valor; valor_atual += valor
  //   resgate    → impede se valor > valor_atual; valor_aplicado reduz pelo
  //                mínimo entre valor e valor_aplicado (nunca negativo);
  //                valor_atual -= valor
  //   rendimento / dividendo / juros / amortizacao → só valor_atual += valor
  //                (retorno sobre capital; valor_aplicado não muda)
  //
  // Atomicidade: não há transação nativa no cliente Supabase sem RPC.
  // Estratégia: insert da movimentação PRIMEIRO; se falhar, não atualiza saldo.
  // Se o update de saldo falhar após o insert, chama buscar() para re-sincronizar
  // o estado local com o banco (o insert já persistiu; o saldo será recalculado
  // manualmente na próxima vez que o usuário interagir ou recarregar).

  async function criarMovimentacao({ investimento_id, tipo, valor, data, descricao = null }) {
    bloquearSeConsultoria(modoConsultoria)

    if (!TIPOS_MOV_INVESTIMENTO.includes(tipo)) throw new Error('Tipo de movimentação inválido.')
    if (!data) throw new Error('Informe a data da movimentação.')

    // Bloco de duplo-clique: rejeita segunda chamada enquanto a primeira pende.
    if (opPendente.current.has(investimento_id)) {
      throw new Error('Operação em andamento. Aguarde a conclusão.')
    }
    opPendente.current.set(investimento_id, gerarUUID())

    try {
      const v = valorPositivo(valor)

      // Busca o estado atual da posição (fonte de verdade = banco).
      const { data: inv, error: errInv } = await supabase
        .from('investimentos')
        .select('valor_aplicado, valor_atual')
        .eq('id', investimento_id)
        .eq('usuario_id', usuario.id)
        .single()
      if (errInv) throw errInv
      if (!inv) throw new Error('Investimento não encontrado.')

      const aplicadoAtual = Number(inv.valor_aplicado) || 0
      const valorAtualPos = Number(inv.valor_atual)    || 0

      // Validação de resgate antes de qualquer gravação.
      if (tipo === 'resgate' && v > valorAtualPos) {
        throw new Error(
          `Saldo insuficiente para resgate. Disponível: R$ ${valorAtualPos.toFixed(2).replace('.', ',')}.`
        )
      }

      // Calcula os novos saldos da posição.
      let novoAplicado = aplicadoAtual
      let novoAtual    = valorAtualPos

      if (tipo === 'aporte') {
        novoAplicado = r2(aplicadoAtual + v)
        novoAtual    = r2(valorAtualPos  + v)
      } else if (tipo === 'resgate') {
        // Reduz aplicado pelo mínimo entre v e o aplicado atual (nunca negativo).
        const reducaoAplicado = Math.min(v, aplicadoAtual)
        novoAplicado = r2(aplicadoAtual - reducaoAplicado)
        novoAtual    = r2(valorAtualPos  - v)
      } else {
        // rendimento, dividendo, juros, amortizacao: só sobe valor_atual.
        novoAtual = r2(valorAtualPos + v)
      }

      // 1) Insere a movimentação (fonte de verdade do histórico).
      const { data: nova, error: errMov } = await supabase
        .from('investimentos_movimentacoes')
        .insert([{
          usuario_id:      usuario.id,
          investimento_id,
          tipo,
          valor:           v,
          data,
          descricao:       descricao || null,
        }])
        .select()
        .single()
      if (errMov) throw errMov

      // 2) Atualiza os saldos da posição.
      const { data: invAtualizado, error: errUpd } = await supabase
        .from('investimentos')
        .update({ valor_aplicado: novoAplicado, valor_atual: novoAtual })
        .eq('id', investimento_id)
        .eq('usuario_id', usuario.id)
        .select()
        .single()

      if (errUpd) {
        // O insert já persistiu; re-sincroniza o estado local com o banco.
        await buscar()
        throw errUpd
      }

      // Atualiza estado local de forma otimista (sem nova leitura de rede).
      setMovimentacoes(prev => [nova, ...prev])
      setInvestimentos(prev =>
        prev.map(i => (i.id === investimento_id ? invAtualizado : i))
      )
      return nova

    } finally {
      opPendente.current.delete(investimento_id)
    }
  }

  async function removerMovimentacao(id) {
    bloquearSeConsultoria(modoConsultoria)

    // Busca a movimentação para saber o tipo e o valor antes de deletar.
    const mov = movimentacoes.find(m => m.id === id)
    if (!mov) throw new Error('Movimentação não encontrada.')

    // Busca saldo atual da posição.
    const { data: inv, error: errInv } = await supabase
      .from('investimentos')
      .select('valor_aplicado, valor_atual')
      .eq('id', mov.investimento_id)
      .eq('usuario_id', usuario.id)
      .single()
    if (errInv) throw errInv
    if (!inv) throw new Error('Investimento não encontrado.')

    const aplicadoAtual = Number(inv.valor_aplicado) || 0
    const valorAtualPos = Number(inv.valor_atual)    || 0
    const v             = Number(mov.valor)          || 0

    // Movimentação apenas de histórico (ex.: vinda da Importação Inteligente,
    // afeta_saldo = false) não alterou os saldos ao ser gravada; por isso a
    // exclusão também não os altera. Ausente/true = comportamento original.
    if (mov.afeta_saldo === false) {
      const { error: errDelHist } = await supabase
        .from('investimentos_movimentacoes')
        .delete()
        .eq('id', id)
        .eq('usuario_id', usuario.id)
      if (errDelHist) throw errDelHist
      setMovimentacoes(prev => prev.filter(m => m.id !== id))
      return
    }

    // Calcula saldo revertido (inverso do criarMovimentacao).
    let novoAplicado = aplicadoAtual
    let novoAtual    = valorAtualPos

    if (mov.tipo === 'aporte') {
      // Desfaz aporte: reduz aplicado e atual.
      // LEAST protege contra inconsistência de dados históricos.
      novoAplicado = r2(Math.max(aplicadoAtual - v, 0))
      novoAtual    = r2(Math.max(valorAtualPos  - v, 0))
    } else if (mov.tipo === 'resgate') {
      // Desfaz resgate: devolve aplicado e atual.
      novoAplicado = r2(aplicadoAtual + v)
      novoAtual    = r2(valorAtualPos  + v)
    } else {
      // Desfaz rendimento/dividendo/juros/amortizacao: só reduz atual.
      novoAtual = r2(Math.max(valorAtualPos - v, 0))
    }

    // 1) Deleta a movimentação.
    const { error: errDel } = await supabase
      .from('investimentos_movimentacoes')
      .delete()
      .eq('id', id)
      .eq('usuario_id', usuario.id)
    if (errDel) throw errDel

    // 2) Atualiza saldos da posição.
    const { data: invAtualizado, error: errUpd } = await supabase
      .from('investimentos')
      .update({ valor_aplicado: novoAplicado, valor_atual: novoAtual })
      .eq('id', mov.investimento_id)
      .eq('usuario_id', usuario.id)
      .select()
      .single()

    if (errUpd) {
      // Delete já ocorreu; re-sincroniza.
      await buscar()
      throw errUpd
    }

    // Atualiza estado local.
    setMovimentacoes(prev => prev.filter(m => m.id !== id))
    setInvestimentos(prev =>
      prev.map(i => (i.id === mov.investimento_id ? invAtualizado : i))
    )
  }

  // ── Derivações (calculadas no frontend a partir dos dados em memória) ───────

  const patrimonioTotal    = investimentos.reduce((acc, i) => acc + (Number(i.valor_atual)    || 0), 0)
  const totalAplicado      = investimentos.reduce((acc, i) => acc + (Number(i.valor_aplicado) || 0), 0)
  const reservaVinculada   = investimentos.reduce((acc, i) => acc + (Number(i.reserva_valor)  || 0), 0)

  const movsNoMes = (ano, mes) =>
    movimentacoes.filter(m => {
      if (!m.data) return false
      const [a, mm] = m.data.split('-').map(Number)
      return a === ano && mm === mes
    })

  const somaPorTipo = (lista, tipos) =>
    lista.filter(m => tipos.includes(m.tipo)).reduce((acc, m) => acc + (Number(m.valor) || 0), 0)

  const aportesNoMes       = (ano, mes) => somaPorTipo(movsNoMes(ano, mes), ['aporte'])
  const rendimentoNoMes    = (ano, mes) => somaPorTipo(movsNoMes(ano, mes), ['rendimento', 'dividendo', 'juros'])
  const rendimentoAcumulado = somaPorTipo(movimentacoes, ['rendimento', 'dividendo', 'juros'])

  const distribuicaoPorCategoria = () => {
    const mapa = new Map()
    for (const i of investimentos) {
      const c = i.categoria || 'outro'
      mapa.set(c, (mapa.get(c) || 0) + (Number(i.valor_atual) || 0))
    }
    const total = patrimonioTotal || 0
    return [...mapa.entries()]
      .map(([categoria, valor]) => ({
        categoria,
        total: valor,
        pct: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  }

  const movsDeInvestimento = id => movimentacoes.filter(m => m.investimento_id === id)

  // ── Derivações por ativo ──────────────────────────────────────────────────
  // Retorna proventos acumulados (dividendo + juros + rendimento) de um ativo.
  const proventosDeInvestimento = id =>
    somaPorTipo(movsDeInvestimento(id), ['rendimento', 'dividendo', 'juros'])

  // Retorna total aportado em um ativo (soma das movimentações de aporte).
  // Difere de valor_aplicado (que pode ser editado manualmente): este valor
  // reflete exclusivamente o histórico de movimentações registradas.
  const totalAportadoDeInvestimento = id =>
    somaPorTipo(movsDeInvestimento(id), ['aporte'])

  // Retorna total resgatado de um ativo.
  const totalResgatadoDeInvestimento = id =>
    somaPorTipo(movsDeInvestimento(id), ['resgate'])

  // Rentabilidade % de um ativo: (valor_atual - valor_aplicado) / valor_aplicado.
  // Retorna null quando não há base (valor_aplicado = 0).
  const rentabilidadeDeInvestimento = (investimento) => {
    const aplicado = Number(investimento.valor_aplicado) || 0
    const atual    = Number(investimento.valor_atual)    || 0
    if (aplicado <= 0) return null
    return ((atual - aplicado) / aplicado) * 100
  }

  // Proventos totais de todos os investimentos no período (ano/mês).
  const proventosNoMes = (ano, mes) =>
    somaPorTipo(movsNoMes(ano, mes), ['rendimento', 'dividendo', 'juros'])

  return {
    investimentos, movimentacoes, carregando, erro,
    criar, atualizar, remover, criarMovimentacao, removerMovimentacao,
    patrimonioTotal, totalAplicado, reservaVinculada, rendimentoAcumulado,
    aportesNoMes, rendimentoNoMes, proventosNoMes,
    distribuicaoPorCategoria, movsDeInvestimento,
    proventosDeInvestimento, totalAportadoDeInvestimento,
    totalResgatadoDeInvestimento, rentabilidadeDeInvestimento,
    recarregar: buscar,
  }
}
