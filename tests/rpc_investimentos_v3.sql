-- ============================================================
-- TESTES ISOLADOS — registrar/excluir_movimentacao_investimento v3
-- ============================================================
-- Execução: Supabase SQL Editor em ambiente de DESENVOLVIMENTO/STAGING.
-- NÃO executar em produção — usa ROLLBACK no final, nada persiste.
--
-- PRÉ-REQUISITO OBRIGATÓRIO — autenticação:
-- O SQL Editor do Supabase executa como service_role, que bypassa RLS mas
-- não injeta um JWT de usuário, então auth.uid() retorna NULL.
-- Os testes abaixo inserem dados diretamente (sem RPC de autenticação)
-- e chamam as funções via SQL direto APÓS configurar a identidade.
--
-- OPÇÃO A — Mais simples (recomendada para staging):
--   Execute os testes via cliente JS autenticado (ex.: script Node com
--   supabase-js + signInWithPassword), que injeta o JWT automaticamente.
--
-- OPÇÃO B — SQL Editor com simulação de identidade:
--   Supabase suporta SET LOCAL request.jwt.claim.sub = '<uuid>';
--   Porém auth.uid() lê de auth.jwt() → set_config é necessário:
--     SELECT set_config('request.jwt.claims',
--       '{"sub":"<UUID_DO_USUARIO_TESTE>","role":"authenticated"}', true);
--   Adicione esse SET antes dos testes e substitua <UUID_DO_USUARIO_TESTE>.
--
-- Este arquivo usa OPÇÃO B. Substitua USUARIO_TESTE_UUID abaixo.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- CONFIGURAÇÃO: substitua pelo UUID de um usuário de TESTE real
-- (criado em Auth → Users no projeto de staging/dev — nunca produção).
-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Sinaliza início dos testes
  RAISE NOTICE '=== INÍCIO DOS TESTES RPC INVESTIMENTOS v3 ===';
  RAISE NOTICE 'ATENÇÃO: substitua USUARIO_TESTE_UUID por um UUID real antes de executar.';
END $$;

-- Simula JWT de usuário autenticado para auth.uid() dentro das RPCs.
-- Esta configuração vale para toda a transação atual.
-- SUBSTITUA o UUID abaixo antes de executar:
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true  -- aplica apenas à transação atual (local=true)
);

-- Atalho: UUID do usuário de teste (usado em todos os INSERTs diretos).
-- Deve ser idêntico ao "sub" acima.
DO $$
BEGIN
  PERFORM set_config('app.test_user_id',
    '00000000-0000-0000-0000-000000000001', true);
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 1: Aporte simples
-- Cenário: valor_aplicado=1000, valor_atual=1000 → aporte R$ 500
-- Esperado: valor_aplicado=1500, valor_atual=1500
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid      UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id   UUID;
  v_res      JSON;
  v_aplicado NUMERIC;
  v_atual    NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T1_APORTE', 'cdb', 1000.00, 1000.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'aporte', 500.00, CURRENT_DATE, 'T1', gen_random_uuid()
  ) INTO v_res;

  SELECT valor_aplicado, valor_atual INTO v_aplicado, v_atual
  FROM public.investimentos WHERE id = v_inv_id;

  IF v_aplicado <> 1500.00 THEN
    RAISE EXCEPTION 'FALHA T1: valor_aplicado esperado 1500.00, obtido %', v_aplicado;
  END IF;
  IF v_atual <> 1500.00 THEN
    RAISE EXCEPTION 'FALHA T1: valor_atual esperado 1500.00, obtido %', v_atual;
  END IF;
  RAISE NOTICE 'PASSOU T1: Aporte simples — aplicado=% atual=%', v_aplicado, v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 2: Resgate quando valor_aplicado < valor_atual
-- Cenário: aplicado=1000, atual=1200 (rendimento acumulado)
--          resgate de R$ 1200 (= valor_atual inteiro)
-- Bug v2: valor_aplicado ficaria -200 → violava CHECK da tabela
-- Esperado v3: valor_aplicado=0 (LEAST), valor_atual=0
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid      UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id   UUID;
  v_res      JSON;
  v_aplicado NUMERIC;
  v_atual    NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T2_RESGATE_PARCIAL', 'cdb', 1000.00, 1200.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'resgate', 1200.00, CURRENT_DATE, 'T2', gen_random_uuid()
  ) INTO v_res;

  SELECT valor_aplicado, valor_atual INTO v_aplicado, v_atual
  FROM public.investimentos WHERE id = v_inv_id;

  IF v_aplicado < 0 THEN
    RAISE EXCEPTION 'FALHA T2: valor_aplicado negativo: %', v_aplicado;
  END IF;
  IF v_atual <> 0.00 THEN
    RAISE EXCEPTION 'FALHA T2: valor_atual esperado 0.00, obtido %', v_atual;
  END IF;
  RAISE NOTICE 'PASSOU T2: Resgate com rendimento acumulado — aplicado=% atual=%', v_aplicado, v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 3: Resgate acima do saldo → exceção clara
-- Cenário: valor_atual=500, resgate R$ 600
-- Esperado: RAISE EXCEPTION com "Saldo insuficiente"
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid    UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id UUID;
  v_res    JSON;
  v_ok     BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T3_RESGATE_EXCESSO', 'cdb', 500.00, 500.00)
  RETURNING id INTO v_inv_id;

  BEGIN
    SELECT public.registrar_movimentacao_investimento(
      v_inv_id, 'resgate', 600.00, CURRENT_DATE, NULL, gen_random_uuid()
    ) INTO v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%Saldo insuficiente%' THEN
      v_ok := TRUE;
    ELSE
      RAISE EXCEPTION 'FALHA T3: exceção inesperada: %', SQLERRM;
    END IF;
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'FALHA T3: deveria ter lançado exceção de saldo insuficiente';
  END IF;

  -- Confirma que o saldo não foi alterado após a exceção
  DECLARE v_atual NUMERIC;
  BEGIN
    SELECT valor_atual INTO v_atual FROM public.investimentos WHERE id = v_inv_id;
    IF v_atual <> 500.00 THEN
      RAISE EXCEPTION 'FALHA T3: saldo foi alterado mesmo com exceção — obtido %', v_atual;
    END IF;
  END;

  RAISE NOTICE 'PASSOU T3: Resgate acima do saldo rejeitado; saldo intacto';
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 4: Idempotência — reenvio sequencial com a mesma chave
-- Cenário: mesma chave_idempotencia enviada duas vezes
-- Esperado: segunda chamada retorna a movimentação original;
--           saldo contabilizado uma única vez (=100, não 200)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid    UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id UUID;
  v_chave  UUID := gen_random_uuid();
  v_res1   JSON;
  v_res2   JSON;
  v_id1    UUID;
  v_id2    UUID;
  v_atual  NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T4_IDEMPOTENCIA', 'tesouro', 0.00, 0.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'aporte', 100.00, CURRENT_DATE, NULL, v_chave
  ) INTO v_res1;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'aporte', 100.00, CURRENT_DATE, NULL, v_chave
  ) INTO v_res2;

  v_id1 := (v_res1->'movimentacao'->>'id')::UUID;
  v_id2 := (v_res2->'movimentacao'->>'id')::UUID;

  IF v_id1 <> v_id2 THEN
    RAISE EXCEPTION 'FALHA T4: IDs diferentes — duplicata criada (id1=%, id2=%)', v_id1, v_id2;
  END IF;

  SELECT valor_atual INTO v_atual FROM public.investimentos WHERE id = v_inv_id;
  IF v_atual <> 100.00 THEN
    RAISE EXCEPTION 'FALHA T4: saldo duplicado — esperado 100.00, obtido %', v_atual;
  END IF;
  RAISE NOTICE 'PASSOU T4: Idempotência sequencial — IDs iguais, saldo=% (não duplicou)', v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 5: Valor sub-centavo → erro após ROUND
-- Cenário: p_valor=0.004 → ROUND(0.004,2)=0.00
-- Esperado: exceção "mínimo R$ 0,01"
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid    UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id UUID;
  v_res    JSON;
  v_ok     BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T5_SUBCENT', 'cdb', 100.00, 100.00)
  RETURNING id INTO v_inv_id;

  BEGIN
    SELECT public.registrar_movimentacao_investimento(
      v_inv_id, 'aporte', 0.004::NUMERIC, CURRENT_DATE, NULL, gen_random_uuid()
    ) INTO v_res;
  EXCEPTION WHEN OTHERS THEN
    -- Aceita qualquer mensagem que indique rejeição de valor inválido
    IF SQLERRM ILIKE '%mínimo%'
    OR SQLERRM ILIKE '%pequeno%'
    OR SQLERRM ILIKE '%positivo%'
    OR SQLERRM ILIKE '%arredondamento%' THEN
      v_ok := TRUE;
    ELSE
      RAISE EXCEPTION 'FALHA T5: exceção inesperada: %', SQLERRM;
    END IF;
  END;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'FALHA T5: valor 0.004 deveria ser rejeitado após ROUND';
  END IF;
  RAISE NOTICE 'PASSOU T5: Valor sub-centavo rejeitado corretamente';
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 6: Rendimento — só valor_atual sobe, valor_aplicado inalterado
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid      UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id   UUID;
  v_res      JSON;
  v_aplicado NUMERIC;
  v_atual    NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T6_RENDIMENTO', 'cdb', 1000.00, 1000.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'rendimento', 50.00, CURRENT_DATE, NULL, gen_random_uuid()
  ) INTO v_res;

  SELECT valor_aplicado, valor_atual INTO v_aplicado, v_atual
  FROM public.investimentos WHERE id = v_inv_id;

  IF v_aplicado <> 1000.00 THEN
    RAISE EXCEPTION 'FALHA T6: valor_aplicado não deve mudar com rendimento — obtido %', v_aplicado;
  END IF;
  IF v_atual <> 1050.00 THEN
    RAISE EXCEPTION 'FALHA T6: valor_atual esperado 1050.00, obtido %', v_atual;
  END IF;
  RAISE NOTICE 'PASSOU T6: Rendimento — aplicado=% (inalterado), atual=%', v_aplicado, v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 7: Exclusão de aporte contabilizado
-- Cenário: investimento com 500; aporte de 300 via RPC; excluir aporte
-- Esperado: valor_atual volta a 500 (300 é desfeito)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid      UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id   UUID;
  v_mov_id   UUID;
  v_res      JSON;
  v_excl     JSON;
  v_aplicado NUMERIC;
  v_atual    NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T7_EXCL_APORTE', 'cdb', 500.00, 500.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'aporte', 300.00, CURRENT_DATE, NULL, gen_random_uuid()
  ) INTO v_res;

  v_mov_id := (v_res->'movimentacao'->>'id')::UUID;

  SELECT public.excluir_movimentacao_investimento(v_mov_id) INTO v_excl;

  SELECT valor_aplicado, valor_atual INTO v_aplicado, v_atual
  FROM public.investimentos WHERE id = v_inv_id;

  IF v_atual <> 500.00 THEN
    RAISE EXCEPTION 'FALHA T7: valor_atual esperado 500.00 após excluir aporte 300, obtido %', v_atual;
  END IF;
  IF v_aplicado <> 500.00 THEN
    RAISE EXCEPTION 'FALHA T7: valor_aplicado esperado 500.00 após excluir aporte 300, obtido %', v_aplicado;
  END IF;
  IF NOT (v_excl->>'saldo_ajustado')::BOOLEAN THEN
    RAISE EXCEPTION 'FALHA T7: saldo_ajustado deveria ser TRUE';
  END IF;
  RAISE NOTICE 'PASSOU T7: Exclusão de aporte contabilizado — aplicado=%, atual=%, saldo_ajustado=TRUE', v_aplicado, v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 8: Exclusão de movimentação histórica (saldo_contabilizado=FALSE)
-- Cenário: insert direto na tabela (sem RPC); exclusão via RPC
-- Esperado: saldo intacto, saldo_ajustado=FALSE
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid    UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id UUID;
  v_mov_id UUID;
  v_excl   JSON;
  v_atual  NUMERIC;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T8_HIST', 'cdb', 1000.00, 1000.00)
  RETURNING id INTO v_inv_id;

  -- Inserção histórica direta: saldo_contabilizado = FALSE (DEFAULT)
  INSERT INTO public.investimentos_movimentacoes
    (usuario_id, investimento_id, tipo, valor, data)
  VALUES (v_uid, v_inv_id, 'aporte', 500.00, CURRENT_DATE)
  RETURNING id INTO v_mov_id;

  SELECT public.excluir_movimentacao_investimento(v_mov_id) INTO v_excl;

  SELECT valor_atual INTO v_atual FROM public.investimentos WHERE id = v_inv_id;

  IF v_atual <> 1000.00 THEN
    RAISE EXCEPTION 'FALHA T8: saldo alterado indevidamente — esperado 1000.00, obtido %', v_atual;
  END IF;
  IF (v_excl->>'saldo_ajustado')::BOOLEAN THEN
    RAISE EXCEPTION 'FALHA T8: saldo_ajustado deveria ser FALSE para histórico';
  END IF;
  RAISE NOTICE 'PASSOU T8: Exclusão histórica — saldo intacto=%, saldo_ajustado=FALSE', v_atual;
END $$;

-- ────────────────────────────────────────────────────────────
-- TESTE 9 (extra): Retorno JSON tem campo movimentacao com id válido
-- Verifica que o retorno da RPC é o esperado pelo hook JS
-- (hook acessa resultado.movimentacao)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_uid    UUID := current_setting('app.test_user_id')::UUID;
  v_inv_id UUID;
  v_res    JSON;
  v_mov_id TEXT;
BEGIN
  INSERT INTO public.investimentos
    (usuario_id, nome, categoria, valor_aplicado, valor_atual)
  VALUES (v_uid, '_TESTE_T9_RETORNO', 'cdb', 0.00, 0.00)
  RETURNING id INTO v_inv_id;

  SELECT public.registrar_movimentacao_investimento(
    v_inv_id, 'aporte', 1.00, CURRENT_DATE, NULL, gen_random_uuid()
  ) INTO v_res;

  -- Verifica estrutura esperada pelo hook: resultado.movimentacao.id
  v_mov_id := v_res->'movimentacao'->>'id';
  IF v_mov_id IS NULL OR length(v_mov_id) < 36 THEN
    RAISE EXCEPTION 'FALHA T9: campo movimentacao.id ausente ou inválido no JSON retornado: %', v_res;
  END IF;
  -- Verifica campos obrigatórios usados pelo hook
  IF (v_res->'movimentacao'->>'investimento_id') IS NULL THEN
    RAISE EXCEPTION 'FALHA T9: campo movimentacao.investimento_id ausente';
  END IF;
  IF (v_res->'movimentacao'->>'tipo') IS NULL THEN
    RAISE EXCEPTION 'FALHA T9: campo movimentacao.tipo ausente';
  END IF;
  RAISE NOTICE 'PASSOU T9: JSON de retorno compatível com useInvestimentos.js — id=%', v_mov_id;
END $$;

-- ════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '=== TODOS OS TESTES EXECUTADOS — ROLLBACK A SEGUIR ===';
  RAISE NOTICE 'Nenhum dado foi persistido.';
END $$;

-- Desfaz TODA a transação: investimentos, movimentações e configurações
-- de sessão criados pelos testes não ficam gravados no banco.
ROLLBACK;
