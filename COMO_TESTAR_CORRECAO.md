# 🧪 COMO TESTAR A CORREÇÃO DO ONBOARDING

## ⚡ TESTE RÁPIDO (5 minutos)

### 1. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

### 2. Preparar usuário de teste

Opção A: **Criar novo usuário**
1. Acessar `/cadastro`
2. Criar conta: `teste.onboarding@exemplo.com` / `Senha123!@#`
3. Confirmar email (se necessário)

Opção B: **Resetar usuário existente**
1. Login no Supabase DEV
2. SQL Editor:
```sql
UPDATE public.perfis 
SET onboarding_concluido = false 
WHERE email = 'seu.email@teste.com';
```

### 3. Executar teste crítico

1. Fazer login com o usuário
2. Na tela "Vamos organizar suas finanças", clicar em **"Configurar manualmente"**
3. Clicar em **"Saldo e Contas"**
4. **DIGITAR LENTAMENTE** no campo de saldo:
   - `5` (aguardar 1 seg)
   - `0` (aguardar 1 seg)
   - `0` (aguardar 1 seg)
   - `0` (aguardar 1 seg)
   - `0` (aguardar 1 seg)
   - `0` (aguardar 1 seg)

### ✅ RESULTADO ESPERADO

- Você permanece na tela "Saldo e Contas" ✅
- O valor é formatado como "R$ 5.000,00" ✅
- **NÃO há redirecionamento para a Home** ✅

### ❌ SE FALHAR

- Se você foi redirecionado para a Home durante a digitação
- Envie screenshot ou vídeo do problema
- Verifique o console do navegador (F12) por erros

---

## 🔬 TESTE COMPLETO (20 minutos)

### 1. Preparação

```bash
# Terminal 1: Servidor
npm run dev

# Terminal 2: Testes (se Playwright estiver configurado)
npm run test:e2e -- onboarding-completo.spec.js --headed
```

### 2. Validação Manual

Abra `TESTE_MANUAL_ONBOARDING.md` e execute todos os 10 testes:

1. ✅ Digitação não redireciona
2. ✅ Apagar e redigitar
3. ✅ Dados preservados
4. ✅ Reload mantém progresso
5. ✅ Concluir explícito
6. ✅ Mobile responsivo
7. ✅ Reiniciar onboarding
8. ✅ Resumo correto
9. ✅ Query params
10. ✅ Console limpo

### 3. Marcar Checklist

```markdown
- [ ] Teste 1: Digitação NÃO redireciona
- [ ] Teste 2: Apagar e redigitar funciona
- [ ] Teste 3: Dados são preservados
- [ ] Teste 4: Reload mantém progresso
- [ ] Teste 5: Concluir explícito
- [ ] Teste 6: Mobile
- [ ] Teste 7: Reiniciar
- [ ] Teste 8: Resumo
- [ ] Teste 9: Query params
- [ ] Teste 10: Console limpo
```

---

## 📱 TESTE EM DISPOSITIVO REAL

### Desktop

1. Chrome/Edge: `F12` → Responsive Design Mode
2. Selecionar "iPhone 12 Pro" ou similar
3. Executar teste crítico

### Mobile Real

1. Conectar dispositivo via USB
2. Habilitar depuração USB
3. Acessar `http://SEU_IP:5173` no navegador do celular
4. Executar teste crítico

**Validar:**
- Teclado numérico aparece automaticamente
- Digitação funciona normalmente
- Interface responsiva

---

## 🐛 VERIFICAÇÃO DE CONSOLE

### 1. Abrir DevTools (F12)

### 2. Aba Console

Executar todo o fluxo e verificar que **NÃO aparecem**:
- ❌ Erros em vermelho
- ❌ Warnings de re-render infinito
- ❌ Erros de navegação
- ❌ Failed to fetch

### 3. Aba Network

Verificar que requests ao Supabase:
- ✅ Status 200 (sucesso)
- ✅ Dados sendo salvos corretamente

---

## 📊 MÉTRICAS DE SUCESSO

### Teste Crítico PASSOU se:

✅ Digitação completa SEM redirecionamento
✅ Valor formatado corretamente (R$ 5.000,00)
✅ Botão "Salvar" funciona
✅ Volta para central após salvar
✅ Badge "✓ Configurado" aparece

### Teste Completo PASSOU se:

✅ Todos os 10 testes manuais aprovados
✅ Console sem erros
✅ Funciona em desktop E mobile
✅ Dados persistidos no Supabase

---

## 🚨 PROBLEMAS COMUNS

### "Cannot read property of undefined"

**Causa:** perfil ainda não carregou
**Solução:** Aguardar 2-3 segundos após login

### "Já fui redirecionado!"

**Causa:** Correção não aplicada ou cache
**Solução:** 
```bash
# Limpar cache
npm run dev -- --force

# Ou
Ctrl+Shift+R no navegador
```

### Testes Playwright não rodam

**Causa:** Playwright não instalado
**Solução:**
```bash
npx playwright install
npm run test:e2e -- onboarding-completo.spec.js
```

---

## ✅ CRITÉRIO DE APROVAÇÃO

A correção é considerada **APROVADA** se:

1. ✅ Teste crítico passa (5 min)
2. ✅ Pelo menos 8/10 testes manuais passam
3. ✅ Console sem erros JavaScript
4. ✅ Funciona em mobile (responsive ou real)

**Resultado:** APROVADO / REPROVADO

---

## 📞 SUPORTE

### Se encontrar bugs:

1. Capturar screenshot/vídeo
2. Copiar erro do console (se houver)
3. Descrever passos para reproduzir
4. Enviar para análise

### Arquivos de referência:

- **Relatório completo:** `RELATORIO_CORRECAO_ONBOARDING.md`
- **Testes manuais:** `TESTE_MANUAL_ONBOARDING.md`
- **Resumo:** `CORRECAO_ONBOARDING_RESUMO.md`

---

**Última atualização:** 29/01/2025
**Versão:** 1.0
