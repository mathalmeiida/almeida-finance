# CONFIGURAR CHAVE PÚBLICA DO SUPABASE DEV

**Projeto:** gxfcfpdwyjqcrfssxgbi  
**Arquivo:** `.env.development.local`

---

## PASSO 1: OBTER A CHAVE PÚBLICA

1. Acessar: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/settings/api

2. Na seção **"Project API keys"**, localizar:
   ```
   anon public
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Clicar no ícone **"Copy"** ao lado da chave

---

## PASSO 2: CONFIGURAR O ARQUIVO LOCAL

1. Abrir o arquivo: `.env.development.local`

2. Localizar a linha:
   ```
   VITE_SUPABASE_ANON_KEY=COLOCAR_CHAVE_PUBLICA_AQUI
   ```

3. Substituir `COLOCAR_CHAVE_PUBLICA_AQUI` pela chave copiada

4. Resultado esperado:
   ```
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **Salvar o arquivo** (Ctrl+S)

---

## PASSO 3: VALIDAR A CONFIGURAÇÃO

**Opção A: Validação automática (Node.js)**

```bash
node VALIDAR_CONEXAO_DEV.js
```

**Resultado esperado:**
```
=== VALIDAÇÃO DE CONEXÃO SUPABASE DEV ===

1. Verificando configuração:
   URL: https://gxfcfpdwyjqcrfssxgbi.supabase.co
   Chave: eyJhbGciOiJIUzI1NiI...xxxxxxxxxx (mascarada)

2. Verificando isolamento:
   ✓ URL aponta para NOVO DEV (correto)

3. Testando conexão:
   ✓ Conexão estabelecida
   ✓ Banco vazio (tabela categorias não existe)
   ✓ Pronto para executar migrações

4. Verificando estado de autenticação:
   ✓ Sem sessão ativa (correto para validação)

5. Testando permissões públicas (RLS):
   ✓ Tabela perfis não existe (banco vazio)

=== RESULTADO ===
✓ Configuração validada
✓ Conexão estabelecida
✓ Ambiente isolado (não é produção)
✓ Pronto para executar migrações
```

---

**Opção B: Validação manual (SQL Editor)**

1. Ir para: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql

2. Executar:
   ```sql
   SELECT COUNT(*) as tabelas
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. **Resultado esperado:** `tabelas: 0` (banco vazio)

---

## PASSO 4: INFORMAR CONCLUSÃO

Após validar (Opção A ou B), me informar:

```
✓ Chave configurada
✓ Conexão validada
✓ Banco vazio confirmado
```

Assim que receber sua confirmação, vou:
1. Executar as 38 migrações oficiais
2. Validar estrutura (32 tabelas, 50 políticas)
3. Criar usuários de teste
4. Executar testes E2E

---

## ⚠️ SEGURANÇA

**NUNCA compartilhar:**
- ❌ service_role key (secreta)
- ❌ Database password
- ❌ JWT secret

**Seguro compartilhar:**
- ✅ anon public key (já é pública no frontend)
- ✅ Project URL (pública)
- ✅ Project Reference (pública)

**Verificar:**
- ✅ `.env.development.local` está no `.gitignore`
- ✅ Não fazer commit deste arquivo
- ✅ `.env.local` (produção) não foi alterado

---

## TROUBLESHOOTING

### Erro: "URL ou ANON_KEY não configurados"
**Causa:** Arquivo não foi salvo ou variável com nome errado  
**Solução:** Verificar se salvou o arquivo e se o nome da variável é exato: `VITE_SUPABASE_ANON_KEY`

### Erro: "ALERTA: URL aponta para PRODUÇÃO!"
**Causa:** `.env.development.local` tem URL de produção  
**Solução:** Corrigir URL para `https://gxfcfpdwyjqcrfssxgbi.supabase.co`

### Erro: "Chave ainda não foi substituída"
**Causa:** Placeholder não foi substituído  
**Solução:** Substituir `COLOCAR_CHAVE_PUBLICA_AQUI` pela chave real do dashboard

### Aviso: "Tabela categorias JÁ EXISTE"
**Causa:** Banco não está vazio (migrações já foram executadas)  
**Solução:** Pode prosseguir, mas migrações serão idempotentes (não recriam o que já existe)

---

**Aguardando sua confirmação para prosseguir com as migrações.**
