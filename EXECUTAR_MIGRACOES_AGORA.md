# EXECUTAR MIGRAÇÕES NO SUPABASE DEV

**Status:** ✅ Conexão validada | ✅ Banco vazio | ✅ Pronto para executar

---

## OPÇÃO 1: SCRIPT CONSOLIDADO (RECOMENDADO — 5 minutos)

### Passo 1: Abrir SQL Editor

Acessar: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql

### Passo 2: Nova Query

Clicar em **"New query"**

### Passo 3: Copiar Script Consolidado

Abrir arquivo: `SETUP_DEV_COMPLETO.sql` (272 KB)

**Selecionar TODO o conteúdo** (Ctrl+A) e **Copiar** (Ctrl+C)

### Passo 4: Colar no SQL Editor

Colar no editor do Supabase (Ctrl+V)

### Passo 5: Executar

Clicar em **"Run"** (ou Ctrl+Enter)

⏱️ **Tempo de execução:** ~2-3 minutos

### Passo 6: Verificar Resultado

No final do output, buscar:

```
✓ TODAS AS TABELAS FORAM CRIADAS COM SUCESSO!
Tabelas criadas: 32 / 32
```

**Se aparecer esse texto:** ✅ Migrações concluídas com sucesso

**Se aparecer erros:** Copie a mensagem de erro e me informe

---

## OPÇÃO 2: EXECUÇÃO SEQUENCIAL (CONTROLE TOTAL — 30 minutos)

**Apenas se Opção 1 falhar ou preferir controle granular**

Seguir instruções em: `EXECUTAR_MIGRACOES_SEQUENCIAL.md`

---

## VALIDAÇÃO PÓS-MIGRAÇÕES

Após executar com sucesso, validar estrutura:

### No SQL Editor, executar:

```sql
-- Contar tabelas criadas
SELECT COUNT(*) as total_tabelas
FROM pg_tables 
WHERE schemaname = 'public';
-- Esperado: 32-35

-- Listar tabelas
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Verificar políticas RLS
SELECT COUNT(*) as total_policies
FROM pg_policies
WHERE schemaname = 'public';
-- Esperado: 50+

-- Verificar funções RPC
SELECT COUNT(*) as total_functions
FROM information_schema.routines
WHERE routine_schema = 'public';
-- Esperado: 15+
```

---

## TROUBLESHOOTING

### Erro: "syntax error at or near..."

**Causa:** Parte do script foi colada incorretamente

**Solução:**
1. Garantir que copiou TODO o conteúdo do arquivo
2. Verificar se não há caracteres estranhos
3. Tentar novamente

### Erro: "relation already exists"

**Causa:** Migração já foi executada parcialmente

**Solução:**
- Ignorar (script é idempotente)
- Continuar até o final
- Verificar se 32 tabelas foram criadas

### Erro: "permission denied"

**Causa:** Permissões do banco

**Solução:**
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
```

### Timeout / Execução muito longa

**Causa:** Script muito grande para executar de uma vez

**Solução:** Usar Opção 2 (execução sequencial)

---

## APÓS CONCLUSÃO

Me informar:

```
✅ Migrações executadas
Tabelas criadas: XX
Erros: Nenhum / [listar erros]
```

Vou então:
1. ✅ Criar usuários de teste
2. ✅ Validar isolamento RLS
3. ✅ Executar testes E2E
4. ✅ Gerar relatório final

---

**Executar agora:**
1. Abrir: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
2. New query
3. Copiar/colar `SETUP_DEV_COMPLETO.sql`
4. Run
5. Verificar resultado
6. Me informar

**Aguardando execução das migrações.**
