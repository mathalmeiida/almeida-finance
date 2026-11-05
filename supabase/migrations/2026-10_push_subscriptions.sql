-- ============================================================
-- Migration: Push Subscriptions (Web Push API)
-- ============================================================
-- Armazena as assinaturas push de cada dispositivo/usuário.
-- Cada linha = um dispositivo autorizado pelo usuário.
-- Usado pela Edge Function para enviar notificações via Web Push.
--
-- SEGURO e idempotente. NÃO executa automaticamente.
-- Aplicar manualmente no Supabase após validação.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Objeto PushSubscription serializado (endpoint + keys p256dh + auth).
  -- Armazenado como JSONB para queries diretas se necessário.
  subscription JSONB NOT NULL,

  -- Endpoint único por dispositivo (chave de negócio):
  --   https://fcm.googleapis.com/...  → Chrome/Android
  --   https://web.push.apple.com/...  → Safari/iOS
  endpoint    TEXT NOT NULL,

  -- Metadados de diagnóstico (não afetam o envio).
  user_agent  TEXT,
  plataforma  TEXT,                     -- 'ios' | 'android' | 'desktop' | 'outro'
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,

  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),

  -- Garante unicidade por endpoint: o mesmo dispositivo não grava duas vezes.
  CONSTRAINT push_sub_endpoint_unico UNIQUE (endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_push_sub_usuario
  ON public.push_subscriptions (usuario_id)
  WHERE ativo = TRUE;

-- RLS: cada usuário gerencia apenas suas próprias assinaturas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'push_subscriptions'
      AND policyname = 'Push: dono') THEN
    CREATE POLICY "Push: dono"
      ON public.push_subscriptions FOR ALL
      USING  (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

-- Trigger: atualiza atualizado_em em cada UPDATE.
CREATE OR REPLACE FUNCTION public.atualizar_push_sub_ts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_push_sub_ts ON public.push_subscriptions;
CREATE TRIGGER trg_push_sub_ts
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_push_sub_ts();

-- ============================================================
-- COMO USAR
--
-- Registrar assinatura (frontend → Supabase):
--   INSERT INTO public.push_subscriptions
--     (usuario_id, subscription, endpoint, user_agent, plataforma)
--   VALUES (auth.uid(), $sub_json, $endpoint, $ua, $plat)
--   ON CONFLICT (endpoint)
--   DO UPDATE SET subscription = EXCLUDED.subscription,
--                 ativo = TRUE,
--                 atualizado_em = NOW();
--
-- Cancelar assinatura:
--   UPDATE public.push_subscriptions
--   SET ativo = FALSE
--   WHERE endpoint = $endpoint AND usuario_id = auth.uid();
--
-- Edge Function (server-side): busca todas as assinaturas ativas
-- de um usuário e envia via Web Push API com a VAPID key privada.
-- ============================================================

-- ============================================================
-- Tabela de controle anti-duplicata: push_envios_log
-- ============================================================
-- Registra cada notificação enviada com sucesso, por (usuario_id + tag + dia).
-- A Edge Function verifica esta tabela antes de enviar, impedindo que o mesmo
-- alerta seja entregue duas vezes no mesmo dia (ex.: se o cron rodar 2x).
-- RLS: service_role lê/escreve (cron); usuário NÃO acessa (segurança).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_envios_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Tag da notificação (mesma usada no PushNotification.tag).
  tag         TEXT NOT NULL,
  -- Data em que foi enviada (sem hora — controle diário).
  enviado_em  DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_ts   TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT push_log_tag_dia_unico UNIQUE (usuario_id, tag, enviado_em)
);

-- Índice para purga de registros antigos (cron pode apagar > 30 dias).
CREATE INDEX IF NOT EXISTS idx_push_log_enviado_em
  ON public.push_envios_log (enviado_em);

-- RLS: somente service_role acessa (a Edge Function usa service_role_key).
ALTER TABLE public.push_envios_log ENABLE ROW LEVEL SECURITY;
-- Sem policy de usuário: nenhum usuário autenticado lê/escreve esta tabela.
-- A Edge Function usa service_role_key, que bypassa RLS.
