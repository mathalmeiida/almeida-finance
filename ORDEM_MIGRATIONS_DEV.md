# Ordem de Aplicação de Migrations - Ambiente DEV

⚠️ **Aplicar APENAS no projeto DEV**: `fzawugbiojmtrthmshcc`

## Verificação Antes de Iniciar

```sql
-- Confirmar que está no projeto DEV
SELECT current_database();
-- Deve retornar: postgres

-- Verificar project_ref (executar no painel)
-- URL do painel deve conter: /project/fzawugbiojmtrthmshcc/
```

---

## GRUPO 1: Estrutura Base (OBRIGATÓRIO)

### 1. Perfis e Autenticação
```
Arquivo: supabase/migrations/2026-10_admin_core.sql
Cria: perfis, policies básicas
Tempo: ~2s
```

**Validar**:
```sql
SELECT * FROM public.perfis LIMIT 1;
-- Deve funcionar (pode estar vazio)
```

---

## GRUPO 2: Estrutura Financeira (OBRIGATÓRIO para Família)

### 2. Despesas e Cartões
```
Arquivo: supabase/migrations/2026-10_despesa_cartao_vinculo.sql
Cria: despesas, cartoes, compras_cartao, parcelamentos
Tempo: ~3s
```

### 3. Receitas
```
Arquivo: supabase/migrations/2026-10_receitas_recorrencia.sql
Cria: receitas, recorrencias
Tempo: ~1s
```

### 4. Detalhes de Cartão
```
Arquivo: supabase/migrations/2026-10_compras_cartao_subcategoria.sql
Adiciona: subcategoria em compras_cartao
Tempo: ~0.5s
```

### 5. Tipo de Parcelamento
```
Arquivo: supabase/migrations/2026-10_parcelamentos_tipo.sql
Adiciona: coluna tipo em parcelamentos
Tempo: ~0.5s
```

### 6. Faturas de Cartão - Parte 1
```
Arquivo: supabase/migrations/2026-10_faturas_cartao_pagamento.sql
Cria: faturas_cartao
Tempo: ~1s
```

### 7. Faturas de Cartão - Parte 2
```
Arquivo: supabase/migrations/2026-10_faturas_cartao_total.sql
Adiciona: valor_total_fatura
Tempo: ~0.5s
```

**Validar estrutura financeira**:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('despesas', 'receitas', 'cartoes', 'faturas_cartao')
ORDER BY table_name;
-- Deve retornar 4 linhas
```

---

## GRUPO 3: Almeida Família (DEPENDENTE de Grupo 1 e 2)

### 8. Base de Família e WhatsApp
```
Arquivo: supabase/migrations/20261119000001_familia_whatsapp_base.sql

Cria:
- subscription_plans (3 registros)
- family_groups
- family_members
- family_invitations
- family_expense_splits
- family_split_participants
- family_activity_log
- whatsapp_messages
- whatsapp_parsed_expenses
- whatsapp_parsing_errors

Adiciona em perfis:
- subscription_plan TEXT
- plano_override BOOLEAN

Cria function:
- tem_acesso_premium()

Tempo: ~5s
```

**ATENÇÃO**: Esta migration altera `public.perfis`:
- Adiciona coluna `subscription_plan` com FK para `subscription_plans`
- Adiciona coluna `plano_override` (default FALSE)
- Seta todos os registros existentes para `subscription_plan = 'free'`

**Validar**:
```sql
-- Verificar tabelas família
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'family%'
ORDER BY table_name;
-- Deve retornar 6 linhas

-- Verificar planos
SELECT * FROM public.subscription_plans ORDER BY id;
-- Deve retornar 3 linhas (free, premium, pro)

-- Verificar colunas em perfis
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'perfis' 
  AND column_name IN ('subscription_plan', 'plano_override');
-- Deve retornar 2 linhas

-- Verificar function
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'tem_acesso_premium';
-- Deve retornar 1 linha
```

### 9. Triggers de Segurança (OPCIONAL)
```
Arquivo: supabase/migrations/20261119000002_perfis_security_fix.sql

Cria triggers:
- trg_validar_subscription_plan_update
- trg_validar_plano_override_update

Função: Camada extra de validação (RLS + GRANT já protegem)
Tempo: ~1s
```

**Validar**:
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%subscription%' OR trigger_name LIKE '%override%';
-- Deve retornar 2 linhas (ou 0 se não aplicou)
```

---

## GRUPO 4: Features Auxiliares (OPCIONAL - NÃO necessário para Família)

Estas migrations melhoram UX mas não bloqueiam testes de Almeida Família:

### 10-13. Temas de Cor
```
2026-10_cor_tema.sql
2026-10_cor_tema_fix_check.sql
2026-10_cor_tema_modos.sql
2026-10_cor_tema_preto.sql
```

### 14. Benefícios
```
2026-10_beneficios.sql
```

### 15-16. Consultoria
```
2026-10_consultoria_acessos.sql
2026-10_consultoria_e_agenda.sql
```

### 17-20. Investimentos
```
2026-10_amortizacoes.sql
2026-10_investimentos.sql
2026-10_investimentos_rpc.sql
2026-10_metas_investimentos.sql
```

### 21. Push Notifications
```
2026-10_push_subscriptions.sql
```

### 22. Notificações
```
2026-10_notificacoes_lidas.sql
```

### 23-24. Configs Financeiras
```
2026-10_reserva_configurada.sql
2026-10_limite_diario.sql
```

### 25-26. Perfil
```
2026-11_onboarding_perfil.sql
2026-11_perfil_foto_avatar.sql
```

### 27. Atalhos Home
```
2026-11_atalhos_home.sql
```

### 28. Categorias
```
2026-11_categorias_receita_expandidas.sql
```

### 29. Importações
```
2026-11_importacoes.sql
```

### 30. RPC de Reset (útil para testes)
```
2026-11_rpc_zerar_dados_financeiros_FINAL_LIMPO.sql
```

---

## Resumo: Mínimo Necessário para Almeida Família

```
✅ OBRIGATÓRIO:
1. 2026-10_admin_core.sql
2. 2026-10_despesa_cartao_vinculo.sql
3. 2026-10_receitas_recorrencia.sql
4. 2026-10_compras_cartao_subcategoria.sql
5. 2026-10_parcelamentos_tipo.sql
6. 2026-10_faturas_cartao_pagamento.sql
7. 2026-10_faturas_cartao_total.sql
8. 20261119000001_familia_whatsapp_base.sql

⚠️ OPCIONAL (recomendado):
9. 20261119000002_perfis_security_fix.sql

❌ NÃO NECESSÁRIO (pode aplicar depois):
10-30. Features auxiliares
```

---

## Como Aplicar (Via Painel Supabase)

1. Acessar: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc/sql/new

2. Para cada migration:
   - Abrir arquivo local em `supabase/migrations/[NOME].sql`
   - Copiar todo o conteúdo
   - Colar no SQL Editor
   - Clicar "Run"
   - Aguardar "Success"
   - Verificar query de validação

3. Se erro ocorrer:
   - Ler mensagem de erro
   - Verificar se migration anterior foi aplicada
   - Verificar se tabelas/colunas dependentes existem
   - NÃO aplicar novamente se já executou com sucesso

---

## Validação Final

Após aplicar migrations obrigatórias:

```sql
-- 1. Contar tabelas criadas
SELECT COUNT(*) as total_tabelas
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Deve ser >= 20

-- 2. Verificar estrutura família completa
SELECT 
  'family_groups' as tabela,
  COUNT(*) as colunas
FROM information_schema.columns 
WHERE table_name = 'family_groups'
UNION ALL
SELECT 'family_members', COUNT(*) FROM information_schema.columns WHERE table_name = 'family_members'
UNION ALL
SELECT 'family_expense_splits', COUNT(*) FROM information_schema.columns WHERE table_name = 'family_expense_splits'
UNION ALL
SELECT 'family_split_participants', COUNT(*) FROM information_schema.columns WHERE table_name = 'family_split_participants';
-- Cada linha deve ter >= 5 colunas

-- 3. Testar function tem_acesso_premium
SELECT public.tem_acesso_premium();
-- Deve retornar false (usuário não autenticado)

-- 4. Verificar planos de assinatura
SELECT id, nome, preco_mensal FROM public.subscription_plans ORDER BY preco_mensal;
-- Deve retornar: free (0), premium (990), pro (1990)

-- 5. Verificar RLS habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'family%';
-- Todas devem ter rowsecurity = true
```

---

## Rollback (Se Necessário)

⚠️ **Cuidado**: Migrations não têm rollback automático.

Se precisar reverter:

```sql
-- Reverter Família (CUIDADO: perde dados)
DROP TABLE IF EXISTS public.family_split_participants CASCADE;
DROP TABLE IF EXISTS public.family_expense_splits CASCADE;
DROP TABLE IF EXISTS public.family_activity_log CASCADE;
DROP TABLE IF EXISTS public.family_invitations CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.family_groups CASCADE;
DROP TABLE IF EXISTS public.whatsapp_parsing_errors CASCADE;
DROP TABLE IF EXISTS public.whatsapp_parsed_expenses CASCADE;
DROP TABLE IF EXISTS public.whatsapp_messages CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP FUNCTION IF EXISTS public.tem_acesso_premium();

-- Remover colunas de perfis
ALTER TABLE public.perfis 
  DROP COLUMN IF EXISTS subscription_plan,
  DROP COLUMN IF EXISTS plano_override;
```

**Melhor opção**: Deletar projeto DEV e criar novo.

---

## Próximos Passos Após Aplicar

1. ✅ Executar script de validação: `node scripts/validar-ambiente-dev.js`
2. ✅ Rodar aplicação: `npm run dev`
3. ✅ Criar 2 contas de teste no DEV
4. ✅ Executar casos de teste (TESTE_CALENDARIO_FAMILIAR.md)
5. ✅ Validar RLS com script adaptado
6. ✅ Testar calendário familiar
7. ✅ Build final
