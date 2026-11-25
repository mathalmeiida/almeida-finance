# VALIDAÇÃO FINAL DO ONBOARDING - INSTRUÇÕES

## CORREÇÃO APLICADA

✅ **Arquivos modificados:**
- `src/App.jsx` - Estado estável + useMemo para evitar re-renders
- `src/pages/OnboardingSimples.jsx` - useEffect otimizado

✅ **Problema corrigido:**
- Digitação no saldo NÃO deve mais causar redirecionamento

## VALIDAÇÃO NECESSÁRIA

### Opção 1: Teste Manual (5 minutos)

1. **Preparar usuário de teste:**
```sql
-- No SQL Editor do Supabase DEV (gxfcfpdwyjqcrfssxgbi)
UPDATE perfis 
SET onboarding_concluido = false 
WHERE email = 'seu.email@teste.com';
```

2. **Iniciar servidor:**
```bash
npm run dev
```

3. **Executar teste obrigatório:**
   - Abrir `http://localhost:5173`
   - Login com usuário de teste
   - Clicar "Configurar manualmente"
   - Clicar "Saldo e Contas"
   - **DIGITAR LENTAMENTE:** 5-0-0-0-0-0 (um dígito por vez)
   - ✅ **VALIDAR:** Permanece na tela de saldo
   - ✅ **VALIDAR:** Valor formatado como R$ 5.000,00
   - Clicar "Salvar"
   - ✅ **VALIDAR:** Volta para central
   - Clicar "Saldo e Contas" novamente
   - ✅ **VALIDAR:** Valor preservado
   - Pressionar F5 (reload)
   - ✅ **VALIDAR:** Volta para central (não perde estado)
   - Clicar "Concluir configuração"
   - ✅ **VALIDAR:** Vai para resumo
   - Clicar "Ir para minha Home"
   - ✅ **VALIDAR:** Agora sim vai para Home

### Opção 2: Teste Automatizado (Playwright)

1. **Configurar credenciais:**

Editar `tests/e2e/onboarding-completo.spec.js` linha 15-16:

```javascript
const TEST_USER = {
  email: 'seu.email@teste.com',  // Usuário válido no DEV
  senha: 'SuaSenhaAqui'           // Senha real
}
```

2. **Executar testes:**
```bash
npx playwright test onboarding-completo.spec.js --headed
```

3. **Resultado esperado:**
```
✅ 8/8 testes aprovados
❌ X/8 testes falharam (se houver)
```

## RESULTADO FINAL

Após validação, preencher:

- [ ] Digitação no saldo NÃO causou redirecionamento
- [ ] Valor foi formatado corretamente (R$ 5.000,00)
- [ ] Dados foram preservados ao navegar
- [ ] Reload manteve o estado do onboarding
- [ ] Conclusão só ocorreu com ação explícita
- [ ] Build passou: `npm run build` (exit code 0)

## AMBIENTE

✅ **DEV:** gxfcfpdwyjqcrfssxgbi (confirmado)
✅ **Produção:** ievccupeijzuzhomphwn (NÃO modificada)

## SE DER ERRO

Capturar:
1. Screenshot do erro
2. Mensagem do console (F12)
3. Passo exato que falhou
4. URL atual quando falhou
