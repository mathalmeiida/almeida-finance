# Plano de Correção - Sistema de Faturas e Custo de Vida

## 🎯 Objetivo
Implementar sistema completo de pagamento de faturas (parcial, total, antecipado) + funcionalidade Custo de Vida usando despesas reais.

## 📋 Escopo das Correções

### 1. Sistema de Pagamento de Faturas

#### 1.1 Nova Tabela: `pagamentos_fatura`
```sql
CREATE TABLE pagamentos_fatura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fatura_id UUID NOT NULL REFERENCES faturas_cartao(id) ON DELETE CASCADE,
  valor_pago NUMERIC(12,2) NOT NULL CHECK (valor_pago > 0),
  data_pagamento DATE NOT NULL,
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('parcial', 'total', 'antecipado')),
  observacao TEXT,
  estornado BOOLEAN DEFAULT FALSE,
  estornado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
```

#### 1.2 Modificações em `faturas_cartao`
- Adicionar campo `valor_pago_acumulado` (soma dos pagamentos)
- Adicionar campo `limite_liberado` (proporcional ao valor pago)
- Manter `pago` como flag de fatura quitada integralmente

#### 1.3 Hook: `usePagamentosFatura.js`
Funções:
- `registrarPagamento(faturaId, valor, dataPagamento, tipoPagamento, observacao)`
- `estornarPagamento(pagamentoId, motivo)`
- `calcularLimiteLiberado(cartaoId, faturaId)`
- `buscarHistoricoPagamentos(faturaId)`

#### 1.4 Atualização de `faturaCartao.js`
Nova função:
- `limiteDisponivel Proporcional(cartao, fatura, pagamentos)` - calcula limite liberado proporcionalmente ao % pago da fatura

#### 1.5 Componentes UI
- `ModalPagamentoFatura.jsx` - Modal para registrar pagamentos (parcial/total/antecipado)
- `HistoricoPagamentos.jsx` - Lista de pagamentos com opção de estorno
- `CardLimiteLiberado.jsx` - Visualização do limite liberado vs comprometido

### 2. Funcionalidade Custo de Vida

#### 2.1 Nova Página: `CustoDeVida.jsx`
Componentes:
- **Resumo Mensal**: Total de despesas reais do mês
- **Por Categoria**: Visualização das despesas agrupadas (alimentação, transporte, moradia, etc)
- **Comparativo**: Mês atual vs média dos últimos 3/6/12 meses
- **Projeção**: Previsão do custo de vida baseado em despesas recorrentes
- **Gráfico de Evolução**: Linha temporal do custo de vida

#### 2.2 Hook: `useCustoDeVida.js`
Funções:
- `calcularCustoMesAtual()` - soma despesas reais do mês
- `calcularMediaPeriodo(meses)` - média histórica
- `agruparPorCategoria()` - despesas por categoria
- `projetarProximoMes()` - previsão baseada em despesas recorrentes

#### 2.3 Lógica de Cálculo
**Regras:**
1. Usar APENAS despesas reais já cadastradas (tabela `despesas`)
2. Incluir parcelas de cartão do mês (via `linhasFaturaCompleta`)
3. Incluir despesas recorrentes projetadas para o mês
4. **NÃO inventar valores** - se não há dados, mostrar "Insuficiente"
5. Categorias essenciais: Alimentação, Moradia, Transporte, Saúde, Educação, Outros

#### 2.4 Integração com Dashboard
- Card resumo "Custo de Vida" no Dashboard
- Link direto para página completa

### 3. Correção de Inconsistências

#### 3.1 Validação de Faturas
Nova função em `faturaCartao.js`:
```javascript
export function validarCoerenciaFatura(totalInformado, totalDetalhado, tolerancia = 0.01) {
  const diferenca = Math.abs(totalInformado - totalDetalhado)
  return {
    coerente: diferenca <= tolerancia,
    diferenca,
    percentualDivergencia: totalInformado > 0 ? (diferenca / totalInformado) * 100 : 0
  }
}
```

#### 3.2 Alerta Visual
Quando `naoDetalhado > 0` ou `divergencia > 0`:
- Badge vermelho com ícone de alerta
- Tooltip explicativo: "Diferença entre total informado e compras detalhadas"
- Botão "Investigar divergência" (abre modal com análise)

---

## 🚀 Ordem de Execução

### Fase 1: Infraestrutura de Pagamentos (Crítico)
1. Criar migration `2026-01_sistema_pagamento_faturas.sql`
2. Aplicar no DEV (gxfcfpdwyjqcrfssxgbi)
3. Criar hook `usePagamentosFatura.js`
4. Atualizar `faturaCartao.js` com cálculo proporcional

### Fase 2: Interface de Pagamentos
1. Criar `ModalPagamentoFatura.jsx`
2. Criar `HistoricoPagamentos.jsx`
3. Integrar em `Cartoes.jsx` (substituir botão binário atual)
4. Adicionar badge de limite liberado

### Fase 3: Custo de Vida
1. Criar hook `useCustoDeVida.js`
2. Criar página `CustoDeVida.jsx`
3. Adicionar rota em `App.jsx`
4. Integrar card resumo no Dashboard

### Fase 4: Validações e Alertas
1. Implementar `validarCoerenciaFatura`
2. Adicionar alertas visuais de inconsistência
3. Criar modal de investigação de divergências

### Fase 5: Testes e Ajustes
1. Testar cenários: pagamento parcial, total, antecipado
2. Testar estorno de pagamento
3. Validar cálculo de limite liberado
4. Validar custo de vida com dados reais
5. Corrigir bugs encontrados

---

## ✅ Critérios de Sucesso

### Sistema de Pagamentos:
- [ ] Registrar pagamento parcial e liberar limite proporcionalmente
- [ ] Registrar pagamento total e liberar limite integral
- [ ] Registrar pagamento antecipado (data futura)
- [ ] Visualizar histórico de pagamentos por fatura
- [ ] Estornar pagamento e reverter liberação de limite
- [ ] Calcular limite disponível real: `limite_total - (comprometido - limite_liberado)`

### Custo de Vida:
- [ ] Calcular custo mensal usando APENAS despesas reais
- [ ] Mostrar "Dados insuficientes" quando não há histórico
- [ ] Agrupar por categoria essencial
- [ ] Comparar com média histórica (3/6/12 meses)
- [ ] Projetar próximo mês baseado em recorrências

### Correção de Inconsistências:
- [ ] Identificar divergências > R$ 0,01
- [ ] Alertar usuário visualmente
- [ ] Fornecer ferramentas de investigação

---

## 📊 Métricas de Qualidade

1. **Precisão Financeira**: Erros < R$ 0,01 (arredondamento de centavos)
2. **Performance**: Consultas < 500ms
3. **Usabilidade**: Fluxo de pagamento em max 3 cliques
4. **Confiabilidade**: Dados reais, sem invenção de valores

---

## 🔒 Segurança

- RLS em `pagamentos_fatura` (usuário vê só os próprios)
- Validação: valor pago ≤ valor_total da fatura
- Validação: estorno só de pagamentos não estornados
- Auditoria: registrar `criado_em` e `estornado_em`

---

## 📝 Notas Importantes

1. **NÃO publicar em produção** sem aprovação explícita
2. **Usar DEV**: https://gxfcfpdwyjqcrfssxgbi.supabase.co
3. **Testes reais**: criar faturas de teste e simular pagamentos
4. **Economizar recursos**: não fazer loops desnecessários, usar joins eficientes
5. **Manter simplicidade**: UI intuitiva, fluxo direto

---

**Status**: 📋 Plano aprovado. Aguardando início da implementação.
