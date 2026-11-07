-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- ONBOARDING DEFINITIVO + FOTO DE PERFIL
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
--
-- O que faz:
--   1. Garante perfis.onboarding_concluido (já existe no banco atual; não recria).
--   2. Marca UMA ÚNICA VEZ como concluído o onboarding de contas que já têm
--      receitas ou despesas cadastradas (usuários antigos não reveem o fluxo).
--   3. Cria perfis.avatar_url (URL pública da foto de perfil).
--   4. Trigger: avatar_url só aceita uma URL do bucket "avatars" dentro da
--      pasta do PRÓPRIO usuário (ninguém aponta a foto para arquivo alheio).
--   5. Trigger: usuário comum não altera o próprio "papel" (admin) nem reativa
--      a própria conta desativada (só um admin pode).
--   6. Cria o bucket "avatars" no Supabase Storage (público para leitura,
--      2 MB, apenas JPEG/PNG/WEBP).
--   7. Policies do Storage: cada usuário só envia, altera, lista e apaga
--      arquivos na pasta "<seu id>/" do bucket "avatars".
--
-- SEGURANÇA DOS DADOS:
--   • NÃO usa DROP TABLE/COLUMN e NÃO apaga dados de ninguém.
--   • DROP POLICY/TRIGGER IF EXISTS só atinge objetos criados POR ESTA
--     migração (nomes próprios), para permitir reexecução.
--   • Idempotente: pode rodar mais de uma vez. O passo 2 roda uma vez só
--     (marcador no comentário da coluna), para não desfazer um "Reiniciar
--     onboarding" feito depois pelo Admin.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Flag do onboarding (fonte da verdade, por usuário)
-- ------------------------------------------------------------
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS onboarding_concluido BOOLEAN NOT NULL DEFAULT FALSE;


-- ------------------------------------------------------------
-- 2. Backfill único: contas que já usam o app (têm receitas ou despesas)
--    não precisam rever o onboarding. Só altera a flag de UI.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_attnum SMALLINT;
  v_coment TEXT;
BEGIN
  SELECT attnum INTO v_attnum FROM pg_attribute
   WHERE attrelid = 'public.perfis'::regclass AND attname = 'onboarding_concluido';
  v_coment := COALESCE(col_description('public.perfis'::regclass, v_attnum), '');

  IF v_coment NOT LIKE '%[backfill 2026-11]%' THEN
    UPDATE public.perfis p
       SET onboarding_concluido = TRUE
     WHERE p.onboarding_concluido = FALSE
       AND (EXISTS (SELECT 1 FROM public.receitas r WHERE r.usuario_id = p.id)
         OR EXISTS (SELECT 1 FROM public.despesas d WHERE d.usuario_id = p.id));

    COMMENT ON COLUMN public.perfis.onboarding_concluido IS
      'TRUE quando o usuário concluiu o onboarding (primeiro acesso). Fonte da verdade do app. [backfill 2026-11]';
  END IF;
END $$;


-- ------------------------------------------------------------
-- 3. Foto de perfil
-- ------------------------------------------------------------
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.perfis'::regclass AND conname = 'perfis_avatar_url_tamanho') THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_avatar_url_tamanho
      CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 1024);
  END IF;
END $$;

COMMENT ON COLUMN public.perfis.avatar_url IS
  'URL pública da foto de perfil no bucket "avatars" (pasta = id do usuário). NULL = exibir iniciais.';


-- ------------------------------------------------------------
-- 4. avatar_url só pode apontar para a pasta do próprio usuário
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validar_avatar_url()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.avatar_url !~ ('^https?://[^/?#]+/storage/v1/object/public/avatars/'
                        || NEW.id::text || '/[A-Za-z0-9._-]+$') THEN
    RAISE EXCEPTION 'avatar_url inválida: a foto deve estar na pasta do próprio usuário no bucket avatars.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_avatar_url ON public.perfis;
CREATE TRIGGER trg_validar_avatar_url
  BEFORE INSERT OR UPDATE OF avatar_url ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.validar_avatar_url();


-- ------------------------------------------------------------
-- 5. Campos administrativos protegidos
--    A policy "Usuário atualiza apenas o próprio perfil" limita a linha, mas
--    não as colunas. Sem isto, um usuário poderia se promover a admin
--    (papel = 'admin') ou reativar a própria conta desativada.
--    • auth.uid() NULL = SQL Editor / service_role → liberado (manutenção).
--    • Admin (e_admin()) → liberado (painel administrativo).
--    • Encerrar a própria conta (ativo TRUE → FALSE) continua permitido.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proteger_campos_admin_perfis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.e_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.papel, 'user') <> 'user' THEN
      RAISE EXCEPTION 'Sem permissão para definir o papel da conta.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.papel IS DISTINCT FROM OLD.papel THEN
    RAISE EXCEPTION 'Sem permissão para alterar o papel da conta.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.ativo = FALSE AND NEW.ativo = TRUE THEN
    RAISE EXCEPTION 'Conta desativada: apenas um administrador pode reativá-la.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_campos_admin_perfis() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_proteger_campos_admin_perfis ON public.perfis;
CREATE TRIGGER trg_proteger_campos_admin_perfis
  BEFORE INSERT OR UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_admin_perfis();


-- ------------------------------------------------------------
-- 6. Bucket "avatars" no Supabase Storage
--    public = TRUE: a foto abre pela URL pública (rápida, cacheável, funciona
--    em qualquer dispositivo). Os nomes contêm o id do usuário + carimbo de
--    tempo; não há listagem pública (ver policies abaixo).
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;


-- ------------------------------------------------------------
-- 7. Policies do Storage: cada usuário só mexe na própria pasta
--    Caminho do arquivo: avatars/<auth.uid()>/avatar-<timestamp>.<ext>
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Avatar: dono lista a própria pasta"  ON storage.objects;
DROP POLICY IF EXISTS "Avatar: dono envia na própria pasta" ON storage.objects;
DROP POLICY IF EXISTS "Avatar: dono altera a própria pasta" ON storage.objects;
DROP POLICY IF EXISTS "Avatar: dono apaga da própria pasta" ON storage.objects;

CREATE POLICY "Avatar: dono lista a própria pasta"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Avatar: dono envia na própria pasta"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Avatar: dono altera a própria pasta"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "Avatar: dono apaga da própria pasta"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);


-- ============================================================
-- VERIFICAÇÃO (opcional — rode depois para conferir)
--   SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'avatars';
--   SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'storage' AND policyname LIKE 'Avatar:%';
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'perfis'
--      AND column_name IN ('onboarding_concluido', 'avatar_url');
-- ============================================================
