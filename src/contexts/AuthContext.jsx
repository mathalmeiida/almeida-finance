import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Contexto que disponibiliza o usuário atual para todo o app
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(undefined) // undefined = ainda verificando
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)

  // Busca o perfil complementar do usuário na tabela "perfis"
  async function buscarPerfil(userId) {
    const { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', userId)
      .single()
    setPerfil(data)
  }

  useEffect(() => {
    // 1. Verifica se já existe uma sessão ativa ao carregar o app
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null
      setUsuario(user)
      if (user) buscarPerfil(user.id)
      setCarregando(false)
    })

    // 2. Escuta mudanças de autenticação (login, logout, expiração de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const user = session?.user ?? null
        setUsuario(user)
        if (user) {
          buscarPerfil(user.id)
        } else {
          setPerfil(null)
        }
        setCarregando(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Cadastro com e-mail e senha
  async function cadastrar({ nome, email, senha }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: { nome }, // enviado ao trigger que cria o perfil
      },
    })
    if (error) throw error
    return data
  }

  // Login com e-mail e senha
  async function entrar({ email, senha }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })
    if (error) throw error
    return data
  }

  // Logout
  async function sair() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const valor = {
    usuario,
    perfil,
    carregando,
    cadastrar,
    entrar,
    sair,
    autenticado: !!usuario,
  }

  return (
    <AuthContext.Provider value={valor}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para usar o contexto de auth em qualquer componente
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  }
  return context
}
