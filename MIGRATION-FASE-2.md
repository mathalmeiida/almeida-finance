# MIGRATION FASE 2 — HISTÓRICO DE IMPORTAÇÕES

**Data:** 06 de Novembro de 2026  
**Status:** ✅ Pronta para aplicar  
**Arquivo:** `supabase/migrations/2026-11_importacoes.sql`

---

## ✅ JÁ EXISTE E ESTÁ COMPLETA

A migration necessária para a Fase 2 **JÁ EXISTE** no repositório desde o commit anterior.

**Localização:** `supabase/migrations/2026-11_importacoes.sql`

---

## 📋 ESTRUTURA

### Tabela: `importacoes`
Registra um resumo por arquivo importado.

**Colunas:**
- `id` (UUID, PK)
- `usuario_id` (UUID, FK → auth.users)
- `contexto` (TEXT: 'extrato', 'fatura', 'investimentos')
- `origem` (TEXT: nome do banco/cartão, max 120 chars)
- `formato` (TEXT: 'csv', 'ofx', 'xlsx', 'xls', 'pdf')
- `periodo_inicio` (DATE)
- `periodo_fim` (DATE)
- `qtd_lidas` (INTEGER)
- `qtd_importadas` (INTEGER)
- `qtd_ignoradas` (INTEGER)
- `status` (TEXT: 'concluida', 'parcial')
- `criado_em` (TIMESTAMPTZ)

**Constraints:**
- CHECK contexto IN (...)
- CHECK formato IN (...)
- CHECK status IN (...)
- CHECK qtd >= 0
- UNIQUE (id, usuario_id) — para FK composta

**Índices:**
- `idx_importacoes_usuario` (usuario_id, criado_em DESC)

---

### Tabela: `importacoes_itens`
Registra cada lançamento importado com chave de duplicidade.

**Colunas:**
- `id` (UUID, PK)
- `importacao_id` (UUID, FK → importacoes)
- `usuario_id` (UUID, FK → auth.users)
- `chave` (TEXT: hash de duplicidade, 4-40 chars)
- `destino_tabela` (TEXT: tabela onde foi gravado)
- `destino_id` (UUID: id do registro criado)
- `criado_em` (TIMESTAMPTZ)

**Constraints:**
- CHECK destino_tabela IN ('receitas', 'despesas', 'compras_cartao', 'investimentos_movimentacoes')
- FK composta (importacao_id, usuario_id) → impede vincular item à importação de outro usuário
- UNIQUE (usuario_id, chave) — impede duplicatas

**Índices:**
- `idx_importacoes_itens_importacao` (importacao_id)

---

## 🔒 SEGURANÇA

### Row Level Security (RLS)
**Ativado** em ambas as tabelas.

**Políticas:**
- `importacoes_select_proprio`: SELECT apenas próprias
- `importacoes_insert_proprio`: INSERT apenas próprias
- `importacoes_delete_proprio`: DELETE apenas próprias
- `importacoes_itens_select_proprio`: SELECT apenas próprios
- `importacoes_itens_insert_proprio`: INSERT apenas próprios
- `importacoes_itens_delete_proprio`: DELETE apenas próprios

**Sem UPDATE:** Histórico é imutável.

**Permissões:**
- GRANT SELECT, INSERT, DELETE ON authenticated
- REVOKE ALL FROM anon
- REVOKE TRUNCATE (ignoraria RLS)

---

## ✅ VALIDAÇÕES

### Idempotente
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `DO $$ IF NOT EXISTS ... CREATE POLICY`

**Seguro executar múltiplas vezes.**

### Integridade
- FK ON DELETE CASCADE: apagar usuário apaga histórico
- FK composta: item só vincula à importação do mesmo usuário
- UNIQUE chave: mesmo lançamento não é importado duas vezes

---

## 🚀 APLICAR EM PRODUÇÃO

### Pré-requisitos
- ✅ Backup do banco
- ✅ Aplicar primeiro em STAGING
- ✅ Validar testes RLS em staging
- ✅ Confirmar sem erros

### Comandos

#### Via Supabase CLI
```bash
npx supabase db push
```

#### Via SQL Editor (Dashboard)
1. Copiar conteúdo de `supabase/migrations/2026-11_importacoes.sql`
2. Colar no SQL Editor
3. Executar
4. Verificar resultado

#### Validação
```sql
-- Verificar tabelas criadas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('importacoes','importacoes_itens');

-- Verificar políticas
SELECT tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('importacoes','importacoes_itens');
```

**Resultado esperado:**
- 2 tabelas com RLS ativado
- 6 políticas (3 para cada tabela)

---

## 📊 IMPACTO

### Sem migration aplicada
- ✅ Importação funciona normalmente
- ✅ Duplicidades detectadas por lançamentos existentes
- ⚠️ Histórico não é salvo
- ⚠️ Central mostra "histórico indisponível"

### Com migration aplicada
- ✅ Importação funciona normalmente
- ✅ Duplicidades detectadas por chaves + lançamentos
- ✅ Histórico salvo automaticamente
- ✅ Central mostra histórico completo

**Graceful degradation:** App funciona sem a migration.

---

## 🔄 ROLLBACK

Se necessário, apagar apenas o histórico (lançamentos permanecem):

```sql
DROP TABLE IF EXISTS public.importacoes_itens CASCADE;
DROP TABLE IF EXISTS public.importacoes CASCADE;
```

**Importante:** Isso apaga o histórico mas **não afeta** os lançamentos importados (receitas, despesas, etc.).

---

## ✅ STATUS

**Migration:** ✅ Pronta  
**Testes:** ✅ Hook validado  
**Segurança:** ✅ RLS completo  
**Idempotente:** ✅ Sim  
**Produção:** ⏳ Aguarda autorização  

**Recomendação:** Aplicar em staging primeiro, validar com testes RLS, depois aplicar em produção.
