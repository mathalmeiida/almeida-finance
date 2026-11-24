# Migration: Almeida Família + WhatsApp + Monetização

## ⚠️ ATENÇÃO - MIGRATION NÃO APLICADA

A migration `20261119000001_familia_whatsapp_base.sql` foi **criada mas NÃO aplicada** ao banco de dados.

## O que esta migration faz

Adiciona 12 novas tabelas para suportar:

### 1. **Monetização**
- `subscription_plans` - Planos Free, Premium e Plus
- Adiciona coluna `subscription_plan` em `perfis`

### 2. **Almeida Família**
- `family_groups` - Grupos familiares
- `family_members` - Membros e permissões (admin/membro)
- `family_invitations` - Convites pendentes
- `family_expense_splits` - Despesas compartilhadas
- `family_split_participants` - Divisão e pagamentos
- `family_goals` - Metas familiares
- `family_goal_contributions` - Contribuições

### 3. **WhatsApp Financeiro**
- `whatsapp_connections` - Conexões do usuário
- `whatsapp_message_events` - Log de mensagens
- `whatsapp_usage` - Uso mensal
- `whatsapp_cost_settings` - Configuração de custos (admin)

## Segurança

✅ **Todas as tabelas têm RLS (Row Level Security) habilitada**

Políticas implementadas:
- Usuários só acessam seus próprios dados
- Membros só veem grupos que participam
- Apenas admins podem gerenciar membros
- WhatsApp events isolados por usuário

## Como Aplicar

### 1. **Em Desenvolvimento (LOCAL)**

```bash
# Navegue até o diretório do projeto
cd posso-comprar

# Aplique a migration
supabase db push

# Verifique se foi aplicada
supabase db diff
```

### 2. **Em Produção (CUIDADO!)**

```bash
# 1. Faça backup do banco primeiro
supabase db dump > backup-antes-familia-$(date +%Y%m%d-%H%M%S).sql

# 2. Teste a migration em staging
supabase db push --project-ref <staging-project-id>

# 3. Valide que tudo funciona

# 4. Aplique em produção
supabase db push --project-ref <production-project-id>
```

## Dados Iniciais

A migration insere 3 planos de assinatura:

| ID      | Nome    | Preço/mês | Família | WhatsApp msgs/mês |
|---------|---------|-----------|---------|-------------------|
| free    | Free    | R$ 0,00   | ❌      | 0                 |
| premium | Premium | R$ 19,90  | ✅      | 100               |
| plus    | Plus    | R$ 29,90  | ✅      | 300               |

**Todos os usuários existentes** receberão `subscription_plan = 'free'` (default).

## Validações Antes de Aplicar

### ✅ Checklist

- [ ] Backup do banco criado
- [ ] Migration revisada e entendida
- [ ] Testada em ambiente de desenvolvimento
- [ ] Nenhum erro reportado em dev
- [ ] Aplicação atualizada com novos componentes
- [ ] Usuários informados sobre novos recursos

### 🔍 Verificações Pós-Aplicação

```sql
-- 1. Verificar que tabelas foram criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'family_%' OR table_name LIKE 'whatsapp_%';

-- 2. Verificar planos criados
SELECT * FROM subscription_plans;

-- 3. Verificar RLS habilitada
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE 'family_%' OR tablename LIKE 'whatsapp_%');

-- 4. Verificar políticas RLS
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname = 'public';

-- 5. Verificar usuários com plano atribuído
SELECT subscription_plan, COUNT(*) 
FROM perfis 
GROUP BY subscription_plan;
```

## Rollback

Se algo der errado, **NÃO DELETE MANUALMENTE**.

```bash
# Restaurar backup
psql -d <database-url> < backup-antes-familia-TIMESTAMP.sql
```

Ou reverta a migration:

```sql
-- Remover coluna de subscription_plan
ALTER TABLE perfis DROP COLUMN IF EXISTS subscription_plan;

-- Dropar tabelas (cuidado: perde dados!)
DROP TABLE IF EXISTS whatsapp_cost_settings CASCADE;
DROP TABLE IF EXISTS whatsapp_usage CASCADE;
DROP TABLE IF EXISTS whatsapp_message_events CASCADE;
DROP TABLE IF EXISTS whatsapp_connections CASCADE;
DROP TABLE IF EXISTS family_goal_contributions CASCADE;
DROP TABLE IF EXISTS family_goals CASCADE;
DROP TABLE IF EXISTS family_split_participants CASCADE;
DROP TABLE IF EXISTS family_expense_splits CASCADE;
DROP TABLE IF EXISTS family_invitations CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS family_groups CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
```

## Impacto

### ✅ Sem Breaking Changes
- **NÃO** altera tabelas existentes (exceto adiciona 1 coluna em `perfis`)
- **NÃO** modifica dados existentes
- **NÃO** quebra funcionalidades atuais
- Usuários existentes continuam funcionando normalmente (plano free)

### ⚙️ Compatibilidade
- Requer código atualizado (hooks e páginas criados)
- Layout precisa adicionar link "Família" (apenas Premium+)
- Configurações precisa adicionar seção de assinatura

## Suporte

Em caso de problemas:

1. **Verifique logs**: `supabase logs`
2. **Consulte políticas RLS**: Podem bloquear acesso se mal configuradas
3. **Teste queries manualmente**: Use o SQL Editor do Supabase
4. **Restaure backup**: Se necessário, rollback completo

---

**Data de criação**: 19/11/2026  
**Status**: ⚠️ **NÃO APLICADA** - Aguardando revisão e teste

---

# Pagamentos de fatura: `20261124000001_pagamentos_fatura.sql`

- Nome no formato `<versão numérica>_<nome>.sql`, reconhecido pelo Supabase CLI. As migrations `2026-10_*` e `2026-11_*` não têm prefixo numérico: precisam estar aplicadas antes (`2026-10_consultoria_acessos.sql`, `2026-10_faturas_cartao_total.sql`). O prefixo é maior que `20261119000002`, então a ordem das dependências é preservada.
- Produção NÃO recebe migration manual deste trabalho, e `supabase db push` não deve ser usado contra produção.
- Aplicar somente no DEV (projeto `fzawugbiojmtrthmshcc`, por quem tem acesso), como transação única:
  - SQL Editor: colar o arquivo inteiro e executar; ou
  - `psql "$DATABASE_URL_DEV" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000001_pagamentos_fatura.sql`
- Pré-checagens (a própria migration também falha com mensagem clara):
  ```sql
  SHOW server_version_num;  -- >= 130000 (PostgreSQL 13+)
  SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database();  -- UTF8
  SELECT column_name FROM information_schema.columns
   WHERE table_name = 'parcelamentos' AND column_name = 'cartao_id';  -- 1 linha (a migration cria se faltar)
  ```
- Reaplicar a migration é seguro (idempotente).
- Teste de concorrência com PostgreSQL real e duas ou mais sessões (Postgres local descartável, nunca produção):
  ```bash
  docker run --rm -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16
  npm i --no-save pg
  PG_TEST_URL=postgres://postgres:x@127.0.0.1:55432/postgres node supabase/tests/concorrencia-fatura.mjs
  ```
  Código de saída 0 somente se todos os cenários rodaram; 2 se não executou (PENDENTE); 1 se algum falhou.

---

# Integridade histórica das faturas: `20261124000002_integridade_historica_fatura.sql`

- Ordem: aplicar `20261124000001_pagamentos_fatura.sql` e DEPOIS `20261124000002_integridade_historica_fatura.sql`. A 000002 falha com mensagem clara se a 000001 não estiver aplicada. Reaplicar a 000001 depois da 000002 restaura o estorno de 1 argumento sem auditoria; reaplique a 000002 em seguida.
- A 000002 também redefine `zerar_dados_financeiros()` (com a exceção transacional do histórico). Ela ordena depois de `2026-11_rpc_zerar_dados_financeiros_CORRECAO_FINAL.sql`, então é a definição final.
- Efeito: DML direto em compras, parcelamentos e faturas informadas de uma competência quitada passa a ser recusado com SQLSTATE `FP001`. O caminho permitido é a RPC `alterar_historico_fatura` (motivo obrigatório, com auditoria em `ajustes_fatura`). Cartão com pagamento ativo não pode ser excluído.
- Produção NÃO recebe esta migration manual, e `supabase db push` não deve ser usado contra produção. Aplicar somente no DEV, por quem tem acesso, como transação única:
  `psql "$DATABASE_URL_DEV" -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000002_integridade_historica_fatura.sql`
- Validação (Postgres descartável, nunca produção):
  ```bash
  npm i --no-save @electric-sql/pglite pg
  npm run test:migrations      # PGlite: inclui a seção "integridade histórica"
  PG_TEST_URL=postgres://postgres:x@127.0.0.1:55432/postgres npm run test:concorrencia   # cenários 13b e 18a a 18d
  ```
- Estado: os cenários novos estão escritos e NÃO foram executados (sem Postgres nem pglite no ambiente de desenvolvimento). Ver `docs/pagamento-faturas-relatorio.md`, seção 11.
