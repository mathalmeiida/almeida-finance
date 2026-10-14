
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

    const uid = usuario.id

    // Exclui registros financeiros da conta autenticada.
    // Movimentações são removidas antes dos benefícios.
    const tabelasEmOrdem = [
      'beneficios_movimentacoes',
      'beneficios',
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
        throw new Error(
          `Erro ao apagar ${tabela}: ${error.message}`
        )
      }
    }

    // Exclui apenas categorias personalizadas.
    const { error: erroCategorias } = await supabase
      .from('categorias')
      .delete()
      .eq('usuario_id', uid)

    if (erroCategorias) {
      throw new Error(
        `Erro ao apagar categorias: ${erroCategorias.message}`
      )
    }

    // Reinicia as configurações financeiras.
    // Mantém nome, e-mail, tema, papel e acesso à conta.
    const { data: perfilAtualizado, error: erroPerfil } =
      await supabase
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
          onboarding_concluido: false,
        })
        .eq('id', uid)
        .select('id')
        .single()

    if (erroPerfil || !perfilAtualizado) {
      throw new Error(
        `Erro ao reiniciar configurações: ${
          erroPerfil?.message || 'Perfil não atualizado'
        }`
      )
    }

    return true
  }

  return { zerarDados }
}
