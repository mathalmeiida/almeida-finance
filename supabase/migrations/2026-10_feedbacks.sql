-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- CENTRAL DE FEEDBACKS
-- O usuário envia uma sugestão, dúvida ou problema; o admin visualiza no painel
-- e altera o status (novo → em análise → resolvido / arquivado).
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO para o banco atual:
--   • NÃO cria/recria a função e_admin() — apenas REUTILIZA a já existente
--     (ver migration 2026-10_admin_core.sql).
--   • NÃO usa DROP.
--   • Idempotente: CREATE TABLE/INDEX IF NOT EXISTS e policies condicionais.
--
-- Pré-requisito: a função public.e_admin() já existe (admin_core).
--
-- Segurança (RLS):
--   • SELECT: usuário vê os PRÓPRIOS feedbacks; admin vê TODOS.
--   • INSERT: usuário cria apenas com o próprio usuario_id e status 'novo'.
--   • UPDATE: SOMENTE admin (gestão do status/notas).
--   • DELETE: SOMENTE admin.
--   → O usuário NÃO edita nem apaga o próprio feedback depois de enviado
--     (evita alterar o histórico que o admin está tratando).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feedbacks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Tipo escolhido pelo usuário ao enviar.
  tipo        TEXT NOT NULL DEFAULT 'sugestao'
              CHECK (tipo IN ('sugestao','duvida','problema')),
  mensagem    TEXT NOT NULL CHECK (char_length(trim(mensagem)) > 0),
  -- Fluxo de atendimento gerenciado pelo admin.
  status      TEXT NOT NULL DEFAULT 'novo'
              CHECK (status IN ('novo','em_analise','resolvido','arquivado')),
  -- Nota interna opcional do admin (não exibida ao usuário).
  resposta_admin TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_feedbacks_usuario ON public.feedbacks (usuario_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status  ON public.feedbacks (status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_criado  ON public.feedbacks (criado_em DESC);

-- Policies (criadas só se ainda não existirem — sem DROP).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feedbacks'
      AND policyname='Feedbacks: ver (dono ou admin)') THEN
    CREATE POLICY "Feedbacks: ver (dono ou admin)"
      ON public.feedbacks FOR SELECT
      USING (auth.uid() = usuario_id OR public.e_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feedbacks'
      AND policyname='Feedbacks: enviar (próprio usuário)') THEN
    CREATE POLICY "Feedbacks: enviar (próprio usuário)"
      ON public.feedbacks FOR INSERT
      WITH CHECK (auth.uid() = usuario_id AND status = 'novo');
  END IF;

  -- UPDATE e DELETE: SOMENTE admin.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feedbacks'
      AND policyname='Feedbacks: atualizar (somente admin)') THEN
    CREATE POLICY "Feedbacks: atualizar (somente admin)"
      ON public.feedbacks FOR UPDATE
      USING (public.e_admin())
      WITH CHECK (public.e_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='feedbacks'
      AND policyname='Feedbacks: apagar (somente admin)') THEN
    CREATE POLICY "Feedbacks: apagar (somente admin)"
      ON public.feedbacks FOR DELETE
      USING (public.e_admin());
  END IF;
END $$;

-- Mantém atualizado_em sincronizado em cada UPDATE (criado só se faltar).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'feedbacks_touch_atualizado_em'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.feedbacks_touch_atualizado_em()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $body$
      BEGIN
        NEW.atualizado_em = NOW();
        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'feedbacks'
      AND t.tgname = 'trg_feedbacks_touch'
  ) THEN
    CREATE TRIGGER trg_feedbacks_touch
      BEFORE UPDATE ON public.feedbacks
      FOR EACH ROW EXECUTE FUNCTION public.feedbacks_touch_atualizado_em();
  END IF;
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
