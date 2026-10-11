-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Adicionar a cor de tema "preto" ao CHECK de perfis.cor_tema.
--
-- Por que existe: o app passou a oferecer o tema PRETO (além de azul, rosa,
-- verde e roxo). A coluna perfis.cor_tema tem um CHECK que só aceitava as 4
-- cores antigas; sem este ajuste, salvar 'preto' falharia com violação de CHECK
-- e o usuário não conseguiria escolher o tema preto (inclusive na 1ª tela do
-- onboarding, onde a cor é escolhida).
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO e idempotente:
--   • Cria a coluna se faltar (com o CHECK das 5 cores).
--   • Se a coluna já existe, remove QUALQUER CHECK atrelado a cor_tema e recria
--     o CHECK correto (azul/rosa/verde/roxo/preto). NÃO apaga dados.
--   • NÃO mexe em RLS, policies, outras colunas, cálculos ou autenticação.
--   • Pode rodar quantas vezes quiser (idempotente).
-- ------------------------------------------------------------

-- 1) Garante a existência da coluna (bancos que ainda não a têm).
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS cor_tema TEXT NOT NULL DEFAULT 'azul';

-- 2) Normaliza valores inesperados para 'azul' antes de aplicar o novo CHECK,
--    evitando que o ADD CONSTRAINT falhe por causa de linhas fora do conjunto.
--    (Preserva as cores válidas já escolhidas pelos usuários — inclusive as
--    5 atuais; só corrige valores NULOS ou fora do conjunto permitido.)
UPDATE public.perfis
  SET cor_tema = 'azul'
  WHERE cor_tema IS NULL
     OR cor_tema NOT IN ('azul','rosa','verde','roxo','preto');

-- 3) Remove qualquer CHECK existente ligado a cor_tema (o nome pode variar) e
--    recria o correto com as CINCO cores.
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
    CHECK (cor_tema IN ('azul','rosa','verde','roxo','preto'));
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
