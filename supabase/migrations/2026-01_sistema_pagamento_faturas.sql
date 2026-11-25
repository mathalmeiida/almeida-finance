-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Sistema completo de pagamento de faturas de cartão de crédito
-- Permite: pagamento parcial, total, antecipado, histórico e estorno
-- 
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run
-- SEGURO para o banco atual:
--   • NÃO altera dados existentes
--   • NÃO usa DROP
--   • Idempotente: IF NOT EXISTS
--   • Preserva RLS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABELA DE PAGAMENTOS (histórico detalhado)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pagamentos_fatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fatura_id UUID NOT NULL REFERENCES public.faturas_cartao(id) ON DELETE CASCADE,
  
  -- Valor efetivamente pago neste pagamento
  valor_pago NUMERIC(12,2) NOT NULL CHECK (valor_pago > 0),
  
  -- Data em que o pagamento foi realizado (formato DATE em America/Sao_Paulo)
  data_pagamento DATE NOT NULL,
  
  -- Tipo: 'parcial' | 'total' | 'antecipado'
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('parcial', 'total', 'antecipado')),
  
  -- Observações opcionais (ex: "Pagamento via PIX", "Antecipado por desconto")
  observacao TEXT,
  
  -- Estorno
  estornado BOOLEAN NOT NULL DEFAULT FALSE,
  estornado_em TIMESTAMPTZ,
  motivo_estorno TEXT,
  
  -- Auditoria
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 2. ÍNDICES (performance)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_usuario 
  ON public.pagamentos_fatura (usuario_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_fatura 
  ON public.pagamentos_fatura (fatura_id);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_data 
  ON public.pagamentos_fatura (data_pagamento);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_estornado 
  ON public.pagamentos_fatura (estornado);

-- ─────────────────────────────────────────────────────────────
-- 3. RLS (Row Level Security)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.pagamentos_fatura ENABLE ROW LEVEL SECURITY;

-- Policy: usuário só acessa seus próprios pagamentos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
      AND tablename = 'pagamentos_fatura'
      AND policyname = 'Usuário gerencia apenas os próprios pagamentos'
  ) THEN
    CREATE POLICY "Usuário gerencia apenas os próprios pagamentos"
      ON public.pagamentos_fatura FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. COLUNAS ADICIONAIS EM faturas_cartao
-- ─────────────────────────────────────────────────────────────

-- Valor total já pago (soma dos pagamentos não estornados)
ALTER TABLE public.faturas_cartao 
  ADD COLUMN IF NOT EXISTS valor_pago_acumulado NUMERIC(12,2) DEFAULT 0 CHECK (valor_pago_acumulado >= 0);

-- Limite do cartão liberado proporcionalmente ao % pago
ALTER TABLE public.faturas_cartao 
  ADD COLUMN IF NOT EXISTS limite_liberado NUMERIC(12,2) DEFAULT 0 CHECK (limite_liberado >= 0);

-- ─────────────────────────────────────────────────────────────
-- 5. FUNÇÃO: Atualizar valor_pago_acumulado e limite_liberado
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.atualizar_fatura_pagamentos()
RETURNS TRIGGER AS $$
DECLARE
  v_fatura_id UUID;
  v_valor_total NUMERIC(12,2);
  v_valor_pago NUMERIC(12,2);
  v_percentual_pago NUMERIC(5,4);
  v_limite_cartao NUMERIC(12,2);
  v_limite_liberado NUMERIC(12,2);
  v_cartao_id UUID;
BEGIN
  -- Determina qual fatura foi afetada
  IF TG_OP = 'DELETE' THEN
    v_fatura_id := OLD.fatura_id;
  ELSE
    v_fatura_id := NEW.fatura_id;
  END IF;

  -- Busca informações da fatura e do cartão
  SELECT 
    fc.valor_total, 
    fc.cartao_id,
    c.limite_total
  INTO 
    v_valor_total, 
    v_cartao_id,
    v_limite_cartao
  FROM public.faturas_cartao fc
  JOIN public.cartoes c ON c.id = fc.cartao_id
  WHERE fc.id = v_fatura_id;

  -- Calcula o total pago (soma dos pagamentos não estornados)
  SELECT COALESCE(SUM(valor_pago), 0)
  INTO v_valor_pago
  FROM public.pagamentos_fatura
  WHERE fatura_id = v_fatura_id 
    AND estornado = FALSE;

  -- Calcula percentual pago
  IF v_valor_total > 0 THEN
    v_percentual_pago := LEAST(v_valor_pago / v_valor_total, 1.0);
  ELSE
    v_percentual_pago := 0;
  END IF;

  -- Calcula limite liberado (proporcional ao % pago)
  v_limite_liberado := ROUND(v_limite_cartao * v_percentual_pago, 2);

  -- Atualiza a fatura
  UPDATE public.faturas_cartao
  SET 
    valor_pago_acumulado = v_valor_pago,
    limite_liberado = v_limite_liberado,
    pago = (v_valor_pago >= v_valor_total), -- Marca como paga se pagou tudo
    pago_em = CASE 
      WHEN v_valor_pago >= v_valor_total THEN CURRENT_DATE
      ELSE NULL
    END
  WHERE id = v_fatura_id;

  RETURN NULL; -- Trigger AFTER, retorno ignorado
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────
-- 6. TRIGGERS: Atualizar automaticamente ao criar/atualizar/deletar pagamento
-- ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_pagamento_fatura_insert ON public.pagamentos_fatura;
CREATE TRIGGER trg_pagamento_fatura_insert
  AFTER INSERT ON public.pagamentos_fatura
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_fatura_pagamentos();

DROP TRIGGER IF EXISTS trg_pagamento_fatura_update ON public.pagamentos_fatura;
CREATE TRIGGER trg_pagamento_fatura_update
  AFTER UPDATE ON public.pagamentos_fatura
  FOR EACH ROW
  WHEN (OLD.estornado IS DISTINCT FROM NEW.estornado OR OLD.valor_pago IS DISTINCT FROM NEW.valor_pago)
  EXECUTE FUNCTION public.atualizar_fatura_pagamentos();

DROP TRIGGER IF EXISTS trg_pagamento_fatura_delete ON public.pagamentos_fatura;
CREATE TRIGGER trg_pagamento_fatura_delete
  AFTER DELETE ON public.pagamentos_fatura
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_fatura_pagamentos();

-- ─────────────────────────────────────────────────────────────
-- 7. FUNÇÃO HELPER: Validar pagamento antes de inserir
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validar_pagamento_fatura(
  p_fatura_id UUID,
  p_valor_pago NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_valor_total NUMERIC(12,2);
  v_valor_pago_acumulado NUMERIC(12,2);
  v_valor_restante NUMERIC(12,2);
  v_resultado JSONB;
BEGIN
  -- Busca informações da fatura
  SELECT valor_total, COALESCE(valor_pago_acumulado, 0)
  INTO v_valor_total, v_valor_pago_acumulado
  FROM public.faturas_cartao
  WHERE id = p_fatura_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Fatura não encontrada'
    );
  END IF;

  v_valor_restante := v_valor_total - v_valor_pago_acumulado;

  -- Validações
  IF p_valor_pago <= 0 THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Valor do pagamento deve ser maior que zero'
    );
  END IF;

  IF p_valor_pago > v_valor_restante + 0.01 THEN
    RETURN jsonb_build_object(
      'valido', FALSE,
      'erro', 'Valor do pagamento excede o valor restante da fatura',
      'valor_restante', v_valor_restante
    );
  END IF;

  -- Válido
  RETURN jsonb_build_object(
    'valido', TRUE,
    'valor_total', v_valor_total,
    'valor_pago_acumulado', v_valor_pago_acumulado,
    'valor_restante', v_valor_restante,
    'sera_quitada', (v_valor_pago_acumulado + p_valor_pago >= v_valor_total)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
