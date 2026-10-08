import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Central de Feedbacks ─────────────────────────────────────────────────────
// O usuário envia sugestão/dúvida/problema; o admin visualiza e muda o status.
// A RLS decide o alcance: usuário comum enxerga só os PRÓPRIOS feedbacks; o
// admin enxerga TODOS (policy "Feedbacks: ver" com public.e_admin()). O front
// não filtra por papel — a mesma query serve aos dois. Escrita de status é
// exclusiva do admin (policy de UPDATE), então criar() serve ao usuário e
// atualizarStatus() ao admin.
export function useFeedbacks() {
  // ehAdmin entra como dependência: quando o perfil carrega e o papel vira
  // admin, refazemos a busca para o admin passar a enxergar TODOS os registros.
  const { usuario, ehAdmin } = useAuth()
  const [feedbacks, setFeedbacks] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Contador de requisição: só a busca MAIS RECENTE escreve no estado (evita a
  // corrida em que uma 1ª busca resolve depois da 2ª — mesmo padrão de
  // useConsultoria). Sem timeout, baseado em dados reais.
  const reqIdRef = useRef(0)

  const buscar = useCallback(async () => {
    if (!usuario) return
    const meuReq = ++reqIdRef.current
    setCarregando(true); setErro(null)
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('criado_em', { ascending: false })
      if (error) throw error
      if (meuReq !== reqIdRef.current) return // descarta resposta obsoleta
      setFeedbacks(data || [])
    } catch (err) {
      if (meuReq !== reqIdRef.current) return
      setErro(err.message)
    } finally {
      if (meuReq === reqIdRef.current) setCarregando(false)
    }
  }, [usuario])

  // Rebusca quando o usuário muda OU quando o papel admin é confirmado.
  useEffect(() => { if (usuario) buscar() }, [usuario?.id, ehAdmin, buscar])

  // Envia um novo feedback (sempre em nome do próprio usuário, status 'novo').
  async function criar({ tipo, mensagem }) {
    const texto = String(mensagem || '').trim()
    if (!texto) throw new Error('Escreva sua mensagem antes de enviar.')
    const { data, error } = await supabase
      .from('feedbacks')
      .insert([{ usuario_id: usuario.id, tipo: tipo || 'sugestao', mensagem: texto, status: 'novo' }])
      .select()
      .single()
    if (error) throw error
    setFeedbacks(prev => [data, ...prev])
    return data
  }

  // Atualiza o status (uso do admin). Opcionalmente grava uma nota interna.
  async function atualizarStatus(id, status, resposta_admin) {
    const campos = { status }
    if (resposta_admin !== undefined) campos.resposta_admin = resposta_admin
    const { data, error } = await supabase
      .from('feedbacks')
      .update(campos)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    // Invalida buscas em voo para não sobrescreverem esta atualização.
    reqIdRef.current++
    setFeedbacks(prev => prev.map(f => (f.id === id ? data : f)))
    return data
  }

  return { feedbacks, carregando, erro, criar, atualizarStatus, recarregar: buscar }
}
