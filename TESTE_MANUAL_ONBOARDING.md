# 🧪 TESTE MANUAL DO ONBOARDING - ALMEIDA FINANCE

## 📋 Pré-requisitos

- Usuário de teste com onboarding não concluído
- Navegador aberto (Chrome/Firefox/Edge)
- DevTools abertos (F12) para monitorar console e rede

## ✅ TESTE 1: Digitação do Saldo NÃO Redireciona

### Objetivo
Validar que ao digitar o saldo inicial, o usuário NÃO é redirecionado automaticamente para a Home.

### Passos
1. Fazer login no app
2. Na tela "Vamos organizar suas finanças", clicar em **"Configurar manualmente"**
3. Na central de configuração, clicar em **"Saldo e Contas"**
4. Aguardar a tela "Saldo e Contas" carregar
5. Clicar no campo de saldo
6. Digitar **LENTAMENTE**, um número por vez:
   - `5` → Aguardar 1 segundo
   - `0` → Aguardar 1 segundo
   - `0` → Aguardar 1 segundo
   - `0` → Aguardar 1 segundo
   - `0` → Aguardar 1 segundo
   - `0` → Aguardar 1 segundo

### Resultado Esperado
- ✅ O usuário permanece na tela "Saldo e Contas" durante toda a digitação
- ✅ O valor é formatado automaticamente como "R$ 5.000,00"
- ✅ NÃO há redirecionamento para a Home
- ✅ NÃO há erros no console do navegador

### Resultado Anterior (BUG)
- ❌ Durante a digitação, usuário era redirecionado para a Home
- ❌ Valor não era salvo
- ❌ Onboarding era marcado como concluído indevidamente

---

## ✅ TESTE 2: Apagar e Redigitar Saldo

### Objetivo
Validar que é possível apagar o valor e digitar novamente sem problemas.

### Passos
1. Na tela "Saldo e Contas", digitar `300000` (R$ 3.000,00)
2. Aguardar 2 segundos
3. Verificar que ainda está na tela de saldo
4. Selecionar todo o texto (Ctrl+A) e deletar
5. Digitar novo valor: `1250050` (R$ 12.500,50)
6. Aguardar 2 segundos

### Resultado Esperado
- ✅ Permanece na tela durante todo o processo
- ✅ Valor é atualizado corretamente
- ✅ Formatação funciona para ambos os valores

---

## ✅ TESTE 3: Voltar e Avançar Preserva Dados

### Objetivo
Validar que ao navegar entre etapas, os dados são preservados.

### Passos
1. Na tela "Saldo e Contas", digitar `750000` (R$ 7.500,00)
2. Clicar em **"Salvar"**
3. Aguardar voltar para a central de configuração
4. Verificar que aparece badge **"✓ Configurado"** no módulo Saldo
5. Clicar novamente em **"Saldo e Contas"**
6. Verificar o valor no campo

### Resultado Esperado
- ✅ Valor permanece como R$ 7.500,00
- ✅ Badge de configurado aparece
- ✅ Ao reabrir, dados estão preservados

---

## ✅ TESTE 4: Atualizar Página Durante Onboarding

### Objetivo
Validar que atualizar a página não perde o progresso.

### Passos
1. Configurar saldo: `800000` (R$ 8.000,00)
2. Clicar em **"Salvar"**
3. Voltar para a central
4. Pressionar **F5** para recarregar a página
5. Aguardar página carregar

### Resultado Esperado
- ✅ Volta para a central de configuração
- ✅ Saldo aparece como configurado
- ✅ NÃO volta para tela de boas-vindas
- ✅ NÃO é redirecionado para Home

---

## ✅ TESTE 5: Concluir Só com Ação Explícita

### Objetivo
Validar que o onboarding SÓ é concluído quando o usuário clica explicitamente.

### Passos
1. Configurar saldo: `500000` (R$ 5.000,00)
2. Clicar em **"Salvar"**
3. Voltar para a central
4. **NÃO** clicar em "Concluir configuração" ainda
5. Aguardar 10 segundos
6. Verificar que ainda está na central
7. Clicar em **"Concluir configuração"**
8. Aguardar tela de conclusão
9. Clicar em **"Ir para minha Home"**

### Resultado Esperado
- ✅ Apenas salvar NÃO conclui o onboarding
- ✅ Aguardar na central NÃO conclui automaticamente
- ✅ Só vai para Home após clicar explicitamente em "Ir para minha Home"
- ✅ Resumo final mostra os dados configurados corretamente

---

## ✅ TESTE 6: Funciona em Mobile

### Objetivo
Validar que o onboarding funciona em resolução mobile.

### Passos
1. Abrir DevTools (F12)
2. Ativar modo responsivo (Ctrl+Shift+M)
3. Selecionar "iPhone 12 Pro" ou "Samsung Galaxy S20"
4. Fazer login
5. Seguir fluxo normal do onboarding
6. Digitar saldo usando teclado numérico virtual

### Resultado Esperado
- ✅ Interface se adapta ao mobile
- ✅ Teclado numérico aparece ao focar no campo
- ✅ Digitação funciona corretamente
- ✅ NÃO há redirecionamento indevido
- ✅ Botões são clicáveis em telas pequenas

---

## ✅ TESTE 7: Zerar Dados e Recomeçar

### Objetivo
Validar que é possível reiniciar o onboarding após zerar dados.

### Passos
1. Completar o onboarding normalmente
2. Ir para **Mais > Configurações**
3. Procurar opção **"Reiniciar configuração financeira"** ou similar
4. Confirmar reinício
5. Verificar que volta para a tela de boas-vindas

### Resultado Esperado
- ✅ Opção de reiniciar está disponível
- ✅ Após confirmar, volta para o onboarding
- ✅ Dados anteriores aparecem pré-preenchidos
- ✅ Pode configurar novamente normalmente

---

## ✅ TESTE 8: Dados Aparecem no Resumo Final

### Objetivo
Validar que os dados configurados aparecem corretamente no resumo.

### Passos
1. Configurar saldo: `1000000` (R$ 10.000,00)
2. Salvar
3. Clicar em "Concluir configuração"
4. Na tela "Tudo pronto!", verificar seção "Resumo"

### Resultado Esperado
- ✅ Resumo mostra "Saldo disponível: R$ 10.000,00"
- ✅ Se configurou receitas/despesas, aparecem no resumo
- ✅ Valores estão corretos e formatados

---

## ✅ TESTE 9: Navegação com Query Params

### Objetivo
Validar que URLs com `?origem=onboarding` funcionam corretamente.

### Passos
1. Durante o onboarding, clicar em um módulo que redireciona (ex: Receitas)
2. Verificar que a URL contém `?origem=onboarding`
3. Adicionar uma receita
4. Voltar para o onboarding

### Resultado Esperado
- ✅ Redirecionamento funciona
- ✅ Pode adicionar dados normalmente
- ✅ Voltar retorna para o onboarding, não para Home
- ✅ Flag `CHAVE_CONFIGURANDO` está ativa

---

## ✅ TESTE 10: Console Sem Erros

### Objetivo
Validar que não há erros JavaScript durante o onboarding.

### Passos
1. Abrir DevTools (F12) → Aba Console
2. Limpar console
3. Executar todo o fluxo de onboarding
4. Monitorar erros

### Resultado Esperado
- ✅ NÃO aparecem erros em vermelho
- ✅ NÃO aparecem warnings sobre re-renderizações infinitas
- ✅ NÃO aparecem erros de navegação
- ✅ Apenas logs informativos (se houver)

---

## 📊 CHECKLIST DE VALIDAÇÃO

Marque com ✅ os testes que passaram e ❌ os que falharam:

- [ ] Teste 1: Digitação NÃO redireciona
- [ ] Teste 2: Apagar e redigitar funciona
- [ ] Teste 3: Dados são preservados ao navegar
- [ ] Teste 4: Atualizar página mantém progresso
- [ ] Teste 5: Concluir só com ação explícita
- [ ] Teste 6: Funciona em mobile
- [ ] Teste 7: Reiniciar onboarding funciona
- [ ] Teste 8: Resumo mostra dados corretos
- [ ] Teste 9: Query params funcionam
- [ ] Teste 10: Console sem erros

---

## 🐛 REGISTRO DE BUGS

Se encontrar problemas, registre aqui:

### Bug Encontrado:
**Descrição:**
**Passos para reproduzir:**
**Resultado esperado:**
**Resultado obtido:**
**Screenshots/Logs:**

---

## ✅ CRITÉRIO DE SUCESSO

O onboarding é considerado **corrigido definitivamente** se:

1. **Todos os 10 testes passarem** (10/10)
2. **Console sem erros** durante todo o fluxo
3. **Funciona em desktop E mobile**
4. **Dados são persistidos** corretamente
5. **Navegação não causa redirecionamentos indevidos**
6. **Apenas ação explícita conclui o onboarding**

---

**Data do teste:** ___/___/______
**Testador:** ________________
**Navegador:** ________________
**Versão do app:** ________________
**Resultado final:** APROVADO / REPROVADO
