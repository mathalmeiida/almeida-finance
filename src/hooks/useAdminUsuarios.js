import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Dados para o painel administrativo.
 *
 * Lê SOMENTE a tabela "perfis" (nome, email, criado_em, ultimo_acesso,
 * onboarding_concluido, papel). Não acessa nenhuma tabela financeira —
 * receitas, despesas, cartões, metas, compras e parcelamentos continuam
 * protegidos pela RLS própria (restrita ao dono).
 *
 * A leitura de todos os perfis só retorna linhas se o usuário for admin,
 * por causa da policy "Admin vê todos os perfis" (valida public.e_admin()
 * no banco). Para um usuário comum, a mesma consulta traz apenas o próprio
 * registro — a segurança é garantida pelo banco, não pelo front.
 */
function diasAtras(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export function useAdminUsuarios() {
  const { ehAdmin } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const buscar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('perfis')
        .select('id, nome, email, criado_em, ultimo_acesso, onboarding_concluido, papel, ativo')
        .order('criado_em', { ascending: false })
      if (error) throw error
      setUsuarios(data || [])
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Ativa/desativa uma conta (soft-disable). Atualiza perfis.ativo e reflete
  // no estado local. A proteção contra autodesativação de admin é garantida
  // no banco (trigger impedir_autodesativacao); aqui propagamos o erro.
  const definirAtivo = useCallback(async (id, ativo) => {
    const { data, error } = await supabase
      .from('perfis')
      .update({ ativo })
      .eq('id', id)
      .select('id, nome, email, criado_em, ultimo_acesso, onboarding_concluido, papel, ativo')
      .single()
    if (error) throw error
    setUsuarios(prev => prev.map(u => (u.id === id ? data : u)))
    return data
  }, [])

  const desativar = useCallback((id) => definirAtivo(id, false), [definirAtivo])
  const reativar = useCallback((id) => definirAtivo(id, true), [definirAtivo])

  useEffect(() => {
    if (ehAdmin) buscar()
    else { setUsuarios([]); setCarregando(false) }
  }, [ehAdmin, buscar])

  // Métricas derivadas (calculadas no cliente a partir dos perfis).
  const d7 = diasAtras(7)
  const d30 = diasAtras(30)

  const total = usuarios.length
  const novos7 = usuarios.filter(u => u.criado_em && new Date(u.criado_em) >= d7).length
  const novos30 = usuarios.filter(u => u.criado_em && new Date(u.criado_em) >= d30).length
  const ativos30 = usuarios.filter(u => u.ultimo_acesso && new Date(u.ultimo_acesso) >= d30).length
  const onboardingConcluido = usuarios.filter(u => u.onboarding_concluido === true).length

  return {
    usuarios,
    carregando,
    erro,
    metricas: { total, novos7, novos30, ativos30, onboardingConcluido },
    desativar,
    reativar,
    recarregar: buscar,
  }
}
