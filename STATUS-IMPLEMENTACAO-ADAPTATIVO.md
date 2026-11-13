# STATUS DA IMPLEMENTAÇÃO — ONBOARDING ADAPTATIVO

**Data:** 2026-11-06
**Status:** 🟡 Em progresso (30% completo)

---

## ✅ IMPLEMENTADO

### 1. Componentes Base (100% completo)
- [x] `useOnboardingAdaptativo.js` — hook de gerenciamento
- [x] `IndicadorStatusEtapa.jsx` — badges visuais
- [x] `NavegacaoOnboardingAdaptativo.jsx` — navegação lateral
- [x] `onboardingAdaptativo.js` — biblioteca de análise

### 2. Integrações Iniciais (40% completo)
- [x] Imports adicionados ao `Onboarding.jsx`
- [x] Hook `useOnboardingAdaptativo()` integrado
- [x] Etapa de Importação modificada (registra dados no hook)
- [x] Tela de RETOMAR com resumo de importação
- [x] Limpeza de dados temporários ao concluir

---

## ⏳ EM DESENVOLVIMENTO

### 3. Pré-Preenchimento de Formulários (0% completo)
**Crítico:** Precisa ser implementado para cada etapa

#### ETAPA Renda (receitas)
- [ ] useEffect para carregar `adaptativo.obterDadosEtapa('renda')`
- [ ] Pré-preencher lista local com receitas importadas
- [ ] Marcar itens com `_importado: true`
- [ ] Exibir badge "Importado" nos itens da lista
- [ ] Permitir edição de descrição/valor
- [ ] Confirmar etapa ao avançar: `adaptativo.confirmarEtapa('renda', receitas)`

#### ETAPA Despesas
- [ ] useEffect para carregar `adaptativo.obterDadosEtapa('despesas')`
- [ ] Pré-preencher lista local com despesas importadas
- [ ] Destacar campos faltantes (tipo_despesa, forma_pagamento)
- [ ] Exibir badge "Precisa revisar" se faltarem campos
- [ ] Confirmar etapa ao avançar

#### ETAPA Cartões
- [ ] useEffect para carregar `adaptativo.obterDadosEtapa('cartoes')`
- [ ] Pré-preencher formulário com cartões identificados
- [ ] Destacar campos obrigatórios faltantes (limite_total, dia_vencimento)
- [ ] Validar antes de avançar
- [ ] Confirmar etapa ao avançar

#### ETAPA Saldo/Investimentos
- [ ] Verificar `adaptativo.obterDadosEtapa('investimentos')`
- [ ] Sugerir patrimônio se houver investimentos importados
- [ ] Não preencher automaticamente (solicitar confirmação)

### 4. Navegação Adaptativa (0% completo)
- [ ] Modificar função `avancar()` para usar `determinarProximaEtapa()`
- [ ] Pular etapas com status "confirmado"
- [ ] Parar em etapas "parcial" (campos faltantes)
- [ ] Permitir navegação manual para revisão

### 5. Banners Informativos (10% completo)
- [x] Banner na etapa Importação (retomada)
- [ ] Banner na etapa Renda (dados importados)
- [ ] Banner na etapa Despesas (campos faltantes)
- [ ] Banner na etapa Cartões (complementar informações)

### 6. Indicadores Visuais (0% completo)
- [ ] Badge "Importado" em itens de receitas
- [ ] Badge "Importado" em itens de despesas
- [ ] Badge "Precisa revisar" em cartões sem limite
- [ ] Separadores visuais "Importadas" vs "Adicionadas manualmente"
- [ ] Destaque em campos obrigatórios faltantes

### 7. Tela Final com Resumo (0% completo)
- [ ] Card de resumo de importação
- [ ] Lista consolidada (importados + manuais)
- [ ] Estatísticas visuais

---

## 🚧 BLOQUEADORES TÉCNICOS

### Problema 1: ImportacaoInteligente.jsx não retorna estrutura esperada
**Descrição:** O callback `onConcluir` da ImportacaoInteligente atual provavelmente não passa `resultados.itens` no formato esperado pelo hook adaptativo.

**Solução necessária:**
1. Verificar estrutura retornada pela ImportacaoInteligente
2. Adaptar mapeamento no callback ou modificar hook adaptativo
3. Garantir que `itens` inclui: tipo, descricao, valor, data, categoriaId, etc.

### Problema 2: Detecção de duplicatas entre importação e dados existentes
**Descrição:** Dados já salvos no Supabase precisam ser comparados com dados importados para evitar duplicação.

**Solução necessária:**
1. Buscar receitas/despesas/cartões existentes do usuário
2. Comparar com itens importados usando `ehDuplicataConfirmado()`
3. Marcar duplicatas antes de pré-preencher formulários

### Problema 3: Ordem de salvamento (rehidratação)
**Descrição:** Listas locais (receitas, despesas, cartões) são hidratadas com dados existentes. Precisamos garantir que dados importados não sejam duplicados.

**Solução necessária:**
1. Verificar se item tem `id` (já salvo) ou `_importado: true` (temporário)
2. Mesclar listas sem duplicar
3. Priorizar dados do hook adaptativo sobre localStorage antigo

---

## 📋 PRÓXIMOS PASSOS CRÍTICOS

### Passo 1: Validar Estrutura de Retorno da Importação (URGENTE)
```javascript
// Testar o que ImportacaoInteligente retorna em onConcluir
console.log('Resultados da importação:', resultados)
console.log('Itens:', resultados?.itens)
console.log('Estrutura de 1º item:', resultados?.itens?.[0])
```

### Passo 2: Implementar Pré-Preenchimento de Receitas (CRÍTICO)
```javascript
// Adicionar no useEffect da etapa RENDA:
useEffect(() => {
  if (etapa !== RENDA) return
  
  const dadosImportados = adaptativo.obterDadosEtapa('renda')
  if (dadosImportados?.receitas && dadosImportados.receitas.length > 0) {
    setReceitas(prev => {
      const existentesIds = prev.filter(r => r.id).map(r => r.id)
      const novas = dadosImportados.receitas
        .filter(r => !r._confirmado && !existentesIds.includes(r.id))
        .map(r => ({
          ...r,
          uid: crypto.randomUUID(),
          _importado: true
        }))
      return [...prev, ...novas]
    })
  }
}, [etapa])
```

### Passo 3: Adicionar Banner de Dados Importados
```javascript
// No render da etapa RENDA:
{adaptativo.etapaPrecisaRevisao('renda') && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
    <div className="flex items-center gap-2">
      <FileCheck className="h-5 w-5 text-blue-600" />
      <p className="text-sm text-blue-900">
        <strong>Dados importados!</strong> 
        {` ${adaptativo.obterDadosEtapa('renda')?.receitas?.length || 0} receitas foram identificadas. `}
        Revise e confirme as informações abaixo.
      </p>
    </div>
  </div>
)}
```

### Passo 4: Modificar Botão "Avançar" para Confirmar Etapa
```javascript
// Na função de salvar receitas (avancarDeRenda):
async function avancarDeRenda() {
  if (emGravacao.current) return
  // ... validações existentes ...
  
  try {
    // ... salvamento no Supabase ...
    
    // Confirma etapa no adaptativo
    adaptativo.confirmarEtapa('renda', receitas)
    
    // Determina próxima etapa (pula confirmadas)
    const proxima = determinarProximaEtapa(adaptativo.etapasPreenchidas, 'renda')
    if (proxima && CHAVE_PARA_TELA[proxima]) {
      setEtapa(CHAVE_PARA_TELA[proxima])
    } else {
      avancar()
    }
  } catch (e) {
    // ... tratamento de erro ...
  }
}
```

### Passo 5: Testes Básicos
1. Criar conta nova
2. Importar extrato com 3 receitas
3. Verificar se receitas aparecem pré-preenchidas na etapa Renda
4. Editar 1 receita
5. Avançar
6. Voltar e verificar se edição foi preservada

---

## 🧪 PLANO DE TESTES

### Cenário 1: Importação + Confirmação
- [ ] Importar 5 receitas → aparecem pré-preenchidas
- [ ] Editar 2 receitas → alterações salvas
- [ ] Avançar → etapa confirmada
- [ ] Voltar → não solicita novamente

### Cenário 2: Importação Parcial
- [ ] Importar cartões sem limite → campo destacado
- [ ] Tentar avançar sem preencher → bloqueado
- [ ] Preencher limite → destaque removido
- [ ] Avançar → sucesso

### Cenário 3: Retomada
- [ ] Importar → fechar navegador
- [ ] Reabrir → tela RETOMAR exibida
- [ ] Resumo mostra dados importados
- [ ] Continuar → retoma de onde parou

---

## ⚠️ RISCOS E MITIGAÇÕES

### Risco 1: Perda de dados temporários
**Probabilidade:** Média  
**Impacto:** Alto  
**Mitigação:** Persistência dupla (localStorage + Supabase quando possível)

### Risco 2: Duplicação de lançamentos
**Probabilidade:** Alta (se não implementar detecção)  
**Impacto:** Crítico  
**Mitigação:** Implementar `ehDuplicataConfirmado()` antes de pré-preencher

### Risco 3: Perda de progresso ao trocar de navegador
**Probabilidade:** Alta  
**Impacto:** Médio  
**Mitigação:** Documentar limitação (localStorage é por dispositivo)

---

## 📊 MÉTRICAS DE PROGRESSO

**Componentes Base:** ██████████ 100% (4/4)
**Integrações:** ████░░░░░░ 40% (2/5)
**Pré-Preenchimento:** ░░░░░░░░░░ 0% (0/4)
**Navegação Adaptativa:** ░░░░░░░░░░ 0% (0/4)
**Banners:** ██░░░░░░░░ 10% (1/4)
**Indicadores Visuais:** ░░░░░░░░░░ 0% (0/5)
**Tela Final:** ░░░░░░░░░░ 0% (0/3)

**TOTAL GERAL:** ███░░░░░░░ 30%

---

## 🎯 ESTIMATIVA DE CONCLUSÃO

**Trabalho restante:** 14-16 horas
**Etapas críticas:** Pré-preenchimento (6h) + Navegação (3h) + Testes (4h)
**Revisão e polimento:** 2h

**Prazo estimado:** 2-3 dias de trabalho contínuo

---

**Última atualização:** 2026-11-06 (integração inicial)
