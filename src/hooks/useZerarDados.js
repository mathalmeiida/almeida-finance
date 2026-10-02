import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * Hook que apaga TODOS os dados financeiros do usuário autenticado,
 * mantendo a conta/login e as categorias padrão do sistema.
 *
 * Segurança:
 *  - Toda operação filtra por usuario_id = usuário autenticado.
 *  - O RLS do Supabase garante que nada de outro usuário é afetado.
 *  - Categorias padrão (usuario_id = NULL) NÃO são tocadas (o filtro .eq exclui NULL).
 *
 * Ordem de exclusão (filhos → pais) para evitar erro de chave estrangeira,
 * ainda que as FKs usem CASCADE/SET NULL:
 *   compras_cartao → cartoes → parcelamentos → despesas → receitas → metas → categorias próprias
 * Por fim, restaura apenas as preferências que existem no schema atual
 * (reserva_percentual = 20). Conta, login, nome, e-mail, papel, status ativo
 * e onboarding_concluido são preservados.
 */
export function useZerarDados() {
  const { usuario } = useAuth()

  async function zerarDados() {
    if (!usuario) throw new Error('Usuário não autenticado.')
    const uid = usuario.id

    // Exclusão em ordem segura (cada passo filtra pelo usuário autenticado)
    const tabelasEmOrdem = [
      'compras_cartao',
      'cartoes',
      'parcelamentos',
      'despesas',
      'receitas',
      'metas',
    ]

    for (const tabela of tabelasEmOrdem) {
      const { error } = await supabase
        .from(tabela)
        .delete()
        .eq('usuario_id', uid)
      if (error) {
        throw new Error(`Erro ao apagar ${tabela}: ${error.message}`)
      }
    }

    // Categorias: apaga SOMENTE as personalizadas do usuário.
    // O filtro .eq('usuario_id', uid) nunca casa com as padrão (usuario_id = NULL).
    const { error: errCat } = await supabase
      .from('categorias')
      .delete()
      .eq('usuario_id', uid)
    if (errCat) {
      throw new Error(`Erro ao apagar categorias personalizadas: ${errCat.message}`)
    }

    // Reseta APENAS as preferências financeiras que existem no schema atual.
    // No momento, somente "reserva_percentual" é garantida no banco; colunas
    // como "modo_limite"/"limite_diario" NÃO existem no schema e, se incluídas
    // no update, fariam o PostgREST falhar ("Could not find the 'modo_limite'
    // column"). Por isso resetamos só o que existe. Preserva conta, login,
    // nome, e-mail, papel, ativo e onboarding_concluido (não são tocados).
    //
    // Envolto em try/catch: mesmo que o reset da preferência falhe, os dados
    // financeiros (acima) já foram apagados — o objetivo principal do botão.
    try {
      const { error: errPerfil } = await supabase
        .from('perfis')
        .update({ reserva_percentual: 20 })
        .eq('id', uid)
      if (errPerfil) {
        // Não relança: a limpeza dos dados financeiros não deve ser revertida
        // por causa do reset de uma preferência.
        console.warn('Dados zerados, mas não foi possível restaurar a reserva padrão:', errPerfil.message)
      }
    } catch (e) {
      console.warn('Dados zerados; reset da reserva padrão ignorado:', e?.message)
    }
  }

  return { zerarDados }
}
