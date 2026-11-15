# 🔍 GUIA DE VALIDAÇÃO MANUAL DEFINITIVO
## Almeida Finance - Conversor Universal + Onboarding Redesenhado

**Projeto Supabase**: `ievccupeijzuzhomphwn.supabase.co`  
**URL Local**: http://localhost:4173  
**Servidor**: ✅ Rodando (npm run preview)

---

## ✅ PRÉ-REQUISITOS

### 1. Criar Usuário de Teste Isolado (5 minutos)

**Via Supabase Dashboard:**

1. Acesse: https://supabase.com/dashboard
2. Selecione projeto: `ievccupeijzuzhomphwn`
3. **Authentication** → **Users** → **"Add user"**
4. Configure:
   - Email: `validacao.conversor@test.local`
   - Password: `ValidacaoConversor2026!`
   - **Auto Confirm User**: ☑️ MARCAR
5. **Copiar User ID** gerado

6. **Table Editor** → **perfis** → **Insert row**:
   - `usuario_id`: (colar User ID)
   - `nome`: "Validação Teste"
   - `data_marco`: `2026-01-01`
   - `saldo_inicial`: `10000`
   - `onboarding_concluido`: `true` ✅

---

## 📋 CHECKLIST DE VALIDAÇÃO

### FASE 1: Login e Navegação Básica (5 min)

1. [ ] Acessar http://localhost:4173
2. [ ] Fazer login:
   - Email: `validacao.conversor@test.local`
   - Senha: `ValidacaoConversor2026!`
3. [ ] Capturar screenshot: **01-dashboard-home.png**
4. [ ] Verificar elementos: Saldo, Receitas, Despesas visíveis

### FASE 2: Botões "Importar" em Todas as Páginas (10 min)

Navegar para cada página e verificar:

#### Receitas (/receitas)
- [ ] Botão "Importar" visível: SIM / NÃO
- [ ] Clicar no botão
- [ ] Modal abre: SIM / NÃO
- [ ] Screenshot: **02-receitas-modal.png**

#### Despesas (/despesas)
- [ ] Botão "Importar" visível: SIM / NÃO
- [ ] Clicar no botão
- [ ] Modal abre: SIM / NÃO
- [ ] Screenshot: **03-despesas-modal.png**

#### Cartões (/cartoes)
- [ ] Botão "Importar" visível: SIM / NÃO
- [ ] Clicar no botão
- [ ] Modal abre: SIM / NÃO
- [ ] Screenshot: **04-cartoes-modal.png**

#### Investimentos (/investimentos)
- [ ] Botão "Importar" visível: SIM / NÃO
- [ ] Clicar no botão
- [ ] Modal abre: SIM / NÃO
- [ ] Screenshot: **05-investimentos-modal.png**

#### Benefícios / VR-VA (/beneficios)
- [ ] Botão "Importar" visível: SIM / NÃO
- [ ] Clicar no botão
- [ ] Modal abre: SIM / NÃO
- [ ] Screenshot: **06-beneficios-modal.png**

### FASE 3: Importação Standalone (5 min)

#### Página /importacao
- [ ] Acessar: http://localhost:4173/importacao
- [ ] Heading "Importação Inteligente" visível
- [ ] Área de upload/arraste arquivo visível
- [ ] Screenshot: **07-importacao-standalone.png**

#### Central /central-importacao
- [ ] Acessar: http://localhost:4173/central-importacao
- [ ] Interface carrega corretamente
- [ ] Screenshot: **08-central-importacao.png**

### FASE 4: Onboarding Redesenhado (10 min)

**IMPORTANTE**: Se o onboarding já foi concluído, pode não ser acessível. Neste caso, criar um novo usuário de teste ou marcar `onboarding_concluido = false` no perfil.

#### Desktop (1920×1080)
- [ ] Acessar: http://localhost:4173/onboarding
- [ ] **Largura**: Container usa quase toda largura (não fica estreito)
- [ ] **Espaços vazios laterais**: Eliminados ou mínimos
- [ ] Screenshot de cada etapa:
  - **09-onboarding-etapa-1.png**
  - **09-onboarding-etapa-2.png** (Importação - crítico!)
  - **09-onboarding-etapa-3.png**
  - **09-onboarding-etapa-4.png**
  - **09-onboarding-etapa-5.png**
  - **09-onboarding-etapa-6.png**
  - **09-onboarding-etapa-7.png**
  - **09-onboarding-etapa-8.png**

#### Etapa de Importação Específica:
- [ ] Área de importação usa largura adequada
- [ ] Upload de PDF funciona DIRETAMENTE (sem conversão)
- [ ] Tipo de documento detectado automaticamente
- [ ] Movimentações exibidas com espaço adequado
- [ ] Filtros e resumo não cortados
- [ ] Consistência: "0 selecionados" vs "total a importar"

#### Notebook (1366×768)
- [ ] Repetir navegação no onboarding
- [ ] Screenshot: **10-onboarding-notebook.png**

#### Tablet (768×1024)
- [ ] Redimensionar navegador: F12 → Toggle device toolbar → 768×1024
- [ ] Layout adapta (1 ou 2 colunas)
- [ ] Screenshot: **11-onboarding-tablet.png**

#### Mobile - iPhone SE (375×667)
- [ ] Redimensionar: 375×667
- [ ] Layout em 1 coluna
- [ ] Botões acessíveis
- [ ] Sem rolagem horizontal na página
- [ ] Screenshot: **12-onboarding-iphone-se.png**

#### Mobile - iPhone 13 (390×844)
- [ ] Redimensionar: 390×844
- [ ] Mesmas verificações
- [ ] Screenshot: **13-onboarding-iphone-13.png**

### FASE 5: Teste Funcional do Conversor (15 min)

**PREPARAR ARQUIVOS DE TESTE:**

Criar na pasta `posso-comprar/e2e/fixtures/`:

1. **extrato-teste.csv** (Extrato bancário):
```csv
Data;Descrição;Valor
01/01/2026;Supermercado ABC;-150,50
02/01/2026;Salário;3000,00
03/01/2026;Uber;-25,80
```

2. **fatura-teste.csv** (Fatura cartão):
```csv
Data;Estabelecimento;Valor
01/01/2026;Netflix;39,90
02/01/2026;Posto Shell;200,00
```

#### Teste 1: Upload CSV - Extrato
- [ ] Abrir modal de importação em Receitas
- [ ] Fazer upload de `extrato-teste.csv`
- [ ] **Detecção automática**: Tipo detectado sem escolher
- [ ] **Prévia**: 3 transações mostradas
- [ ] **Classificação**: Receitas e despesas separadas
- [ ] **Confirmar importação**
- [ ] **Verificar Home**: Saldo atualizado corretamente

#### Teste 2: Upload CSV - Fatura
- [ ] Abrir modal em Cartões
- [ ] Upload de `fatura-teste.csv`
- [ ] **Detecção**: Reconhecido como fatura
- [ ] **Prévia**: 2 compras
- [ ] Confirmar
- [ ] Verificar cartão atualizado

#### Teste 3: Duplicidade
- [ ] Repetir upload do mesmo `extrato-teste.csv`
- [ ] **Verificar**: Sistema detecta duplicatas
- [ ] **Não gravar**: Transações já existentes ignoradas

#### Teste 4: PDF (se possível)
- [ ] Upload de PDF de extrato/fatura real
- [ ] Verificar leitura direta (sem converter para CSV)
- [ ] Detecção automática do tipo

### FASE 6: Responsividade Geral (10 min)

Testar em diferentes resoluções:

#### Desktop 1920×1080
- [ ] Dashboard: **14-desktop-1920-dashboard.png**
- [ ] Receitas: **14-desktop-1920-receitas.png**
- [ ] Onboarding: **14-desktop-1920-onboarding.png**

#### Notebook 1366×768
- [ ] Dashboard: **15-notebook-1366-dashboard.png**
- [ ] Receitas: **15-notebook-1366-receitas.png**

#### Tablet 768×1024
- [ ] Dashboard: **16-tablet-768-dashboard.png**
- [ ] Onboarding: **16-tablet-768-onboarding.png**

#### iPhone SE 375×667
- [ ] Dashboard: **17-iphone-se-dashboard.png**
- [ ] Receitas: **17-iphone-se-receitas.png**
- [ ] Modal: **17-iphone-se-modal.png**

#### iPhone 13 390×844
- [ ] Dashboard: **18-iphone-13-dashboard.png**
- [ ] Onboarding: **18-iphone-13-onboarding.png**

---

## 📊 RELATÓRIO DE RESULTADOS

### Resumo:

**Botões "Importar" Visíveis:**
- [ ] Dashboard
- [ ] Receitas
- [ ] Despesas
- [ ] Cartões
- [ ] Investimentos
- [ ] Benefícios

**Modais Funcionando:**
- [ ] Receitas
- [ ] Despesas
- [ ] Cartões
- [ ] Investimentos
- [ ] Benefícios

**Onboarding Redesenhado:**
- [ ] Desktop: Largura adequada
- [ ] Desktop: Espaços vazios eliminados
- [ ] Etapa importação: PDF direto
- [ ] Etapa importação: Detecção automática
- [ ] Mobile: Layout responsivo
- [ ] Mobile: Sem overflow horizontal

**Conversor Universal:**
- [ ] Detecção automática: CSV
- [ ] Detecção automática: PDF
- [ ] Classificação correta
- [ ] Prévia funcional
- [ ] Duplicidades detectadas
- [ ] Saldos atualizados

**Problemas Encontrados:**
1. ...
2. ...
3. ...

---

## 🗑️ LIMPEZA PÓS-VALIDAÇÃO

### Remover Dados de Teste:

```sql
-- Execute no Supabase SQL Editor

-- 1. Remover transações do usuário de teste
DELETE FROM receitas WHERE usuario_id = 'COLE_USER_ID_AQUI';
DELETE FROM despesas WHERE usuario_id = 'COLE_USER_ID_AQUI';
DELETE FROM cartoes_compras WHERE cartao_id IN (
  SELECT id FROM cartoes WHERE usuario_id = 'COLE_USER_ID_AQUI'
);
DELETE FROM cartoes WHERE usuario_id = 'COLE_USER_ID_AQUI';
DELETE FROM investimentos_movimentacoes WHERE investimento_id IN (
  SELECT id FROM investimentos WHERE usuario_id = 'COLE_USER_ID_AQUI'
);
DELETE FROM investimentos WHERE usuario_id = 'COLE_USER_ID_AQUI';
DELETE FROM beneficios WHERE usuario_id = 'COLE_USER_ID_AQUI';

-- 2. Opcional: Remover perfil de teste
DELETE FROM perfis WHERE usuario_id = 'COLE_USER_ID_AQUI';

-- 3. Opcional: Remover usuário (via Authentication → Users no dashboard)
```

---

## 📝 ENTREGA FINAL

Após completar a validação, fornecer:

1. **Screenshots** (todos os arquivos .png salvos)
2. **Relatório preenchido** (este checklist marcado)
3. **Observações** sobre problemas encontrados
4. **Confirmação**: Dados de teste removidos

---

**Tempo Estimado Total**: 60-90 minutos  
**Gerado em**: 13/11/2026 17:00
