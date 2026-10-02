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
    // Registra o último acesso (usado no painel admin). Não bloqueia o login
    // se falhar, e não interfere em nenhum dado financeiro.
    if (data?.user?.id) {
      supabase
        .from('perfis')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('id', data.user.id)
        .then(() => {}, () => {})
    }
    return data
  }

  // Logout
  async function sair() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  // Envia e-mail de redefinição de senha. O link leva de volta ao app em /redefinir-senha.
  async function solicitarRecuperacaoSenha(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    if (error) throw error
  }

  // Define a nova senha (usado na sessão de recuperação aberta pelo link do e-mail)
  async function redefinirSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) throw error
  }

  // Atualiza preferências de limite no perfil (modo e/ou valor manual).
  // Aceita um objeto com qualquer um dos campos: { limite_diario, modo_limite }
  async function atualizarPreferenciasLimite(campos) {
    if (!usuario) return
    const { data, error } = await supabase
      .from('perfis')
      .update(campos)
      .eq('id', usuario.id)
      .select()
      .single()
    if (error) throw error
    setPerfil(data) // reflete imediatamente no app
    return data
  }

  // Mantida por compatibilidade: salva apenas o valor manual
  async function atualizarLimiteDiario(valor) {
    return atualizarPreferenciasLimite({ limite_diario: valor })
  }

  // Encerra a PRÓPRIA conta: desativa o perfil (ativo = false) e faz logout.
  // Não apaga dados nem remove o usuário do Auth. A segurança está no banco:
  //  - policy "Usuário atualiza apenas o próprio perfil" permite só o próprio id;
  //  - trigger impedir_autodesativacao bloqueia um ADMIN de se autodesativar
  //    (nesse caso o update lança erro e a conta não é encerrada).
  async function encerrarMinhaConta() {
    if (!usuario) throw new Error('Usuário não autenticado.')
    const { error } = await supabase
      .from('perfis')
      .update({ ativo: false })
      .eq('id', usuario.id)
    if (error) throw error
    // Desativado com sucesso → encerra a sessão.
    await supabase.auth.signOut()
  }

  // Marca o onboarding (primeiro acesso) como concluído no perfil do usuário.
  // Persistido no banco (perfis.onboarding_concluido) → funciona em qualquer
  // dispositivo. Atualiza o perfil no contexto para refletir na hora.
  async function marcarOnboardingConcluido() {
    if (!usuario) return
    const { data, error } = await supabase
      .from('perfis')
      .update({ onboarding_concluido: true })
      .eq('id', usuario.id)
      .select()
      .single()
    if (error) throw error
    setPerfil(data)
    return data
  }

  const valor = {
    usuario,
    perfil,
    carregando,
    cadastrar,
    entrar,
    sair,
    solicitarRecuperacaoSenha,
    redefinirSenha,
    atualizarLimiteDiario,
    atualizarPreferenciasLimite,
    marcarOnboardingConcluido,
    encerrarMinhaConta,
    ehAdmin: perfil?.papel === 'admin',
    // Conta desativada por um administrador (soft-disable). Só é verdade quando
    // o perfil já carregou e tem ativo === false.
    contaDesativada: perfil != null && perfil.ativo === false,
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
