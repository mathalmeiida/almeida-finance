# 🚀 GUIA DE IMPLANTAÇÃO EM PRODUÇÃO — RPC TRANSACIONAL

**Data:** 06/11/2026  
**Commit:** `c272819`  
**Projeto Supabase:** `ievccupeijzuzhomphwn.supabase.co`  
**Site oficial:** https://almeida-finance.vercel.app  

---

## ⚠️ IMPORTANTE: SIGA ESTA ORDEM RIGOROSAMENTE

1. **PRIMEIRO:** Aplicar migration no Supabase (cria a RPC)
2. **VALIDAR:** Confirmar que a função existe
3. **DEPOIS:** Push do código (frontend depende da RPC)

**❌ NÃO publicar frontend sem a RPC → botão "Apagar dados financeiros" falhará**

---

## 📋 PASSO 1: APLICAR MIGRATION NO SUPABASE

### 1.1 Acesse o Supabase Dashboard

1. Abra: https://supabase.com/dashboard
2. Faça login
3. Selecione o projeto: **`ievccupeijzuzhomphwn`**
4. Menu lateral > **SQL Editor**
5. Clique em **New query**

### 1.2 Cole a Migration SQL

**Abra o arquivo:**  
`supabase/migrations/2026-11_rpc_zerar_dados_financeiros.sql`

**Cole TODO o conteúdo** (do início ao fim, 255 linhas)

### 1.3 Execute a Migration

1. Clique no botão **Run** (canto superior direito)
2. Aguarde a mensagem de sucesso: **"Success. No rows returned"**

**Se houver erro:**
- Leia a mensagem de erro
- Copie o erro completo
- **NÃO CONTINUE** antes de resolver
- Informe o erro para análise

---

## 📋 PASSO 2: VALIDAR QUE A RPC FOI CRIADA

### 2.1 Confirmar Existência da Função

No mesmo **SQL Editor**, execute esta query de validação:

```sql
SELECT 
  p.proname AS nome_funcao,
  CASE 
    WHEN p.prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END AS tipo_seguranca,
  pg_get_functiondef(p.oid) AS definicao
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'zerar_dados_financeiros';
```

**Resultado esperado:**

| nome_funcao | tipo_seguranca | definicao |
|-------------|----------------|-----------|
| zerar_dados_financeiros | SECURITY INVOKER | CREATE OR REPLACE FUNCTION public.zerar_dados_financeiros()... |

**Se retornar 0 linhas:**
- ❌ A função NÃO foi criada
- Volte ao Passo 1 e verifique se a migration foi executada
- **NÃO CONTINUE** antes de resolver

**Se retornar 1 linha:**
- ✅ Função criada com sucesso
- ✅ Tipo de segurança correto (SECURITY INVOKER)
- ✅ Prossiga para o Passo 3

### 2.2 Confirmar Grants Corretos

Execute esta query:

```sql
SELECT 
  grantee AS role,
  privilege_type AS permissao
FROM information_schema.routine_privileges
WHERE routine_name = 'zerar_dados_financeiros'
  AND routine_schema = 'public';
```

**Resultado esperado:**

| role | permissao |
|------|-----------|
| authenticated | EXECUTE |
| postgres | EXECUTE |

**Validação:**
- ✅ `authenticated` role **DEVE** ter `EXECUTE`
- ✅ `anon` role **NÃO DEVE** aparecer (foi revogado)

---

## 📋 PASSO 3: TESTE DE SEGURANÇA (OPCIONAL MAS RECOMENDADO)

### 3.1 Teste com Conta de Teste (NÃO use conta real)

**⚠️ ATENÇÃO:** Este teste **EXCLUI DADOS REAIS**. Use apenas conta de teste.

1. Crie uma conta de teste no app: `teste-rpc@teste.com`
2. Popule com dados fictícios:
   - 2 receitas
   - 3 despesas
   - 1 cartão
   - 1 investimento

3. No Supabase SQL Editor, execute (logado como a conta de teste):

```sql
-- IMPORTANTE: Substitua 'test-user-uuid' pelo UUID real da conta de teste
-- Encontre o UUID em: Authentication > Users > clique no usuário > copie o ID

-- Verificar dados ANTES da exclusão:
SELECT 
  (SELECT COUNT(*) FROM receitas WHERE usuario_id = 'test-user-uuid') AS receitas,
  (SELECT COUNT(*) FROM despesas WHERE usuario_id = 'test-user-uuid') AS despesas,
  (SELECT COUNT(*) FROM cartoes WHERE usuario_id = 'test-user-uuid') AS cartoes;

-- Executar a RPC (como o usuário de teste):
SELECT public.zerar_dados_financeiros();

-- Verificar dados DEPOIS da exclusão (deve retornar 0, 0, 0):
SELECT 
  (SELECT COUNT(*) FROM receitas WHERE usuario_id = 'test-user-uuid') AS receitas,
  (SELECT COUNT(*) FROM despesas WHERE usuario_id = 'test-user-uuid') AS despesas,
  (SELECT COUNT(*) FROM cartoes WHERE usuario_id = 'test-user-uuid') AS cartoes;
```

**Resultado esperado:**
- **ANTES:** Números maiores que 0
- **DEPOIS:** Todos 0 (dados excluídos)
- **Usuário continua logado** (sessão preservada)

**Se o teste falhar:**
- ❌ **NÃO PROSSIGA**
- Analise o erro
- Reverta a migration se necessário:
  ```sql
  DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
  ```

---

## 📋 PASSO 4: PUSH DO CÓDIGO (APÓS VALIDAÇÕES)

### 4.1 Confirmar Estado do Repositório

Volte ao terminal do projeto:

```powershell
cd "C:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
git status
git log --oneline -3
```

**Confirmar:**
- ✅ Branch: `main`
- ✅ HEAD: `c272819` (RPC transacional implementada)
- ✅ 2 commits à frente de `origin/main`

### 4.2 Executar Push

```powershell
git push origin main
```

**Acompanhe a saída:**
```
Enumerating objects: X, done.
Counting objects: 100% (X/X), done.
Delta compression using up to Y threads
Compressing objects: 100% (X/X), done.
Writing objects: 100% (X/X), X.XX KiB | X.XX MiB/s, done.
Total X (delta X), reused X (delta X), pack-reused 0
To https://github.com/seu-usuario/posso-comprar.git
   e008a2e..c272819  main -> main
```

**Se houver erro de push:**
- Verifique se tem permissão de escrita no repositório
- Se necessário, faça `git pull origin main` primeiro

---

## 📋 PASSO 5: ACOMPANHAR DEPLOY DA VERCEL

### 5.1 Acesse o Dashboard da Vercel

1. Abra: https://vercel.com/dashboard
2. Projetos > **almeida-finance**
3. Aguarde o deploy automático iniciar

### 5.2 Monitore o Deploy

**Status esperado:**
1. **Building** (2-3 minutos)
2. **Deploying** (30-60 segundos)
3. **Ready** ✅

**Se o deploy falhar:**
- Clique no deploy falhado
- Veja os logs de erro
- Se for erro de build:
  - Volte ao código local
  - Execute `npm run build` para reproduzir o erro
  - Corrija e faça novo push

### 5.3 Confirmar Deploy Bem-Sucedido

Abra: **https://almeida-finance.vercel.app**

**Validação visual:**
- ✅ Site carrega sem erro 404
- ✅ Login funciona
- ✅ Home carrega

**Validação técnica (DevTools):**
1. Pressione `F12` (DevTools)
2. Aba **Console**
3. Não deve haver erros críticos (vermelho)

---

## 📋 PASSO 6: VALIDAÇÃO FINAL DA RPC EM PRODUÇÃO

### 6.1 Teste de Integração (sem exclusão real)

**NÃO execute a exclusão em conta real ainda.**

1. Abra DevTools (F12)
2. Aba **Console**
3. Execute este teste (não exclui nada):

```javascript
// Verificar se a RPC está acessível
const { data, error } = await supabase
  .rpc('zerar_dados_financeiros')

if (error) {
  console.error('Erro na RPC:', error.message)
  // Se erro: "function zerar_dados_financeiros does not exist"
  // → Migration não foi aplicada ou Vercel não atualizou
} else {
  console.log('RPC executou com sucesso:', data)
  // ATENÇÃO: Se chegou aqui, os dados FORAM EXCLUÍDOS!
  // Use apenas em conta de teste
}
```

**⚠️ IMPORTANTE:**  
Este código **EXCLUI DADOS REAIS** se executado em conta autenticada.  
**Use apenas em conta de teste** ou valide de outra forma.

### 6.2 Alternativa Segura: Validar Sem Executar

Inspecione o código JavaScript da aplicação:

1. DevTools (F12) > Aba **Sources**
2. Procure por: `assets/index-BWOC64oH.js`
3. Busque (Ctrl+F): `zerar_dados_financeiros`
4. Confirme que o código chama: `supabase.rpc('zerar_dados_financeiros')`

**Se encontrar:**
- ✅ Frontend atualizado corretamente
- ✅ Integração com RPC implementada

---

## 📋 PASSO 7: VALIDAÇÃO DE FUNCIONALIDADES

### 7.1 Teste de Navegação (Desktop)

Acesse: https://almeida-finance.vercel.app

**Testar:**
- [ ] Login e cadastro funcionam
- [ ] Home carrega corretamente
- [ ] Receitas: criar, editar, excluir
- [ ] Despesas: criar, editar, excluir
- [ ] Cartões: criar, adicionar compra
- [ ] Investimentos: criar posição, aporte
- [ ] Menu lateral: **Importação e Central de Importação estão na seção Conta** ✅
- [ ] Configurações > "Apagar dados financeiros" (NÃO executar ainda)

### 7.2 Teste Mobile/PWA

1. Abra no celular: https://almeida-finance.vercel.app
2. Instale o PWA (Chrome: Menu > Adicionar à tela inicial)
3. Teste navegação:
   - [ ] Home carrega
   - [ ] Menu hamburguer funciona
   - [ ] **Importação e Central estão em Conta** ✅

---

## 📋 PASSO 8: TESTE FINAL DA EXCLUSÃO (CONTA DE TESTE)

### 8.1 Criar Usuário de Teste Dedicado

1. Crie: `teste-exclusao-final@teste.com`
2. Popule com dados completos:
   - 3 receitas
   - 5 despesas
   - 2 cartões
   - 3 compras no cartão
   - 1 investimento
   - 1 meta
   - Importar 1 extrato bancário

### 8.2 Executar Exclusão

1. Logar como `teste-exclusao-final@teste.com`
2. Configurações > **Apagar dados financeiros**
3. Confirmar no modal
4. Aguardar mensagem de sucesso

### 8.3 Validar Exclusão

**Imediatamente após:**
- [ ] Saldo = Não configurado (null)
- [ ] Receitas = 0
- [ ] Despesas = 0
- [ ] Cartões = 0
- [ ] Investimentos = 0
- [ ] Metas = 0
- [ ] Importações = 0
- [ ] **Usuário continua logado** ✅
- [ ] **Tema preservado** ✅
- [ ] **Nome e email preservados** ✅

**Após refresh (F5):**
- [ ] Dados continuam zerados (não reaparecem)

**Após logout/login:**
- [ ] Dados continuam zerados
- [ ] Onboarding é exibido novamente

---

## 📋 PASSO 9: RELATÓRIO FINAL

### 9.1 Dados para Documentar

**Commit publicado:**
```
c272819 — feat(exclusão): implementa RPC transacional para zerar dados financeiros
```

**Migration aplicada:**
```sql
2026-11_rpc_zerar_dados_financeiros.sql
✅ Função public.zerar_dados_financeiros() criada
✅ SECURITY INVOKER (RLS automático)
✅ Grants: authenticated ✅ | anon ❌
```

**Build:**
```
✓ built in 7.48s
Bundle: 334.75 kB gzip
```

**Testes:**
```
12/12 arquivos passaram
367 testes individuais
✅ 100% de sucesso
```

**Deploy Vercel:**
```
Status: Ready ✅
URL: https://almeida-finance.vercel.app
Hash JS: index-BWOC64oH.js
```

**Funcionalidades validadas:**
- [ ] Login/cadastro
- [ ] Onboarding
- [ ] Home
- [ ] Receitas e despesas
- [ ] Cartões e parcelamentos
- [ ] Investimentos
- [ ] Simuladores (compra, custo de vida, E SE)
- [ ] VR e VA
- [ ] Importação inteligente
- [ ] Menu reorganizado (Importação → Conta) ✅
- [ ] Exclusão RPC transacional ✅
- [ ] PWA mobile

**Teste de exclusão (conta de teste):**
- [ ] Dados financeiros excluídos ✅
- [ ] Conta preservada ✅
- [ ] Rollback funciona (se houver erro) ✅
- [ ] Isolamento entre usuários ✅

**Dados financeiros existentes:**
- [ ] ✅ Preservados (nenhum usuário real foi afetado)

---

## ⚠️ SE ALGO FALHAR

### Rollback da Migration (Supabase)

```sql
-- SQL Editor > New query
DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
```

### Rollback do Frontend (Git)

```powershell
git revert c272819
git push origin main
```

**Aguardar novo deploy da Vercel (volta para versão anterior)**

---

## ✅ CHECKLIST FINAL

### Pré-Implantação
- [x] Commit c272819 confirmado
- [x] Migration auditada e aprovada
- [x] Build passou (7.48s)
- [x] Testes 12/12 passaram

### Implantação
- [ ] Migration aplicada no Supabase
- [ ] RPC validada (SELECT proname...)
- [ ] Push executado (git push origin main)
- [ ] Deploy Vercel concluído

### Pós-Implantação
- [ ] Site acessível (https://almeida-finance.vercel.app)
- [ ] Funcionalidades testadas
- [ ] RPC integrada ao frontend
- [ ] Teste de exclusão com conta fictícia

### Validação Final
- [ ] Dados financeiros existentes preservados
- [ ] Menu reorganizado visível
- [ ] PWA funcionando
- [ ] Nenhum erro crítico no console

---

**IMPORTANTE: Documente qualquer desvio deste guia ou erro encontrado.**

**Após completar TODOS os passos, o sistema estará em produção com a RPC transacional.**
