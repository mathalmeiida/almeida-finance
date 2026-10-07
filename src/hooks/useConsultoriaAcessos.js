import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Acessos de consultoria (autorização de visualização) ─────────────────────
// Tabela consultoria_acessos: liga um CONSULTOR (admin) a um CLIENTE.
//   status: 'pendente' → 'autorizado' | 'recusado' | 'revogado'
// A RLS garante que:
//   • o consultor só vê/edita as linhas em que é consultor_id;
//   • o cliente só vê/edita as linhas em que é cliente_id;
//   • a leitura dos dados financeiros do cliente só é liberada ao consultor
//     enquanto o status for 'autorizado' (função consultor_autorizado).
//
// Este hook tem duas "visões" conforme quem o usa:
//   • Admin: lista os acessos que ELE solicitou (consultor_id = ele).
//   • Cliente: lista as solicitações direcionadas a ELE (cliente_id = ele).
// Ambas usam a MESMA query (RLS filtra); separamos por campo ao consumir.

export function useConsultoriaAcessos() {
  const { usuario, idUsuarioLogado } = useAuth()
  const [acessos, setAcessos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    if (!usuario) return
    setCarregando(true); setErro(null)
    try {
      // A RLS devolve só as linhas onde o usuário é consultor OU cliente.
      const { data, error } = await supabase
        .from('consultoria_acessos')
        .select('*')
        .order('solicitado_em', { ascending: false })
      if (error) throw error
      setAcessos(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [usuario])

  useEffect(() => { if (usuario) buscar() }, [usuario?.id, buscar])

  // ── Ações do ADMIN (consultor) ──────────────────────────────────────────────
  // Solicita acesso aos dados de um cliente. Reaproveita o vínculo existente
  // (UNIQUE consultor_id/cliente_id) voltando o status para 'pendente' caso já
  // exista (ex.: foi revogado antes). Nunca duplica.
  async function solicitarAcesso(clienteId) {
    const payload = {
      consultor_id: idUsuarioLogado,
      cliente_id: clienteId,
      status: 'pendente',
      solicitado_em: new Date().toISOString(),
      respondido_em: null,
    }
    const { data, error } = await supabase
      .from('consultoria_acessos')
      .upsert(payload, { onConflict: 'consultor_id,cliente_id' })
      .select()
      .single()
    if (error) throw error
    setAcessos(prev => {
      const resto = prev.filter(a => a.id !== data.id)
      return [data, ...resto]
    })
    return data
  }

  // Cancela uma solicitação que o próprio admin fez (apaga o vínculo).
  async function cancelarSolicitacao(acessoId) {
    const { error } = await supabase.from('consultoria_acessos').delete().eq('id', acessoId)
    if (error) throw error
    setAcessos(prev => prev.filter(a => a.id !== acessoId))
  }

  // ── Ações do CLIENTE ──────────────────────────────────────────────────────
  // Responde a uma solicitação: 'autorizado' | 'recusado' | 'revogado'.
  async function responder(acessoId, status) {
    const { data, error } = await supabase
      .from('consultoria_acessos')
      .update({ status, respondido_em: new Date().toISOString() })
      .eq('id', acessoId)
      .select()
      .single()
    if (error) throw error
    setAcessos(prev => prev.map(a => (a.id === acessoId ? data : a)))
    return data
  }

  const autorizar = (id) => responder(id, 'autorizado')
  const recusar   = (id) => responder(id, 'recusado')
  const revogar   = (id) => responder(id, 'revogado')

  // Derivados úteis para o CLIENTE (solicitações direcionadas a ele).
  const comoCliente = acessos.filter(a => a.cliente_id === idUsuarioLogado)
  const pendentesParaMim = comoCliente.filter(a => a.status === 'pendente')
  const autorizadosPorMim = comoCliente.filter(a => a.status === 'autorizado')

  // Derivados úteis para o ADMIN (acessos que ele solicitou).
  const comoConsultor = acessos.filter(a => a.consultor_id === idUsuarioLogado)

  // Mapa clienteId → status, para o admin pintar o status na lista de usuários.
  const statusPorCliente = {}
  for (const a of comoConsultor) statusPorCliente[a.cliente_id] = a

  return {
    acessos,
    carregando,
    erro,
    // admin
    comoConsultor,
    statusPorCliente,
    solicitarAcesso,
    cancelarSolicitacao,
    // cliente
    comoCliente,
    pendentesParaMim,
    autorizadosPorMim,
    autorizar,
    recusar,
    revogar,
    recarregar: buscar,
  }
}
