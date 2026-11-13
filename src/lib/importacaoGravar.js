// ─── Importação Inteligente: leitura do que já existe e gravação ─────────────
// Usa as MESMAS tabelas do app (receitas, despesas, compras_cartao) e, para
// investimentos, a função criarMovimentacao do hook useInvestimentos (que
// atualiza a posição com as regras existentes). A RLS do Supabase garante que
// cada usuário só lê e grava os próprios dados. Nada é registrado em log.

import { normalizarExistentes } from './importacaoRegras.js'

const LOTE = 50
const somarDias = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

// Lançamentos já cadastrados no período do arquivo (±3 dias), para detectar
// duplicidades antes de gravar.
export async function buscarExistentes(supabase, { usuarioId, contexto, intervalo, cartaoId, investimentoId, beneficioId }) {
  if (!intervalo || !usuarioId) return []
  const ini = somarDias(intervalo.inicio, -3), fim = somarDias(intervalo.fim, 3)
  const ler = async (tabela, campos, campoData, filtros = {}) => {
    let q = supabase.from(tabela).select(campos).eq('usuario_id', usuarioId).gte(campoData, ini).lte(campoData, fim)
    for (const [k, v] of Object.entries(filtros)) if (v) q = q.eq(k, v)
    const { data, error } = await q
    if (error) throw error
    return normalizarExistentes(tabela, data || [])
  }
  if (contexto === 'extrato') {
    const [r, d] = await Promise.all([
      ler('receitas', 'id, data, valor, descricao', 'data'),
      ler('despesas', 'id, data, valor, descricao', 'data'),
    ])
    return [...r, ...d]
  }
  if (contexto === 'fatura') return ler('compras_cartao', 'id, data_compra, valor_total, numero_parcelas, descricao, cartao_id', 'data_compra', { cartao_id: cartaoId })
  if (contexto === 'beneficios') return ler('beneficios_movimentacoes', 'id, data, valor, tipo, descricao, beneficio_id', 'data', { beneficio_id: beneficioId })
  return ler('investimentos_movimentacoes', 'id, data, valor, tipo, descricao, investimento_id', 'data', { investimento_id: investimentoId })
}

// registros: saída de montarRegistros(). Grava em lotes; continua nos outros
// lotes se um falhar e devolve exatamente o que foi gravado.
export async function gravarRegistros(supabase, { usuarioId, registros, criarMovimentacao, criarMovimentacaoBeneficio }) {
  const gravados = [], falhas = []
  for (const tabela of ['receitas', 'despesas', 'compras_cartao']) {
    const lista = registros[tabela] || []
    for (let i = 0; i < lista.length; i += LOTE) {
      const lote = lista.slice(i, i + LOTE)
      const { data, error } = await supabase
        .from(tabela)
        .insert(lote.map(r => ({ ...r.dados, usuario_id: usuarioId })))
        .select('id')
      if (error || !data || data.length !== lote.length) {
        falhas.push({ tabela, quantidade: lote.length, mensagem: error?.message || 'O banco não confirmou a gravação.' })
        continue
      }
      lote.forEach((r, j) => gravados.push({ ...r.ref, tabela, id: data[j].id }))
    }
  }
  // Movimentações de investimentos: uma a uma, pela regra existente
  for (const r of registros.investimentos_movimentacoes || []) {
    try {
      const m = await criarMovimentacao(r.dados)
      gravados.push({ ...r.ref, tabela: 'investimentos_movimentacoes', id: m?.id ?? null })
    } catch (e) {
      falhas.push({ tabela: 'investimentos_movimentacoes', quantidade: 1, uid: r.ref.uid, mensagem: e?.message || 'Falha ao registrar a movimentação.' })
    }
  }
  // Movimentações de benefícios: usar hook se disponível, senão inserir direto
  for (const r of registros.beneficios_movimentacoes || []) {
    try {
      let m
      if (criarMovimentacaoBeneficio) {
        m = await criarMovimentacaoBeneficio(r.dados)
      } else {
        // Fallback: inserir direto no banco
        const { data, error } = await supabase
          .from('beneficios_movimentacoes')
          .insert([{ ...r.dados, usuario_id: usuarioId }])
          .select('id')
          .single()
        if (error) throw error
        m = data
      }
      gravados.push({ ...r.ref, tabela: 'beneficios_movimentacoes', id: m?.id ?? null })
    } catch (e) {
      falhas.push({ tabela: 'beneficios_movimentacoes', quantidade: 1, uid: r.ref.uid, mensagem: e?.message || 'Falha ao registrar a movimentação do benefício.' })
    }
  }
  return { gravados, falhas }
}
