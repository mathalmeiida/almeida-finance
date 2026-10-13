-- ============================================================
-- Migração: REGISTRO DE AMORTIZAÇÕES REALIZADAS (financiamentos)
-- ------------------------------------------------------------
-- Reaproveita a tabela "parcelamentos" para contratos de financiamento/
-- empréstimo, adicionando os campos de ACOMPANHAMENTO do contrato (saldo
-- devedor, taxa, sistema, prazo e prestação atuais, com data de referência).
-- Esses campos são OPCIONAIS (NULL) — registros antigos continuam válidos e,
-- quando NULL, o app usa o comportamento anterior (parcela = valor_total /
-- numero_parcelas desde a primeira_parcela). Nenhum dado é alterado/removido.
--
-- Também cria a tabela "amortizacoes" (histórico das amortizações realizadas),
-- com RLS por usuário. Nada é somado em dobro: a amortização atualiza o estado
-- do contrato e o histórico; a projeção de despesas usa a prestação/prazo
-- atuais do contrato.
-- ============================================================

-- 1) Campos de acompanhamento do contrato (todos opcionais)
ALTER TABLE public.parcelamentos
  ADD COLUMN IF NOT EXISTS saldo_devedor   NUMERIC(14,2) CHECK (saldo_devedor  IS NULL OR saldo_devedor  >= 0),
  ADD COLUMN IF NOT EXISTS taxa_mensal     NUMERIC(10,6) CHECK (taxa_mensal    IS NULL OR taxa_mensal    >= 0),
  ADD COLUMN IF NOT EXISTS sistema         TEXT CHECK (sistema IS NULL OR sistema IN ('sac','price')),
  ADD COLUMN IF NOT EXISTS prazo_restante  INTEGER CHECK (prazo_restante IS NULL OR prazo_restante >= 0),
  ADD COLUMN IF NOT EXISTS valor_prestacao NUMERIC(14,2) CHECK (valor_prestacao IS NULL OR valor_prestacao >= 0),
  ADD COLUMN IF NOT EXISTS saldo_data      DATE;

-- 2) Histórico de amortizações realizadas
CREATE TABLE IF NOT EXISTS public.amortizacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parcelamento_id UUID NOT NULL REFERENCES public.parcelamentos(id) ON DELETE CASCADE,
  data            DATE NOT NULL,
  valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  -- Estratégia escolhida: 'prazo' (reduz meses) | 'parcela' (reduz prestação).
  modo            TEXT NOT NULL CHECK (modo IN ('prazo','parcela')),
  -- Origem do recurso: 'saldo' (conta) | 'reserva' | 'fgts'. Informativo —
  -- o app não deduz do saldo bancário quando a origem é FGTS.
  origem          TEXT NOT NULL CHECK (origem IN ('saldo','reserva','fgts')),
  -- Fotos do antes/depois (para o histórico, sem recalcular no futuro).
  saldo_antes     NUMERIC(14,2),
  saldo_depois    NUMERIC(14,2),
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.amortizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias amortizações"
  ON public.amortizacoes FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
