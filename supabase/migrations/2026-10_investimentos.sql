-- ============================================================
-- Migration: Investimentos (patrimônio) + movimentações + reserva vinculada
-- ============================================================
-- Base para a aba Investimentos e o card "Meu Patrimônio". NÃO altera nada do
-- fluxo atual (saldo, limite diário, despesas, receitas, cartão, VR/VA,
-- projeção). O patrimônio investido é SEPARADO do saldo disponível — nenhuma
-- destas tabelas é lida pelo useProjecao. RLS igual às demais (dono-only).
--
-- Pré-requisito: a tabela public.perfis já existe (ver schema.sql). A coluna
-- perfis.reserva_atual é PRESERVADA integralmente (não é lida nem alterada
-- aqui); apenas adicionamos perfis.reserva_modo.
--
-- SEGURO e idempotente: CREATE TABLE/INDEX/POLICY IF NOT EXISTS, ADD COLUMN
-- IF NOT EXISTS, constraints adicionadas só se faltarem. NÃO apaga nem altera
-- dados existentes. NÃO executar automaticamente.
-- ------------------------------------------------------------

-- 1) Investimentos (posições da carteira)
CREATE TABLE IF NOT EXISTS public.investimentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  instituicao     TEXT,
  -- Categoria do produto (livre, validada no app):
  --   tesouro | cdb | lci | lca | acoes | fii | etf | fundo | previdencia | outro
  categoria       TEXT NOT NULL,
  data_aplicacao  DATE,
  valor_aplicado  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_aplicado >= 0),
  -- Quantidade/preço (quando aplicável: ações, FII, ETF, fundos)
  quantidade      NUMERIC(18,6),
  preco_unitario  NUMERIC(14,4),
  -- Valor atual informado pelo usuário (fonte única do saldo da posição).
  valor_atual     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_atual >= 0),
  -- Renda fixa (opcionais, apenas informativos):
  taxa_contratada TEXT,      -- ex.: "12% a.a." ou "110% CDI" (texto livre)
  indexador       TEXT,      -- ex.: CDI | IPCA | PREFIXADO | SELIC
  vencimento      DATE,
  liquidez        TEXT,      -- ex.: diaria | no_vencimento | D+30
  objetivo        TEXT,
  -- Participação na RESERVA de emergência (modo vinculado).
  --   reserva_valor = quanto DESTA posição compõe a reserva (0 = não compõe,
  --   pode ser parte OU o valor integral). NÃO duplica patrimônio: o patrimônio
  --   total conta valor_atual uma vez; a reserva vinculada soma apenas
  --   reserva_valor. Nunca pode exceder valor_atual (CHECK rejeita; o app
  --   mostra mensagem clara — não há ajuste silencioso).
  reserva_valor   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (reserva_valor >= 0),
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  -- Necessária para a FK COMPOSTA das movimentações (garante que o dono da
  -- movimentação é o mesmo dono do investimento).
  CONSTRAINT investimentos_id_usuario_unico UNIQUE (id, usuario_id),
  CONSTRAINT investimentos_reserva_nao_excede_saldo CHECK (reserva_valor <= valor_atual)
);

ALTER TABLE public.investimentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_investimentos_usuario ON public.investimentos (usuario_id);

-- Retrocompat: se a tabela já existir sem a coluna/constraints, adiciona.
ALTER TABLE public.investimentos
  ADD COLUMN IF NOT EXISTS reserva_valor NUMERIC(14,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investimentos'::regclass
      AND conname = 'investimentos_reserva_valor_nao_neg'
  ) THEN
    ALTER TABLE public.investimentos
      ADD CONSTRAINT investimentos_reserva_valor_nao_neg CHECK (reserva_valor >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investimentos'::regclass
      AND conname = 'investimentos_reserva_nao_excede_saldo'
  ) THEN
    ALTER TABLE public.investimentos
      ADD CONSTRAINT investimentos_reserva_nao_excede_saldo CHECK (reserva_valor <= valor_atual);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investimentos'::regclass
      AND conname = 'investimentos_id_usuario_unico'
  ) THEN
    ALTER TABLE public.investimentos
      ADD CONSTRAINT investimentos_id_usuario_unico UNIQUE (id, usuario_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='investimentos'
      AND policyname='Usuário gerencia apenas os próprios investimentos') THEN
    CREATE POLICY "Usuário gerencia apenas os próprios investimentos"
      ON public.investimentos FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

-- 2) Movimentações do investimento (aporte, resgate, rendimento, dividendo,
--    juros, amortizacao). Diferenciar os tipos evita cálculos incorretos.
--    A FK COMPOSTA (investimento_id, usuario_id) -> investimentos(id, usuario_id)
--    garante, no nível do banco, que o usuário da movimentação é o PROPRIETÁRIO
--    do investimento associado (não dá para vincular a investimento de outro).
CREATE TABLE IF NOT EXISTS public.investimentos_movimentacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investimento_id UUID NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('aporte','resgate','rendimento','dividendo','juros','amortizacao')),
  valor           NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  data            DATE NOT NULL,
  descricao       TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT inv_mov_investimento_do_dono
    FOREIGN KEY (investimento_id, usuario_id)
    REFERENCES public.investimentos (id, usuario_id) ON DELETE CASCADE
);

ALTER TABLE public.investimentos_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_inv_mov_usuario ON public.investimentos_movimentacoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_investimento ON public.investimentos_movimentacoes (investimento_id, data DESC);

-- Retrocompat: se a tabela já existir com FK simples antiga, substitui pela
-- composta (garante dono = dono do investimento). Idempotente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investimentos_movimentacoes'::regclass
      AND conname = 'investimentos_movimentacoes_investimento_id_fkey'
  ) THEN
    ALTER TABLE public.investimentos_movimentacoes
      DROP CONSTRAINT investimentos_movimentacoes_investimento_id_fkey;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.investimentos_movimentacoes'::regclass
      AND conname = 'inv_mov_investimento_do_dono'
  ) THEN
    ALTER TABLE public.investimentos_movimentacoes
      ADD CONSTRAINT inv_mov_investimento_do_dono
      FOREIGN KEY (investimento_id, usuario_id)
      REFERENCES public.investimentos (id, usuario_id) ON DELETE CASCADE;
  END IF;
END $$;

-- RLS: além de usuario_id = dono, a movimentação deve pertencer a um
-- investimento do PRÓPRIO usuário (espelha o reforço de beneficios_movimentacoes).
-- Em UPDATE validamos o estado ANTERIOR (USING) e o RESULTANTE (WITH CHECK),
-- impedindo mover a movimentação para um investimento de terceiros.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='investimentos_movimentacoes'
      AND policyname='Inv. mov.: ver (dono + investimento do dono)') THEN
    CREATE POLICY "Inv. mov.: ver (dono + investimento do dono)"
      ON public.investimentos_movimentacoes FOR SELECT
      USING (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='investimentos_movimentacoes'
      AND policyname='Inv. mov.: inserir (dono + investimento do dono)') THEN
    CREATE POLICY "Inv. mov.: inserir (dono + investimento do dono)"
      ON public.investimentos_movimentacoes FOR INSERT
      WITH CHECK (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='investimentos_movimentacoes'
      AND policyname='Inv. mov.: atualizar (dono + investimento do dono)') THEN
    CREATE POLICY "Inv. mov.: atualizar (dono + investimento do dono)"
      ON public.investimentos_movimentacoes FOR UPDATE
      USING (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()))
      WITH CHECK (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='investimentos_movimentacoes'
      AND policyname='Inv. mov.: apagar (dono)') THEN
    CREATE POLICY "Inv. mov.: apagar (dono)"
      ON public.investimentos_movimentacoes FOR DELETE
      USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- 3) Modo da reserva de emergência no perfil: 'manual' (padrão, comportamento
--    atual, baseado em perfis.reserva_atual) ou 'vinculada' (soma de
--    investimentos.reserva_valor). perfis.reserva_atual é PRESERVADA: não é
--    lida nem modificada por esta migration. A troca de modo é confirmada no app.
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS reserva_modo TEXT NOT NULL DEFAULT 'manual'
    CHECK (reserva_modo IN ('manual','vinculada'));
