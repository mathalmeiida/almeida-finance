# 🔐 WhatsApp Business API - Credenciais Necessárias

## STATUS: Pendente de Configuração Externa

O simulador local está **100% funcional** e grava transações reais no banco.

Para conectar com WhatsApp Business API oficial, você precisará:

---

## 📋 Requisitos

### 1. Conta Meta for Developers
- Criar conta em: https://developers.facebook.com/
- Verificar identidade empresarial
- Aceitar termos do WhatsApp Business

### 2. WhatsApp Business App
- Número de telefone exclusivo (não pode ser pessoal)
- Número verificado no WhatsApp Business
- Acesso ao número via SMS/chamada para verificação

### 3. Credenciais da API

Você precisará obter:

```bash
# Variáveis de ambiente necessárias (.env)
WHATSAPP_PHONE_NUMBER_ID=     # ID do número cadastrado
WHATSAPP_BUSINESS_ACCOUNT_ID= # ID da conta business
WHATSAPP_API_TOKEN=           # Token de acesso permanente
WHATSAPP_WEBHOOK_VERIFY_TOKEN=# Token customizado para webhook
WHATSAPP_APP_SECRET=          # Secret do app Meta
```

---

## 🔧 Passos para Configuração

### Passo 1: Criar App Meta
1. Acesse https://developers.facebook.com/apps/
2. Clique em "Criar App"
3. Escolha "Business" como tipo
4. Nomeie: "Almeida Finance WhatsApp"
5. Adicione produto: "WhatsApp"

### Passo 2: Configurar Número
1. No painel WhatsApp > Getting Started
2. Adicionar número de telefone
3. Verificar via SMS/chamada
4. Copiar `Phone Number ID`

### Passo 3: Gerar Token de Acesso
1. No painel > WhatsApp > API Setup
2. Gerar token temporário (24h) para testes
3. Para produção: Gerar token permanente em:
   - Settings > Basic > App Secret
   - Settings > Advanced > Access Token

### Passo 4: Configurar Webhook
1. No painel > WhatsApp > Configuration
2. Webhook URL: `https://seu-dominio.vercel.app/api/webhook/whatsapp`
3. Verify Token: `seu-token-secreto-customizado`
4. Subscrever eventos:
   - `messages` (mensagens recebidas)
   - `messaging_postbacks` (confirmações)

---

## 🚀 Implementação no Projeto

### Arquivo: `src/lib/whatsappAPI.js` (A CRIAR)

```javascript
// Conexão com WhatsApp Business API
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0'
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ACCESS_TOKEN = process.env.WHATSAPP_API_TOKEN

export async function enviarMensagem(numeroDestino, mensagem) {
  const response = await fetch(
    `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numeroDestino,
        type: 'text',
        text: { body: mensagem }
      })
    }
  )
  
  return response.json()
}
```

### Arquivo: `api/webhook/whatsapp.js` (A CRIAR - Vercel Function)

```javascript
import { parseWhatsAppMessage } from '../../src/lib/whatsappParser'
import { supabase } from '../../src/lib/supabase'

export default async function handler(req, res) {
  // Verificação do webhook (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    
    if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge)
    }
    
    return res.status(403).send('Forbidden')
  }
  
  // Recebimento de mensagens (POST)
  if (req.method === 'POST') {
    const { entry } = req.body
    
    // Processar mensagens
    for (const item of entry) {
      for (const change of item.changes) {
        if (change.value.messages) {
          for (const message of change.value.messages) {
            await processarMensagem(message, change.value.metadata.phone_number_id)
          }
        }
      }
    }
    
    return res.status(200).json({ success: true })
  }
  
  return res.status(405).json({ error: 'Method not allowed' })
}

async function processarMensagem(message, phoneNumberId) {
  const texto = message.text?.body
  if (!texto) return
  
  // Parsear mensagem
  const resultado = parseWhatsAppMessage(texto)
  if (!resultado.sucesso) return
  
  // TODO: Identificar usuário pelo número de telefone
  // TODO: Gravar transação no Supabase
  // TODO: Enviar confirmação via WhatsApp
}
```

---

## 🔒 Segurança

### Validação de Webhook
- Sempre validar `hub.verify_token`
- Validar `X-Hub-Signature-256` header
- Rate limiting: max 100 mensagens/hora por usuário

### Armazenamento de Tokens
- Nunca commitar tokens no Git
- Usar variáveis de ambiente
- Rotacionar tokens periodicamente

### Isolamento de Usuários
- Tabela `usuarios_whatsapp`:
  - `usuario_id` (FK para usuarios)
  - `numero_telefone` (único, criptografado)
  - `ativo` (boolean)
  - `vinculado_em` (timestamp)

---

## 💰 Custos

### Plano Gratuito (Teste)
- 1.000 conversas/mês grátis
- 1 conversa = janela de 24h com usuário

### Plano Pago
- Brasil: ~R$ 0,15 por conversa iniciada pelo negócio
- Conversas iniciadas pelo usuário: grátis nas primeiras 24h

---

## 📌 Próximos Passos

1. **Você precisa**:
   - [ ] Criar conta Meta for Developers
   - [ ] Cadastrar número de telefone
   - [ ] Gerar credenciais
   - [ ] Enviar credenciais para adicionar no .env

2. **Eu vou implementar**:
   - [ ] Webhook Vercel Function
   - [ ] Integração com API oficial
   - [ ] Tabela de vinculação de números
   - [ ] Envio de confirmações
   - [ ] Sistema de duplicidade (não reprocessar mensagens)

---

## ✅ O Que Já Funciona (Sem API Externa)

✅ Parser de mensagens em linguagem natural  
✅ Simulador administrativo  
✅ Gravação no banco de dados  
✅ Modo simulação e modo real  
✅ Categorização automática  
✅ Validações robustas  

## ⏳ O Que Depende de Credenciais Externas

⏳ Receber mensagens do WhatsApp real  
⏳ Enviar confirmações via WhatsApp  
⏳ Webhook autenticado  
⏳ Vinculação de números de telefone  

---

**Resumo**: Sistema 100% funcional localmente. Integração externa aguarda credenciais da Meta.
