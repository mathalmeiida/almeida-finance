# 🎨 Guia Visual - Sistema Implementado

## 📸 Como Vai Funcionar (Visualmente)

### 1. Página de Faturas (Cartoes.jsx) - ANTES vs DEPOIS

#### ANTES (Sistema Atual):
```
┌─────────────────────────────────────────┐
│  FATURA OUTUBRO/2026                    │
│  R$ 5.970,18                           │
│                                         │
│  [Marcar fatura como paga]  ← Binário  │
└─────────────────────────────────────────┘
```

#### DEPOIS (Sistema Novo):
```
┌─────────────────────────────────────────────────┐
│  FATURA OUTUBRO/2026                            │
│  R$ 5.970,18                                    │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 💰 Valor pago até agora                 │   │
│  │ R$ 2.388,07   (40% da fatura)          │   │
│  │ Faltam R$ 3.582,11                      │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [💵 Registrar pagamento]  ← Novo sistema      │
│                                                 │
│  📋 Histórico de pagamentos                    │
│  ┌─────────────────────────────────────────┐   │
│  │ R$ 2.388,07         [Parcial]          │   │
│  │ 📅 20/10/2026       [Estornar]         │   │
│  │ Observação: Pagamento via PIX          │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

### 2. Modal de Pagamento (ModalPagamentoFatura.jsx)

```
┌────────────────────────────────────────────────┐
│  Registrar pagamento                      [X]  │
├────────────────────────────────────────────────┤
│                                                │
│  Resumo da fatura                             │
│  ┌──────────────────────────────────────────┐ │
│  │ Valor total:      R$ 5.970,18           │ │
│  │ Já pago:         -R$ 2.388,07           │ │
│  │ ───────────────────────────────────────  │ │
│  │ Valor restante:   R$ 3.582,11           │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  💵 Valor do pagamento (R$)                   │
│  ┌──────────────────────────────────────────┐ │
│  │ 2.000,00    [Pagar total (R$ 3.582,11)] │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  📅 Data do pagamento                         │
│  ┌──────────────────────────────────────────┐ │
│  │ 2026-10-25                               │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  📄 Tipo de pagamento                         │
│  ┌──────────────────────────────────────────┐ │
│  │ Pagamento parcial         ▼              │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  💬 Observações (opcional)                    │
│  ┌──────────────────────────────────────────┐ │
│  │ Ex: Pagamento via PIX...                 │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ℹ️  Liberará R$ 2.000,00 do limite do cartão │
│                                                │
│  [Cancelar]  [Registrar pagamento]            │
└────────────────────────────────────────────────┘
```

---

### 3. Página Custo de Vida (CustoDeVida.jsx)

```
┌─────────────────────────────────────────────────────────┐
│  ← Voltar ao Dashboard                                  │
│                                                         │
│  Custo de Vida                                          │
│  Análise das suas despesas essenciais mensais          │
│                                                         │
│  [<]      Outubro de 2026 (Mês atual)      [>]        │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │  💰 Custo de vida total         📊               │ │
│  │  R$ 3.456,78                                      │ │
│  │  ───────────────────────────────────────────────  │ │
│  │  📈 +R$ 234,56 (7,2%)                            │ │
│  │  vs média de 3 meses                             │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  [Últimos 3 meses] [Últimos 6 meses] [Últimos 12]     │
│                                                         │
│  Por categoria                                          │
│  ┌───────────────────┐  ┌───────────────────┐         │
│  │ 🍽️  Alimentação   │  │ 🏠  Moradia        │         │
│  │                   │  │                   │         │
│  │ R$ 1.234,56      │  │ R$ 987,65         │         │
│  │ 35% ████████░░    │  │ 28% ███████░░░    │         │
│  └───────────────────┘  └───────────────────┘         │
│                                                         │
│  ┌───────────────────┐  ┌───────────────────┐         │
│  │ 🚗  Transporte    │  │ 🏥  Saúde          │         │
│  │                   │  │                   │         │
│  │ R$ 654,32        │  │ R$ 345,67         │         │
│  │ 19% █████░░░░░    │  │ 10% ███░░░░░░░    │         │
│  └───────────────────┘  └───────────────────┘         │
│                                                         │
│  Distribuição por categoria                            │
│  ┌───────────────────────────────────────────────────┐ │
│  │        🥧 Gráfico de Pizza                        │ │
│  │                                                   │ │
│  │         Alimentação (35%)                         │ │
│  │         Moradia (28%)                             │ │
│  │         Transporte (19%)                          │ │
│  │         Saúde (10%)                               │ │
│  │         Outros (8%)                               │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  Evolução (últimos 12 meses)                           │
│  ┌───────────────────────────────────────────────────┐ │
│  │        📈 Gráfico de Linha                        │ │
│  │  R$                                               │ │
│  │  4k ─                                   ●         │ │
│  │  3k ─              ●───●───●───●───●──/          │ │
│  │  2k ─        ●───●/                              │ │
│  │  1k ─  ●───●/                                     │ │
│  │  0  ┴───┴───┴───┴───┴───┴───┴───┴───┴───┴───┴    │ │
│  │     jan fev mar abr mai jun jul ago set out nov  │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  ℹ️  O custo de vida é calculado apenas com dados     │
│     reais já cadastrados. Mantenha seus lançamentos   │
│     atualizados para análises precisas.               │
└─────────────────────────────────────────────────────────┘
```

---

### 4. Dashboard - Novo Card

```
┌────────────────────────────────┐
│  Custo de Vida    🍽️           │
│                                │
│  R$ 3.456,78                   │
│  Despesas essenciais do mês    │
└────────────────────────────────┘
     ↓ Clica
     ↓
Abre página completa CustoDeVida.jsx
```

---

## 🎨 Fluxo de Interação

### Cenário 1: Usuário quer pagar parte da fatura

```
1. Abre fatura do cartão
   ↓
2. Vê valor total: R$ 5.970,18
   ↓
3. Clica em "Registrar pagamento"
   ↓
4. Modal abre com resumo
   ↓
5. Digita: R$ 2.000,00
   ↓
6. Sistema mostra: "Liberará R$ 2.000 do limite"
   ↓
7. Clica em "Registrar pagamento"
   ↓
8. Modal fecha
   ↓
9. Aparece resumo: "Valor pago: R$ 2.000 (33%)"
   ↓
10. Histórico mostra o pagamento
    ↓
11. Limite do cartão aumenta proporcionalmente
```

### Cenário 2: Usuário quer estornar pagamento

```
1. No histórico, vê pagamento de R$ 2.000
   ↓
2. Clica em "Estornar"
   ↓
3. Campo de motivo aparece (inline)
   ↓
4. Digita: "Pagamento duplicado"
   ↓
5. Clica em "Confirmar estorno"
   ↓
6. Pagamento move para seção "Estornados"
   ↓
7. Valor pago acumulado reduzido
   ↓
8. Limite recalculado automaticamente
```

### Cenário 3: Usuário quer ver custo de vida

```
1. No Dashboard, vê card "Custo de Vida"
   ↓
2. Mostra: R$ 3.456,78
   ↓
3. Clica no card
   ↓
4. Abre página completa
   ↓
5. Vê resumo do mês + gráficos
   ↓
6. Clica em categoria "Alimentação"
   ↓
7. Modal abre com detalhes:
   - Supermercado Pão de Açúcar: R$ 456,78
   - Restaurante Outback: R$ 234,56
   - Lanche McDonald's: R$ 45,67
   ↓
8. Fecha modal
   ↓
9. Navega para mês anterior [<]
   ↓
10. Vê comparação com mês anterior
```

---

## 🎯 Pontos Visuais Importantes

### 1. Cores e Estados

**Pagamento Parcial:**
- 🟡 Amarelo/Âmbar para "em andamento"
- Badge: "Parcial"

**Pagamento Total:**
- 🟢 Verde para "quitado"
- Badge: "Total"
- Ícone: ✅ CheckCircle

**Estornado:**
- 🔴 Vermelho para "estornado"
- Badge: "Estornado"
- Ícone: ❌ XCircle
- Texto com line-through

**Sem dados:**
- 🔵 Azul/Cinza para "neutro"
- Mensagem clara: "Dados insuficientes"

### 2. Feedback Visual

**Loading:**
```
⏳ Registrando pagamento...
⏳ Carregando custo de vida...
```

**Sucesso:**
```
✅ Pagamento registrado com sucesso
✅ Fatura quitada integralmente
```

**Erro:**
```
❌ Valor ultrapassa o restante da fatura
❌ Erro ao registrar pagamento
```

**Info:**
```
ℹ️  Liberará R$ 2.000 do limite do cartão
ℹ️  Este pagamento quitará a fatura integralmente
```

### 3. Responsividade

**Desktop (> 768px):**
- Grid 2 colunas para categorias
- Gráficos largos
- Modal centralizado

**Mobile (< 768px):**
- Grid 1 coluna
- Gráficos compactos
- Modal bottom sheet (desliza de baixo)

---

## 🔢 Exemplos Numéricos

### Fatura de R$ 5.000 | Limite R$ 10.000

**Estado Inicial:**
- Comprometido: R$ 5.000
- Disponível: R$ 5.000

**Paga R$ 2.000 (40%):**
- Pago acumulado: R$ 2.000
- Restante: R$ 3.000
- Limite liberado: R$ 2.000 (40% de R$ 5.000)
- Comprometido: R$ 3.000
- Disponível: R$ 7.000 ✅

**Paga mais R$ 1.500 (30%):**
- Pago acumulado: R$ 3.500
- Restante: R$ 1.500
- Limite liberado: R$ 3.500 (70% de R$ 5.000)
- Comprometido: R$ 1.500
- Disponível: R$ 8.500 ✅

**Paga final R$ 1.500 (30%):**
- Pago acumulado: R$ 5.000
- Restante: R$ 0
- Fatura quitada ✅
- Limite liberado: R$ 5.000 (100%)
- Comprometido: R$ 0
- Disponível: R$ 10.000 ✅

---

## 📱 Mobile Preview

```
┌──────────────────────┐
│  ← Fatura Out/26     │
│                      │
│  💰 Valor pago       │
│  ┌────────────────┐  │
│  │ R$ 2.000       │  │
│  │ 40% da fatura  │  │
│  └────────────────┘  │
│                      │
│  [💵 Pagar]          │
│                      │
│  📋 Histórico        │
│  ┌────────────────┐  │
│  │ R$ 2.000       │  │
│  │ 20/10 • Parcial│  │
│  │ [Estornar]     │  │
│  └────────────────┘  │
└──────────────────────┘
```

---

**Interface 100% intuitiva e clara. Sem confusão. Sem dados inventados. Apenas o essencial.**
