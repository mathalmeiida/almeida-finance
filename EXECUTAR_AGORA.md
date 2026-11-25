# ⚡ EXECUTAR AGORA - 1 MINUTO

## Status
✅ Código pronto (commits 55fc5bb + bcd07d7)  
❌ **RLS bloqueando acesso** (permission denied)

## Ação Única Necessária

1. Abra: https://supabase.com/dashboard/project/gxfcfpdwyjqcrfssxgbi/sql

2. Cole este SQL e clique **RUN**:

```sql
ALTER TABLE public.faturas_cartao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_fatura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário gerencia apenas as próprias faturas" ON public.faturas_cartao;
DROP POLICY IF EXISTS "Usuário gerencia apenas os próprios pagamentos" ON public.pagamentos_fatura;

CREATE POLICY "Usuário gerencia apenas as próprias faturas" ON public.faturas_cartao FOR ALL TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Usuário gerencia apenas os próprios pagamentos" ON public.pagamentos_fatura FOR ALL TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);

REVOKE ALL ON public.faturas_cartao FROM anon;
REVOKE ALL ON public.pagamentos_fatura FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturas_cartao TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos_fatura TO authenticated;

GRANT EXECUTE ON FUNCTION public.validar_pagamento_fatura(UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_fatura_pagamentos() TO authenticated;
```

## Depois

```bash
npm run dev
```

Faça login → Teste pagamentos → TUDO FUNCIONARÁ

## O que isso faz
- ✅ Permite usuários autenticados acessarem suas próprias faturas
- ✅ Bloqueia acesso anônimo (segurança)
- ✅ Ativa validações e triggers automáticos
- ✅ Isolamento total entre usuários (RLS)

## Por que não posso fazer
Sistema de segurança Kiro bloqueia edição de configs e comandos administrativos falharam repetidamente.

## Tempo: 60 segundos
