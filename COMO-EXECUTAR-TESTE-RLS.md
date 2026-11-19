# COMO EXECUTAR O TESTE RLS REAL

## 🎯 CORREÇÃO: MODULE_NOT_FOUND

**Problema**: Você estava executando do diretório errado.

**Solução**: Execute a partir da pasta `posso-comprar`

---

## ✅ MÉTODO 1: EXECUÇÃO INTERATIVA (RECOMENDADO)

### Passo a Passo

1. **Abrir terminal na pasta correta**:
   ```bash
   cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
   ```

2. **Executar teste**:
   ```bash
   node tests/teste-rls-real-definitivo.mjs
   ```

3. **Fornecer credenciais quando solicitado**:
   ```
   Email da Alice: seu-email-1@gmail.com
   Senha da Alice: ********
   Email do Bob: seu-email-2@gmail.com
   Senha do Bob: ********
   ```

### Alternativa: Script PowerShell

```powershell
cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
.\executar-teste-rls.ps1
```

### Alternativa: Arquivo BAT

Duplo-clique em: `executar-teste-rls.bat`

---

## ✅ MÉTODO 2: EXECUÇÃO AUTOMÁTICA (SEM INPUT)

Para execução não-interativa (CI/CD ou script automatizado):

### 1. Definir variáveis de ambiente:

```powershell
$env:RLS_TEST_EMAIL_ALICE = "seu-email-1@gmail.com"
$env:RLS_TEST_SENHA_ALICE = "sua-senha-1"
$env:RLS_TEST_EMAIL_BOB = "seu-email-2@gmail.com"
$env:RLS_TEST_SENHA_BOB = "sua-senha-2"
```

### 2. Executar teste:

```powershell
cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
node tests/teste-rls-auto.mjs
```

### ⚠️ IMPORTANTE

As credenciais **NÃO são salvas** em arquivos. Existem apenas na memória da sessão PowerShell.

Para limpar:
```powershell
Remove-Item Env:\RLS_TEST_*
```

---

## 🧪 O QUE O TESTE FAZ

1. ✅ Autentica Alice e Bob (sessões reais)
2. ✅ Alice cria receita (R$ 5.000)
3. ✅ Bob cria receita (R$ 3.000)
4. ✅ **Testa SELECT**: Cada usuário vê apenas seus dados
5. ✅ **Testa UPDATE**: Bob não consegue alterar dados de Alice
6. ✅ **Testa DELETE**: Bob não consegue excluir dados de Alice
7. ✅ **Testa INSERT**: Alice não consegue criar dados para Bob
8. ✅ **Limpa** dados de teste automaticamente

**Não expõe** tokens ou credenciais nos logs.

---

## ✅ RESULTADO ESPERADO

```
═══════════════════════════════════════════════
✅ TESTE RLS: APROVADO

Todos os cenários validados:
  ✓ SELECT: Isolamento OK
  ✓ INSERT: Bloqueado
  ✓ UPDATE: Bloqueado
  ✓ DELETE: Bloqueado

🔒 RLS FUNCIONANDO CORRETAMENTE
🎯 SISTEMA PRONTO PARA LANÇAMENTO
═══════════════════════════════════════════════
```

---

## ❌ SOLUÇÃO DE PROBLEMAS

### Erro: "MODULE_NOT_FOUND"

**Causa**: Executando do diretório errado

**Solução**:
```powershell
cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
node tests/teste-rls-real-definitivo.mjs
```

### Erro: "Invalid login credentials"

**Causa**: Email ou senha incorretos, ou conta não confirmada

**Solução**:
1. Verificar email e senha
2. Confirmar conta via email recebido do Supabase
3. Testar login manual em: https://almeida-finance.vercel.app/login

### Erro: "Email not confirmed"

**Causa**: Conta criada mas email não confirmado

**Solução**:
1. Verificar caixa de entrada do email
2. Clicar no link "Confirmar cadastro"
3. Executar teste novamente

### Erro: "@supabase/supabase-js não encontrado"

**Causa**: Dependências não instaladas

**Solução**:
```powershell
npm install
```

---

## 📋 PRÉ-REQUISITOS

- ✅ Node.js instalado
- ✅ Dependências instaladas (`npm install`)
- ✅ 2 contas confirmadas no Supabase
- ✅ Emails e senhas das contas

---

## 🔒 SEGURANÇA

- ✅ Credenciais **não são salvas** em arquivos
- ✅ Credenciais **não aparecem** nos logs
- ✅ Service role **não é usado** como cliente
- ✅ Apenas anon key (acesso público)
- ✅ Dados de teste **removidos** automaticamente

---

## ⏱️ TEMPO DE EXECUÇÃO

- Teste completo: **~10 segundos**
- Com criação de contas: **~10 minutos** (incluindo confirmação email)

---

## 📞 PRECISA DE AJUDA?

1. Verificar se está na pasta correta: `posso-comprar`
2. Verificar se Node.js está instalado: `node --version`
3. Verificar se dependências estão instaladas: `npm list @supabase/supabase-js`
4. Testar login manual no site antes de executar o teste

---

**Arquivos disponíveis**:

- `tests/teste-rls-real-definitivo.mjs` — Teste interativo (solicita credenciais)
- `tests/teste-rls-auto.mjs` — Teste automático (usa variáveis de ambiente)
- `executar-teste-rls.ps1` — Script PowerShell facilitado
- `executar-teste-rls.bat` — Script BAT (duplo-clique)
