# ✅ TESTE MANUAL - WhatsApp Financeiro

## STATUS: Pronto para Teste Real

Execute este checklist para validar o sistema:

### 1. Acesso ao Simulador
- [ ] Login como admin
- [ ] Acessar /admin
- [ ] Clicar na aba "WhatsApp"
- [ ] Clicar em "Abrir simulador"
- [ ] URL deve ser /admin/whatsapp

### 2. Modo Simulação (Padrão)
- [ ] Verificar botão "Simulação" no header
- [ ] Banner azul informando "Modo Simulação Ativo"
- [ ] Enviar: "Recebi 3000 de salário"
- [ ] Verificar preview com R$ 3.000,00
- [ ] Confirmar transação
- [ ] Verificar mensagem de sucesso
- [ ] Confirmar que NÃO gravou no banco (verificar em /receitas)

### 3. Modo Real (Gravação no Banco)
- [ ] Clicar no botão "Simulação" para alternar
- [ ] Verificar mudança para botão "Real"
- [ ] Banner verde "Modo Real Ativo"
- [ ] Enviar: "Gastei 150 no mercado"
- [ ] Verificar preview com R$ 150,00
- [ ] Categoria deve ser "alimentacao" (detectada automaticamente)
- [ ] Confirmar transação
- [ ] Aguardar mensagem "Gravado com sucesso"
- [ ] Ir em /despesas e CONFIRMAR que a despesa foi salva
- [ ] Verificar descrição, valor e categoria corretos

### 4. Validações
- [ ] Enviar mensagem sem valor: "Fui ao mercado"
- [ ] Deve exibir erro: "valor monetário válido"
- [ ] Enviar mensagem muito curta: "Ok"
- [ ] Deve exibir erro: "muito curta"

### 5. Edição de Preview
- [ ] Enviar: "Paguei 50"
- [ ] Clicar no ícone de lápis
- [ ] Alterar descrição para "Conta de luz"
- [ ] Alterar categoria para "moradia"
- [ ] Salvar
- [ ] Verificar alterações no preview

### 6. Categorias Automáticas
Testar detecção automática:
- [ ] "Gastei 200 no mercado" → alimentacao
- [ ] "Paguei 1500 de aluguel" → moradia
- [ ] "Uber de 30" → transporte
- [ ] "Remédio 80" → saude
- [ ] "Livro 50" → educacao

### 7. Isolamento de Usuários
- [ ] Em modo real, criar uma despesa
- [ ] Fazer logout
- [ ] Login com outro usuário
- [ ] Verificar que a despesa NÃO aparece para ele

## ⚠️ RESULTADO ESPERADO

✅ Modo Simulação: Não grava no banco  
✅ Modo Real: Grava receitas/despesas no Supabase  
✅ Parser funciona corretamente  
✅ Categorização automática funciona  
✅ Validações impedem dados inválidos  
✅ Isolamento entre usuários preservado  

## 🐛 BUGS ENCONTRADOS

(Registrar aqui qualquer problema)

---

**Testado por**: _____________  
**Data**: _____________  
**Aprovado**: [ ] Sim [ ] Não
