-- ============================================================
-- ADICIONAR COLUNA preferencias À TABELA perfis
-- Data: 28/01/2025
-- ============================================================
-- Adiciona coluna JSONB para armazenar preferências do usuário
-- como valores_ocultos, tema, etc.
--
-- Idempotente. Aplicar em DEV e PRODUÇÃO.
-- ============================================================

BEGIN;

-- Adicionar coluna preferencias
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS preferencias JSONB DEFAULT '{}'::jsonb;

-- Comentário
COMMENT ON COLUMN public.perfis.preferencias IS
  'Preferências do usuário (valores_ocultos, tema, etc) em formato JSON.';

-- Conceder permissão de UPDATE
GRANT UPDATE (preferencias) ON TABLE public.perfis TO authenticated;

COMMIT;

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
