# Diagnóstico: Erro ao Salvar Saldo no Onboarding

**Data:** 23/11/2026  
**Ambiente:** DEV (gxfcfpdwyjqcrfssxgbi)  
**Status:** 🔴 BLOQUEADO - Requer execução de SQL no Supabase Dashboard

---

## Resumo Executivo

O erro **"Could not find the 'saldo_base' column of 'perfis' in the schema cache"** ocorre porque a tabela `perfis` **não possui as colunas** `saldo_base` e `saldo_base_data`, mas o código tenta usá-las em **29 locais diferentes**.

---

## Evidências

### 1. Consulta Direta à Tabela
```bash
$ node consultar-estrutura-perfis.mjs
```

**Resultado:**
```
✅ Perfil encontrado com apenas 4 colunas:
  - id
  - nome
  - email
  - criado_em

❌ saldo_base: MISSING
❌ saldo_base_data: MISSING
```

### 2. Locais do Código que Usam saldo_base
- `src/contexts/AuthContext.jsx` (3 referências - linhas 30, 341, 551)
- `src/pages/OnboardingSimples.jsx` (5 referências - linhas 134, 174-175, 263, 663-665)
- `src/pages/Dashboard.jsx` (6 referências - linhas 2612-2613, 2629-2630, 3481, 3514)
- `src/hooks/useProjecao.js` (4 referências - linhas 42, 46, 58, 234-237)

**Total:** 18 arquivos, 29 usos

### 3. Migrations Existentes
Verificação em `supabase/migrations/`:
- `2026-11_onboarding_perfil.sql` → Adiciona `objetivos_financeiros` e `onboarding_etapa`
- **Nenhuma migration para `saldo_base`** foi encontrada

### 4. Schema Base
Verificação em `01_EXECUTAR_SCHEMA_BASE_CORRIGIDO.sql`:
- **`saldo_base` não está no schema base**

---

## Causa Raiz

As colunas `saldo_base` e `saldo_base_data` foram **desenvolvidas no código** mas a **migration correspondente nunca foi criada ou aplicada**.

Isso indica um gap no processo de desenvolvimento:
1. ✅ Código frontend implementado
2. ✅ Lógica de negócio adicionada
3. ❌ Migration SQL não criada
4. ❌ Schema do banco não atualizado

---

## Solução

### Ações Necessárias (Ordem Obrigatória)

#### 1. Executar SQL no Supabase Dashboard DEV ⚠️ BLOQUEANTE

**Arquivo:** `EXECUTAR_CORRECAO_PERFIS_DEV.sql`

**URL:** https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql/new

**O que faz:**
- Concede `GRANT SELECT, INSERT, UPDATE` em `perfis` para role `authenticated`
- Adiciona colunas `saldo_base` (NUMERIC) e `saldo_base_data` (DATE)
- Recarrega schema cache do PostgREST

**Tempo estimado:** 1-2 minutos

#### 2. Validar Correção

Após executar o SQL, rodar:

```bash
node validar-correcao-perfis.mjs
```

**Resultado esperado:**
```
✅ TODAS AS VALIDAÇÕES PASSARAM
  ✅ GRANT SELECT, INSERT, UPDATE funcionando
  ✅ Colunas saldo_base e saldo_base_data existem
  ✅ Usuário consegue salvar e ler valores
```

#### 3. Testar Onboarding no Navegador

1. Abrir http://localhost:5173 (servidor Vite já rodando no terminal 3)
2. Login: `teste.onboarding@almeida.dev` / `Teste123!@#`
3. Navegar até etapa de Saldo
4. Digitar `R$ 5.000,00`
5. Clicar em "Salvar e Continuar"

**Comportamento esperado:**
- ✅ Sem redirecionamento automático durante digitação
- ✅ Salvamento bem-sucedido
- ✅ Avança para próxima etapa
- ✅ Reload da página preserva valor

---

## Correções Anteriores (Já Aplicadas)

### ✅ React Hook Rules Violation
**Problema:** Hooks após retornos condicionais causavam ErrorBoundary  
**Correção:** Movidos todos hooks para início de `AreaAutenticada` em `App.jsx`  
**Status:** Aplicado e validado (build passou)

### ✅ Redirecionamento Durante Digitação
**Problema:** `useEffect` sem flag de controle causava loop  
**Correção:** Adicionado `processandoOnboarding` flag em `OnboardingSimples.jsx`  
**Status:** Aplicado

---

## Histórico de Erros Corrigidos

1. ❌ `permission denied for table categorias` → ✅ CORRIGIDO (GRANT aplicado)
2. ❌ `permission denied for table perfis` → ⏳ PENDENTE (SQL pronto, aguardando execução)
3. ❌ `Could not find 'saldo_base' column` → ⏳ PENDENTE (SQL pronto, aguardando execução)
4. ❌ ErrorBoundary - hooks after return → ✅ CORRIGIDO (hook ordering fix)

---

## Arquivos Criados Nesta Sessão

- ✅ `supabase/migrations/2026-11_perfis_saldo_base.sql` - Migration para Supabase CLI
- ✅ `EXECUTAR_CORRECAO_PERFIS_DEV.sql` - Script para Dashboard (uso manual)
- ✅ `consultar-estrutura-perfis.mjs` - Diagnóstico de colunas
- ✅ `validar-correcao-perfis.mjs` - Validação pós-correção
- ✅ `DIAGNOSTICO_ERRO_SALDO_BASE.md` - Este documento

---

## Próximos Passos

### Imediato (DEV)
1. ⏳ **Usuário executar** `EXECUTAR_CORRECAO_PERFIS_DEV.sql` no Dashboard
2. ⏳ Validar com `node validar-correcao-perfis.mjs`
3. ⏳ Testar onboarding manualmente no navegador
4. ⏳ Executar testes automatizados Playwright (após fix de instalação)

### Futuro (Produção)
1. ⚠️ **NÃO aplicar em produção ainda**
2. Aguardar validação completa em DEV
3. Criar checklist de deploy para produção
4. Aplicar migration via Supabase CLI ou Dashboard (com backup)

---

## Segurança

### ✅ Isolamento DEV/Produção Mantido
- DEV: `gxfcfpdwyjqcrfssxgbi.supabase.co`
- Produção: `ievccupeijzuzhomphwn.supabase.co` (intocada)

### ✅ Permissões Adequadas
- `GRANT` apenas para role `authenticated`
- RLS policies existentes permanecem ativas
- Sem uso de `service_role` no frontend

### ✅ Rollback Disponível
Comentários no SQL incluem comandos de rollback:
```sql
REVOKE UPDATE (saldo_base, saldo_base_data) ON TABLE public.perfis FROM authenticated;
ALTER TABLE public.perfis DROP COLUMN IF EXISTS saldo_base, DROP COLUMN IF EXISTS saldo_base_data;
```

---

## Contato

**Responsável:** Usuário deve executar SQL manualmente  
**Ambiente:** Supabase DEV (gxfcfpdwyjqcrfssxgbi)  
**Documentação:** Este arquivo + comentários nos scripts SQL
