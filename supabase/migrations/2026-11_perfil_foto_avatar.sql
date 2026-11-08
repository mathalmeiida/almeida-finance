-- ============================================================
-- FOTO E AVATAR DO PERFIL
-- Data: 06/11/2026
-- ============================================================
-- Adiciona suporte a foto de perfil e avatares predefinidos.
-- O usuário pode:
--   - Enviar uma foto (salva no storage bucket 'avatares')
--   - Escolher um avatar predefinido (string identificadora)
--   - Usar as iniciais do nome (padrão quando ambos NULL)
-- ============================================================

-- 1. Adicionar colunas na tabela perfis
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_id TEXT,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em TIMESTAMPTZ;

COMMENT ON COLUMN public.perfis.foto_url IS 'URL da foto no storage (bucket avatares). NULL = sem foto enviada';
COMMENT ON COLUMN public.perfis.avatar_id IS 'ID do avatar predefinido selecionado. NULL = sem avatar selecionado';
COMMENT ON COLUMN public.perfis.foto_atualizada_em IS 'Timestamp da última alteração de foto/avatar';

-- 2. Criar bucket de storage para fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatares',
  'avatares',
  false,  -- Privado: apenas o dono vê sua foto
  5242880,  -- 5MB limite
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas RLS para o bucket 'avatares'
-- Cada usuário pode:
--   - Ver apenas suas próprias fotos
--   - Fazer upload apenas no próprio diretório (user_id/)
--   - Atualizar/deletar apenas suas próprias fotos

-- Política SELECT: usuário vê apenas suas fotos
CREATE POLICY "Usuário vê apenas suas próprias fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política INSERT: usuário faz upload apenas no próprio diretório
CREATE POLICY "Usuário faz upload apenas no próprio diretório"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política UPDATE: usuário atualiza apenas suas fotos
CREATE POLICY "Usuário atualiza apenas suas próprias fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política DELETE: usuário deleta apenas suas fotos
CREATE POLICY "Usuário deleta apenas suas próprias fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_perfis_foto_url ON public.perfis(foto_url) WHERE foto_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_perfis_avatar_id ON public.perfis(avatar_id) WHERE avatar_id IS NOT NULL;

-- ============================================================
-- VALIDAÇÃO E TESTES
-- ============================================================
-- Para testar localmente após aplicar:
--
-- 1. Verificar colunas adicionadas:
--    SELECT column_name, data_type, is_nullable
--    FROM information_schema.columns
--    WHERE table_name = 'perfis' AND column_name IN ('foto_url', 'avatar_id', 'foto_atualizada_em');
--
-- 2. Verificar bucket criado:
--    SELECT * FROM storage.buckets WHERE id = 'avatares';
--
-- 3. Verificar políticas RLS:
--    SELECT * FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE '%foto%';
-- ============================================================
