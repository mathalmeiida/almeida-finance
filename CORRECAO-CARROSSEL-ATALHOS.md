# 🔧 CORREÇÃO: CARROSSEL DE ATALHOS DA HOME
## Almeida Finance | Data: 06/11/2026

---

## 🎯 PROBLEMA IDENTIFICADO

### Sintoma:
Os 4 atalhos da Home ("Simular compra", "E se...?", "Investimentos", "Metas") **não permitiam rolagem horizontal** no celular.

### Causa Raiz:
A classe `.af-shortcut-btn` tinha `flex: 1`, que faz os cards **ocuparem igualmente todo o espaço disponível**. Em viewports maiores que ~400px, os 4 cards cabiam na tela inteira, sem gerar overflow horizontal.

**CSS Problemático:**
```css
.af-shortcut-btn {
  flex: 1;  /* ❌ Cada card ocupa 1/4 do espaço */
  /* ... */
}
```

**Comportamento:**
- Viewport 375px: 4 cards x 25% cada = 100% (sem scroll)
- Viewport 768px: 4 cards x 25% cada = 100% (sem scroll)

---

## ✅ SOLUÇÃO APLICADA

### Alteração:
Substituir `flex: 1` por **largura fixa** de `100px`.

**CSS Corrigido:**
```css
.af-shortcut-btn {
  min-width: 100px;  /* ✅ Largura mínima fixa */
  width: 100px;      /* ✅ Largura fixa */
  /* flex: 1 removido */
  /* ... */
}
```

**Novo Comportamento:**
- Viewport 375px: 4 cards x 100px + gaps = ~416px **(gera scroll ✅)**
- Viewport 768px: 4 cards x 100px + gaps = ~416px (sem scroll, OK)

---

## 📝 ARQUIVO MODIFICADO

### `src/index.css` (linhas 661-673)

**Antes:**
```css
.af-shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 1;  /* ❌ Problema */
  padding: 9px 3px;
  /* ... */
}
```

**Depois:**
```css
.af-shortcut-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 100px;  /* ✅ Largura fixa */
  width: 100px;      /* ✅ Largura fixa */
  padding: 9px 3px;
  /* ... */
}
```

**Diff:**
```diff
- flex: 1;
+ min-width: 100px;
+ width: 100px;
```

---

## ✅ VALIDAÇÃO AUTOMÁTICA

### Teste Criado: `tests/carrossel-atalhos.test.mjs`

**Verificações:**
1. ✅ `overflow-x-auto` presente no Dashboard
2. ✅ `snap-x snap-mandatory` configurado
3. ✅ `touchAction: pan-x` habilitado
4. ✅ `scrollbar-hide` (oculta scrollbar)
5. ✅ `flex: 1` **AUSENTE** (problema corrigido)
6. ✅ `min-width` e `width` fixos **PRESENTES**
7. ✅ `snap-start` nos botões
8. ✅ `flex-shrink-0` nos botões
9. ✅ Full bleed (`-mx-4 px-4`)
10. ✅ 4 cards configurados
11. ✅ Scrollbar oculta (`scrollbarWidth: none`)

**Resultado do Teste:**
```
✅ TODOS OS TESTES PASSARAM

O carrossel está corretamente configurado.
Largura fixa dos cards forçará scroll horizontal.
```

---

## 🧪 VALIDAÇÃO MANUAL NECESSÁRIA

### Mobile (375px - iPhone SE):

#### Teste 1: Scroll Horizontal
1. [ ] Abrir app no celular ou DevTools mobile
2. [ ] Acessar Dashboard (Home)
3. [ ] Localizar seção de atalhos (abaixo do calendário)
4. [ ] **Arrastar** horizontalmente com o dedo
5. [ ] Verificar movimento suave
6. [ ] Confirmar **snap** ao soltar (card "gruda" na posição)

**Resultado Esperado:**
- Cards deslizam para esquerda/direita ✅
- Scroll suave e responsivo ✅
- Snap alinha card ao centro/início ✅
- Scrollbar invisível ✅

---

#### Teste 2: Navegação
1. [ ] Deslizar para ver todos os 4 cards
2. [ ] Clicar em cada atalho
3. [ ] Verificar navegação correta:
   - "Simular compra" → `/posso-comprar`
   - "E se...?" → `/e-se`
   - "Investimentos" → `/investimentos`
   - "Metas" → `/metas`

**Resultado Esperado:**
- Todos os cards acessíveis ✅
- Click/tap funciona normalmente ✅
- Não há conflito entre scroll e click ✅

---

#### Teste 3: Sem Interferência na Rolagem Vertical
1. [ ] Deslizar verticalmente na Home
2. [ ] Verificar que página rola normalmente
3. [ ] Deslizar horizontalmente **apenas** nos atalhos
4. [ ] Verificar que rolagem vertical não é afetada

**Resultado Esperado:**
- Scroll vertical da página: ✅ OK
- Scroll horizontal isolado nos atalhos: ✅ OK
- Sem scroll horizontal na página inteira: ✅ OK

---

### Desktop (1920px):

#### Teste 4: Comportamento em Tela Grande
1. [ ] Abrir app no desktop
2. [ ] Acessar Dashboard
3. [ ] Verificar atalhos

**Resultado Esperado:**
- 4 cards visíveis sem scroll (416px < 1920px) ✅
- Centralização ou alinhamento adequado ✅
- Sem espaçamento excessivo ✅

---

### Tablet (768px):

#### Teste 5: Comportamento Intermediário
1. [ ] Abrir app em viewport 768px
2. [ ] Verificar atalhos

**Resultado Esperado:**
- 4 cards visíveis sem scroll ✅
- Layout responsivo adequado ✅

---

## 🔍 DESIGN PRESERVADO

### ✅ Mantido Intacto:

- **Cores Vinho Premium:**
  - Background: `#FFFFFF`
  - Border: `#E5BAC4`
  - Primary: `#801D39`
  - Icon bg: `#FFF5F7`
  - Muted: `#643F4F`

- **Ícones:**
  - ShoppingCart (Simular compra)
  - Sparkles (E se...?)
  - TrendingUp (Investimentos)
  - Target (Metas)

- **Tipografia:**
  - Label: 10px, `#D4A8B6`
  - Fonte atual mantida

- **Espaçamento:**
  - Gap entre cards: `gap-2` (8px)
  - Padding: `9px 3px`
  - Border-radius: `12px`

- **Dimensões:**
  - Ícone: 44x44px
  - Card: 100px largura (antes: flex)

---

## 📊 BUILD FINAL

```
vite v5.4.21 building for production...
✓ 1643 modules transformed.
dist/index.html                     3.00 kB │ gzip:   1.16 kB
dist/assets/index-BBf4TUhH.css     77.29 kB │ gzip:  14.02 kB
dist/assets/index-XXXXXXX.js   1,169.99 kB │ gzip: 296.26 kB

✓ built in 5.03s
```

**Status:** ✅ Build sem erros

---

## 📋 CHECKLIST FINAL

### Código
- [x] `flex: 1` removido
- [x] `min-width: 100px` adicionado
- [x] `width: 100px` adicionado
- [x] Build sem erros
- [x] Teste automatizado passando

### Funcionalidade (Teste Manual)
- [ ] Scroll horizontal no mobile (375px)
- [ ] Snap suave ao soltar
- [ ] Todos os 4 cards acessíveis
- [ ] Navegação funciona (click/tap)
- [ ] Sem interferência no scroll vertical
- [ ] Desktop sem problemas (1920px)
- [ ] Tablet sem problemas (768px)

### Design
- [x] Cores preservadas
- [x] Ícones preservados
- [x] Tipografia preservada
- [x] Espaçamento preservado
- [x] Border-radius preservado

---

## 🎯 RESULTADO ESPERADO

### Mobile:
```
┌────┬────┬────┬────┐
│ 🛒 │ ✨ │ 📈 │ 🎯 │  ← Desliza →
│Sim │E se│Inv │Met │
└────┴────┴────┴────┘
   ↑ scroll horizontal
```

### Desktop:
```
┌────┬────┬────┬────┐
│ 🛒 │ ✨ │ 📈 │ 🎯 │  (sem scroll)
│Sim │E se│Inv │Met │
└────┴────┴────┴────┘
```

---

## ✅ CONCLUSÃO

### Status: 🟢 **CORREÇÃO APLICADA COM SUCESSO**

**O que foi feito:**
- ✅ Problema identificado (`flex: 1`)
- ✅ Solução aplicada (largura fixa `100px`)
- ✅ Teste automatizado criado e passando
- ✅ Build sem erros
- ✅ Design preservado

**O que falta:**
- ⏳ Validação manual no celular (375px)
- ⏳ Confirmar scroll e snap funcionam

**Recomendação:**
✅ **PRONTO PARA TESTE MANUAL**

Execute os testes manuais na seção anterior para confirmar que o carrossel funciona como esperado no dispositivo real.

---

**Correção realizada em:** 06/11/2026  
**Arquivo modificado:** `src/index.css` (1 arquivo)  
**Linhas alteradas:** 3 linhas (removeu 1, adicionou 2)  
**Teste automatizado:** `tests/carrossel-atalhos.test.mjs` ✅  
**Build:** ✅ Sucesso (5.03s, 0 erros)
