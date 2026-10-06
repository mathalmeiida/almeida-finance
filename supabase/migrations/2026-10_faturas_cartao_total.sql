-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Fatura de cartão pelo TOTAL informado (opção rápida), convivendo com o
-- detalhamento de compras (compras_cartao) já existente.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO para o banco atual:
--   • NÃO altera cartoes nem compras_cartao (ambos permanecem intactos).
--   • NÃO usa DROP.
--   • Idempotente: CREATE TABLE/INDEX IF NOT EXISTS e policy condicional.
--
-- Por que é necessária: hoje a fatura é 100% PROJETADA a partir das compras
-- individuais. Para permitir "informar só o total da fatura" por cartão e mês,
-- sem poluir compras_cartao (que alimenta limite usado, categorias e o gasto
-- rápido), guardamos o total informado numa tabela própria. No cálculo do mês,
-- quando existir um total informado para (cartão, mês), ele SUBSTITUI a soma
-- das compras daquele cartão/mês — nunca soma (evita duplicidade).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.faturas_cartao (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id     UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  -- Competência da fatura no formato 'YYYY-MM' (ex.: '2026-10' = fatura de out).
  ano_mes       TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-[0-9]{2}$'),
  valor_total   NUMERIC(12,2) NOT NULL CHECK (valor_total >= 0),
  -- Dia de vencimento informado para esta fatura (1..31). Opcional.
  vencimento_dia INTEGER CHECK (vencimento_dia IS NULL OR vencimento_dia BETWEEN 1 AND 31),
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  -- No máximo UMA fatura informada por cartão por mês (chave de substituição).
  UNIQUE (cartao_id, ano_mes)
);

ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;

-- Policy única: cada usuário gerencia apenas as próprias faturas informadas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='faturas_cartao'
      AND policyname='Usuário gerencia apenas as próprias faturas') THEN
    CREATE POLICY "Usuário gerencia apenas as próprias faturas"
      ON public.faturas_cartao FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_faturas_cartao_cartao ON public.faturas_cartao (cartao_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao_mes    ON public.faturas_cartao (cartao_id, ano_mes);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
