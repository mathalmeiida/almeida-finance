
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

    // Ordem de exclusão respeitando dependências (foreign keys).
    // Filhos ANTES dos pais para evitar violação de integridade.
    const tabelasEmOrdem = [
      // Histórico de importações (filhos primeiro)
      'importacoes_itens',
      'importacoes',
      
      // Metas vinculadas a investimentos
      'metas_investimentos',
      
      // Amortizações de parcelamentos
      'amortizacoes',
      
      // Movimentações de benefícios e investimentos
      'beneficios_movimentacoes',
      'investimentos_movimentacoes',
      
      // Faturas e exceções (dependem de cartões/despesas)
      'faturas_cartao',
      'despesas_tipo_excecoes',
      
      // Compras de cartão
      'compras_cartao',
      
      // Entidades principais
      'beneficios',
      'parcelamentos',
      'despesas',
      'receitas',
      'investimentos',
      'metas',
      'cartoes',
    ]

    // Exclui tabela por tabela. Cada operação falha se houver erro.
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

    // Exclui apenas categorias personalizadas (usuario_id não nulo).
    // Categorias padrão (usuario_id IS NULL) são preservadas.
    const { error: erroCategorias } = await supabase
      .from('categorias')
      .delete()
      .eq('usuario_id', uid)

    if (erroCategorias) {
      throw new Error(
        `Erro ao apagar categorias: ${erroCategorias.message}`
      )
    }

    // Reinicia as configurações financeiras no perfil.
    // Mantém nome, e-mail, tema, papel (role), ativo e outras preferências.
    const { data: perfilAtualizado, error: erroPerfil } =
      await supabase
        .from('perfis')
        .update({
          // Zera saldo e patrimônio
          saldo_base: null,
          saldo_base_data: null,
          
          // Zera reserva financeira
          reserva_atual: 0,
          meta_reserva: 0,
          reserva_percentual: 20,
          reserva_configurada: false,
          
          // Zera limites
          modo_limite: 'auto',
          limite_diario: null,
          
          // Zera onboarding financeiro
          onboarding_concluido: false,
          // objetivos_financeiros: null,  // Descomentar se coluna existir
          // onboarding_etapa: null,        // Descomentar se coluna existir
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
    }

    return true
  }

  return { zerarDados }
}
