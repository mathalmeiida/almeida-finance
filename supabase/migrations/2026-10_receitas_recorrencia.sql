-- ============================================================
-- Migração: recorrência rica das RECEITAS
-- ------------------------------------------------------------
-- Hoje a receita só tem o booleano "recorrente" (mensal). Esta migração
-- adiciona a MESMA ideia de frequência já usada em "despesas", para suportar:
--   única | semanal | quinzenal (a cada 15 dias) | mensal | a cada X meses
--   | personalizado (intervalo em meses)
-- e término opcional por nº de ocorrências ou por data.
--
-- Colunas NULLABLE / com default → registros existentes continuam válidos:
--   • frequencia NULL  → o app usa "recorrente" (mensal) como antes.
--   • ocorrencias/data_fim NULL → sem término (repete indefinidamente).
-- Nada é alterado ou removido. RLS inalterada.
-- ============================================================

ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS frequencia TEXT
    CHECK (frequencia IS NULL OR frequencia IN
      ('nao_repete','semanal','quinzenal','mensal','por_meses','personalizado')),
  ADD COLUMN IF NOT EXISTS recorrencia_meses INTEGER
    CHECK (recorrencia_meses IS NULL OR recorrencia_meses > 0),
  ADD COLUMN IF NOT EXISTS ocorrencias INTEGER
    CHECK (ocorrencias IS NULL OR ocorrencias > 0),
  ADD COLUMN IF NOT EXISTS data_fim DATE;

-- Backfill da frequência a partir do booleano existente (opcional; o app já
-- deriva em runtime, mas isto deixa os dados consistentes):
UPDATE public.receitas
   SET frequencia = CASE
     WHEN recorrente = TRUE AND recorrencia_meses IS NOT NULL THEN 'por_meses'
     WHEN recorrente = TRUE THEN 'mensal'
     ELSE 'nao_repete'
   END
 WHERE frequencia IS NULL;
