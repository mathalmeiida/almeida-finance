
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'

export function useZerarDados() {
  const { usuario, modoConsultoria } = useAuth()

  async function zerarDados() {
    bloquearSeConsultoria(modoConsultoria)

    if (!usuario?.id) {
      throw new Error('Usuário não autenticado.')
    }

    // Chama a função RPC transacional do PostgreSQL.
    // A exclusão é ATÔMICA: ou exclui TODAS as 17 tabelas + reseta perfil,
    // ou reverte TUDO em caso de erro (rollback automático).
    // 
    // Segurança:
    // • SECURITY INVOKER: usa auth.uid() do usuário autenticado (RLS aplicado)
    // • Sem parâmetros: impossível informar ID de outro usuário
    // • Ordem correta: filhos antes dos pais (respeita foreign keys)
    // • Preserva: nome, email, tema, sessão, dados não financeiros
    const { data: sucesso, error: erroRPC } = await supabase
      .rpc('zerar_dados_financeiros')

    if (erroRPC) {
      // Erro na RPC: rollback automático, nenhum dado foi excluído
      throw new Error(
        `Erro ao executar exclusão transacional: ${erroRPC.message}`
      )
    }

    if (!sucesso) {
      // RPC retornou false (não deveria acontecer, mas validamos)
      throw new Error(
        'Falha ao zerar dados financeiros. Operação não foi concluída.'
      )
    }

    // SUCESSO: todos os dados financeiros foram excluídos atomicamente.
    // Agora limpamos o armazenamento local (só após confirmação de sucesso).

    // Limpa localStorage de dados financeiros (preserva tema, sessão, etc.)
    try {
      const chavesParaRemover = Object.keys(localStorage).filter(k =>
        k.startsWith('almeida_saldo_') ||
        k.startsWith('almeida_limite_') ||
        k.startsWith('almeida_reserva_') ||
        k.startsWith('almeida_onboarding_') ||
        k === 'almeida_refazer_onboarding'
      )
      chavesParaRemover.forEach(k => localStorage.removeItem(k))
    } catch {
      // Ignora erros de localStorage (privacidade, quota, etc.)
      // Não é crítico: dados já foram excluídos do servidor
    }

    return true
  }

  return { zerarDados }
}
