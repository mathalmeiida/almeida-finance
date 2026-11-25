# EXECUÇÃO SEQUENCIAL DE MIGRAÇÕES — PROTOCOLO CONTROLADO

**Objetivo:** Executar 39 scripts SQL (1 schema base + 38 migrações) com validação entre cada etapa.

**Tempo estimado:** 30-40 minutos (com validações)

---

## PREPARAÇÃO

### 1. Validar Ambiente Isolado

```sql
-- EXECUTAR PRIMEIRO: Confirmar que é DEV e não produção
SELECT 
  current_database() as database_name,
  current_setting('server_version') as postgres_version;

-- Confirmar banco vazio
SELECT COUNT(*) as tabelas_existentes
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Esperado: 0

-- Confirmar que não há dados de produção
SELECT 
  (SELECT COUNT(*) FROM auth.users) as usuarios_existentes;
-- Esperado: 0 ou muito baixo (apenas contas de teste)
```

**Se qualquer resultado estiver errado:** ⚠️ **PARAR IMEDIATAMENTE**

---

## FASE 1: SCHEMA BASE

### Script 1/39: `supabase/schema.sql`

**O que cria:**
- 9 tabelas: perfis, categorias, receitas, despesas, despesas_tipo_excecoes, cartoes, compras_cartao, parcelamentos, metas
- ~15 políticas RLS
- Trigger `on_auth_user_created`
- Categorias do sistema (11 itens)

**Executar:**
```sql
\i supabase/schema.sql
-- OU copiar/colar via SQL Editor
```

**Validar:**
```sql
-- Confirmar 9 tabelas criadas
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
-- Esperado: cartoes, categorias, compras_cartao, despesas, despesas_tipo_excecoes, metas, parcelamentos, perfis, receitas

-- Confirmar categorias do sistema
SELECT COUNT(*) FROM categorias WHERE usuario_id IS NULL;
-- Esperado: 11

-- Confirmar trigger
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- Esperado: 1 linha
```

**Se falhar:** Parar e reportar erro.

---

## FASE 2: MIGRAÇÕES (38 arquivos)

### Ordem de Execução

**Grupo 1: Core (Outubro 2026) — 25 migrações**

1. `2026-10_admin_core.sql` — Funções admin
2. `2026-10_amortizacoes.sql` — Tabela amortizações
3. `2026-10_beneficios.sql` — Tabelas benefícios + movimentações
4. `2026-10_comece_por_aqui_dispensado.sql` — Coluna perfis
5. `2026-10_compras_cartao_subcategoria.sql` — Coluna compras_cartao
6. `2026-10_consultoria_acessos.sql` — Tabela consultoria_acessos
7. `2026-10_consultoria_e_agenda.sql` — Tabelas consultoria + agenda
8. `2026-10_cor_tema.sql` — Coluna perfis (cor_tema)
9. `2026-10_cor_tema_fix_check.sql` — Correção constraint
10. `2026-10_cor_tema_modos.sql` — Atualização modos
11. `2026-10_cor_tema_preto.sql` — Modo preto
12. `2026-10_despesa_cartao_vinculo.sql` — Política RLS despesas
13. `2026-10_editar_tipo_e_antecipar_pagamento.sql` — Tabela despesas_tipo_excecoes
14. `2026-10_faturas_cartao_pagamento.sql` — Coluna faturas
15. `2026-10_faturas_cartao_total.sql` — Tabela faturas_cartao
16. `2026-10_feedbacks.sql` — Tabela feedbacks
17. `2026-10_investimentos.sql` — Recria tabela investimentos + movimentações
18. `2026-10_investimentos_rpc.sql` — Funções RPC investimentos
19. `2026-10_metas_investimentos.sql` — Tabela metas_investimentos
20. `2026-10_metas_investimentos_TESTES.sql` — Testes (pode pular)
21. `2026-10_notificacoes_lidas.sql` — Tabela notificacoes_lidas
22. `2026-10_parcelamentos_tipo.sql` — Coluna tipo
23. `2026-10_push_subscriptions.sql` — Tabelas push
24. `2026-10_receitas_recorrencia.sql` — Colunas recorrência
25. `2026-10_reserva_configurada.sql` — Coluna reserva_configurada

**Validação Grupo 1:**
```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
-- Esperado: ~25 tabelas
```

---

**Grupo 2: Ajustes (Novembro 2026) — 6 migrações**

26. `2026-11_atalhos_home.sql` — Tabela atalhos
27. `2026-11_categorias_receita_expandidas.sql` — Novas categorias
28. `2026-11_compras_cartao_cartao_do_dono.sql` — Política RLS
29. `2026-11_importacoes.sql` — Tabelas importações
30. `2026-11_limite_diario.sql` — Colunas perfis
31. `2026-11_onboarding_perfil.sql` — Ajustes onboarding
32. `2026-11_perfil_foto_avatar.sql` — Avatar perfil

**Validação Grupo 2:**
```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
-- Esperado: ~30 tabelas
```

---

**Grupo 3: RPC Zerar Dados (5 versões — APENAS ÚLTIMA)**

⚠️ **IMPORTANTE:** Executar APENAS a versão FINAL:

33. ~~`2026-11_rpc_zerar_dados_financeiros.sql`~~ — Pular
34. ~~`2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql`~~ — Pular
35. ~~`2026-11_rpc_zerar_dados_financeiros_CORRECAO_V2.sql`~~ — Pular
36. ~~`2026-11_rpc_zerar_dados_financeiros_CORRECAO_FINAL.sql`~~ — Pular
37. ✅ **`2026-11_rpc_zerar_dados_financeiros_FINAL_LIMPO.sql`** — **EXECUTAR ESTA**

**Validação:**
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'zerar_dados_financeiros';
-- Esperado: 1 linha
```

---

**Grupo 4: Família + Segurança (Final) — 2 migrações**

38. `20261119000001_familia_whatsapp_base.sql` — Tabelas família + subscription
39. `20261119000002_perfis_security_fix.sql` — Triggers segurança

**Validação Final:**
```sql
-- Total de tabelas
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
-- Esperado: ~32-35

-- Total de políticas RLS
SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';
-- Esperado: ~50+

-- Total de funções
SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public';
-- Esperado: ~15+

-- Planos de assinatura
SELECT id, nome FROM subscription_plans ORDER BY preco_mensal;
-- Esperado: free, premium, plus
```

---

## ESTRATÉGIA DE EXECUÇÃO

### Opção A: Manual Sequencial (RECOMENDADO)

**Vantagens:**
- Controle total sobre cada etapa
- Validação imediata de erros
- Histórico claro do que foi executado

**Processo:**
1. Abrir SQL Editor
2. Executar migration 1
3. Validar resultado
4. Se OK → migration 2
5. Se erro → parar e reportar

**Tempo:** 30-40 minutos

---

### Opção B: Script Consolidado (RÁPIDO MAS MENOS CONTROLE)

**Vantagens:**
- 1 execução (5 minutos)
- Idempotente

**Desvantagens:**
- Erro no meio interrompe tudo
- Difícil identificar qual migration falhou

**Processo:**
1. Usar `SETUP_DEV_COMPLETO.sql`
2. Executar
3. Validar resultado final

**Tempo:** 5-10 minutos

---

## VALIDAÇÃO CRÍTICA ANTES DE CADA MIGRATION

### Checklist Pré-Execução

```sql
-- 1. Confirmar que estou em DEV
SELECT current_database();
-- Esperado: postgres (nome padrão Supabase DEV)

-- 2. Verificar número atual de tabelas
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

-- 3. Verificar se migration já foi aplicada (algumas são idempotentes)
-- Exemplo: verificar se tabela já existe antes de migration que cria ela
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'beneficios'
);
```

---

## TRATAMENTO DE ERROS

### Erro: "relation already exists"

**Causa:** Tabela já foi criada (migration executada 2x)

**Solução:**
- Se migration tem `IF NOT EXISTS`: ignorar (esperado)
- Se não tem: pular migration (já aplicada)

---

### Erro: "column already exists"

**Causa:** Coluna já foi adicionada

**Solução:**
- Se tem `IF NOT EXISTS`: ignorar
- Se não tem: pular `ALTER TABLE ADD COLUMN`

---

### Erro: "permission denied"

**Causa:** RLS ou permissões

**Solução:**
```sql
-- Verificar se RLS está ativo
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Conceder permissões
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
```

---

### Erro: "function does not exist"

**Causa:** Dependência de function criada em migration anterior

**Solução:**
- Verificar qual function está faltando
- Executar migration que cria essa function primeiro

---

## REGISTRO DE EXECUÇÃO

### Template de Log

Após cada migration, registrar:

```
[2024-12-20 10:30:00] Migration 1/39: schema.sql
Status: ✅ Sucesso
Tabelas criadas: 9
Tempo: 1.2s
Observações: Nenhuma

[2024-12-20 10:31:30] Migration 2/39: 2026-10_admin_core.sql
Status: ✅ Sucesso
Funções criadas: e_admin, listar_todos_usuarios
Tempo: 0.5s
Observações: Nenhuma

[2024-12-20 10:32:00] Migration 3/39: 2026-10_amortizacoes.sql
Status: ❌ Erro
Erro: ERROR: relation "parcelamentos" does not exist
Ação: Migration depende de parcelamentos (criada no schema base)
Solução: Verificar se schema.sql foi executado corretamente
```

---

## VALIDAÇÃO FINAL COMPLETA

```sql
-- ============================================================
-- VALIDAÇÃO COMPLETA PÓS-MIGRAÇÕES
-- ============================================================

-- 1. Total de tabelas
SELECT 
  'TABELAS' as tipo,
  COUNT(*) as total
FROM pg_tables 
WHERE schemaname = 'public';
-- Esperado: 32-35

-- 2. Lista de tabelas criadas
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 3. Políticas RLS por tabela
SELECT 
  tablename,
  COUNT(*) as num_policies
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 4. Funções RPC criadas
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name NOT LIKE 'pg_%'
ORDER BY routine_name;

-- 5. Triggers criados
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname NOT LIKE 'pg_%'
  AND tgname NOT LIKE 'RI_%'
ORDER BY tgname;

-- 6. Dados iniciais
SELECT 
  'Categorias sistema' as tipo,
  COUNT(*) as total
FROM categorias WHERE usuario_id IS NULL
UNION ALL
SELECT 
  'Planos assinatura',
  COUNT(*)
FROM subscription_plans;
-- Esperado: Categorias ~15, Planos 3

-- 7. Resumo final
DO $$
DECLARE
  v_tabelas INT;
  v_policies INT;
  v_functions INT;
  v_triggers INT;
BEGIN
  SELECT COUNT(*) INTO v_tabelas FROM pg_tables WHERE schemaname = 'public';
  SELECT COUNT(*) INTO v_policies FROM pg_policies WHERE schemaname = 'public';
  SELECT COUNT(*) INTO v_functions FROM information_schema.routines WHERE routine_schema = 'public';
  SELECT COUNT(*) INTO v_triggers FROM pg_trigger WHERE tgname NOT LIKE 'pg_%' AND tgname NOT LIKE 'RI_%';
  
  RAISE NOTICE '=== RESUMO FINAL ===';
  RAISE NOTICE 'Tabelas: % (esperado: 32-35)', v_tabelas;
  RAISE NOTICE 'Políticas RLS: % (esperado: 50+)', v_policies;
  RAISE NOTICE 'Funções: % (esperado: 15+)', v_functions;
  RAISE NOTICE 'Triggers: % (esperado: 5+)', v_triggers;
  
  IF v_tabelas >= 30 AND v_policies >= 40 THEN
    RAISE NOTICE '✓ BANCO CONFIGURADO CORRETAMENTE!';
  ELSE
    RAISE WARNING '⚠ Banco incompleto. Verificar migrações.';
  END IF;
END $$;
```

---

## PRÓXIMOS PASSOS APÓS MIGRAÇÕES

1. ✅ Validar estrutura completa (query acima)
2. ✅ Criar 2 usuários de teste
3. ✅ Testar isolamento RLS
4. ✅ Configurar `.env.development.local`
5. ✅ Executar testes E2E
6. ✅ Corrigir bugs encontrados
7. ✅ Gerar evidências

---

**Aguardando você criar projeto DEV e me enviar credenciais para iniciar execução controlada.**
