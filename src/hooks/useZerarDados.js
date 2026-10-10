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

    // Reseta as PREFERÊNCIAS FINANCEIRAS persistidas no perfil, para o Dashboard
    // voltar ao estado "sem dados" após o reset. Todas estas colunas existem no
    // schema (ver schema.sql + migrations):
    //   • limite_diario / modo_limite → senão um limite manual antigo (ex.:
    //     R$ 45,45) continuaria sendo exibido como "limite para gastar hoje";
    //   • saldo_base / saldo_base_data → zera o saldo atual informado;
    //   • reserva_atual / meta_reserva / reserva_configurada → zera a reserva;
    //   • reserva_percentual volta ao padrão 20.
    // PRESERVA (não são tocados): id, nome, email, papel, ativo,
    // onboarding_concluido, cor_tema, ultimo_acesso — conta/login/config.
    //
    // Envolto em try/catch: mesmo que o reset da preferência falhe, os dados
    // financeiros (acima) já foram apagados — o objetivo principal do botão.
    try {
      const { error: errPerfil } = await supabase
        .from('perfis')
        .update({
          reserva_percentual: 20,
          modo_limite: 'auto',
          limite_diario: null,
          saldo_base: null,
          saldo_base_data: null,
          reserva_atual: 0,
          meta_reserva: 0,
          reserva_configurada: false,
        })
        .eq('id', uid)
      if (errPerfil) {
        // Não relança: a limpeza dos dados financeiros não deve ser revertida
        // por causa do reset de uma preferência.
        console.warn('Dados zerados, mas não foi possível restaurar as preferências:', errPerfil.message)
      }
    } catch (e) {
      console.warn('Dados zerados; reset de preferências ignorado:', e?.message)
    }
  }

  return { zerarDados }
}
