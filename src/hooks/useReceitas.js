import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

export function useReceitas(mes, ano) {
  // idEfetivo = id do cliente no modo consultoria, senão o próprio. As LEITURAS
  // usam idEfetivo; as ESCRITAS seguem usando usuario.id (o banco também bloqueia
  // escrita cruzada: não há policy de escrita para o consultor).
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [receitas, setReceitas] = useState([])
  // TODAS as receitas recorrentes do usuário (sem filtro de mês). Usado para
  // projetar, na tela de Receitas, as recorrentes iniciadas em meses anteriores
  // ao mês visualizado. NÃO entra em `receitas` (que o useProjecao consome),
  // para não causar dupla contagem no saldo/projeção.
  const [recorrentes, setRecorrentes] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!idEfetivo) return
    buscar()
    buscarRecorrentes()
    // Depende do ID efetivo (não do objeto) para não refazer o fetch quando o
    // Supabase apenas renova o token, e para recarregar ao entrar/sair do modo
    // consultoria.
  }, [idEfetivo, mes, ano])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      let query = supabase
        .from('receitas')
        .select('*')
        .eq('usuario_id', idEfetivo)
        .order('data', { ascending: false })

      // Filtra pelo mês/ano se informado
      if (mes !== undefined && ano !== undefined) {
        const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
        const fim = new Date(ano, mes, 0).toISOString().split('T')[0] // último dia do mês
        query = query.gte('data', inicio).lte('data', fim)
      }

      const { data, error } = await query
      if (error) throw error
      setReceitas(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  // Busca todas as receitas recorrentes (independente do mês selecionado).
  async function buscarRecorrentes() {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .eq('usuario_id', idEfetivo)
        .eq('recorrente', true)
      if (error) throw error
      setRecorrentes(data || [])
    } catch {
      // Silencioso: sem recorrentes, a tela mostra apenas as do próprio mês.
    }
  }

  async function criar(dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('receitas')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select()
      .single()
    if (error) throw error
    // Só injeta a nova receita na lista em memória se ela pertencer ao mês/ano
    // atualmente filtrado. Caso contrário (ex.: receita cadastrada para um mês
    // futuro enquanto vemos outro mês), NÃO a adicionamos aqui — ela apareceria
    // no mês errado e "sumiria" no próximo refetch. Ela foi salva no banco e
    // aparece normalmente ao navegar até o mês correspondente à sua data.
    if (pertenceAoMesFiltrado(data?.data)) {
      setReceitas(prev => [data, ...prev])
    }
    buscarRecorrentes() // mantém a projeção de recorrentes atualizada
    return data
  }

  // Verifica se uma data 'YYYY-MM-DD' cai no mês/ano filtrado por este hook.
  // Sem filtro (mes/ano indefinidos) considera que tudo pertence (comportamento
  // antigo preservado). Comparação por string, sem new Date(), para não sofrer
  // deslocamento de timezone.
  function pertenceAoMesFiltrado(dataISO) {
    if (mes === undefined || ano === undefined) return true
    if (!dataISO) return true
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const fim = new Date(ano, mes, 0).toISOString().split('T')[0]
    return dataISO >= inicio && dataISO <= fim
  }

  async function atualizar(id, dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('receitas')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setReceitas(prev => prev.map(r => r.id === id ? data : r))
    buscarRecorrentes()
    return data
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase
      .from('receitas')
      .delete()
      .eq('id', id)
    if (error) throw error
    setReceitas(prev => prev.filter(r => r.id !== id))
    buscarRecorrentes()
  }

  const total = receitas.reduce((acc, r) => acc + Number(r.valor), 0)

  return { receitas, recorrentes, total, carregando, erro, criar, atualizar, remover, recarregar: buscar }
}
