-- Aplicar antes do frontend. Mantém a competência de fechamento usada pelo app.
ALTER TABLE public.compras_cartao ADD COLUMN IF NOT EXISTS competencia_fatura text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.compras_cartao'::regclass AND conname = 'compras_cartao_competencia_fatura_check') THEN
    ALTER TABLE public.compras_cartao ADD CONSTRAINT compras_cartao_competencia_fatura_check CHECK (competencia_fatura IS NULL OR competencia_fatura ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS compras_cartao_competencia_idx ON public.compras_cartao (usuario_id, cartao_id, competencia_fatura);
-- Créditos mantêm valor absoluto positivo, sem violar a constraint existente.
ALTER TABLE public.compras_cartao ADD COLUMN IF NOT EXISTS credito_fatura boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.compras_cartao'::regclass AND conname = 'compras_cartao_credito_fatura_check') THEN
    ALTER TABLE public.compras_cartao ADD CONSTRAINT compras_cartao_credito_fatura_check CHECK (NOT credito_fatura OR (competencia_fatura IS NOT NULL AND numero_parcelas = 1));
  END IF;
END $$;
