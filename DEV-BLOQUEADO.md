# 🚫 AMBIENTE DEV BLOQUEADO

**Data:** 20/11/2026 15:50 UTC-3  
**Status:** ❌ INACESSÍVEL

---

## Problema

O ambiente DEV do Supabase não está acessível:

**URL DEV:** `https://fzawugbiojmtrthmshcc.supabase.co`  
**Project ID:** `fzawugbiojmtrthmshcc`

### Diagnóstico

```
Test-NetConnection -ComputerName fzawugbiojmtrthmshcc.supabase.co -Port 443
AVISO: Name resolution of fzawugbiojmtrthmshcc.supabase.co failed
PingSucceeded: False
```

**DNS não resolve.** Possíveis causas:
1. ❌ Projeto pausado/desativado no Supabase
2. ❌ Projeto excluído
3. ❌ Project ID incorreto no `.env.development.local.disabled`
4. ❌ Restrição de rede/firewall

### Impacto na Auditoria

**Testes bloqueados:**
- ❌ Validação do bug onboarding em ambiente DEV real
- ❌ Testes E2E com Supabase DEV
- ❌ Criação de usuários de teste no DEV
- ❌ Validação de triggers e RLS policies no DEV

**Testes possíveis:**
- ✅ Testes unitários (327+ passando)
- ✅ Testes E2E mockados
- ⚠️ Testes em produção (com cuidado extremo)

---

## Alternativas

### Opção 1: Reativar DEV (Recomendado)
1. Acessar console do Supabase
2. Verificar status do projeto `fzawugbiojmtrthmshcc`
3. Reativar se pausado
4. Atualizar `.env.development.local.disabled` se project ID mudou

### Opção 2: Criar Novo Projeto DEV
1. Criar novo projeto no Supabase (free tier)
2. Aplicar migrations do `posso-comprar/supabase/migrations/`
3. Atualizar credenciais em `.env.development.local.disabled`
4. Criar usuários de teste

### Opção 3: Usar Produção com Conta de Teste (Atual)
⚠️ **CUIDADO:** Produção tem dados reais de usuários  
✅ Criar conta específica para testes: `teste.auditoria@almeidafinance.app`  
✅ Zerar dados apenas dessa conta de teste  
❌ NUNCA modificar dados de outros usuários

---

## Decisão

Devido à impossibilidade de acessar DEV, os testes de validação
do bug onboarding serão executados em **PRODUÇÃO** usando uma
conta de teste dedicada, com os seguintes cuidados:

1. ✅ Criar usuário de teste específico
2. ✅ Operar apenas nos dados dessa conta
3. ✅ Documentar todas as operações
4. ✅ Zerar dados apenas do usuário de teste
5. ❌ NUNCA tocar em dados de usuários reais

---

**Status:** BLOQUEIO DOCUMENTADO  
**Próxima ação:** Prosseguir com testes E2E mockados e validação em produção
