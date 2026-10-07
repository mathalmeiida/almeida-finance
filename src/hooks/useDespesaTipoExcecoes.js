import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

// ─── Exceções mensais do tipo (Fixa/Variável) de despesas recorrentes ─────────
// Uma despesa recorrente é UM único registro. Para permitir classificá-la como
// Fixa ou Variável apenas em um mês específico — sem alterar o registro base
// nem duplicar o lançamento — gravamos um "override" por (despesa_id, ano_mes)
// na tabela despesas_tipo_excecoes.
//
// Regra de leitura: o tipo exibido/somado no mês é o da exceção, se existir;
// caso contrário, o tipo do próprio registro. Afeta SOMENTE rótulo e os totais
// Fixas/Variáveis do mês — nunca valor, data, recorrência ou saldo.
export function useDespesaTipoExcecoes() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [excecoes, setExcecoes] = useState([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!idEfetivo) return
    buscar()
    // Depende do ID efetivo — recarrega ao entrar/sair do modo consultoria.
  }, [idEfetivo])

  async function buscar() {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('despesas_tipo_excecoes')
        .select('*')
        .eq('usuario_id', idEfetivo)
      if (error) throw error
      setExcecoes(data || [])
    } catch {
      // Silencioso: sem exceções o app usa o tipo do próprio registro.
      setExcecoes([])
    } finally {
      setCarregando(false)
    }
  }

  // Cria/atualiza a exceção de tipo para (despesa_id, ano_mes). Upsert pela
  // restrição UNIQUE (despesa_id, ano_mes) — nunca duplica.
  async function salvarExcecao(despesaId, anoMes, tipo) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('despesas_tipo_excecoes')
      .upsert(
        { usuario_id: usuario.id, despesa_id: despesaId, ano_mes: anoMes, tipo_despesa: tipo },
        { onConflict: 'despesa_id,ano_mes' }
      )
      .select()
      .single()
    if (error) throw error
    setExcecoes(prev => {
      const resto = prev.filter(e => !(e.despesa_id === despesaId && e.ano_mes === anoMes))
      return [...resto, data]
    })
    return data
  }

  // Remove a exceção de um mês (volta a valer o tipo do registro base).
  async function removerExcecao(despesaId, anoMes) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase
      .from('despesas_tipo_excecoes')
      .delete()
      .eq('despesa_id', despesaId)
      .eq('ano_mes', anoMes)
    if (error) throw error
    setExcecoes(prev => prev.filter(e => !(e.despesa_id === despesaId && e.ano_mes === anoMes)))
  }

  // Tipo efetivo de uma despesa em um mês: exceção do mês, se houver; senão o
  // tipo do registro base.
  function tipoNoMes(despesa, anoMes) {
    const ex = excecoes.find(e => e.despesa_id === despesa.id && e.ano_mes === anoMes)
    return ex ? ex.tipo_despesa : (despesa.tipo_despesa || 'variavel')
  }

  return { excecoes, carregando, salvarExcecao, removerExcecao, tipoNoMes, recarregar: buscar }
}
