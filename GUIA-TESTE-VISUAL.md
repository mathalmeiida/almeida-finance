# 🧪 Guia de Validação Visual Completa - Almeida Finance

## ⚠️ Pré-requisito: Criar Usuário de Teste

O Supabase está configurado para exigir confirmação de email. Para testar as páginas autenticadas, você precisa criar um usuário manualmente no painel do Supabase.

### Opção 1: Criar via Dashboard (RECOMENDADO)

1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/auth/users
2. Clique em **"Add user"** → **"Create new user"**
3. Preencha:
   - **Email:** `teste.visual@almeidafinance.com.br` (ou qualquer email válido)
   - **Password:** `TestVisual2024!`
   - ✅ **IMPORTANTE:** Marque **"Auto Confirm User"**
4. Clique em **"Create user"**
5. Anote o email e senha para usar no teste

### Opção 2: Desabilitar Confirmação de Email (para ambiente dev)

1. Acesse: https://supabase.com/dashboard/project/ievccupeijzuzhomphwn/auth/providers
2. Em **"Email"** → Settings
3. Desabilite **"Confirm email"**
4. Salve as alterações
5. Execute novamente: `node tests/create-test-user.mjs`

---

## 🚀 Servidor Dev

O servidor deve estar rodando em: **http://localhost:5173**

Se não estiver rodando:
```bash
cd posso-comprar
npm run dev
```

---

## ✅ Checklist de Validação Visual

### 1. Login (Público) - ✅ JÁ VALIDADO
- [x] 390px: fundo vinho ocupa 100%, sem faixas brancas
- [x] 1440px: fundo vinho ocupa 100%, conteúdo centralizado max-w-[1100px]
- [x] Sem overflow horizontal
- [x] Formulário legível e funcional

### 2. Apresentação (Público) - ✅ JÁ VALIDADO
- [x] 390px: sem overflow, sem cantos brancos
- [x] 1440px: sem overflow, sem cantos brancos
- [x] 1920px: sem overflow, sem cantos brancos
- [x] Botões funcionais (Entrar, Pular)

---

### 3. Home (🔒 Autenticado) - ⏳ PENDENTE

**Como testar:**
1. Faça login com as credenciais criadas no Supabase
2. Você será redirecionado para `/home`

**Validar:**
- [ ] 390px (Mobile):
  - [ ] Sem overflow horizontal (use DevTools: `document.documentElement.scrollWidth > window.innerWidth` deve ser `false`)
  - [ ] Cards e conteúdo visíveis e alinhados
  - [ ] Navegação inferior funcional
  - [ ] Todos os elementos clicáveis acessíveis

- [ ] 1440px (Desktop):
  - [ ] Layout responsivo adequado
  - [ ] Sidebar funcional
  - [ ] Cards bem dimensionados
  - [ ] Sem elementos cortados

**Capturar screenshots:**
```javascript
// No console do navegador em /home
// Para 390px
window.resizeTo(390, 844); 
// Capture manualmente ou:
// document.body.style.zoom = "1.0";

// Para 1440px
window.resizeTo(1440, 900);
```

---

### 4. Configurações (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/configuracoes`

**Validar:**
- [ ] 390px: formulários e controles acessíveis
- [ ] 1440px: layout desktop adequado
- [ ] **SELETOR DE TEMA:**
  - [ ] Abrir seletor de paleta/tema
  - [ ] Selecionar tema diferente do atual
  - [ ] Verificar se cores mudam instantaneamente
  - [ ] **Recarregar a página (F5)**
  - [ ] Confirmar que o tema selecionado **persiste após reload**
  - [ ] Testar em outra página (ex: /home) → tema deve persistir globalmente

---

### 5. Investimentos (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/investimentos`

**Validar:**
- [ ] 390px: tabelas/cards responsivos
- [ ] 1440px: visualização desktop adequada
- [ ] Modais e formulários se abrem corretamente
- [ ] Sem overflow em listas longas

---

### 6. Cartões (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/cartoes`

**Validar:**
- [ ] 390px: cards de cartão bem formatados
- [ ] 1440px: grid/layout adequado
- [ ] Botões de ação acessíveis
- [ ] Formulários de adicionar/editar funcionais

---

### 7. Receitas (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/receitas`

**Validar:**
- [ ] 390px: lista de receitas legível
- [ ] 1440px: tabela/grid adequado
- [ ] Filtros e buscas funcionais
- [ ] Modal de adicionar receita responsivo

---

### 8. Despesas (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/despesas`

**Validar:**
- [ ] 390px: lista de despesas legível
- [ ] 1440px: tabela/grid adequado
- [ ] Categorias visíveis
- [ ] Modal de adicionar despesa responsivo

---

### 9. Calendário (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/calendario`

**Validar:**
- [ ] 390px: calendário compacto funcional
- [ ] 1440px: calendário expandido
- [ ] Navegação entre meses/dias funciona
- [ ] Eventos exibidos corretamente

---

### 10. Onboarding (🔒 Autenticado) - ⏳ PENDENTE

**Navegar:** `/onboarding`

**Validar:**
- [ ] 390px: passos do onboarding legíveis
- [ ] 1440px: layout centralizado adequado
- [ ] Navegação entre etapas funciona
- [ ] Botões de pular/avançar acessíveis

---

## 🐛 Como Reportar Problemas Visuais

Se encontrar algum problema:

1. **Página:** [nome da página]
2. **Viewport:** [390px / 1440px / outro]
3. **Problema:**
   - [ ] Overflow horizontal
   - [ ] Faixas brancas indesejadas
   - [ ] Elementos cortados
   - [ ] Sobreposição de elementos
   - [ ] Cores inconsistentes
   - [ ] Modal/drawer não responsivo
   - [ ] Outro: [descrever]

4. **Screenshot:** [anexar ou descrever]

5. **Console errors:** Abra DevTools (F12) → Console → copie erros se houver

---

## 📊 Como Verificar Overflow Horizontal

No console do navegador (F12 → Console):

```javascript
// Deve retornar false. Se retornar true, há overflow horizontal.
document.documentElement.scrollWidth > document.documentElement.clientWidth
```

---

## 🎨 Como Verificar Cores de Fundo nos Cantos

```javascript
// Execute no console para verificar as 4 cantos da viewport
function checkCorners() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const margin = 5;
  
  const corners = {
    topLeft: document.elementFromPoint(margin, margin),
    topRight: document.elementFromPoint(w - margin, margin),
    bottomLeft: document.elementFromPoint(margin, h - margin),
    bottomRight: document.elementFromPoint(w - margin, h - margin)
  };
  
  Object.entries(corners).forEach(([name, el]) => {
    if (el) {
      const bg = window.getComputedStyle(el).backgroundColor;
      console.log(`${name}: ${bg}`, el);
    }
  });
}

checkCorners();
```

**Cores esperadas:**
- **Vinho:** `rgb(61, 10, 24)` - páginas públicas (login, apresentação)
- **Branco:** `rgb(255, 255, 255)` - áreas de conteúdo
- **Gray-50:** `rgb(249, 250, 251)` - backgrounds secundários

---

## 📝 Após Completar os Testes

Atualize este documento marcando [x] nos itens validados e anote qualquer problema encontrado na seção de cada página.

**Status Atual:**
- ✅ Páginas públicas validadas (2/11)
- ⏳ Páginas autenticadas pendentes (9/11)
- ⏳ Theme switching pendente
- ⏳ Persistência de tema pendente

**Próximo passo:** Criar usuário de teste e validar páginas autenticadas.
