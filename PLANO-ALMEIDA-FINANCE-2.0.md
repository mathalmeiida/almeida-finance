# PLANO ALMEIDA FINANCE 2.0 — EXECUÇÃO

**Data:** 06 de Novembro de 2026  
**Objetivo:** Corrigir PWA, bloqueios de importação e implementar Central de Importação Inteligente  
**Status:** Em execução

---

## ✅ PRIORIDADES (Ordem de Execução)

### 1. ❌ PWA iPhone — CORREÇÃO CRÍTICA
**Problema:** Cabeçalho sobe ao rolar, logo e avatar desalinhados
**Status:** IDENTIFICADO — código atual usa pt-safe mas o cálculo está incorreto
**Arquivos:** 
- `src/components/Layout.jsx` (linhas 368-378)
- `src/index.css` (linhas 348-351)

**Solução:**
- ✅ Cabeçalho já tem height calc com safe-area
- ✅ Já é sticky top-0
- ⚠️ Precisa verificar se logo/avatar estão centralizados corretamente
- ⚠️ Verificar se há scroll indesejado

### 2. ❌ BLOQUEIOS DE IMPORTAÇÃO
**Problema:** Investimentos e cartões bloqueiam com "Cadastre primeiro"
**Arquivos:** `src/pages/ImportacaoInteligente.jsx` (linhas 353-369)

**Solução:** Permitir cadastro rápido inline sem sair da importação

### 3. ❌ INTERPRETAÇÃO DE PDFs
**Problema:** Datas, valores e descrições misturados
**Arquivos:** `src/utils/lerArquivoImportacao.js` (biblioteca de parsing)

**Solução:** Melhorar regex e validação de campos

### 4. ❌ ONBOARDING 8 ETAPAS
**Problema:** Simplificar saldo bancário e tornar importação opcional
**Arquivo:** `src/pages/Onboarding.jsx`
**Status:** JÁ TEM 8 ETAPAS (commit 4bac690)

**Verificar:** Se importação é opcional ou obrigatória

### 5. ❌ CENTRAL DE IMPORTAÇÃO INTELIGENTE
**Nova funcionalidade:** Página unificada com:
- Empréstimos/Financiamentos
- Cartões com parcelas automáticas
- Histórico de importações
- "Atualizar minha vida financeira"

**Arquivos novos:**
- `src/pages/CentralImportacao.jsx`
- Migrations para `emprestimos`, `historico_importacoes`

### 6. ❌ ESPAÇOS VAZIOS HOME
**Problema:** Vão no iPhone e espaçamento excessivo
**Arquivo:** `src/pages/Dashboard.jsx`
**Status:** Commit 0337425 corrigiu, mas pode ter regredido

---

## 📋 CHECKLIST DE EXECUÇÃO

### Fase 1: Correções Críticas (30 min)
- [x] 1.1. PWA iPhone: Corrigido cabeçalho (removido pt-safe duplo, cor branca)
- [x] 1.2. Bloqueios importação: Cadastro inline adicionado (cartões e investimentos)
- [x] 1.3. Onboarding: Verificado - já tem 8 etapas e importação opcional
- [x] 1.4. Build de teste: OK (9.05s, sem erros)
- [x] 1.5. Commit: e84ac98

### Fase 2: Parsing e Onboarding (45 min)
- [x] 2.1. PDFs: Regex robusta, testes passando (28/28)
- [x] 2.2. Onboarding validado: 8 etapas, importação opcional
- [x] 2.3. Parsing testa múltiplos formatos (CSV, OFX, PDF)
- [ ] 2.4. Documentação de formatos suportados

### Fase 3: Central de Importação (2h)
- [ ] 3.1. Criar migrations (emprestimos, historico)
- [ ] 3.2. Componente CentralImportacao.jsx
- [ ] 3.3. Integração com importação existente
- [ ] 3.4. "Atualizar vida financeira"

### Fase 4: Testes e Validação (30 min)
- [ ] 4.1. Testes E2E das correções
- [ ] 4.2. Teste PWA em simulador iPhone
- [ ] 4.3. Build de produção
- [ ] 4.4. Relatório final

---

## 🚀 COMEÇANDO AGORA

**Próxima ação:** Corrigir PWA iPhone e bloqueios de importação
