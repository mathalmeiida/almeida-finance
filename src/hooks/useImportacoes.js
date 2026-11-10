import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// Histórico da Importação Inteligente (tabelas importacoes/importacoes_itens).
// Tolerante à migration pendente: se as tabelas não existirem, as funções
// devolvem `disponivel: false` e a importação segue sem histórico (a
// detecção de duplicidade continua pelos lançamentos já cadastrados).
function tabelaAusente(error) {
  const m = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()
  return m.includes('42p01') || m.includes('pgrst205') || m.includes('pgrst204') ||
    (m.includes('importacoes') && (m.includes('does not exist') || m.includes('schema cache') || m.includes('not find')))
}

export function useImportacoes() {
  const { usuario } = useAuth()

  // Chaves (hash) dos lançamentos já importados por este usuário.
  const carregarChaves = useCallback(async () => {
    if (!usuario?.id) return { disponivel: false, chaves: new Set() }
    const chaves = new Set()
    for (let de = 0; de < 20000; de += 1000) {
      const { data, error } = await supabase
        .from('importacoes_itens').select('chave').eq('usuario_id', usuario.id).range(de, de + 999)
      if (error) {
        if (tabelaAusente(error)) return { disponivel: false, chaves: new Set() }
        throw error
      }
      ;(data || []).forEach(r => chaves.add(r.chave))
      if (!data || data.length < 1000) break
    }
    return { disponivel: true, chaves }
  }, [usuario?.id])

  // Registra a importação e os itens gravados. Não interrompe a importação
  // se falhar: os lançamentos já estão salvos; só o histórico fica faltando.
  const registrar = useCallback(async ({ resumo, gravados }) => {
    if (!usuario?.id) return { registrado: false }
    const { data: imp, error } = await supabase
      .from('importacoes')
      .insert([{ ...resumo, usuario_id: usuario.id }])
      .select('id')
      .single()
    if (error) return { registrado: false, ausente: tabelaAusente(error) }
    const itens = gravados.filter(g => g.chave).map(g => ({
      importacao_id: imp.id, usuario_id: usuario.id, chave: g.chave, destino_tabela: g.tabela, destino_id: g.id,
    }))
    for (let i = 0; i < itens.length; i += 200) {
      const { error: e2 } = await supabase.from('importacoes_itens')
        // Chave já registrada (ex.: usuário reincluiu um item já importado): ignora,
        // sem derrubar o restante do histórico.
        .upsert(itens.slice(i, i + 200), { onConflict: 'usuario_id,chave', ignoreDuplicates: true })
      if (e2) return { registrado: false, ausente: tabelaAusente(e2) }
    }
    return { registrado: true, id: imp.id }
  }, [usuario?.id])

  const listar = useCallback(async () => {
    if (!usuario?.id) return { disponivel: false, lista: [] }
    const { data, error } = await supabase
      .from('importacoes').select('*').eq('usuario_id', usuario.id)
      .order('criado_em', { ascending: false }).limit(20)
    if (error) return { disponivel: !tabelaAusente(error), lista: [] }
    return { disponivel: true, lista: data || [] }
  }, [usuario?.id])

  return { carregarChaves, registrar, listar }
}
