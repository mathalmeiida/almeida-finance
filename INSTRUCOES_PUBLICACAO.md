# Instruções para Publicação - Almeida Finance

## 🔍 Confirmação Necessária

**ANTES de executar qualquer SQL**, confirme que o projeto "almeidafinance" no Supabase corresponde ao ambiente de PRODUÇÃO:

1. Acesse: https://supabase.com/dashboard/project/almeidafinance/settings/general
2. Localize "Reference ID" 
3. **Confirme que é: `ievccupeijzuzhomphwn`**

---

## 📊 Situação Atual

### DEV (gxfcfpdwyjqcrfssxgbi)
✅ 12 colunas na tabela `perfis`  
✅ RLS configurado corretamente  
✅ Testes 16/16 PASS  

### PROD (ievccupeijzuzhomphwn - a confirmar)
❌ Apenas 4 colunas: `id`, `nome`, `email`, `criado_em`  
❌ **Faltam 8 colunas** requeridas pelo código  

---

## ⚠️ Impacto se Publicar SEM Migration

Se você fizer deploy na Vercel agora **sem** aplicar a migration SQL primeiro:

- ❌ App quebra imediatamente ao carregar
- ❌ 37 referências a `onboarding_concluido` falharão
- ❌ Usuários não conseguirão salvar `saldo_base`
- ❌ Onboarding não funcionará (colunas ausentes)

---

## ✅ Passo a Passo CORRETO

### 1️⃣ Aplicar Migration no Supabase PRODUÇÃO

**Arquivo:** `MIGRATION_PROD_PERFIS.sql` (na raiz do projeto)

**Como executar:**
1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/editor
2. Clique em "SQL Editor" (ícone `</>`)
3. Clique "New query"
4. Abra `MIGRATION_PROD_PERFIS.sql` e **copie TODO o conteúdo**
5. Cole no SQL Editor
6. Clique "Run" (ou Ctrl+Enter)
7. Aguarde mensagens de sucesso:
   ```
   ✅ Total de colunas na tabela perfis: 12
   ✅ Total de políticas RLS: 5
   ```

**Características da migration:**
- ✅ 100% idempotente (pode executar múltiplas vezes)
- ✅ Preserva todos os dados existentes
- ✅ Não modifica usuários existentes
- ✅ Adiciona proteção contra escalação de privilégios

---

### 2️⃣ Validar Schema PRODUÇÃO

Após executar a migration, ainda no SQL Editor, execute:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'perfis' AND table_schema = 'public'
ORDER BY ordinal_position;
```

**Resultado esperado:** 12 linhas (colunas)

---

### 3️⃣ Publicar na Vercel

Apenas **DEPOIS** de confirmar que a migration foi aplicada com sucesso:

```bash
# 1. Adicionar arquivos modificados
git add src/App.jsx src/pages/OnboardingSimples.jsx

# 2. Criar commit
git commit -m "fix(onboarding): corrigir hooks e loop de redirecionamento

- Move hooks antes de retornos condicionais em App.jsx (React Hook Rules)
- Adiciona flag processandoOnboarding para evitar loop em OnboardingSimples.jsx
- Mantém compatibilidade com schema Supabase atualizado (12 colunas perfis)"

# 3. Push para main
git push origin main

# 4. Deploy na Vercel (automático ou manual)
vercel --prod
```

---

## 📋 Colunas Adicionadas pela Migration

| Coluna | Tipo | Origem | Uso |
|--------|------|--------|-----|
| `papel` | TEXT | admin_core | 'user' ou 'admin' |
| `ativo` | BOOLEAN | admin_core | Status da conta |
| `ultimo_acesso` | TIMESTAMPTZ | admin_core | Último login |
| `onboarding_concluido` | BOOLEAN | admin_core | Flag onboarding (37 refs) |
| `objetivos_financeiros` | TEXT | onboarding_perfil | Objetivos escolhidos |
| `onboarding_etapa` | TEXT | onboarding_perfil | Etapa atual |
| `saldo_base` | NUMERIC(15,2) | perfis_saldo_base | Saldo inicial |
| `saldo_base_data` | DATE | perfis_saldo_base | Data referência |

---

## 🛡️ Segurança Implementada

A migration adiciona:

1. **Função `e_admin()`**: Verifica se usuário é admin (evita recursão RLS)
2. **Policies RLS**: 
   - Usuário lê/atualiza apenas próprio perfil
   - Admin vê/atualiza todos os perfis
3. **Trigger anti-escalação**: Admin não pode desativar própria conta
4. **GRANT por coluna**: UPDATE permitido apenas em colunas específicas (exclui `papel` e `ativo`)

---

## 🚨 Se Algo Der Errado

Se após o deploy houver problema:

1. **Reverter deploy:**
   ```bash
   vercel rollback
   ```

2. **Verificar logs:**
   ```bash
   vercel logs --prod
   ```

3. **Validar schema:**
   - Confirme que produção tem as 12 colunas
   - Confirme que RLS está ativo (`relrowsecurity = TRUE`)

---

## ✅ Checklist Final

Antes de publicar, confirme:

- [ ] Reference ID do projeto almeidafinance é `ievccupeijzuzhomphwn`
- [ ] Migration `MIGRATION_PROD_PERFIS.sql` executada com sucesso
- [ ] Query de validação retornou 12 colunas
- [ ] Build local passou (`dist/index.html` existe)
- [ ] Nenhum secret em arquivos staged
- [ ] Commit criado com mensagem descritiva
- [ ] Push executado sem erros

---

**Arquivos prontos:**
- ✅ `MIGRATION_PROD_PERFIS.sql` (SQL idempotente para produção)
- ✅ `src/App.jsx` (hooks corrigidos)
- ✅ `src/pages/OnboardingSimples.jsx` (loop corrigido)
- ✅ `dist/` (build pronto)
