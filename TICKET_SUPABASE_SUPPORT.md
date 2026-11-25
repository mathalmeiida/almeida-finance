# TICKET SUPABASE SUPPORT — DNS NXDOMAIN

**Status:** Pronto para envio  
**Canal:** https://supabase.com/dashboard/support/new  
**Prioridade:** Normal (não é emergência de produção)

---

## MENSAGEM PRINCIPAL

```
Subject: Projeto Supabase Healthy, mas endpoint público retorna NXDOMAIN

Olá, equipe Supabase.

Tenho um projeto de desenvolvimento que aparece como Healthy no dashboard, mas seu endereço público não resolve no DNS.

Project ID: fzawugbiojmtrthmshcc

Endpoint: https://fzawugbiojmtrthmshcc.supabase.co

Testei diferentes servidores DNS públicos, incluindo Google (8.8.8.8), Cloudflare (1.1.1.1) e Quad9 (9.9.9.9). Todos retornam NXDOMAIN.

Outro projeto Supabase funciona normalmente nas mesmas condições.

O dashboard do projeto afetado mostra status Healthy e atividade de CPU e memória.

Poderiam verificar se existe um problema de provisionamento ou registro DNS do endpoint e orientar como restaurar sua disponibilidade?

Obrigado.
```

---

## INFORMAÇÕES TÉCNICAS ADICIONAIS (se solicitarem)

### DNS Query Results

**Google Public DNS API:**
```json
{
  "Status": 3,
  "Question": [{"name": "fzawugbiojmtrthmshcc.supabase.co.", "type": 1}],
  "Authority": [{
    "name": "supabase.co.",
    "type": 6,
    "data": "christina.ns.cloudflare.com. dns.cloudflare.com. ..."
  }]
}
```

**Status Code 3 = NXDOMAIN (Non-Existent Domain)**

---

### Comparison with Working Project

**Working Project (Production):**
- Project ID: ievccupeijzuzhomphwn
- URL: https://ievccupeijzuzhomphwn.supabase.co
- DNS Status: Resolves correctly to 104.18.38.10 and 172.64.149.246

**Affected Project (Development):**
- Project ID: fzawugbiojmtrthmshcc
- URL: https://fzawugbiojmtrthmshcc.supabase.co
- DNS Status: NXDOMAIN (domain does not exist in DNS)

---

### Commands Executed

```bash
# Google DNS
nslookup fzawugbiojmtrthmshcc.supabase.co 8.8.8.8
# Result: Server can't find fzawugbiojmtrthmshcc.supabase.co: NXDOMAIN

# Cloudflare DNS
nslookup fzawugbiojmtrthmshcc.supabase.co 1.1.1.1
# Result: Server can't find fzawugbiojmtrthmshcc.supabase.co: NXDOMAIN

# cURL
curl -v https://fzawugbiojmtrthmshcc.supabase.co
# Result: Could not resolve host: fzawugbiojmtrthmshcc.supabase.co

# Comparison with working project
curl https://ievccupeijzuzhomphwn.supabase.co/rest/v1/
# Result: HTTP 200 OK (works correctly)
```

---

### Environment

- **OS:** Windows 11
- **Network:** Direct connection (no proxy/VPN)
- **DNS Cache:** Cleared (ipconfig /flushdns)
- **Tested from:** Brazil
- **Date/Time:** 2024-12-20

---

### Dashboard Observations

- Project Status: **Healthy**
- Plan: **[Free / Pro]** ← (you need to check this)
- Region: **[Check in Settings > General]**
- Last Activity: **[Check in Logs]**
- Tables exist: **[Yes/No - check Database section]**
- RLS enabled: **[Yes/No]**

---

### Impact

- Cannot access REST API endpoints
- Cannot authenticate users via Auth API
- Cannot run E2E tests
- Development environment completely blocked

---

### Questions for Support

1. Is the project paused despite showing as "Healthy"?
2. Is there a DNS provisioning issue with this specific project?
3. Should the URL format be different (region-specific)?
4. Is there a manual restore action I need to take?
5. If the project is on Free Plan, would upgrading to Pro resolve this?

---

## SCREENSHOTS RECOMENDADOS (ANEXAR AO TICKET)

Tire screenshots do dashboard e salve para anexar se o suporte solicitar:

### 1. Project Overview
- Acesse: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc
- Tire print mostrando:
  - Status "Healthy"
  - Uso de CPU/Memória
  - Project name e ID

### 2. Settings > API
- Acesse: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc/settings/api
- Tire print mostrando:
  - Project URL completa
  - Region
  - anon/public key (pode ocultar os últimos caracteres)

### 3. Settings > General
- Acesse: https://supabase.com/dashboard/project/fzawugbiojmtrthmshcc/settings/general
- Tire print mostrando:
  - Plan (Free/Pro)
  - Project Reference
  - Region

### 4. Command Line Output
- Abra PowerShell e execute:
  ```powershell
  curl -v https://fzawugbiojmtrthmshcc.supabase.co 2>&1 | Select-Object -First 10
  ```
- Copie o output completo

---

## TEMPO ESPERADO DE RESPOSTA

- **Free Plan:** 24-48 horas (melhor esforço)
- **Pro Plan:** 12-24 horas (prioridade)
- **Enterprise:** < 4 horas (SLA garantido)

---

## ENQUANTO AGUARDA RESPOSTA

Você tem 3 opções:

### Opção A: Aguardar suporte resolver (recomendado)
- Sem ação necessária
- Sem risco de perder dados
- Pode levar 24-48h

### Opção B: Executar testes limitados em produção (NÃO RECOMENDADO)
⚠️ Violar princípio de não testar em produção
- Configurar testes para serem apenas consultas (read-only)
- Usar prefixo [E2E-TEST] em qualquer escrita
- Rollback manual obrigatório após testes

### Opção C: Criar novo projeto DEV temporário (alternativa)
- Criar "almeidafinance-dev-temp"
- Copiar schema da produção
- Configurar RLS policies
- Atualizar `.env.development.local`
- Executar testes E2E
- Deletar após testes ou migrar de volta quando suporte resolver

---

## PRÓXIMOS PASSOS

**Agora (você):**
1. ✅ Enviar ticket via https://supabase.com/dashboard/support/new
2. ⏳ Anexar screenshots do dashboard
3. ⏳ Informar qual opção escolhe (A/B/C) enquanto aguarda

**Após resposta do suporte (eu):**
1. ⏳ Aplicar solução recomendada pelo Supabase
2. ⏳ Testar conectividade DNS
3. ⏳ Executar testes E2E completos
4. ⏳ Gerar evidências finais
5. ⏳ Relatório de auditoria completo

---

## REFERÊNCIAS ÚTEIS

- [Supabase Support](https://supabase.com/dashboard/support/new)
- [Community Discord](https://discord.supabase.com)
- [GitHub Discussions](https://github.com/orgs/supabase/discussions)
- [Status Page](https://status.supabase.com)

---

**Ticket pronto para envio. Aguardando você confirmar que enviou.**
