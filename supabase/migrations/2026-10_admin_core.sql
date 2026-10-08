-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- NÚCLEO ADMINISTRATIVO (versionamento do que já existe no banco atual)
--
-- Objetivo: VERSIONAR, de forma segura e idempotente, as peças administrativas
-- que o app já usa mas que não estavam documentadas no repositório:
--   • coluna perfis.papel        ('user' | 'admin')
--   • coluna perfis.ativo        (soft-disable da conta)
--   • coluna perfis.ultimo_acesso (carimbo do último login)
--   • coluna perfis.onboarding_concluido (flag do onboarding)
--   • função public.e_admin()    (TRUE se o usuário atual é admin)
--   • policies de admin em "perfis" (admin vê/atualiza todos os perfis)
--   • trigger impedir_autodesativacao (admin não desativa a própria conta)
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
--
-- SEGURO para o banco ATUAL (onde essas peças JÁ existem):
--   • NÃO usa DROP em nada.
--   • Colunas: ADD COLUMN IF NOT EXISTS (não recria/zera as existentes).
--   • Função e_admin() e a função do trigger: criadas SOMENTE se ainda não
--     existirem (checagem em pg_proc) — uma definição já existente é PRESERVADA.
--   • Policies e trigger: criados SOMENTE se faltarem (pg_policies / pg_trigger).
--   • Idempotente: pode rodar quantas vezes quiser sem efeito colateral.
--
-- Pré-requisito: a tabela public.perfis já existe (ver schema.sql).
-- NÃO apaga nem altera dados de usuários.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Colunas administrativas em public.perfis (idempotente)
-- ------------------------------------------------------------
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS papel TEXT NOT NULL DEFAULT 'user'
    CHECK (papel IN ('user','admin'));

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN NOT NULL DEFAULT FALSE;


-- ------------------------------------------------------------
-- 2. Função public.e_admin() — TRUE se o usuário atual é admin.
--    SECURITY DEFINER + search_path fixo: consulta "perfis" sem ficar presa à
--    RLS (evita recursão nas policies que a usam) e roda de forma estável.
--    Criada SOMENTE se ainda não existir — uma definição já existente no seu
--    projeto é mantida intacta.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'e_admin'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.e_admin()
      RETURNS BOOLEAN
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1 FROM public.perfis
          WHERE id = auth.uid() AND papel = 'admin'
        );
      $body$;
    $fn$;
  END IF;
END $$;


-- ------------------------------------------------------------
-- 3. Policies de ADMIN em public.perfis (adicionais; criadas só se faltarem).
--    A policy do próprio dono (auth.uid() = id) já existe no schema.sql e é
--    preservada. Estas concedem ao admin VER e ATUALIZAR todos os perfis
--    (necessário para o painel: listar usuários, desativar, reiniciar
--    onboarding). NÃO há policy de DELETE — o admin nunca apaga perfis.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='perfis'
      AND policyname='Admin vê todos os perfis') THEN
    CREATE POLICY "Admin vê todos os perfis"
      ON public.perfis FOR SELECT
      USING (public.e_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='perfis'
      AND policyname='Admin atualiza todos os perfis') THEN
    CREATE POLICY "Admin atualiza todos os perfis"
      ON public.perfis FOR UPDATE
      USING (public.e_admin())
      WITH CHECK (public.e_admin());
  END IF;
END $$;


-- ------------------------------------------------------------
-- 4. Trigger: impedir que um ADMIN desative a PRÓPRIA conta (perfis.ativo).
--    Protege contra o admin se auto-bloquear. A função e o trigger são criados
--    SOMENTE se ainda não existirem — definições atuais são preservadas.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'impedir_autodesativacao'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.impedir_autodesativacao()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $body$
      BEGIN
        -- Se um admin está tentando marcar a PRÓPRIA conta como inativa, bloqueia.
        IF NEW.ativo = FALSE
           AND OLD.ativo = TRUE
           AND NEW.id = auth.uid()
           AND public.e_admin() THEN
          RAISE EXCEPTION 'Um administrador não pode desativar a própria conta.';
        END IF;
        RETURN NEW;
      END;
      $body$;
    $fn$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'perfis'
      AND t.tgname = 'trg_impedir_autodesativacao'
  ) THEN
    CREATE TRIGGER trg_impedir_autodesativacao
      BEFORE UPDATE ON public.perfis
      FOR EACH ROW EXECUTE FUNCTION public.impedir_autodesativacao();
  END IF;
END $$;


-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
