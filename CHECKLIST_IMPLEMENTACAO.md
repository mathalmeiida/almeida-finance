# ✅ Checklist de Implementação

## 📋 Etapa 1: Verificação dos Arquivos (CONCLUÍDO)

- [x] `PLANO_CORRECAO_FATURAS_CUSTO_VIDA.md` (6.6 KB)
- [x] `IMPLEMENTACAO_COMPLETA.md` (10.5 KB)
- [x] `RESUMO_EXECUTIVO.md` (8.7 KB)
- [x] `supabase/migrations/2026-01_sistema_pagamento_faturas.sql` (9.8 KB)
- [x] `src/hooks/usePagamentosFatura.js` (11.2 KB)
- [x] `src/hooks/useCustoDeVida.js` (11.6 KB)
- [x] `src/components/ModalPagamentoFatura.jsx` (10.0 KB)
- [x] `src/components/HistoricoPagamentos.jsx` (10.1 KB)
- [x] `src/pages/CustoDeVida.jsx` (17.3 KB)

**Total: 9 arquivos criados | 95.2 KB de código**

---

## 🚀 Etapa 2: Aplicar Migration no DEV

### Passo a Passo:

1. [ ] Abrir: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
2. [ ] Clicar em: "New Query"
3. [ ] Abrir arquivo: `supabase/migrations/2026-01_sistema_pagamento_faturas.sql`
4. [ ] Copiar TODO o conteúdo (Ctrl+A, Ctrl+C)
5. [ ] Colar no SQL Editor do Supabase (Ctrl+V)
6. [ ] Clicar em: "Run" (ou Ctrl+Enter)
7. [ ] Aguardar conclusão (deve aparecer "Success" em verde)
8. [ ] Verificar se não há erros vermelhos

### Verificação Pós-Migration:

```sql
-- Executar no SQL Editor para confirmar:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'pagamentos_fatura';

-- Deve retornar 1 linha: pagamentos_fatura
```

---

## 🔧 Etapa 3: Integrar em Cartoes.jsx

### 3.1 Adicionar Imports

**Localização:** Topo do arquivo `src/pages/Cartoes.jsx` (linha ~10)

**Adicionar:**
```javascript
import ModalPagamentoFatura from '../components/ModalPagamentoFatura'
import HistoricoPagamentos from '../components/HistoricoPagamentos'
import { usePagamentosFatura } from '../hooks/usePagamentosFatura'
import { DollarSign } from 'lucide-react'
```

### 3.2 Adicionar Hook no Componente VerFatura

**Localização:** Dentro da função `VerFatura`, após os hooks existentes (linha ~425)

**Adicionar:**
```javascript
// Hook de pagamentos
const { 
  registrarPagamento, 
  estornarPagamento, 
  buscarResumoFatura,
  calcularLimiteDisponivel 
} = usePagamentosFatura(faturaInformada?.id)

const [modalPagamento, setModalPagamento] = useState(false)
const [resumoPagamentos, setResumoPagamentos] = useState(null)

// Carregar resumo de pagamentos ao abrir fatura
useEffect(() => {
  if (faturaInformada?.id) {
    buscarResumoFatura(faturaInformada.id)
      .then(setResumoPagamentos)
      .catch(() => setResumoPagamentos(null))
  }
}, [faturaInformada?.id, buscarResumoFatura])

// Handler de pagamento
async function handleRegistrarPagamento(dados) {
  setSalvandoFatura(true)
  setErro('')
  try {
    await registrarPagamento(dados)
    setModalPagamento(false)
    // Recarregar resumo
    const novoResumo = await buscarResumoFatura(faturaInformada.id)
    setResumoPagamentos(novoResumo)
  } catch (err) {
    setErro(err.message || 'Erro ao registrar pagamento')
  } finally {
    setSalvandoFatura(false)
  }
}

// Handler de estorno
async function handleEstornarPagamento(pagamentoId, motivo) {
  setSalvandoFatura(true)
  setErro('')
  try {
    await estornarPagamento(pagamentoId, motivo)
    // Recarregar resumo
    const novoResumo = await buscarResumoFatura(faturaInformada.id)
    setResumoPagamentos(novoResumo)
  } catch (err) {
    setErro(err.message || 'Erro ao estornar pagamento')
  } finally {
    setSalvandoFatura(false)
  }
}
```

### 3.3 Substituir Botão de Pagamento

**Localização:** Linha ~570 (procurar por "Marcar fatura como paga")

**REMOVER:**
```javascript
{faturaInformada && (
  <button type="button" disabled={salvandoFatura} onClick={async () => {
    try {
      setSalvandoFatura(true)
      setErro('')
      await marcarFaturaPaga(faturaInformada.id, !faturaEstaPaga)
    } catch (err) { setErro(err.message || 'Erro ao atualizar pagamento') }
    finally { setSalvandoFatura(false) }
  }} className="btn-secondary inline-flex items-center justify-center gap-2">
    <CheckCircle2 size={16} /> {salvandoFatura ? 'Salvando...' : faturaEstaPaga ? 'Desfazer pagamento' : 'Marcar fatura como paga'}
  </button>
)}
```

**SUBSTITUIR POR:**
```javascript
{faturaInformada && (
  <>
    {/* Botão de pagamento */}
    <button 
      type="button" 
      onClick={() => setModalPagamento(true)}
      disabled={resumoPagamentos?.quitada}
      className={`inline-flex items-center gap-2 ${
        resumoPagamentos?.quitada 
          ? 'btn-secondary opacity-50 cursor-not-allowed' 
          : 'btn-primary'
      }`}
    >
      <DollarSign size={16} />
      {resumoPagamentos?.quitada ? 'Fatura quitada' : 'Registrar pagamento'}
    </button>

    {/* Resumo de pagamentos (se houver) */}
    {resumoPagamentos && resumoPagamentos.valorPagoAcumulado > 0 && (
      <div className="card bg-emerald-50 border-emerald-200 mt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-emerald-600">Valor pago até agora</p>
            <p className="text-lg font-bold text-emerald-900 mt-0.5">
              {formatCurrency(resumoPagamentos.valorPagoAcumulado)}
            </p>
            <p className="text-xs text-emerald-600 mt-1">
              {resumoPagamentos.percentualPago}% da fatura • 
              Faltam {formatCurrency(resumoPagamentos.valorRestante)}
            </p>
          </div>
          {resumoPagamentos.quitada && (
            <CheckCircle2 size={32} className="text-emerald-600" />
          )}
        </div>
      </div>
    )}

    {/* Histórico de pagamentos */}
    {resumoPagamentos?.pagamentos?.length > 0 && (
      <div className="mt-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          Histórico de pagamentos
        </h3>
        <HistoricoPagamentos
          pagamentos={resumoPagamentos.pagamentos}
          onEstornar={handleEstornarPagamento}
          carregando={salvandoFatura}
        />
      </div>
    )}

    {/* Modal de pagamento */}
    <ModalPagamentoFatura
      aberto={modalPagamento}
      onFechar={() => setModalPagamento(false)}
      onSalvar={handleRegistrarPagamento}
      carregando={salvandoFatura}
      fatura={faturaInformada}
      limiteCartao={Number(cartao.limite_total)}
      erro={erro}
    />
  </>
)}
```

**Checklist:**
- [ ] Imports adicionados
- [ ] Hook `usePagamentosFatura` inicializado
- [ ] Handlers criados (`handleRegistrarPagamento`, `handleEstornarPagamento`)
- [ ] Botão antigo removido
- [ ] Novo sistema de pagamentos integrado

---

## 🌐 Etapa 4: Adicionar Rota Custo de Vida

**Arquivo:** `src/App.jsx`

**Localização:** Dentro do `<Routes>`, junto com as outras rotas (linha ~100)

**Adicionar import no topo:**
```javascript
import CustoDeVida from './pages/CustoDeVida'
```

**Adicionar rota:**
```javascript
<Route path="/custo-de-vida" element={<CustoDeVida />} />
```

**Checklist:**
- [ ] Import adicionado
- [ ] Rota criada

---

## 📊 Etapa 5: Adicionar Card no Dashboard

**Arquivo:** `src/pages/Dashboard.jsx`

**Localização:** No topo, adicionar imports:
```javascript
import { useCustoDeVida } from '../hooks/useCustoDeVida'
import { UtensilsCrossed } from 'lucide-react'
```

**Dentro do componente Dashboard, adicionar:**
```javascript
const { custoMesAtual, carregando: carregandoCusto } = useCustoDeVida(anoAtual, mesAtual)
```

**No grid de cards (linha ~200), adicionar:**
```javascript
<Link 
  to="/custo-de-vida" 
  className="card hover:ring-2 hover:ring-marca/30 transition-all"
>
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm font-medium text-gray-500">Custo de Vida</span>
    <UtensilsCrossed size={18} className="text-marca" />
  </div>
  {carregandoCusto ? (
    <Loader2 size={20} className="animate-spin text-marca" />
  ) : custoMesAtual?.temDados ? (
    <>
      <p className="text-2xl font-bold text-gray-900">
        {formatCurrency(custoMesAtual.total)}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        Despesas essenciais do mês
      </p>
    </>
  ) : (
    <p className="text-sm text-gray-400">Sem dados suficientes</p>
  )}
</Link>
```

**Checklist:**
- [ ] Import do hook adicionado
- [ ] Hook inicializado
- [ ] Card criado no grid

---

## 🧪 Etapa 6: Testes Manuais

### Teste 1: Pagamento Parcial
1. [ ] Abrir uma fatura no sistema
2. [ ] Clicar em "Registrar pagamento"
3. [ ] Pagar 40% do valor total
4. [ ] Verificar:
   - [ ] Aparece resumo "Valor pago até agora: 40%"
   - [ ] Histórico mostra o pagamento
   - [ ] Fatura ainda não está quitada
5. [ ] Verificar limite do cartão:
   - [ ] Deve ter aumentado proporcionalmente

### Teste 2: Pagamento Total
1. [ ] Pagar o valor restante da fatura
2. [ ] Verificar:
   - [ ] Aparece "Fatura quitada" com ícone verde
   - [ ] Botão muda para "Fatura quitada" (desabilitado)
   - [ ] Limite do cartão totalmente liberado

### Teste 3: Estorno
1. [ ] No histórico, clicar em "Estornar"
2. [ ] Adicionar motivo (opcional)
3. [ ] Confirmar
4. [ ] Verificar:
   - [ ] Pagamento move para seção "Estornados"
   - [ ] Valor pago acumulado reduzido
   - [ ] Limite recalculado

### Teste 4: Custo de Vida
1. [ ] Acessar `/custo-de-vida`
2. [ ] Verificar:
   - [ ] Total = soma de despesas + cartões do mês
   - [ ] Categorias corretas (Alimentação, Moradia, etc)
   - [ ] Gráficos renderizados
   - [ ] Comparação com média histórica funciona
3. [ ] Clicar em uma categoria
4. [ ] Verificar modal com detalhes

### Teste 5: Sem Dados
1. [ ] Navegar para mês sem lançamentos
2. [ ] Verificar mensagem: "Dados insuficientes"
3. [ ] Botão "Registrar despesa" presente

---

## ✅ Critérios de Aceitação Final

### Sistema de Pagamentos
- [ ] Pagamento parcial libera limite proporcionalmente
- [ ] Pagamento total quita a fatura
- [ ] Estorno reverte pagamento e limite
- [ ] Histórico preservado (não deleta)
- [ ] Validações funcionam (não permite pagar > restante)
- [ ] Interface clara e intuitiva

### Custo de Vida
- [ ] Calcula apenas com dados reais
- [ ] Mostra "Insuficiente" quando não há dados
- [ ] Categorias mapeadas corretamente
- [ ] Gráficos funcionais
- [ ] Comparação histórica precisa
- [ ] Performance adequada (< 1s)

### Geral
- [ ] Sem erros no console
- [ ] Build sem warnings críticos
- [ ] RLS funcionando (cada usuário vê só seus dados)
- [ ] Mobile responsivo

---

## 🚨 Troubleshooting

### Erro: "Column pagamentos_fatura does not exist"
**Solução:** Migration não foi aplicada. Voltar ao Passo 2.

### Erro: "Cannot read property 'id' of undefined"
**Solução:** Verificar se `faturaInformada` existe antes de chamar hook.

### Erro: Build falha no Vite
**Solução:** Executar:
```bash
npm cache clean --force
rmdir /s /q node_modules
del package-lock.json
npm install
npm run build
```

### Gráficos não aparecem
**Solução:** Instalar recharts:
```bash
npm install recharts
```

---

## 📞 Próximos Passos Após Testes

1. [ ] Corrigir bugs encontrados
2. [ ] Ajustar UI conforme feedback
3. [ ] Validar performance com dados reais
4. [ ] Obter aprovação final
5. [ ] **NÃO publicar em produção sem aprovação explícita**

---

**Status:** ⏳ Aguardando execução das etapas 2-6
**Ambiente:** DEV (gxfcfpdwyjqcrfssxgbi)
**Próxima ação:** Aplicar migration no Supabase DEV
