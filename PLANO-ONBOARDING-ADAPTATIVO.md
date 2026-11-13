# PLANO DE IMPLEMENTAÇÃO — ONBOARDING ADAPTATIVO COM IMPORTAÇÃO INTELIGENTE

**Objetivo:** Reformular o onboarding para pular etapas automaticamente preenchidas via importação, solicitando apenas campos ausentes.

---

## ✅ COMPONENTES CRIADOS

### 1. Hook de Gerenciamento (`src/hooks/useOnboardingAdaptativo.js`)
**Responsabilidades:**
- Gerencia estado temporário de dados importados (localStorage até confirmação)
- Rastreia status de cada etapa (importado/parcial/pendente/confirmado)
- Registra dados da ImportacaoInteligente
- Confirma etapas (marca como _confirmado)
- Detecta campos faltantes
- Limpa dados temporários ao concluir

**API Principal:**
```javascript
const {
  dadosTemp,               // Dados temporários { receitas: [], despesas: [], ... }
  etapasPreenchidas,       // Status { renda: 'importado', cartoes: 'parcial', ... }
  carregando,
  registrarImportacao,     // (itens) => void — chamado pela ImportacaoInteligente
  confirmarEtapa,          // (etapa, dados) => void — marca como confirmado
  obterDadosEtapa,         // (etapa) => dados
  etapaPreenchida,         // (etapa) => boolean
  etapaPrecisaRevisao,     // (etapa) => boolean
  statusEtapa,             // (etapa) => 'importado' | 'parcial' | ...
  limpar,                  // () => void — remove localStorage
  estatisticas             // { importados, confirmados, total, totalConfirmado }
} = useOnboardingAdaptativo()
```

---

### 2. Indicadores de Status (`src/components/IndicadorStatusEtapa.jsx`)
**Variantes:**
- `<IndicadorStatusEtapa status="importado" />` — Badge completo
- `<IndicadorStatusIcone status="parcial" />` — Apenas ícone

**Status suportados:**
- `importado` — Azul: dados vieram da importação
- `parcial` — Âmbar: precisa revisar/complementar
- `pendente` — Cinza: aguardando preenchimento
- `confirmado` — Verde: validado pelo usuário

---

### 3. Navegação Lateral (`src/components/NavegacaoOnboardingAdaptativo.jsx`)
**Características:**
- Exibe 8 etapas com indicador visual de status
- Destaca etapa atual
- Permite navegação direta (quando habilitado)
- Mostra progresso consolidado

---

### 4. Biblioteca de Análise (`src/lib/onboardingAdaptativo.js`)
**Funções principais:**

```javascript
analisarDadosImportados(itensImportados, dadosExistentes)
// Retorna: { etapa: { status, dados, camposFaltantes } }
// Mapeia itens importados para estrutura de etapas

ehDuplicataConfirmado(itemImportado, itensConfirmados)
// Detecta se item importado já foi confirmado anteriormente
// Usa data±3 dias + similaridade Jaccard>=0.6

determinarProximaEtapa(statusEtapas, etapaAtual)
// Retorna próxima etapa que precisa ação
// Pula confirmadas, prioriza parciais

podePularEtapa(etapa, statusEtapas, camposFaltantes)
// Valida se etapa pode ser automaticamente pulada
// Critérios: confirmada OU importada SEM campos faltantes

gerarResumoImportacao(estatisticas)
// Gera texto legível: "Importados: 12 receitas, 8 despesas e 3 cartões"
```

---

## 🔄 INTEGRAÇÕES NECESSÁRIAS

### A. Onboarding.jsx Principal

#### 1. Adicionar hook no início do componente:
```javascript
const adaptativo = useOnboardingAdaptativo()
```

#### 2. Integrar com etapa de Importação (tela 'importacao'):
```javascript
// Quando ImportacaoInteligente concluir:
const handleConcluirImportacao = async (resultados) => {
  // Registra itens importados no estado temporário
  await adaptativo.registrarImportacao(resultados.itens)
  
  // Analisa e determina próxima etapa
  const analise = analisarDadosImportados(resultados.itens, dadosExistentes)
  const proxima = determinarProximaEtapa(adaptativo.etapasPreenchidas, 'importacao')
  
  // Navega automaticamente para próxima etapa que precisa ação
  irParaTela(proxima)
}
```

#### 3. Pré-preencher formulários com dados importados:

**Receitas (tela 'renda'):**
```javascript
useEffect(() => {
  const dadosImportados = adaptativo.obterDadosEtapa('renda')
  if (dadosImportados?.receitas) {
    // Pré-preenche lista local com receitas importadas
    setReceitas(prev => {
      const jaExistentes = prev.map(r => r.uid)
      const novas = dadosImportados.receitas
        .filter(r => !r._confirmado && !jaExistentes.includes(r.uid))
        .map(r => ({ ...r, uid: gerarUID() }))
      return [...prev, ...novas]
    })
  }
}, [tela])
```

**Despesas (tela 'despesas'):**
```javascript
useEffect(() => {
  const dadosImportados = adaptativo.obterDadosEtapa('despesas')
  if (dadosImportados?.despesas) {
    // Pré-preenche lista local
    // Marca campos faltantes para revisão
    setDespesas(prev => {
      const novas = dadosImportados.despesas
        .filter(d => !d._confirmado)
        .map(d => ({
          ...d,
          uid: gerarUID(),
          _precisa_complementar: !d.tipo_despesa || !d.forma_pagamento
        }))
      return [...prev, ...novas]
    })
  }
}, [tela])
```

**Cartões (tela 'cartoes'):**
```javascript
useEffect(() => {
  const dadosImportados = adaptativo.obterDadosEtapa('cartoes')
  if (dadosImportados?.cartoes) {
    // Pré-preenche lista local
    // DESTACA campos faltantes (limite, vencimento)
    setCartoes(prev => {
      const novos = dadosImportados.cartoes
        .filter(c => !c._confirmado)
        .map(c => ({
          ...c,
          uid: gerarUID(),
          _precisa_complementar: !c.limite_total || !c.dia_vencimento
        }))
      return [...prev, ...novos]
    })
  }
}, [tela])
```

#### 4. Confirmar etapas ao avançar:
```javascript
const avancarDe[Etapa] = async () => {
  // Valida dados locais
  if (!validarDados()) return
  
  // Salva no Supabase (lógica atual mantida)
  await salvarNoSupabase()
  
  // Confirma etapa no estado adaptativo
  adaptativo.confirmarEtapa('renda', receitas)
  
  // Determina próxima etapa (pode pular confirmadas)
  const proxima = determinarProximaEtapa(adaptativo.etapasPreenchidas, 'renda')
  irParaTela(proxima)
}
```

#### 5. Exibir indicadores nos formulários:
```javascript
// Lista de receitas importadas:
{receitas.map(receita => (
  <div key={receita.uid} className="flex items-center gap-2">
    {receita._importado && (
      <IndicadorStatusIcone 
        status={receita._confirmado ? 'confirmado' : 'importado'} 
        tamanho="sm"
      />
    )}
    <span>{receita.descricao}</span>
    {/* ... restante do item ... */}
  </div>
))}
```

#### 6. Adicionar navegação lateral (opcional, em telas desktop):
```javascript
{/* Layout desktop com navegação lateral */}
<div className="hidden lg:flex gap-6">
  <NavegacaoOnboardingAdaptativo
    etapaAtual={etapaDaTela(tela)}
    statusEtapas={adaptativo.etapasPreenchidas}
    onNavegar={(numEtapa) => {
      const telasEtapa = ETAPAS_ONBOARDING[numEtapa].telas
      irParaTela(telasEtapa[0])
    }}
    className="w-64 flex-shrink-0"
  />
  
  <div className="flex-1">
    {/* Conteúdo do formulário */}
  </div>
</div>
```

#### 7. Tela de Retomada (RETOMAR):
```javascript
// Ao detectar progresso salvo, mostrar resumo de importação
if (tela === RETOMAR) {
  const stats = adaptativo.estatisticas
  const resumo = gerarResumoImportacao(stats)
  
  return (
    <div>
      <h2>Você tem um cadastro em andamento</h2>
      <p>{resumo}</p>
      
      <div className="space-y-2">
        <button onClick={() => irParaTela(telaParaRetomar())}>
          Continuar de onde parei
        </button>
        <button onClick={() => irParaTela(FINAL)}>
          Ir para o app agora
        </button>
      </div>
    </div>
  )
}
```

#### 8. Tela Final:
```javascript
// Exibir resumo de importação + dados manuais
const stats = adaptativo.estatisticas
const itensResumo = itensResumoFinal(/* ... dados atuais ... */)

return (
  <div>
    <h2>Tudo pronto! 🎉</h2>
    
    {stats && stats.total > 0 && (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          {gerarResumoImportacao(stats)}
        </p>
      </div>
    )}
    
    {/* Resumo consolidado: importados + manuais */}
    <ul>
      {itensResumo.map(item => (
        <li key={item.icone}>
          {item.icone} {item.label}: {item.valor}
        </li>
      ))}
    </ul>
    
    <button onClick={concluirOnboarding}>
      Ir para minha Home
    </button>
  </div>
)
```

#### 9. Conclusão do onboarding:
```javascript
const concluirOnboarding = async () => {
  // Marca onboarding como concluído (lógica atual mantida)
  await marcarOnboardingConcluido()
  
  // Limpa dados temporários do adaptativo
  adaptativo.limpar()
  
  // Limpa localStorage de progresso (lógica atual mantida)
  limparProgresso()
}
```

---

### B. ImportacaoInteligente.jsx

#### Modificar callback de conclusão:
```javascript
// Props:
embutido={true}
onConcluir={(resultados) => {
  // Envia itens para o hook adaptativo
  if (props.onRegistrarImportacao) {
    props.onRegistrarImportacao(resultados.itens)
  }
  
  // Callback original (navega para próxima etapa)
  props.onConcluir(resultados)
}}
```

---

## 🎨 MELHORIAS VISUAIS

### 1. Banner de Dados Importados (topo de cada etapa):
```javascript
{adaptativo.etapaPrecisaRevisao('renda') && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
    <div className="flex items-center gap-2">
      <FileCheck className="h-5 w-5 text-blue-600" />
      <p className="text-sm text-blue-900">
        <strong>Dados importados!</strong> 
        {` ${adaptativo.obterDadosEtapa('renda')?.length || 0} receitas foram identificadas. `}
        Revise e confirme as informações abaixo.
      </p>
    </div>
  </div>
)}
```

### 2. Separadores visuais entre importados e manuais:
```javascript
{/* Lista de receitas */}
{receitas.filter(r => r._importado).length > 0 && (
  <>
    <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-2">
      📥 Importadas ({receitas.filter(r => r._importado).length})
    </h4>
    {receitas.filter(r => r._importado).map(renderReceita)}
  </>
)}

{receitas.filter(r => !r._importado).length > 0 && (
  <>
    <h4 className="text-sm font-semibold text-gray-700 mt-6 mb-2">
      ✏️ Adicionadas manualmente ({receitas.filter(r => !r._importado).length})
    </h4>
    {receitas.filter(r => !r._importado).map(renderReceita)}
  </>
)}
```

### 3. Destaque de campos faltantes:
```javascript
<div className="relative">
  <InputMoeda
    label="Limite total"
    value={cartao.limite_total}
    onChange={(valor) => atualizarCartao(cartao.uid, { limite_total: valor })}
    className={cartao._precisa_complementar && !cartao.limite_total 
      ? 'border-amber-300 ring-2 ring-amber-100' 
      : ''
    }
  />
  {cartao._precisa_complementar && !cartao.limite_total && (
    <span className="absolute -top-2 right-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
      Obrigatório
    </span>
  )}
</div>
```

---

## 🧪 TESTES NECESSÁRIOS

### 1. Importação Parcial
- [ ] Importar apenas receitas → deve pular etapa de receitas, solicitar despesas
- [ ] Importar apenas cartões → deve solicitar limites/vencimentos
- [ ] Importar investimentos → deve solicitar confirmação de saldos

### 2. Múltiplos Arquivos
- [ ] Importar 2 extratos diferentes → detectar duplicidades entre arquivos
- [ ] Importar fatura + extrato → vincular compras aos cartões identificados

### 3. Duplicidades
- [ ] Importar, confirmar, tentar importar novamente → marcar como duplicata
- [ ] Adicionar manual, importar similar → detectar possível duplicata

### 4. Cancelamento/Retomada
- [ ] Importar → cancelar onboarding → reabrir → dados temporários preservados
- [ ] Importar → avançar 3 etapas → fechar navegador → reabrir → continuar de onde parou

### 5. Conta Nova
- [ ] Criar conta → importar dados → verificar saldos iniciais corretos
- [ ] Criar conta → começar vazio → nenhum indicador de importação

### 6. Conta Existente
- [ ] Usuário com dados → importar → detectar duplicatas de lançamentos antigos
- [ ] Admin marca onboarding_concluido=false → reabrir → dados existentes preservados

---

## 🚀 ORDEM DE IMPLEMENTAÇÃO

1. **Integrar hook no Onboarding.jsx** (adicionar `useOnboardingAdaptativo()`)
2. **Modificar etapa de Importação** (registrar resultados no hook)
3. **Pré-preencher Receitas** (useEffect + lista temporária)
4. **Pré-preencher Despesas** (campos faltantes destacados)
5. **Pré-preencher Cartões** (limite/vencimento obrigatórios)
6. **Implementar navegação adaptativa** (pular etapas confirmadas)
7. **Adicionar indicadores visuais** (badges, separadores, destaque)
8. **Tela de Retomada** (resumo de importação)
9. **Tela Final** (consolidar importados + manuais)
10. **Testes completos** (6 cenários acima)
11. **Commit local** (sem publicar)

---

## ⚠️ REGRAS CRÍTICAS

❌ **NÃO FAZER:**
- Deduzir automaticamente recorrência (múltiplos lançamentos similares)
- Inventar saldo_base, limite_total, dia_vencimento
- Assumir forma_pagamento ou tipo_despesa
- Salvar definitivamente antes de confirmação final
- Duplicar lançamentos entre arquivos

✅ **SEMPRE:**
- Marcar dados importados com `_importado: true`
- Exigir confirmação para campos críticos (limite, vencimento, saldo)
- Diferenciar "não informado" (null) de "valor zero" (0)
- Permitir edição de TODOS os dados importados
- Detectar duplicidades entre importação e dados confirmados
- Preservar estado temporário até conclusão ou cancelamento

---

## 📊 MÉTRICAS DE SUCESSO

- **Taxa de conclusão:** % usuários que concluem onboarding após importação
- **Tempo médio:** redução de 50% no tempo de cadastro com importação
- **Campos editados:** % campos importados que usuário altera (meta: <20%)
- **Duplicatas evitadas:** qtd lançamentos duplicados detectados
- **Taxa de retomada:** % usuários que retomam após interrupção

---

**Status:** Componentes base criados. Aguardando integração no Onboarding.jsx principal.
