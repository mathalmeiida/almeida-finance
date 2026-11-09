-- ============================================================
-- ONBOARDING — objetivos financeiros e ponto de retomada
-- Data: 06/11/2026 · Parte B
-- ============================================================
-- perfis.objetivos_financeiros: objetivos escolhidos na Etapa 1.
-- perfis.onboarding_etapa: tela em que o usuário parou (continuar depois).
--
-- Nenhum dado financeiro: não afeta saldo, receitas, despesas nem cálculos.
-- O nome de preferência usa a coluna JÁ existente perfis.nome.
--
-- Segurança: colunas em public.perfis (policy "atualiza apenas o próprio
-- perfil"); GRANT UPDATE só nestas colunas (aditivo, não revoga nada);
-- CHECK restringe valores. Sem SECURITY DEFINER.
-- Idempotente. Aplicar primeiro em STAGING; produção só com autorização.
-- O app funciona antes da migration (cópia no localStorage).
-- ============================================================

BEGIN;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS objetivos_financeiros TEXT[],
  ADD COLUMN IF NOT EXISTS onboarding_etapa TEXT;

COMMENT ON COLUMN public.perfis.objetivos_financeiros IS
  'Objetivos escolhidos no onboarding (organizar, economizar, sair_dividas, reserva, investimentos, grandes_compras).';
COMMENT ON COLUMN public.perfis.onboarding_etapa IS
  'Tela do onboarding em que o usuário parou. NULL = não iniciado ou concluído.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'perfis_objetivos_financeiros_validos'
                   AND conrelid = 'public.perfis'::regclass) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_objetivos_financeiros_validos CHECK (
      objetivos_financeiros IS NULL OR (
        cardinality(objetivos_financeiros) <= 6
        AND objetivos_financeiros <@ ARRAY['organizar','economizar','sair_dividas','reserva','investimentos','grandes_compras']::TEXT[]
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'perfis_onboarding_etapa_valida'
                   AND conrelid = 'public.perfis'::regclass) THEN
    ALTER TABLE public.perfis ADD CONSTRAINT perfis_onboarding_etapa_valida CHECK (
      onboarding_etapa IS NULL OR onboarding_etapa IN (
        'perfil','saldo','renda','beneficios','despesas','cartoes','importacao',
        'metas','reserva','personalizacao','notificacoes'
      )
    );
  END IF;
END $$;

GRANT UPDATE (objetivos_financeiros, onboarding_etapa) ON TABLE public.perfis TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='perfis'
--    AND column_name IN ('objetivos_financeiros','onboarding_etapa');
--
-- ROLLBACK (sem dado financeiro envolvido):
-- REVOKE UPDATE (objetivos_financeiros, onboarding_etapa) ON TABLE public.perfis FROM authenticated;
-- ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_objetivos_financeiros_validos;
-- ALTER TABLE public.perfis DROP CONSTRAINT IF EXISTS perfis_onboarding_etapa_valida;
-- ALTER TABLE public.perfis DROP COLUMN IF EXISTS objetivos_financeiros, DROP COLUMN IF EXISTS onboarding_etapa;
-- ============================================================
