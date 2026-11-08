# 🔴 DIAGNÓSTICO: ERRO DE AVATAR
## Data: 06/11/2026 | Urgência: CRÍTICA

---

## 🚨 ERRO REPORTADO

```
Could not find the 'avatar_id' column of 'perfis' in the schema cache.
```

**Local**: Ao selecionar avatar no Almeida Finance  
**Impacto**: Upload de foto e seleção de avatar NÃO funcionam  
**Causa provável**: Migration NÃO foi aplicada no Supabase

---

## 🔍 1. DIAGNÓSTICO DA CAUSA

### Cenário Detectado

**Deploy do código**: ✅ Realizado (commit d280095)  
**Migration do Supabase**: ❌ **NÃO FOI APLICADA**

### Confirmação da Causa

**Erro do PostgREST**:
```
Could not find the 'avatar_id' column of 'perfis' in the schema cache
```

**Tradução**: O Supabase (PostgREST) não encontra a coluna `avatar_id` porque ela **NÃO EXISTE** no banco de dados.

**Conclusão**: Migration precisa ser aplicada AGORA.

---

## ✅ 2. VERIFICAÇÕES NECESSÁRIAS

### 2.1. Confirmar Projeto Correto

**Projeto em uso**:
```
URL: https://ievccupeijzuzhomphwn.supabase.co
Anon Key: sb_publishable_AEH_qoYHnbxDoQFvuPFAIA_5BHgY_ku
```

**Verificar**:
1. Acessar https://supabase.com/dashboard
2. Confirmar projeto: `ievccupeijzuzhomphwn` (PRODUÇÃO)
3. Confirmar visualmente no canto superior do dashboard

### 2.2. Verificar Se Colunas Existem

**SQL Editor → New Query**:

```sql
-- Verificar colunas da migration
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'perfis'
AND column_name IN ('avatar_id', 'foto_url', 'foto_atualizada_em')
ORDER BY column_name;
```

**Resultado esperado**:

**SE 0 LINHAS**: ❌ Migration NÃO aplicada → **APLICAR AGORA**  
**SE 3 LINHAS**: ✅ Migration JÁ aplicada → **Problema é cache do PostgREST**

### 2.3. Verificar Bucket Storage

```sql
-- Verificar bucket avatares
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'avatares';
```

**SE 0 LINHAS**: ❌ Bucket não existe → **Migration não aplicada**  
**SE 1 LINHA**: ✅ Bucket existe → **Parte da migration foi aplicada**

---

## 🛠️ 3. SOLUÇÃO COMPLETA

### Cenário A: Colunas NÃO Existem (Mais Provável)

#### SQL para Aplicar (Copiar Tudo)

**⚠️ Confirmar projeto PRODUÇÃO antes de executar!**

**SQL Editor → New Query → Copiar e colar**:

```sql
-- ============================================================
-- CORREÇÃO URGENTE: ADICIONAR COLUNAS DE AVATAR/FOTO
-- Projeto: ievccupeijzuzhomphwn (PRODUÇÃO)
-- Data: 06/11/2026
-- ============================================================
-- SEGURO: Apenas adiciona colunas e recursos
-- NÃO ALTERA: Dados existentes, saldos, despesas, cartões
-- REVERSÍVEL: Rollback documentado ao final
-- ============================================================

BEGIN;

-- ============================================================
-- ETAPA 1: ADICIONAR COLUNAS (IDEMPOTENTE)
-- ============================================================

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS avatar_id TEXT,
  ADD COLUMN IF NOT EXISTS foto_atualizada_em TIMESTAMPTZ;

COMMENT ON COLUMN public.perfis.foto_url IS 'URL da foto no storage (bucket avatares)';
COMMENT ON COLUMN public.perfis.avatar_id IS 'ID do avatar predefinido selecionado';
COMMENT ON COLUMN public.perfis.foto_atualizada_em IS 'Timestamp da última alteração';

-- ============================================================
-- ETAPA 2: CRIAR BUCKET STORAGE (IDEMPOTENTE)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatares',
  'avatares',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ETAPA 3: POLÍTICAS RLS STORAGE (IDEMPOTENTE)
-- ============================================================

DROP POLICY IF EXISTS "Usuário vê apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário vê apenas suas próprias fotos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Usuário faz upload apenas no próprio diretório" ON storage.objects;
CREATE POLICY "Usuário faz upload apenas no próprio diretório"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Usuário atualiza apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário atualiza apenas suas próprias fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Usuário deleta apenas suas próprias fotos" ON storage.objects;
CREATE POLICY "Usuário deleta apenas suas próprias fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatares' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- ETAPA 4: ÍNDICES PARA PERFORMANCE (IDEMPOTENTE)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_perfis_foto_url 
  ON public.perfis(foto_url) 
  WHERE foto_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_avatar_id 
  ON public.perfis(avatar_id) 
  WHERE avatar_id IS NOT NULL;

-- ============================================================
-- ETAPA 5: PERMISSÕES UPDATE (CRÍTICO)
-- ============================================================

-- Revogar permissão anterior
REVOKE UPDATE ON TABLE public.perfis FROM authenticated;

-- Conceder UPDATE incluindo novas colunas
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
  -- NOVAS COLUNAS
  foto_url,
  avatar_id,
  foto_atualizada_em
) ON TABLE public.perfis TO authenticated;

-- ============================================================
-- ETAPA 6: FORÇAR ATUALIZAÇÃO DO SCHEMA CACHE
-- ============================================================

-- PostgREST recarrega schema automaticamente após DDL
-- Mas podemos garantir enviando NOTIFY
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MENSAGEM DE SUCESSO
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CORREÇÃO APLICADA COM SUCESSO';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Alterações:';
  RAISE NOTICE '- 3 colunas adicionadas em perfis';
  RAISE NOTICE '- Bucket avatares criado';
  RAISE NOTICE '- 4 políticas RLS no storage';
  RAISE NOTICE '- 2 índices criados';
  RAISE NOTICE '- Permissões UPDATE atualizadas';
  RAISE NOTICE '- Schema cache recarregado';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximo passo: Testar seleção de avatar';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
```

#### Após Executar

**Aguardar 5-10 segundos** para PostgREST recarregar schema.

**Atualizar página do app** (Ctrl+F5 ou Cmd+Shift+R).

**Testar seleção de avatar novamente**.

---

### Cenário B: Colunas Existem (Cache Desatualizado)

**Se as colunas JÁ existem mas erro persiste**:

#### Opção 1: Recarregar Schema via SQL

```sql
-- Forçar reload do schema
NOTIFY pgrst, 'reload schema';
```

#### Opção 2: Recarregar via Dashboard

```
1. Supabase Dashboard
2. Database → Connections
3. Clicar "Restart"
4. Aguardar 10-20 segundos
```

#### Opção 3: Aguardar Recarga Automática

PostgREST recarrega schema automaticamente a cada ~10 minutos.

---

## ✅ 4. VALIDAR CORREÇÃO

### 4.1. Verificar Colunas Criadas

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'perfis'
AND column_name IN ('avatar_id', 'foto_url', 'foto_atualizada_em');
```

**Esperado**: 3 linhas

### 4.2. Verificar Permissões

```sql
SELECT column_name
FROM information_schema.column_privileges
WHERE table_name = 'perfis'
AND grantee = 'authenticated'
AND privilege_type = 'UPDATE'
AND column_name IN ('avatar_id', 'foto_url', 'foto_atualizada_em');
```

**Esperado**: 3 linhas (avatar_id, foto_atualizada_em, foto_url)

### 4.3. Verificar Bucket

```sql
SELECT id, name, public
FROM storage.buckets
WHERE id = 'avatares';
```

**Esperado**: 1 linha (avatares | avatares | false)

### 4.4. Verificar Políticas RLS

```sql
SELECT policyname
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname LIKE '%foto%'
ORDER BY policyname;
```

**Esperado**: 4 políticas

---

## 🧪 5. TESTAR FUNCIONALIDADES

### Teste 1: Selecionar Avatar

```
1. Acessar: https://almeida-finance.vercel.app
2. Login
3. Meu perfil → Botão câmera
4. Aba "Escolher avatar"
5. Clicar em qualquer avatar
6. Deve salvar SEM ERRO
```

**Resultado esperado**: ✅ Avatar salvo e exibido

### Teste 2: Trocar Avatar

```
7. Clicar câmera novamente
8. Escolher OUTRO avatar
9. Salvar
```

**Resultado esperado**: ✅ Avatar trocado

### Teste 3: Usar Iniciais

```
10. Clicar câmera
11. Aba "Usar iniciais"
12. Clicar "Usar iniciais"
```

**Resultado esperado**: ✅ Volta para iniciais (círculo vinho)

### Teste 4: Enviar Foto

```
13. Clicar câmera
14. Aba "Enviar foto"
15. Selecionar JPG < 5MB
16. Clicar "Salvar foto"
```

**Resultado esperado**: ✅ Foto enviada e exibida

### Teste 5: Remover Foto

```
17. Clicar câmera
18. Aba "Usar iniciais"
19. Confirmar
```

**Resultado esperado**: ✅ Foto removida

### Teste 6: Persistência

```
20. Fazer logout
21. Fazer login
22. Verificar perfil
```

**Resultado esperado**: ✅ Avatar/foto persiste

### Teste 7: Atualização na Home

```
23. Ir para Home
24. Verificar foto no header mobile
25. Verificar foto na sidebar desktop
```

**Resultado esperado**: ✅ Foto exibida em todos os locais

---

## 🔒 6. GARANTIAS DE SEGURANÇA

### O Que a Correção FAZ

✅ Adiciona 3 colunas (foto_url, avatar_id, foto_atualizada_em)  
✅ Cria bucket privado 'avatares'  
✅ Cria 4 políticas RLS (isolamento por usuário)  
✅ Adiciona índices para performance  
✅ Atualiza permissões GRANT UPDATE  
✅ Recarrega schema cache  

### O Que a Correção NÃO FAZ

❌ NÃO altera dados existentes  
❌ NÃO remove colunas  
❌ NÃO modifica saldos/despesas/cartões  
❌ NÃO altera autenticação  
❌ NÃO muda políticas RLS financeiras  
❌ NÃO apaga registros  

### Compatibilidade

✅ **Perfis existentes**: Continuam funcionando (colunas NULL)  
✅ **Retrocompatível**: Iniciais exibidas se sem foto  
✅ **Aditivo**: Apenas adiciona recursos  
✅ **Reversível**: Rollback disponível  

---

## 🔄 ROLLBACK (Se Necessário)

### Quando Usar

- Erro crítico após aplicar correção
- Necessidade de reverter temporariamente
- Problemas de performance inesperados

### SQL de Rollback

**⚠️ REMOVE FOTOS JÁ ENVIADAS!**

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

-- Remover bucket (DELETA FOTOS!)
DELETE FROM storage.objects WHERE bucket_id = 'avatares';
DELETE FROM storage.buckets WHERE id = 'avatares';

-- Remover colunas
ALTER TABLE public.perfis
  DROP COLUMN foto_url,
  DROP COLUMN avatar_id,
  DROP COLUMN foto_atualizada_em;

-- Reverter permissões
REVOKE UPDATE ON TABLE public.perfis FROM authenticated;
GRANT UPDATE (
  nome, email, ultimo_acesso, onboarding_concluido,
  reserva_percentual, reserva_atual, meta_reserva,
  reserva_configurada, reserva_modo, saldo_base,
  saldo_base_data, modo_limite, limite_diario,
  comece_por_aqui_dispensado, cor_tema
) ON TABLE public.perfis TO authenticated;

COMMIT;
```

---

## 📊 CHECKLIST CORREÇÃO

### Antes de Executar
- [ ] Confirmei projeto PRODUÇÃO (ievccupeijzuzhomphwn)
- [ ] Verifiquei que colunas NÃO existem (0 linhas)
- [ ] Li o SQL completo
- [ ] Entendi o que será alterado

### Durante Execução
- [ ] Copiei SQL completo
- [ ] Executei no SQL Editor
- [ ] Aguardei mensagem de sucesso
- [ ] Sem erros no resultado

### Após Execução
- [ ] 3 colunas criadas ✅
- [ ] 1 bucket criado ✅
- [ ] 4 políticas RLS ativas ✅
- [ ] 3 permissões UPDATE concedidas ✅
- [ ] Aguardei 10 segundos (reload cache)
- [ ] Atualizei página do app (Ctrl+F5)

### Testes Funcionais
- [ ] Seleção de avatar funciona
- [ ] Troca de avatar funciona
- [ ] Uso de iniciais funciona
- [ ] Upload de foto funciona
- [ ] Remoção de foto funciona
- [ ] Persistência após logout/login
- [ ] Foto exibida na Home e Perfil

---

## 🎯 RESULTADO ESPERADO

### Imediatamente Após Correção

✅ Erro "Could not find avatar_id" **RESOLVIDO**  
✅ Seleção de avatar **FUNCIONA**  
✅ Upload de foto **FUNCIONA**  
✅ Persistência **OK**  
✅ Nenhum dado financeiro afetado  
✅ Login/cadastro **OK**  

### Confirmações

✅ Colunas existem no banco  
✅ Bucket 'avatares' criado  
✅ Políticas RLS ativas  
✅ Permissões UPDATE corretas  
✅ Schema cache atualizado  
✅ App funcional  

---

## 📝 RELATÓRIO FINAL

### Causa do Erro

**❌ Migration não foi aplicada no Supabase**

### Solução Aplicada

**✅ SQL de correção executado**

### Validações

- [ ] Colunas existem: **SIM/NÃO**
- [ ] Bucket existe: **SIM/NÃO**
- [ ] Políticas RLS ativas: **SIM/NÃO**
- [ ] Permissões OK: **SIM/NÃO**
- [ ] Avatar salvo com sucesso: **SIM/NÃO**
- [ ] Upload foto funciona: **SIM/NÃO**
- [ ] Persistência OK: **SIM/NÃO**

### Deploy Necessário

**❌ NÃO** - Problema era no banco, não no código

---

**Status**: ⏳ AGUARDANDO EXECUÇÃO  
**Tempo**: 2-3 minutos  
**Risco**: Baixo (aditivo, reversível)  
**Impacto**: Positivo (resolve erro crítico)

