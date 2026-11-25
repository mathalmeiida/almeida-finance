# Como Executar os Testes RLS

## 📋 Pré-requisitos

✅ Schema base já executado no Supabase DEV (gxfcfpdwyjqcrfssxgbi)
✅ Usuários Alice e Bob já existem no DEV
✅ GRANT permissions corrigidas (anon e authenticated)

## 🔐 Configurar Credenciais

Você tem **3 opções** para fornecer as credenciais (escolha a mais conveniente):

### Opção 1: Script PowerShell Interativo (Recomendado)

Execute o script que oferece menu interativo:

```powershell
powershell -ExecutionPolicy Bypass -File .\Executar-TestesRLS.ps1
```

Opções disponíveis:
1. Criar arquivo .env.test.local
2. Fornecer credenciais temporárias (SecureString + try/finally)
3. Cancelar

🔐 **Segurança**: Senhas lidas via SecureString, zeradas com ZeroFreeBSTR, limpas com try/finally

### Opção 2: Variáveis de Ambiente (Manual)

No PowerShell:

```powershell
$env:ALICE_EMAIL="alice@example.com"
$env:ALICE_PASSWORD="senha_real_alice"
$env:BOB_EMAIL="bob@example.com"
$env:BOB_PASSWORD="senha_real_bob"
node testes-rls-com-credenciais.js
```

### Opção 3: Arquivo .env.test.local (Persistente)

1. Copie o arquivo de exemplo:
   ```powershell
   Copy-Item .env.test.local.example .env.test.local
   ```

2. Edite `.env.test.local` com as senhas reais:
   ```
   ALICE_EMAIL=alice@example.com
   ALICE_PASSWORD=senha_real_alice
   BOB_EMAIL=bob@example.com
   BOB_PASSWORD=senha_real_bob
   ```

3. Execute o teste:
   ```powershell
   node testes-rls-com-credenciais.js
   ```

### Opção 4: Prompt Interativo (Sem Configuração Prévia)

Execute o script sem configurar nada. Ele solicitará as senhas no terminal (sem exibi-las):

```powershell
node testes-rls-com-credenciais.js
```

## 🧪 O Que os Testes Validam

### Teste 1: Categorias Públicas
- ✅ Verifica que categorias do sistema são visíveis sem autenticação

### Teste 2: Trigger de Perfil
- ✅ Confirma que perfil de Alice foi criado automaticamente

### Teste 3: Criação de Meta
- ✅ Alice cria uma meta pessoal

### Teste 4: Isolamento de Metas 🔒
- ✅ Bob NÃO consegue ver a meta de Alice (SELECT bloqueado por RLS)

### Teste 5: Alice Cria Cartão
- ✅ Alice cria um cartão de crédito

### Teste 6: Bob Cria Cartão
- ✅ Bob cria um cartão de crédito

### Teste 7: Isolamento de Cartões 🔒
- ✅ Alice NÃO consegue ver o cartão de Bob (SELECT bloqueado por RLS)

### Teste 8: Ownership de Despesas 🔐 CRÍTICO
- ✅ Alice NÃO consegue criar despesa usando cartão de Bob
- ✅ Valida correção aplicada durante auditoria

### Teste 9: Despesa Legítima
- ✅ Alice cria despesa com seu próprio cartão (operação válida)

### Teste 10: Ownership de Compras 🔐 CRÍTICO
- ✅ Alice NÃO consegue criar compra usando cartão de Bob
- ✅ Valida correção aplicada durante auditoria

### Teste 11: Compra Legítima
- ✅ Alice cria compra parcelada com seu próprio cartão (operação válida)

## 📊 Interpretando os Resultados

### ✅ PASS
- Teste passou conforme esperado
- RLS funcionando corretamente

### ❌ FAIL
- 🚨 Teste falhou - vulnerabilidade encontrada
- Revise as políticas RLS imediatamente

### ⏭️ SKIP
- Teste pulado (geralmente por falha na autenticação)
- Verifique se as credenciais estão corretas

## 🔍 Troubleshooting

### Erro: "Invalid login credentials"

**Causa**: Email ou senha incorretos

**Solução**:
1. Execute esta query no SQL Editor do Supabase DEV:
   ```sql
   SELECT id, email, created_at
   FROM auth.users
   WHERE email ILIKE '%alice%' OR email ILIKE '%bob%'
   ORDER BY email;
   ```

2. Confirme os emails exatos de Alice e Bob
3. Teste fazer login manualmente no Supabase Dashboard com as credenciais
4. Se necessário, redefina as senhas via Dashboard

### Erro: "permission denied for table X"

**Causa**: GRANT missing na tabela

**Solução**:
Execute novamente o `CORRIGIR_RLS_CATEGORIAS.sql` no SQL Editor

### Teste 8 ou 10 FAIL (CRÍTICO)

**Causa**: Policy de ownership não está bloqueando corretamente

**Solução**:
1. Verifique se as policies `usuarios_insert_despesas` e `usuarios_insert_compras_cartao` existem
2. Execute:
   ```sql
   SELECT schemaname, tablename, policyname, cmd
   FROM pg_policies
   WHERE tablename IN ('despesas', 'compras_cartao');
   ```
3. Se as policies não existirem, NÃO execute as 38 migrations
4. Relate o problema ao desenvolvedor

## 🛡️ Segurança

- ❌ Nunca commite `.env.test.local` (já está no .gitignore)
- ❌ Nunca exiba senhas nos logs (script já está configurado para ocultar)
- ❌ Nunca use `service_role` key nos testes (script usa `anon` key)
- ✅ Use sessões JWT distintas para Alice e Bob
- ✅ Execute APENAS no ambiente DEV

## 📝 Exemplo de Saída Esperada

```
══════════════════════════════════════════════════════════════════════
🧪 TESTES RLS COMPLETOS - Alice e Bob
══════════════════════════════════════════════════════════════════════
Alice: alice@example.com
Bob: bob@example.com
Senhas: ****** (ocultas)
══════════════════════════════════════════════════════════════════════

✅ Teste 1: Categorias do sistema visíveis sem auth
   Status: PASS
   19 categorias (esperado 19)

🔐 Autenticando usuários...
──────────────────────────────────────────────────────────────────────
Tentando autenticar Alice: alice@example.com
✅ Alice autenticada
   ID: a1b2c3d4-...
   Email: alice@example.com
   Token JWT: eyJhbGciOiJIUzI1N...

Tentando autenticar Bob: bob@example.com
✅ Bob autenticado
   ID: e5f6g7h8-...
   Email: bob@example.com
   Token JWT: eyJhbGciOiJIUzI1N...

✅ Tokens JWT diferentes (sessões isoladas)

══════════════════════════════════════════════════════════════════════
🧪 EXECUTANDO TESTES RLS
══════════════════════════════════════════════════════════════════════

✅ Teste 2: Trigger - Perfil de Alice criado
   Status: PASS
   Perfil encontrado: alice@example.com
   Criado em: 2025-01-28T10:15:30.123Z

✅ Teste 3: Alice cria meta
   Status: PASS
   Meta criada: Meta Teste Alice - R$ 5000
   ID: 123

✅ Teste 4: 🔒 Bob NÃO vê meta de Alice (isolamento SELECT)
   Status: PASS
   Bob não vê meta de Alice (array vazio = isolamento OK)

✅ Teste 5: Alice cria cartão
   Status: PASS
   Cartão criado: Cartão Teste Alice - Limite R$ 5000
   ID: 456

✅ Teste 6: Bob cria cartão
   Status: PASS
   Cartão criado: Cartão Teste Bob - Limite R$ 3000
   ID: 789

✅ Teste 7: 🔒 Alice NÃO vê cartão de Bob (isolamento)
   Status: PASS
   Alice não vê cartão de Bob (isolamento OK)

✅ Teste 8: 🔐 Alice NÃO cria despesa c/ cartão Bob (CRÍTICO)
   Status: PASS
   Inserção bloqueada (policy de ownership)
   Erro: new row violates row-level security policy | Code: 42501 | RLS: true

✅ Teste 9: Alice cria despesa c/ próprio cartão
   Status: PASS
   Despesa criada: Compra com próprio cartão - R$ 150
   ID: 101

✅ Teste 10: 🔐 Alice NÃO cria compra c/ cartão Bob (CRÍTICO)
   Status: PASS
   Inserção bloqueada (correção da auditoria aplicada)
   Erro: new row violates row-level security policy | Code: 42501 | RLS: true

✅ Teste 11: Alice cria compra c/ próprio cartão
   Status: PASS
   Compra criada: Compra parcelada próprio cartão - 3x R$ 200.00
   ID: 102 | Total: R$ 600

══════════════════════════════════════════════════════════════════════
📊 RESUMO DOS TESTES
══════════════════════════════════════════════════════════════════════

Total de testes: 11
✅ PASS:  11 (100%)
❌ FAIL:  0 (0%)
⏭️  SKIP:  0 (0%)

✅ TODOS OS TESTES EXECUTADOS PASSARAM!
🔒 RLS e isolamento funcionando corretamente.
🛡️  Correções da auditoria validadas.
══════════════════════════════════════════════════════════════════════
```

## ⚠️ Avisos Importantes

1. **NÃO execute as 38 migrations** - Elas são para produção
2. **NÃO modifique políticas automaticamente** - Relate falhas ao desenvolvedor
3. **NÃO use service_role nos testes** - Ele bypassa RLS
4. **NÃO toque na produção** (ievccupeijzuzhomphwn) - Apenas DEV

## 📞 Próximos Passos

Se todos os testes passarem:
- ✅ RLS validado no DEV
- ✅ Isolamento confirmado
- ✅ Ownership validado
- ✅ Pronto para revisar o plano de migração para produção

Se algum teste falhar:
- ❌ Relate o teste que falhou
- ❌ Envie o log completo
- ❌ NÃO prossiga para produção até corrigir
