-- ============================================================
-- LIMITE DIÁRIO — modo automático e manual
-- Data: 11/11/2026
-- ============================================================
-- perfis.modo_limite: 'auto'/'automatico' ou 'manual' (auto é padrão, compatível com RPC)
-- perfis.limite_diario: teto diário quando modo = 'manual'
--
-- Modo automático: cálculo financeiro (saldo - próximos 7 dias) / dias restantes
-- Modo manual: usuário define um valor fixo por dia
--
-- Segurança: colunas em public.perfis (policy existente já cobre).
-- Idempotente. Aplicar primeiro em STAGING; produção só com autorização.
-- O app funciona antes da migration (valores default no código).
-- ============================================================

BEGIN;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS modo_limite TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS limite_diario NUMERIC;

COMMENT ON COLUMN public.perfis.modo_limite IS
  'Modo de cálculo do limite diário: automatico (baseado em saldo e compromissos) ou manual (valor fixo definido pelo usuário).';
COMMENT ON COLUMN public.perfis.limite_diario IS
  'Valor fixo do limite diário quando modo_limite = manual. NULL quando modo = automatico.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'perfis_modo_limite_valido'
                   AND conrelid = 'public.perfis'::regclass) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_modo_limite_valido CHECK (
      modo_limite IN ('auto', 'automatico', 'manual')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'perfis_limite_diario_positivo'
                   AND conrelid = 'public.perfis'::regclass) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_limite_diario_positivo CHECK (
      limite_diario IS NULL OR limite_diario >= 0
    );
  END IF;
END $$;

GRANT UPDATE (modo_limite, limite_diario) ON TABLE public.perfis TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='perfis'
--    AND column_name IN ('modo_limite','limite_diario');
--
-- ROLLBACK:
-- REVOKE UPDATE (modo_limite, limite_diario) ON TABLE public.perfis FROM authenticated;
-- ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_modo_limite_valido;
-- ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_limite_diario_positivo;
-- ALTER TABLE public.perfis DROP COLUMN IF EXISTS modo_limite, DROP COLUMN IF EXISTS limite_diario;
-- ============================================================
