import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ─── Interesses de consultoria ────────────────────────────────────────────────
// A RLS decide o alcance: usuário comum enxerga só os próprios registros; o
// admin enxerga todos (policy "Interesses: ver" com public.e_admin()).
// O front não precisa filtrar por papel — a mesma query serve aos dois.
export function useConsultoriaInteresses() {
  // ehAdmin entra como dependência: quando o perfil carrega e o papel vira
  // admin, refazemos a busca para que o admin passe a enxergar TODOS os
  // registros (a 1ª busca pode ter ocorrido antes do papel assentar).
  const { usuario, ehAdmin } = useAuth()
  const [interesses, setInteresses] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  // Contador de requisição: só a busca MAIS RECENTE pode escrever no estado.
  // Isso evita a corrida em que uma 1ª busca (disparada antes do papel admin
  // assentar) resolve DEPOIS da 2ª e sobrescreve a lista correta com vazio —
  // causa do "aparece e some" do badge. Sem timeout, baseado em dados reais.
  const reqIdRef = useRef(0)

  const buscar = useCallback(async () => {
    if (!usuario) return
    const meuReq = ++reqIdRef.current
    setCarregando(true); setErro(null)
    try {
      const { data, error } = await supabase
        .from('consultoria_interesses')
        .select('*')
        .order('criado_em', { ascending: false })
      if (error) throw error
      // Descarta respostas obsoletas: se outra busca começou depois desta,
      // ignoramos este resultado (não sobrescreve o mais recente).
      if (meuReq !== reqIdRef.current) return
      setInteresses(data || [])
    } catch (err) {
      if (meuReq !== reqIdRef.current) return
      setErro(err.message)
    } finally {
      if (meuReq === reqIdRef.current) setCarregando(false)
    }
  }, [usuario])

  // Rebusca quando o usuário muda OU quando o papel admin é confirmado.
  useEffect(() => { if (usuario) buscar() }, [usuario?.id, ehAdmin, buscar])

  // Registra um novo interesse (sempre em nome do próprio usuário).
  async function criarInteresse({ nome, whatsapp }) {
    const { data, error } = await supabase
      .from('consultoria_interesses')
      .insert([{ usuario_id: usuario.id, nome, whatsapp, status: 'novo' }])
      .select()
      .single()
    if (error) throw error
    setInteresses(prev => [data, ...prev])
    return data
  }

  // Atualiza o status (uso do admin).
  async function atualizarStatus(id, status) {
    const { data, error } = await supabase
      .from('consultoria_interesses')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    // Invalida qualquer busca em voo para que ela não sobrescreva esta
    // atualização de status (que define o contador de "novos").
    reqIdRef.current++
    setInteresses(prev => prev.map(i => (i.id === id ? data : i)))
    return data
  }

  return { interesses, carregando, erro, criarInteresse, atualizarStatus, recarregar: buscar }
}

// ─── Agenda administrativa ────────────────────────────────────────────────────
// Protegida por RLS: só o admin lê/escreve (policy "Agenda: admin gerencia tudo").
export function useAgendamentos() {
  const { usuario, ehAdmin } = useAuth()
  const [agendamentos, setAgendamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true); setErro(null)
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .order('data', { ascending: true })
        .order('horario', { ascending: true })
      if (error) throw error
      setAgendamentos(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (ehAdmin) buscar()
    else { setAgendamentos([]); setCarregando(false) }
  }, [ehAdmin, usuario?.id, buscar])

  async function criarAgendamento(dados) {
    const { data, error } = await supabase
      .from('agendamentos')
      .insert([dados])
      .select()
      .single()
    if (error) throw error
    setAgendamentos(prev => [...prev, data].sort(ordenar))
    return data
  }

  async function atualizarAgendamento(id, dados) {
    const { data, error } = await supabase
      .from('agendamentos')
      .update(dados)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setAgendamentos(prev => prev.map(a => (a.id === id ? data : a)).sort(ordenar))
    return data
  }

  async function removerAgendamento(id) {
    const { error } = await supabase.from('agendamentos').delete().eq('id', id)
    if (error) throw error
    setAgendamentos(prev => prev.filter(a => a.id !== id))
  }

  return { agendamentos, carregando, erro, criarAgendamento, atualizarAgendamento, removerAgendamento, recarregar: buscar }
}

function ordenar(a, b) {
  if (a.data !== b.data) return a.data < b.data ? -1 : 1
  return a.horario < b.horario ? -1 : a.horario > b.horario ? 1 : 0
}
