-- ============================================================
-- MIGRAÇÃO CORRETIVA — Almeida Finance 2.0
-- RPC TRANSACIONAL: Zerar Dados Financeiros (CORREÇÃO)
--
-- PROBLEMA IDENTIFICADO:
--   A função public.zerar_dados_financeiros() referencia a tabela
--   public.metas_investimentos (linha DELETE FROM public.metas_investimentos),
--   porém esta tabela pode não existir em ambientes onde a migration
--   2026-10_metas_investimentos.sql não foi aplicada.
--
-- SOLUÇÃO:
--   Tornar o DELETE de metas_investimentos CONDICIONAL: só executa se
--   a tabela existir. Caso contrário, pula silenciosamente (sem erro).
--
-- ESTRATÉGIA:
--   • Preservar TODA a lógica transacional (atomicidade, rollback, validações)
--   • Adicionar verificação: IF EXISTS tabela THEN DELETE END IF
--   • Manter SECURITY INVOKER, auth.uid() validation, RLS, FK order
--   • Manter permissões: authenticated = true, anon = false
--   • Idempotente: pode substituir a versão anterior sem efeitos colaterais
--
-- SEGURANÇA:
--   • NÃO altera dados durante a aplicação da migration
--   • NÃO remove a tabela metas_investimentos se ela existir
--   • NÃO afeta usuários reais (apenas corrige a DEFINIÇÃO da função)
--
-- APLICAÇÃO:
--   Supabase Dashboard → SQL Editor → colar esta migration → Run
--   OU via CLI: supabase db push --include-all
--
-- ROLLBACK (se necessário):
--   Não é necessário: esta migration substitui a função anterior (CREATE OR REPLACE).
--   Para remover: DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
-- ============================================================


-- ------------------------------------------------------------
-- Função CORRIGIDA: public.zerar_dados_financeiros()
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
  v_tabela_metas_inv_existe BOOLEAN;
BEGIN
  -- 1. Valida autenticação: obrigatório ter usuário logado
  v_usuario_id := auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. É necessário estar logado para executar esta operação.'
      USING HINT = 'Faça login e tente novamente.';
  END IF;

  -- 2. Verifica se a tabela metas_investimentos existe
  -- (pode não existir se a migration 2026-10_metas_investimentos.sql não foi aplicada)
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'metas_investimentos'
  ) INTO v_tabela_metas_inv_existe;

  -- 3. Exclusão em ORDEM correta (foreign keys: filhos antes dos pais)
  -- Cada DELETE é protegido por RLS automaticamente (SECURITY INVOKER).
  -- Qualquer erro (permissão, FK, timeout) causará ROLLBACK de toda a transação.

  -- Histórico de importações (filhos primeiro)
  DELETE FROM public.importacoes_itens WHERE usuario_id = v_usuario_id;
  DELETE FROM public.importacoes WHERE usuario_id = v_usuario_id;

  -- Metas vinculadas a investimentos (CONDICIONAL: só se a tabela existir)
  IF v_tabela_metas_inv_existe THEN
    DELETE FROM public.metas_investimentos WHERE usuario_id = v_usuario_id;
  END IF;

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

  -- 4. Reseta campos financeiros no perfil
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

  -- 5. Valida que o perfil foi atualizado
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário autenticado.'
      USING HINT = 'Verifique se o perfil existe na tabela public.perfis.';
  END IF;

  -- 6. Sucesso: retorna TRUE
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
• Condicional: metas_investimentos (só deleta se a tabela existir)

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

CORREÇÃO (2026-11):
• Tornou o DELETE de metas_investimentos condicional (verifica se tabela existe)
• Compatível com ambientes onde a migration 2026-10_metas_investimentos.sql não foi aplicada
';


-- ------------------------------------------------------------
-- Grant: permite execução por usuários autenticados
-- (mantém as permissões da versão anterior)
-- ------------------------------------------------------------
-- Revoga primeiro de PUBLIC para garantir segurança máxima
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM PUBLIC;

-- Revoga explicitamente de anon (usuários não autenticados)
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM anon;

-- Concede execução apenas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.zerar_dados_financeiros() TO authenticated;


-- ------------------------------------------------------------
-- FIM DA MIGRAÇÃO CORRETIVA
-- ------------------------------------------------------------
-- Idempotente: substitui a versão anterior (CREATE OR REPLACE).
-- NÃO altera dados: apenas corrige a DEFINIÇÃO da função.
-- Rollback: não é necessário — para remover, use:
--   DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
--
-- NOTA IMPORTANTE:
--   Se você pretende usar funcionalidades de metas vinculadas a investimentos,
--   aplique ANTES a migration 2026-10_metas_investimentos.sql.
--   Esta correção apenas torna a função RPC compatível com ambientes onde
--   essa tabela ainda não foi criada.
-- ------------------------------------------------------------
