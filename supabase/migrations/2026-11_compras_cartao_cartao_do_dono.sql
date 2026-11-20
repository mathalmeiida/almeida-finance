-- ============================================================
-- Migration: compras_cartao só aceita cartão do PRÓPRIO usuário
-- ============================================================
-- Contexto: compras_cartao passou a ser a fonte única das compras no cartão
-- de crédito (aba Cartões, gasto rápido da Home e agora a aba Despesas). Cada
-- compra é UMA linha; parcelas são projetadas pelo app. Nenhuma operação do
-- app grava em mais de uma tabela para representar uma compra, por isso não
-- há RPC transacional aqui: o INSERT/UPDATE/DELETE de uma linha já é atômico.
--
-- Brecha fechada: as políticas anteriores validavam só usuario_id = auth.uid().
-- Um usuário podia gravar a PRÓPRIA compra apontando para o cartao_id de
-- OUTRA pessoa. Esta migration exige que o cartão pertença ao usuário, como
-- já é feito em despesas (2026-10_despesa_cartao_vinculo.sql).
--
-- Compatível com os dois esquemas existentes:
--   • produção (schema.sql): política única FOR ALL do dono;
--   • staging (3-POLITICAS-RLS.sql): 4 políticas, com leitura para admin e
--     consultor autorizado — a política de SELECT é PRESERVADA.
-- NÃO altera nem apaga linhas. DROP POLICY remove só a regra. Idempotente.
-- Aplicar primeiro no ambiente DEV/staging; nunca direto em produção.
-- ------------------------------------------------------------
ALTER TABLE public.compras_cartao ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Política antiga abrangente (produção): substituída por políticas por operação.
  DROP POLICY IF EXISTS "Usuário gerencia apenas as próprias compras de cartão" ON public.compras_cartao;
  -- Escrita do staging: recriada abaixo com a validação do cartão.
  DROP POLICY IF EXISTS compras_cartao_insert_policy ON public.compras_cartao;
  DROP POLICY IF EXISTS compras_cartao_update_policy ON public.compras_cartao;
  -- Reexecução desta migration.
  DROP POLICY IF EXISTS "Compras cartão: inserir (dono + cartão do dono)" ON public.compras_cartao;
  DROP POLICY IF EXISTS "Compras cartão: atualizar (dono + cartão do dono)" ON public.compras_cartao;

  -- SELECT do dono: só cria se ainda não houver uma política de leitura.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'compras_cartao' AND cmd = 'SELECT') THEN
    CREATE POLICY "Compras cartão: ver (dono)"
      ON public.compras_cartao FOR SELECT
      USING (auth.uid() = usuario_id);
  END IF;

  -- DELETE do dono: só cria se ainda não houver uma política de exclusão.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'compras_cartao' AND cmd = 'DELETE') THEN
    CREATE POLICY "Compras cartão: apagar (dono)"
      ON public.compras_cartao FOR DELETE
      USING (auth.uid() = usuario_id);
  END IF;

  CREATE POLICY "Compras cartão: inserir (dono + cartão do dono)"
    ON public.compras_cartao FOR INSERT
    WITH CHECK (
      auth.uid() = usuario_id
      AND EXISTS (SELECT 1 FROM public.cartoes c
                  WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
    );

  -- USING: a linha atual é do dono. WITH CHECK: a linha resultante continua
  -- do dono e não pode ser "movida" para o cartão de outra pessoa.
  CREATE POLICY "Compras cartão: atualizar (dono + cartão do dono)"
    ON public.compras_cartao FOR UPDATE
    USING (auth.uid() = usuario_id)
    WITH CHECK (
      auth.uid() = usuario_id
      AND EXISTS (SELECT 1 FROM public.cartoes c
                  WHERE c.id = cartao_id AND c.usuario_id = auth.uid())
    );
END $$;
