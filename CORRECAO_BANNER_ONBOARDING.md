# CORREÇÃO: Banner Onboarding

## Bug Identificado
Banner "Complete sua configuração" continuava aparecendo após conclusão do onboarding, ignorando `onboarding_concluido = true`.

## Correção Aplicada
**Arquivo:** `src/pages/Dashboard.jsx` (linha ~2227)

**Antes:**
```javascript
const mostrarComecePorAqui = !carregando && totalConcluidos < onboardingItens.length && !comeceDispensado
```

**Depois:**
```javascript
const onboardingConcluido = perfil?.onboarding_concluido === true
const mostrarComecePorAqui = !carregando && !onboardingConcluido && totalConcluidos < onboardingItens.length && !comeceDispensado
```

## Fluxo Validado
1. ✅ `OnboardingSimples.handleConcluir()` → `aoConcluir()`
2. ✅ `App.encerrarOnboarding()` → `concluir()`
3. ✅ `AuthContext.marcarOnboardingConcluido()` → `UPDATE perfis SET onboarding_concluido = TRUE`
4. ✅ Dashboard verifica `perfil.onboarding_concluido` antes de mostrar banner

## Comportamento Corrigido
- Banner some quando `onboarding_concluido = TRUE`
- Persiste após reload/logout/outros dispositivos
- Respeita módulos "Não utilizo"
- Não reaparece após conclusão
