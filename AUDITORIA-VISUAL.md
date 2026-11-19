# Auditoria Visual — Desktop vs Mobile
**Data:** 19/11/2026  
**Objetivo:** Unificar experiência desktop/mobile preservando identidade visual aprovada

---

## 📱 Estado Atual Mobile (REFERÊNCIA — Preservar)

### Identidade Visual Aprovada
- **Cor primária:** Vinho `#801D39` (marca)
- **Cor secundária:** Rosa `#B95572` (destaques)
- **Background:** `#F8F3F2` (fundo claro vinho)
- **Tipografia:** System font stack, clean e legível
- **Espaçamento:** Compacto mas respirável (px-4, gap-3)
- **Cards:** Brancos com border-radius 12-16px, sombra sutil
- **Navegação:** Barra inferior fixa com 5 itens principais

### Elementos Únicos Mobile (Manter)
1. **Scroll horizontal de cards** — Receitas/Despesas/Cartões
2. **Bottom navigation** — Touch-friendly, sempre visível
3. **Cabeçalho compacto** — Avatar + Voltar nas páginas internas
4. **Cards de saldo** — Grid 2 colunas, valores grandes e legíveis
5. **Limite diário** — Card azul gradiente com destaque visual

---

## 🖥️ Problemas Desktop Identificados

### Layout
- ❌ Sidebar ocupa 240px mas conteúdo não aproveita espaço restante
- ❌ Cards mantêm largura mobile mesmo em 1920px
- ❌ Calendário pequeno e sem destaque visual
- ❌ Falta hierarquia visual entre elementos principais e secundários
- ❌ Scroll horizontal não funciona bem com mouse (apenas touch)

### Espaçamento
- ❌ `px-4 md:px-6 xl:px-8` insuficiente para 1440px+
- ❌ Cards de resumo muito estreitos em telas grandes
- ❌ Desperdício de espaço branco lateral

### Componentes
- ❌ Calendário `CalendarioFinanceiroHome` precisa de versão desktop maior
- ❌ Cards de saldo podem usar 3-4 colunas em vez de 2
- ❌ Gráficos e tabelas precisam de mais espaço vertical

---

## ✨ Plano de Melhorias Desktop

### 1. Sistema de Grid Responsivo Inteligente
```css
Mobile: 1 coluna (preservar atual)
Tablet (768px): 2 colunas
Desktop (1024px): 2-3 colunas
Large (1440px): 3-4 colunas + sidebar
XLarge (1920px): Max-width container com destaque para calendário
```

### 2. Hierarquia Visual
- **Prioridade 1:** Saldo disponível + Limite diário (cards grandes)
- **Prioridade 2:** Calendário financeiro (expandido em desktop)
- **Prioridade 3:** Resumo receitas/despesas (grid adaptativo)
- **Prioridade 4:** Atalhos e ações secundárias

### 3. Calendário Desktop
- Versão expandida 3x tamanho mobile
- Destaque visual para dias com movimentações
- Integração com gráfico de fluxo de caixa

### 4. Cards de Resumo
- Mobile: 2 colunas
- Tablet: 3 colunas
- Desktop: 4 colunas (Receitas | Despesas | Cartões | Investimentos)

### 5. Navegação
- Mobile: Bottom nav (preservar)
- Desktop: Sidebar (melhorar agrupamento visual)

---

## 🎯 Componentes a Modificar

### Dashboard.jsx
- [ ] Grid responsivo para cards de resumo
- [ ] Calendário destacado em desktop
- [ ] Container max-width inteligente
- [ ] Espaçamento adaptativo

### Layout.jsx
- [x] Sidebar já implementada (recolhível)
- [ ] Ajustar transição de largura do conteúdo
- [ ] Melhorar agrupamento visual das seções

### index.css
- [ ] Adicionar utilitários de grid responsivo
- [ ] Melhorar tokens de espaçamento desktop
- [ ] Criar variantes de card para desktop

### CalendarioFinanceiroHome.jsx
- [ ] Versão desktop expandida
- [ ] Melhor visualização de movimentações
- [ ] Integração com gráfico

---

## 📐 Tokens de Design Desktop

```css
/* Espaçamento */
--container-mobile: 100%
--container-tablet: 100%
--container-desktop: 1280px
--container-large: 1440px
--container-xlarge: 1600px

/* Grid gaps */
--gap-mobile: 0.75rem (12px)
--gap-tablet: 1rem (16px)
--gap-desktop: 1.5rem (24px)
--gap-large: 2rem (32px)

/* Card sizes */
--card-min-mobile: 280px
--card-min-desktop: 320px
--card-max-desktop: 400px
```

---

## ⚠️ Regras de Preservação

### NÃO MODIFICAR
1. ✅ Cores do tema vinho (#801D39, #B95572)
2. ✅ Bottom navigation mobile
3. ✅ Scroll horizontal de cards mobile
4. ✅ Hierarquia de informações aprovada
5. ✅ Componentes de formulário (InputMoeda, SeletorCategoria)

### ADAPTAR COM CUIDADO
1. ⚠️ Espaçamento (apenas aumentar em desktop, nunca reduzir mobile)
2. ⚠️ Grid de cards (adicionar colunas em desktop, manter 2 em mobile)
3. ⚠️ Calendário (expandir em desktop, manter compacto em mobile)

---

## 📊 Testes de Validação

- [ ] Screenshot Mobile 390px (referência)
- [ ] Screenshot Tablet 768px
- [ ] Screenshot Desktop 1440px
- [ ] Screenshot Desktop 1920px
- [ ] Comparação side-by-side antes/depois
- [ ] Validação de responsividade 375px → 1920px

---

## 🚀 Ordem de Implementação

1. ✅ Capturar screenshots estado atual (completo)
2. ⬜ Criar utilitários CSS desktop
3. ⬜ Modificar Dashboard.jsx (grid responsivo)
4. ⬜ Expandir CalendarioFinanceiroHome desktop
5. ⬜ Ajustar cards de resumo (4 colunas desktop)
6. ⬜ Implementar container max-width
7. ⬜ Testar responsividade completa
8. ⬜ Capturar screenshots finais
9. ⬜ Comparar antes/depois
10. ⬜ Validar em dispositivos reais
