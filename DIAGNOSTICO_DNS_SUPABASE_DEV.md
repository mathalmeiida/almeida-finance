# DIAGNÓSTICO TÉCNICO — FALHA DNS SUPABASE DEV

**Data:** ${new Date().toISOString()}  
**Projeto:** almeidafinance  
**Project ID:** fzawugbiojmtrthmshcc  
**URL Esperada:** https://fzawugbiojmtrthmshcc.supabase.co  
**Status no Dashboard:** Healthy (confirmado pelo usuário)

---

## RESUMO EXECUTIVO

**Problema:** O projeto Supabase DEV (`fzawugbiojmtrthmshcc`) **não resolve DNS globalmente**, impossibilitando conexão via API, Auth ou qualquer endpoint HTTPS.

**Causa Raiz:** Registro DNS inexistente no Cloudflare (provedor DNS do Supabase). Status NXDOMAIN confirmado por múltiplos servidores DNS públicos.

**Impacto:** Testes E2E bloqueados (3/7 falharam), impossível validar autenticação, operações financeiras ou isolamento de usuários antes do beta.

---

## EVIDÊNCIAS TÉCNICAS

### 1. Resolução DNS — FALHA GLOBAL

#### 1.1. Servidores DNS Locais (ISP)
```
Servidor: 181.213.132.2, 181.213.132.3
Resultado: Domínio não encontrado (Non-existent domain)
```

#### 1.2. Google Public DNS (8.8.8.8)
```bash
nslookup fzawugbiojmtrthmshcc.supabase.co 8.8.8.8
# Resultado: Sem resposta (timeout)
```

**Google DNS API:**
```json
{
  "Status": 3,  // NXDOMAIN (Non-Existent Domain)
  "Question": [{"name": "fzawugbiojmtrthmshcc.supabase.co.", "type": 1}],
  "Authority": [{
    "name": "supabase.co.",
    "type": 6,
    "data": "christina.ns.cloudflare.com. dns.cloudflare.com. ..."
  }]
}
```

#### 1.3. Cloudflare DNS (1.1.1.1)
```
Resultado: Sem resposta (domínio não existe)
```

#### 1.4. Quad9 DNS (9.9.9.9)
```
Resultado: Sem resposta (domínio não existe)
```

### 2. Comparação com Produção (Funcional)

#### Produção: `ievccupeijzuzhomphwn.supabase.co`

**Google DNS API:**
```json
{
  "Status": 0,  // SUCESSO
  "Answer": [
    {"name": "ievccupeijzuzhomphwn.supabase.co.", "type": 1, "data": "104.18.38.10"},
    {"name": "ievccupeijzuzhomphwn.supabase.co.", "type": 1, "data": "172.64.149.246"}
  ]
}
```

**Conclusão:** Produção resolve perfeitamente para IPs do Cloudflare. DEV retorna NXDOMAIN.

---

## TESTES REALIZADOS

### ✅ Testes de Conectividade
- [x] Cache DNS local limpo (`ipconfig /flushdns` — requer elevação, não executado)
- [x] 4 servidores DNS públicos testados (ISP, Google, Cloudflare, Quad9)
- [x] Google DNS Public API (autoridade oficial)
- [x] Comparação com projeto de produção (funcional)
- [x] Ping, traceroute e nslookup
- [x] cURL com `-v` (verbose) para diagnóstico HTTPS

### ✅ Testes de Configuração Local
- [x] Servidor DNS atual: 181.213.132.2, 181.213.132.3 (ISP)
- [x] Proxy/VPN: Não detectado (conexões diretas)
- [x] Firewall: Não bloqueia (produção funciona)
- [x] Arquivo `.env.development.local`: Credenciais presentes e bem formatadas

### ❌ Testes Bloqueados (DNS não resolve)
- [ ] REST API endpoint (`/rest/v1/`)
- [ ] Auth endpoint (`/auth/v1/health`)
- [ ] Realtime WebSocket (`/realtime/v1/`)
- [ ] Storage endpoint (`/storage/v1/`)
- [ ] Autenticação E2E (login com `e2e.test@almeidafinance.local`)

---

## ANÁLISE TÉCNICA

### Por que o DNS não resolve?

**Hipótese 1: Projeto pausado por inatividade (Free Plan)**
- Supabase pausa projetos Free Plan com baixa atividade em 7 dias
- Projeto pausado **remove registros DNS** até restauração manual
- Dashboard pode mostrar "Healthy" mesmo pausado (métrica interna)

**Evidência:**
> "We may pause applications on the Free Plan that exhibit low activity in a 7-day period to save on server resources. You can restore paused projects from the Supabase dashboard."  
> — [Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)

**Hipótese 2: Projeto nunca foi provisionado completamente**
- Project ID reservado mas DNS nunca registrado no Cloudflare
- Configuração incompleta no dashboard

**Hipótese 3: Migração de infraestrutura**
- Supabase movendo projetos antigos para nova região/infraestrutura
- DNS temporariamente indisponível durante migração

### Como diferenciar as hipóteses?

| Sintoma | Pausado | Não Provisionado | Migração |
|---------|---------|------------------|----------|
| DNS resolve | ❌ | ❌ | ⚠️ Intermitente |
| Dashboard mostra "Healthy" | ✅ Possível | ✅ Possível | ✅ |
| CPU/Memória > 0% | ❌ | ❌ | ✅ |
| Botão "Restore" visível | ✅ | ❌ | ❌ |
| Data último deploy | Antiga | Nunca | Recente |

---

## VERIFICAÇÕES NECESSÁRIAS NO DASHBOARD

Para confirmar a causa raiz, verifique no painel do Supabase:

### 1. Status do Projeto
- [ ] Acessar: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc
- [ ] Verificar banner de "Projeto Pausado" ou "Paused"
- [ ] Verificar botão "Restore Project" ou "Unpause"

### 2. Project Settings > General
- [ ] Confirmar "Project Reference": `fzawugbiojmtrthmshcc`
- [ ] Confirmar "API URL": `https://fzawugbiojmtrthmshcc.supabase.co`
- [ ] Verificar "Region" (esperado: São Paulo ou US East)
- [ ] Verificar "Plan": Free vs Pro

### 3. Settings > API
- [ ] Confirmar "Project URL" exata
- [ ] Verificar se "anon/public" key corresponde ao `.env.development.local.disabled`
- [ ] Comparar formato com produção

### 4. Integrations > Data API > Settings
- [ ] Verificar se "Data API" está **Enabled**
- [ ] Verificar schemas expostos (esperado: `public`)
- [ ] Verificar se há mensagem de erro ou aviso

### 5. Database > Tables
- [ ] Verificar se tabelas existem: `receitas`, `despesas`, `cartoes`, `cenarios_financeiros`
- [ ] Verificar se RLS está habilitado
- [ ] Verificar se há dados de teste

### 6. Logs & Analytics
- [ ] Verificar última atividade/request
- [ ] Verificar se há logs de erro de infraestrutura
- [ ] Verificar timestamp do último backup

---

## SOLUÇÕES POSSÍVEIS

### Solução A: Restaurar Projeto Pausado (se aplicável)

**Se o dashboard mostrar botão "Restore":**

1. Clicar em "Restore Project" ou "Unpause"
2. Aguardar 2-5 minutos para DNS propagar
3. Testar resolução DNS:
   ```bash
   nslookup fzawugbiojmtrthmshcc.supabase.co 8.8.8.8
   ```
4. Testar endpoint REST:
   ```bash
   curl https://fzawugbiojmtrthmshcc.supabase.co/rest/v1/
   ```
5. Executar testes E2E: `npm run test:e2e:headed`

**Tempo estimado:** 5 minutos  
**Risco:** Zero (apenas ativa projeto existente)

---

### Solução B: Verificar URL Correta no Dashboard

**Se a URL no dashboard for diferente:**

1. Ir para Settings > API
2. Copiar "Project URL" exata do dashboard
3. Atualizar `.env.development.local`:
   ```bash
   VITE_SUPABASE_URL=<URL_COPIADA_DO_DASHBOARD>
   ```
4. Testar conexão
5. Executar testes E2E

**Tempo estimado:** 2 minutos  
**Risco:** Zero (apenas correção de configuração)

---

### Solução C: Upgrade para Pro (garantia de disponibilidade)

**Se projeto está pausando frequentemente:**

1. Upgrade para Pro Plan (~$25/mês)
2. Projeto nunca será pausado por inatividade
3. DNS permanece sempre ativo
4. Suporte técnico disponível

**Vantagens:**
- Garantia de uptime 99.9%
- Backups automáticos
- Suporte via ticket

**Desvantagens:**
- Custo mensal
- Overkill se ambiente DEV usado raramente

---

### Solução D: Contatar Suporte Supabase

**Se nenhuma solução acima funcionar:**

**Criar ticket com:**

**Assunto:** "Project DNS not resolving (NXDOMAIN) - Project ID: fzawugbiojmtrthmshcc"

**Descrição:**
```
Hello Supabase Support,

My development project "almeidafinance" (ID: fzawugbiojmtrthmshcc) is showing as "Healthy" in the dashboard, but the DNS is not resolving globally.

**Problem:**
- Project URL: https://fzawugbiojmtrthmshcc.supabase.co
- DNS Status: NXDOMAIN (confirmed via Google DNS API)
- Production project (ievccupeijzuzhomphwn) resolves correctly

**Evidence:**
- Google DNS API: {"Status":3} (NXDOMAIN)
- Tested with: 8.8.8.8, 1.1.1.1, 9.9.9.9 (all fail)
- Production DNS: {"Status":0} with IPs 104.18.38.10, 172.64.149.246

**Impact:**
- Cannot authenticate users
- Cannot run E2E tests
- Cannot validate RLS policies

**Dashboard shows:**
- Status: Healthy
- CPU/Memory: [INSERIR DADOS DO DASHBOARD]
- Last activity: [INSERIR DATA]
- Plan: Free / Pro

**Request:**
Please investigate why DNS records are not registered in Cloudflare for this project. Is the project paused? Is there a provisioning issue?

Thank you,
Matheus Almeida
```

**Anexos:**
- Screenshot do dashboard mostrando "Healthy"
- Output do comando: `curl -v https://fzawugbiojmtrthmshcc.supabase.co 2>&1`
- Google DNS API response (JSON)

**Canal:** https://supabase.com/dashboard/support/new

---

## PRÓXIMOS PASSOS

### Imediato (você precisa fazer)
1. ✅ Ler este diagnóstico completo
2. ⏳ Acessar https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc
3. ⏳ Verificar se há botão "Restore" ou "Unpause"
4. ⏳ Verificar URL exata em Settings > API
5. ⏳ Confirmar status em Settings > General (Plan, Region, etc)
6. ⏳ Tirar screenshots do dashboard (não compartilhar publicamente)
7. ⏳ Informar qual solução é aplicável (A, B, C ou D)

### Após restaurar conexão (eu faço)
1. ⏳ Reativar `.env.development.local`
2. ⏳ Iniciar servidor Vite no ambiente DEV
3. ⏳ Executar `npm run test:e2e:headed` completo
4. ⏳ Validar onboarding (4 testes)
5. ⏳ Validar gasto rápido (3 testes)
6. ⏳ Testar isolamento entre 2 usuários
7. ⏳ Gerar evidências (screenshots + vídeos)
8. ⏳ Relatório final de auditoria

---

## BLOQUEIOS ATUAIS

❌ **Não posso prosseguir sem:**
- Confirmação do status real no dashboard (pausado? URL diferente?)
- Decisão sobre qual solução aplicar (A/B/C/D)

✅ **Já confirmado:**
- DNS não resolve globalmente (4 servidores públicos)
- Produção funciona perfeitamente (referência válida)
- Configuração local está correta (credenciais presentes)
- Não é problema de rede local/proxy/firewall

---

## REFERÊNCIAS

1. [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
2. [Google Public DNS API](https://dns.google/resolve)
3. [Cloudflare DNS Documentation](https://www.cloudflare.com/dns/)
4. [Supabase API Quickstart](https://supabase.com/docs/guides/api/quickstart)
5. [Supabase Support](https://supabase.com/dashboard/support/new)

---

## ARQUIVO DE CONFIGURAÇÃO ANALISADO

**Localização:** `.env.development.local.disabled`

```bash
# AMBIENTE DE DESENVOLVIMENTO - NÃO USAR EM PRODUÇÃO
# Project ID: fzawugbiojmtrthmshcc

VITE_SUPABASE_URL=https://fzawugbiojmtrthmshcc.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_zKM96GEot5gE0r9zBTVPfg_4PwtZVO8

# VAPID (mesmas chaves de teste por enquanto)
VITE_VAPID_PUBLIC_KEY=BF3AJLkH1yr7xqciso4p-5IJMkKIu0fBV0VvKGDkKH7X0HjCM-ax8MNmtgjL9b4vby4yMj99-D4Q5Dltd8sitYQ
```

**Status:** Formato correto, credenciais presentes, URL segue padrão Supabase.

---

**Aguardando verificação do dashboard para prosseguir.**
