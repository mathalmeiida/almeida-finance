# INSTRUÇÕES — TESTE RLS REAL DEFINITIVO

## 🎯 OBJETIVO

Executar teste de isolamento entre 2 usuários autenticados reais no Supabase.

---

## ⚠️ AÇÃO HUMANA NECESSÁRIA

O teste **não pode prosseguir** sem 2 contas confirmadas no Supabase.

### Por que não posso criar as contas automaticamente?

1. **Supabase exige confirmação de email** para novas contas
2. **Rate limit API Auth**: Máximo 4 contas/hora
3. **Emails de teste** (`@almeidafinance.app`) não recebem confirmação

---

## 📋 PASSO A PASSO

### Opção 1: Usar Suas Próprias Contas (RECOMENDADO)

Se você já tem 2 contas confirmadas no Almeida Finance:

```bash
node tests/teste-rls-real-definitivo.mjs
```

O script solicitará:
- Email da Alice: `seu-email-1@gmail.com`
- Senha da Alice: `********`
- Email do Bob: `seu-email-2@gmail.com`
- Senha do Bob: `********`

### Opção 2: Criar 2 Contas Novas

#### 2.1. Criar Conta 1 (Alice)

1. Acessar: https://almeida-finance.vercel.app/cadastro
2. Preencher:
   - Nome: `Alice Teste`
   - Email: `seu-email-1@gmail.com` (use email real)
   - Senha: `Teste123!`
3. Clicar em "Cadastrar"
4. **Verificar email** e clicar no link de confirmação

#### 2.2. Criar Conta 2 (Bob)

1. Acessar: https://almeida-finance.vercel.app/cadastro
2. Preencher:
   - Nome: `Bob Teste`
   - Email: `seu-email-2@gmail.com` (use email real diferente)
   - Senha: `Teste456!`
3. Clicar em "Cadastrar"
4. **Verificar email** e clicar no link de confirmação

#### 2.3. Executar Teste

```bash
node tests/teste-rls-real-definitivo.mjs
```

Forneça os emails e senhas quando solicitado.

### Opção 3: Desabilitar Confirmação de Email (APENAS TESTE)

⚠️ **NÃO RECOMENDADO EM PRODUÇÃO**

Se estiver em ambiente de teste dedicado:

1. Acessar: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/auth/settings
2. Desabilitar "Enable email confirmations"
3. Criar 2 contas via script ou interface
4. Executar teste
5. **REABILITAR** confirmação de email

---

## 🧪 O QUE O TESTE FAZ

1. ✅ Autentica Alice e Bob com email/senha (sessões reais)
2. ✅ Alice cria receita (R$ 5.000)
3. ✅ Bob cria receita (R$ 3.000)
4. ✅ Alice lê suas receitas (deve ver 1, não ver de Bob)
5. ✅ Bob lê suas receitas (deve ver 1, não ver de Alice)
6. ✅ Bob tenta UPDATE na receita de Alice (deve falhar)
7. ✅ Bob tenta DELETE na receita de Alice (deve falhar)
8. ✅ Alice tenta INSERT receita para Bob (deve falhar)
9. ✅ Testa despesas (mesmo isolamento)
10. ✅ Limpa dados de teste

---

## ✅ RESULTADO ESPERADO

```
═══════════════════════════════════════════════
✅ TESTE RLS: APROVADO

Todos os cenários de isolamento foram validados:
  ✓ SELECT: Usuários veem apenas seus dados
  ✓ INSERT: Não é possível criar dados para outro usuário
  ✓ UPDATE: Não é possível alterar dados de outro usuário
  ✓ DELETE: Não é possível excluir dados de outro usuário
  ✓ Múltiplas tabelas: receitas, despesas

🔒 RLS FUNCIONANDO CORRETAMENTE
🎯 SISTEMA PRONTO PARA LANÇAMENTO PÚBLICO
═══════════════════════════════════════════════
```

---

## ❌ RESULTADO DE FALHA

Se houver vulnerabilidade, o teste exibirá:

```
❌ TESTE RLS: FALHOU (X erro(s))

⚠️  VULNERABILIDADES DETECTADAS
    NÃO PUBLICAR ATÉ CORRIGIR
```

---

## 🔒 SEGURANÇA

- ✅ Teste **não expõe** tokens ou credenciais
- ✅ Service role **não é usado** como cliente
- ✅ Apenas anon key (acesso público)
- ✅ Autenticação real com email/senha
- ✅ Dados de teste são **removidos** ao final

---

## ⏱️ TEMPO ESTIMADO

- Criar 2 contas + confirmar emails: **5-10 minutos**
- Executar teste: **30 segundos**
- **Total**: ~10 minutos

---

## 🚨 PRÓXIMOS PASSOS

### Se o teste PASSAR:

1. ✅ Documentar resultados
2. ✅ Commit com evidências
3. ✅ **APROVAR LANÇAMENTO PÚBLICO**

### Se o teste FALHAR:

1. ❌ **NÃO PUBLICAR**
2. Identificar qual operação foi permitida indevidamente
3. Corrigir políticas RLS no Supabase
4. Executar teste novamente

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verificar se emails foram confirmados
2. Verificar se senhas estão corretas
3. Verificar se contas não estão bloqueadas
4. Tentar fazer login manual em: https://almeida-finance.vercel.app/login

---

**Pronto para executar o teste?**

```bash
node tests/teste-rls-real-definitivo.mjs
```
