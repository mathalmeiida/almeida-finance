# 🚀 INSTRUÇÕES: TAREFAS PENDENTES - AUDITORIA SEGURANÇA

**Data:** 06 de Novembro de 2026  
**Status:** Código pronto, aguarda execução no Supabase

---

## 📊 RESUMO DO QUE JÁ FOI FEITO

✅ **Concluído:**
- Atualização Supabase JS 2.119.0 (suporte passkeys)
- Token BRAPI removido do frontend
- Edge Function `buscar-cotacoes` criada (212 linhas)
- Script de teste RLS com 60 testes (pgTAP) criado
- Migration categorias receita criada
- Build limpo: 46/46 testes passando
- 9 commits com histórico completo

---

## ⚠️ TAREFAS PENDENTES (Requerem Acesso ao Supabase)

### 1️⃣ INSTALAR pgTAP NO BANCO DE DADOS

**Obrigatório para rodar testes RLS automatizados**

#### Passos:

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecionar projeto: **ievccupeijzuzhomphwn**
3. Menu lateral → **SQL Editor**
4. Clicar em **"New query"**
5. Colar o comando:

```sql
CREATE EXTENSION IF NOT EXISTS pgtap;
```

6. Clicar em **"Run"** (ou pressionar Ctrl+Enter)
7. Verificar output: `CREATE EXTENSION` ou `extension "pgtap" already exists`

#### Verificar se instalou:

```sql
SELECT * FROM pg_available_extensions WHERE name = 'pgtap';
```

Esperado: 1 linha com `name = pgtap` e `installed_version` preenchido.

---

### 2️⃣ EXECUTAR TESTES RLS AUTOMATIZADOS

**60 testes de isolamento entre usuários**

#### Método A: Via Dashboard (Recomendado)

1. Abrir arquivo: `supabase/tests/rls-security.test.sql`
2. Copiar TODO o conteúdo (Ctrl+A → Ctrl+C)
3. Supabase Dashboard → **SQL Editor** → **New query**
4. Colar conteúdo completo
5. Clicar em **"Run"**
6. Aguardar 10-30 segundos (cria usuários teste, executa 60 testes, limpa dados)

#### Resultado Esperado:

```
1..60
ok 1 - Alice vê seu próprio perfil
ok 2 - Alice NÃO vê perfil de Bob
ok 3 - Alice vê apenas 1 receita (a dela)
...
ok 58 - Bob NÃO vê fatura informada de Alice
ok 59 - Bob NÃO vê movimentação de benefício de Alice
ok 60 - Limpeza completa dos dados de teste
```

#### ✅ Se todos passarem:

**RLS VALIDADO** - Sistema seguro para múltiplos usuários.

#### 🔴 Se algum falhar:

```
not ok 15 - Alice NÃO vê receita de Bob
# Failed test 15
# Expected: 0 rows
# Got: 1 row
```

**CRÍTICO:** Política RLS está incorreta. NÃO PUBLICAR até corrigir.

#### Método B: Via Supabase CLI (Avançado)

```bash
cd posso-comprar

# Instalar CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Vincular projeto
supabase link --project-ref ievccupeijzuzhomphwn

# Executar testes
supabase test db
```

---

### 3️⃣ APLICAR MIGRATION: CATEGORIAS RECEITA EXPANDIDAS

**Adiciona 14 novas categorias de receita**

#### Passos:

1. Abrir arquivo: `supabase/migrations/2026-11_categorias_receita_expandidas.sql`
2. Copiar TODO o conteúdo
3. Supabase Dashboard → **SQL Editor** → **New query**
4. Colar conteúdo
5. Clicar em **"Run"**

#### Resultado Esperado:

```
INSERT 0 14
```

Ou se já aplicada:

```
INSERT 0 0
```

Ambos estão corretos (migration é idempotente).

#### Verificar se aplicou:

```sql
SELECT COUNT(*) FROM categorias WHERE tipo = 'receita';
```

Esperado: pelo menos 14 categorias de receita.

---

### 4️⃣ DEPLOY EDGE FUNCTION: BUSCAR-COTACOES

**Protege token BRAPI no backend**

#### Pré-requisito:

Ter token BRAPI válido. Se não tiver:
- Criar conta em: https://brapi.dev/
- Gerar token gratuito (50 requisições/dia)

#### Passos:

```bash
cd posso-comprar

# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Login
supabase login

# Vincular projeto
supabase link --project-ref ievccupeijzuzhomphwn

# Configurar secret (substitua SEU_TOKEN_AQUI)
supabase secrets set BRAPI_TOKEN=seu_token_real_da_brapi

# Deploy da função
supabase functions deploy buscar-cotacoes

# Verificar logs
supabase functions logs buscar-cotacoes --follow
```

#### Testar Edge Function:

```bash
# Via curl (substitua ANON_KEY pela chave do .env.local)
curl -X POST https://ievccupeijzuzhomphwn.supabase.co/functions/v1/buscar-cotacoes \
  -H "Authorization: Bearer ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"simbolo":"PETR4"}'
```

Esperado:
```json
{
  "simbolo": "PETR4",
  "preco": 38.45,
  "variacao": 1.23,
  "moeda": "BRL"
}
```

---

### 5️⃣ ATIVAR PASSKEYS (BIOMETRIA)

**Suporte a Face ID, Touch ID, Windows Hello**

#### Passos:

1. Supabase Dashboard → **Authentication** → **Passkeys**
2. Toggle **"Enable Passkey authentication"** → **ON**
3. Configurar:
   - **Relying Party Display Name:** `Almeida Finance`
   - **Relying Party ID:** `seu_dominio.com` (ex: `almeidafinance.com`, SEM www)
   - **Relying Party Origins:** Lista de origens permitidas:
     - `https://almeidafinance.com`
     - `https://www.almeidafinance.com`
     - `http://localhost:5173` (para desenvolvimento)
4. Clicar em **Save**

#### ⚠️ IMPORTANTE:

- Relying Party ID **DEVE SER** o domínio raiz (sem subdomain)
- Não funciona em `localhost` (apenas HTTP permitido para dev)
- Funciona em HTTPS (produção) ou HTTP localhost (desenvolvimento)

#### Testar Passkey:

1. Abrir app em **dispositivo físico** (iPhone, Android, Windows)
2. Login com conta existente
3. Menu → **Configurações** → seção **Biometria**
4. Clicar em **"Cadastrar Biometria"**
5. Navegador pede permissão → **Permitir**
6. Seguir prompt do dispositivo (Face ID, Touch ID, PIN)
7. Logout
8. Tela de login → clicar em **"Entrar com Biometria"**
9. Confirmar biometria → deve entrar sem senha

---

### 6️⃣ CONFIGURAR NOTIFICAÇÕES PUSH (OPCIONAL)

**Requer chave VAPID privada**

#### Gerar chave VAPID (se não tiver):

```bash
cd posso-comprar
node scripts/gerar-vapid.mjs
```

Output:
```
Public Key: BNx...abc (já está no .env.local)
Private Key: xyz...123 (GUARDAR COM SEGURANÇA)
```

#### Configurar no Supabase:

```bash
supabase secrets set VAPID_PRIVATE_KEY=xyz...123
```

---

## 📋 CHECKLIST FINAL

### Antes de Publicar

- [ ] ✅ pgTAP instalado no banco de dados
- [ ] ✅ 60/60 testes RLS passando
- [ ] ✅ Migration categorias receita aplicada
- [ ] ✅ Edge Function `buscar-cotacoes` deployada
- [ ] ✅ Token BRAPI configurado como secret
- [ ] ✅ Passkeys habilitado no Dashboard
- [ ] ✅ Testado passkey em 1 dispositivo real
- [ ] ⚪ VAPID private key configurado (opcional)

### Teste Manual RLS (CRÍTICO)

**Obrigatório antes de liberar para novos usuários:**

1. Criar 2 contas reais: `alice@test.com` e `bob@test.com`
2. **Login como Alice:**
   - Criar 1 receita: "Salário Alice" R$ 5.000
   - Criar 1 despesa: "Aluguel Alice" R$ 1.200
   - Criar 1 cartão: "Nubank Alice"
3. **Logout → Login como Bob:**
   - Dashboard → Verificar que **NÃO VÊ** dados de Alice ✅
4. **Bob cria:**
   - 1 receita: "Freelance Bob" R$ 3.000
5. **Logout → Login como Alice:**
   - Verificar Dashboard → **NÃO DEVE VER** receita de Bob ✅

Se isolamento funcionar → **DEPLOY AUTORIZADO** ✅

---

## 🔒 GARANTIAS DE SEGURANÇA

### ✅ O Que Foi Validado

1. **Código:** Auditado e correto (padrões Supabase)
2. **Tokens:** Nenhum exposto no frontend
3. **Build:** Limpo, 46/46 testes passando
4. **Namespace passkeys:** Corrigido (`auth.passkey`)
5. **Edge Function:** Criada com rate limiting
6. **Contas existentes:** Preservadas (nenhum DELETE)

### ⚠️ O Que Precisa Validação

1. **RLS:** Script criado, mas não executado no banco
2. **Passkeys:** Código correto, mas não testado em dispositivo
3. **Edge Function:** Criada, mas não deployada
4. **Notificações:** Infraestrutura pronta, mas sem chave privada

---

## 📞 SUPORTE

### Erros Comuns

#### 1. "extension pgtap is not available"

**Causa:** pgTAP não disponível no plano Supabase.

**Solução:**
- Plano Free: Contatar Supabase Support
- Plano Pro+: Instalar via SQL Editor

#### 2. "new row violates row-level security policy"

**Interpretação:**
- Em teste **negativo** (ex: Alice tentando criar para Bob) → ✅ **CORRETO**
- Em teste **positivo** (ex: Alice criando para si) → ❌ **FALHA**

#### 3. "Edge Function timeout"

**Causa:** BRAPI demorando muito (rede lenta).

**Solução:** Aumentar timeout na função (padrão: 10s).

---

## 🎯 PRÓXIMOS PASSOS

### Prioridade 1 (HOJE - 30 minutos)
1. Instalar pgTAP (2 min)
2. Executar testes RLS (10 min)
3. Aplicar migration categorias (1 min)
4. Deploy Edge Function (5 min)
5. Ativar passkeys (2 min)
6. Teste manual RLS com 2 contas (10 min)

### Prioridade 2 (ESTA SEMANA)
7. Testar passkey em dispositivo iOS (10 min)
8. Testar passkey em dispositivo Android (10 min)
9. Configurar VAPID private key (2 min)

### Prioridade 3 (OPCIONAL)
10. Testar notificação push real
11. Code splitting (reduzir chunk de 1.16 MB)

---

## 🏆 RESULTADO ESPERADO

### ✅ Se Todos os Testes Passarem:

**STATUS:** 🟢 **APROVADO PARA PRODUÇÃO**

### 🔴 Se Algum Teste Falhar:

**STATUS:** 🔴 **BLOQUEADO**

Revisar políticas RLS no banco de dados antes de publicar.

---

**Gerado em:** 06 de Novembro de 2026  
**Última alteração código:** commit `docs: relatorio final de validacao com evidencias completas`  
**Build status:** ✅ APROVADO (Exit Code 0, 46/46 testes)  
**Créditos Kiro economizados:** Trabalho focado em pendências reais

