-- ============================================================
-- ADICIONAR COLUNAS saldo_base E saldo_base_data À TABELA perfis
-- Data: 23/11/2026
-- ============================================================
-- Adiciona capacidade de registrar o saldo base (ponto de partida)
-- e a data desse registro para cálculos de projeção financeira.
--
-- saldo_base: Valor do saldo inicial informado pelo usuário (em centavos).
-- saldo_base_data: Data de referência deste saldo.
--
-- Nenhuma destas colunas é obrigatória (NULL permitido).
-- Idempotente. Aplicar primeiro em DEV.
-- ============================================================

BEGIN;

-- Adicionar colunas
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS saldo_base NUMERIC(15, 2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS saldo_base_data DATE DEFAULT NULL;

-- Comentários
COMMENT ON COLUMN public.perfis.saldo_base IS
  'Saldo inicial informado pelo usuário no onboarding ou configurações. Valor em reais (formato decimal).';
COMMENT ON COLUMN public.perfis.saldo_base_data IS
  'Data de referência do saldo base informado.';

-- Conceder permissão de UPDATE nas novas colunas
GRANT UPDATE (saldo_base, saldo_base_data) ON TABLE public.perfis TO authenticated;

COMMIT;

-- Recarregar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO (executar após aplicar):
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='perfis'
--   AND column_name IN ('saldo_base', 'saldo_base_data');
--
-- ROLLBACK (se necessário):
-- BEGIN;
-- REVOKE UPDATE (saldo_base, saldo_base_data) ON TABLE public.perfis FROM authenticated;
-- ALTER TABLE public.perfis 
--   DROP COLUMN IF EXISTS saldo_base,
--   DROP COLUMN IF EXISTS saldo_base_data;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ============================================================
