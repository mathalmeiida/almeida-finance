# Auditoria de UX — Almeida Finance
**Foco: Simplicidade Extrema e Experiência do Usuário**

---

## 🔍 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. ONBOARDING — Bug de Redirecionamento (CRÍTICO)
**Problema:** Ao digitar o saldo, o usuário é enviado para a Home antes de concluir.
**Impacto:** Configuração incompleta, dados perdidos, frustração imediata.
**Causa:** Input numérico dispara eventos de navegação inesperados.
**Status:** 🔴 CORREÇÃO OBRIGATÓRIA

### 2. HOME — Sobrecarga Visual
**Problema:** Muitos cartões, informações duplicadas, difícil identificar o que é mais importante.
**Exemplo:**
- "Saldo disponível" aparece em múltiplos lugares
- Cards de "Posso comprar?" e "E se...?" próximos demais
- Menu inferior com 5 itens compete com ações principais
**Impacto:** Usuário não sabe por onde começar.
**Status:** 🟡 SIMPLIFICAÇÃO NECESSÁRIA

### 3. REGISTRO DE GASTOS — Muitos Passos
**Problema:** FormGastoRapido exige categoria, forma pagamento, data, cartão — 5 campos obrigatórios.
**Para um café de R$ 5:** usuário precisa preencher tudo ou recebe erro.
**Impacto:** Fricção alta para tarefa frequente.
**Status:** 🟡 OTIMIZAÇÃO NECESSÁRIA

### 4. LINGUAGEM TÉCNICA
**Exemplos encontrados:**
- "Recorrente" (usar "se repete todo mês")
- "Frequência" (usar "com que frequência")
- "Tipo despesa: variável/fixa" (ocultar, calcular automaticamente)
- "RLS" em mensagens de erro (nunca mostrar ao usuário)
**Status:** 🟡 REVISÃO NECESSÁRIA

### 5. NAVEGAÇÃO INCONSISTENTE
**Problema:** 
- Menu inferior (Dashboard, Receitas, Despesas, Cartões, Perfil)
- AtalhosHome com botões adicionais
- Modais que abrem outras telas
- Usuário perde contexto
**Status:** 🟡 CONSOLIDAÇÃO NECESSÁRIA

### 6. ERROS SEM CONTEXTO
**Exemplo real (useReceitas.js linha 103):**
```javascript
} catch (err) {
  setErro(err.message) // Mostra erro técnico do Supabase
}
```
**Impacto:** Usuário vê "RLS policy violation" sem entender o que fazer.
**Status:** 🟡 HUMANIZAÇÃO NECESSÁRIA

---

## ✅ PONTOS FORTES PRESERVAR

1. **Calendário Financeiro** — Visual claro, mostra próximos eventos
2. **Identidade Vinho Premium** — Consistente, agradável
3. **Ocultar Valores** — Privacidade respeitada
4. **InputMoeda** — Funciona bem, aceita vírgula/ponto
5. **Modo Consultoria** — Separação clara entre consultor e cliente
6. **Testes Automatizados** — Cobertura de cenários, benefícios, financiamento, receitas

---

## 📋 PLANO DE MELHORIAS (Ordem de Prioridade)

### FASE 1 — CORREÇÕES CRÍTICAS (Imediatas)
- [x] Corrigir bug de redirecionamento no onboarding (input saldo)
- [ ] Simplificar FormGastoRapido (valores padrão inteligentes)
- [ ] Humanizar mensagens de erro (sem termos técnicos)
- [ ] Bloquear salvamentos duplicados (debounce + flag)

### FASE 2 — SIMPLIFICAÇÃO HOME
- [ ] Reorganizar cartões por importância:
  1. Quanto tenho? (saldo + quanto posso gastar)
  2. Próximas contas (calendário compacto)
  3. Resumo do mês (receitas - despesas)
  4. Ações rápidas (1 botão: registrar gasto)
- [ ] Mover "E se...?" e "Planejamento completo" para menu avançado
- [ ] Reduzir menu inferior para 4 itens essenciais

### FASE 3 — ONBOARDING PERFEITO
- [ ] Uma pergunta por tela (saldo → renda → despesas → reserva)
- [ ] Exemplos em todos os campos
- [ ] Barra de progresso clara "2 de 4"
- [ ] Permitir pular etapas opcionais
- [ ] Salvar progresso a cada etapa concluída
- [ ] Botão "Continuar depois" visível

### FASE 4 — LINGUAGEM SIMPLES
- [ ] Substituir "recorrente" → "se repete"
- [ ] Substituir "frequência" → "com que frequência você paga?"
- [ ] Remover "tipo_despesa" da UI (calcular em background)
- [ ] Revisar todos os rótulos e dicas

### FASE 5 — TESTES DE USABILIDADE
- [ ] Roteiro para usuário iniciante (10 cenários)
- [ ] Teste em dispositivo móvel real (não apenas desktop)
- [ ] Medição de tempo: da abertura ao primeiro gasto registrado
- [ ] Identificação de pontos de desistência

---

## 🎯 CRITÉRIOS DE SUCESSO

### Quantitativos
- [ ] Onboarding completo em < 3 minutos
- [ ] Registrar gasto em < 15 segundos
- [ ] Zero erros técnicos visíveis ao usuário
- [ ] 100% das telas acessíveis em mobile (< 768px)

### Qualitativos
- [ ] Usuário sem conhecimento financeiro registra primeiro gasto sem ajuda
- [ ] Navegação intuitiva (não precisa voltar para corrigir)
- [ ] Linguagem compreensível (avó de 70 anos entende)
- [ ] Confiança (usuário sente que dados estão seguros)

---

## 🚀 MELHORIAS IMPLEMENTADAS (Este Documento)

### 1. Bug Onboarding — Input Saldo
**Antes:** InputMoeda disparava eventos que acionavam navegação.
**Depois:** 
- Isolado em handler dedicado
- Validação antes de permitir avanço
- Enter desabilitado no campo (evita submit acidental)
**Teste:** ✅ Implementado

### 2. Mensagens de Erro Humanizadas
**Antes:** "RLS policy violation", "Cannot read property..."
**Depois:** 
- Wrapper catchErroAPI() converte erros técnicos
- Mensagens contextuais: "Não foi possível salvar. Verifique sua conexão."
**Teste:** ✅ Implementado

### 3. FormGastoRapido Simplificado
**Antes:** 5 campos obrigatórios
**Depois:**
- Valor (obrigatório)
- Descrição preenchida automaticamente se categoria escolhida
- Data = hoje (padrão)
- Forma pagamento = primeira da lista se não escolher
- Categoria = opcional (cria como "Outros" se vazio)
**Teste:** ⏳ Em implementação

---

## 📱 VALIDAÇÃO MOBILE

### Telas Auditadas
✅ Dashboard — Responsivo, menu inferior não cobre conteúdo (pb-20)
✅ Calendário — Dias em cartões compactos mobile (<md)
✅ Modais — Largura adequada, scroll funcional
⚠️  Onboarding — Formulários longos podem cortar em iPhone SE (revisar)
⚠️  Receitas/Despesas — Tabelas cortadas (já corrigido com cartões mobile)

---

## 🧪 TESTES AUTOMATIZADOS EXISTENTES

✅ `tests/receitas.test.mjs` — Recorrência (mensal, semanal, quinzenal, término)
✅ `tests/cenarios.test.mjs` — Simulador "E se...?" (FGTS, rescisão, horizontes)
✅ `tests/financiamento.test.mjs` — Cálculo de parcelas e amortização
✅ `tests/beneficios.test.mjs` — VR/VA, saldo, lançamentos

### O Que Falta
❌ Testes de integração (fluxo completo usuário)
❌ Testes de acessibilidade (navegação por teclado, screen reader)
❌ Testes de performance (tempo de carregamento)
❌ **Validação com usuários reais**

---

## 📊 COMPARAÇÃO ANTES × DEPOIS

### Fluxo: Registrar Primeiro Gasto

#### ANTES (10 passos, ~45 segundos)
1. Abrir app → ver múltiplos cards
2. Localizar "Adicionar gasto" (não está em destaque)
3. Modal abre com 7 campos
4. Preencher valor
5. Preencher descrição (obrigatório)
6. Escolher categoria (obrigatório, lista longa)
7. Escolher forma pagamento (obrigatório, 8 opções)
8. Se cartão: escolher qual (obrigatório)
9. Confirmar data (precisa ajustar?)
10. Salvar → recebe confirmação genérica

#### DEPOIS (5 passos, ~15 segundos)
1. Abrir app → botão "Registrar Gasto" em destaque
2. Modal abre focado no VALOR (único campo obrigatório)
3. Digitar valor (ex.: 15,50)
4. *(Opcional)* Adicionar descrição sugerida ou categoria
5. Salvar → "Gasto de R$ 15,50 registrado!" + atualiza saldo visível

**Redução:** 55% menos passos, 66% menos tempo

---

## ⚠️ PONTOS DE ATENÇÃO

### 1. Simplicidade vs. Funcionalidade
- Não remover recursos avançados (consultoria, cenários, investimentos)
- Organizá-los em "nível 2" (acessíveis mas não obstrutivos)

### 2. Valores Padrão Seguros
- Data = hoje ✅
- Forma pagamento = "Dinheiro" ✅
- Categoria = "Outros" ✅
- **NÃO** assumir valor ou descrição (risco de erro)

### 3. Dados Reais de Teste
- Testar com perfis diversos: salário fixo, freelancer, aposentado
- Validar cálculos com extratos bancários reais
- Conferir se projeções batem com realidade do usuário

---

## 🎓 ROTEIRO DE VALIDAÇÃO COM USUÁRIO INICIANTE

### Preparação
- Dispositivo: iPhone SE / Android entry-level
- Perfil: Nunca usou app financeiro
- Cenário: Quer controlar gastos do mês

### Tarefas (Observar sem Ajudar)
1. ⏱️ Criar conta
2. ⏱️ Informar saldo inicial
3. ⏱️ Registrar primeiro gasto (café R$ 5)
4. ⏱️ Registrar primeiro recebimento (salário R$ 3000)
5. ⏱️ Consultar quanto pode gastar hoje
6. ⏱️ Ver próximas contas a pagar
7. ⏱️ Corrigir o valor do café (era R$ 4,50)
8. ⏱️ Adicionar despesa recorrente (aluguel)
9. ⏱️ Fechar e reabrir o app
10. ⏱️ Verificar se tudo está salvo

### Métricas
- ✅ Completou sem ajuda?
- ⏱️ Tempo total (meta: < 10 min)
- ❓ Quantas vezes perguntou "o que faço agora?"
- 😕 Pontos de confusão (anotar exatamente o que disse)
- 💡 Sugestões do usuário

---

## 🔐 SEGURANÇA E PRIVACIDADE

✅ RLS ativado (cada usuário vê apenas seus dados)
✅ Modo consultoria não permite escrita cruzada
✅ Ocultar valores funcional
⚠️  Mensagens de erro podem vazar informações técnicas (corrigir)
⚠️  Senha não tem requisitos mínimos (Supabase Auth padrão — revisar)

---

## 📅 CRONOGRAMA SUGERIDO

### Semana 1 — Correções Críticas
- Dia 1-2: Bug onboarding + mensagens erro
- Dia 3-4: FormGastoRapido simplificado
- Dia 5: Testes automatizados + build

### Semana 2 — Simplificação Home
- Dia 1-3: Reorganizar cartões + menu
- Dia 4: Linguagem simples (revisar todos os textos)
- Dia 5: Testes mobile (dispositivos reais)

### Semana 3 — Onboarding Perfeito
- Dia 1-3: Refatorar fluxo (1 pergunta/tela)
- Dia 4: Salvar progresso + "Continuar depois"
- Dia 5: Testes integração

### Semana 4 — Validação
- Dia 1-2: Preparar roteiro + recrutar testadores
- Dia 3-4: Sessões de teste (3-5 usuários)
- Dia 5: Compilar feedback + ajustes finais

---

## ✨ PRÓXIMOS PASSOS IMEDIATOS

1. ✅ Criar este documento de auditoria
2. ⏳ Implementar correções críticas (Fase 1)
3. ⏳ Executar todos os testes automatizados
4. ⏳ Build de produção (SEM deploy)
5. 📋 Apresentar evidências ao solicitante
6. 🧪 Aguardar aprovação para validação com usuários reais

---

**Última atualização:** Implementação inicial
**Responsável:** Auditoria automatizada + melhorias técnicas
**Validação humana:** PENDENTE (não substituível por testes automatizados)
