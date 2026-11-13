# 🚀 Guia Rápido — Aplicação da Correção RPC

**Tempo estimado:** 5 minutos  
**Risco:** 🟢 Baixo (apenas substitui definição da função)

---

## 📋 Pré-Requisitos

- [x] Acesso ao Supabase Dashboard (projeto `ievccupeijzuzhomphwn`)
- [x] Backup confirmado (Supabase mantém backups automáticos)
- [x] Migration corretiva gerada: `2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql`

---

## 🔍 PASSO 1: Validação Estrutural (30 segundos)

### 1.1. Abrir SQL Editor

```
https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/sql/new
```

### 1.2. Executar Script de Teste

Copiar e colar o conteúdo de:

```
supabase/migrations/TESTE_RPC_CORRECAO.sql
```

### 1.3. Clicar em "Run"

**Resultados esperados:**

| Teste | Resultado Esperado |
|-------|-------------------|
| Tabela metas_investimentos | ✅ EXISTE **ou** ⚠️ NÃO EXISTE (ambos OK) |
| Função zerar_dados_financeiros | ✅ EXISTE |
| SECURITY INVOKER | ✅ CORRETO |
| Permissões authenticated | ✅ GRANT CORRETO |
| Tabelas financeiras (16+1) | ✅ 16 existem + 1 condicional |

**❌ Se aparecer "Função NÃO EXISTE":**

> Isso é esperado! A função será criada no próximo passo.

---

## ⚙️ PASSO 2: Aplicação da Migration (1 minuto)

### 2.1. Nova Query no SQL Editor

```
https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/sql/new
```

### 2.2. Copiar Migration Corretiva

Copiar **todo o conteúdo** de:

```
supabase/migrations/2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql
```

### 2.3. Colar e Executar

1. Colar no SQL Editor
2. Clicar em "Run" (botão verde)
3. Aguardar confirmação (~200ms)

**✅ Sucesso esperado:**

```
Success
Rows: 1 affected
Time: 0.2s
```

**❌ Se aparecer erro:**

```sql
-- Copiar a mensagem de erro COMPLETA
-- Exemplos de erros possíveis:

-- Erro de sintaxe (verificar se colou tudo)
syntax error at or near "..."

-- Erro de permissão (verificar se é admin)
permission denied for function ...

-- Erro de dependência (aplicar migration faltante)
relation "..." does not exist
```

> Se houver erro, **NÃO prosseguir**. Documentar o erro e aguardar análise.

---

## ✅ PASSO 3: Validação Pós-Aplicação (30 segundos)

### 3.1. Executar Novamente o Teste Estrutural

Colar novamente o conteúdo de `TESTE_RPC_CORRECAO.sql` e executar.

**Resultados esperados agora:**

| Teste | Resultado |
|-------|-----------|
| Função zerar_dados_financeiros | ✅ EXISTE |
| SECURITY INVOKER | ✅ CORRETO |
| Permissões authenticated | ✅ GRANT CORRETO |
| Permissões anon/public | ❌ GRANT INCORRETO (deve estar vazio) |

**✅ Se todos os testes passarem:** migration aplicada com sucesso!

---

## 🧪 PASSO 4: Teste Funcional (3 minutos)

### 4.1. Criar Conta Fictícia

```
https://almeida-finance.vercel.app

Email: teste-rpc-correcao-06nov@exemplo.com
Senha: Teste123!Correcao
```

### 4.2. Adicionar Dados Mínimos

```
1. Adicionar 1 cartão:
   Nome: Nubank Teste
   Limite: R$ 5.000

2. Adicionar 1 receita:
   Valor: R$ 100
   Categoria: Salário

3. Adicionar 1 despesa:
   Valor: R$ 50
   Categoria: Alimentação

4. Adicionar 1 meta:
   Nome: Reserva Teste
   Valor: R$ 1.000
```

### 4.3. Executar Exclusão

```
1. Menu → Conta → Apagar dados financeiros
2. Confirmar exclusão no modal
3. Aguardar mensagem "Dados apagados com sucesso"
```

### 4.4. Validar Resultado

**✅ Checklist:**

- [ ] Cartões lista vazia
- [ ] Lançamentos lista vazia
- [ ] Metas lista vazia
- [ ] Dashboard zerado (saldo = R$ 0)
- [ ] Usuário ainda logado (nome aparece no menu)
- [ ] Tema preservado (cor não mudou)
- [ ] Sem erros no console (F12 → Console)

**❌ Se algo falhar:**

1. Abrir console do navegador (F12)
2. Copiar mensagem de erro completa
3. Documentar comportamento inesperado
4. **NÃO executar com usuários reais**

---

## 🎯 PASSO 5: Validação Final (opcional)

### 5.1. Teste de Isolamento

```javascript
// Criar 2 contas fictícias (A e B)
const contaA = 'teste-rpc-a@exemplo.com'
const contaB = 'teste-rpc-b@exemplo.com'

// Adicionar dados em ambas
// Executar RPC apenas na conta A
// Validar que conta B não foi afetada
```

### 5.2. Teste de Rollback

```javascript
// No console do navegador (F12), simular erro:
const { data, error } = await supabase.rpc('zerar_dados_financeiros')

// Validar:
// Se error !== null:
//   ✅ Nenhum dado foi deletado (rollback completo)
//   ✅ Mensagem de erro clara
```

---

## 📊 Checklist Completo

### Antes de Aplicar

- [ ] Backup Supabase confirmado (automático 7-30 dias)
- [ ] Acesso ao SQL Editor (projeto ievccupeijzuzhomphwn)
- [ ] Arquivo TESTE_RPC_CORRECAO.sql disponível
- [ ] Arquivo 2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql disponível

### Durante a Aplicação

- [ ] Teste estrutural executado (PASSO 1)
- [ ] Migration colada no SQL Editor (PASSO 2)
- [ ] "Run" executado sem erros
- [ ] Mensagem "Success" confirmada
- [ ] Teste pós-aplicação executado (PASSO 3)

### Após a Aplicação

- [ ] Conta fictícia criada (PASSO 4.1)
- [ ] Dados mínimos adicionados (PASSO 4.2)
- [ ] Exclusão executada com sucesso (PASSO 4.3)
- [ ] Validação completa (PASSO 4.4)
- [ ] Console sem erros (F12)
- [ ] Isolamento confirmado (PASSO 5.1 opcional)

---

## 🚨 Plano de Contingência

### Se o Teste Estrutural Falhar

**Sintoma:** Tabela financeira retorna "❌ NÃO EXISTE" (exceto metas_investimentos)

**Ação:**

```sql
-- Verificar qual tabela está faltando
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'importacoes', 'despesas', 'receitas', 
    'cartoes', 'metas', 'investimentos', etc
  );

-- Se faltar tabela crítica: NÃO APLICAR a migration corretiva
-- Primeiro aplicar schema.sql ou migrations faltantes
```

### Se a Migration Falhar

**Sintoma:** Erro ao executar `2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql`

**Rollback:**

```sql
-- Remover a função (volta ao estado anterior)
DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();
```

### Se o Teste Funcional Falhar

**Sintoma:** RPC retorna erro ao tentar deletar dados

**Diagnóstico:**

```sql
-- Verificar logs de erro no Supabase
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%zerar_dados_financeiros%' 
ORDER BY last_executed DESC 
LIMIT 5;
```

**Rollback:**

```sql
-- Remover a função até corrigir
DROP FUNCTION IF EXISTS public.zerar_dados_financeiros();

-- Comunicar o erro completo para análise
```

---

## ✅ Critérios de Sucesso

| Critério | Status |
|----------|--------|
| Migration aplicada sem erros | ⬜ |
| Teste estrutural passa (todas as verificações ✅) | ⬜ |
| Conta fictícia consegue deletar dados | ⬜ |
| Usuário permanece logado após exclusão | ⬜ |
| Tema preservado | ⬜ |
| Console sem erros | ⬜ |
| Isolamento confirmado (conta B não afetada) | ⬜ |

**✅ Se todos marcados:** correção aplicada com sucesso!

---

## 📞 Suporte

**Se encontrar problemas:**

1. **NÃO executar com usuários reais**
2. Copiar erro completo (SQL + mensagem + SQLSTATE)
3. Copiar saída do TESTE_RPC_CORRECAO.sql
4. Documentar comportamento observado
5. Aguardar análise antes de tentar novamente

**Arquivos importantes:**

- `RELATORIO-CORRECAO-RPC.md` — análise técnica completa
- `TESTE_RPC_CORRECAO.sql` — script de validação
- `2026-11_rpc_zerar_dados_financeiros_CORRECAO.sql` — migration corretiva

---

## 🏁 Resumo

**O que foi corrigido:**

```sql
-- ANTES: falhava se metas_investimentos não existisse
DELETE FROM public.metas_investimentos WHERE usuario_id = v_usuario_id;

-- DEPOIS: verifica se tabela existe antes de deletar
IF v_tabela_metas_inv_existe THEN
  DELETE FROM public.metas_investimentos WHERE usuario_id = v_usuario_id;
END IF;
```

**Impacto:**

- ✅ RPC funciona mesmo sem a tabela `metas_investimentos`
- ✅ Preserva atomicidade (rollback completo em caso de erro)
- ✅ Mantém isolamento (SECURITY INVOKER + RLS)
- ✅ Não afeta dados existentes (apenas substitui definição da função)

**Tempo total:** ~5 minutos (validação + aplicação + teste)

**Risco:** 🟢 Baixo (idempotente, sem alteração de dados)

---

**Pronto para aplicar?** Siga os passos na ordem e marque o checklist conforme avança! 🚀
