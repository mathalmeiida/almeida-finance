-- ============================================================
-- MIGRACAO CORRETIVA FINAL - Almeida Finance 2.0
-- RPC TRANSACIONAL: Zerar Dados Financeiros
--
-- PROBLEMA:
--   A funcao public.zerar_dados_financeiros() falha em producao
--   porque referencia a tabela public.metas_investimentos, que
--   nao existe no banco de producao (projeto ievccupeijzuzhomphwn).
--
-- SOLUCAO:
--   Substituir DELETE direto por verificacao com to_regclass() + EXECUTE.
--   Preservar todas as outras exclusoes, validacoes e garantias.
--
-- CARACTERISTICAS:
--   - SECURITY INVOKER: RLS aplicado automaticamente
--   - auth.uid() obrigatorio: bloqueia chamadas nao autenticadas
--   - Atomicidade: EXCEPTION block + rollback completo
--   - Isolamento: usuario_id = auth.uid() em todos os DELETEs
--   - Ordem FK: filhos antes dos pais (17 tabelas)
--   - Permissoes: authenticated = true, anon/public = false
--
-- APLICACAO:
--   Supabase Dashboard > SQL Editor > colar esta migration > Run
--   Tempo: ~200ms
--   Resultado esperado: Success ou Function created
--
-- ROLLBACK:
--   DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
--
-- IDEMPOTENTE: pode ser executada multiplas vezes sem efeitos colaterais.
-- NAO altera dados: apenas substitui a DEFINICAO da funcao.
-- ============================================================


-- ------------------------------------------------------------
-- PRE-VALIDACAO: Verifica tabelas obrigatorias
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tabelas_faltantes TEXT[] := ARRAY[]::TEXT[];
  v_tabela TEXT;
BEGIN
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
  
  IF array_length(v_tabelas_faltantes, 1) > 0 THEN
    RAISE EXCEPTION 'ERRO CRITICO: Tabelas obrigatorias ausentes: %', 
      array_to_string(v_tabelas_faltantes, ', ')
      USING HINT = 'Aplique o schema.sql ou migrations faltantes antes desta correcao.';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'perfis' 
    AND column_name IN (
      'id', 'saldo_base', 'saldo_base_data', 'reserva_atual', 
      'meta_reserva', 'reserva_percentual', 'reserva_configurada',
      'modo_limite', 'limite_diario', 'onboarding_concluido'
    )
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 10
  ) THEN
    RAISE EXCEPTION 'ERRO CRITICO: Tabela perfis nao tem todas as colunas necessarias'
      USING HINT = 'Verifique o schema da tabela perfis (10 colunas esperadas).';
  END IF;
  
  RAISE NOTICE 'PRE-VALIDACAO OK: Todas as tabelas e colunas obrigatorias existem.';
END $$;


-- ------------------------------------------------------------
-- Funcao CORRIGIDA: public.zerar_dados_financeiros()
-- Exclui TODOS os dados financeiros do usuario autenticado.
-- Retorna TRUE se bem-sucedido, lanca EXCEPTION caso contrario.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_dados_financeiros()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INTEGER;
BEGIN
  -- 1. Valida autenticacao: obrigatorio ter usuario logado
  v_usuario_id := auth.uid();
  
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado. E necessario estar logado para executar esta operacao.'
      USING HINT = 'Faca login e tente novamente.';
  END IF;

  -- 2. Exclusao em ORDEM correta (foreign keys: filhos antes dos pais)
  -- Cada DELETE e protegido por RLS automaticamente (SECURITY INVOKER).
  -- Qualquer erro (permissao, FK, timeout) causara ROLLBACK de toda a transacao.

  -- Historico de importacoes (filhos primeiro)
  DELETE FROM public.importacoes_itens WHERE usuario_id = v_usuario_id;
  DELETE FROM public.importacoes WHERE usuario_id = v_usuario_id;

  -- Metas vinculadas a investimentos (CONDICIONAL: so se a tabela existir)
  -- NOTA: Funcionalidade opcional ate migration 2026-10_metas_investimentos.sql
  -- ser aplicada. O frontend (useMetaInvestimentos.js) degrada graciosamente
  -- quando a tabela nao existe. Usamos to_regclass() para verificacao em
  -- tempo de execucao e EXECUTE para SQL dinamico seguro.
  IF to_regclass('public.metas_investimentos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.metas_investimentos WHERE usuario_id = $1'
      USING v_usuario_id;
  END IF;

  -- Amortizacoes de parcelamentos
  DELETE FROM public.amortizacoes WHERE usuario_id = v_usuario_id;

  -- Movimentacoes de beneficios e investimentos
  DELETE FROM public.beneficios_movimentacoes WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos_movimentacoes WHERE usuario_id = v_usuario_id;

  -- Faturas e excecoes (dependem de cartoes/despesas)
  DELETE FROM public.faturas_cartao WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas_tipo_excecoes WHERE usuario_id = v_usuario_id;

  -- Compras de cartao
  DELETE FROM public.compras_cartao WHERE usuario_id = v_usuario_id;

  -- Entidades principais
  DELETE FROM public.beneficios WHERE usuario_id = v_usuario_id;
  DELETE FROM public.parcelamentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.receitas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.metas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.cartoes WHERE usuario_id = v_usuario_id;

  -- Categorias personalizadas (usuario_id nao nulo)
  -- Categorias padrao (usuario_id IS NULL) sao preservadas
  DELETE FROM public.categorias WHERE usuario_id = v_usuario_id;

  -- 3. Reseta campos financeiros no perfil
  -- Mantem: nome, email, cor_tema, papel, ativo, datas de auditoria
  -- NOTA: atualizado_em pode ser gerenciado por trigger automatico
  UPDATE public.perfis
  SET
    saldo_base = NULL,
    saldo_base_data = NULL,
    reserva_atual = 0,
    meta_reserva = 0,
    reserva_percentual = 20,
    reserva_configurada = FALSE,
    modo_limite = 'auto',
    limite_diario = NULL,
    onboarding_concluido = FALSE
  WHERE id = v_usuario_id;

  -- 4. Valida que o perfil foi atualizado
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Perfil nao encontrado para o usuario autenticado.'
      USING HINT = 'Verifique se o perfil existe na tabela public.perfis.';
  END IF;

  -- 5. Sucesso: retorna TRUE
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao zerar dados financeiros: % (SQLSTATE: %)', 
      SQLERRM, SQLSTATE
      USING HINT = 'A operacao foi revertida completamente. Nenhum dado foi excluido.';
END;
$$;


-- ------------------------------------------------------------
-- Comentario da funcao (documentacao no Supabase Dashboard)
-- ------------------------------------------------------------
COMMENT ON FUNCTION public.zerar_dados_financeiros() IS 
'Exclui TODOS os dados financeiros do usuario autenticado de forma transacional (atomica).

SEGURANCA:
- SECURITY INVOKER: roda com os privilegios do usuario autenticado (RLS aplicado automaticamente)
- Obrigatorio: auth.uid() IS NOT NULL (bloqueia chamadas nao autenticadas)
- Isolamento: apenas registros do usuario autenticado (usuario_id = auth.uid())
- Atomicidade: qualquer erro reverte TODA a operacao (rollback completo)
- search_path fixo: previne SQL injection via search_path

EXCLUSAO:
- 17 tabelas financeiras: importacoes, investimentos, cartoes, despesas, receitas, metas, etc.
- Ordem correta: filhos antes dos pais (respeita foreign keys)
- Categorias: apenas personalizadas (usuario_id nao nulo); padroes preservadas
- Condicional: metas_investimentos (so deleta se a tabela existir - funcionalidade opcional)

PRESERVACAO:
- Conta: nome, email, cor_tema, papel, ativo
- Sessao: token de autenticacao (auth.users)
- Preferencias: tema, notificacoes, feedbacks
- Campos perfis resetados: saldo, reserva, limite, onboarding

RETORNO:
- TRUE: exclusao bem-sucedida
- EXCEPTION: falha (rollback automatico, nenhum dado excluido)

EXEMPLO DE USO (JavaScript):
const { data, error } = await supabase.rpc(zerar_dados_financeiros)
if (error) throw error
console.log(Dados excluidos com sucesso:, data)

CORRECAO FINAL (2026-11):
- Verificacao com to_regclass() + EXECUTE para metas_investimentos
- Compativel com ambientes onde a migration 2026-10_metas_investimentos.sql nao foi aplicada
- Pre-validacao de 17 tabelas obrigatorias antes de criar a funcao
- Falha rapido se schema estiver incompleto
';


-- ------------------------------------------------------------
-- Permissoes: execucao restrita a usuarios autenticados
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM anon;
GRANT EXECUTE ON FUNCTION public.zerar_dados_financeiros() TO authenticated;


-- ============================================================
-- FIM DA MIGRACAO CORRETIVA FINAL
-- ============================================================
