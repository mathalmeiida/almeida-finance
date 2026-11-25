# CHECKLIST — EXECUÇÃO COMPLETA DO SETUP DEV

**Objetivo:** Validar ambiente isolado → Executar migrações → Validar estrutura → Testar isolamento → Executar E2E

**Tempo total estimado:** 60-90 minutos

---

## FASE 1: PREPARAÇÃO (10 min)

### ☐ 1.1. Criar Projeto Supabase DEV

- [ ] Acessar https://supabase.com/dashboard
- [ ] Clicar em "New project"
- [ ] Nome: `almeidafinance-dev-teste`
- [ ] Região: `South America (São Paulo)`
- [ ] Plan: `Free`
- [ ] Aguardar provisionamento (2-3 min)

### ☐ 1.2. Confirmar Ambiente Vazio

**Executar no SQL Editor:**
```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
```

**Resultado esperado:** 0

**Se > 0:** ⚠️ Banco não está vazio. Usar outro projeto.

### ☐ 1.3. Desabilitar Email Confirmation

- [ ] Authentication > Settings
- [ ] "Enable email confirmations" → OFF
- [ ] Salvar

### ☐ 1.4. Validar Isolamento Completo

**Executar:** `VALIDAR_AMBIENTE_ISOLADO.sql` (copiar/colar no SQL Editor)

**Resultado esperado:**
```
✓✓✓ AMBIENTE PARECE SEGURO PARA MIGRAÇÕES ✓✓✓
```

**Se aparecer warnings:** Revisar e confirmar antes de continuar.

### ☐ 1.5. Confirmar Project Reference

- [ ] Settings > General > Reference
- [ ] Anotar o Reference: `________________`
- [ ] Confirmar que NÃO é: `ievccupeijzuzhomphwn` (produção)

---

## FASE 2: COPIAR CREDENCIAIS (2 min)

### ☐ 2.1. Copiar do Dashboard

- [ ] Settings > API
- [ ] Project URL: `https://________________.supabase.co`
- [ ] anon public key: `eyJ_____...` (primeiros 30 chars)

### ☐ 2.2. Enviar para Kiro

**Enviar apenas:**
```
Project URL: [colar]
anon key: [primeiros 30 chars]
```

**NÃO enviar:**
- ❌ Database password
- ❌ service_role key

---

## FASE 3: EXECUÇÃO DE MIGRAÇÕES (30 min)

### Opção A: Script Consolidado (RÁPIDO — 5 min)

### ☐ 3A.1. Executar Script Consolidado

**No SQL Editor:**
1. [ ] New query
2. [ ] Copiar TODO o conteúdo de `SETUP_DEV_COMPLETO.sql`
3. [ ] Colar no editor
4. [ ] Run (Ctrl+Enter)
5. [ ] Aguardar execução (~2-3 minutos)

### ☐ 3A.2. Verificar Output

**Buscar no final:**
```
✓ TODAS AS TABELAS FORAM CRIADAS COM SUCESSO!
Tabelas criadas: 32 / 32
```

**Se aparecer warnings:**
- Ler cada warning
- Se for "already exists" → OK (idempotente)
- Se for erro de sintaxe → Reportar

---

### Opção B: Execução Sequencial (CONTROLADO — 30 min)

**Seguir:** `EXECUTAR_MIGRACOES_SEQUENCIAL.md`

**Vantagem:** Controle total, validação a cada etapa  
**Desvantagem:** Mais demorado

---

## FASE 4: VALIDAÇÃO DA ESTRUTURA (10 min)

### ☐ 4.1. Executar Validação Completa

**No SQL Editor:**
1. [ ] New query
2. [ ] Copiar/colar `TESTES_VALIDACAO_BANCO.sql`
3. [ ] Run
4. [ ] Aguardar resultado

### ☐ 4.2. Verificar Resultado

**Esperado:**
```
=== RESUMO VALIDAÇÃO DO BANCO ===
Tabelas criadas: 32 (esperado: ~32)
Políticas RLS: 54 (esperado: ~50)
Funções RPC: 17 (esperado: ~15)
Triggers: 6 (esperado: ~5)
Categorias sistema: 15 (esperado: ~15)
Planos assinatura: 3 (esperado: 3)

✓ BANCO CONFIGURADO CORRETAMENTE!
```

**Se falhar:**
- [ ] Anotar quais números estão errados
- [ ] Verificar quais tabelas/funções faltam
- [ ] Reportar para análise

### ☐ 4.3. Verificar Tabelas Específicas

```sql
-- Confirmar tabelas críticas
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

**Verificar presença de:**
- [ ] perfis
- [ ] categorias
- [ ] receitas
- [ ] despesas
- [ ] cartoes
- [ ] compras_cartao
- [ ] beneficios
- [ ] investimentos
- [ ] parcelamentos
- [ ] family_groups
- [ ] subscription_plans

---

## FASE 5: CRIAR USUÁRIOS DE TESTE (5 min)

### ☐ 5.1. Criar User 1

**Via Authentication > Users:**
1. [ ] Add user → email
2. [ ] Email: `teste1@almeidafinance.dev`
3. [ ] Password: `Teste123!@#`
4. [ ] Auto Confirm: ✅ ON
5. [ ] Create user

### ☐ 5.2. Criar User 2

1. [ ] Add user → email
2. [ ] Email: `teste2@almeidafinance.dev`
3. [ ] Password: `Teste123!@#`
4. [ ] Auto Confirm: ✅ ON
5. [ ] Create user

### ☐ 5.3. Verificar Perfis Criados

```sql
-- Verificar se perfis foram criados automaticamente via trigger
SELECT 
  u.email,
  p.nome,
  p.subscription_plan,
  p.criado_em
FROM auth.users u
LEFT JOIN public.perfis p ON p.id = u.id
ORDER BY u.created_at DESC
LIMIT 2;
```

**Esperado:** 2 linhas, ambas com perfil criado (nome e subscription_plan preenchidos)

**Se perfil NULL:** ⚠️ Trigger não funcionou. Reportar.

---

## FASE 6: TESTE DE ISOLAMENTO RLS (10 min)

### ☐ 6.1. Logar como User 1

**Via SQL (simular auth):**
```sql
-- Pegar UUID do User 1
SELECT id, email FROM auth.users WHERE email = 'teste1@almeidafinance.dev';
-- Anotar UUID: ________________
```

### ☐ 6.2. User 1 Cria Dados

```sql
-- Inserir receita como User 1
-- Substituir <UUID_USER1> pelo UUID copiado acima
INSERT INTO public.receitas (usuario_id, descricao, valor, data)
VALUES ('<UUID_USER1>', 'Salário Teste User1', 5000.00, CURRENT_DATE);

-- Inserir despesa como User 1
INSERT INTO public.despesas (usuario_id, descricao, valor, data)
VALUES ('<UUID_USER1>', 'Despesa Teste User1', 150.00, CURRENT_DATE);
```

### ☐ 6.3. Verificar Isolamento

```sql
-- User 1 deve ver apenas suas receitas
-- (Simulando query com RLS ativo, mas via auth.uid() não funciona em SQL direto)
-- Verificação manual:

-- Todas as receitas (admin view, sem RLS)
SELECT usuario_id, descricao, valor 
FROM public.receitas;
-- Deve mostrar apenas 1 receita (User 1)

-- Pegar UUID do User 2
SELECT id FROM auth.users WHERE email = 'teste2@almeidafinance.dev';

-- Tentar inserir receita como User 2 (via app, RLS impede ver User 1)
INSERT INTO public.receitas (usuario_id, descricao, valor, data)
VALUES ('<UUID_USER2>', 'Salário Teste User2', 3000.00, CURRENT_DATE);

-- Verificar que há 2 receitas, mas cada user vê apenas a sua
SELECT usuario_id, descricao FROM public.receitas ORDER BY criado_em;
-- Deve mostrar 2 receitas: User1 e User2
```

**Validação real de RLS:** Será feita via testes E2E (app autentica usuário real).

---

## FASE 7: CONFIGURAR .env.development.local (Kiro faz)

**Após receber credenciais, Kiro vai:**

### ☐ 7.1. Criar .env.development.local

```bash
VITE_SUPABASE_URL=https://XXXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_VAPID_PUBLIC_KEY=BF3AJLkH1yr7xqciso4p-5IJMkKIu0fBV0VvKGDkKH7X0HjCM-ax8MNmtgjL9b4vby4yMj99-D4Q5Dltd8sitYQ
```

### ☐ 7.2. Atualizar .env.test

```bash
E2E_TEST_EMAIL=teste1@almeidafinance.dev
E2E_TEST_PASSWORD=Teste123!@#
E2E_TEST_EMAIL_2=teste2@almeidafinance.dev
E2E_TEST_PASSWORD_2=Teste123!@#
```

---

## FASE 8: EXECUTAR TESTES E2E (15 min)

### ☐ 8.1. Iniciar Servidor Vite

```bash
npm run dev
```

**Verificar:** Console mostra `http://localhost:5173/`

### ☐ 8.2. Executar Testes E2E

```bash
npm run test:e2e:headed
```

**Tempo:** 2-3 minutos

### ☐ 8.3. Verificar Resultados

**Esperado:**
```
Running 7 tests using 1 worker

✓ 1. Onboarding › completar sem redirecionamento
✓ 2. Onboarding › persistir saldo
✓ 3. Onboarding › bloquear saldo negativo
✓ 4. Gasto Rápido › lembrar forma de pagamento
✓ 5. Gasto Rápido › registrar gasto
✓ 6. Gasto Rápido › validar valor obrigatório
✓ 7. Gasto Rápido › bloquear valor negativo

7 passed | 0 failed | ~2m total
```

**Se falhar:**
- [ ] Anotar qual teste falhou
- [ ] Verificar screenshots em `test-results/`
- [ ] Assistir vídeo da falha
- [ ] Reportar erro com contexto

---

## FASE 9: TESTES ADICIONAIS (10 min)

### ☐ 9.1. Testar Benefícios (VR/VA)

**Via app (manual):**
1. [ ] Logar como `teste1@almeidafinance.dev`
2. [ ] Ir para Benefícios
3. [ ] Adicionar VR → R$ 500
4. [ ] Verificar que salvou no banco:
```sql
SELECT * FROM beneficios WHERE usuario_id = '<UUID_USER1>';
```

### ☐ 9.2. Testar Isolamento Real

**Via app (manual):**
1. [ ] Logar como `teste1@almeidafinance.dev`
2. [ ] Criar receita R$ 1.000
3. [ ] Logout
4. [ ] Logar como `teste2@almeidafinance.dev`
5. [ ] Verificar que NÃO vê receita de User1
6. [ ] Criar receita R$ 2.000
7. [ ] Logout
8. [ ] Logar como `teste1@almeidafinance.dev`
9. [ ] Verificar que vê apenas R$ 1.000 (própria)

**Se User1 vir receita de User2:** ❌ RLS quebrado! Reportar IMEDIATAMENTE.

---

## FASE 10: DOCUMENTAÇÃO FINAL (5 min)

### ☐ 10.1. Capturar Evidências

- [ ] Screenshots de testes passando
- [ ] Vídeos de testes E2E (automático em `test-results/`)
- [ ] Query de validação final:
```sql
SELECT 
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as tabelas,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as policies,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public') as funcoes,
  (SELECT COUNT(*) FROM auth.users) as usuarios;
```

### ☐ 10.2. Relatório de Resultados

**Preencher:**
- [ ] Total de migrações executadas: ___/39
- [ ] Total de testes E2E passando: ___/7
- [ ] Bugs encontrados: ___ (listar)
- [ ] Bugs corrigidos: ___ (listar)
- [ ] Cobertura validada: ___%

---

## RESUMO DE STATUS

| Fase | Status | Tempo |
|------|--------|-------|
| 1. Preparação | ⏳ | 10 min |
| 2. Credenciais | ⏳ | 2 min |
| 3. Migrações | ⏳ | 5-30 min |
| 4. Validação | ⏳ | 10 min |
| 5. Usuários Teste | ⏳ | 5 min |
| 6. Isolamento RLS | ⏳ | 10 min |
| 7. Config .env | ⏳ | 2 min |
| 8. Testes E2E | ⏳ | 15 min |
| 9. Testes Manuais | ⏳ | 10 min |
| 10. Documentação | ⏳ | 5 min |
| **TOTAL** | **⏳** | **60-90 min** |

---

## ⚠️ PONTOS DE ATENÇÃO

### NUNCA Fazer

- ❌ Executar migrações em produção sem backup
- ❌ Usar service_role key no frontend
- ❌ Compartilhar database password publicamente
- ❌ Testar com dados reais de usuários

### SEMPRE Fazer

- ✅ Validar ambiente isolado ANTES de migrações
- ✅ Confirmar Project Reference NÃO é produção
- ✅ Testar isolamento RLS com 2 usuários
- ✅ Capturar evidências (screenshots/vídeos)
- ✅ Reportar bugs com contexto completo

---

**Iniciar Fase 1: Criar projeto Supabase DEV**

**Quando concluir Fase 2 (credenciais), me enviar para prosseguir com Fases 7-10.**
