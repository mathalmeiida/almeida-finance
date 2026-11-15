# INSTRUÇÕES PARA VALIDAÇÃO MANUAL - CONVERSOR UNIVERSAL

## SITUAÇÃO ATUAL

O código do Conversor Universal está **100% implementado**, mas não podemos validar visualmente via testes automatizados porque:

1. ✅ O aplicativo tem autenticação obrigatória (segurança funcionando)
2. ✅ Requer perfil com onboarding concluído (fluxo correto)
3. ❌ API de signup do Supabase não aceita criação programática
4. ❌ Testes automatizados com mock falham na validação do perfil

## SOLUÇÃO: VALIDAÇÃO MANUAL GUIADA

### PASSO 1: Criar Usuário de Teste no Supabase (5 minutos)

#### Opção A: Via Dashboard do Supabase (Recomendado)

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: **ievccupeijzuzhomphwn**
3. Menu lateral → **Authentication** → **Users**
4. Clique em **"Add user"** → **"Create new user"**
5. Preencha:
   - **Email**: `validacao@almeidafinance.test`
   - **Password**: `Validacao2026!`
   - **Auto Confirm User**: ☑️ **MARCAR** (importante!)
6. Clique em **"Create user"**
7. **Copie o User ID** que aparece (formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

8. Menu lateral → **Table Editor** → **perfis**
9. Clique em **"Insert"** → **"Insert row"**
10. Preencha:
    - **usuario_id**: Cole o User ID copiado
    - **nome**: "Validação Teste"
    - **data_marco**: `2026-01-01`
    - **saldo_inicial**: `5000`
    - **onboarding_concluido**: `true` (marcar checkbox)
11. Clique em **"Save"**

#### Opção B: Via SQL Editor (Mais Rápido)

1. Acesse: https://supabase.com/dashboard
2. Selecione o projeto: **ievccupeijzuzhomphwn**
3. Menu lateral → **SQL Editor**
4. **PRIMEIRO**: Crie o usuário via Authentication → Users (passo 4-6 da Opção A)
5. **DEPOIS**: Execute o SQL abaixo (substitua o USER_ID):

```sql
-- Substitua 'COLE_O_USER_ID_AQUI' pelo ID copiado
INSERT INTO perfis (
  usuario_id,
  nome,
  data_marco,
  saldo_inicial,
  onboarding_concluido
) VALUES (
  'COLE_O_USER_ID_AQUI',
  'Validação Teste',
  '2026-01-01',
  5000.00,
  true
);
```

### PASSO 2: Fazer Login e Capturar Screenshots (10 minutos)

1. **Abrir o aplicativo**:
   ```
   http://localhost:4173
   ```

2. **Fazer login**:
   - Email: `validacao@almeidafinance.test`
   - Senha: `Validacao2026!`

3. **Capturar screenshots** das seguintes páginas:
   - ✅ Dashboard/Home
   - ✅ Receitas (procurar botão "Importar")
   - ✅ Despesas (procurar botão "Importar")
   - ✅ Cartões (procurar botão "Importar")
   - ✅ Investimentos (procurar botão "Importar")
   - ✅ Benefícios (procurar botão "Importar")
   - ✅ `/importacao` (interface standalone)
   - ✅ `/central-importacao`

4. **Testar modal de importação**:
   - Em cada página (Receitas, Despesas, etc.), clicar no botão **"Importar"**
   - Verificar se o modal abre
   - Capturar screenshot do modal aberto

5. **Testar detecção automática** (se possível):
   - Fazer upload de um arquivo CSV de teste
   - Verificar se o tipo é detectado automaticamente
   - Observar a prévia de transações

### PASSO 3: Reportar Resultados

Informar:

1. **Screenshots capturados** (salvar em pasta local)
2. **Botões "Importar" encontrados** (em quais páginas)
3. **Modais funcionando** (sim/não para cada página)
4. **Problemas visuais** (layout, espaçamento, elementos faltando)
5. **Detecção automática** (funcionou? mostrou prévia?)

---

## ALTERNATIVA: Script PowerShell (Se tiver PowerShell CLI do Supabase)

Se você tem o Supabase CLI instalado:

```powershell
# 1. Login no Supabase CLI
supabase login

# 2. Linkar projeto
supabase link --project-ref ievccupeijzuzhomphwn

# 3. Executar SQL
supabase db execute --sql "
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'validacao@almeidafinance.test',
  crypt('Validacao2026!', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '{\"nome\": \"Validação Teste\"}'::jsonb
) RETURNING id;
"

# Copiar o ID retornado e executar:
supabase db execute --sql "
INSERT INTO perfis (usuario_id, nome, data_marco, saldo_inicial, onboarding_concluido)
VALUES ('COLE_O_ID_AQUI', 'Validação Teste', '2026-01-01', 5000.00, true);
"
```

---

## VERIFICAÇÃO RÁPIDA SEM CRIAR USUÁRIO

Se você JÁ TEM um usuário no sistema (seu usuário real de desenvolvimento):

1. Fazer login normalmente
2. Navegar pelas páginas
3. Procurar botões "Importar"
4. Clicar e verificar se os modais abrem
5. Reportar resultados

**IMPORTANTE**: Use dados de teste, não dados reais!

---

## PRÓXIMOS PASSOS APÓS VALIDAÇÃO MANUAL

Quando você confirmar visualmente que:
- ✅ Botões "Importar" aparecem
- ✅ Modais abrem corretamente
- ✅ Interface de importação funciona

Então posso:
1. Documentar estado atual com screenshots reais
2. Identificar problemas visuais específicos
3. Corrigir o que realmente não está funcionando
4. Criar testes E2E que funcionem com o fluxo completo

---

## POR QUE ESTA ABORDAGEM?

**Testes automatizados falharam porque**:
- API do Supabase não permite signup programático com auto-confirm
- Mock de autenticação não simula perfil completo corretamente
- Playwright não consegue bypassar verificações de segurança do Supabase

**Validação manual é necessária** para:
- Ver o estado REAL da interface
- Confirmar que o código implementado está funcionando
- Identificar problemas visuais/UX reais
- Fornecer evidências visuais do funcionamento

**Depois da validação manual**, posso:
- Criar testes E2E que usem o usuário criado
- Automatizar screenshots com sessão real
- Documentar estado atual com evidências concretas

---

## RESUMO

1. ⏱️ **5 min**: Criar usuário no Supabase Dashboard
2. ⏱️ **10 min**: Fazer login e navegar pelas páginas
3. ⏱️ **5 min**: Capturar screenshots e testar funcionalidades
4. ⏱️ **2 min**: Reportar resultados

**Total**: ~22 minutos para validação completa e definitiva

---

Gerado em: 13/11/2026 16:30
