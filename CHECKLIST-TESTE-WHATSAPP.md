# ✅ Checklist de Testes - WhatsApp Financeiro

## 📱 Teste 1: Acesso ao Simulador

- [ ] Faça login como **admin** no Almeida Finance
- [ ] Acesse a página `/admin`
- [ ] Verifique se a aba **"WhatsApp"** aparece no menu superior
- [ ] Clique na aba WhatsApp
- [ ] Verifique se o card com descrição aparece
- [ ] Clique no botão **"Abrir simulador"**
- [ ] Confirme que a URL mudou para `/admin/whatsapp`

**Resultado Esperado**: Página do simulador de chat aberta

---

## 💬 Teste 2: Interface do Chat

- [ ] Verifique o **header verde** com título "WhatsApp Financeiro"
- [ ] Verifique o **banner azul** informando "Modo Simulação Ativo"
- [ ] Verifique a **seção de exemplos** com 4 mensagens
- [ ] Verifique o **campo de input** na parte inferior
- [ ] Verifique o **botão Enviar** (verde)

**Resultado Esperado**: Interface limpa e profissional estilo WhatsApp

---

## 🧪 Teste 3: Exemplo Clicável

- [ ] Clique no primeiro exemplo: **"Recebi 3000 de salário"**
- [ ] Verifique se o texto aparece no campo de input
- [ ] Clique em **Enviar** ou pressione **Enter**
- [ ] Aguarde o processamento

**Resultado Esperado**: 
- Mensagem aparece no chat (balão verde à direita)
- Preview de transação aparece (card branco com borda verde)
- Preview mostra: **"Nova Receita"** com ícone de seta para cima

---

## 💰 Teste 4: Preview de Receita

Verifique se o preview contém:
- [ ] Ícone de **TrendingUp** (verde)
- [ ] Título: "Nova Receita"
- [ ] Descrição extraída (ex: "Salário")
- [ ] Valor: **R$ 3000.00** (em verde)
- [ ] Categoria (se detectada)
- [ ] Mensagem original no box azul
- [ ] Botões: **Confirmar** e **Cancelar**
- [ ] Ícone de lápis (editar) no canto superior direito

**Resultado Esperado**: Preview completo e visualmente correto

---

## ✏️ Teste 5: Modo Edição

- [ ] Clique no **ícone de lápis** (Edit2)
- [ ] Verifique se aparecem 3 campos de input:
  - Descrição
  - Valor (R$)
  - Categoria (opcional)
- [ ] Altere a descrição para **"Salário Mensal"**
- [ ] Altere o valor para **3500**
- [ ] Digite categoria: **"Trabalho"**
- [ ] Clique em **Salvar** (botão verde)

**Resultado Esperado**: 
- Preview atualizado com novos valores
- Modo edição fechado
- Valores alterados refletidos no preview

---

## ✅ Teste 6: Confirmação de Transação

- [ ] Clique em **Confirmar** no preview
- [ ] Verifique se aparece mensagem de sucesso no chat (balão verde à esquerda)
- [ ] Mensagem deve conter:
  - ✅ "Transação registrada com sucesso!"
  - Emoji 📈 ou 📉
  - Descrição
  - Valor
  - Categoria
  - ⚠️ "Modo simulação - não foi gravado no banco de dados"
- [ ] Preview deve desaparecer
- [ ] Campo de input deve estar habilitado novamente

**Resultado Esperado**: Confirmação visual clara e chat pronto para nova mensagem

---

## 🚫 Teste 7: Cancelamento

- [ ] Digite: **"Paguei 50 de luz"**
- [ ] Clique em Enviar
- [ ] Aguarde o preview (Despesa com valor R$ 50.00)
- [ ] Clique em **Cancelar**

**Resultado Esperado**:
- Preview desaparece
- Campo de input habilitado
- Nenhuma mensagem de confirmação é adicionada

---

## 💸 Teste 8: Despesa Simples

- [ ] Digite: **"Gastei 150 no mercado"**
- [ ] Enviar
- [ ] Verifique preview:
  - Tipo: **"Nova Despesa"**
  - Ícone: **TrendingDown** (vermelho)
  - Valor: **R$ 150.00** (em vermelho)
  - Categoria: **"alimentacao"** (detectada automaticamente)
- [ ] Confirme

**Resultado Esperado**: Despesa processada corretamente com categoria automática

---

## 🏷️ Teste 9: Categoria Manual

- [ ] Digite: **"Paguei 80 categoria transporte"**
- [ ] Enviar
- [ ] Verifique se categoria **"transporte"** foi reconhecida
- [ ] Confirme

**Resultado Esperado**: Categoria extraída da mensagem

---

## 💳 Teste 10: Parcelamento

- [ ] Digite: **"Comprei 600 no notebook em 3x"**
- [ ] Enviar
- [ ] Verifique se o preview mostra:
  - Valor total: R$ 600.00
  - Parcelas: 3x de R$ 200.00
- [ ] Confirme

**Resultado Esperado**: Sistema reconhece parcelamento (futuro: criar 3 despesas mensais)

---

## 👨‍👩‍👧 Teste 11: Despesa Familiar

- [ ] Digite: **"Gastei 300 no mercado despesa familiar"**
- [ ] Enviar
- [ ] Verifique se flag **"familiar"** é detectada
- [ ] Confirme
- [ ] Mensagem de sucesso deve indicar **"👨‍👩‍👧‍👦 Despesa familiar"**

**Resultado Esperado**: Sistema reconhece despesa compartilhada

---

## ❌ Teste 12: Mensagem Inválida (Sem Valor)

- [ ] Digite: **"Fui ao mercado hoje"**
- [ ] Enviar

**Resultado Esperado**:
- Balão vermelho aparece no chat
- Ícone de alerta
- Mensagem: "Não foi possível identificar um valor monetário válido na mensagem"

---

## ❌ Teste 13: Mensagem Muito Curta

- [ ] Digite: **"Ok"**
- [ ] Enviar

**Resultado Esperado**:
- Erro: "Mensagem muito curta"

---

## 🔙 Teste 14: Navegação

- [ ] Clique no botão **voltar** (seta) no header
- [ ] Confirme que voltou para `/admin`
- [ ] Aba WhatsApp deve estar visível no menu

**Resultado Esperado**: Navegação fluida entre admin e simulador

---

## ⌨️ Teste 15: Atalhos de Teclado

- [ ] Digite uma mensagem
- [ ] Pressione **Enter** (sem Shift)
- [ ] Confirme que a mensagem é enviada

**Resultado Esperado**: Enter funciona como botão Enviar

---

## 📱 Teste 16: Responsividade (Mobile)

Se possível, teste em tela mobile ou redimensione o navegador:

- [ ] Header adaptado (texto "Enviar" oculto no mobile)
- [ ] Cards de exemplo rolam horizontalmente
- [ ] Input e botão redimensionam corretamente
- [ ] Preview ocupa 100% da largura disponível

**Resultado Esperado**: Interface responsiva e usável em mobile

---

## 🎨 Teste 17: Dark Mode (Admin)

- [ ] Verifique se o painel Admin usa tema escuro
- [ ] Simulador deve usar fundo claro (gray-50)
- [ ] Contraste adequado em ambos

**Resultado Esperado**: Estilos consistentes e legíveis

---

## 🔄 Teste 18: Múltiplas Mensagens

Envie sequencialmente:
1. "Recebi 2000 salário" → Confirmar
2. "Gastei 100 mercado" → Confirmar
3. "Paguei 50 luz" → Cancelar
4. "Entrada de 500 freelance" → Confirmar

**Resultado Esperado**:
- Chat mostra histórico completo
- Scroll automático para última mensagem
- Apenas confirmadas aparecem no chat

---

## 🧹 Teste 19: Limpeza de Estado

- [ ] Envie várias mensagens
- [ ] Clique em Voltar
- [ ] Entre novamente no simulador

**Resultado Esperado**: 
- Chat zerado (estado não persiste)
- Exemplos aparecem novamente

---

## 🔐 Teste 20: Proteção de Rota

- [ ] Faça logout
- [ ] Tente acessar diretamente: `/admin/whatsapp`

**Resultado Esperado**: 
- Redirecionado para `/login`
- Rota protegida funcionando

---

## 📊 Resumo de Testes

Total de testes: **20**

- [ ] Todos passaram ✅
- [ ] Encontrei bugs 🐛 (descrever abaixo)

---

## 🐛 Bugs Encontrados

(Descreva aqui qualquer comportamento inesperado)

```
1. 

2. 

3. 
```

---

## ✅ Aprovação Final

- [ ] Interface funcional
- [ ] Parser preciso
- [ ] Navegação fluida
- [ ] Sem erros no console
- [ ] Pronto para produção

**Testado por**: _________________  
**Data**: _________________  
**Assinatura**: _________________

---

**🎉 Sistema testado e aprovado para uso em produção!**
