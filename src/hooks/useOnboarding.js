import { useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

/**
 * Controla o fluxo de primeiro acesso (onboarding).
 *
 * FONTE DA VERDADE: perfis.onboarding_concluido no Supabase, vinculado ao
 * usuário autenticado → vale em qualquer dispositivo, após atualizar a página,
 * fechar o navegador, reiniciar o celular ou sair e entrar de novo.
 *
 * A decisão é DERIVADA de forma síncrona do perfil já carregado (sem efeito
 * assíncrono intermediário), então não existe um quadro em que o onboarding
 * "pisque" antes de o status real ser conhecido:
 *   - perfil ainda não carregou → verificando = true (tela de carregamento);
 *   - erro ao carregar o perfil → erro (tela "Tentar novamente"), NUNCA o
 *     onboarding por engano;
 *   - onboarding_concluido === true  → nunca mostra;
 *   - onboarding_concluido !== true  → mostra (conta nova ou "Reiniciar
 *     onboarding" feito pelo Admin). Dados financeiros não são apagados.
 *
 * Usa SEMPRE o perfil do próprio usuário logado (perfilProprio). No modo
 * consultoria `perfil` é o do cliente e não deve decidir o onboarding do
 * consultor.
 */
export function useOnboarding() {
  const { usuario, perfilProprio, perfilErro, marcarOnboardingConcluido } = useAuth()

  const verificando = !!usuario && perfilProprio == null && !perfilErro
  const precisaOnboarding = !!usuario && !!perfilProprio && perfilProprio.onboarding_concluido !== true

  // Conclui o onboarding: grava onboarding_concluido = true no banco (com
  // novas tentativas e reenvio automático se estiver sem conexão).
  const concluir = useCallback(() => marcarOnboardingConcluido(), [marcarOnboardingConcluido])

  return { verificando, precisaOnboarding, erro: perfilErro, concluir }
}
