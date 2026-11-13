-- ============================================================
-- MIGRAÇÃO — Almeida Finance 2.0
-- RPC TRANSACIONAL: Zerar Dados Financeiros
--
-- Objetivo: Executar a exclusão de TODOS os dados financeiros do usuário
-- autenticado de forma ATÔMICA (tudo ou nada), garantindo que falhas em
-- qualquer tabela causem rollback completo da operação.
--
-- Características:
--   • Transacional: BEGIN/COMMIT/ROLLBACK automático
--   • Autenticação obrigatória: valida auth.uid() IS NOT NULL
--   • Isolamento total: SECURITY INVOKER (usa a sessão do usuário autenticado)
--   • Ordem correta: respeita foreign keys (filhos antes dos pais)
--   • Atomicidade: qualquer erro reverte TODA a exclusão
--   • Preserva: conta (nome, email, tema), sessão, dados não financeiros
--
-- Segurança:
--   • SECURITY INVOKER: roda com os privilégios do usuário autenticado
--   • RLS aplicado automaticamente em todas as tabelas
--   • auth.uid() MUST NOT BE NULL (bloqueia chamadas não autenticadas)
--   • search_path fixo: impede SQL injection via search_path
--   • Sem parâmetros: impossível informar ID de outro usuário
--
-- Execute no Supabase: SQL Editor > New query > cole e clique em Run.
--
-- SEGURO: idempotente, não apaga nem altera estrutura do banco.
-- ============================================================


-- ------------------------------------------------------------
-- Função: public.zerar_dados_financeiros()
-- Exclui TODOS os dados financeiros do usuário autenticado.
-- Retorna TRUE se bem-sucedido, lança erro caso contrário.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_dados_financeiros()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER  -- Roda com os privilégios do usuário autenticado (RLS aplicado)
SET search_path = public  -- Previne SQL injection via search_path
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INTEGER;
BEGIN
  -- 1. Valida autenticação: obrigatório ter usuário logado
  v_usuario_id := auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. É necessário estar logado para executar esta operação.'
      USING HINT = 'Faça login e tente novamente.';
  END IF;

  -- 2. Exclusão em ORDEM correta (foreign keys: filhos antes dos pais)
  -- Cada DELETE é protegido por RLS automaticamente (SECURITY INVOKER).
  -- Qualquer erro (permissão, FK, timeout) causará ROLLBACK de toda a transação.

  -- Histórico de importações (filhos primeiro)
  DELETE FROM public.importacoes_itens WHERE usuario_id = v_usuario_id;
  DELETE FROM public.importacoes WHERE usuario_id = v_usuario_id;

  -- Metas vinculadas a investimentos
  DELETE FROM public.metas_investimentos WHERE usuario_id = v_usuario_id;

  -- Amortizações de parcelamentos
  DELETE FROM public.amortizacoes WHERE usuario_id = v_usuario_id;

  -- Movimentações de benefícios e investimentos
  DELETE FROM public.beneficios_movimentacoes WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos_movimentacoes WHERE usuario_id = v_usuario_id;

  -- Faturas e exceções (dependem de cartões/despesas)
  DELETE FROM public.faturas_cartao WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas_tipo_excecoes WHERE usuario_id = v_usuario_id;

  -- Compras de cartão
  DELETE FROM public.compras_cartao WHERE usuario_id = v_usuario_id;

  -- Entidades principais
  DELETE FROM public.beneficios WHERE usuario_id = v_usuario_id;
  DELETE FROM public.parcelamentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.receitas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.metas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.cartoes WHERE usuario_id = v_usuario_id;

  -- Categorias personalizadas (usuario_id não nulo)
  -- Categorias padrão (usuario_id IS NULL) são preservadas
  DELETE FROM public.categorias WHERE usuario_id = v_usuario_id;

  -- 3. Reseta campos financeiros no perfil
  -- Mantém: nome, email, cor_tema, papel, ativo, datas de auditoria
  UPDATE public.perfis
  SET
    -- Zera saldo e patrimônio
    saldo_base = NULL,
    saldo_base_data = NULL,
    
    -- Zera reserva financeira
    reserva_atual = 0,
    meta_reserva = 0,
    reserva_percentual = 20,
    reserva_configurada = FALSE,
    
    -- Zera limites
    modo_limite = 'auto',
    limite_diario = NULL,
    
    -- Zera onboarding financeiro
    onboarding_concluido = FALSE,
    
    -- Atualiza timestamp
    atualizado_em = NOW()
  WHERE id = v_usuario_id;

  -- 4. Valida que o perfil foi atualizado
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário autenticado.'
      USING HINT = 'Verifique se o perfil existe na tabela public.perfis.';
  END IF;

  -- 5. Sucesso: retorna TRUE
  -- A transação será commitada automaticamente (modo AUTOCOMMIT)
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro causa rollback automático de toda a transação
    RAISE EXCEPTION 'Erro ao zerar dados financeiros: % (SQLSTATE: %)', 
      SQLERRM, SQLSTATE
      USING HINT = 'A operação foi revertida completamente. Nenhum dado foi excluído.';
END;
$$;


-- ------------------------------------------------------------
-- Comentário da função (documentação no Supabase Dashboard)
-- ------------------------------------------------------------
COMMENT ON FUNCTION public.zerar_dados_financeiros() IS 
'Exclui TODOS os dados financeiros do usuário autenticado de forma transacional (atômica).

SEGURANÇA:
• SECURITY INVOKER: roda com os privilégios do usuário autenticado (RLS aplicado automaticamente)
• Obrigatório: auth.uid() IS NOT NULL (bloqueia chamadas não autenticadas)
• Isolamento: apenas registros do usuário autenticado (usuario_id = auth.uid())
• Atomicidade: qualquer erro reverte TODA a operação (rollback completo)

EXCLUSÃO:
• 17 tabelas financeiras: importacoes, investimentos, cartoes, despesas, receitas, metas, etc.
• Ordem correta: filhos antes dos pais (respeita foreign keys)
• Categorias: apenas personalizadas (usuario_id não nulo); padrões preservadas

PRESERVAÇÃO:
• Conta: nome, email, cor_tema, papel, ativo
• Sessão: token de autenticação (auth.users)
• Preferências: tema, notificações, feedbacks
• Campos perfis resetados: saldo, reserva, limite, onboarding

RETORNO:
• TRUE: exclusão bem-sucedida
• EXCEPTION: falha (rollback automático, nenhum dado excluído)

EXEMPLO DE USO (JavaScript):
const { data, error } = await supabase.rpc(''zerar_dados_financeiros'')
if (error) throw error
console.log(''Dados excluídos com sucesso:'', data) // true
';


-- ------------------------------------------------------------
-- Grant: permite execução por usuários autenticados
-- ------------------------------------------------------------
-- Não é necessário grant explícito: SECURITY INVOKER + RLS já garantem
-- que apenas o próprio usuário pode excluir seus dados.
-- A função não precisa de privilégios elevados (SECURITY DEFINER).

-- Opcional: garantir que authenticated role pode executar a função
-- (já é o padrão, mas explicitamos para clareza)
GRANT EXECUTE ON FUNCTION public.zerar_dados_financeiros() TO authenticated;


-- ------------------------------------------------------------
-- Revoga: anon (usuários não autenticados) não podem executar
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM anon;


-- ------------------------------------------------------------
-- FIM DA MIGRAÇÃO
-- ------------------------------------------------------------
-- Idempotente: pode ser rodada múltiplas vezes sem efeito colateral.
-- Rollback: não é necessário — a função não altera estrutura, apenas cria.
-- Para remover: DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
