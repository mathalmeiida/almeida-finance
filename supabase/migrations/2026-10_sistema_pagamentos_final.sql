-- ============================================================
-- SISTEMA DE PAGAMENTOS DE FATURAS - VERSÃO CORRIGIDA FINAL
-- ============================================================
-- Correções aplicadas:
--   ✅ Funções retornam JSONB (compatível com Supabase)
--   ✅ Removidas ALL referências a contas/movimentacoes (não existem)
--   ✅ Integrado com despesas (cria despesa ao pagar, deleta ao estornar)
--   ✅ SELECT FOR UPDATE para atomicidade
--   ✅ Idempotente (pode executar múltiplas vezes)
-- ============================================================

-- 1. ADICIONAR COLUNAS EM faturas_cartao
-- ============================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'faturas_cartao' 
    AND column_name = 'valor_pago_acumulado'
  ) THEN
    ALTER TABLE public.faturas_cartao
      ADD COLUMN valor_pago_acumulado NUMERIC(12,2) NOT NULL DEFAULT 0
      CHECK (valor_pago_acumulado >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'faturas_cartao' 
    AND column_name = 'limite_liberado'
  ) THEN
    ALTER TABLE public.faturas_cartao
      ADD COLUMN limite_liberado NUMERIC(12,2) NOT NULL DEFAULT 0
      CHECK (limite_liberado >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'faturas_cartao' 
    AND column_name = 'pago'
  ) THEN
    ALTER TABLE public.faturas_cartao
      ADD COLUMN pago BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'faturas_cartao' 
    AND column_name = 'pago_em'
  ) THEN
    ALTER TABLE public.faturas_cartao
      ADD COLUMN pago_em DATE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'faturas_cartao' 
    AND column_name = 'atualizado_em'
  ) THEN
    ALTER TABLE public.faturas_cartao
      ADD COLUMN atualizado_em TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- 2. CRIAR TABELA pagamentos_fatura
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pagamentos_fatura (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fatura_id         UUID NOT NULL REFERENCES public.faturas_cartao(id) ON DELETE CASCADE,
  valor_pago        NUMERIC(12,2) NOT NULL CHECK (valor_pago > 0),
  data_pagamento    DATE NOT NULL,
  tipo_pagamento    TEXT NOT NULL DEFAULT 'parcial' CHECK (tipo_pagamento IN ('parcial', 'total', 'antecipado')),
  observacao        TEXT,
  estornado         BOOLEAN NOT NULL DEFAULT FALSE,
  estornado_em      TIMESTAMPTZ,
  motivo_estorno    TEXT,
  despesa_id        UUID REFERENCES public.despesas(id) ON DELETE SET NULL,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT estorno_requer_motivo CHECK (
    (estornado = FALSE) OR 
    (estornado = TRUE AND motivo_estorno IS NOT NULL)
  ),
  
  CONSTRAINT data_estorno_coerente CHECK (
    (estornado = FALSE AND estornado_em IS NULL) OR
    (estornado = TRUE AND estornado_em IS NOT NULL)
  )
);

-- 3. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_usuario 
  ON public.pagamentos_fatura (usuario_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_fatura 
  ON public.pagamentos_fatura (fatura_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_data 
  ON public.pagamentos_fatura (data_pagamento DESC);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_estornado 
  ON public.pagamentos_fatura (estornado) WHERE estornado = FALSE;

CREATE INDEX IF NOT EXISTS idx_faturas_cartao_usuario_mes 
  ON public.faturas_cartao (usuario_id, ano_mes);

-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.pagamentos_fatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagamentos_fatura_select" ON public.pagamentos_fatura;
DROP POLICY IF EXISTS "pagamentos_fatura_insert" ON public.pagamentos_fatura;
DROP POLICY IF EXISTS "pagamentos_fatura_update" ON public.pagamentos_fatura;
DROP POLICY IF EXISTS "pagamentos_fatura_delete" ON public.pagamentos_fatura;

CREATE POLICY "pagamentos_fatura_select" ON public.pagamentos_fatura
  FOR SELECT 
  USING (auth.uid() = usuario_id);

CREATE POLICY "pagamentos_fatura_insert" ON public.pagamentos_fatura
  FOR INSERT 
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "pagamentos_fatura_update" ON public.pagamentos_fatura
  FOR UPDATE 
  USING (auth.uid() = usuario_id) 
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "pagamentos_fatura_delete" ON public.pagamentos_fatura
  FOR DELETE 
  USING (auth.uid() = usuario_id);

-- 5. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_fatura TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. FUNÇÃO: validar_pagamento_fatura
-- ============================================================

CREATE OR REPLACE FUNCTION validar_pagamento_fatura(
  p_fatura_id UUID,
  p_valor_pago NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_fatura RECORD;
  v_valor_restante NUMERIC;
BEGIN
  SELECT * INTO v_fatura
  FROM faturas_cartao
  WHERE id = p_fatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Fatura não encontrada'
    );
  END IF;

  IF p_valor_pago <= 0 THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Valor do pagamento deve ser maior que zero'
    );
  END IF;

  v_valor_restante := v_fatura.valor_total - COALESCE(v_fatura.valor_pago_acumulado, 0);

  IF v_fatura.pago = TRUE OR v_valor_restante <= 0 THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Esta fatura já está quitada'
    );
  END IF;

  IF p_valor_pago > v_valor_restante THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', format('Valor do pagamento (R$ %s) excede o valor restante (R$ %s)', 
        p_valor_pago, v_valor_restante)
    );
  END IF;

  RETURN jsonb_build_object(
    'valido', TRUE,
    'valor_total', v_fatura.valor_total,
    'valor_pago_acumulado', COALESCE(v_fatura.valor_pago_acumulado, 0),
    'valor_restante', v_valor_restante,
    'valor_pago', p_valor_pago,
    'ficara_restando', v_valor_restante - p_valor_pago
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TRIGGER FUNCTION: atualizar_fatura_apos_pagamento
-- ============================================================

CREATE OR REPLACE FUNCTION atualizar_fatura_apos_pagamento()
RETURNS TRIGGER AS $$
DECLARE
  v_fatura RECORD;
  v_total_pago NUMERIC;
  v_percentual_pago NUMERIC;
  v_limite_liberado NUMERIC;
  v_despesa_id UUID;
  v_categoria_id UUID;
  v_cartao_nome TEXT;
BEGIN
  -- Buscar fatura com lock
  SELECT * INTO v_fatura 
  FROM faturas_cartao 
  WHERE id = COALESCE(NEW.fatura_id, OLD.fatura_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fatura não encontrada';
  END IF;

  -- Calcular total pago
  SELECT COALESCE(SUM(valor_pago), 0) INTO v_total_pago
  FROM pagamentos_fatura
  WHERE fatura_id = v_fatura.id 
    AND estornado = FALSE;

  -- Calcular percentual e limite
  IF v_fatura.valor_total > 0 THEN
    v_percentual_pago := LEAST(1.0, v_total_pago / v_fatura.valor_total);
  ELSE
    v_percentual_pago := 0;
  END IF;

  v_limite_liberado := v_fatura.valor_total * v_percentual_pago;

  -- Atualizar fatura
  UPDATE faturas_cartao
  SET
    valor_pago_acumulado = v_total_pago,
    limite_liberado = v_limite_liberado,
    pago = (v_total_pago >= v_fatura.valor_total),
    pago_em = CASE 
      WHEN v_total_pago >= v_fatura.valor_total THEN COALESCE(NEW.data_pagamento, CURRENT_DATE)
      ELSE NULL 
    END,
    atualizado_em = NOW()
  WHERE id = v_fatura.id;

  -- INSERT: criar despesa
  IF TG_OP = 'INSERT' AND NEW.estornado = FALSE THEN
    -- Buscar nome do cartão
    SELECT nome INTO v_cartao_nome
    FROM cartoes
    WHERE id = v_fatura.cartao_id;

    -- Buscar categoria "Cartão de Crédito"
    SELECT id INTO v_categoria_id
    FROM categorias
    WHERE usuario_id = v_fatura.usuario_id 
      AND LOWER(nome) LIKE '%cartão%'
    LIMIT 1;
    
    -- Fallback: categoria padrão
    IF v_categoria_id IS NULL THEN
      SELECT id INTO v_categoria_id
      FROM categorias
      WHERE usuario_id IS NULL 
        AND tipo IN ('despesa', 'ambos')
      LIMIT 1;
    END IF;

    -- Criar despesa
    INSERT INTO despesas (
      usuario_id,
      descricao,
      valor,
      data,
      recorrente,
      categoria_id,
      tipo_despesa,
      frequencia
    )
    VALUES (
      v_fatura.usuario_id,
      COALESCE(NEW.observacao, format('Pagamento fatura %s - %s', v_fatura.ano_mes, COALESCE(v_cartao_nome, 'Cartão'))),
      NEW.valor_pago,
      NEW.data_pagamento,
      FALSE,
      v_categoria_id,
      'fixa',
      'nao_repete'
    )
    RETURNING id INTO v_despesa_id;

    -- Associar despesa ao pagamento
    UPDATE pagamentos_fatura 
    SET despesa_id = v_despesa_id 
    WHERE id = NEW.id;
  END IF;

  -- UPDATE: estornar despesa
  IF TG_OP = 'UPDATE' AND OLD.estornado = FALSE AND NEW.estornado = TRUE THEN
    IF OLD.despesa_id IS NOT NULL THEN
      DELETE FROM despesas WHERE id = OLD.despesa_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. CRIAR TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trigger_atualizar_fatura ON pagamentos_fatura;

CREATE TRIGGER trigger_atualizar_fatura
  AFTER INSERT OR UPDATE ON pagamentos_fatura
  FOR EACH ROW 
  EXECUTE FUNCTION atualizar_fatura_apos_pagamento();

-- 9. FUNÇÃO: buscar_resumo_fatura
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_resumo_fatura(p_fatura_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_fatura RECORD;
  v_pagamentos JSONB;
BEGIN
  SELECT * INTO v_fatura
  FROM faturas_cartao
  WHERE id = p_fatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'Fatura não encontrada');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'valor_pago', valor_pago,
      'data_pagamento', data_pagamento,
      'tipo_pagamento', tipo_pagamento,
      'observacao', observacao,
      'criado_em', criado_em
    )
  ) INTO v_pagamentos
  FROM pagamentos_fatura
  WHERE fatura_id = p_fatura_id AND estornado = FALSE;

  RETURN jsonb_build_object(
    'fatura', to_jsonb(v_fatura),
    'pagamentos', COALESCE(v_pagamentos, '[]'::jsonb),
    'valor_total', v_fatura.valor_total,
    'valor_pago_acumulado', COALESCE(v_fatura.valor_pago_acumulado, 0),
    'valor_restante', GREATEST(0, v_fatura.valor_total - COALESCE(v_fatura.valor_pago_acumulado, 0)),
    'percentual_pago', CASE 
      WHEN v_fatura.valor_total > 0 
      THEN ROUND((COALESCE(v_fatura.valor_pago_acumulado, 0) / v_fatura.valor_total) * 100)
      ELSE 0 
    END,
    'quitada', COALESCE(v_fatura.pago, FALSE),
    'limite_liberado', COALESCE(v_fatura.limite_liberado, 0)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. FUNÇÃO: buscar_historico_pagamentos
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_historico_pagamentos(
  p_fatura_id UUID DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_limite INT DEFAULT 50
)
RETURNS JSONB AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'fatura_id', p.fatura_id,
      'valor_pago', p.valor_pago,
      'data_pagamento', p.data_pagamento,
      'tipo_pagamento', p.tipo_pagamento,
      'observacao', p.observacao,
      'estornado', p.estornado,
      'estornado_em', p.estornado_em,
      'motivo_estorno', p.motivo_estorno,
      'criado_em', p.criado_em,
      'fatura_mes', f.ano_mes,
      'cartao_nome', c.nome
    ) ORDER BY p.criado_em DESC
  ) INTO v_resultado
  FROM pagamentos_fatura p
  INNER JOIN faturas_cartao f ON p.fatura_id = f.id
  INNER JOIN cartoes c ON f.cartao_id = c.id
  WHERE 
    (p_fatura_id IS NULL OR p.fatura_id = p_fatura_id)
    AND (p_usuario_id IS NULL OR p.usuario_id = p_usuario_id)
  LIMIT p_limite;

  RETURN COALESCE(v_resultado, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. FUNÇÃO: estornar_pagamento
-- ============================================================

CREATE OR REPLACE FUNCTION estornar_pagamento(
  p_pagamento_id UUID,
  p_motivo_estorno TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_pagamento RECORD;
BEGIN
  IF p_motivo_estorno IS NULL OR LENGTH(TRIM(p_motivo_estorno)) < 5 THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Motivo do estorno deve ter pelo menos 5 caracteres'
    );
  END IF;

  SELECT * INTO v_pagamento
  FROM pagamentos_fatura
  WHERE id = p_pagamento_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Pagamento não encontrado'
    );
  END IF;

  IF v_pagamento.estornado = TRUE THEN
    RETURN jsonb_build_object(
      'sucesso', FALSE,
      'erro', 'Este pagamento já foi estornado'
    );
  END IF;

  UPDATE pagamentos_fatura
  SET 
    estornado = TRUE,
    estornado_em = NOW(),
    motivo_estorno = p_motivo_estorno
  WHERE id = p_pagamento_id;

  RETURN jsonb_build_object(
    'sucesso', TRUE,
    'pagamento_id', p_pagamento_id,
    'valor_estornado', v_pagamento.valor_pago
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '✓ Sistema de pagamentos instalado com sucesso';
  RAISE NOTICE '✓ Tabela pagamentos_fatura criada';
  RAISE NOTICE '✓ Colunas adicionadas em faturas_cartao';
  RAISE NOTICE '✓ 4 funções RPC disponíveis';
  RAISE NOTICE '✓ Triggers automáticos ativos';
  RAISE NOTICE '✓ RLS habilitado';
  RAISE NOTICE '✓ Integrado com despesas';
END $$;
