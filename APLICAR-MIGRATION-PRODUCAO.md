# 🗄️ APLICAR MIGRATION EM PRODUÇÃO
## Data: 06/11/2026 | Urgência: ALTA

---

## ⚠️ ATENÇÃO - LEIA ANTES DE EXECUTAR

**Deploy do código JÁ FOI FEITO** (commit d280095)

**Migration AINDA NÃO foi aplicada** no Supabase

**O que acontece AGORA**:
- ✅ App está no ar com novo código
- ⚠️ Botão câmera visível mas **upload NÃO funciona** ainda
- ❌ Colunas foto_url, avatar_id NÃO existem
- ❌ Bucket 'avatares' NÃO existe

**Solução**: Aplicar migration AGORA para ativar funcionalidade completa

---

## 🎯 OBJETIVO

Aplicar migration de foto/avatar em produção para ativar:
- Upload de foto personalizada
- Seleção dos 12 avatares
- Armazenamento no Supabase Storage

**Tempo estimado**: 2-3 minutos

---

## 📋 PASSO 1: VERIFICAR SE JÁ FOI APLICADA

### Acessar Supabase

```
1. Abrir: https://supabase.com/dashboard
2. Login com sua conta
3. Selecionar projeto: ievccupeijzuzhomphwn
   (Confirmar visualmente que é PRODUÇÃO)
```

### Executar Verificação

**SQL Editor → New Query**:

```sql
-- Verificar se colunas existem
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'perfis' 
AND column_name IN ('foto_url', 'avatar_id', 'foto_atualizada_em');
```

**Resultado**:
- **0 linhas**: Migration NÃO aplicada → **PROSSEGUIR**
- **3 linhas**: Migration JÁ aplicada → **PARAR, NÃO FAZER NADA**

---

## 🚀 PASSO 2: APLICAR MIGRATION (SE NÃO APLICADA)

### SQL Completo para Executar

**SQL Editor → New Query** → Copiar e colar TUDO abaixo:

```sql
-- ============================================================
-- MIGRATION: FOTO E AVATAR DO PERFIL (PRODUÇÃO)
-- Projeto: ievccupeijzuzhomphwn
-- Data: 06/11/2026
-- ============================================================
-- SEGURO: Apenas adiciona colunas e cria recursos novos
-- IDEMPOTENTE: Pode executar múltiplas vezes sem erro
-- REVERSÍVEL: Rollback documentado no final
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: ADICIONAR COLUNAS NA TABELA PERFIS
-- ============================================================

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_id TEXT,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em TIMESTAMPTZ;

COMMENT ON COLUMN public.perfis.foto_url IS 'URL da foto no storage (bucket avatares). NULL = sem foto enviada';
COMMENT ON COLUMN public.perfis.avatar_id IS 'ID do avatar predefinido selecionado. NULL = sem avatar selecionado';
COMMENT ON COLUMN public.perfis.foto_atualizada_em IS 'Timestamp da última alteração de foto/avatar';

-- ============================================================
-- ETAPA 2: CRIAR BUCKET DE STORAGE PARA FOTOS DE PERFIL
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatares',
  'avatares',
  false,  -- Privado: apenas o dono vê sua foto
  5242880,  -- 5MB limite
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ETAPA 3: POLÍTICAS RLS PARA O BUCKET 'AVATARES'
-- ============================================================

-- Política SELECT: usuário vê apenas suas fotos
DROP POLICY IF EXISTS "Usuário vê apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário vê apenas suas próprias fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política INSERT: usuário faz upload apenas no próprio diretório
DROP POLICY IF EXISTS "Usuário faz upload apenas no próprio diretório" ON storage.objects;
CREATE POLICY "Usuário faz upload apenas no próprio diretório"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política UPDATE: usuário atualiza apenas suas fotos
DROP POLICY IF EXISTS "Usuário atualiza apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário atualiza apenas suas próprias fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Política DELETE: usuário deleta apenas suas fotos
DROP POLICY IF EXISTS "Usuário deleta apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário deleta apenas suas próprias fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- ETAPA 4: ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_perfis_foto_url 
  ON public.perfis(foto_url) 
  WHERE foto_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_avatar_id 
  ON public.perfis(avatar_id) 
  WHERE avatar_id IS NOT NULL;

-- ============================================================
-- ETAPA 5: CORREÇÃO DE PERMISSÕES (GRANT UPDATE)
-- ============================================================

-- Revogar permissão anterior
REVOKE UPDATE ON TABLE public.perfis FROM authenticated;

-- Conceder UPDATE com TODAS as colunas editáveis
GRANT UPDATE (
  nome,
  email,
  ultimo_acesso,
  onboarding_concluido,
  reserva_percentual,
  reserva_atual,
  meta_reserva,
  reserva_configurada,
  reserva_modo,
  saldo_base,
  saldo_base_data,
  modo_limite,
  limite_diario,
  comece_por_aqui_dispensado,
  cor_tema,
  -- NOVAS COLUNAS (FOTO E AVATAR)
  foto_url,
  avatar_id,
  foto_atualizada_em
) ON TABLE public.perfis TO authenticated;

-- ============================================================
-- ETAPA 6: MENSAGEM DE SUCESSO
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRATION CONCLUÍDA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Alterações aplicadas:';
  RAISE NOTICE '- 3 colunas adicionadas em perfis';
  RAISE NOTICE '- Bucket avatares criado (privado, 5MB)';
  RAISE NOTICE '- 4 políticas RLS no storage.objects';
  RAISE NOTICE '- 2 índices para performance';
  RAISE NOTICE '- Permissões UPDATE corrigidas';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximo passo: Testar upload no app';
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- ============================================================
-- MIGRATION APLICADA - NÃO EXECUTAR NOVAMENTE
-- ============================================================
```

### Clicar "Run" e Aguardar

**Resultado esperado**:
```
Success. No rows returned
========================================
MIGRATION CONCLUÍDA COM SUCESSO
========================================
...
```

**Se houver erro**:
- Ler mensagem de erro
- Verificar se já foi aplicada
- Consultar seção de rollback

---

## ✅ PASSO 3: VALIDAR APLICAÇÃO

### Verificar Colunas

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'perfis' 
AND column_name IN ('foto_url', 'avatar_id', 'foto_atualizada_em');
```

**Esperado**: 3 linhas
```
foto_url             | text                        | YES
avatar_id            | text                        | YES
foto_atualizada_em   | timestamp with time zone    | YES
```

### Verificar Bucket

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets 
WHERE id = 'avatares';
```

**Esperado**: 1 linha
```
avatares | avatares | false | 5242880 | {image/jpeg,image/png,image/webp}
```

### Verificar Políticas RLS

```sql
SELECT policyname, cmd
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
AND policyname LIKE '%foto%'
ORDER BY policyname;
```

**Esperado**: 4 linhas
```
Usuário atualiza apenas suas próprias fotos    | UPDATE
Usuário deleta apenas suas próprias fotos      | DELETE
Usuário faz upload apenas no próprio diretório | INSERT
Usuário vê apenas suas próprias fotos          | SELECT
```

### Verificar Permissões

```sql
SELECT column_name 
FROM information_schema.column_privileges
WHERE table_schema = 'public'
AND table_name = 'perfis'
AND grantee = 'authenticated'
AND privilege_type = 'UPDATE'
AND column_name IN ('foto_url', 'avatar_id', 'foto_atualizada_em')
ORDER BY column_name;
```

**Esperado**: 3 linhas
```
avatar_id
foto_atualizada_em
foto_url
```

---

## 🧪 PASSO 4: TESTAR NO APP

### Teste Rápido

```
1. Acessar: https://almeida-finance.vercel.app
2. Fazer login
3. Ir em: Meu perfil
4. Clicar no botão câmera (canto superior direito da foto)
5. Modal deve abrir com 3 abas
```

### Teste de Upload

```
6. Aba "Enviar foto"
7. Selecionar uma foto JPG (< 5MB)
8. Clicar "Salvar foto"
9. Aguardar upload
10. Verificar: Foto exibida no perfil
```

**Se funcionar**: ✅ Migration aplicada com sucesso!

**Se falhar**:
- Verificar console do navegador (F12)
- Verificar se as 4 validações acima passaram
- Consultar seção de troubleshooting

---

## 🔄 ROLLBACK (SE NECESSÁRIO)

### Quando usar:
- Upload não funciona após aplicar migration
- Erros críticos detectados
- Necessidade de reverter temporariamente

### SQL de Rollback

**⚠️ ATENÇÃO**: Isto remove TODAS as fotos já enviadas!

```sql
BEGIN;

-- Remover índices
DROP INDEX IF EXISTS idx_perfis_foto_url;
DROP INDEX IF EXISTS idx_perfis_avatar_id;

-- Remover políticas
DROP POLICY IF EXISTS "Usuário vê apenas suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuário faz upload apenas no próprio diretório" ON storage.objects;
DROP POLICY IF EXISTS "Usuário atualiza apenas suas próprias fotos" ON storage.objects;
DROP POLICY IF EXISTS "Usuário deleta apenas suas próprias fotos" ON storage.objects;

-- Remover bucket (⚠️ DELETA FOTOS!)
DELETE FROM storage.objects WHERE bucket_id = 'avatares';
DELETE FROM storage.buckets WHERE id = 'avatares';

-- Remover colunas
ALTER TABLE public.perfis 
  DROP COLUMN IF EXISTS foto_url,
  DROP COLUMN IF EXISTS avatar_id,
  DROP COLUMN IF EXISTS foto_atualizada_em;

-- Reverter permissões (IMPORTANTE: ajuste para suas colunas existentes)
REVOKE UPDATE ON TABLE public.perfis FROM authenticated;
GRANT UPDATE (
  nome,
  email,
  ultimo_acesso,
  onboarding_concluido,
  reserva_percentual,
  reserva_atual,
  meta_reserva,
  reserva_configurada,
  reserva_modo,
  saldo_base,
  saldo_base_data,
  modo_limite,
  limite_diario,
  comece_por_aqui_dispensado,
  cor_tema
) ON TABLE public.perfis TO authenticated;

COMMIT;
```

### Após Rollback

```
1. App continua funcionando
2. Botão câmera some (código detecta colunas ausentes)
3. Iniciais continuam sendo exibidas
4. Nenhuma funcionalidade financeira afetada
```

---

## 🐛 TROUBLESHOOTING

### Erro: "column foto_url does not exist"

**Causa**: Migration não foi aplicada  
**Solução**: Executar migration acima

### Erro: "bucket avatares does not exist"

**Causa**: Bucket não foi criado  
**Solução**: Re-executar migration (idempotente)

### Erro: "permission denied for table perfis"

**Causa**: GRANT UPDATE não inclui novas colunas  
**Solução**: Re-executar ETAPA 5 da migration

### Upload falha com "403 Forbidden"

**Causa**: Políticas RLS não foram criadas  
**Solução**: Re-executar ETAPA 3 da migration

### Fotos não aparecem após upload

**Causa 1**: Políticas RLS incorretas  
**Solução**: Verificar `auth.uid()::text = (storage.foldername(name))[1]`

**Causa 2**: Path do storage incorreto  
**Solução**: Verificar se path é `{user_id}/perfil-{timestamp}.{ext}`

---

## 📊 CHECKLIST

### Antes de Executar
- [ ] Confirmei visualmente: Projeto PRODUÇÃO (ievccupeijzuzhomphwn)
- [ ] Verifiquei que migration NÃO foi aplicada (0 linhas na query)
- [ ] Li a migration completa
- [ ] Entendi o rollback (se necessário)

### Durante Execução
- [ ] Copiei SQL completo da ETAPA 2
- [ ] Executei no SQL Editor
- [ ] Aguardei mensagem de sucesso
- [ ] Sem erros no resultado

### Após Execução
- [ ] 3 colunas criadas (verificação 1)
- [ ] 1 bucket criado (verificação 2)
- [ ] 4 políticas RLS criadas (verificação 3)
- [ ] 3 permissões UPDATE concedidas (verificação 4)
- [ ] Upload de foto funciona no app
- [ ] Nenhum erro no console do navegador

---

## ✅ CONCLUSÃO

### Situação ANTES da Migration
- ⚠️ Botão câmera visível mas upload falha
- ❌ Colunas não existem
- ❌ Bucket não existe
- ✅ Demais funcionalidades OK

### Situação DEPOIS da Migration
- ✅ Upload de foto funciona
- ✅ 12 avatares disponíveis
- ✅ Isolamento RLS ativo (cada usuário vê só sua foto)
- ✅ Persistência após login
- ✅ Todas as funcionalidades OK

**Tempo total**: 2-3 minutos  
**Risco**: Baixo (aditivo, reversível)  
**Impacto**: Positivo (nova funcionalidade)  

---

**Status**: ⏳ AGUARDANDO EXECUÇÃO  
**Urgência**: ALTA (app no ar sem migration)  
**Próxima ação**: Executar PASSO 2 no Supabase Dashboard

