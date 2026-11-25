# CONFIGURAR NOVO PROJETO SUPABASE DEV

**Tempo estimado:** 10 minutos  
**Pré-requisito:** Novo projeto Supabase criado em São Paulo (Free Plan)

---

## PASSO 1: Criar Projeto no Supabase (você faz)

1. Acessar: https://supabase.com/dashboard
2. Clicar em **"New project"**
3. Preencher:
   - **Name:** `almeidafinance-dev-novo` (ou similar)
   - **Database Password:** Escolher senha forte (guardar!)
   - **Region:** `São Paulo (South America)`
   - **Pricing Plan:** `Free`
4. Clicar em **"Create new project"**
5. Aguardar ~2 minutos (provisionamento)

---

## PASSO 2: Executar Script SQL (você faz)

1. No painel do projeto, ir para **SQL Editor** (menu lateral)
2. Clicar em **"New query"**
3. Abrir arquivo `SETUP_DEV_NOVO.sql` (nesta pasta)
4. Copiar TODO o conteúdo
5. Colar no SQL Editor
6. Clicar em **"Run"** (ou `Ctrl+Enter`)
7. Verificar mensagem de sucesso (sem erros vermelhos)

**O que o script faz:**
- Cria 8 tabelas: perfis, categorias, receitas, despesas, cartões, compras_cartao, investimentos, cenarios_financeiros
- Configura 20 políticas RLS (isolamento entre usuários)
- Insere 11 categorias padrão do sistema
- Cria trigger para perfil automático após signup
- Configura permissões anon/authenticated

---

## PASSO 3: Verificar Data API (você faz)

1. Ir para **Integrations > Data API > Settings** (menu lateral)
2. Verificar se está **"Enabled"** (padrão: habilitado)
3. Em **"Exposed schemas"**, confirmar que `public` está incluído
4. Em **"Exposed tables"**, verificar que todas as 8 tabelas estão listadas

---

## PASSO 4: Copiar Credenciais (você faz)

1. Ir para **Settings > API** (menu lateral)
2. Copiar:
   - **Project URL:** `https://<PROJECT_REF>.supabase.co`
   - **anon public:** `eyJhbGc...` (chave longa)
3. **Anotar o Project URL e anon key** (vou precisar)

---

## PASSO 5: Informar Credenciais (você faz)

**Me envie apenas:**
```
Project URL: https://XXXXXXXX.supabase.co
anon key: eyJhbGc... (primeiros 20 caracteres + "...")
```

**NÃO me envie:**
- Database password
- service_role key (nunca usar no frontend)

---

## PASSO 6: Atualizar .env.development.local (eu faço)

Quando você me passar as credenciais, vou:

1. Criar/atualizar `.env.development.local`:
   ```bash
   VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon_key>
   VITE_VAPID_PUBLIC_KEY=BF3AJLkH1yr7xqciso4p-5IJMkKIu0fBV0VvKGDkKH7X0HjCM-ax8MNmtgjL9b4vby4yMj99-D4Q5Dltd8sitYQ
   ```

2. Iniciar servidor Vite no ambiente DEV:
   ```bash
   npm run dev
   ```

3. Executar testes E2E completos:
   ```bash
   npm run test:e2e:headed
   ```

---

## PASSO 7: Criar Usuários de Teste (eu faço via testes E2E)

Os testes E2E vão criar usuários automaticamente:
- `e2e.test@almeidafinance.local` (já configurado em `.env.test`)
- `e2e.test2@almeidafinance.local` (para testes de isolamento)

**OU você pode criar manualmente no dashboard:**
1. Ir para **Authentication > Users**
2. Clicar em **"Add user"**
3. Preencher email e senha
4. Salvar

---

## VERIFICAÇÃO FINAL (eu faço)

Vou validar:

✅ **Conectividade:**
- DNS resolve corretamente
- REST API responde (`/rest/v1/`)
- Auth API responde (`/auth/v1/health`)

✅ **Schema:**
- 8 tabelas criadas
- 20+ políticas RLS ativas
- Trigger de perfil funcionando

✅ **RLS (isolamento):**
- Usuário A não vê dados de Usuário B
- Categorias do sistema (NULL) visíveis para todos
- Categorias personalizadas visíveis apenas para o dono

✅ **E2E Tests:**
- Onboarding: 4/4 testes passam
- Gasto Rápido: 3/3 testes passam
- Isolamento: 2 usuários não veem dados um do outro

---

## TROUBLESHOOTING

### Erro: "relation already exists"
**Causa:** Tentou rodar o script 2x  
**Solução:** Ignorar (tabelas já criadas)

### Erro: "permission denied for schema public"
**Causa:** Permissões não configuradas  
**Solução:** Adicionar ao final do script:
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
```

### Erro: DNS não resolve
**Causa:** Projeto pausado ou provisionamento incompleto  
**Solução:** Aguardar 2 minutos ou verificar Status Page do Supabase

### Autenticação falha nos testes
**Causa:** Email confirmation obrigatória  
**Solução:** Desabilitar em **Authentication > Settings > Email Confirmations**

---

## PRÓXIMOS PASSOS

**Depois dos testes E2E passarem:**

1. ✅ Evidências geradas (screenshots + vídeos)
2. ✅ Bugs identificados e corrigidos
3. ✅ Relatório final de auditoria
4. ⏳ Decisão sobre deploy beta (aguardando autorização)

---

**AGUARDANDO:**
1. ⏳ Você criar projeto no Supabase
2. ⏳ Você executar `SETUP_DEV_NOVO.sql`
3. ⏳ Você me passar Project URL + anon key

**Assim que receber, vou configurar e executar os testes E2E completos.**
