# AUDITORIA ESTRUTURA BANCO — COMPARAÇÃO SETUP vs REALIDADE

**Data:** $(Get-Date -Format "yyyy-MM-dd HH:mm")  
**Fonte:** `supabase/migrations/` (38 arquivos, 5.345 linhas)

---

## RESUMO EXECUTIVO

**SETUP_DEV_NOVO.sql proposto:** 8 tabelas, 287 linhas  
**Estrutura real do aplicativo:** 30+ tabelas, 5.345+ linhas  

**❌ INCOMPATIBILIDADE CRÍTICA DETECTADA**

O script proposto cria apenas **26% da estrutura real** utilizada pelo aplicativo em produção.

---

## TABELAS NO SCHEMA.SQL BASE (9 tabelas)

✅ Presentes no SETUP_DEV_NOVO.sql:

1. ✅ `perfis` — Dados do usuário (parcial: faltam 2 colunas)
2. ✅ `categorias` — Categorias de despesas/receitas
3. ✅ `receitas` — Receitas do usuário
4. ✅ `cartoes` — Cartões de crédito
5. ✅ `despesas` — Despesas do usuário
6. ✅ `compras_cartao` — Compras parceladas no cartão
7. ✅ `investimentos` — Investimentos do usuário (estrutura antiga)
8. ✅ `cenarios_financeiros` — Simulações financeiras

❌ Ausentes no SETUP_DEV_NOVO.sql:

9. ❌ `despesas_tipo_excecoes` — Exceções mensais de tipo fixa/variável
10. ❌ `parcelamentos` — Parcelamentos e financiamentos
11. ❌ `metas` — Metas financeiras

---

## TABELAS CRIADAS POR MIGRAÇÕES (21+ tabelas AUSENTES)

### Benefícios (VR/VA) — 2026-10_beneficios.sql
❌ `beneficios` — Cartões VR/VA/VT  
❌ `beneficios_movimentacoes` — Histórico de uso de benefícios

### Amortizações — 2026-10_amortizacoes.sql
❌ `amortizacoes` — Histórico de amortizações de financiamentos

### Faturas — 2026-10_faturas_cartao_*.sql
❌ `faturas_cartao` — Faturas mensais dos cartões

### Investimentos Avançados — 2026-10_investimentos*.sql
❌ `investimentos_movimentacoes` — Aportes e resgates  
❌ `metas_investimentos` — Metas de investimento por tipo

### Consultoria — 2026-10_consultoria*.sql
❌ `consultoria_interesses` — Solicitações de consultoria  
❌ `consultoria_acessos` — Acessos de consultores aos dados  
❌ `agendamentos` — Agendamentos de consultorias

### Push Notifications — 2026-10_push_subscriptions.sql
❌ `push_subscriptions` — Inscrições de push  
❌ `push_envios_log` — Log de envios de notificações

### Notificações — 2026-10_notificacoes_lidas.sql
❌ `notificacoes_lidas` — Controle de notificações lidas

### Feedbacks — 2026-10_feedbacks.sql
❌ `feedbacks` — Feedbacks dos usuários

### Importações — 2026-11_importacoes.sql
❌ `importacoes` — Importações de OFX/CSV  
❌ `importacoes_itens` — Itens individuais de importações

### Almeida Família — 20261119000001_familia_whatsapp_base.sql
❌ `subscription_plans` — Planos de assinatura (Free/Premium/Plus)  
❌ `family_groups` — Grupos familiares  
❌ `family_members` — Membros dos grupos  
❌ `family_invitations` — Convites para grupos  
❌ `family_expense_splits` — Divisão de despesas entre membros  
❌ `family_split_participants` — Participantes de splits  
❌ `family_goals` — Metas compartilhadas do grupo

### Administração — 2026-10_admin_core.sql
❌ **FUNÇÃO RPC:** `e_admin()` — Verifica se usuário é admin  
❌ **FUNÇÃO RPC:** `listar_todos_usuarios()` — Lista usuários (admin only)

---

## COLUNAS AUSENTES EM TABELAS PRESENTES

### perfis (2 colunas ausentes)
✅ Presentes: nome, email, reserva_*, saldo_base, modo_limite, comece_por_aqui_dispensado  
❌ **AUSENTES:**
- `subscription_plan` (TEXT FK → subscription_plans) — Plano Free/Premium/Plus
- `plano_override` (BOOLEAN) — Override manual de acesso Premium

### investimentos (estrutura desatualizada)
❌ Ausente sistema completo de movimentações e metas (migration 2026-10_investimentos_rpc.sql — 508 linhas)

---

## FUNÇÕES RPC AUSENTES (CRÍTICO)

### Administração
❌ `e_admin()` — Verifica se usuário tem papel admin  
❌ `listar_todos_usuarios()` — Lista todos os usuários (admin)

### Investimentos
❌ `calcular_projecoes_investimentos()` — Projeta rentabilidade futura  
❌ `calcular_metas_investimentos()` — Calcula progresso de metas

### Dados do Usuário
❌ `zerar_dados_financeiros()` — Limpa dados do usuário (mantém perfil)

### Família
❌ `tem_acesso_premium()` — Verifica acesso a funcionalidades Premium

---

## TRIGGERS AUSENTES

✅ Presente no SETUP: `on_auth_user_created` → `criar_perfil_automaticamente()`

❌ **AUSENTES:**
- Atualização de `atualizado_em` em várias tabelas
- Recálculo automático de metas ao adicionar movimentações
- Validações de integridade entre family_* tabelas

---

## POLÍTICAS RLS AUSENTES (ISOLAMENTO INCOMPLETO)

O SETUP cria ~15 políticas básicas, mas faltam:

❌ Políticas de leitura compartilhada (family_groups)  
❌ Políticas de admin (bypass para função e_admin())  
❌ Políticas de consultoria (acessos temporários com consultoria_acessos)  
❌ Validações de plano (Premium-only features)

---

## ÍNDICES AUSENTES (PERFORMANCE)

O SETUP não cria índices. Migrações criam ~20 índices:

❌ `idx_family_members_group` ON family_members(group_id)  
❌ `idx_family_members_user` ON family_members(user_id)  
❌ `idx_compras_cartao_usuario_cartao` ON compras_cartao(usuario_id, cartao_id)  
❌ `idx_despesas_usuario_data` ON despesas(usuario_id, data)  
❌ Muitos outros...

---

## DADOS INICIAIS AUSENTES

✅ SETUP insere: 11 categorias padrão (sistema)

❌ **AUSENTES:**
- Planos de assinatura (Free, Premium, Plus) em `subscription_plans`
- Configurações default de notificações
- Categorias expandidas de receita (migration 2026-11_categorias_receita_expandidas.sql)

---

## IMPACTO NOS TESTES E2E

### ✅ FUNCIONARIAM (estrutura presente no SETUP)
- Onboarding básico (saldo inicial)
- Criação de despesas simples (dinheiro/pix)
- Criação de receitas
- Dashboard básico (saldo)

### ❌ FALHARIAM (estrutura ausente)
- **Benefícios (VR/VA):** Código tenta gravar em `beneficios` inexistente → ERRO 42P01
- **Despesas em cartão:** Sem `faturas_cartao` → fatura não gerada
- **Parcelamentos:** Código tenta gravar em `parcelamentos` inexistente → ERRO
- **Investimentos:** RPC `calcular_projecoes_investimentos()` não existe → ERRO
- **Família:** Qualquer funcionalidade Premium → ERRO
- **Importações OFX:** Tabelas `importacoes*` inexistentes → ERRO
- **Push notifications:** Tabelas `push_*` inexistentes → ERRO
- **Feedbacks:** Tabela `feedbacks` inexistente → ERRO

### ⚠️ PASSARIAM FALSAMENTE (funcionalidade limitada)
- **Despesas recorrentes:** Exceções mensais de tipo não funcionam (tabela ausente), mas criação básica sim
- **Cartões:** Criação funciona, mas faturas não são geradas

---

## CONFLITOS ENTRE SETUP E MIGRAÇÕES

### 1. Duplicação de CREATE TABLE
Se rodar SETUP e depois migrações, haverá conflito em:
- `perfis` (colunas subscription_plan adicionadas 2x)
- `investimentos` (estrutura diferente)
- `categorias` (pode inserir categorias duplicadas)

### 2. Ordem de dependências
Migrações dependem de ordem específica:
- `subscription_plans` ANTES de alterar `perfis` (FK)
- `family_groups` ANTES de `family_members` (FK)
- `investimentos` ANTES de `investimentos_movimentacoes` (FK)

### 3. Funções RPC com assinatura diferente
Se houver versão antiga de função no SETUP e nova nas migrações, pode causar:
- `CREATE OR REPLACE FUNCTION` com parâmetros diferentes → ERRO
- Código chama função com assinatura nova mas DB tem antiga → ERRO

---

## SOLUÇÃO CORRETA

### ❌ NÃO USAR: SETUP_DEV_NOVO.sql
Cria ambiente incompleto que falhará em 70%+ das funcionalidades.

### ✅ USAR: Migrações oficiais em ordem

**Abordagem 1: Executar todas as migrações sequencialmente**

```sql
-- 1. Schema base
\i supabase/schema.sql

-- 2. Migrações em ordem cronológica (38 arquivos)
\i supabase/migrations/2026-10_admin_core.sql
\i supabase/migrations/2026-10_amortizacoes.sql
\i supabase/migrations/2026-10_beneficios.sql
-- ... (restante das 38 migrações)
\i supabase/migrations/20261119000002_perfis_security_fix.sql
```

**Tempo estimado:** 10 minutos  
**Risco:** Baixo (migrações foram desenhadas para serem idempotentes)

---

**Abordagem 2: Script consolidado (RECOMENDADO)**

Criar `SETUP_DEV_COMPLETO.sql` que:
1. Lê schema.sql completo
2. Concatena todas as 38 migrações em ordem
3. Remove duplicações (IF NOT EXISTS já protege)
4. Adiciona validação ao final

**Vantagem:** 1 arquivo, 1 execução, estrutura 100% compatível  
**Desvantagem:** Arquivo grande (~6.000 linhas)

---

## PRÓXIMOS PASSOS

**O que você prefere?**

### Opção A: Script consolidado (1 arquivo, 6k linhas)
✅ Mais simples (1 execução)  
✅ 100% compatível  
⚠️ Arquivo grande

### Opção B: Executar 39 migrações manualmente (schema + 38 migrations)
✅ Usa arquivos originais  
✅ Rastreabilidade completa  
⚠️ 39 execuções no SQL Editor

### Opção C: Script consolidado + validação
✅ 1 execução  
✅ Valida estrutura ao final  
✅ Relatório de sucesso/falha  
⚠️ Preciso criar o script (~30 min)

---

**AGUARDANDO SUA DECISÃO:**
- Opção A, B ou C?
- Após escolher, configuro o ambiente DEV e executo testes E2E completos.

---

## TABELAS FINAIS ESPERADAS (30+)

**Core (9):**
perfis, categorias, receitas, despesas, despesas_tipo_excecoes, cartoes, compras_cartao, parcelamentos, metas

**Benefícios (2):**
beneficios, beneficios_movimentacoes

**Investimentos (3):**
investimentos, investimentos_movimentacoes, metas_investimentos

**Financiamentos (2):**
parcelamentos, amortizacoes

**Faturas (1):**
faturas_cartao

**Consultoria (3):**
consultoria_interesses, consultoria_acessos, agendamentos

**Notificações (3):**
push_subscriptions, push_envios_log, notificacoes_lidas

**Administração (1):**
feedbacks

**Importações (2):**
importacoes, importacoes_itens

**Família/Premium (7):**
subscription_plans, family_groups, family_members, family_invitations, family_expense_splits, family_split_participants, family_goals

**TOTAL: 33 tabelas + ~20 funções RPC + ~50 políticas RLS + ~20 índices**
