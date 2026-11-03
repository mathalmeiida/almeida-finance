-- ============================================================
-- Migration: Persistência de notificações reconhecidas (lidas)
-- ============================================================
-- Permite que "Marcar como lida" persista no Supabase em vez de
-- ficar apenas em localStorage. Sobrevive a reload e re-login.
--
-- SEGURO e idempotente. NÃO executa automaticamente.
-- Aplicar manualmente no Supabase após autorização.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notificacoes_lidas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Identificador semântico do alerta (ex.: 'saldo', 'config').
  -- Não é FK para outra tabela; é gerado pelo app.
  notif_id    TEXT NOT NULL,
  lida        BOOLEAN NOT NULL DEFAULT TRUE,
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notif_lida_par_unico UNIQUE (usuario_id, notif_id)
);

ALTER TABLE public.notificacoes_lidas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notif_lidas_usuario
  ON public.notificacoes_lidas (usuario_id);

-- RLS: cada usuário vê e gerencia apenas suas próprias marcações.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notificacoes_lidas'
      AND policyname='Notificações lidas: dono') THEN
    CREATE POLICY "Notificações lidas: dono"
      ON public.notificacoes_lidas FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

-- Trigger para atualizar atualizado_em em cada upsert.
CREATE OR REPLACE FUNCTION public.atualizar_notif_lida_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_lida_ts ON public.notificacoes_lidas;
CREATE TRIGGER trg_notif_lida_ts
  BEFORE UPDATE ON public.notificacoes_lidas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_notif_lida_ts();

-- ============================================================
-- USO NO FRONTEND (após aplicar esta migration):
--
-- Ler lidas do usuário:
--   SELECT notif_id FROM public.notificacoes_lidas
--   WHERE usuario_id = auth.uid() AND lida = TRUE;
--
-- Marcar como lida (upsert):
--   INSERT INTO public.notificacoes_lidas (usuario_id, notif_id, lida)
--   VALUES (auth.uid(), 'saldo', TRUE)
--   ON CONFLICT (usuario_id, notif_id)
--   DO UPDATE SET lida = EXCLUDED.lida;
-- ============================================================
