-- ============================================================
-- IMPORTAÇÃO INTELIGENTE — histórico e chaves de duplicidade
-- Data: 06/11/2026 · Parte C
-- ============================================================
-- importacoes:       um registro por arquivo importado (resumo).
-- importacoes_itens: um registro por lançamento gravado, com a CHAVE de
--                    duplicidade (hash; não guarda descrição nem valor) e o
--                    registro criado (tabela + id).
--
-- Os lançamentos continuam nas tabelas existentes (receitas, despesas,
-- compras_cartao, investimentos_movimentacoes). Nenhum arquivo é guardado.
--
-- Segurança:
--   • RLS: cada usuário só lê/insere/apaga o próprio histórico.
--   • FK composta (importacao_id, usuario_id) impede vincular item à
--     importação de outro usuário.
--   • UNIQUE (usuario_id, chave) impede gravar o mesmo lançamento duas vezes.
--   • Sem UPDATE, sem SECURITY DEFINER.
-- Idempotente. Aplicar primeiro em STAGING; produção só com autorização.
-- Sem esta migration a importação funciona; só não guarda histórico (a
-- detecção de duplicidade usa os lançamentos já cadastrados).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.importacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contexto        TEXT NOT NULL CHECK (contexto IN ('extrato', 'fatura', 'investimentos')),
  origem          TEXT CHECK (char_length(origem) <= 120),
  formato         TEXT NOT NULL CHECK (formato IN ('csv', 'ofx', 'xlsx', 'xls', 'pdf')),
  periodo_inicio  DATE,
  periodo_fim     DATE,
  qtd_lidas       INTEGER NOT NULL DEFAULT 0 CHECK (qtd_lidas >= 0),
  qtd_importadas  INTEGER NOT NULL DEFAULT 0 CHECK (qtd_importadas >= 0),
  qtd_ignoradas   INTEGER NOT NULL DEFAULT 0 CHECK (qtd_ignoradas >= 0),
  status          TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida', 'parcial')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT importacoes_id_usuario_unico UNIQUE (id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.importacoes_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id   UUID NOT NULL,
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chave           TEXT NOT NULL CHECK (char_length(chave) BETWEEN 4 AND 40),
  destino_tabela  TEXT NOT NULL CHECK (destino_tabela IN ('receitas', 'despesas', 'compras_cartao', 'investimentos_movimentacoes')),
  destino_id      UUID,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT importacoes_itens_importacao_fk FOREIGN KEY (importacao_id, usuario_id)
    REFERENCES public.importacoes (id, usuario_id) ON DELETE CASCADE,
  CONSTRAINT importacoes_itens_chave_unica UNIQUE (usuario_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_importacoes_usuario ON public.importacoes (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_importacoes_itens_importacao ON public.importacoes_itens (importacao_id);

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_itens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes' AND policyname = 'importacoes_select_proprio') THEN
    CREATE POLICY importacoes_select_proprio ON public.importacoes FOR SELECT USING (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes' AND policyname = 'importacoes_insert_proprio') THEN
    CREATE POLICY importacoes_insert_proprio ON public.importacoes FOR INSERT WITH CHECK (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes' AND policyname = 'importacoes_delete_proprio') THEN
    CREATE POLICY importacoes_delete_proprio ON public.importacoes FOR DELETE USING (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes_itens' AND policyname = 'importacoes_itens_select_proprio') THEN
    CREATE POLICY importacoes_itens_select_proprio ON public.importacoes_itens FOR SELECT USING (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes_itens' AND policyname = 'importacoes_itens_insert_proprio') THEN
    CREATE POLICY importacoes_itens_insert_proprio ON public.importacoes_itens FOR INSERT WITH CHECK (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'importacoes_itens' AND policyname = 'importacoes_itens_delete_proprio') THEN
    CREATE POLICY importacoes_itens_delete_proprio ON public.importacoes_itens FOR DELETE USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- Produção concede ALL por padrão (incl. UPDATE e TRUNCATE) a anon e authenticated
-- em tabelas novas: reduz ao necessário (o TRUNCATE ignoraria a RLS).
REVOKE ALL ON TABLE public.importacoes, public.importacoes_itens FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.importacoes, public.importacoes_itens TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VALIDAÇÃO
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('importacoes','importacoes_itens');
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('importacoes','importacoes_itens');
--
-- ROLLBACK (apaga só o histórico; os lançamentos importados permanecem):
-- DROP TABLE IF EXISTS public.importacoes_itens;
-- DROP TABLE IF EXISTS public.importacoes;
-- ============================================================
