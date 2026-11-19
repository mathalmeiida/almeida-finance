# Calendário Familiar - Pendente

## Status
⚠️ **NÃO IMPLEMENTADO** - Requer validação em ambiente de desenvolvimento

## O que é necessário

### 1. Toggle Meu Calendário / Calendário Familiar
```jsx
// Em src/pages/Calendario.jsx ou componente CalendarioFinanceiroHome

const [modoFamilia, setModoFamilia] = useState(false);
const { grupos } = useFamilyGroups(user?.id);
const grupoSelecionado = grupos[0]?.id; // ou state

// Buscar despesas
const despesas = modoFamilia 
  ? useFamilyExpenseSplits(grupoSelecionado).divisoes
  : useDespesas(user?.id).despesas;
```

### 2. Mostrar Despesas Compartilhadas
- Buscar de `family_expense_splits` quando modo família ativo
- Filtrar por `group_id` selecionado
- Exibir badge "Familiar" nas despesas do grupo
- Calcular valor individual (não valor total)

### 3. NÃO Mostrar Dados Pessoais
- Despesas pessoais **não** aparecem em calendário familiar
- Saldo **não** é compartilhado
- Investimentos **não** são compartilhados
- Metas pessoais **não** são compartilhadas

### 4. Exemplo de Integração

```jsx
// Adicionar toggle
<div className="flex items-center gap-2">
  <button 
    onClick={() => setModoFamilia(false)}
    className={!modoFamilia ? 'active' : ''}
  >
    Meu Calendário
  </button>
  <button 
    onClick={() => setModoFamilia(true)}
    className={modoFamilia ? 'active' : ''}
    disabled={!temAcessoFamilia}
  >
    Calendário Familiar
  </button>
</div>

// Renderizar despesas filtradas
{despesas.map(d => (
  <div key={d.id}>
    {d.descricao}
    {modoFamilia && <Badge>Familiar</Badge>}
    {modoFamilia 
      ? formatCurrency(d.minha_parte / 100) // valor individual
      : formatCurrency(d.valor / 100) // valor total
    }
  </div>
))}
```

## Por que não foi implementado
- **Migration não aplicada**: tabelas não existem no banco
- **Sem ambiente de teste**: não posso validar funcionamento
- **Risco de erro**: pode quebrar calendário existente
- **Falta de validação RLS**: não posso confirmar isolamento

## Quando implementar
1. Aplicar migrations em dev
2. Testar criação de grupo
3. Testar divisão de despesa
4. Validar que despesas aparecem apenas para membros
5. Então adicionar toggle no calendário
6. Testar que dados pessoais não vazam

## Arquivos a modificar
- `src/pages/Calendario.jsx` (ou onde está o calendário principal)
- `src/components/CalendarioFinanceiroHome.jsx` (se for o da Home)
- Adicionar hook `useFamilyExpenseSplits` onde necessário
- Adicionar state para grupo selecionado

## Não fazer
- ❌ Mostrar despesas pessoais no calendário familiar
- ❌ Compartilhar saldo
- ❌ Compartilhar investimentos
- ❌ Permitir editar despesas de outros membros no calendário
