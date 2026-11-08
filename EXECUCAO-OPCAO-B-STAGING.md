# 🚀 EXECUÇÃO OPÇÃO B: VALIDAÇÃO COMPLETA EM STAGING
## Data: 06/11/2026 | Status: EM ANDAMENTO

---

## 🎯 OBJETIVO

Validar completamente as funcionalidades de **foto de perfil**, **avatares** e **carrossel** em ambiente isolado de staging antes da publicação em produção.

**Prioridades**:
- ✅ Segurança (isolamento RLS)
- ✅ Estabilidade (sem quebrar funcionalidades)
- ✅ Preservação de dados financeiros

---

## 📋 SITUAÇÃO ATUAL

### Ambiente de Produção
- **Project Ref**: `ievccupeijzuzhomphwn`
- **URL**: `https://ievccupeijzuzhomphwn.supabase.co`
- **Status**: ⚠️ **NÃO TOCAR** - Contém dados reais de usuários
- **Deployment**: Vercel (https://almeida-finance.vercel.app)

### Ambiente de Staging
- **Status**: ❌ **NÃO EXISTE AINDA**
- **Necessário**: Criar projeto Supabase separado
- **Guia disponível**: `GUIA-STAGING-SEM-DOCKER.md`
- **Tempo estimado**: 30-60 minutos para configuração completa

### Implementações Prontas (Aguardando Validação)
1. ✅ Sistema foto/avatar/iniciais (6 arquivos modificados, 3 novos)
2. ✅ Carrossel horizontal restaurado
3. ✅ Migration SQL (`2026-11_perfil_foto_avatar.sql`)
4. ✅ Correção de permissões (`CORRECAO-PERMISSOES-FOTO.sql`)
5. ✅ 25 testes SQL automatizados
6. ✅ Build bem-sucedido (0 erros)

---

## 🚀 PASSO 1: PREPARAR AMBIENTE DE STAGING

### 1.1. Verificar Ambiente Atual

**Situação detectada**:
- ❌ Projeto staging não existe
- ✅ Guia completo disponível (`GUIA-STAGING-SEM-DOCKER.md`)
- ✅ Schema completo disponível (`staging/1-SCHEMA-COMPLETO-STAGING.sql`)
- ✅ Migrations disponíveis (26 arquivos em `supabase/migrations/`)

**Decisão**: Precisa criar projeto staging no Supabase Dashboard

### 1.2. Criar Projeto Staging no Supabase

**⚠️ AÇÃO MANUAL NECESSÁRIA (NÃO AUTOMATIZÁVEL)**

#### Passo 1.2.1: Acessar Dashboard
```
1. Abrir https://supabase.com/dashboard
2. Login com sua conta
3. Clicar "New Project"
```

#### Passo 1.2.2: Configurar Projeto
```
Nome: almeida-finance-staging
Password: [escolher senha forte, DIFERENTE de produção]
Região: [mesma da produção]
Plano: Free (suficiente para testes)
```

#### Passo 1.2.3: Aguardar Criação
```
Tempo: 2-3 minutos
Status: "Setting up project..."
```

#### Passo 1.2.4: Anotar Credenciais
```
Project URL: https://[STAGING_REF].supabase.co
Anon key: eyJ... [copiar do dashboard]
Service role key: [copiar do dashboard]
```

**⚠️ IMPORTANTE**: Estas credenciais são do STAGING, não de produção!

### 1.3. Aplicar Schema Completo

**Opção A: Via Dashboard (Recomendado para primeira vez)**

```sql
-- Supabase Dashboard → SQL Editor → New Query
-- Copiar e colar: staging/1-SCHEMA-COMPLETO-STAGING.sql
-- Clicar "Run"
-- Aguardar: "Success. No rows returned"
```

**Opção B: Via CLI (Alternativa)**

```powershell
# Criar link temporário com staging
npx supabase link --project-ref [STAGING_REF]

# Aplicar todas as migrations
npx supabase db push

# Verificar aplicação
npx supabase db diff
```

### 1.4. Verificar Tabelas Criadas

```sql
-- Execute no SQL Editor
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Esperado**: ~22 tabelas incluindo `perfis`, `receitas`, `despesas`, `categorias`, etc.

### 1.5. Configurar .env.local para Staging (TEMPORÁRIO)

**Criar arquivo**: `.env.staging` (não commitar)

```env
VITE_SUPABASE_URL=https://[STAGING_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[STAGING_ANON_KEY]
VITE_VAPID_PUBLIC_KEY=BF3AJLkH1yr7xqciso4p-5IJMkKIu0fBV0VvKGDkKH7X0HjCM-ax8MNmtgjL9b4vby4yMj99-D4Q5Dltd8sitYQ
```

**⚠️ LEMBRAR**: Reverter para produção após testes!

---

## 🧪 PASSO 2: APLICAR MIGRATION APENAS EM STAGING

### 2.1. Aplicar Migration Foto/Avatar

**SQL Editor → Nova Query**

```sql
-- Copiar e colar: supabase/migrations/2026-11_perfil_foto_avatar.sql
-- Verificar visualmente o conteúdo
-- Executar
```

**Resultado esperado**:
```
ALTER TABLE
CREATE INDEX
CREATE INDEX
INSERT INTO storage.buckets
CREATE POLICY
CREATE POLICY
CREATE POLICY
CREATE POLICY
```

### 2.2. Aplicar Correção de Permissões

**SQL Editor → Nova Query**

```sql
-- Copiar e colar: staging/CORRECAO-PERMISSOES-FOTO.sql
-- Executar
```

**Resultado esperado**:
```
REVOKE
GRANT UPDATE
✅ Permissões concedidas: foto_url, avatar_id, foto_atualizada_em
COMMIT
```

### 2.3. Validar Permissões

```sql
-- Listar todas as colunas editáveis por authenticated
SELECT column_name 
FROM information_schema.column_privileges
WHERE table_schema = 'public'
AND table_name = 'perfis'
AND grantee = 'authenticated'
AND privilege_type = 'UPDATE'
ORDER BY column_name;
```

**Resultado esperado**: 19 colunas incluindo `foto_url`, `avatar_id`, `foto_atualizada_em`

### 2.4. Confirmar Compatibilidade

**Verificar**:
- ✅ Colunas são nullable (retrocompatível)
- ✅ Não altera colunas existentes (id, papel, ativo preservados)
- ✅ Bucket 'avatares' criado (privado, 5MB)
- ✅ 4 políticas RLS no storage.objects

---

## ✅ PASSO 3: EXECUTAR TESTES AUTOMATIZADOS

### 3.1. Teste de Migration (10 testes)

**SQL Editor → Nova Query**

```sql
-- Copiar e colar: staging/TEST-MIGRATION-FOTO-PERFIL.sql
-- Executar (Ctrl+Enter)
-- Aguardar 10-20 segundos
```

**Resultado esperado**:
```
========================================
RELATÓRIO DE TESTES - MIGRATION FOTO/AVATAR
========================================
Total de testes: 10
Passou: 10 (100%)
Falhou: 0 (0%)
========================================

✅ MIGRATION VALIDADA: Todos os testes passaram!
```

**Se ALGUM teste falhar**:
1. ❌ Anotar qual teste falhou
2. ❌ Ler mensagem de erro
3. ❌ Corrigir problema
4. ❌ Re-executar teste
5. ❌ NÃO PROSSEGUIR até 10/10 ✅

### 3.2. Teste de RLS (15 testes)

**SQL Editor → Nova Query**

```sql
-- Copiar e colar: staging/TEST-RLS-FOTO-PERFIL.sql
-- Executar (Ctrl+Enter)
-- Aguardar 20-30 segundos
```

**Resultado esperado**:
```
========================================
RELATÓRIO DE TESTES RLS - FOTO/AVATAR
========================================
Total de testes: 15
Passou: 15 (100%)
Falhou: 0 (0%)
========================================

✅ RLS VALIDADO: Isolamento de fotos funciona corretamente!
```

**Testes críticos** (não podem falhar):
- TESTE 2: Usuário B NÃO vê perfil de A
- TESTE 4: Usuário A NÃO altera foto de B
- TESTE 10: Storage: Usuário B NÃO vê objeto de A
- TESTE 11: Storage: Usuário B NÃO deleta objeto de A
- TESTE 12: Storage: Usuário B NÃO insere no dir de A

**Se ALGUM teste falhar**:
1. 🚨 **CRÍTICO**: Isolamento RLS comprometido
2. ❌ Revisar políticas em `2026-11_perfil_foto_avatar.sql`
3. ❌ Corrigir política
4. ❌ Re-aplicar migration
5. ❌ Re-executar testes
6. ❌ NÃO PROSSEGUIR até 15/15 ✅

### 3.3. Scorecard dos Testes SQL

**Esperado**: ✅ **25/25 PASSOU (100%)**

| Categoria | Testes | Status |
|-----------|--------|--------|
| Migration | 10 | ⏳ Aguardando |
| RLS Foto/Avatar | 15 | ⏳ Aguardando |
| **Total** | **25** | **⏳** |

---

## 🧪 PASSO 4: TESTES FUNCIONAIS (2 USUÁRIOS)

### 4.1. Criar Contas de Teste

**⚠️ Conectar app ao staging primeiro**:
```powershell
# Backup .env.local
Copy-Item .env.local .env.local.backup

# Usar .env.staging
Copy-Item .env.staging .env.local

# Iniciar app
npm run dev
```

**Acessar**: http://localhost:5173

#### Usuário A (Alice)
```
Email: alice.staging@test.com
Senha: Teste123!@#
Nome: Alice Teste
```

**Criar dados**:
1. Adicionar foto de perfil (JPG)
2. Criar 1 receita
3. Criar 1 despesa
4. Fazer logout

#### Usuário B (Bob)
```
Email: bob.staging@test.com
Senha: Teste456!@#
Nome: Bob Teste
```

**Verificar isolamento**:
1. Dashboard deve estar VAZIO
2. Não deve ver foto de Alice
3. Não deve ver receitas/despesas de Alice

### 4.2. Teste: Upload de Foto

**Como Alice**:

1. Ir em Meu perfil
2. Clicar no botão câmera
3. Aba "Enviar foto"
4. Selecionar foto JPG (< 5MB)
5. Clicar "Salvar foto"

**Verificar**:
- ✅ Upload bem-sucedido
- ✅ Foto exibe no perfil
- ✅ Foto exibe no Layout (sidebar)
- ✅ Foto exibe na página Mais

**Fazer logout e login novamente**:
- ✅ Foto persiste (não sumiu)

### 4.3. Teste: Substituição de Foto

**Como Alice**:

1. Meu perfil → câmera
2. Aba "Enviar foto"
3. Selecionar OUTRA foto
4. Clicar "Salvar foto"

**Verificar**:
- ✅ Foto antiga removida do storage
- ✅ Foto nova exibida
- ✅ Sem duplicatas no storage

### 4.4. Teste: Remoção de Foto

**Como Alice**:

1. Meu perfil → câmera
2. Aba "Usar iniciais"
3. Clicar "Usar iniciais"

**Verificar**:
- ✅ Foto removida
- ✅ Círculo vinho com iniciais "AT" exibido
- ✅ Storage limpo (foto deletada)

### 4.5. Teste: Escolha de Avatar

**Como Alice**:

1. Meu perfil → câmera
2. Aba "Escolher avatar"
3. Clicar em um dos 12 avatares
4. Confirmar

**Verificar**:
- ✅ Avatar selecionado exibido
- ✅ Avatar persiste após login
- ✅ Cores Vinho Premium preservadas

### 4.6. Teste: Isolamento RLS (CRÍTICO)

**Como Bob**:

1. Tentar acessar URL da foto de Alice (copiar do DevTools)
   ```
   https://[STAGING_REF].supabase.co/storage/v1/object/public/avatares/[ALICE_ID]/perfil-xxx.jpg
   ```

**Resultado esperado**:
- ❌ Erro 403 Forbidden
- ❌ Bob NÃO consegue ver foto de Alice

**Se Bob conseguir ver**:
- 🚨 **CRÍTICO**: RLS FALHOU
- ❌ Revisar políticas storage.objects
- ❌ NÃO PROSSEGUIR

### 4.7. Teste: Carrossel Horizontal

**Simular mobile** (F12 → Device Toolbar → iPhone 12):

1. Ir para Home
2. Localizar seção "Atalhos rápidos"
3. Deslizar horizontalmente (touch ou mouse)

**Verificar**:
- ✅ Desliza suavemente
- ✅ Snap de scroll funciona
- ✅ 4 cards visíveis: Simular compra, E se...?, Investimentos, Metas
- ✅ Scrollbar escondida
- ✅ Todos os 4 atalhos acessíveis

**Clicar em cada atalho**:
- ✅ Simular compra → /posso-comprar
- ✅ E se...? → /e-se
- ✅ Investimentos → /investimentos
- ✅ Metas → /metas

### 4.8. Teste: Login e Cadastro

**Novo usuário (Carol)**:

1. Fazer logout
2. Clicar "Criar conta"
3. Preencher dados
   ```
   Email: carol.staging@test.com
   Senha: Teste789!@#
   Nome: Carol Teste
   ```
4. Submeter

**Verificar**:
- ✅ Conta criada
- ✅ Login automático
- ✅ Perfil criado com colunas NULL (foto, avatar)
- ✅ Iniciais "CT" exibidas (fallback)
- ✅ App funciona normalmente

### 4.9. Teste: Perfis Antigos (Retrocompatibilidade)

**Simular perfil sem foto**:

```sql
-- SQL Editor
INSERT INTO public.perfis (id, nome, email, papel, ativo)
VALUES (
  gen_random_uuid(),
  'Usuário Antigo',
  'antigo@test.com',
  'user',
  true
);
-- Não preencher foto_url, avatar_id (NULL)
```

**Fazer login com essa conta** (criar senha via Dashboard):

**Verificar**:
- ✅ Login funciona
- ✅ Iniciais "UA" exibidas
- ✅ Pode adicionar foto depois
- ✅ App não quebra

---

## 🔧 PASSO 5: CORRIGIR AUTOMATICAMENTE

### 5.1. Se Testes SQL Falharem

**Identificar categoria**:
- Migration (1-10) → Problema em colunas/bucket/políticas
- RLS (11-25) → Problema em isolamento

**Ações**:
1. Ler mensagem de erro detalhada
2. Identificar política RLS ou constraint problemático
3. Corrigir no arquivo SQL original
4. Re-aplicar migration (BEGIN → migration → ROLLBACK para testar)
5. Re-executar teste específico
6. Verificar se correção não quebrou outros testes

### 5.2. Se Testes Funcionais Falharem

**Upload não funciona**:
- Verificar bucket 'avatares' existe
- Verificar políticas RLS storage.objects
- Verificar limite 5MB
- Verificar MIME types permitidos

**Isolamento falha**:
- 🚨 **CRÍTICO**: NÃO PROSSEGUIR
- Revisar `auth.uid()::text = (storage.foldername(name))[1]`
- Re-aplicar políticas
- Re-testar com 2 usuários

**Carrossel não desliza**:
- Verificar `overflow-x-auto` aplicado
- Verificar `snap-x snap-mandatory`
- Verificar `.scrollbar-hide` em index.css
- Testar em mobile real (não apenas DevTools)

### 5.3. Não Aplicar em Produção Sem Autorização

**❌ PROIBIDO**:
- Aplicar migration em produção automaticamente
- Alterar permissões de produção
- Copiar dados de usuários reais para staging

**✅ PERMITIDO**:
- Corrigir em staging
- Re-testar em staging
- Documentar correções

---

## 📦 PASSO 6: PREPARAR PRODUÇÃO

### 6.1. Se Todos os Testes Passaram (25/25 SQL + Funcionais)

**Executar**:

```powershell
# Reverter .env.local
Copy-Item .env.local.backup .env.local

# Build final
npm run build
```

**Resultado esperado**:
```
✓ 1643 modules transformed
✓ built in 6.06s
Exit Code: 0
```

### 6.2. Revisar Arquivos Modificados

```powershell
git status --short
```

**Esperado**:
```
M src/components/Layout.jsx
M src/contexts/AuthContext.jsx
M src/index.css
M src/pages/Dashboard.jsx
M src/pages/Mais.jsx
M src/pages/mais/Perfil.jsx
?? src/components/FotoPerfil.jsx
?? src/components/SeletorFotoPerfil.jsx
?? src/lib/avatares.js
?? supabase/migrations/2026-11_perfil_foto_avatar.sql
```

### 6.3. Preparar Commits

**Commit 1: Migration + Correção**:
```bash
git add supabase/migrations/2026-11_perfil_foto_avatar.sql
git add staging/CORRECAO-PERMISSOES-FOTO.sql
git commit -m "feat(db): adiciona suporte a foto e avatar no perfil

Migration 2026-11_perfil_foto_avatar.sql:
- Adiciona colunas foto_url, avatar_id, foto_atualizada_em
- Cria bucket privado 'avatares' com RLS
- 4 políticas isolam acesso por usuário
- Índices para performance

Correção de permissões:
- GRANT UPDATE em foto_url, avatar_id, foto_atualizada_em

Testado em staging:
- 10/10 testes de migration ✅
- 15/15 testes RLS ✅
- Upload, substituição, remoção ✅
- Isolamento entre usuários ✅"
```

**Commit 2: Componentes**:
```bash
git add src/lib/avatares.js src/components/FotoPerfil.jsx src/components/SeletorFotoPerfil.jsx
git commit -m "feat(ui): componentes de foto de perfil e avatares

- avatares.js: 12 avatares Vinho Premium + obterIniciais()
- FotoPerfil: exibição reutilizável (foto/avatar/iniciais)
- SeletorFotoPerfil: modal 3 abas (upload/avatar/iniciais)

Testado em staging:
- Upload JPG/PNG/WebP ✅
- Seleção dos 12 avatares ✅
- Fallback para iniciais ✅
- Persistência após login ✅"
```

**Commit 3: Integração**:
```bash
git add src/pages/mais/Perfil.jsx src/contexts/AuthContext.jsx src/components/Layout.jsx src/pages/Mais.jsx
git commit -m "feat(profile): integra foto de perfil em toda aplicação

- Perfil: botão câmera + modal SeletorFotoPerfil
- AuthContext: recarregarPerfil() após mudanças
- Layout: FotoPerfil no sidebar e header mobile
- Mais: FotoPerfil no topo

Testado em staging:
- Exibição em 4 locais ✅
- Atualização em tempo real ✅
- Compatível com perfis antigos ✅"
```

**Commit 4: Carrossel**:
```bash
git add src/pages/Dashboard.jsx src/index.css
git commit -m "fix(ui): restaura carrossel horizontal de atalhos na Home

- Dashboard: grid → flex overflow-x-auto snap-x
- index.css: adiciona .scrollbar-hide
- 4 atalhos preservados: Simular, E se, Investimentos, Metas

Testado em staging:
- Scroll horizontal mobile ✅
- Snap de scroll ✅
- Todos os 4 atalhos acessíveis ✅
- Navegação funcional ✅"
```

### 6.4. Documentar Ordem de Aplicação em Produção

**Criar**: `DEPLOY-PRODUCAO-ORDEM.md`

```markdown
# ORDEM DE DEPLOYMENT EM PRODUÇÃO

## PASSO 1: Aplicar Migrations (SQL Editor)

1. `supabase/migrations/2026-11_perfil_foto_avatar.sql`
2. `staging/CORRECAO-PERMISSOES-FOTO.sql`

## PASSO 2: Validar (SQL Editor)

```sql
-- Verificar colunas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'perfis' 
AND column_name IN ('foto_url', 'avatar_id', 'foto_atualizada_em');

-- Verificar bucket
SELECT * FROM storage.buckets WHERE id = 'avatares';

-- Verificar permissões
SELECT column_name FROM information_schema.column_privileges
WHERE table_name = 'perfis' AND grantee = 'authenticated' 
AND privilege_type = 'UPDATE' AND column_name = 'foto_url';
```

## PASSO 3: Git Push

```bash
git push origin main
```

## PASSO 4: Aguardar Deploy Vercel

- Tempo: ~90 segundos
- URL: https://almeida-finance.vercel.app

## PASSO 5: Testar em Produção

- Upload foto
- Seleção avatar
- Carrossel mobile
- Login/cadastro
```

### 6.5. Preparar Plano de Recuperação

**Criar**: `ROLLBACK-PRODUCAO.md`

```markdown
# PLANO DE ROLLBACK EM PRODUÇÃO

## Se Migration Falhar:

```sql
-- Remover colunas
ALTER TABLE public.perfis 
  DROP COLUMN foto_url,
  DROP COLUMN avatar_id,
  DROP COLUMN foto_atualizada_em;

-- Remover bucket (⚠️ deleta fotos!)
DELETE FROM storage.buckets WHERE id = 'avatares';
```

## Se Deployment Falhar:

1. Vercel Dashboard → Deployments
2. Encontrar deployment anterior (commit 45346a8)
3. Clicar "..." → "Redeploy"

## Se Upload Não Funcionar:

- Verificar bucket criado
- Verificar políticas RLS
- Verificar permissões GRANT UPDATE
```

---

## 📊 PASSO 7: RELATÓRIO FINAL

### 7.1. Template do Relatório

```markdown
# RELATÓRIO DE VALIDAÇÃO - STAGING

## Testes SQL Automatizados

### Migration (10 testes)
- ✅ TESTE 1: Colunas adicionadas
- ✅ TESTE 2: Tipos corretos
- ✅ TESTE 3: Bucket criado
- ✅ TESTE 4: Políticas RLS bucket
- ✅ TESTE 5: Índices criados
- ✅ TESTE 6: Compatibilidade perfis existentes
- ✅ TESTE 7: UPDATE foto_url
- ✅ TESTE 8: UPDATE avatar_id
- ✅ TESTE 9: Remoção foto (NULL)
- ✅ TESTE 10: SELECT não interferido

**Resultado**: 10/10 PASSOU ✅

### RLS Foto/Avatar (15 testes)
- ✅ TESTE 1-6: Usuário atualiza/vê próprio perfil
- ✅ TESTE 2,4: Isolamento entre usuários
- ✅ TESTE 7: Admin vê todos
- ✅ TESTE 8-13: Storage isolamento
- ✅ TESTE 14-15: Anon bloqueado

**Resultado**: 15/15 PASSOU ✅

**Total**: 25/25 PASSOU (100%) ✅

## Testes Funcionais

### Upload de Foto
- ✅ Upload JPG bem-sucedido
- ✅ Foto exibe em 4 locais
- ✅ Foto persiste após login
- ✅ Substituição remove foto antiga
- ✅ Remoção limpa storage

### Seleção de Avatar
- ✅ 12 avatares disponíveis
- ✅ Cores Vinho Premium preservadas
- ✅ Avatar persiste após login
- ✅ Troca entre avatar/foto funciona

### Isolamento RLS
- ✅ Usuário A NÃO vê foto de B
- ✅ Usuário B NÃO vê perfil de A
- ✅ Storage retorna 403 Forbidden
- ✅ Admin vê todos os perfis

### Carrossel
- ✅ Scroll horizontal funciona
- ✅ Snap de scroll ativo
- ✅ 4 atalhos acessíveis
- ✅ Navegação funcional
- ✅ Mobile e desktop OK

### Login/Cadastro
- ✅ Login não quebrou
- ✅ Cadastro funciona
- ✅ Perfis antigos compatíveis
- ✅ Iniciais como fallback

## Supabase (Staging)
- ✅ Projeto: almeida-finance-staging
- ✅ 22 tabelas criadas
- ✅ Bucket 'avatares' privado
- ✅ 4 políticas RLS ativas
- ✅ Permissões GRANT corretas

## Build
- ✅ npm run build: 0 erros
- ✅ 1643 modules transformed
- ✅ Tempo: 6.06s

## Pendências
- ⚠️ Schema.sql linha 13 (não crítico)
- ✅ Todas as outras validações OK

## Confirmação
✅ Versão PRONTA PARA PRODUÇÃO
✅ Nenhum problema crítico detectado
✅ Todos os testes passaram
✅ Dados financeiros preservados
✅ Isolamento RLS validado

## Próximo Passo
Aplicar em produção seguindo DEPLOY-PRODUCAO-ORDEM.md
```

### 7.2. Checklist Final

**Antes de Aprovar para Produção**:

- [ ] 25/25 testes SQL passaram
- [ ] Upload foto testado (3 usuários)
- [ ] Isolamento RLS validado (Bob não vê Alice)
- [ ] Carrossel testado mobile
- [ ] Login/cadastro não quebrou
- [ ] Build bem-sucedido
- [ ] Commits preparados
- [ ] Ordem de deployment documentada
- [ ] Plano de rollback preparado
- [ ] .env.local revertido para produção

**Se TODOS marcados** ✅:
- ✅ **APROVAR PARA PRODUÇÃO**

**Se ALGUM desmarcado** ❌:
- ❌ **NÃO APROVAR**
- 🔧 Corrigir problema em staging
- 🔄 Re-testar até 100%

---

## 🎯 STATUS ATUAL

### Completado
- [x] Auditoria final
- [x] Análise Git (carrossel 4 cards preservados)
- [x] Build bem-sucedido (6.06s, 0 erros)
- [x] 25 testes SQL criados
- [x] Correção de permissões criada
- [x] Plano de execução documentado

### Aguardando Execução
- [ ] Criar projeto staging no Supabase
- [ ] Aplicar schema completo
- [ ] Aplicar migration foto/avatar
- [ ] Aplicar correção permissões
- [ ] Executar 25 testes SQL
- [ ] Criar 2 contas de teste
- [ ] Testar upload/avatar/carrossel
- [ ] Validar isolamento RLS
- [ ] Gerar relatório final
- [ ] Aprovar para produção

### Próxima Ação Imediata

**⚠️ AÇÃO MANUAL NECESSÁRIA**:

```
1. Acessar https://supabase.com/dashboard
2. Criar projeto "almeida-finance-staging"
3. Anotar credenciais (URL, anon key)
4. Informar aqui para continuar
```

**Após criação do staging**, continuarei automaticamente com:
- Aplicação do schema
- Execução dos testes
- Validação completa

---

**Aguardando**: Criação do projeto staging no Supabase Dashboard

**Tempo estimado total**: 30-60 minutos (inclui criação + testes)

**Prioridade**: Segurança e preservação de dados financeiros ✅

