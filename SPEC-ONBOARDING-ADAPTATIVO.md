# ESPECIFICAÇÃO TÉCNICA — ONBOARDING ADAPTATIVO COM IMPORTAÇÃO INTELIGENTE

**Versão:** 1.0  
**Data:** 2026-11-06  
**Projeto:** Almeida Finance 2.0  
**Responsável:** Sistema de Onboarding

---

## 🎯 OBJETIVO

Reformular o processo de onboarding para:
1. **Analisar automaticamente** dados importados
2. **Pré-preencher** formulários com informações identificadas
3. **Pular etapas** completamente preenchidas
4. **Solicitar apenas** campos ausentes ou que precisam confirmação
5. **Nunca solicitar novamente** informações já confirmadas

---

## 📋 REQUISITOS FUNCIONAIS

### RF01: Mapeamento Automático de Dados
**Critério:** Após importação, sistema deve mapear automaticamente:
- Receitas → etapa "Renda"
- Despesas → etapa "Despesas"
- Compras de cartão → extração de cartões únicos → etapa "Cartões"
- Movimentações de investimentos → extração de ativos → etapa "Saldo/Investimentos"

**Validação:**
- [ ] 10 receitas importadas → 10 receitas pré-preenchidas na etapa
- [ ] 15 compras de 3 cartões → 3 cartões identificados com nomes corretos

---

### RF02: Pré-Preenchimento com Indicadores
**Critério:** Dados importados devem:
- Aparecer nos formulários com badge "Importado"
- Ser editáveis pelo usuário
- Ter campos faltantes destacados visualmente

**Validação:**
- [ ] Receita importada exibe badge azul "Importado"
- [ ] Cartão sem limite exibe campo com borda âmbar + label "Obrigatório"
- [ ] Usuário pode editar descrição/valor de item importado

---

### RF03: Navegação Inteligente
**Critério:** Sistema deve:
- Pular etapas com status "confirmado"
- Parar em etapas com status "parcial" (faltam campos)
- Permitir navegação manual para revisão de etapas concluídas

**Validação:**
- [ ] Importar receitas completas → etapa "Renda" pulada automaticamente
- [ ] Importar cartões sem limite → etapa "Cartões" obrigatória
- [ ] Clicar em etapa confirmada na navegação lateral → abre para revisão

---

### RF04: Diferenciação de Valores
**Critério:** Sistema deve diferenciar:
- Valor não informado (null/undefined)
- Valor zero (0)
- Valor vazio ("")

**Validação:**
- [ ] Receita sem categoria → null, não "Outras receitas"
- [ ] Despesa de R$ 0,00 → salva como 0, não como null
- [ ] Campo não preenchido → validação exige preenchimento

---

### RF05: Detecção de Recorrência Manual
**Critério:** Sistema NÃO deve:
- Marcar automaticamente como recorrente
- Deduzir frequência de múltiplos lançamentos similares
- DEVE: sugerir revisão se houver 2+ descrições idênticas

**Validação:**
- [ ] 3 lançamentos "Salário" → TODOS marcados como "uma vez" (não recorrente)
- [ ] Banner exibido: "3 receitas similares detectadas. Deseja configurar recorrência?"
- [ ] Usuário escolhe SIM → abre modal de configuração

---

### RF06: Campos Não Dedutíveis
**Critério:** Sistema NUNCA deve inventar:
- Saldo base (saldo_base, saldo_base_data)
- Limite de cartão (limite_total)
- Vencimento de cartão (dia_fechamento, dia_vencimento)
- Forma de pagamento (forma_pagamento)
- Tipo de despesa (tipo_despesa: fixa/variavel/ocasional)
- Categoria de despesa recorrente

**Validação:**
- [ ] Cartão importado → limite_total = null até usuário informar
- [ ] Despesa importada → tipo_despesa = null até usuário escolher
- [ ] Extrato bancário → saldo_base NÃO preenchido automaticamente

---

### RF07: Detecção de Duplicidades
**Critério:** Sistema deve detectar:
- Duplicatas dentro do mesmo arquivo
- Duplicatas entre arquivos importados
- Duplicatas entre dados importados e já confirmados

**Algoritmo:**
- Data ±3 dias
- Valor com diferença ≤1%
- Similaridade de texto (Jaccard) ≥60%

**Validação:**
- [ ] Importar 2x o mesmo extrato → itens marcados como "duplicado_no_arquivo"
- [ ] Importar extrato com lançamento já cadastrado → marcado como "ja_importado"
- [ ] Importar 2 arquivos com mesma compra → detecta duplicata

---

### RF08: Persistência Temporária
**Critério:** Dados importados devem:
- Ser salvos no localStorage até confirmação final
- Sobreviver a fechamento de navegador
- Ser limpos ao concluir onboarding ou cancelar

**Estrutura localStorage:**
```javascript
{
  // Dados temporários
  almeida_onboarding_temp_{usuario_id}: {
    receitas: [{ ...item, _importado: true, _confirmado: false }],
    despesas: [...],
    cartoes: [...],
    investimentos: [...]
  },
  
  // Status de etapas
  almeida_onboarding_etapas_{usuario_id}: {
    renda: 'importado',
    despesas: 'parcial',
    cartoes: 'confirmado',
    saldo: 'pendente'
  }
}
```

**Validação:**
- [ ] Importar → fechar navegador → reabrir → dados preservados
- [ ] Concluir onboarding → localStorage limpo
- [ ] Cancelar onboarding → localStorage limpo

---

### RF09: Retomada de Onboarding
**Critério:** Ao reabrir onboarding interrompido:
- Exibir tela "RETOMAR" com resumo de importação
- Oferecer 2 opções: "Continuar de onde parei" ou "Ir para o app agora"
- Preservar dados importados e confirmados

**Validação:**
- [ ] Interromper após importar → reabrir → tela RETOMAR exibida
- [ ] Resumo mostra: "Importados: 5 receitas, 3 despesas e 2 cartões"
- [ ] Clicar "Continuar" → volta para próxima etapa pendente

---

### RF10: Conta Vazia Opcional
**Critério:** Se usuário escolher "Começar com conta vazia":
- Não exigir preenchimento de nenhuma etapa
- Permitir acesso direto à Home
- Marcar onboarding_concluido = true

**Validação:**
- [ ] Clicar "Começar com conta vazia" → vai direto para Home
- [ ] Dashboard exibe mensagem: "Configure seu perfil para começar"
- [ ] onboarding_concluido = true no banco

---

## 🎨 REQUISITOS DE INTERFACE

### UI01: Indicadores de Status
**Obrigatório em:**
- Lista de itens (receitas, despesas, cartões, metas)
- Navegação lateral (desktop)
- Banner de topo (quando etapa tiver dados importados)

**Tipos:**
- 🔵 **Importado** — Dados vieram da importação (azul)
- 🟡 **Precisa revisar** — Campos faltantes (âmbar)
- ⚪ **Informação pendente** — Não preenchido (cinza)
- 🟢 **Confirmado** — Validado pelo usuário (verde)

---

### UI02: Navegação Lateral (Desktop)
**Especificação:**
- Largura: 256px (w-64)
- Posição: Fixa à esquerda
- Visível em: lg+ (≥1024px)
- Scroll independente do conteúdo principal

**Elementos:**
- Número da etapa ou ícone de status
- Nome da etapa
- Label do status (pequeno, secundário)
- Destaque visual da etapa atual (borda vinho)

---

### UI03: Separadores de Origem
**Obrigatório em listas que misturam importados + manuais:**
```
📥 Importadas (5)
  • Salário — R$ 5.000,00 [Importado]
  • Freelance — R$ 1.200,00 [Importado]
  ...

✏️ Adicionadas manualmente (2)
  • Bônus — R$ 800,00
  • Cachê — R$ 300,00
```

---

### UI04: Destaque de Campos Obrigatórios
**Para itens com `_precisa_complementar: true`:**
- Borda âmbar (border-amber-300)
- Ring âmbar claro (ring-2 ring-amber-100)
- Label "Obrigatório" em badge âmbar (canto superior direito do campo)

---

### UI05: Banner de Dados Importados
**Exibir no topo de etapas com status "importado" ou "parcial":**
```
┌────────────────────────────────────────────────────┐
│ 📁 Dados importados!                                │
│ 5 receitas foram identificadas.                     │
│ Revise e confirme as informações abaixo.            │
└────────────────────────────────────────────────────┘
```

**Cores:** Fundo azul-claro (bg-blue-50), borda azul (border-blue-500), texto azul-escuro (text-blue-900)

---

### UI06: Tela de Resumo Final
**Elementos obrigatórios:**
1. Card de importação (se houve importação):
   - Ícone de arquivo
   - Texto: "Importados: X receitas, Y despesas, Z cartões"
   - Cor azul (fundo blue-50, borda blue-200)

2. Lista consolidada (importados + manuais):
   - Ícones das categorias
   - Labels: "Saldo inicial", "Receitas mensais", "Despesas fixas", etc.
   - Valores totais

3. Botão "Ir para minha Home" (destaque, cor vinho)

---

## 🔧 REQUISITOS TÉCNICOS

### RT01: Estrutura de Dados Temporários
```typescript
interface ItemTemporario {
  // Dados originais do item
  uid: string
  descricao: string
  valor: number
  data: string
  // ... campos específicos (categoria, recorrente, etc.)
  
  // Metadados de controle
  _importado: boolean      // true = veio da importação
  _confirmado: boolean     // true = usuário validou
  _origem: 'importacao' | 'manual'
  _precisa_complementar?: boolean  // true = faltam campos
  _revisar?: boolean       // true = sugestão de revisão
  _chave?: string          // hash para detecção de duplicidade
}

interface StatusEtapa {
  status: 'importado' | 'parcial' | 'pendente' | 'confirmado' | null
  dados: ItemTemporario[] | object | null
  camposFaltantes: string[]
}
```

---

### RT02: Fluxo de Dados
```
┌─────────────────────────────────────────────────────────┐
│ 1. IMPORTAÇÃO                                            │
│    ImportacaoInteligente.jsx                             │
│    ↓ lerArquivo() → parseCSV/OFX/PDF                     │
│    ↓ prepararItens() → classificação + duplicidade       │
│    ↓ onConcluir(resultados)                              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 2. REGISTRO NO HOOK ADAPTATIVO                           │
│    useOnboardingAdaptativo.registrarImportacao(itens)    │
│    ↓ Analisa itens (analisarDadosImportados)             │
│    ↓ Mapeia para etapas (receitas, despesas, cartoes)    │
│    ↓ Define status (importado/parcial/pendente)          │
│    ↓ Persiste no localStorage                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 3. PRÉ-PREENCHIMENTO DE FORMULÁRIOS                      │
│    Onboarding.jsx (useEffect nas etapas)                 │
│    ↓ obterDadosEtapa('renda')                            │
│    ↓ Preenche lista local com dados importados           │
│    ↓ Renderiza com indicadores visuais                   │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 4. REVISÃO E COMPLEMENTAÇÃO                              │
│    Usuário edita campos, preenche faltantes              │
│    ↓ onChange atualiza estado local                      │
│    ↓ Validações em tempo real                            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 5. CONFIRMAÇÃO DA ETAPA                                  │
│    Botão "Avançar" → avancarDeRenda()                    │
│    ↓ Valida dados locais                                 │
│    ↓ Salva no Supabase (INSERT em lote)                  │
│    ↓ confirmarEtapa('renda', receitas)                   │
│    ↓ determinarProximaEtapa() → pula confirmadas         │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 6. NAVEGAÇÃO ADAPTATIVA                                  │
│    irParaTela(proximaEtapa)                              │
│    ↓ Se status = 'confirmado' → pula                     │
│    ↓ Se status = 'parcial' → para para complementar      │
│    ↓ Se status = null → para para preencher              │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│ 7. CONCLUSÃO                                             │
│    Tela FINAL → Resumo consolidado                       │
│    ↓ "Ir para minha Home" → concluirOnboarding()         │
│    ↓ UPDATE perfis SET onboarding_concluido = true       │
│    ↓ limpar() → remove localStorage temporário           │
│    ↓ Redireciona para /home                              │
└─────────────────────────────────────────────────────────┘
```

---

### RT03: Algoritmo de Detecção de Duplicidade
```javascript
function ehDuplicataConfirmado(itemImportado, itensConfirmados) {
  const dataImportada = new Date(itemImportado.data)
  const valorImportado = Math.abs(itemImportado.valor)

  return itensConfirmados.some(confirmado => {
    // 1. Diferença de data <= 3 dias
    const dataConfirmada = new Date(confirmado.data)
    const diffDias = Math.abs(dataImportada - dataConfirmada) / (1000*60*60*24)
    if (diffDias > 3) return false

    // 2. Diferença de valor <= 1%
    const valorConfirmado = Math.abs(confirmado.valor)
    const diffValor = Math.abs(valorImportado - valorConfirmado) / 
                      Math.max(valorImportado, valorConfirmado)
    if (diffValor > 0.01) return false

    // 3. Similaridade de texto (Jaccard) >= 60%
    const similaridade = calcularJaccard(
      itemImportado.descricao, 
      confirmado.descricao
    )
    return similaridade >= 0.6
  })
}

function calcularJaccard(texto1, texto2) {
  const tokens1 = new Set(normalizar(texto1).split(/\s+/))
  const tokens2 = new Set(normalizar(texto2).split(/\s+/))
  
  const intersecao = new Set([...tokens1].filter(t => tokens2.has(t)))
  const uniao = new Set([...tokens1, ...tokens2])
  
  return uniao.size === 0 ? 0 : intersecao.size / uniao.size
}
```

---

### RT04: Lógica de Navegação Adaptativa
```javascript
function determinarProximaEtapa(statusEtapas, etapaAtual) {
  const ordem = ['perfil', 'importacao', 'saldo', 'renda', 'despesas', 'cartoes', 'metas', 'reserva']
  
  const indiceAtual = ordem.indexOf(etapaAtual)
  
  for (let i = indiceAtual + 1; i < ordem.length; i++) {
    const etapa = ordem[i]
    const status = statusEtapas[etapa]
    
    // Pula etapas confirmadas
    if (status === 'confirmado') continue
    
    // Para em parciais (precisam complemento)
    if (status === 'parcial') return etapa
    
    // Para em pendentes
    if (status === 'pendente') return etapa
    
    // Para em não preenchidas
    if (!status) return etapa
  }
  
  // Todas confirmadas → vai para final
  return 'final'
}
```

---

## ✅ CRITÉRIOS DE ACEITAÇÃO

### 1. Importação + Confirmação
- [ ] Importar 10 receitas → todas aparecem pré-preenchidas
- [ ] Editar 2 receitas → alterações salvas
- [ ] Avançar → etapa confirmada, não solicita novamente

### 2. Navegação Adaptativa
- [ ] Importar receitas completas → etapa "Renda" pulada
- [ ] Importar cartões sem limite → etapa "Cartões" obrigatória
- [ ] Todas etapas confirmadas → vai direto para tela Final

### 3. Campos Obrigatórios
- [ ] Cartão sem limite → campo destacado em âmbar + label "Obrigatório"
- [ ] Tentar avançar sem preencher → validação bloqueia
- [ ] Preencher limite → destaque removido

### 4. Retomada
- [ ] Importar → fechar navegador → reabrir → tela RETOMAR exibida
- [ ] Clicar "Continuar" → retoma de onde parou
- [ ] Clicar "Ir para o app" → conclui sem terminar

### 5. Duplicidades
- [ ] Importar 2x o mesmo extrato → itens marcados como duplicatas
- [ ] Importar lançamento já cadastrado → detecta e marca

### 6. Conta Vazia
- [ ] Clicar "Começar com conta vazia" → vai direto para Home
- [ ] Dashboard funciona normalmente (vazio)

---

## 🔒 REGRAS DE NEGÓCIO

### RN01: Nunca Inventar Dados
- Sistema NÃO deve preencher automaticamente: saldo_base, limite_total, dia_vencimento, forma_pagamento, tipo_despesa
- DEVE: marcar como "pendente" e solicitar preenchimento

### RN02: Não Assumir Recorrência
- Sistema NÃO deve marcar automaticamente como recorrente
- DEVE: sugerir revisão se houver múltiplas ocorrências similares

### RN03: Diferenciar Valores
- null/undefined = não informado
- 0 = valor zero (intencional)
- "" = string vazia (inválido, deve validar)

### RN04: Persistência Temporária
- Dados importados NÃO devem ser salvos no Supabase até confirmação
- DEVEM: persistir no localStorage até conclusão ou cancelamento

### RN05: Limpeza de Estado
- Ao concluir onboarding: limpar localStorage temporário
- Ao cancelar onboarding: limpar localStorage temporário
- Manter progresso de onboarding_etapa para retomada

---

## 📚 REFERÊNCIAS

- **Componentes:** `src/hooks/useOnboardingAdaptativo.js`, `src/components/IndicadorStatusEtapa.jsx`, `src/components/NavegacaoOnboardingAdaptativo.jsx`
- **Biblioteca:** `src/lib/onboardingAdaptativo.js`
- **Plano de Implementação:** `PLANO-ONBOARDING-ADAPTATIVO.md`
- **Sistema de Importação:** `src/pages/ImportacaoInteligente.jsx`, `src/lib/importacaoArquivos.js`

---

**Aprovação:** Aguardando implementação e testes completos.
