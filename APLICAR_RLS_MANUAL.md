# APLICAR CORRIGIR_RLS_DEV.sql MANUALMENTE (2 minutos)

## Status
- ✅ Tabelas `faturas_cartao` e `pagamentos_fatura` criadas
- ✅ Funções e triggers criados
- ❌ **Policies RLS ausentes** (causa: permission denied)

## Executar AGORA

1. Acesse: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql
2. Abra o arquivo `CORRIGIR_RLS_DEV.sql`
3. Copie TODO o conteúdo
4. Cole no SQL Editor
5. Clique **"Run"**

## Resultado esperado
```
Success. No rows returned.
```

## Após aplicar
Execute no terminal:
```bash
npm run dev
```

Faça login no app e teste:
- Adicionar fatura de cartão
- Registrar pagamento parcial/total
- Verificar histórico
- Validar limite liberado

## Sem isso
❌ Hook `usePagamentosFatura` falha com "permission denied"
❌ Página Cartões não carrega pagamentos
❌ Custo de Vida incompleto

## Automação futura
Aguardando autorização para configurar MCP oficial do Supabase.
