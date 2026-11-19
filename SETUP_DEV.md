# Setup Ambiente DEV - Almeida Finance

## Status
✅ Arquivo `.env.development.local` criado  
⚠️ ANON_KEY pendente (inserir manualmente)  
❌ Migrations base NÃO aplicadas no DEV  
❌ Migrations Família NÃO aplicadas no DEV  

---

## Passo 1: Inserir Anon Key do Projeto DEV

**Arquivo**: `.env.development.local`

1. Acessar painel Supabase DEV: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc
2. Ir em Settings > API
3. Copiar `anon` `public` key
4. Substituir em `.env.development.local`:

```env
VITE_SUPABASE_ANON_KEY=eyJhbG...  # Colar chave aqui
```

**NÃO commitar este arquivo** (já protegido por `.gitignore`).

---

## Passo 2: Aplicar Migrations Base no Projeto DEV

⚠️ **ATENÇÃO**: Executar APENAS no projeto DEV (`fzawugbiojmtrthmshcc`)

### Via Painel Supabase (SQL Editor)

Acessar: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc/sql/new

Executar migrations **nesta ordem** (copiar conteúdo e executar uma por vez):

#### Grupo 1: Estrutura Base (OBRIGATÓRIO)
```
1. 2026-10_admin_core.sql
   → Cria tabela perfis, policies básicas
   
2. 2026-10_feedbacks.sql
   → Tabela feedbacks (não crítica para Família)
```

#### Grupo 2: Estrutura Financeira (OBRIGATÓRIO)
```
3. 2026-10_despesa_cartao_vinculo.sql
   → Despesas e cartões
   
4. 2026-10_receitas_recorrencia.sql
   → Receitas
   
5. 2026-10_compras_cartao_subcategoria.sql
   → Compras de cartão
   
6. 2026-10_parcelamentos_tipo.sql
   → Parcelamentos
   
7. 2026-10_faturas_cartao_pagamento.sql
8. 2026-10_faturas_cartao_total.sql
   → Faturas de cartão
```

#### Grupo 3: Features Auxiliares (OPCIONAL - pode pular)
```
9. 2026-10_cor_tema.sql
10. 2026-10_cor_tema_fix_check.sql
11. 2026-10_cor_tema_modos.sql
12. 2026-10_cor_tema_preto.sql
    → Temas de cor (UI)

13. 2026-10_beneficios.sql
    → Benefícios (não usado em Família)

14. 2026-10_consultoria_acessos.sql
15. 2026-10_consultoria_e_agenda.sql
    → Consultoria (não relacionado)

16. 2026-10_amortizacoes.sql
17. 2026-10_investimentos.sql
18. 2026-10_investimentos_rpc.sql
19. 2026-10_metas_investimentos.sql
    → Investimentos (não relacionado)

20. 2026-10_push_subscriptions.sql
    → Notificações push

21. 2026-10_notificacoes_lidas.sql
    → Notificações

22. 2026-10_reserva_configurada.sql
23. 2026-10_limite_diario.sql
    → Configs financeiras

24. 2026-11_onboarding_perfil.sql
25. 2026-11_perfil_foto_avatar.sql
    → Perfil de usuário

26. 2026-11_atalhos_home.sql
    → UI

27. 2026-11_categorias_receita_expandidas.sql
    → Categorias

28. 2026-11_importacoes.sql
    → Importação de dados
```

#### Grupo 4: RPCs de Limpeza (OPCIONAL)
```
29. 2026-11_rpc_zerar_dados_financeiros_FINAL_LIMPO.sql
    → Função de reset (útil para testes)
```

---

## Passo 3: Aplicar Migrations Almeida Família

⚠️ **Dependências**: Grupo 1 e 2 devem estar aplicados

### Via Painel Supabase (SQL Editor)

**Ordem obrigatória**:

```sql
-- 1. Base de Família e WhatsApp
-- Arquivo: supabase/migrations/20261119000001_familia_whatsapp_base.sql
-- Cria 12 tabelas + function tem_acesso_premium()

-- 2. Triggers de segurança (opcional)
-- Arquivo: supabase/migrations/20261119000002_perfis_security_fix.sql
-- Valida alterações em subscription_plan
```

**Tempo estimado**: 5-10 segundos cada

---

## Passo 4: Validar Estrutura

Executar no SQL Editor do DEV:

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'family%'
ORDER BY table_name;

-- Deve retornar:
-- family_activity_log
-- family_expense_splits
-- family_groups
-- family_invitations
-- family_members
-- family_split_participants

-- Verificar colunas adicionadas em perfis
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'perfis'
  AND column_name IN ('subscription_plan', 'plano_override');

-- Deve retornar 2 linhas

-- Verificar function
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name = 'tem_acesso_premium';

-- Deve retornar 1 linha
```

---

## Passo 5: Executar Build Local com DEV

```powershell
cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"

# Executar em modo development (usa .env.development.local)
npm run dev
```

**Verificações**:
1. Console do navegador não mostra erros de Supabase
2. Login funciona
3. Dados de produção NÃO aparecem
4. URL de requisições mostra `fzawugbiojmtrthmshcc`

---

## Passo 6: Confirmar Project ID

Abrir DevTools > Network > filtrar "supabase"

Todas as requisições devem ir para:
```
https://fzawugbiojmtrthmshcc.supabase.co/rest/v1/...
```

Se aparecer `ievccupeijzuzhomphwn` → **PARAR IMEDIATAMENTE** (está em produção)

---

## Precedência de Arquivos .env no Vite

```
npm run dev → mode=development
  1. .env.development.local  ← CRIADO (DEV)
  2. .env.development
  3. .env.local              ← PRODUÇÃO
  4. .env

npm run build → mode=production
  1. .env.production.local
  2. .env.production
  3. .env.local              ← PRODUÇÃO
  4. .env
```

✅ `npm run dev` usará `.env.development.local` (DEV)  
✅ `npm run build` usará `.env.local` (PRODUÇÃO)

---

## Migrations Pendentes para Aplicar no DEV

### Obrigatórias (ordem):
1. `2026-10_admin_core.sql` - Tabela perfis
2. `2026-10_despesa_cartao_vinculo.sql` - Despesas
3. `2026-10_receitas_recorrencia.sql` - Receitas
4. `20261119000001_familia_whatsapp_base.sql` - Almeida Família
5. `20261119000002_perfis_security_fix.sql` - Segurança

### Opcionais (melhoram UX mas não bloqueiam):
- Temas, investimentos, consultoria, etc.

---

## Segurança

✅ `.env.development.local` em `.gitignore`  
✅ `.env.local` (produção) preservado  
✅ Comandos nunca apontam para produção  
❌ Não executar `supabase link` sem confirmar project-ref  
❌ Não executar SQL de produção no DEV  
❌ Não copiar dados reais para DEV  

---

## Troubleshooting

### Erro: "Variáveis de ambiente do Supabase não encontradas"
- Verificar se `.env.development.local` existe
- Verificar se `VITE_SUPABASE_ANON_KEY` foi preenchida
- Reiniciar `npm run dev`

### Aplicação carrega dados de produção
- Confirmar que está rodando `npm run dev` (não `npm run build`)
- Verificar Network tab: URL deve ser `fzawugbiojmtrthmshcc`
- Deletar `.env.development` se existir (prioridade menor)

### Migration falha: "relation perfis does not exist"
- Aplicar `2026-10_admin_core.sql` primeiro
- Verificar ordem das migrations

### Erro RLS: "new row violates row-level security policy"
- Usuário de teste não tem permissão
- Verificar se policies foram criadas
- Executar como service_role (apenas para debug)

---

## Próximos Passos Após Setup

1. ✅ Confirmar Project ID = fzawugbiojmtrthmshcc
2. ✅ Criar 2 contas de teste no DEV
3. ✅ Executar casos de teste (TESTE_CALENDARIO_FAMILIAR.md)
4. ✅ Validar RLS (TESTE_RLS.sql adaptado)
5. ✅ Build final
6. ✅ Commit das correções encontradas
