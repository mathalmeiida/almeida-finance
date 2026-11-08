import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { adicionarDias } from '../lib/importacao/normalizar'

// ─── Importação Inteligente: acesso ao Supabase ──────────────────────────────
// Leituras e escritas sempre com a sessão do usuário (chave anon + JWT) e RLS.
// A gravação acontece SOMENTE na RPC importacao_confirmar, chamada após a
// confirmação explícita na tela de conferência.

// Erros de tabela/função inexistente = migration ainda não aplicada no banco.
function migracaoAusente(error) {
  if (!error) return false
  const msg = `${error.code || ''} ${error.message || ''}`
  return /42P01|42883|PGRST202|PGRST205|does not exist|Could not find the (table|function)/i.test(msg)
}

function erroAmigavel(error, padrao) {
  if (migracaoAusente(error)) {
    return 'A Importação Inteligente ainda não foi habilitada no banco de dados (migration 2026-11_importacao_inteligente.sql).'
  }
  const msg = error?.message || ''
  // Mensagens da RPC já são escritas para o usuário ("Lançamento 3: ...").
  if (/^Lançamento \d+:|Nenhum lançamento|Limite de|Conta desativada|Não autenticado|já foi desfeita|não encontrada/i.test(msg)) return msg
  return padrao
}

const TABELAS_HISTORICO = {
  despesas: 'id, descricao, valor, data',
  receitas: 'id, descricao, valor, data',
  compras_cartao: 'id, descricao, valor_total, data_compra, numero_parcelas',
  investimentos: 'id, nome, valor_atual',
  investimentos_movimentacoes: 'id, tipo, valor, data, descricao',
}

export function useImportacoes() {
  const { usuario, modoConsultoria } = useAuth()
  const [historico, setHistorico] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState(null)

  const carregarHistorico = useCallback(async () => {
    if (!usuario?.id) return
    setCarregandoHistorico(true)
    setErroHistorico(null)
    try {
      const { data, error } = await supabase
        .from('importacoes')
        .select('id, tipo_documento, instituicao, arquivos, periodo_inicio, periodo_fim, total_identificados, total_aceitos, total_ignorados, total_duplicados, status, criado_em, desfeita_em, expira_em')
        .eq('usuario_id', usuario.id)
        .order('criado_em', { ascending: false })
        .limit(60)
      if (error) throw error
      setHistorico(data || [])
    } catch (e) {
      setErroHistorico(erroAmigavel(e, 'Não foi possível carregar o histórico de importações.'))
    } finally {
      setCarregandoHistorico(false)
    }
  }, [usuario?.id])

  // Itens de uma importação + resumo dos registros vinculados.
  const carregarItens = useCallback(async (importacaoId) => {
    const { data: itens, error } = await supabase
      .from('importacoes_itens')
      .select('id, tabela, registro_id, acao, situacao, criado_em')
      .eq('usuario_id', usuario.id)
      .eq('importacao_id', importacaoId)
      .order('criado_em', { ascending: true })
    if (error) throw new Error(erroAmigavel(error, 'Não foi possível carregar os registros da importação.'))
    const porTabela = {}
    for (const it of itens || []) (porTabela[it.tabela] ||= []).push(it.registro_id)
    const registros = {}
    await Promise.all(Object.entries(porTabela).map(async ([tabela, ids]) => {
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from(tabela).select(TABELAS_HISTORICO[tabela])
          .eq('usuario_id', usuario.id).in('id', ids.slice(i, i + 200))
        for (const r of data || []) registros[`${tabela}:${r.id}`] = r
      }
    }))
    return (itens || []).map(it => ({ ...it, registro: registros[`${it.tabela}:${it.registro_id}`] || null }))
  }, [usuario?.id])

  // Dados já cadastrados usados na detecção de duplicidades/recorrência.
  const carregarContexto = useCallback(async ({ tipoDocumento, inicio, fim }) => {
    const uid = usuario.id
    const de = inicio ? adicionarDias(inicio, -120) : null
    const ate = fim ? adicionarDias(fim, 5) : null
    const consultas = {
      regras: supabase.from('importacao_regras_categoria').select('destino, padrao, categoria_id, categoria_nome').eq('usuario_id', uid).limit(5000),
      impressoes: supabase.from('importacoes_itens').select('impressao_digital, tabela, registro_id')
        .eq('usuario_id', uid).eq('situacao', 'ativo').not('impressao_digital', 'is', null).limit(20000),
    }
    if (tipoDocumento === 'extrato_bancario') {
      let qd = supabase.from('despesas').select('id, descricao, valor, data, categoria_id, frequencia, recorrente, recorrencia_meses').eq('usuario_id', uid)
      let qr = supabase.from('receitas').select('*').eq('usuario_id', uid)
      if (de && ate) { qd = qd.gte('data', de).lte('data', ate); qr = qr.gte('data', de).lte('data', ate) }
      consultas.despesas = qd.limit(10000)
      consultas.receitas = qr.limit(10000)
      consultas.despesasRec = supabase.from('despesas').select('id, descricao, valor, data, categoria_id, frequencia, recorrente, recorrencia_meses')
        .eq('usuario_id', uid).eq('recorrente', true).limit(2000)
      consultas.receitasRec = supabase.from('receitas').select('*').eq('usuario_id', uid).eq('recorrente', true).limit(2000)
    }
    if (tipoDocumento === 'fatura_cartao') {
      consultas.compras = supabase.from('compras_cartao').select('id, cartao_id, descricao, valor_total, data_compra, numero_parcelas, categoria_id')
        .eq('usuario_id', uid).limit(20000)
    }
    if (tipoDocumento === 'extrato_investimentos') {
      consultas.investimentos = supabase.from('investimentos').select('id, nome, instituicao, categoria, valor_atual, valor_aplicado, quantidade, preco_unitario').eq('usuario_id', uid)
      let qm = supabase.from('investimentos_movimentacoes').select('id, investimento_id, tipo, valor, data').eq('usuario_id', uid)
      if (de && ate) qm = qm.gte('data', de).lte('data', ate)
      consultas.movimentacoes = qm.limit(20000)
    }
    const chaves = Object.keys(consultas)
    const respostas = await Promise.all(chaves.map(k => consultas[k]))
    const res = {}
    chaves.forEach((k, i) => {
      const { data, error } = respostas[i]
      if (error) throw new Error(erroAmigavel(error, 'Não foi possível consultar os lançamentos existentes.'))
      res[k] = data || []
    })
    const unir = (a = [], b = []) => {
      const vistos = new Set(a.map(x => x.id))
      return [...a, ...b.filter(x => !vistos.has(x.id))]
    }
    return {
      regras: res.regras,
      existentes: {
        impressoes: res.impressoes,
        despesas: unir(res.despesas, res.despesasRec),
        receitas: unir(res.receitas, res.receitasRec),
        compras: res.compras || [],
        investimentos: res.investimentos || [],
        movimentacoes: res.movimentacoes || [],
      },
    }
  }, [usuario?.id])

  async function confirmar(payload) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase.rpc('importacao_confirmar', { p_dados: payload })
    if (error) throw new Error(erroAmigavel(error, 'Não foi possível gravar a importação. Nenhum dado foi alterado.'))
    return data
  }

  async function desfazer(importacaoId) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase.rpc('importacao_desfazer', { p_importacao_id: importacaoId })
    if (error) throw new Error(erroAmigavel(error, 'Não foi possível desfazer a importação.'))
    await carregarHistorico()
    return data
  }

  async function removerDoHistorico(importacaoId) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase.from('importacoes').delete().eq('id', importacaoId).eq('usuario_id', usuario.id)
    if (error) throw new Error(erroAmigavel(error, 'Não foi possível remover do histórico.'))
    setHistorico(prev => prev.filter(h => h.id !== importacaoId))
  }

  return {
    historico, carregandoHistorico, erroHistorico,
    carregarHistorico, carregarItens, carregarContexto, confirmar, desfazer, removerDoHistorico,
  }
}
