-- ============================================================
-- ATALHOS DA HOME — personalização por usuário
-- Data: 06/11/2026 · Parte A
-- ============================================================
-- Guarda a ordem, os atalhos ocultos e os favoritos da faixa de atalhos da
-- Home. Formato (validado no app por src/lib/atalhosHome.js):
--   { "versao": 1, "ordem": ["simular-compra", ...], "ocultos": [...], "favoritos": [...] }
--
-- Segurança:
--   • Sem tabela nova: a coluna fica em public.perfis, já protegida pela
--     policy "Usuário atualiza apenas o próprio perfil" (auth.uid() = id).
--   • GRANT UPDATE apenas nesta coluna (aditivo: não revoga nada existente,
--     compatível com o esquema de GRANT por coluna usado em perfis).
--   • CHECK limita o tipo (objeto JSON) e o tamanho (4 KB).
--   • Sem SECURITY DEFINER, sem função nova.
--
-- Idempotente: pode ser executada mais de uma vez.
-- Ordem: aplicar primeiro em STAGING. Produção somente com autorização.
-- O app funciona antes da migration (usa localStorage como fallback).
-- ============================================================

BEGIN;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS atalhos_home JSONB;

COMMENT ON COLUMN public.perfis.atalhos_home IS
  'Personalização dos atalhos da Home: {versao, ordem[], ocultos[], favoritos[]}. NULL = padrão.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'perfis_atalhos_home_formato'
      AND conrelid = 'public.perfis'::regclass
  ) THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_atalhos_home_formato CHECK (
        atalhos_home IS NULL
        OR (jsonb_typeof(atalhos_home) = 'object' AND pg_column_size(atalhos_home) <= 4096)
      );
  END IF;
END $$;

GRANT UPDATE (atalhos_home) ON TABLE public.perfis TO authenticated;

COMMIT;

-- Recarrega o cache de schema do PostgREST (a coluna passa a ser aceita pela API).
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'perfis' AND column_name = 'atalhos_home';
-- SELECT conname FROM pg_constraint WHERE conname = 'perfis_atalhos_home_formato';
-- SELECT privilege_type FROM information_schema.column_privileges
--  WHERE table_name = 'perfis' AND column_name = 'atalhos_home' AND grantee = 'authenticated';
--
-- ROLLBACK (só se necessário; a coluna não guarda dado financeiro):
-- REVOKE UPDATE (atalhos_home) ON TABLE public.perfis FROM authenticated;
-- ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_atalhos_home_formato;
-- ALTER TABLE public.perfis DROP COLUMN IF EXISTS atalhos_home;
-- ============================================================
