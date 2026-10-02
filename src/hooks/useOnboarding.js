import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Controla o fluxo de primeiro acesso (onboarding).
 *
 * FONTE PRINCIPAL: perfis.onboarding_concluido (persistido no Supabase, por
 * conta → funciona em qualquer dispositivo). Sem localStorage.
 *
 * Regra de exibição:
 *   - onboarding_concluido === true  → NUNCA mostra.
 *   - onboarding_concluido === false → mostra, EXCETO se o usuário já tiver
 *     dados financeiros (receita/despesa/cartão). Nesse caso ele é uma conta
 *     já configurada: não mostra e corrige a flag no banco (defesa extra, caso
 *     a migração não tenha coberto algum perfil).
 *
 * Observação: a Parte 2 do SQL já marcou onboarding_concluido = TRUE para as
 * contas existentes com dados. A checagem por dados aqui é só uma salvaguarda.
 */
export function useOnboarding() {
  const { usuario, perfil, marcarOnboardingConcluido } = useAuth()
  const [verificando, setVerificando] = useState(true)
  const [precisaOnboarding, setPrecisaOnboarding] = useState(false)

  const verificar = useCallback(async () => {
    if (!usuario) return
    // Aguarda o perfil carregar (o AuthContext busca em "perfis"). Enquanto
    // não chegar, mantém "verificando" para não liberar o app nem piscar o
    // onboarding antes de sabermos o status real.
    if (perfil == null) { setVerificando(true); return }

    setVerificando(true)
    try {
      // Fonte principal: campo persistido no banco.
      if (perfil.onboarding_concluido === true) {
        setPrecisaOnboarding(false)
        return
      }

      // Salvaguarda: conta antiga sem a flag marcada mas que já tem dados.
      const [receitas, despesas, cartoes] = await Promise.all([
        supabase.from('receitas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),
        supabase.from('despesas').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),
        supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('usuario_id', usuario.id),
      ])
      const totalDados =
        (receitas.count ?? 0) + (despesas.count ?? 0) + (cartoes.count ?? 0)

      if (totalDados > 0) {
        // Já configurada: não mostra e corrige a flag no banco.
        setPrecisaOnboarding(false)
        try { await marcarOnboardingConcluido() } catch { /* não bloqueia o acesso */ }
        return
      }

      // Conta nova e vazia, sem flag → mostra o onboarding.
      setPrecisaOnboarding(true)
    } catch {
      // Em falha de rede, por segurança NÃO interrompe o acesso ao app.
      setPrecisaOnboarding(false)
    } finally {
      setVerificando(false)
    }
  }, [usuario, perfil, marcarOnboardingConcluido])

  useEffect(() => {
    if (usuario) verificar()
    else { setVerificando(false); setPrecisaOnboarding(false) }
  }, [usuario, verificar])

  // Conclui o onboarding: grava onboarding_concluido = true no Supabase.
  const concluir = useCallback(async () => {
    try {
      await marcarOnboardingConcluido()
    } catch {
      // Mesmo se a gravação falhar, libera o acesso ao app nesta sessão.
    } finally {
      setPrecisaOnboarding(false)
    }
  }, [marcarOnboardingConcluido])

  return { verificando, precisaOnboarding, concluir, reverificar: verificar }
}
