# INSTRUÇÕES: CRIAR PROJETO SUPABASE DEV

**CRÍTICO:** Siga exatamente estas instruções para criar um ambiente isolado.

---

## PASSO 1: ACESSAR DASHBOARD SUPABASE

1. Abrir: https://supabase.com/dashboard
2. Fazer login com sua conta

---

## PASSO 2: CRIAR NOVO PROJETO

1. Clicar no botão **"New project"**
2. Preencher formulário:

**Nome do projeto:**
```
almeidafinance-dev-teste
```

**Database Password:**
```
[Escolher senha forte e anotar]
Sugestão: DevTest2024!Secure#almeidaFinance
```

**Region:**
```
South America (São Paulo)
```

**Pricing Plan:**
```
Free
```

3. Clicar em **"Create new project"**
4. Aguardar provisionamento (2-3 minutos)

---

## PASSO 3: CONFIRMAR PROJETO VAZIO

1. Após provisionamento, ir para **SQL Editor** (menu lateral)
2. Executar este comando de verificação:

```sql
-- Verificar se banco está vazio
SELECT 
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Resultado esperado:** Nenhuma linha retornada (banco vazio)

**Se houver tabelas:** ⚠️ PARE! Projeto não está vazio.

---

## PASSO 4: COPIAR CREDENCIAIS

1. Ir para **Settings > API** (menu lateral)

2. Copiar e me enviar:

```
Project URL: [colar aqui]
Project Reference: [primeiros 20 caracteres do ref]
anon public key: [primeiros 30 caracteres]
```

**Exemplo do que enviar:**
```
Project URL: https://abcdefghijklmnopqrst.supabase.co
Project Reference: abcdefghijklmnopqrst
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6Ik... (primeiros 30 chars)
```

---

## PASSO 5: CONFIRMAR ISOLAMENTO

**Verificar que NÃO é produção:**

1. Ir para **Settings > General**
2. Confirmar:
   - ✅ Nome: `almeidafinance-dev-teste`
   - ✅ Region: `South America (São Paulo)`
   - ✅ Reference: **NÃO é** `ievccupeijzuzhomphwn` (produção)

**Se Reference for `ievccupeijzuzhomphwn`:** ⚠️⚠️⚠️ **PARE IMEDIATAMENTE!** Você está em produção!

---

## PASSO 6: DESABILITAR EMAIL CONFIRMATION (FACILITAR TESTES)

1. Ir para **Authentication > Settings**
2. Procurar **"Enable email confirmations"**
3. Desabilitar (toggle OFF)
4. Salvar

**Motivo:** Testes E2E precisam criar usuários sem verificação de email.

---

## CHECKLIST ANTES DE ME ENVIAR CREDENCIAIS

- [ ] Projeto criado com nome `almeidafinance-dev-teste`
- [ ] Região: São Paulo
- [ ] Plan: Free
- [ ] Banco vazio (query acima retornou 0 linhas)
- [ ] Reference NÃO é `ievccupeijzuzhomphwn`
- [ ] Email confirmation desabilitado
- [ ] Credenciais copiadas (URL + anon key)

---

## ⚠️ SEGURANÇA

**NUNCA me envie:**
- ❌ Database password
- ❌ service_role key (secreta)
- ❌ JWT secret

**Apenas me envie:**
- ✅ Project URL
- ✅ anon public key (primeiros 30 chars é suficiente para confirmar)

---

**Após me enviar as credenciais, vou:**
1. Validar que o ambiente está isolado
2. Executar migrações sequencialmente
3. Validar cada etapa
4. Testar isolamento RLS
5. Executar testes E2E
6. Reportar resultados reais

**Aguardando você criar o projeto e me enviar as credenciais.**
