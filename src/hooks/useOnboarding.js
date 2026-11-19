import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Controla o fluxo de primeiro acesso (onboarding).
 *
 * FONTE PRINCIPAL e ÚNICA: perfis.onboarding_concluido (persistido no Supabase,
 * por conta → funciona em qualquer dispositivo). Sem localStorage.
 *
 * Regra de exibição:
 *   - onboarding_concluido === true  → NUNCA mostra.
 *   - onboarding_concluido === false → SEMPRE mostra o onboarding, inclusive
 *     para contas que já têm dados financeiros (ex.: quando o Admin usa
 *     "Reiniciar onboarding"). Os dados NÃO são apagados — o fluxo apenas
 *     reaparece e as etapas vêm pré-preenchidas com o que já existe.
 */
export function useOnboarding() {
  const { usuario, perfil, marcarOnboardingConcluido } = useAuth()
  const [verificando, setVerificando] = useState(true)
  const [precisaOnboarding, setPrecisaOnboarding] = useState(false)

  const verificar = useCallback(async () => {
    console.log('[useOnboarding] verificar() chamado', { 
      temUsuario: !!usuario, 
      temPerfil: !!perfil,
      perfilNull: perfil == null 
    })
    
    if (!usuario) {
      console.log('[useOnboarding] Sem usuario, retornando')
      return
    }
    // Aguarda o perfil carregar (o AuthContext busca em "perfis"). Enquanto
    // não chegar, mantém "verificando" para não liberar o app nem piscar o
    // onboarding antes de sabermos o status real.
    if (perfil == null) { 
      console.log('[useOnboarding] perfil == null, setando verificando=true')
      setVerificando(true); 
      return 
    }

    // Se já está no onboarding ativo, NÃO reverifica (evita sair prematuramente)
    const configurandoOnboarding = (() => {
      try { return localStorage.getItem('almeida_configurando_onboarding') === '1' }
      catch { return false }
    })()
    console.log('[useOnboarding] configurandoOnboarding:', configurandoOnboarding)
    
    if (configurandoOnboarding) {
      console.log('[useOnboarding] Em modo configuração, retornando SEM setar verificando=false')
      return
    }

    console.log('[useOnboarding] Iniciando verificação...')
    setVerificando(true)
    try {
      // Fonte principal e ÚNICA: a flag persistida no banco.
      //  - true  → onboarding concluído, nunca mostra.
      //  - false → mostra o onboarding. Isso vale tanto para contas novas e
      //    vazias quanto para contas que o ADMIN reiniciou (onboarding_concluido
      //    = false) MESMO que já tenham dados financeiros. Os dados NÃO são
      //    apagados; o fluxo apenas reaparece e os campos vêm pré-preenchidos.
      //
      // Importante: NÃO auto-corrigimos mais a flag com base na existência de
      // dados. Fazer isso anulava o "Reiniciar onboarding" do Admin para quem
      // já tinha receitas/despesas (a flag voltava a true e o fluxo não abria).
      const precisa = perfil.onboarding_concluido !== true
      console.log('[useOnboarding] onboarding_concluido:', perfil.onboarding_concluido, '→ precisaOnboarding:', precisa)
      setPrecisaOnboarding(precisa)
    } catch (err) {
      console.error('[useOnboarding] Erro ao verificar:', err)
      // Em falha de rede, por segurança NÃO interrompe o acesso ao app.
      setPrecisaOnboarding(false)
    } finally {
      console.log('[useOnboarding] Finalizando verificação, setando verificando=false')
      setVerificando(false)
    }
  }, [usuario, perfil])

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
