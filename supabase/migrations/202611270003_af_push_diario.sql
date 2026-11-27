BEGIN;
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subscription jsonb NOT NULL, endpoint text NOT NULL UNIQUE, user_agent text, plataforma text,
 ativo boolean NOT NULL DEFAULT true, criado_em timestamptz DEFAULT now(), atualizado_em timestamptz DEFAULT now()
);
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS af_diario boolean NOT NULL DEFAULT false;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
-- Remove policies permissivas antigas somente desta tabela de inscrições.
DO $$ DECLARE p record; BEGIN FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions' LOOP EXECUTE format('DROP POLICY %I ON public.push_subscriptions',p.policyname); END LOOP; END $$;
CREATE POLICY af_push_dono ON public.push_subscriptions FOR ALL TO authenticated USING (usuario_id=auth.uid()) WITH CHECK (usuario_id=auth.uid());
REVOKE ALL ON public.push_subscriptions FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
CREATE INDEX IF NOT EXISTS af_push_ativos_idx ON public.push_subscriptions(usuario_id,atualizado_em DESC) WHERE ativo AND af_diario;
CREATE TABLE IF NOT EXISTS public.af_push_config (id integer PRIMARY KEY CHECK(id=1),public_key text NOT NULL);
ALTER TABLE public.af_push_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS af_push_config_leitura ON public.af_push_config;
CREATE POLICY af_push_config_leitura ON public.af_push_config FOR SELECT TO authenticated USING(true);
REVOKE ALL ON public.af_push_config FROM anon,authenticated;
GRANT SELECT ON public.af_push_config TO authenticated;
GRANT SELECT ON public.af_push_config TO service_role;
CREATE TABLE IF NOT EXISTS public.af_push_instalacoes (usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, plataforma text CHECK(plataforma IN ('ios','android')), ultimo_uso timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(usuario_id,plataforma));
ALTER TABLE public.af_push_instalacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS af_push_instalacao_dono ON public.af_push_instalacoes;
CREATE POLICY af_push_instalacao_dono ON public.af_push_instalacoes FOR ALL TO authenticated USING(usuario_id=auth.uid()) WITH CHECK(usuario_id=auth.uid());
REVOKE ALL ON public.af_push_instalacoes FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.af_push_instalacoes TO authenticated;
CREATE TABLE IF NOT EXISTS public.af_push_diario_log (usuario_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, dia date, periodo text CHECK(periodo IN ('manha','noite')), subscription_id uuid REFERENCES public.push_subscriptions(id) ON DELETE SET NULL, status text NOT NULL DEFAULT 'reservado', criado_em timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(usuario_id,dia,periodo));
ALTER TABLE public.af_push_diario_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.af_push_diario_log FROM anon,authenticated;
GRANT ALL ON public.af_push_diario_log TO service_role;
CREATE OR REPLACE FUNCTION public.af_push_indicadores() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.perfis WHERE id=auth.uid() AND papel='admin' AND ativo IS TRUE) THEN RAISE EXCEPTION 'Sem autorização' USING ERRCODE='42501'; END IF;
 WITH base AS (SELECT p.id, EXISTS(SELECT 1 FROM public.af_push_instalacoes i WHERE i.usuario_id=p.id) AS instalado, EXISTS(SELECT 1 FROM public.push_subscriptions s WHERE s.usuario_id=p.id AND s.ativo AND s.af_diario AND s.plataforma IN ('ios','android')) AS push, (p.ultimo_acesso AT TIME ZONE 'America/Sao_Paulo')::date = (now() AT TIME ZONE 'America/Sao_Paulo')::date AS hoje FROM public.perfis p WHERE p.ativo IS TRUE)
 SELECT jsonb_build_object('total',count(*),'instalados',count(*) FILTER(WHERE instalado),'notificacoes',count(*) FILTER(WHERE push),'completos',count(*) FILTER(WHERE instalado AND push),'ativos_hoje',count(*) FILTER(WHERE hoje)) INTO r FROM base; RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.af_push_indicadores() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.af_push_indicadores() TO authenticated;
-- Reserva atômica: até um envio por conta/turno/data. Não repete mesmo em falha ambígua.
CREATE OR REPLACE FUNCTION public.af_push_reservar() RETURNS TABLE(uid uuid, sub_id uuid, sub jsonb, dia date, periodo text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date; h integer := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo'); turno text;
BEGIN
 IF h=8 THEN turno:='manha'; ELSIF h=21 THEN turno:='noite'; ELSE RETURN; END IF;
 DELETE FROM public.af_push_diario_log l WHERE l.dia < d-30;
 RETURN QUERY WITH candidatos AS (
 SELECT DISTINCT ON(s.usuario_id) s.usuario_id,s.id,s.subscription FROM public.push_subscriptions s JOIN public.perfis p ON p.id=s.usuario_id
 WHERE s.ativo AND s.af_diario AND p.ativo IS TRUE AND s.plataforma IN ('ios','android') AND NOT EXISTS(SELECT 1 FROM public.af_push_diario_log l WHERE l.usuario_id=s.usuario_id AND l.dia=d AND l.periodo=turno)
 ORDER BY s.usuario_id,s.atualizado_em DESC NULLS LAST,s.id LIMIT 50
 ), reservas AS (
 INSERT INTO public.af_push_diario_log(usuario_id,dia,periodo,subscription_id) SELECT c.usuario_id,d,turno,c.id FROM candidatos c ON CONFLICT ON CONSTRAINT af_push_diario_log_pkey DO NOTHING RETURNING usuario_id,subscription_id
 ) SELECT c.usuario_id,c.id,c.subscription,d,turno FROM candidatos c JOIN reservas r ON r.usuario_id=c.usuario_id AND r.subscription_id=c.id;
END $$;
REVOKE ALL ON FUNCTION public.af_push_reservar() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.af_push_reservar() TO service_role;
COMMIT;
