-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- GARANTIR que perfis.cor_tema aceite as QUATRO cores: azul, rosa, verde, roxo.
--
-- Por que existe: a coluna "cor_tema" pode já ter sido criada em um banco
-- antigo com uma restrição CHECK que permitia apenas 'azul' e 'rosa'. Nesse
-- caso, a migração 2026-10_cor_tema.sql (que usa ADD COLUMN IF NOT EXISTS) NÃO
-- atualiza o CHECK existente — e o banco rejeitaria 'verde'/'roxo'. Este script
-- recria a restrição de forma idempotente para aceitar as 4 opções.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO e idempotente:
--   • Cria a coluna se faltar (com o CHECK das 4 cores).
--   • Se a coluna já existe, remove QUALQUER CHECK atrelado a cor_tema e recria
--     o CHECK correto (azul/rosa/verde/roxo). Não apaga dados.
--   • NÃO mexe em RLS, policies, outras colunas, cálculos ou autenticação.
--   • Pode rodar quantas vezes quiser.
-- ------------------------------------------------------------

-- 1) Garante a existência da coluna (bancos que ainda não a têm).
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS cor_tema TEXT NOT NULL DEFAULT 'azul';

-- 2) Normaliza valores inesperados para 'azul' antes de aplicar o novo CHECK,
--    evitando que o ADD CONSTRAINT falhe por causa de linhas fora do conjunto.
UPDATE public.perfis
  SET cor_tema = 'azul'
  WHERE cor_tema IS NULL
     OR cor_tema NOT IN ('azul','rosa','verde','roxo');

-- 3) Remove qualquer CHECK existente ligado a cor_tema (nome pode variar) e
--    recria o correto com as quatro cores.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'perfis'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%cor_tema%'
  LOOP
    EXECUTE format('ALTER TABLE public.perfis DROP CONSTRAINT %I', r.conname);
  END LOOP;

  ALTER TABLE public.perfis
    ADD CONSTRAINT perfis_cor_tema_check
    CHECK (cor_tema IN ('azul','rosa','verde','roxo'));
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
