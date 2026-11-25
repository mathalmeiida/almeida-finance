# AUDITORIA DE BUGS PENDENTES - ALMEIDA FINANCE

**Data:** 24/11/2026  
**Commits Base:** b146454, fe72c51  
**Status Migration:** ✅ 12 colunas produção, RLS ativo  

---

## 🔴 CRÍTICOS (Bloqueiam uso)

### 1. ❌ Validação de autenticação em rotas protegidas
**Gravidade:** CRÍTICA  
**Arquivo:** `src/App.jsx`  
**Descrição:** Verificar se todas as rotas protegidas validam sessão antes de renderizar  
**Risco:** Acesso não autorizado a dados de outros usuários  
**Teste:** Expirar token manualmente e tentar acessar /receitas, /despesas, /cartoes  

### 2. ❌ Isolamento de dados entre usuários (RLS)
**Gravidade:** CRÍTICA  
**Arquivos:** Todas as queries Supabase  
**Descrição:** Garantir que `usuario_id` está em TODAS as queries SELECT/INSERT/UPDATE/DELETE  
**Risco:** Vazamento de dados entre contas  
**Teste:** Criar 2 usuários, logar com cada um, verificar que não veem dados do outro  

---

## 🟠 ALTOS (Comprometem experiência)

### 3. ⚠️ Cálculo de saldo disponível incorreto
**Gravidade:** ALTA  
**Arquivo:** `src/hooks/useProjecao.js`  
**Descrição:** Verificar se saldo considera: receitas futuras, despesas pagas, faturas vencidas  
**Impacto:** Usuário vê saldo errado e toma decisões financeiras incorretas  
**Teste:** Cadastrar receita futura, despesa paga, verificar se saldo atualiza corretamente  

### 4. ⚠️ Duplicação de lançamentos em importação
**Gravidade:** ALTA  
**Arquivo:** `src/pages/ImportacaoInteligente.jsx`  
**Descrição:** Importar mesmo arquivo 2x pode duplicar transações  
**Impacto:** Orçamento dobrado, dados inconsistentes  
**Teste:** Importar CSV, importar novamente, verificar duplicatas  

### 5. ⚠️ Fatura de cartão não considera compras parceladas
**Gravidade:** ALTA  
**Arquivos:** `src/lib/faturaCartao.js`, `src/hooks/useComprasCartao.js`  
**Descrição:** Fatura pode não incluir parcelas de compras antigas  
**Impacto:** Orçamento subestimado  
**Teste:** Compra 12x há 3 meses, verificar se parcela atual aparece na fatura  

### 6. ⚠️ Despesa recorrente não gera próximas ocorrências
**Gravidade:** ALTA  
**Arquivo:** `src/hooks/useDespesas.js`  
**Descrição:** Despesa marcada como recorrente pode não projetar meses futuros  
**Impacto:** Projeção financeira incompleta  
**Teste:** Cadastrar despesa recorrente mensal, verificar projeção 12 meses  

---

## 🟡 MÉDIOS (Incômodos, mas contornáveis)

### 7. ⚠️ Edição de receita não atualiza projeção em tempo real
**Gravidade:** MÉDIA  
**Arquivo:** `src/pages/Receitas.jsx`  
**Descrição:** Alterar valor de receita requer reload para refletir em Dashboard  
**Impacto:** UX ruim, usuário não vê mudanças imediatas  
**Teste:** Editar receita, voltar para Home, verificar se saldo mudou  

### 8. ⚠️ Exclusão de cartão não remove compras associadas
**Gravidade:** MÉDIA  
**Arquivo:** `src/hooks/useCartoes.js`  
**Descrição:** Deletar cartão deixa compras órfãs no banco  
**Impacto:** Dados inconsistentes, queries podem falhar  
**Teste:** Criar cartão, adicionar compra, deletar cartão, verificar se compra foi removida  

### 9. ⚠️ Investimento sem validação de valor mínimo
**Gravidade:** MÉDIA  
**Arquivo:** `src/pages/Investimentos.jsx`  
**Descrição:** Permite cadastrar R$ 0,00 ou valores negativos  
**Impacto:** Dados inválidos no banco  
**Teste:** Tentar cadastrar investimento R$ -100  

### 10. ⚠️ Data de vencimento de cartão permite dia > 31
**Gravidade:** MÉDIA  
**Arquivo:** `src/pages/Cartoes.jsx`  
**Descrição:** Formulário aceita dia_vencimento = 35  
**Impacto:** Cálculo de fatura quebrado  
**Teste:** Criar cartão com dia_vencimento = 99  

---

## 🟢 BAIXOS (Melhorias de UX)

### 11. ℹ️ Mensagem de erro genérica em falhas de rede
**Gravidade:** BAIXA  
**Arquivos:** Vários componentes  
**Descrição:** "Erro ao salvar" sem detalhar motivo (rede, validação, RLS)  
**Impacto:** Usuário não sabe como resolver  
**Teste:** Desconectar internet, tentar cadastrar receita  

### 12. ℹ️ Loading infinito se query Supabase falhar
**Gravidade:** BAIXA  
**Arquivos:** Hooks customizados  
**Descrição:** Estado `carregando` não volta a false em caso de erro  
**Impacto:** Spinner eterno, usuário preso  
**Teste:** Forçar erro no Supabase (desabilitar RLS), acessar página  

### 13. ℹ️ Formulário não limpa após salvar
**Gravidade:** BAIXA  
**Arquivo:** `src/pages/Receitas.jsx`, `src/pages/Despesas.jsx`  
**Descrição:** Campos permanecem preenchidos após cadastro bem-sucedido  
**Impacto:** Usuário pode duplicar lançamento sem querer  
**Teste:** Cadastrar receita, verificar se form voltou ao estado inicial  

---

## 📋 TESTES ANTERIORMENTE IGNORADOS

### 14. ⏭️ Testes E2E com Playwright
**Status:** Browsers non-functional (sessão anterior)  
**Arquivos:** `tests/e2e/*.spec.js`  
**Ação:** Validar se Playwright está configurado ou remover testes  

### 15. ⏭️ Testes de autenticação com credenciais reais
**Status:** SKIP por falta de senha  
**Arquivos:** `testes-com-usuarios-existentes.js`  
**Ação:** Validar autenticação com Alice e Bob no DEV  

---

## 🛠️ ARQUIVOS PRIORITÁRIOS PARA REVISÃO

1. **src/hooks/useProjecao.js** - Núcleo do cálculo financeiro
2. **src/lib/faturaCartao.js** - Lógica de fechamento de fatura
3. **src/pages/ImportacaoInteligente.jsx** - Prevenção de duplicatas
4. **src/contexts/AuthContext.jsx** - Isolamento de sessão
5. **src/hooks/useDespesas.js** - Recorrência e projeção
6. **src/hooks/useCartoes.js** - CASCADE delete de compras
7. **src/pages/Dashboard.jsx** - Cálculo de saldo disponível

---

## 📊 RESUMO

| Gravidade | Quantidade | Prioridade |
|-----------|------------|------------|
| 🔴 Crítica | 2 | Imediata |
| 🟠 Alta | 4 | Urgente |
| 🟡 Média | 4 | Importante |
| 🟢 Baixa | 3 | Melhoria |
| ⏭️ Ignorados | 2 | Revisar |
| **TOTAL** | **15** | - |

---

## 🎯 ESTRATÉGIA DE CORREÇÃO

**Fase 1 - Segurança (1-2)**
- Validar autenticação e RLS em TODAS as rotas
- Testar isolamento com 2 usuários reais

**Fase 2 - Cálculos Críticos (3, 5, 6)**
- Corrigir saldo disponível
- Validar recorrência de despesas
- Verificar inclusão de parcelas em faturas

**Fase 3 - Integridade de Dados (4, 8, 9, 10)**
- Prevenir duplicatas na importação
- CASCADE delete em cartões
- Validações de formulário

**Fase 4 - UX (7, 11, 12, 13)**
- Atualização em tempo real
- Mensagens de erro claras
- Limpeza de formulários

**Fase 5 - Revisão (14, 15)**
- Decisão sobre Playwright
- Executar testes ignorados

---

## ⚠️ OBSERVAÇÕES

- Não alterar funcionalidades que já funcionam
- Não usar dados fictícios para validar persistência
- Testar com usuários reais em DEV antes de produção
- Manter modo econômico (evitar testes redundantes)
- Priorizar bugs que afetam dados financeiros
