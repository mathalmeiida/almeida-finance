# 🔐 AUDITORIA COMPLETA: Políticas RLS

## RESUMO DE PROBLEMAS ENCONTRADOS

### 🚨 CRÍTICO: Ordem de Criação de Tabelas

**Problema:** `despesas.cartao_id` referencia `cartoes.id`, mas `cartoes` é criado DEPOIS.

**Linha 227 (despesas):**
```sql
cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
```

**Linha 439 (cartoes):**
```sql
CREATE TABLE IF NOT EXISTS public.cartoes (
```

**Impacto:** O SQL falhará com erro:
```
ERROR: relation "public.cartoes" does not exist
```

---

## ANÁLISE POR TABELA

### 1. TABELA: perfis (linhas 24-85)

**RLS:** ✅ Habilitado (linha 72)

**Políticas (3):**
- ✅ SELECT: `auth.uid() = id` (linha 74-76)
- ✅ INSERT: `auth.uid() = id` (linha 78-80)
- ✅ UPDATE: `auth.uid() = id` (linha 82-84)

**❌ FALTA:** DELETE policy (usuário não pode apagar o próprio perfil?)

**✅ Segurança:** Usuário acessa apenas o próprio perfil. Correto.

---

### 2. TABELA: categorias (linhas 92-124)

**RLS:** ✅ Habilitado (linha 104)

**Políticas (4):**
- ✅ SELECT: `usuario_id IS NULL OR auth.uid() = usuario_id` (linha 106-108)
  - ✅ Permite ver categorias do sistema (NULL)
  - ✅ Permite ver categorias próprias
- ✅ INSERT: `auth.uid() = usuario_id` (linha 110-112)
- ✅ UPDATE: `auth.uid() = usuario_id` (linha 114-116)
- ✅ DELETE: `auth.uid() = usuario_id` (linha 118-120)

**⚠️ ATENÇÃO:** A policy INSERT/UPDATE/DELETE permite apenas categorias próprias.
- ✅ Correto: Usuário NÃO pode alterar categorias do sistema (NULL).
- ✅ Correto: Usuário NÃO pode criar categorias com usuario_id de outro usuário.

**✅ Segurança:** Adequada.

---

### 3. TABELA: subcategorias (linhas 126-159)

**RLS:** ✅ Habilitado (linha 138)

**Políticas (4):**
- ✅ SELECT: `auth.uid() = usuario_id` (linha 140-142)
- ✅ INSERT: `auth.uid() = usuario_id` (linha 144-146)
- ✅ UPDATE: `auth.uid() = usuario_id` + WITH CHECK (linha 148-151)
- ✅ DELETE: `auth.uid() = usuario_id` (linha 153-155)

**❌ PROBLEMA:** Subcategorias do sistema não são suportadas.
- Policy SELECT só permite `usuario_id = auth.uid()`
- Se existissem subcategorias do sistema (`usuario_id IS NULL`), ninguém veria.

**⚠️ DECISÃO DE DESIGN:**
- Se subcategorias forem SEMPRE personalizadas: ✅ OK
- Se subcategorias do sistema forem necessárias: ❌ Ajustar policy

**✅ Segurança:** Adequada para o modelo atual (sem subcategorias do sistema).

---

### 4. TABELA: receitas (linhas 161-191)

**RLS:** ✅ Habilitado (linha 184)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 186-189)
  - Cobre SELECT, INSERT, UPDATE, DELETE

**✅ Segurança:** Usuário gerencia apenas as próprias receitas. Correto.

---

### 5. TABELA: despesas (linhas 193-286)

**RLS:** ✅ Habilitado (linha 262)

**Políticas (4):**
- ✅ SELECT: `auth.uid() = usuario_id` (linha 268-270)
- ✅ INSERT: Validação complexa (linha 272-281)
  ```sql
  auth.uid() = usuario_id
  AND (
    cartao_id IS NULL
    OR EXISTS (SELECT 1 FROM public.cartoes c
               WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
  )
  ```
  - ✅ Valida que `cartao_id` (se preenchido) pertence ao próprio usuário
  - ✅ Impede vincular despesa a cartão de terceiro
  
- ✅ UPDATE: Mesma validação (linha 283-293)
- ✅ DELETE: `auth.uid() = usuario_id` (linha 295-297)

**🚨 PROBLEMA CRÍTICO:**
A policy INSERT/UPDATE faz `EXISTS (SELECT 1 FROM public.cartoes ...)`, mas:
1. Se `cartoes` não existir ainda (ordem de criação errada), a policy falhará
2. A policy depende de `cartoes` estar criada ANTES

**✅ Segurança:** EXCELENTE — impede ataques de vinculação a recursos de terceiros.

**❌ Ordem de Criação:** ERRADA — `cartoes` precisa existir antes de `despesas`.

---

### 6. TABELA: despesas_tipo_excecoes (linhas 288-307)

**RLS:** ✅ Habilitado (linha 301)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 303-306)

**✅ Segurança:** Adequada.

---

### 7. TABELA: parcelamentos (linhas 309-360)

**RLS:** ✅ Habilitado (linha 354)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 356-359)

**✅ Segurança:** Adequada.

---

### 8. TABELA: metas (linhas 362-379)

**RLS:** ✅ Habilitado (linha 373)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 375-378)

**✅ Segurança:** Adequada.

---

### 9. TABELA: cartoes (linhas 439-454)

**RLS:** ✅ Habilitado (linha 448)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 450-453)

**✅ Segurança:** Adequada.

**🚨 ORDEM:** Precisa ser criada ANTES de `despesas` e `compras_cartao`.

---

### 10. TABELA: compras_cartao (linhas 464-480)

**RLS:** ✅ Habilitado (linha 474)

**Políticas (1):**
- ✅ ALL: `auth.uid() = usuario_id` (linha 476-479)

**⚠️ VALIDAÇÃO FALTANDO:**
Similar a `despesas`, deveria validar que `cartao_id` pertence ao usuário:

```sql
CREATE POLICY "compras_cartao: inserir/atualizar (dono + cartão do dono)"
  ON public.compras_cartao FOR INSERT
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (SELECT 1 FROM public.cartoes c
                WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
  );
```

**❌ VULNERABILIDADE:** Usuário pode vincular compra ao cartão de outro usuário.

**🔥 ATAQUE POSSÍVEL:**
1. Alice obtém o UUID do cartão de Bob (via engenharia social, vazamento, etc.)
2. Alice cria uma compra no próprio registro mas com `cartao_id` do cartão de Bob
3. Alice consegue ver informações do cartão de Bob (limite, fatura, etc.)

**❌ Segurança:** INADEQUADA — falta validação de ownership de `cartao_id`.

---

## 📊 RESUMO DAS POLÍTICAS RLS

| Tabela | Policies | RLS | Segurança | Problemas |
|--------|----------|-----|-----------|-----------|
| perfis | 3 | ✅ | ✅ | ⚠️ Falta DELETE |
| categorias | 4 | ✅ | ✅ | - |
| subcategorias | 4 | ✅ | ✅ | ⚠️ Sem suporte a sistema |
| receitas | 1 | ✅ | ✅ | - |
| despesas | 4 | ✅ | ✅ | 🚨 Ordem de criação |
| despesas_tipo_excecoes | 1 | ✅ | ✅ | - |
| parcelamentos | 1 | ✅ | ✅ | - |
| metas | 1 | ✅ | ✅ | - |
| cartoes | 1 | ✅ | ✅ | 🚨 Criado tarde demais |
| compras_cartao | 1 | ✅ | ❌ | 🔥 Vulnerabilidade |

**Total de policies:** 21 ✅

---

## 🚨 PROBLEMAS CRÍTICOS

### 1. ORDEM DE CRIAÇÃO (BLOCKER)

**Tabelas com dependências:**
- `despesas.cartao_id` → `cartoes.id`
- `compras_cartao.cartao_id` → `cartoes.id`
- `compras_cartao.subcategoria_id` → `subcategorias.id`

**Ordem atual (ERRADA):**
```
despesas (linha 193) → referencia cartoes
cartoes (linha 439)  → criado DEPOIS
```

**Correção necessária:**
```
1. perfis
2. categorias
3. subcategorias
4. receitas
5. cartoes       ⬅ MOVER PARA AQUI
6. despesas
7. despesas_tipo_excecoes
8. parcelamentos
9. metas
10. compras_cartao
```

---

### 2. VULNERABILIDADE: compras_cartao (CRÍTICO)

**Policy atual:**
```sql
CREATE POLICY "Usuário gerencia apenas as próprias compras de cartão"
  ON public.compras_cartao FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
```

**Problema:**
- Valida apenas `usuario_id`
- NÃO valida `cartao_id`
- Usuário pode vincular compra ao cartão de terceiro

**Correção necessária:**
```sql
-- SELECT: apenas compras próprias
CREATE POLICY "compras_cartao: ver (dono)"
  ON public.compras_cartao FOR SELECT
  USING (auth.uid() = usuario_id);

-- INSERT: valida cartão do dono
CREATE POLICY "compras_cartao: inserir (dono + cartão do dono)"
  ON public.compras_cartao FOR INSERT
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (SELECT 1 FROM public.cartoes c
                WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
  );

-- UPDATE: valida cartão do dono
CREATE POLICY "compras_cartao: atualizar (dono + cartão do dono)"
  ON public.compras_cartao FOR UPDATE
  USING (auth.uid() = usuario_id)
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (SELECT 1 FROM public.cartoes c
                WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
  );

-- DELETE: apenas compras próprias
CREATE POLICY "compras_cartao: apagar (dono)"
  ON public.compras_cartao FOR DELETE
  USING (auth.uid() = usuario_id);
```

---

## ✅ RECOMENDAÇÕES

1. **IMEDIATO:** Reordenar criação de tabelas (mover `cartoes` antes de `despesas`)
2. **CRÍTICO:** Corrigir policies de `compras_cartao` (validar ownership de `cartao_id`)
3. **MENOR:** Adicionar DELETE policy em `perfis` (se necessário)
4. **CONSIDERAR:** Suporte a subcategorias do sistema (se necessário)

---

**Status:** ❌ **NÃO EXECUTAR** até corrigir ordem e vulnerabilidade.
