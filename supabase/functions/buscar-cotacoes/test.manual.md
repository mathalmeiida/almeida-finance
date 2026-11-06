# 🧪 TESTES MANUAIS - EDGE FUNCTION BUSCAR-COTACOES

## Status: ⚠️ AGUARDANDO DEPLOY

**Motivo:** Edge Function não pode ser testada sem deploy real no Supabase.

---

## Pré-requisitos para Teste

### 1. Deploy da Edge Function
```bash
# Configurar token BRAPI
supabase secrets set BRAPI_TOKEN=seu_token_real_brapi

# Deploy da function
supabase functions deploy buscar-cotacoes

# Verificar logs
supabase functions logs buscar-cotacoes --follow
```

### 2. Ativar Passkeys no Dashboard
- Dashboard → Authentication → Passkeys → Enable
- Configurar Relying Party ID

### 3. Conta de Teste
- Email: `teste_edge@example.com`
- Senha: (qualquer)
- Status: Confirmado

---

## TESTE 1: Cotação Válida (PETR4)

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['PETR4'] }
});
```

### Resultado Esperado
```javascript
{
  data: {
    results: [{
      symbol: 'PETR4',
      regularMarketPrice: 38.45, // valor real varia
      currency: 'BRL',
      regularMarketChange: 0.52,
      regularMarketChangePercent: 1.37
    }]
  },
  error: null
}
```

### Critérios de Sucesso
- ✅ Status HTTP: 200
- ✅ `data.results` é array
- ✅ `results[0].symbol === 'PETR4'`
- ✅ `results[0].regularMarketPrice` é número
- ✅ Sem erro de autenticação

---

## TESTE 2: Múltiplas Cotações

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['PETR4', 'VALE3', 'ITUB4'] }
});
```

### Resultado Esperado
```javascript
{
  data: {
    results: [
      { symbol: 'PETR4', ... },
      { symbol: 'VALE3', ... },
      { symbol: 'ITUB4', ... }
    ]
  },
  error: null
}
```

### Critérios de Sucesso
- ✅ Retorna 3 cotações
- ✅ Cada uma com `symbol`, `regularMarketPrice`, `currency`
- ✅ Tempo de resposta < 3 segundos

---

## TESTE 3: Ticker Inválido

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['XXXXXXX'] }
});
```

### Resultado Esperado
```javascript
{
  data: {
    results: [],
    message: 'Nenhuma cotação encontrada'
  },
  error: null
}
```

### Critérios de Sucesso
- ✅ Status HTTP: 200
- ✅ `results` vazio
- ✅ Mensagem clara de erro
- ✅ Não quebra a aplicação

---

## TESTE 4: Sem Token BRAPI

### Setup
```bash
# Remover token temporariamente
supabase secrets unset BRAPI_TOKEN
```

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['PETR4'] }
});
```

### Resultado Esperado
```javascript
{
  data: null,
  error: {
    message: 'Token BRAPI não configurado',
    status: 500
  }
}
```

### Critérios de Sucesso
- ✅ Status HTTP: 500
- ✅ Mensagem de erro clara
- ✅ Não expõe informações sensíveis
- ✅ Log registrado no servidor

### Limpeza
```bash
# Restaurar token
supabase secrets set BRAPI_TOKEN=seu_token_real_brapi
```

---

## TESTE 5: Rate Limiting

### Request (Rápida Sequência)
```javascript
// Enviar 3 requests em < 1 segundo
Promise.all([
  supabase.functions.invoke('buscar-cotacoes', { body: { tickers: ['PETR4'] } }),
  supabase.functions.invoke('buscar-cotacoes', { body: { tickers: ['VALE3'] } }),
  supabase.functions.invoke('buscar-cotacoes', { body: { tickers: ['ITUB4'] } })
]);
```

### Resultado Esperado (Versão Atual)
- ✅ Todas as 3 requests completam (rate limit apenas logged, não enforced)
- ✅ Logs mostram warning de rate limit

### Resultado Esperado (Se Rate Limit Enforced)
```javascript
// Segunda e terceira requests:
{
  data: null,
  error: {
    message: 'Rate limit excedido. Aguarde 1 segundo.',
    status: 429
  }
}
```

---

## TESTE 6: Token Inválido

### Setup
```bash
# Configurar token fake
supabase secrets set BRAPI_TOKEN=token_invalido_fake
```

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['PETR4'] }
});
```

### Resultado Esperado
```javascript
{
  data: {
    results: [],
    message: 'Erro ao buscar cotações: Unauthorized'
  },
  error: null
}
```

### Critérios de Sucesso
- ✅ Não quebra a aplicação
- ✅ Mensagem clara de erro
- ✅ Status HTTP: 200 (erro tratado)
- ✅ Log registrado

### Limpeza
```bash
# Restaurar token real
supabase secrets set BRAPI_TOKEN=seu_token_real_brapi
```

---

## TESTE 7: Request Sem Autenticação

### Request (Sem Login)
```javascript
// Criar cliente anônimo
const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

const { data, error } = await supabaseAnon.functions.invoke('buscar-cotacoes', {
  body: { tickers: ['PETR4'] }
});
```

### Resultado Esperado
```javascript
{
  data: null,
  error: {
    message: 'Unauthorized',
    status: 401
  }
}
```

### Critérios de Sucesso
- ✅ Status HTTP: 401
- ✅ Não executa a busca
- ✅ Mensagem clara

---

## TESTE 8: Timeout BRAPI

### Cenário
BRAPI API está lenta ou indisponível.

### Resultado Esperado
```javascript
{
  data: {
    results: [],
    message: 'Timeout ao buscar cotações'
  },
  error: null
}
```

### Critérios de Sucesso
- ✅ Não trava a aplicação
- ✅ Timeout após 10 segundos (configurável)
- ✅ Mensagem clara de erro
- ✅ Log registrado

---

## TESTE 9: Payload Inválido

### Request
```javascript
const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
  body: { invalid: 'payload' }
});
```

### Resultado Esperado
```javascript
{
  data: null,
  error: {
    message: 'Formato de request inválido',
    status: 400
  }
}
```

### Critérios de Sucesso
- ✅ Status HTTP: 400
- ✅ Mensagem clara
- ✅ Não quebra a function

---

## TESTE 10: Logs e Monitoramento

### Verificar Logs
```bash
supabase functions logs buscar-cotacoes --tail
```

### O Que Deve Aparecer
```
[INFO] Request recebido: user_id=xxx, tickers=['PETR4']
[INFO] Rate limit: 1 requisição nos últimos 1000ms
[INFO] Buscando cotações na BRAPI...
[INFO] Cotações recebidas: 1 ticker(s)
[INFO] Response enviado: 200
```

### Critérios de Sucesso
- ✅ Logs estruturados e legíveis
- ✅ Não expõe token BRAPI
- ✅ Não expõe dados sensíveis
- ✅ Inclui user_id para auditoria

---

## TESTE 11: Integração Frontend

### No App (Página Investimentos)
1. Login como usuário teste
2. Adicionar investimento com ticker: `PETR4`
3. Aguardar carregamento da cotação
4. Verificar: Valor aparece corretamente
5. Inspecionar Network tab → Verificar chamada `/buscar-cotacoes`

### Critérios de Sucesso
- ✅ Cotação carrega em < 3 segundos
- ✅ Valor formatado como moeda (R$ 38,45)
- ✅ Sem mensagens de erro no console
- ✅ Request autenticado (com Bearer token)

---

## 📊 Checklist de Execução

| # | Teste | Status | Data | Observações |
|---|-------|--------|------|-------------|
| 1 | Cotação Válida (PETR4) | ⏳ Pendente | - | Aguarda deploy |
| 2 | Múltiplas Cotações | ⏳ Pendente | - | Aguarda deploy |
| 3 | Ticker Inválido | ⏳ Pendente | - | Aguarda deploy |
| 4 | Sem Token BRAPI | ⏳ Pendente | - | Aguarda deploy |
| 5 | Rate Limiting | ⏳ Pendente | - | Aguarda deploy |
| 6 | Token Inválido | ⏳ Pendente | - | Aguarda deploy |
| 7 | Sem Autenticação | ⏳ Pendente | - | Aguarda deploy |
| 8 | Timeout BRAPI | ⏳ Pendente | - | Aguarda deploy |
| 9 | Payload Inválido | ⏳ Pendente | - | Aguarda deploy |
| 10 | Logs e Monitoramento | ⏳ Pendente | - | Aguarda deploy |
| 11 | Integração Frontend | ⏳ Pendente | - | Aguarda deploy |

---

## 🚨 Critérios de Reprovação

**NÃO ATIVAR COTAÇÕES SE:**
- ❌ Token BRAPI aparece em logs públicos
- ❌ Requests anônimos são aceitos
- ❌ Rate limit não está funcionando
- ❌ Timeout causa crash da function
- ❌ Erros não são tratados gracefully

---

## 📝 Relatório de Execução (Template)

```markdown
# Relatório de Testes - Edge Function buscar-cotacoes

**Data:** DD/MM/AAAA  
**Executor:** Nome  
**Ambiente:** Production / Staging

## Resumo
- ✅ Testes passados: X/11
- ❌ Testes falhados: Y/11
- ⏭️ Testes pulados: Z/11

## Detalhes

### TESTE 1: Cotação Válida
- **Status:** ✅ PASSOU / ❌ FALHOU
- **Tempo de resposta:** X ms
- **Observações:** ...

[Repetir para cada teste]

## Conclusão
- [ ] Edge Function APROVADA para produção
- [ ] Edge Function REPROVADA (ver detalhes acima)
```

---

**Criado em:** 06 de Novembro de 2026  
**Última atualização:** 06 de Novembro de 2026  
**Status:** ⚠️ Aguardando deploy da Edge Function
