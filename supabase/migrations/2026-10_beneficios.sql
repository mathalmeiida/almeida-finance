-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- BENEFÍCIOS: Vale-Refeição (VR) e Vale-Alimentação (VA)
--
-- Controle dos benefícios de alimentação SEPARADO do dinheiro em conta:
--   • "beneficios"               → um cartão/benefício por linha (VR ou VA).
--   • "beneficios_movimentacoes" → extrato (compra, recarga, ajuste, estorno).
-- O saldo é derivado no app a partir das movimentações (fonte única), então
-- NÃO há coluna de saldo materializada (evita divergência). O saldo não
-- utilizado acumula naturalmente (nada zera entre meses).
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO e idempotente:
--   • CREATE TABLE/INDEX IF NOT EXISTS; policies criadas só se faltarem.
--   • NÃO usa DROP; NÃO altera nem apaga tabelas/dados existentes.
--   • NÃO toca em perfis, receitas, despesas, cartões, metas, RLS existente.
--   • Totalmente isolado do saldo bancário / limite diário / resultado do mês.
-- ============================================================


-- ------------------------------------------------------------
-- TABELA: beneficios
-- Um benefício (cartão/operadora) de VR ou VA do usuário.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficios (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome               TEXT NOT NULL,                 -- ex.: "Alelo", "VR Benefícios"
  tipo               TEXT NOT NULL CHECK (tipo IN ('VR','VA')),
  -- Saldo informado na criação (vira a 1ª movimentação de recarga/ajuste no app).
  saldo_inicial      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  -- Recarga mensal recorrente (opcional).
  recarga_valor      NUMERIC(12,2) DEFAULT 0 CHECK (recarga_valor IS NULL OR recarga_valor >= 0),
  recarga_dia        INTEGER CHECK (recarga_dia IS NULL OR recarga_dia BETWEEN 1 AND 31),
  recarga_recorrente BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.beneficios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_beneficios_usuario ON public.beneficios (usuario_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='beneficios'
      AND policyname='Benefícios: dono gerencia') THEN
    CREATE POLICY "Benefícios: dono gerencia"
      ON public.beneficios FOR ALL
      USING (auth.uid() = usuario_id)
      WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;


-- ------------------------------------------------------------
-- TABELA: beneficios_movimentacoes
-- Extrato do benefício. O SALDO é a soma assinada destas linhas:
--   recarga / estorno / ajuste(+)  → entram no saldo (valor positivo)
--   compra  / ajuste(−)            → saem do saldo
-- Para simplicidade e robustez, guardamos "valor" SEMPRE positivo e um "tipo";
-- o sinal é aplicado no app conforme o tipo. "competencia" ('YYYY-MM') marca o
-- mês da recarga para impedir recarga automática duplicada no mesmo mês.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beneficios_movimentacoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  beneficio_id  UUID NOT NULL REFERENCES public.beneficios(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN ('compra','recarga','ajuste','estorno')),
  descricao     TEXT,
  valor         NUMERIC(12,2) NOT NULL CHECK (valor >= 0),
  data          DATE NOT NULL,
  -- Competência ('YYYY-MM') usada só para recargas automáticas (evita duplicar
  -- a recarga do mês). NULL para compras/ajustes/estornos manuais.
  competencia   TEXT CHECK (competencia IS NULL OR competencia ~ '^[0-9]{4}-[0-9]{2}$'),
  -- Marca se a recarga foi gerada automaticamente (recorrência) ou manual.
  automatica    BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.beneficios_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_benef_mov_usuario   ON public.beneficios_movimentacoes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_benef_mov_beneficio ON public.beneficios_movimentacoes (beneficio_id, data DESC);

-- PROTEÇÃO CONTRA RECARGA DUPLICADA: no máximo UMA recarga automática por
-- (benefício, competência). Índice único PARCIAL — só vale para recargas
-- automáticas COM competência preenchida; compras/ajustes/estornos e recargas
-- manuais não são afetados. "competencia IS NOT NULL" garante que o índice não
-- considere linhas com competência nula (em que o UNIQUE seria inócuo e poderia
-- confundir a leitura da regra).
CREATE UNIQUE INDEX IF NOT EXISTS uq_benef_recarga_auto_mes
  ON public.beneficios_movimentacoes (beneficio_id, competencia)
  WHERE tipo = 'recarga' AND automatica = TRUE AND competencia IS NOT NULL;

-- ------------------------------------------------------------
-- CHECKS de competência (adicionados via ALTER para valer também em bancos onde
-- a tabela já existia). Idempotentes: criados só se ainda não existirem.
--   (1) FORMATO + MÊS VÁLIDO: 'YYYY-MM' com mês entre 01 e 12 (quando não nula).
--       O regex ^[0-9]{4}-(0[1-9]|1[0-2])$ exige mês 01..12.
--   (2) RECARGA AUTOMÁTICA EXIGE COMPETÊNCIA: se tipo='recarga' e automatica,
--       competencia NÃO pode ser nula (sustenta o índice único anti-duplicação).
-- Preservam dados: as linhas gravadas pelo app já atendem (recarga automática
-- sempre com 'YYYY-MM' válido). Se houver dado legado inválido, o ADD falha e
-- aponta a linha a corrigir — nenhum dado é apagado.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.beneficios_movimentacoes'::regclass
      AND conname = 'beneficios_mov_competencia_formato'
  ) THEN
    ALTER TABLE public.beneficios_movimentacoes
      ADD CONSTRAINT beneficios_mov_competencia_formato
      CHECK (competencia IS NULL OR competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.beneficios_movimentacoes'::regclass
      AND conname = 'beneficios_mov_recarga_auto_exige_competencia'
  ) THEN
    ALTER TABLE public.beneficios_movimentacoes
      ADD CONSTRAINT beneficios_mov_recarga_auto_exige_competencia
      CHECK (NOT (tipo = 'recarga' AND automatica = TRUE) OR competencia IS NOT NULL);
  END IF;
END $$;

-- ------------------------------------------------------------
-- RLS de beneficios_movimentacoes (corrigida)
-- A política ANTERIOR validava apenas usuario_id = auth.uid(), o que NÃO impede
-- um usuário de vincular uma movimentação a um beneficio_id de OUTRO usuário
-- (bastaria enviar o próprio usuario_id + um beneficio_id alheio). Agora, além
-- de usuario_id = auth.uid(), exigimos que o BENEFÍCIO referenciado também
-- pertença ao usuário autenticado (EXISTS em public.beneficios). A verificação
-- vale em SELECT (USING), INSERT (WITH CHECK), UPDATE (USING + WITH CHECK) e
-- DELETE (USING). Políticas separadas por operação para o controle ser explícito.
--
-- Função auxiliar inline via EXISTS (sem SECURITY DEFINER): como a própria RLS
-- de "beneficios" restringe cada usuário aos seus benefícios, o EXISTS só
-- enxerga benefícios do próprio usuário — reforço coerente da propriedade.
DO $$
BEGIN
  -- Remove a política antiga (abrangente demais), se existir. DROP de política
  -- não afeta dados — apenas regras de acesso. Idempotente.
  DROP POLICY IF EXISTS "Movimentações: dono gerencia" ON public.beneficios_movimentacoes;

  -- SELECT
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='beneficios_movimentacoes'
      AND policyname='Movimentações: ver (dono + benefício do dono)') THEN
    CREATE POLICY "Movimentações: ver (dono + benefício do dono)"
      ON public.beneficios_movimentacoes FOR SELECT
      USING (
        auth.uid() = usuario_id
        AND EXISTS (
          SELECT 1 FROM public.beneficios b
          WHERE b.id = beneficio_id AND b.usuario_id = auth.uid()
        )
      );
  END IF;

  -- INSERT
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='beneficios_movimentacoes'
      AND policyname='Movimentações: inserir (dono + benefício do dono)') THEN
    CREATE POLICY "Movimentações: inserir (dono + benefício do dono)"
      ON public.beneficios_movimentacoes FOR INSERT
      WITH CHECK (
        auth.uid() = usuario_id
        AND EXISTS (
          SELECT 1 FROM public.beneficios b
          WHERE b.id = beneficio_id AND b.usuario_id = auth.uid()
        )
      );
  END IF;

  -- UPDATE (linha atual precisa ser do dono E a linha resultante também —
  -- impede "mover" a movimentação para um benefício de terceiro).
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='beneficios_movimentacoes'
      AND policyname='Movimentações: atualizar (dono + benefício do dono)') THEN
    CREATE POLICY "Movimentações: atualizar (dono + benefício do dono)"
      ON public.beneficios_movimentacoes FOR UPDATE
      USING (
        auth.uid() = usuario_id
        AND EXISTS (
          SELECT 1 FROM public.beneficios b
          WHERE b.id = beneficio_id AND b.usuario_id = auth.uid()
        )
      )
      WITH CHECK (
        auth.uid() = usuario_id
        AND EXISTS (
          SELECT 1 FROM public.beneficios b
          WHERE b.id = beneficio_id AND b.usuario_id = auth.uid()
        )
      );
  END IF;

  -- DELETE
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='beneficios_movimentacoes'
      AND policyname='Movimentações: apagar (dono + benefício do dono)') THEN
    CREATE POLICY "Movimentações: apagar (dono + benefício do dono)"
      ON public.beneficios_movimentacoes FOR DELETE
      USING (
        auth.uid() = usuario_id
        AND EXISTS (
          SELECT 1 FROM public.beneficios b
          WHERE b.id = beneficio_id AND b.usuario_id = auth.uid()
        )
      );
  END IF;
END $$;

-- NOTA sobre dupla contagem do SALDO INICIAL:
-- O "saldo_inicial" do benefício é apenas um VALOR DE REFERÊNCIA na tabela
-- "beneficios". O saldo real é derivado SOMENTE das linhas de
-- "beneficios_movimentacoes". O app lança o saldo inicial como UMA única
-- movimentação de recarga ("Saldo inicial") no momento do cadastro; o campo
-- "beneficios.saldo_inicial" NÃO é somado ao saldo em nenhum cálculo. Portanto
-- não há dupla contagem. (Nada a alterar no schema — observação de garantia.)

-- ------------------------------------------------------------
-- DIAGNÓSTICO (NÃO destrutivo) — políticas RLS existentes.
-- Lista as políticas das duas tabelas e AVISA (RAISE NOTICE) sobre qualquer uma
-- fora do conjunto esperado por esta migration. NÃO apaga nada: políticas
-- desconhecidas podem ser legítimas (criadas por outra migration/manualmente).
-- Revise os avisos na aba "Messages/Notices" do SQL Editor após o Run.
--
-- Esperadas:
--   beneficios:
--     • "Benefícios: dono gerencia" (FOR ALL)
--   beneficios_movimentacoes:
--     • "Movimentações: ver (dono + benefício do dono)"      (SELECT)
--     • "Movimentações: inserir (dono + benefício do dono)"  (INSERT)
--     • "Movimentações: atualizar (dono + benefício do dono)"(UPDATE)
--     • "Movimentações: apagar (dono + benefício do dono)"   (DELETE)
-- Qualquer política PERMISSIVE adicional (ou a antiga "Movimentações: dono
-- gerencia", que esta migration remove) é sinalizada para revisão manual.
DO $$
DECLARE
  r RECORD;
  esperadas_benef   TEXT[] := ARRAY['Benefícios: dono gerencia'];
  esperadas_movs    TEXT[] := ARRAY[
    'Movimentações: ver (dono + benefício do dono)',
    'Movimentações: inserir (dono + benefício do dono)',
    'Movimentações: atualizar (dono + benefício do dono)',
    'Movimentações: apagar (dono + benefício do dono)'
  ];
  achou_extra BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '--- Diagnóstico RLS: benefícios ---';
  FOR r IN
    SELECT tablename, policyname, cmd, permissive
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('beneficios','beneficios_movimentacoes')
    ORDER BY tablename, cmd, policyname
  LOOP
    RAISE NOTICE 'policy: %.% | cmd=% | permissive=%',
      r.tablename, r.policyname, r.cmd, r.permissive;

    IF r.tablename = 'beneficios' AND NOT (r.policyname = ANY(esperadas_benef)) THEN
      achou_extra := TRUE;
      RAISE NOTICE '  >> ATENÇÃO: política NÃO esperada em beneficios: "%". Revisar manualmente (não removida).', r.policyname;
    ELSIF r.tablename = 'beneficios_movimentacoes' AND NOT (r.policyname = ANY(esperadas_movs)) THEN
      achou_extra := TRUE;
      RAISE NOTICE '  >> ATENÇÃO: política NÃO esperada em beneficios_movimentacoes: "%". Revisar manualmente (não removida).', r.policyname;
    END IF;
  END LOOP;

  IF achou_extra THEN
    RAISE NOTICE '>>> Há política(s) RLS fora do conjunto esperado. NENHUMA foi excluída automaticamente. Revise acima e decida manualmente.';
  ELSE
    RAISE NOTICE '>>> Nenhuma política RLS inesperada encontrada nas tabelas de benefícios.';
  END IF;
END $$;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
