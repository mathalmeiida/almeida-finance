-- ============================================================
-- Migração: tipo do parcelamento (parcelado | financiamento | consorcio)
-- ------------------------------------------------------------
-- Permite diferenciar, no acompanhamento de despesas, uma compra PARCELADA de
-- um FINANCIAMENTO e de um CONSÓRCIO, reaproveitando a MESMA tabela
-- parcelamentos (sem criar tabela nova e sem duplicar lançamentos).
--
-- Coluna NULLABLE com DEFAULT 'parcelado': registros existentes continuam
-- válidos e são tratados como "parcelado" (comportamento atual preservado).
-- Nenhum dado é alterado ou removido. RLS da tabela permanece inalterada.
-- ============================================================

ALTER TABLE public.parcelamentos
  ADD COLUMN IF NOT EXISTS tipo TEXT
  CHECK (tipo IN ('parcelado', 'financiamento', 'consorcio'))
  DEFAULT 'parcelado';

-- Garante que linhas antigas (NULL) sejam lidas como 'parcelado'.
UPDATE public.parcelamentos SET tipo = 'parcelado' WHERE tipo IS NULL;
