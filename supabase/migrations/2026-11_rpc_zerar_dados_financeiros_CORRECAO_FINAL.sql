-- ============================================================
-- MIGRAÇÃO CORRETIVA FINAL — Almeida Finance 2.0
-- RPC TRANSACIONAL: Zerar Dados Financeiros
--
-- PROBLEMA:
--   A função public.zerar_dados_financeiros() (commit 415eb27) falha em
--   produção porque referencia a tabela public.metas_investimentos, que
--   não existe no banco de produção (projeto ievccupeijzuzhomphwn).
--
-- SOLUÇÃO:
--   Substituir DELETE direto por verificação com to_regclass() + EXECUTE.
--   Preservar TODAS as outras exclusões, validações e garantias de segurança.
--
-- MUDANÇA ESPECÍFICA:
--   DELETE FROM public.metas_investimentos WHERE usuario_id = v_usuario_id;
--   ↓
--   IF to_regclass('public.metas_investimentos') IS NOT NULL THEN
--     EXECUTE 'DELETE FROM public.metas_investimentos WHERE usuario_id = $1'
--       USING v_usuario_id;
--   END IF;
--
-- CARACTERÍSTICAS PRESERVADAS:
--   • SECURITY INVOKER: RLS aplicado automaticamente
--   • auth.uid() obrigatório: bloqueia chamadas não autenticadas
--   • Atomicidade: EXCEPTION block + rollback completo
--   • Isolamento: usuario_id = auth.uid() em todos os DELETEs
--   • Ordem FK: filhos antes dos pais (17 tabelas)
--   • Permissões: authenticated = true, anon/public = false
--
-- PRÉ-REQUISITOS:
--   ✅ Backup Supabase confirmado (7-30 dias automático)
--   ✅ Executar AUDITORIA-TABELAS-PRODUCAO.sql (opcional, recomendado)
--
-- APLICAÇÃO:
--   Supabase Dashboard → SQL Editor → colar esta migration → Run
--   Tempo: ~200ms
--   Resultado esperado: "Success" ou "Function created"
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
--
-- IDEMPOTENTE: pode ser executada múltiplas vezes sem efeitos colaterais.
-- NÃO altera dados: apenas substitui a DEFINIÇÃO da função.
-- ============================================================


-- ------------------------------------------------------------
-- PRÉ-VALIDAÇÃO: Verifica tabelas obrigatórias
-- (Opcional mas recomendado para ambiente novo)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tabelas_faltantes TEXT[] := ARRAY[]::TEXT[];
  v_tabela TEXT;
BEGIN
  -- Lista de tabelas OBRIGATÓRIAS (16 tabelas + perfis)
  -- metas_investimentos é OPCIONAL (verificação condicional na função)
  FOR v_tabela IN 
    SELECT unnest(ARRAY[
      'importacoes_itens',
      'importacoes',
      'amortizacoes',
      'beneficios_movimentacoes',
      'investimentos_movimentacoes',
      'faturas_cartao',
      'despesas_tipo_excecoes',
      'compras_cartao',
      'beneficios',
      'parcelamentos',
      'despesas',
      'receitas',
      'investimentos',
      'metas',
      'cartoes',
      'categorias',
      'perfis'
    ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = v_tabela
    ) THEN
      v_tabelas_faltantes := array_append(v_tabelas_faltantes, v_tabela);
    END IF;
  END LOOP;
  
  -- Se houver tabelas obrigatórias faltando, ABORTA com erro claro
  IF array_length(v_tabelas_faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'ERRO CRÍTICO: Tabelas obrigatórias ausentes: %', 
      array_to_string(v_tabelas_faltantes, ', ')
      USING HINT = 'Aplique o schema.sql ou migrations faltantes antes desta correção.';
  END IF;
  
  -- Validar colunas críticas da tabela perfis (usada no UPDATE)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'perfis' 
    AND column_name IN (
      'id', 'saldo_base', 'saldo_base_data', 'reserva_atual', 
      'meta_reserva', 'reserva_percentual', 'reserva_configurada',
      'modo_limite', 'limite_diario', 'onboarding_concluido', 'atualizado_em'
    )
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 11
  ) THEN
    RAISE EXCEPTION 'ERRO CRÍTICO: Tabela perfis não tem todas as colunas necessárias'
      USING HINT = 'Verifique o schema da tabela perfis (11 colunas esperadas).';
  END IF;
  
  RAISE NOTICE 'PRÉ-VALIDAÇÃO OK: Todas as tabelas e colunas obrigatórias existem.';
END $$;


-- ------------------------------------------------------------
-- Função CORRIGIDA: public.zerar_dados_financeiros()
-- Exclui TODOS os dados financeiros do usuário autenticado.
-- Retorna TRUE se bem-sucedido, lança EXCEPTION caso contrário.
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

  -- Metas vinculadas a investimentos (CONDICIONAL: só se a tabela existir)
  -- NOTA: Funcionalidade opcional até migration 2026-10_metas_investimentos.sql
  -- ser aplicada. O frontend (useMetaInvestimentos.js) degrada graciosamente
  -- quando a tabela não existe. Usamos to_regclass() para verificação em
  -- tempo de execução e EXECUTE para SQL dinâmico seguro.
  IF to_regclass('public.metas_investimentos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.metas_investimentos WHERE usuario_id = $1'
      USING v_usuario_id;
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
• search_path fixo: previne SQL injection via search_path

EXCLUSÃO:
• 17 tabelas financeiras: importacoes, investimentos, cartoes, despesas, receitas, metas, etc.
• Ordem correta: filhos antes dos pais (respeita foreign keys)
• Categorias: apenas personalizadas (usuario_id não nulo); padrões preservadas
• Condicional: metas_investimentos (só deleta se a tabela existir - funcionalidade opcional)

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

CORREÇÃO FINAL (2026-11):
• Verificação com to_regclass() + EXECUTE para metas_investimentos
• Compatível com ambientes onde a migration 2026-10_metas_investimentos.sql não foi aplicada
• Pré-validação de 17 tabelas obrigatórias antes de criar a função
• Falha rápido se schema estiver incompleto
';


-- ------------------------------------------------------------
-- Permissões: execução restrita a usuários autenticados
-- ------------------------------------------------------------
-- Revoga de PUBLIC para segurança máxima
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM PUBLIC;

-- Revoga explicitamente de anon (usuários não autenticados)
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM anon;

-- Concede execução APENAS para usuários autenticados
GRANT EXECUTE ON FUNCTION public.zerar_dados_financeiros() TO authenticated;


-- ------------------------------------------------------------
-- FIM DA MIGRAÇÃO CORRETIVA FINAL
-- ------------------------------------------------------------
-- ✅ IDEMPOTENTE: substitui a versão anterior (CREATE OR REPLACE)
-- ✅ SEGURA: não altera dados, apenas a DEFINIÇÃO da função
-- ✅ VALIDADA: pré-validação de 17 tabelas obrigatórias
-- ✅ CONDICIONAL: to_regclass() + EXECUTE para metas_investimentos
--
-- PRÓXIMOS PASSOS:
-- 1. Revisar esta migration completa
-- 2. Executar no Supabase Dashboard → SQL Editor
-- 3. Validar: "PRÉ-VALIDAÇÃO OK" + "Success"
-- 4. Testar com conta fictícia (criar dados → executar RPC → validar exclusão)
--
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
--
-- NOTA: Para ativar a funcionalidade de vínculos metas ↔ investimentos,
-- aplique posteriormente a migration 2026-10_metas_investimentos.sql.
-- ============================================================
