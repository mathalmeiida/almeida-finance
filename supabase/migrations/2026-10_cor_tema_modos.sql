-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Adaptar perfis.cor_tema para os novos modos de aparência:
-- claro | escuro | automatico
--
-- Por que existe: versões anteriores criaram o CHECK com cores de marca
-- (azul, rosa, verde, roxo, preto). O app foi atualizado para usar MODOS
-- de exibição (claro/escuro/automatico) em vez de cores de identidade.
-- Sem esta migration, salvar 'claro', 'escuro' ou 'automatico' no banco
-- falha silenciosamente (try/catch em atualizarCorTema absorve o erro),
-- fazendo a preferência persistir SOMENTE em localStorage — ao trocar
-- de dispositivo ou navegador, o usuário perde a configuração.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO e idempotente:
--   • Cria a coluna se não existir.
--   • Migra valores legados (azul/rosa/verde/roxo/preto/NULL → 'claro').
--   • Remove qualquer CHECK anterior sobre cor_tema e recria com os 3 modos.
--   • Não apaga dados de outras colunas.
--   • Não altera RLS, policies, cálculos ou autenticação.
--   • Pode rodar quantas vezes quiser.
-- ============================================================

-- 1) Garante existência da coluna
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS cor_tema TEXT NOT NULL DEFAULT 'claro';

-- 2) Remove qualquer CHECK existente sobre cor_tema (nome pode variar)
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
END $$;

-- 3) Migra valores legados para o modo padrão 'claro'.
--    Valores já válidos (claro/escuro/automatico) são preservados.
UPDATE public.perfis
  SET cor_tema = 'claro'
  WHERE cor_tema IS NULL
     OR cor_tema NOT IN ('claro', 'escuro', 'automatico');

-- 4) Reaplica o CHECK com os três modos atuais
ALTER TABLE public.perfis
  ADD CONSTRAINT perfis_cor_tema_check
  CHECK (cor_tema IN ('claro', 'escuro', 'automatico'));

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
