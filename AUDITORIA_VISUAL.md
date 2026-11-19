# Auditoria Visual - Almeida Finance

## RESUMO EXECUTIVO

**Status**: Auditoria parcial concluída  
**Total de ocorrências**: 264 cores hardcoded em 46 arquivos  
**Correções aplicadas**: Tokens semânticos adicionados ao Tailwind config

## SISTEMA DE TEMA

### ✅ Estrutura Existente (index.css)
- Variáveis CSS: `--marca`, `--bg`, `--surface`, `--text-pri`, `--text-sec`, `--border-col`, `--accent`
- 3 modos: Claro (padrão), Escuro, Automático
- Paleta vinho/bordô como identidade fixa

### ✅ Tokens Tailwind Adicionados
```javascript
bg: 'rgb(var(--bg) / <alpha-value>)',
surface: { DEFAULT: '...', 2: '...' },
'text-pri': 'rgb(var(--text-pri) / <alpha-value>)',
'text-sec': 'rgb(var(--text-sec) / <alpha-value>)',
'border-col': 'rgb(var(--border-col) / <alpha-value>)',
accent: 'rgb(var(--accent) / <alpha-value>)',
```

## PROBLEMAS IDENTIFICADOS

### Cores Hardcoded (Alto Impacto)
1. **AtalhosHome.jsx** (3 ocorrências) - ✅ CORRIGIDO
   - `text-[#D4A8B6]` → `text-text-sec`
   - `text-[#C4507A]` → `text-marca`

2. **CalendarioCenario.jsx** (7 ocorrências) - ✅ PARCIAL
   - Tokens aplicados nas variáveis principais
   - Necessita revisão de backgrounds condicionais

3. **CalendarioFinanceiroHome.jsx** (4 ocorrências)
   - `bg-sky-400` → deve usar `accent` (faturas)
   - Cores funcionais (rose-/red-/green-) mantidas

4. **Layout.jsx** (9 ocorrências)
   - `corIcone` dos itens de menu ainda usa cores específicas
   - Precisa mapear para tokens

5. **HorizonteFinanceiro.jsx** (4 ocorrências)
   - `text-blue-700` → `text-marca` (dia atual)
   - `bg-blue-100` → `bg-marca-100`

### Componentes com Cores Hardcoded (Médio Impacto)
- ConciliacaoPrevia.jsx (2)
- ParcelamentosShared.jsx (6)
- ResumoConciliacao.jsx (4)
- IndicadorStatusEtapa.jsx (1)
- NavegacaoOnboardingAdaptativo.jsx (5)

### Páginas Restantes (46 arquivos total)
Ver `tests/auditoria-cores-hardcoded.mjs` para lista completa

## RESPONSIVIDADE

### ✅ Estrutura Base OK
- Grid responsivo implementado
- Breakpoints: sm, md, lg, xl, 2xl
- Container com max-width configurado

### ⚠️  Áreas que Precisam Revisão
1. **Calendário Home**: altura fixa pode cortar em telas pequenas
2. **Modais**: largura pode exceder viewport mobile
3. **Tabelas**: necessitam scroll horizontal em mobile
4. **Formulários**: campos com larguras fixas

## AÇÕES RECOMENDADAS

### Prioridade Alta (Impacto Visual Imediato)
1. ✅ Adicionar tokens semânticos ao Tailwind config
2. ✅ Corrigir AtalhosHome.jsx
3. ⏳ Corrigir CalendarioFinanceiroHome.jsx
4. ⏳ Corrigir HorizonteFinanceiro.jsx
5. ⏳ Padronizar cores do menu (Layout.jsx)

### Prioridade Média (Consistência)
6. ⏳ Substituir `blue-`/`indigo-`/`purple-` → `marca`
7. ⏳ Substituir `sky-` → `accent` (faturas)
8. ⏳ Padronizar componentes de formulário

### Prioridade Baixa (Refinamento)
9. ⏳ Revisar responsividade de modais
10. ⏳ Ajustar tabelas mobile
11. ⏳ Refinar espaçamentos globais

## ARQUIVOS MODIFICADOS

1. `tailwind.config.js` - Tokens semânticos adicionados
2. `src/components/AtalhosHome.jsx` - Cores corrigidas (3 linhas)
3. `src/components/CalendarioCenario.jsx` - Variáveis atualizadas (3 linhas)

## TESTES NECESSÁRIOS

- [ ] Validar troca de paleta em Configurações
- [ ] Testar modo Claro/Escuro/Automático
- [ ] Verificar persistência após reload
- [ ] Testar em larguras: 375px, 768px, 1024px, 1440px
- [ ] Build production

## LIMITAÇÕES CONHECIDAS

1. **Volume**: 264 ocorrências em 46 arquivos requer abordagem iterativa
2. **E2E**: Testes visuais bloqueados por necessidade de autenticação real
3. **Escopo**: Correção completa requer 2-3 sessões adicionais

## PRÓXIMOS PASSOS

1. Executar build e validar tokens
2. Corrigir calendário e horizonte financeiro
3. Padronizar menu e navegação
4. Criar script automatizado de substituição em massa
5. Testar em dispositivos reais

---
**Data**: 2026-11-19  
**Progresso**: ~15% (tokens criados + 2 componentes corrigidos)  
**Estimativa para conclusão**: 2-3 sessões adicionais
