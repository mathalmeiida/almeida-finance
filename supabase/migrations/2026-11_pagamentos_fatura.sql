-- MIGRAÇÃO — Almeida Finance
-- Pagamentos de fatura de cartão (total, parcial e antecipado) com histórico e estorno.
--
-- Execute no DEV primeiro (SQL Editor > New query > cole TUDO > Run).
-- PRODUÇÃO somente depois da aprovação dos testes no DEV.
--
-- SEGURO:
--   • Idempotente (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING).
--   • Sem DROP destrutivo. Não altera faturas_cartao (colunas pago/pago_em seguem
--     existindo por compatibilidade; deixam de ser a fonte da verdade).
--   • RLS: o usuário só LÊ os próprios pagamentos. Não há INSERT/UPDATE/DELETE
--     direto para authenticated: toda escrita passa pelas RPCs abaixo.
--
-- Modelo:
--   • A fatura é PROJETADA no app (compras_cartao + parcelamentos); portanto o
--     pagamento referencia (cartao_id, ano_mes) = competência (mês de fechamento).
--   • O pagamento NÃO é despesa: a compra já foi contada como gasto. O saldo da
--     conta é DERIVADO (ver src/lib/saldoDisponivel.js): saldo informado + receitas
--     - despesas - pagamentos ativos com origem = 'saldo_principal'. Assim o débito
--       e o estorno são atômicos (uma única linha) e nada é contado duas vezes.
--   • Estorno = status 'estornado' (a linha é mantida para o histórico).
--   • Duplicidade: UNIQUE (usuario_id, idempotency_key) e trava por cartão
--     (SELECT ... FOR UPDATE) dentro da RPC.
--   • Limite do valor: soma dos pagamentos ativos + novo valor <= total do ciclo
--     informado pelo app (p_total_ciclo). Como a fatura é projetada no cliente, o
--     servidor não consegue recalculá-la; ele garante consistência por ciclo.

CREATE TABLE IF NOT EXISTS public.pagamentos_fatura (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id        UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  ano_mes          TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento   DATE NOT NULL,
  origem           TEXT NOT NULL DEFAULT 'saldo_principal'
                   CHECK (origem IN ('saldo_principal', 'outra_conta')),
  conta_nome       TEXT CHECK (conta_nome IS NULL OR char_length(conta_nome) <= 80),
  total_ciclo_ref  NUMERIC(12,2),
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'estornado')),
  estornado_em     TIMESTAMPTZ,
  legado           BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key  TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_cartao_mes
  ON public.pagamentos_fatura (cartao_id, ano_mes);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_usuario
  ON public.pagamentos_fatura (usuario_id, data_pagamento);

ALTER TABLE public.pagamentos_fatura ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pagamentos_fatura'
      AND policyname='Usuário lê apenas os próprios pagamentos de fatura') THEN
    CREATE POLICY "Usuário lê apenas os próprios pagamentos de fatura"
      ON public.pagamentos_fatura FOR SELECT
      USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- Escrita somente via RPC (SECURITY DEFINER).
REVOKE ALL ON public.pagamentos_fatura FROM anon, authenticated;
GRANT SELECT ON public.pagamentos_fatura TO authenticated;

-- ------------------------------------------------------------
-- RPC: pagar_fatura_cartao
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pagar_fatura_cartao(
  p_cartao_id        UUID,
  p_ano_mes          TEXT,
  p_valor            NUMERIC,
  p_data_pagamento   DATE,
  p_origem           TEXT,
  p_conta_nome       TEXT,
  p_total_ciclo      NUMERIC,
  p_idempotency_key  TEXT
) RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_pago      NUMERIC(12,2);
  v_existente public.pagamentos_fatura;
  v_novo      public.pagamentos_fatura;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero' USING ERRCODE = '22023';
  END IF;
  IF p_total_ciclo IS NULL OR p_total_ciclo <= 0 OR p_total_ciclo > 999999999 THEN
    RAISE EXCEPTION 'Total da fatura inválido' USING ERRCODE = '22023';
  END IF;
  IF p_ano_mes IS NULL OR p_ano_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023';
  END IF;
  IF p_data_pagamento IS NULL OR p_data_pagamento > (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data do pagamento não pode ser futura' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_origem, 'saldo_principal') NOT IN ('saldo_principal', 'outra_conta') THEN
    RAISE EXCEPTION 'Conta de origem inválida' USING ERRCODE = '22023';
  END IF;

  -- Trava o cartão (e valida o dono): serializa pagamentos concorrentes.
  PERFORM 1 FROM public.cartoes
   WHERE id = p_cartao_id AND usuario_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão não encontrado' USING ERRCODE = '42501';
  END IF;

  -- Repetição da mesma operação (duplo clique, retry, outro dispositivo): devolve a original.
  SELECT * INTO v_existente FROM public.pagamentos_fatura
   WHERE usuario_id = v_uid AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.cartao_id = p_cartao_id AND v_existente.ano_mes = p_ano_mes
       AND v_existente.valor = round(p_valor, 2) THEN
      RETURN v_existente;
    END IF;
    RAISE EXCEPTION 'Chave de idempotência já usada em outro pagamento' USING ERRCODE = '23505';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM public.pagamentos_fatura
   WHERE usuario_id = v_uid AND cartao_id = p_cartao_id
     AND ano_mes = p_ano_mes AND status = 'ativo';

  IF v_pago + round(p_valor, 2) > round(p_total_ciclo, 2) THEN
    RAISE EXCEPTION 'Valor excede o saldo em aberto da fatura (em aberto: %)',
      to_char(GREATEST(round(p_total_ciclo, 2) - v_pago, 0), 'FM999999990.00')
      USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.pagamentos_fatura
    (usuario_id, cartao_id, ano_mes, valor, data_pagamento, origem, conta_nome,
     total_ciclo_ref, idempotency_key)
  VALUES
    (v_uid, p_cartao_id, p_ano_mes, round(p_valor, 2), p_data_pagamento,
     COALESCE(p_origem, 'saldo_principal'), NULLIF(btrim(p_conta_nome), ''),
     round(p_total_ciclo, 2), p_idempotency_key)
  RETURNING * INTO v_novo;

  RETURN v_novo;
END;
$$;

-- ------------------------------------------------------------
-- RPC: estornar_pagamento_fatura
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_pagamento_fatura(p_pagamento_id UUID)
RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pg  public.pagamentos_fatura;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_pg FROM public.pagamentos_fatura
   WHERE id = p_pagamento_id AND usuario_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_pg.status = 'estornado' THEN
    RAISE EXCEPTION 'Pagamento já estornado' USING ERRCODE = '23505';
  END IF;

  UPDATE public.pagamentos_fatura
     SET status = 'estornado', estornado_em = NOW()
   WHERE id = p_pagamento_id
  RETURNING * INTO v_pg;

  RETURN v_pg;
END;
$$;

REVOKE ALL ON FUNCTION public.pagar_fatura_cartao(UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.estornar_pagamento_fatura(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_fatura_cartao(UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_fatura(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Backfill: faturas marcadas como pagas (boolean) viram pagamento LEGADO.
-- Não debita saldo (origem 'outra_conta'): o app antigo nunca debitou.
-- Idempotente pela chave 'legado-<id da fatura>'.
-- ------------------------------------------------------------
INSERT INTO public.pagamentos_fatura
  (usuario_id, cartao_id, ano_mes, valor, data_pagamento, origem, conta_nome,
   total_ciclo_ref, legado, idempotency_key)
SELECT f.usuario_id, f.cartao_id, f.ano_mes, f.valor_total,
       COALESCE(f.pago_em, f.criado_em::date, CURRENT_DATE),
       'outra_conta', 'Pagamento anterior (migrado)', f.valor_total, TRUE,
       'legado-' || f.id::text
  FROM public.faturas_cartao f
 WHERE f.pago = TRUE AND f.valor_total > 0
ON CONFLICT (usuario_id, idempotency_key) DO NOTHING;
