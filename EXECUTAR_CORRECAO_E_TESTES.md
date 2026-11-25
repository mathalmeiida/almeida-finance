# 🚀 EXECUTAR CORREÇÃO E TESTES COMPLETOS

**Ambiente:** DEV gxfcfpdwyjqcrfssxgbi  
**Objetivo:** Corrigir RLS e executar testes autenticados completos

---

## 📋 ETAPA 1: CORRIGIR PERMISSÕES RLS (OBRIGATÓRIO)

### Problema Identificado

**Erro:**
```
Error: permission denied for table categorias
Hint: Grant the required privileges to the current role with: GRANT SELECT ON public.categorias TO anon;
```

**Causa:** Papel `anon` não tem permissão GRANT em nível de tabela. RLS nem chega a ser avaliado.

### Solução

1. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
2. Abra o arquivo: `CORRIGIR_RLS_CATEGORIAS.sql`
3. Execute **TODAS as queries** do arquivo
4. Verifique os resultados de cada query

### O Que Será Feito

✅ **GRANT SELECT** em `categorias` para papel `anon` (categorias do sistema públicas)  
✅ **GRANT SELECT, INSERT, UPDATE, DELETE** em todas as tabelas para papel `authenticated`  
✅ **Verificação** de que GRANTs foram aplicados corretamente

### Tempo Estimado

~5 minutos

---

## 📋 ETAPA 2: EXECUTAR TESTES AUTENTICADOS

Após corrigir as permissões:

```bash
node testes-autenticados-completos.js
```

### O Que Será Testado

| # | Teste | Esperado |
|---|-------|----------|
| 1 | Categorias sistema visíveis sem auth | ✅ PASS |
| 2 | Trigger - Criação automática de perfil | ✅ PASS |
| 3 | Alice cria uma meta | ✅ PASS |
| 4 | Bob NÃO vê meta de Alice | ✅ PASS (isolamento) |
| 5 | Alice cria um cartão | ✅ PASS |
| 6 | Bob cria um cartão | ✅ PASS |
| 7 | Alice NÃO vê cartão de Bob | ✅ PASS (isolamento) |
| 8 | Alice NÃO cria despesa com cartão de Bob | ✅ PASS (bloqueado) |
| 9 | Alice cria despesa com próprio cartão | ✅ PASS |
| 10 | Alice NÃO cria compra com cartão de Bob | ✅ PASS (bloqueado) |
| 11 | Alice cria compra com próprio cartão | ✅ PASS |

### Tempo Estimado

~2 minutos

---

## 📊 RESULTADO ESPERADO

```
═══════════════════════════════════════════════════════════
📊 RESUMO DOS TESTES
═══════════════════════════════════════════════════════════

Total de testes: 11
✅ PASS:  11
❌ FAIL:  0
⏭️  SKIP:  0

✅ TODOS OS TESTES EXECUTADOS PASSARAM!
═══════════════════════════════════════════════════════════
```

---

## 🚨 SE HOUVER FALHAS

### FAIL no Teste 1 (Categorias)

**Sintoma:** `permission denied for table categorias`  
**Solução:** Executar novamente `CORRIGIR_RLS_CATEGORIAS.sql`

### FAIL no Teste 4, 7, 8 ou 10 (Isolamento)

**Sintoma:** Usuário vê/altera dados de outro usuário  
**Problema:** VULNERABILIDADE CRÍTICA de RLS  
**Ação:** NÃO prosseguir sem corrigir

### FAIL no Teste 2 (Trigger)

**Sintoma:** Perfil não criado automaticamente  
**Solução:** Verificar trigger `ao_criar_usuario` no SQL Editor

### SKIP em qualquer teste

**Sintoma:** Usuários não autenticaram  
**Causa:** Email de confirmação pode estar bloqueando  
**Solução:** Desabilitar confirmação de email:
1. Dashboard → Authentication → Providers → Email
2. Desmarcar "Enable email confirmations"

---

## 📂 ARQUIVOS

| Arquivo | Uso |
|---------|-----|
| `CORRIGIR_RLS_CATEGORIAS.sql` | Corrigir GRANTs (executar no SQL Editor) |
| `testes-autenticados-completos.js` | Testes completos (executar no terminal) |
| `investigar-rls-categorias.js` | Investigação inicial (já executado) |
| `EXECUTAR_CORRECAO_E_TESTES.md` | Este guia |

---

## ✅ CRITÉRIOS DE SUCESSO

Para considerar RLS validado:

- [x] Todos os 11 testes devem passar (✅ PASS)
- [x] Nenhum teste pode falhar (❌ FAIL = 0)
- [x] Isolamento entre usuários confirmado
- [x] Validação de ownership de cartões funcionando
- [x] Trigger de perfil automático funcionando

---

**Pronto para executar!** 🚀

1. Execute `CORRIGIR_RLS_CATEGORIAS.sql` no SQL Editor
2. Execute `node testes-autenticados-completos.js` no terminal
3. Relate os resultados
