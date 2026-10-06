-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- 1) Exceções mensais do tipo da despesa (Fixa/Variável) — item A
-- 2) Antecipação de pagamento de despesa (pago_em)         — item B
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- É seguro rodar mais de uma vez (idempotente: IF NOT EXISTS / ON CONFLICT).
-- NÃO altera dados existentes nem remove nada.
-- ============================================================


-- ------------------------------------------------------------
-- ITEM B — Pagamento antecipado de despesa
-- ------------------------------------------------------------
-- "pago_em" = data em que a despesa foi efetivamente paga.
--   NULL  → despesa ainda não paga manualmente; segue a regra normal
--           (afeta o saldo quando a sua "data" de vencimento chega).
--   DATA  → paga nesse dia. O app passa a usar pago_em (e não "data")
--           como o momento em que o dinheiro saiu, para o saldo refletir
--           a antecipação SEM contar duas vezes.
-- A coluna "data" (vencimento original) NUNCA é alterada ao antecipar,
-- preservando recorrência, projeção e histórico.
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS pago_em DATE DEFAULT NULL;


-- ------------------------------------------------------------
-- ITEM A — Exceção do tipo (Fixa/Variável) por mês
-- ------------------------------------------------------------
-- Para despesas recorrentes (um único registro que se repete), permite
-- classificar como Fixa ou Variável APENAS em um mês específico, sem
-- alterar o registro base nem duplicar o lançamento.
--
--   despesa_id  → despesa recorrente de origem
--   ano_mes     → competência no formato 'YYYY-MM' (ex.: '2026-11')
--   tipo_despesa→ 'fixa' | 'variavel' que vale SÓ naquele mês
--
-- Regra de leitura no app: o tipo exibido/somado no mês é o da exceção,
-- se existir para (despesa_id, ano_mes); caso contrário, o tipo do registro.
-- Isso afeta apenas o rótulo e os totais Fixas/Variáveis daquele mês —
-- não muda valor, data, recorrência nem o saldo.
CREATE TABLE IF NOT EXISTS public.despesas_tipo_excecoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  despesa_id    UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  ano_mes       TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-[0-9]{2}$'),
  tipo_despesa  TEXT NOT NULL CHECK (tipo_despesa IN ('fixa','variavel')),
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  -- No máximo UMA exceção por despesa por mês (idempotência do override).
  UNIQUE (despesa_id, ano_mes)
);

-- RLS: cada usuário gerencia apenas as próprias exceções.
ALTER TABLE public.despesas_tipo_excecoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'despesas_tipo_excecoes'
      AND policyname = 'Usuário gerencia apenas as próprias exceções de tipo'
  ) THEN
    CREATE POLICY "Usuário gerencia apenas as próprias exceções de tipo"
      ON public.despesas_tipo_excecoes FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

-- Índice para busca por despesa (join leve ao carregar o mês).
CREATE INDEX IF NOT EXISTS idx_excecoes_tipo_despesa
  ON public.despesas_tipo_excecoes (despesa_id);


-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
