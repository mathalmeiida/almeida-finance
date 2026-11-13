# GUIA DE TESTE LOCAL — SelectCustomizado

**Objetivo**: Validar a correção dos seletores antes do deploy

---

## 🚀 INICIAR SERVIDOR DE DESENVOLVIMENTO

```bash
cd "c:\Users\MATHEUS\Desktop\App Financas\posso-comprar"
npm run dev
```

Aguardar mensagem:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

---

## 🧪 TESTES MANUAIS RECOMENDADOS

### 1. Desktop (Chrome/Firefox/Safari)

**Acesso**:
1. Abrir http://localhost:5173/
2. Fazer login (ou criar conta de teste)
3. Navegar para "Importação Inteligente" ou acessar via Onboarding

**Teste: Select de Cartão**:
1. Clicar no tipo "Fatura de cartão"
2. Clicar no campo "Escolha o cartão da fatura"
3. ✅ Verificar: dropdown abre SEM sobreposição
4. ✅ Verificar: dropdown tem borda arredondada e sombra
5. ✅ Verificar: opções listadas corretamente
6. ✅ Verificar: hover em opções muda fundo para cinza claro
7. Selecionar um cartão clicando
8. ✅ Verificar: dropdown fecha e nome do cartão aparece no botão
9. Reabrir dropdown
10. Clicar FORA do dropdown
11. ✅ Verificar: dropdown fecha

**Teste: Navegação por Teclado (Desktop)**:
1. Focar no select de cartão (Tab ou clicar)
2. Pressionar **Enter** ou **Space**
3. ✅ Verificar: dropdown abre
4. Pressionar **ArrowDown** 2 vezes
5. ✅ Verificar: foco move para 3ª opção (fundo vinho claro)
6. Pressionar **ArrowUp** 1 vez
7. ✅ Verificar: foco move para 2ª opção
8. Pressionar **Home**
9. ✅ Verificar: foco move para 1ª opção
10. Pressionar **End**
11. ✅ Verificar: foco move para última opção
12. Pressionar **Enter**
13. ✅ Verificar: opção selecionada, dropdown fecha
14. Reabrir dropdown
15. Pressionar **Escape**
16. ✅ Verificar: dropdown fecha sem selecionar

**Teste: Select de Investimento**:
1. Clicar no tipo "Investimentos"
2. Repetir testes do select de cartão
3. ✅ Verificar: comportamento idêntico

**Teste: Estados Especiais**:
1. Deletar todos os cartões (ir em Cartões → remover todos)
2. Voltar para Importação
3. Clicar em "Fatura de cartão"
4. ✅ Verificar: select desabilitado OU mensagem "Nenhum cartão cadastrado"
5. ✅ Verificar: link/botão para cadastrar cartão presente

---

### 2. Mobile (iPhone Safari)

**Acesso remoto**:
1. No servidor dev, copiar URL da rede: `http://192.168.x.x:5173/`
2. No iPhone Safari, abrir essa URL
3. Fazer login

**OU acesso via ngrok (se rede diferente)**:
```bash
npx ngrok http 5173
```
Copiar URL https fornecida (ex: https://abc123.ngrok.io)

**Teste: Select de Cartão (Touch)**:
1. Navegar para Importação
2. Tocar em "Fatura de cartão"
3. Tocar no campo "Escolha o cartão da fatura"
4. ✅ Verificar: **ZOOM NÃO ACONTECE** (font-size 16px previne)
5. ✅ Verificar: dropdown abre COMPLETO (não cortado)
6. ✅ Verificar: dropdown NÃO tem fundo azul/cinza (não é modal do iOS)
7. ✅ Verificar: altura das opções adequada para toque (44px min)
8. Tocar em uma opção
9. ✅ Verificar: opção selecionada, dropdown fecha
10. Reabrir dropdown
11. Tocar FORA do dropdown
12. ✅ Verificar: dropdown fecha

**Teste: Scroll (se muitos cartões)**:
1. Cadastrar 10+ cartões (temporariamente)
2. Abrir select de cartão
3. ✅ Verificar: dropdown tem scroll interno (max-height 280px)
4. Rolar lista com dedo
5. ✅ Verificar: scroll suave, sem lag

**Teste: PWA Standalone (iPhone)**:
1. No Safari, tocar botão "Compartilhar"
2. Escolher "Adicionar à Tela de Início"
3. Abrir app instalado (ícone na home)
4. Repetir testes do select
5. ✅ Verificar: comportamento IDÊNTICO ao Safari

---

### 3. Android Chrome

**Acesso remoto**:
Mesma URL de rede do servidor dev: `http://192.168.x.x:5173/`

**Testes**:
- Repetir testes do iPhone (touch, zoom, scroll)
- ✅ Verificar: comportamento consistente com iOS

---

### 4. Validação Visual (Screenshots)

**Tirar screenshots de**:
1. Dropdown fechado (select com placeholder)
2. Dropdown aberto (lista de opções visível)
3. Opção focada (hover/foco em desktop, touch em mobile)
4. Opção selecionada (check icon visível)

**Comparar com requisitos**:
- ✅ Paleta vinho (marca: #80 1D 39)
- ✅ Bordas arredondadas (rounded-lg)
- ✅ Sombra suave (shadow-lg)
- ✅ Ícone check (✓) na opção selecionada
- ✅ Chevron rotaciona ao abrir (180deg)

---

## 🐛 PROBLEMAS CONHECIDOS A VERIFICAR

### ❌ Se dropdown ainda aparecer cortado:
**Causa provável**: Container pai com `overflow: hidden` ou `z-index` alto
**Verificar**: Inspecionar elemento (DevTools) → verificar `z-index` do dropdown é 50
**Solução**: Aumentar z-index em `SelectCustomizado.jsx` linha 185

### ❌ Se zoom acontecer no iPhone:
**Causa provável**: Font-size < 16px em alguma parte
**Verificar**: Inspecionar elemento → verificar computed font-size do botão e opções
**Solução**: Garantir `style={{ fontSize: '16px' }}` inline

### ❌ Se dropdown não fechar ao clicar fora:
**Causa provável**: Event listeners não adicionados
**Verificar**: Console do navegador → erros de JavaScript?
**Solução**: Verificar useEffect em `SelectCustomizado.jsx` linha 45-62

### ❌ Se navegação por teclado não funcionar:
**Causa provável**: Foco não está no botão
**Verificar**: Pressionar Tab até botão ficar com outline visível
**Solução**: Garantir que botão tem `tabIndex={0}` (default para `<button>`)

---

## 📊 CHECKLIST DE VALIDAÇÃO LOCAL

### Desktop
- [ ] Dropdown abre sem sobreposição
- [ ] Dropdown fecha ao clicar fora
- [ ] Navegação por teclado funciona (↑↓ Enter Escape)
- [ ] Hover em opções muda cor de fundo
- [ ] Check icon visível na opção selecionada
- [ ] Chevron rotaciona ao abrir/fechar
- [ ] Select desabilitado quando sem opções

### Mobile (iPhone/Android)
- [ ] Zoom NÃO acontece ao tocar no select
- [ ] Dropdown abre completo (não cortado)
- [ ] Dropdown NÃO é modal do SO (sem fundo azul/cinza)
- [ ] Altura das opções adequada para toque (44px)
- [ ] Scroll interno funciona (se muitas opções)
- [ ] Dropdown fecha ao tocar fora
- [ ] Visual consistente com desktop

### Acessibilidade
- [ ] Label associado ao select (clicar label foca select)
- [ ] Focus visível (outline/ring ao focar)
- [ ] Screen reader anuncia "listbox" e "option"
- [ ] aria-expanded reflete estado (true/false)
- [ ] aria-selected marca opção atual

### Integração
- [ ] Cartão selecionado vincula arquivo corretamente
- [ ] Investimento selecionado vincula arquivo corretamente
- [ ] Upload continua funcionando após seleção
- [ ] Mensagem "Nenhum cartão" aparece quando lista vazia
- [ ] Link "Cadastrar cartão" funciona

---

## 🔄 ROLLBACK (se necessário)

Se algum teste falhar criticamente:

```bash
# Reverter commit
git reset --soft HEAD~1

# OU reverter arquivos específicos
git checkout HEAD~1 -- src/pages/ImportacaoInteligente.jsx
git checkout HEAD~1 -- package.json
git rm src/components/SelectCustomizado.jsx
git rm tests/select-customizado.test.mjs
```

Reportar falha com:
- Screenshot do problema
- Navegador/dispositivo
- Console errors (se houver)

---

## ✅ APROVAÇÃO PARA DEPLOY

**Após validar TODOS os testes acima**, informar:
- ✅ "Testes locais passaram, autorizo push e deploy"
- ⚠️ "Testes passaram com ressalvas: [descrever]"
- ❌ "Testes falharam: [descrever problema]"

---

## 📞 CONTATO PARA DÚVIDAS

Se encontrar problemas não documentados aqui:
1. Tirar screenshot
2. Copiar erros do Console (F12 → Console)
3. Anotar navegador/dispositivo usado
4. Descrever passos para reproduzir

---

**ALMEIDA FINANCE 2.0**  
Guia de Teste Local — SelectCustomizado  
Commit `e008a2e` | 4 arquivos | 37 testes ✅ | Build OK ✅
