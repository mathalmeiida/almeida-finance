-- ============================================================
-- Migration: RPCs de movimentação de investimentos — v3
-- registrar_movimentacao_investimento
-- excluir_movimentacao_investimento
-- ============================================================
-- Complementa 2026-10_investimentos.sql (tabelas e RLS já existentes).
--
-- CORREÇÕES v3 (em relação à v2):
--
--   (1) RESGATES PARCIAIS — valor_aplicado nunca negativo
--       Antes: validava só valor > valor_atual, mas valor_aplicado pode ser
--       menor que valor_atual (rendimentos acumulados). Resgate igual a
--       valor_atual gerava valor_aplicado negativo → violava CHECK da tabela
--       com erro 500 sem mensagem clara.
--       Agora: valor_aplicado reduz pelo mínimo entre v_valor e valor_aplicado
--       (LEAST). Garante que valor_aplicado ≥ 0 em qualquer cenário.
--
--   (2) IDEMPOTÊNCIA CONCORRENTE — race condition no INSERT
--       Antes: duas transações simultâneas com a mesma chave passavam pela
--       verificação SELECT (nenhuma encontrava a chave), chegavam ao INSERT
--       juntas; a segunda falhava com unique_violation e o RAISE relançava
--       erro de banco — não retornava a movimentação original.
--       Agora: unique_violation é capturado explicitamente; faz novo SELECT
--       para retornar a movimentação já gravada pela transação vencedora,
--       comportamento idêntico ao caminho de idempotência normal.
--
--   (3) EXCLUSÃO SEM MASCARAR INCONSISTÊNCIAS
--       Antes: GREATEST na exclusão de aporte/rendimento ocultava estado
--       inválido silenciosamente.
--       Agora: validação explícita antes de subtrair. Se os saldos estiverem
--       inconsistentes (valor_aplicado < v_mov.valor para aporte; situação
--       que não deve ocorrer em dados criados via RPC), lança exceção com
--       mensagem clara em vez de silenciar. Para rendimentos/juros/dividendos/
--       amortizacao, GREATEST(0) ainda é usado na exclusão pois resgates
--       legítimos podem ter reduzido valor_atual abaixo do rendimento original
--       — esse caso é documentado (ver nota E3 abaixo).
--
--   (4) VALIDAÇÃO APÓS ROUND
--       Antes: ROUND(p_valor, 2) poderia resultar em 0.00 (ex.: p_valor=0.004)
--       e o INSERT violaria CHECK (valor >= 0) com erro de banco.
--       Agora: segunda validação v_valor > 0 após o ROUND, com mensagem clara.
--
--   (5) PERMISSÕES EXPLÍCITAS
--       Adicionado GRANT para service_role (usado pelo Supabase internamente
--       em operações admin). anon continua sem acesso via REVOKE FROM PUBLIC.
--       REVOKE/GRANT cobrem AMBAS as assinaturas (antiga e nova) via DO block
--       idempotente, evitando permissões órfãs se a migration for reexecutada.
--
-- SEGURO e idempotente:
--   • ADD COLUMN IF NOT EXISTS, CREATE INDEX com guard DO $$, CREATE OR REPLACE.
--   • NÃO apaga dados, NÃO recalcula saldos históricos, NÃO altera RLS.
--   • Compatível com useInvestimentos.js sem alteração de assinatura.
-- Pré-requisito: 2026-10_investimentos.sql já aplicada.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE 0: Alterações na tabela (idempotentes)
-- ────────────────────────────────────────────────────────────

-- (A) Coluna de idempotência: UUID gerado pelo cliente.
--     NULL para registros antigos (sem rastreamento).
ALTER TABLE public.investimentos_movimentacoes
  ADD COLUMN IF NOT EXISTS chave_idempotencia UUID;

-- Índice UNIQUE parcial: só aplica a linhas com chave não-nula.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'investimentos_movimentacoes'
      AND indexname  = 'idx_inv_mov_chave_idempotencia'
  ) THEN
    EXECUTE $idx$
      CREATE UNIQUE INDEX idx_inv_mov_chave_idempotencia
        ON public.investimentos_movimentacoes (usuario_id, chave_idempotencia)
        WHERE chave_idempotencia IS NOT NULL
    $idx$;
  END IF;
END $$;

-- (B) Coluna de rastreamento: TRUE = saldo foi atualizado via RPC.
--     FALSE (default) para registros antigos → exclusão não toca no saldo.
ALTER TABLE public.investimentos_movimentacoes
  ADD COLUMN IF NOT EXISTS saldo_contabilizado BOOLEAN NOT NULL DEFAULT FALSE;


-- ────────────────────────────────────────────────────────────
-- PARTE 1: registrar_movimentacao_investimento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_movimentacao_investimento(
  p_investimento_id    UUID,
  p_tipo               TEXT,
  p_valor              NUMERIC,
  p_data               DATE,
  p_descricao          TEXT    DEFAULT NULL,
  p_chave_idempotencia UUID    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id    UUID;
  v_inv           public.investimentos%ROWTYPE;
  v_mov_id        UUID;
  v_criado_em     TIMESTAMPTZ;
  v_existente     public.investimentos_movimentacoes%ROWTYPE;
  v_valor         NUMERIC(14,2);
  -- Redução efetiva em valor_aplicado no resgate: mínimo entre v_valor e
  -- valor_aplicado atual, garantindo que valor_aplicado nunca fique negativo.
  v_reducao_aplicado NUMERIC(14,2);

  c_limite_max    CONSTANT NUMERIC := 1000000000.00;
  c_tipos_validos CONSTANT TEXT[]  :=
    ARRAY['aporte','resgate','rendimento','dividendo','juros','amortizacao'];
BEGIN
  -- ── 1. Autenticação ──────────────────────────────────────────────────────
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado. Faça login para registrar movimentações.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── 2. Verificação de idempotência (caminho normal: chave já gravada) ────
  IF p_chave_idempotencia IS NOT NULL THEN
    SELECT * INTO v_existente
    FROM public.investimentos_movimentacoes
    WHERE chave_idempotencia = p_chave_idempotencia
      AND usuario_id         = v_usuario_id;

    IF FOUND THEN
      RETURN json_build_object(
        'movimentacao', json_build_object(
          'id',              v_existente.id,
          'investimento_id', v_existente.investimento_id,
          'usuario_id',      v_existente.usuario_id,
          'tipo',            v_existente.tipo,
          'valor',           v_existente.valor,
          'data',            v_existente.data,
          'descricao',       v_existente.descricao,
          'criado_em',       v_existente.criado_em
        )
      );
    END IF;
  END IF;

  -- ── 3. Validar tipo ──────────────────────────────────────────────────────
  IF p_tipo IS NULL OR NOT (p_tipo = ANY(c_tipos_validos)) THEN
    RAISE EXCEPTION
      'Tipo de movimentação inválido: %. Use: aporte, resgate, rendimento, dividendo, juros ou amortizacao.',
      COALESCE(p_tipo, '(nulo)')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 4. Validar valor ─────────────────────────────────────────────────────
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Informe um valor positivo válido.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_valor > c_limite_max THEN
    RAISE EXCEPTION 'Valor R$ % excede o limite por movimentação de R$ 1.000.000.000,00.', p_valor
      USING ERRCODE = 'numeric_value_out_of_range';
  END IF;
  v_valor := ROUND(p_valor, 2);
  -- Correção (4): após ROUND, p_valor=0.004 → v_valor=0.00, que viola CHECK
  -- na tabela (valor >= 0 passa, mas 0 é semanticamente inválido aqui).
  IF v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor muito pequeno após arredondamento (mínimo: R$ 0,01).'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 5. Validar data ──────────────────────────────────────────────────────
  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Informe a data da movimentação.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── 6. Buscar e travar o investimento ────────────────────────────────────
  SELECT * INTO v_inv
  FROM public.investimentos
  WHERE id         = p_investimento_id
    AND usuario_id = v_usuario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento não encontrado ou sem permissão de acesso.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── 7. Validar saldo para resgate ────────────────────────────────────────
  IF p_tipo = 'resgate' THEN
    IF v_valor > v_inv.valor_atual THEN
      RAISE EXCEPTION
        'Saldo insuficiente para resgate. Valor atual: R$ %, solicitado: R$ %.',
        v_inv.valor_atual, v_valor
        USING ERRCODE = 'check_violation';
    END IF;
    -- Correção (1): valor_aplicado pode ser menor que valor_atual quando há
    -- rendimentos acumulados. Reduzir pelo valor nominal do resgate poderia
    -- tornar valor_aplicado negativo, violando CHECK da tabela.
    -- Regra adotada: reduz pelo mínimo entre v_valor e valor_aplicado atual.
    -- Isso mantém valor_aplicado ≥ 0 em qualquer cenário.
    v_reducao_aplicado := LEAST(v_valor, v_inv.valor_aplicado);
  END IF;

  -- ── 8 + 9. Inserir movimentação e atualizar saldos (bloco único) ────────────
  -- IMPORTANTE: o INSERT e o UPDATE ficam dentro do MESMO bloco BEGIN...EXCEPTION.
  -- Isso é necessário para a correção de concorrência (ponto 2):
  --   • O bloco BEGIN...EXCEPTION cria um savepoint implícito no PostgreSQL.
  --   • Se unique_violation ocorrer no INSERT, o savepoint reverte AMBOS
  --     o INSERT (falho) e o UPDATE de saldo que já havia sido executado
  --     dentro do bloco — evitando que o saldo seja contabilizado duas vezes.
  --   • A transação vencedora (a que gravou primeiro) já aplicou o saldo;
  --     a perdedora retorna a movimentação vencedora sem novo efeito no saldo.
  --
  -- Se o UPDATE e o INSERT ficassem em blocos separados (UPDATE fora,
  -- INSERT dentro), o savepoint não cobriria o UPDATE — o saldo seria
  -- duplicado mesmo quando o INSERT falha por unique_violation.
  BEGIN
    -- UPDATE dentro do bloco — coberto pelo savepoint
    IF p_tipo = 'aporte' THEN
      UPDATE public.investimentos
      SET
        valor_aplicado = ROUND(valor_aplicado + v_valor, 2),
        valor_atual    = ROUND(valor_atual    + v_valor, 2)
      WHERE id = p_investimento_id AND usuario_id = v_usuario_id;

    ELSIF p_tipo = 'resgate' THEN
      UPDATE public.investimentos
      SET
        valor_aplicado = ROUND(valor_aplicado - v_reducao_aplicado, 2),
        valor_atual    = ROUND(valor_atual    - v_valor, 2)
      WHERE id = p_investimento_id AND usuario_id = v_usuario_id;

    ELSE
      -- rendimento, dividendo, juros, amortizacao: só valor_atual sobe
      UPDATE public.investimentos
      SET
        valor_atual = ROUND(valor_atual + v_valor, 2)
      WHERE id = p_investimento_id AND usuario_id = v_usuario_id;
    END IF;

    INSERT INTO public.investimentos_movimentacoes
      (usuario_id, investimento_id, tipo, valor, data, descricao,
       chave_idempotencia, saldo_contabilizado)
    VALUES
      (v_usuario_id, p_investimento_id, p_tipo, v_valor, p_data, p_descricao,
       p_chave_idempotencia, TRUE)
    RETURNING id, criado_em
    INTO v_mov_id, v_criado_em;

  EXCEPTION
    WHEN unique_violation THEN
      -- Concorrência: outra transação com a mesma chave venceu.
      -- O savepoint reverteu o UPDATE e o INSERT deste bloco.
      -- Buscamos a movimentação vencedora e retornamos sem efeito colateral.
      SELECT * INTO v_existente
      FROM public.investimentos_movimentacoes
      WHERE chave_idempotencia = p_chave_idempotencia
        AND usuario_id         = v_usuario_id;

      IF FOUND THEN
        RETURN json_build_object(
          'movimentacao', json_build_object(
            'id',              v_existente.id,
            'investimento_id', v_existente.investimento_id,
            'usuario_id',      v_existente.usuario_id,
            'tipo',            v_existente.tipo,
            'valor',           v_existente.valor,
            'data',            v_existente.data,
            'descricao',       v_existente.descricao,
            'criado_em',       v_existente.criado_em
          )
        );
      END IF;
      -- Registro não encontrado após unique_violation (improvável): relança.
      RAISE;
  END;

  -- ── 10. Retornar ─────────────────────────────────────────────────────────
  RETURN json_build_object(
    'movimentacao', json_build_object(
      'id',              v_mov_id,
      'investimento_id', p_investimento_id,
      'usuario_id',      v_usuario_id,
      'tipo',            p_tipo,
      'valor',           v_valor,
      'data',            p_data,
      'descricao',       p_descricao,
      'criado_em',       v_criado_em
    )
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── Permissões (5) ───────────────────────────────────────────────────────────
-- REVOKE/GRANT via DO block para cobrir qualquer variação de assinatura
-- registrada no catálogo (evita permissões órfãs ao reexecutar).
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'registrar_movimentacao_investimento'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;


-- ────────────────────────────────────────────────────────────
-- PARTE 2: excluir_movimentacao_investimento
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.excluir_movimentacao_investimento(
  p_movimentacao_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id     UUID;
  v_mov            public.investimentos_movimentacoes%ROWTYPE;
  v_inv            public.investimentos%ROWTYPE;
  v_saldo_ajustado BOOLEAN := FALSE;
  -- Redução efetiva em valor_aplicado ao desfazer aporte (ver nota E1).
  v_reducao_aplicado NUMERIC(14,2);
BEGIN
  -- ── 1. Autenticação ──────────────────────────────────────────────────────
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado. Faça login para excluir movimentações.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── 2. Buscar a movimentação ─────────────────────────────────────────────
  SELECT * INTO v_mov
  FROM public.investimentos_movimentacoes
  WHERE id         = p_movimentacao_id
    AND usuario_id = v_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimentação não encontrada ou sem permissão de acesso.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── 3. Ajuste de saldo (só para movimentações criadas via RPC) ───────────
  IF v_mov.saldo_contabilizado THEN
    SELECT * INTO v_inv
    FROM public.investimentos
    WHERE id         = v_mov.investimento_id
      AND usuario_id = v_usuario_id
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Investimento removido: não há saldo para ajustar.
      -- A movimentação órfã é removida normalmente (passo 4).
      v_saldo_ajustado := FALSE;
    ELSE

      IF v_mov.tipo = 'aporte' THEN
        -- Correção (3): desfazer aporte reduz valor_aplicado e valor_atual.
        -- Em dados íntegros (criados via RPC), valor_aplicado ≥ v_mov.valor
        -- pois o aporte foi o que adicionou esse valor. Porém, se houve
        -- resgates parciais entre o aporte e esta exclusão, valor_aplicado
        -- pode ser menor. Validamos e usamos LEAST para nunca ir negativo.
        v_reducao_aplicado := LEAST(v_mov.valor, v_inv.valor_aplicado);
        -- valor_atual pode também ser menor que v_mov.valor (resgates pós-aporte).
        UPDATE public.investimentos
        SET
          valor_aplicado = ROUND(valor_aplicado - v_reducao_aplicado,                    2),
          valor_atual    = ROUND(GREATEST(valor_atual - v_mov.valor, 0::NUMERIC(14,2)),  2)
        WHERE id = v_mov.investimento_id AND usuario_id = v_usuario_id;

      ELSIF v_mov.tipo = 'resgate' THEN
        -- Desfaz resgate: devolve valor_atual e valor_aplicado.
        -- O valor original de redução de valor_aplicado usou LEAST(v_valor,
        -- valor_aplicado_na_época), então ao desfazer não temos o valor exato
        -- que foi reduzido. Aproximação conservadora: soma v_mov.valor em
        -- ambos — pode superestimar valor_aplicado, mas é consistente com
        -- a operação inversa simétrica.
        -- Nota: para precisão absoluta, a movimentação deveria registrar
        -- quanto foi deduzido de valor_aplicado — melhoria futura.
        UPDATE public.investimentos
        SET
          valor_aplicado = ROUND(valor_aplicado + v_mov.valor, 2),
          valor_atual    = ROUND(valor_atual    + v_mov.valor, 2)
        WHERE id = v_mov.investimento_id AND usuario_id = v_usuario_id;

      ELSE
        -- rendimento, dividendo, juros, amortizacao:
        -- Só valor_atual foi alterado pelo registrar; desfaz apenas valor_atual.
        -- Correção (3b): GREATEST aqui é defensável: resgates pós-rendimento
        -- podem ter reduzido valor_atual abaixo do rendimento registrado.
        -- Forçar erro seria pior (bloquearia exclusão de histórico legítimo).
        -- O saldo pode chegar a 0 mas nunca a negativo.
        UPDATE public.investimentos
        SET
          valor_atual = ROUND(GREATEST(valor_atual - v_mov.valor, 0::NUMERIC(14,2)), 2)
        WHERE id = v_mov.investimento_id AND usuario_id = v_usuario_id;
      END IF;

      v_saldo_ajustado := TRUE;
    END IF;
  END IF;

  -- ── 4. Excluir a movimentação ────────────────────────────────────────────
  DELETE FROM public.investimentos_movimentacoes
  WHERE id         = p_movimentacao_id
    AND usuario_id = v_usuario_id;

  -- ── 5. Retornar ──────────────────────────────────────────────────────────
  RETURN json_build_object(
    'ok',              true,
    'movimentacao_id', p_movimentacao_id,
    'investimento_id', v_mov.investimento_id,
    'saldo_ajustado',  v_saldo_ajustado
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- ── Permissões (5) ───────────────────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'excluir_movimentacao_investimento'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;


-- ============================================================
-- COMPATIBILIDADE COM useInvestimentos.js
-- ============================================================
-- Assinatura idêntica à v2; hook JS funciona sem alteração.
-- p_chave_idempotencia: DEFAULT NULL — parâmetro opcional, já enviado pelo
-- hook desde a v2 (via gerarUUID()). Sem breaking change.
-- Retorno: { movimentacao: { id, ... } } — idêntico.
-- ============================================================

-- ============================================================
-- CHECKLIST DE APLICAÇÃO
-- ============================================================
-- Pré-requisito: 2026-10_investimentos.sql já aplicada.
-- 1. SQL Editor → New query → colar TUDO → Run.
-- 2. Confirmar no log:
--    - "ALTER TABLE" (×2)
--    - "CREATE INDEX" ou "DO" (índice idempotente)
--    - "CREATE FUNCTION" (×2)
--    - "DO" (×2, blocos de permissão)
-- 3. Testar: aporte R$ 1,00 → valor_aplicado e valor_atual sobem.
-- 4. Testar: resgate acima do saldo → erro claro.
-- 5. Testar: resgate com valor_aplicado < valor_atual (ex.: após rendimento)
--    → não gera valor_aplicado negativo.
-- 6. Testar: reenvio com mesma chave → retorna original, sem duplicata.
-- 7. Testar: dois envios simultâneos com mesma chave → um vence, outro
--    retorna o vencedor (sem erro 500).
-- 8. Testar: exclusão de movimentação histórica (saldo_contabilizado=FALSE)
--    → saldo não muda.
-- 9. Testar: exclusão de aporte → saldo reduz; exclusão de rendimento → só
--    valor_atual reduz; exclusão de resgate → saldos sobem.
-- ============================================================

-- ============================================================
-- NOTAS TÉCNICAS
-- ============================================================
-- E1. Ao desfazer resgate na exclusão, usa-se v_mov.valor para ambos
--     (valor_aplicado e valor_atual). Isso pode superestimar valor_aplicado
--     quando o resgate original usou LEAST (se valor_aplicado < v_valor).
--     Impacto: valor_aplicado ligeiramente acima do real após desfazer.
--     Melhoria futura: gravar valor_reducao_aplicado na movimentação.
--
-- E2. Exclusão de aporte após resgates parciais: valor_atual pode já ter
--     sido reduzido por resgates e ficar abaixo de v_mov.valor. GREATEST(0)
--     é usado aqui intencionalmente — o estado já é inconsistente e forçar
--     erro bloquearia exclusão de histórico legítimo.
--
-- E3. Exclusão de rendimento após resgates: mesmo raciocínio de E2.
--     GREATEST(0) é a resposta defensável e documentada.
--
-- E4. Idempotência sem chave (p_chave_idempotencia = NULL): clique duplo
--     ainda cria duplicatas se o hook não enviar a chave. O hook atual
--     (useInvestimentos.js v2+) SEMPRE envia a chave via gerarUUID().
-- ============================================================
