-- ============================================================
-- Migration: Vínculos (alocações) entre Metas e Investimentos
-- ============================================================
-- Permite alocar PARTE do valor_atual de um investimento a uma meta, de forma
-- OPCIONAL e sem duplicar patrimônio. Um investimento pode ser dividido entre
-- várias metas; uma meta pode receber vínculos de vários investimentos.
--
-- O que ESTA migration NÃO faz (preserva o sistema atual):
--   • NÃO altera metas, investimentos, perfis, saldo, reserva nem limite diário.
--   • NÃO movimenta dinheiro: um vínculo é só um "recorte" informativo do
--     valor_atual do investimento destinado a uma meta (igual em espírito a
--     investimentos.reserva_valor). NÃO é um aporte manual da meta.
--   • NÃO faz resgate, compra, transferência nem rendimento automático.
--
-- Regra de saldo (validada no BANCO, à prova de concorrência):
--   Para cada investimento, a soma dos vínculos a metas + a parcela de reserva
--   (investimentos.reserva_valor) NÃO pode exceder o valor_atual da posição.
--   Ou seja: disponível p/ metas = valor_atual - reserva_valor - SUM(vínculos).
--   Assim o mesmo dinheiro nunca conta em reserva E em meta ao mesmo tempo.
--
-- Propriedade garantida no banco: FKs COMPOSTAS (id, usuario_id) asseguram que
-- a meta e o investimento pertencem ao MESMO usuário dono do vínculo.
--
-- SEGURO e idempotente: CREATE TABLE/INDEX/POLICY/CONSTRAINT IF NOT EXISTS ou
-- via guardas DO $$ ... $$. NÃO apaga nem altera dados existentes.
-- NÃO executar automaticamente — revisar e aplicar manualmente no Supabase.
-- ------------------------------------------------------------

-- 0) PRÉ-REQUISITOS — aborta com mensagem clara se o ambiente não estiver apto
--    (não assume nada; não altera dados).
DO $$
BEGIN
  -- Tabela investimentos precisa existir (migration 2026-10_investimentos.sql).
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables
                 WHERE table_schema='public' AND table_name='investimentos') THEN
    RAISE EXCEPTION 'Pré-requisito ausente: tabela public.investimentos. Aplique 2026-10_investimentos.sql primeiro.';
  END IF;

  -- metas precisa existir com a coluna usuario_id (schema.sql).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='metas' AND column_name='usuario_id') THEN
    RAISE EXCEPTION 'Pré-requisito ausente: public.metas(usuario_id). Verifique o schema base.';
  END IF;

  -- investimentos precisa de reserva_valor (usada no cálculo do disponível).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='investimentos' AND column_name='reserva_valor') THEN
    RAISE EXCEPTION 'Pré-requisito ausente: public.investimentos(reserva_valor). Aplique 2026-10_investimentos.sql.';
  END IF;

  -- UNIQUE(id, usuario_id) em investimentos é obrigatório p/ a FK composta.
  -- Compara o conjunto de colunas do constraint (independe da ordem) com {id,usuario_id}.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid = 'public.investimentos'::regclass
      AND c.contype = 'u'
      AND (
        SELECT array_agg(a.attname ORDER BY a.attname)
        FROM unnest(c.conkey) k
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
      ) = ARRAY['id','usuario_id']
  ) THEN
    RAISE EXCEPTION 'Pré-requisito ausente: UNIQUE(id, usuario_id) em public.investimentos. Aplique 2026-10_investimentos.sql.';
  END IF;
END $$;

-- Schema privado para a função de validação (não exposto pela API PostgREST).
CREATE SCHEMA IF NOT EXISTS metas_priv;
REVOKE ALL ON SCHEMA metas_priv FROM PUBLIC;

-- Limpeza idempotente: se uma versão ANTERIOR desta migration tiver criado a
-- função/trigger em public, remove (o trigger é recriado mais abaixo apontando
-- p/ metas_priv). O DROP TRIGGER só é tentado SE a tabela já existir — em
-- produção (primeira aplicação) a tabela ainda não existe, e "DROP TRIGGER
-- IF EXISTS ... ON <tabela_inexistente>" falharia com "relation does not exist"
-- (o IF EXISTS cobre o trigger, não a tabela). Por isso o guard abaixo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='metas_investimentos') THEN
    DROP TRIGGER IF EXISTS trg_validar_alocacao_meta_inv ON public.metas_investimentos;
  END IF;
END $$;

-- Remover a função antiga em public (se existir) independe da tabela e é seguro.
DROP FUNCTION IF EXISTS public.validar_alocacao_meta_investimento();

-- Pré-requisito p/ a FK composta do lado METAS: metas precisa de UNIQUE(id,
-- usuario_id) (o PK é só id). Adiciona se faltar. Não altera dados.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.metas'::regclass
      AND conname = 'metas_id_usuario_unico'
  ) THEN
    ALTER TABLE public.metas
      ADD CONSTRAINT metas_id_usuario_unico UNIQUE (id, usuario_id);
  END IF;
END $$;

-- 1) Tabela de vínculos meta ↔ investimento
CREATE TABLE IF NOT EXISTS public.metas_investimentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_id         UUID NOT NULL,
  investimento_id UUID NOT NULL,
  -- Quanto DESTE investimento está alocado a ESTA meta (recorte do valor_atual).
  valor_alocado   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (valor_alocado >= 0),
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW(),
  -- Um investimento entra no máximo UMA vez por meta (edita-se o valor; para
  -- "dividir" usa-se metas diferentes). Evita linhas duplicadas do mesmo par.
  CONSTRAINT metas_inv_par_unico UNIQUE (meta_id, investimento_id),
  -- Dono = dono da meta (FK composta).
  CONSTRAINT metas_inv_meta_do_dono
    FOREIGN KEY (meta_id, usuario_id)
    REFERENCES public.metas (id, usuario_id) ON DELETE CASCADE,
  -- Dono = dono do investimento (FK composta).
  CONSTRAINT metas_inv_investimento_do_dono
    FOREIGN KEY (investimento_id, usuario_id)
    REFERENCES public.investimentos (id, usuario_id) ON DELETE CASCADE
);

ALTER TABLE public.metas_investimentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_metas_inv_usuario       ON public.metas_investimentos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_metas_inv_meta          ON public.metas_investimentos (meta_id);
CREATE INDEX IF NOT EXISTS idx_metas_inv_investimento  ON public.metas_investimentos (investimento_id);

-- 2) RLS dono-only, reforçando que meta e investimento são do próprio usuário
--    (espelha o padrão de investimentos_movimentacoes).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='metas_investimentos'
      AND policyname='Metas-inv: ver (dono + meta e investimento do dono)') THEN
    CREATE POLICY "Metas-inv: ver (dono + meta e investimento do dono)"
      ON public.metas_investimentos FOR SELECT
      USING (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.metas m
                    WHERE m.id = meta_id AND m.usuario_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='metas_investimentos'
      AND policyname='Metas-inv: inserir (dono + meta e investimento do dono)') THEN
    CREATE POLICY "Metas-inv: inserir (dono + meta e investimento do dono)"
      ON public.metas_investimentos FOR INSERT
      WITH CHECK (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.metas m
                    WHERE m.id = meta_id AND m.usuario_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='metas_investimentos'
      AND policyname='Metas-inv: atualizar (dono + meta e investimento do dono)') THEN
    CREATE POLICY "Metas-inv: atualizar (dono + meta e investimento do dono)"
      ON public.metas_investimentos FOR UPDATE
      USING (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.metas m
                    WHERE m.id = meta_id AND m.usuario_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()))
      WITH CHECK (auth.uid() = usuario_id
        AND EXISTS (SELECT 1 FROM public.metas m
                    WHERE m.id = meta_id AND m.usuario_id = auth.uid())
        AND EXISTS (SELECT 1 FROM public.investimentos i
                    WHERE i.id = investimento_id AND i.usuario_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='metas_investimentos'
      AND policyname='Metas-inv: apagar (dono)') THEN
    CREATE POLICY "Metas-inv: apagar (dono)"
      ON public.metas_investimentos FOR DELETE
      USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- 3) Validação da SOMA alocável por investimento (à prova de concorrência).
--    Um CHECK por linha não enxerga a soma de todas as alocações; por isso
--    usamos um trigger que BLOQUEIA a(s) linha(s) do(s) investimento(s)
--    envolvido(s) (FOR UPDATE) e compara a soma dos vínculos com
--    (valor_atual - reserva_valor). Rejeita com mensagem clara — sem ajuste
--    silencioso.
--
--    SEGURANÇA (SECURITY DEFINER): a função roda com os privilégios do dono e
--    IGNORA RLS. Por isso validamos explicitamente auth.uid() e a propriedade
--    da meta e do investimento aqui dentro (defesa em profundidade, além das
--    policies). Fica em schema PRIVADO (metas_priv) e sem EXECUTE para PUBLIC,
--    para não ser exposta pela API. search_path fixo e mínimo evita
--    sequestro de resolução de nomes (tabelas são qualificadas por schema).
--
--    ORDEM DE LOCK CONSISTENTE: quando um UPDATE troca investimento_id, dois
--    investimentos estão envolvidos (OLD e NEW). Travamos AMBOS sempre na mesma
--    ordem (por UUID crescente) para evitar deadlock entre transações que mexem
--    nos mesmos investimentos em sentidos opostos.
CREATE OR REPLACE FUNCTION metas_priv.validar_alocacao_meta_investimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_valor_atual   numeric(14,2);
  v_reserva       numeric(14,2);
  v_outros        numeric(14,2);
  v_disponivel    numeric(14,2);
  v_dono_meta     uuid;
  v_dono_inv      uuid;
  v_uid           uuid := auth.uid();
BEGIN
  -- 3.1) Precisa haver usuário autenticado e o vínculo deve ser dele.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Operação exige usuário autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.usuario_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Vínculo deve pertencer ao usuário autenticado.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3.2) Propriedade da META e do INVESTIMENTO (além da RLS; SECURITY DEFINER a ignora).
  SELECT usuario_id INTO v_dono_meta FROM public.metas WHERE id = NEW.meta_id;
  IF v_dono_meta IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Meta inexistente ou de outro usuário.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3.3) ORDEM DE LOCK CONSISTENTE: trava OLD e NEW investimento (quando ambos
  --      existem e diferem) em ordem de UUID, evitando deadlock.
  IF TG_OP = 'UPDATE' AND OLD.investimento_id IS DISTINCT FROM NEW.investimento_id THEN
    PERFORM 1 FROM public.investimentos
      WHERE id IN (OLD.investimento_id, NEW.investimento_id)
      ORDER BY id
      FOR UPDATE;
  END IF;

  -- 3.4) Trava e lê a posição do investimento ALVO (NEW), confirmando o dono.
  SELECT valor_atual, reserva_valor, usuario_id
    INTO v_valor_atual, v_reserva, v_dono_inv
  FROM public.investimentos
  WHERE id = NEW.investimento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investimento inexistente para o vínculo.' USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF v_dono_inv IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Investimento de outro usuário.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 3.5) Soma dos OUTROS vínculos deste investimento (exclui a própria linha).
  SELECT COALESCE(SUM(valor_alocado), 0)
    INTO v_outros
  FROM public.metas_investimentos
  WHERE investimento_id = NEW.investimento_id
    AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- disponível = valor_atual - reserva - (outras alocações). Garante que
  -- SUM(valor_alocado) + reserva_valor <= valor_atual.
  v_disponivel := v_valor_atual - COALESCE(v_reserva, 0) - v_outros;

  IF NEW.valor_alocado > v_disponivel THEN
    RAISE EXCEPTION
      'Alocação (%) excede o saldo disponível do investimento (%). Ajuste o valor.',
      NEW.valor_alocado, v_disponivel
      USING ERRCODE = 'check_violation';
  END IF;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- Não expor a função pela API nem a usuários; o trigger a executa via definer.
REVOKE ALL ON FUNCTION metas_priv.validar_alocacao_meta_investimento() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_validar_alocacao_meta_inv ON public.metas_investimentos;
CREATE TRIGGER trg_validar_alocacao_meta_inv
  BEFORE INSERT OR UPDATE OF valor_alocado, investimento_id, usuario_id, meta_id
  ON public.metas_investimentos
  FOR EACH ROW
  EXECUTE FUNCTION metas_priv.validar_alocacao_meta_investimento();

-- 4) Requisito nº 5 — proteger o OUTRO lado: ao REDUZIR investimentos.valor_atual
--    ou AUMENTAR reserva_valor, as alocações existentes não podem ficar acima do
--    novo disponível. REJEITA a alteração com mensagem clara (sem corrigir
--    silenciosamente os vínculos). O CHECK investimentos_reserva_nao_excede_saldo
--    (reserva_valor <= valor_atual) continua valendo; este trigger cobre a soma
--    das alocações a metas.
CREATE OR REPLACE FUNCTION metas_priv.proteger_saldo_investimento_vinculado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_alocado   numeric(14,2);
  v_alocavel  numeric(14,2);
BEGIN
  -- Só age quando o novo cenário é MAIS restritivo (valor_atual caiu ou
  -- reserva subiu). Aumentos de saldo / reduções de reserva nunca violam.
  IF NEW.valor_atual >= OLD.valor_atual AND NEW.reserva_valor <= OLD.reserva_valor THEN
    RETURN NEW;
  END IF;

  -- ORDEM DE LOCK: a linha deste investimento JÁ está travada pelo UPDATE em
  -- curso (este é um BEFORE UPDATE em investimentos). Em seguida travamos as
  -- linhas de metas_investimentos deste investimento. Isso respeita a MESMA
  -- ordem do outro trigger (investimentos → metas_investimentos), evitando
  -- deadlock. FOR UPDATE NÃO pode ser usado com agregação, por isso travamos
  -- as linhas numa consulta sem agregação e só então somamos.
  PERFORM 1
  FROM public.metas_investimentos
  WHERE investimento_id = NEW.id
  FOR UPDATE;

  SELECT COALESCE(SUM(valor_alocado), 0)
    INTO v_alocado
  FROM public.metas_investimentos
  WHERE investimento_id = NEW.id;

  v_alocavel := NEW.valor_atual - COALESCE(NEW.reserva_valor, 0);

  IF v_alocado > v_alocavel THEN
    RAISE EXCEPTION
      'Há % alocados a metas neste investimento; o novo saldo disponível seria apenas %. Ajuste ou desvincule metas antes de reduzir.',
      v_alocado, v_alocavel
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION metas_priv.proteger_saldo_investimento_vinculado() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_proteger_saldo_inv_vinculado ON public.investimentos;
CREATE TRIGGER trg_proteger_saldo_inv_vinculado
  BEFORE UPDATE OF valor_atual, reserva_valor
  ON public.investimentos
  FOR EACH ROW
  EXECUTE FUNCTION metas_priv.proteger_saldo_investimento_vinculado();

-- ------------------------------------------------------------
-- Diagnóstico (consulta de leitura; o app também sinaliza na UI):
--   SELECT i.id,
--          i.valor_atual - i.reserva_valor AS alocavel,
--          COALESCE(SUM(mi.valor_alocado),0) AS alocado
--   FROM public.investimentos i
--   LEFT JOIN public.metas_investimentos mi ON mi.investimento_id = i.id
--   WHERE i.usuario_id = auth.uid()
--   GROUP BY i.id
--   HAVING COALESCE(SUM(mi.valor_alocado),0) > i.valor_atual - i.reserva_valor;
-- Observação: com os DOIS triggers acima, criar/aumentar alocação E reduzir
-- saldo/aumentar reserva são ambos barrados no banco. A consulta serve apenas
-- para auditoria de dados que porventura já estivessem inconsistentes ANTES
-- desta migration (não há, pois não havia vínculos antes).
-- ------------------------------------------------------------
