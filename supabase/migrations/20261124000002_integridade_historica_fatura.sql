-- MIGRAÇÃO - Almeida Finance
-- Integridade histórica das faturas pagas: guarda, auditoria, crédito, fluxo controlado
-- e exceção transacional do zerar_dados_financeiros.
--
-- DEPENDE de 20261124000001_pagamentos_fatura.sql (aplicada antes; ver bloco de pré-requisitos).
-- Desenho: .agents/tasks/task-integridade-historica-fatura/design.md
--
-- COMO APLICAR: como UMA transação única, igual à 000001.
--   psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000002_integridade_historica_fatura.sql
-- Execute no DEV primeiro. PRODUÇÃO somente depois da aprovação dos testes no DEV.
-- ESTADO DE VALIDAÇÃO: este SQL NÃO foi executado em PostgreSQL real nem em PGlite no ambiente
-- em que foi escrito (sem Postgres disponível). Os testes em supabase/tests estão PENDENTES.
--
-- SEGURO:
--   • Idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS).
--   • Sem DROP de tabela, coluna ou dado. Nenhum DML foi revogado: os hooks atuais seguem
--     funcionando para faturas abertas e parciais.
--   • ATENÇÃO À ORDEM: a 000001 agora FALHA com mensagem clara se esta migration já estiver
--     aplicada (to_regprocedure de estornar_pagamento_fatura(uuid,text)), para não restaurar em
--     silêncio o estorno de 1 argumento sem auditoria. Esta migration, sim, pode ser reaplicada.
--
-- Regras por competência (cartao_id, ano_mes). P = soma dos pagamentos ativos; T = total do
-- ciclo calculado no servidor (total_fatura_ciclo_servidor).
--   • Aberta (P = 0): DML livre, sem auditoria.
--   • Parcial (0 < P < T): DML permitido; pagamentos preservados; gera linha de auditoria.
--   • Quitada (P > 0 e P >= T): DML direto de usuário comum é RECUSADO com SQLSTATE 'FP001'.
--     O único caminho é a RPC alterar_historico_fatura (motivo obrigatório), que audita.
--   • Se o total cair abaixo de P, o pagamento NUNCA é apagado: registra-se um crédito
--     (ajustes_fatura.tipo = 'credito', valor = variação, razão assinada). O crédito vigente é
--     a soma da razão. Não é aplicado automaticamente a outra fatura e não altera o saldo
--     derivado (decisão em aberto, registrada no relatório; não inventada aqui).
--   • Estorno continua explícito: ganha motivo opcional, grava linha 'estorno' na razão e
--     reconcilia (reduz) o crédito.
--
-- Mecanismo de exceção NÃO forjável (_fatura_liberacoes): a liberação só vale se existir uma
-- linha com txid = txid_current() E usuario_id = auth.uid(). A linha desaparece em rollback, é
-- apagada ao fim da RPC e é podada após 1 hora. A tabela não tem acesso para papéis de cliente.
--
-- Ordem dos triggers BEFORE ROW (alfabética): aa_fatura_travar_* (lock do cartão, 000001) <
-- ab_fatura_guardar_historico (guarda) ; AFTER ROW: zz_fatura_auditar_historico.
--
-- DESVIOS DO DESENHO (decididos na implementação):
--   1. Nos triggers SECURITY DEFINER, current_user é o dono da função, então o contexto
--      administrativo (service role, SQL Editor) é detectado por auth.uid() IS NULL. Papel anon
--      sem uid também cai aqui, mas anon não tem privilégio de DML nas tabelas financeiras.
--   2. fatura_liberacao_ativa tem EXECUTE para authenticated, anon e service_role: os triggers
--      INVOKER de ajustes_fatura e pagamentos_fatura a chamam com o papel do cliente. Ela só
--      responde "existe liberação desta transação para o meu uid?", sem expor dados.
--   4. A descrição NÃO é campo relevante por si só (o desenho a listava): editar só o texto de uma
--      compra de fatura quitada é permitido, como exige a especificação da feature. Ela só conta
--      quando a descrição normalizada coincide com a de um parcelamento (ou compra) do mesmo
--      cartão, porque aí o dedupe de total_fatura_ciclo_servidor pode mudar o total
--      (ver _fatura_mudanca_relevante).
--   3. reconciliar_credito_fatura recebe um 6o parâmetro opcional (p_via) para que o estorno
--      registre via = 'controlado'.

-- ------------------------------------------------------------
-- PRÉ-REQUISITOS (falha explícita antes de qualquer alteração)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 130000 THEN
    RAISE EXCEPTION 'PostgreSQL 13 ou superior é necessário. Versão atual: %', current_setting('server_version')
      USING ERRCODE = '0A000';
  END IF;
  IF to_regclass('public.pagamentos_fatura') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: public.pagamentos_fatura. Aplique 20261124000001_pagamentos_fatura.sql antes de 20261124000002_integridade_historica_fatura.sql.'
      USING ERRCODE = '42P01';
  END IF;
  IF to_regprocedure('public.travar_cartoes_fatura(uuid[],uuid)') IS NULL
     OR to_regprocedure('public.total_fatura_ciclo_servidor(uuid,uuid,text)') IS NULL
     OR to_regprocedure('public.competencia_fatura_indice(date,integer)') IS NULL
     OR to_regprocedure('public.estornar_pagamento_fatura(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: funções de 20261124000001_pagamentos_fatura.sql (travar_cartoes_fatura, total_fatura_ciclo_servidor, competencia_fatura_indice, estornar_pagamento_fatura). Aplique a 000001 antes.'
      USING ERRCODE = '42883';
  END IF;
  IF to_regprocedure('public.consultor_autorizado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: public.consultor_autorizado(uuid). Aplique 2026-10_consultoria_acessos.sql antes.'
      USING ERRCODE = '42883';
  END IF;
  IF to_regclass('public.cartoes') IS NULL OR to_regclass('public.compras_cartao') IS NULL
     OR to_regclass('public.parcelamentos') IS NULL OR to_regclass('public.faturas_cartao') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: tabelas cartoes, compras_cartao, parcelamentos e faturas_cartao.'
      USING ERRCODE = '42P01';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. Razão append-only: public.ajustes_fatura
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ajustes_fatura (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id      UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  ano_mes        TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  tipo           TEXT NOT NULL CHECK (tipo IN ('inclusao', 'edicao', 'exclusao', 'credito', 'estorno')),
  valor          NUMERIC(12,2),
  tabela_origem  TEXT,
  registro_id    UUID,
  dados_antes    JSONB,
  dados_depois   JSONB,
  pago_ativo     NUMERIC(12,2),
  total_depois   NUMERIC(12,2),
  via            TEXT NOT NULL CHECK (via IN ('direto', 'controlado', 'administrativo')),
  motivo         TEXT CHECK (motivo IS NULL OR char_length(motivo) <= 300),
  pagamento_id   UUID,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ajustes_fatura_cartao_mes
  ON public.ajustes_fatura (cartao_id, ano_mes, criado_em);
CREATE INDEX IF NOT EXISTS idx_ajustes_fatura_usuario
  ON public.ajustes_fatura (usuario_id, criado_em);

ALTER TABLE public.ajustes_fatura ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ajustes_fatura'
      AND policyname = 'Usuário lê apenas os próprios ajustes de fatura') THEN
    CREATE POLICY "Usuário lê apenas os próprios ajustes de fatura"
      ON public.ajustes_fatura FOR SELECT
      USING (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ajustes_fatura'
      AND policyname = 'Consultor autorizado lê ajustes de fatura do cliente') THEN
    CREATE POLICY "Consultor autorizado lê ajustes de fatura do cliente"
      ON public.ajustes_fatura FOR SELECT
      USING (public.consultor_autorizado(usuario_id));
  END IF;
END $$;

-- Escrita somente pelos triggers e RPCs SECURITY DEFINER. Cliente só lê.
REVOKE ALL ON public.ajustes_fatura FROM anon, authenticated;
GRANT SELECT ON public.ajustes_fatura TO authenticated;

-- ------------------------------------------------------------
-- 2. Liberações por transação: public._fatura_liberacoes
-- RLS ligada SEM policy e REVOKE explícito de todos os papéis de cliente (o ambiente de teste
-- concede ALL por default privileges). Só funções SECURITY DEFINER do dono acessam.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public._fatura_liberacoes (
  txid        BIGINT NOT NULL,
  usuario_id  UUID NOT NULL,
  escopo      TEXT NOT NULL CHECK (escopo IN ('zerar', 'controlado')),
  motivo      TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatura_liberacoes_txid ON public._fatura_liberacoes (txid);

ALTER TABLE public._fatura_liberacoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._fatura_liberacoes FROM PUBLIC, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. fatura_liberacao_ativa: existe liberação DESTA transação para o usuário atual?
-- VOLATILE de propósito: cada chamada enxerga linhas inseridas por comandos anteriores
-- da mesma transação.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fatura_liberacao_ativa(p_escopo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public._fatura_liberacoes l
     WHERE l.txid = txid_current() AND l.usuario_id = v_uid AND l.escopo = p_escopo);
END;
$$;

-- Contexto da escrita atual para a razão: via e motivo.
CREATE OR REPLACE FUNCTION public._fatura_contexto(OUT o_via TEXT, OUT o_motivo TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  o_motivo := NULL;
  IF public.fatura_liberacao_ativa('controlado') THEN
    o_via := 'controlado';
    SELECT l.motivo INTO o_motivo FROM public._fatura_liberacoes l
     WHERE l.txid = txid_current() AND l.usuario_id = v_uid AND l.escopo = 'controlado'
     ORDER BY l.criado_em DESC LIMIT 1;
  ELSIF v_uid IS NULL THEN
    o_via := 'administrativo';
  ELSE
    o_via := 'direto';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 4. Liberação do zerar_dados_financeiros (vale só na própria transação)
-- Inofensivas se chamadas soltas: uma chamada RPC do PostgREST é uma transação e a linha só
-- vale para o txid atual. Residual aceito: quem executa SQL arbitrário como o próprio usuário
-- numa conexão direta poderia chamar liberar_historico_zerar e apagar o próprio histórico na
-- mesma transação (o app não oferece essa conexão; ele já pode apagar os próprios dados via zerar).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.liberar_historico_zerar()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  -- No máximo uma linha 'zerar' por transação e usuário. Linhas commitadas de outras transações
  -- do mesmo usuário são sempre sobras (a liberação legítima é apagada na própria transação e nunca
  -- chega a ser commitada; txid de 64 bits não se repete), então podem ser apagadas aqui. Isso limita
  -- o acúmulo a no máximo uma linha por usuário, mesmo com chamadas repetidas.
  DELETE FROM public._fatura_liberacoes
   WHERE criado_em < NOW() - INTERVAL '1 hour'
      OR (usuario_id = v_uid AND txid <> txid_current())
      OR (usuario_id = v_uid AND txid = txid_current() AND escopo = 'zerar');
  INSERT INTO public._fatura_liberacoes (txid, usuario_id, escopo, motivo)
  VALUES (txid_current(), v_uid, 'zerar', 'zerar_dados_financeiros');
END;
$$;

CREATE OR REPLACE FUNCTION public.encerrar_liberacao_zerar()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  DELETE FROM public._fatura_liberacoes
   WHERE (txid = txid_current() AND usuario_id = v_uid AND escopo = 'zerar')
      OR criado_em < NOW() - INTERVAL '1 hour';
END;
$$;

-- ------------------------------------------------------------
-- 5. Meses de um registro que têm pagamento ativo
-- compras_cartao: competência da 1a parcela (competencia_fatura_indice com o dia de fechamento
-- do cartão do dono) e as n-1 seguintes (n limitado a 600). parcelamentos: idem, com
-- primeira_parcela (cartao_id NULL = nenhum mês). faturas_cartao: o próprio ano_mes.
-- Sempre filtra pelo usuario_id do registro.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.competencias_pagas_registro(p_tabela TEXT, p_reg JSONB)
RETURNS SETOF TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID;
  v_cartao UUID;
  v_data   DATE;
  v_n      INT;
  v_fech   INT;
  v_idx    INT;
  v_np     INT;
BEGIN
  IF p_reg IS NULL THEN RETURN; END IF;
  v_uid    := NULLIF(p_reg->>'usuario_id', '')::uuid;
  v_cartao := NULLIF(p_reg->>'cartao_id', '')::uuid;
  IF v_uid IS NULL OR v_cartao IS NULL THEN RETURN; END IF;

  IF p_tabela = 'faturas_cartao' THEN
    RETURN QUERY
      SELECT DISTINCT pg.ano_mes FROM public.pagamentos_fatura pg
       WHERE pg.usuario_id = v_uid AND pg.cartao_id = v_cartao
         AND pg.status = 'ativo' AND pg.ano_mes = p_reg->>'ano_mes';
    RETURN;
  ELSIF p_tabela = 'compras_cartao' THEN
    v_data := NULLIF(p_reg->>'data_compra', '')::date;
  ELSIF p_tabela = 'parcelamentos' THEN
    v_data := NULLIF(p_reg->>'primeira_parcela', '')::date;
  ELSE
    RETURN;
  END IF;
  IF v_data IS NULL THEN RETURN; END IF;

  v_np := GREATEST(COALESCE(NULLIF(p_reg->>'numero_parcelas', '')::int, 1), 1);
  v_n  := LEAST(v_np, 600);

  SELECT c.dia_fechamento INTO v_fech FROM public.cartoes c
   WHERE c.id = v_cartao AND c.usuario_id = v_uid;
  IF NOT FOUND THEN RETURN; END IF;

  v_idx := public.competencia_fatura_indice(v_data, v_fech);

  -- Faixas de competências afetadas: a do próprio registro e as da contraparte do dedupe de
  -- total_fatura_ciclo_servidor (parcelamento ignorado quando existe compra do mesmo cartão com a
  -- mesma descrição normalizada, valor e nº de parcelas). Mexer num lado muda o total dos meses
  -- do outro lado, mesmo com datas em competências diferentes.
  RETURN QUERY
    WITH faixas(ini, n) AS (
      SELECT v_idx, v_n
      UNION ALL
      SELECT public.competencia_fatura_indice(p.primeira_parcela, v_fech),
             LEAST(GREATEST(p.numero_parcelas, 1), 600)
        FROM public.parcelamentos p
       WHERE p_tabela = 'compras_cartao'
         AND p.cartao_id = v_cartao AND p.usuario_id = v_uid AND p.quitado_em IS NULL
         AND p.primeira_parcela IS NOT NULL
         AND public.normalizar_texto_fatura(p.descricao) = public.normalizar_texto_fatura(p_reg->>'descricao')
         AND round(p.valor_total * 100) = round(NULLIF(p_reg->>'valor_total', '')::numeric * 100)
         AND GREATEST(1, p.numero_parcelas) = v_np
      UNION ALL
      SELECT public.competencia_fatura_indice(c.data_compra, v_fech),
             LEAST(GREATEST(c.numero_parcelas, 1), 600)
        FROM public.compras_cartao c
       WHERE p_tabela = 'parcelamentos'
         AND c.cartao_id = v_cartao AND c.usuario_id = v_uid
         AND c.data_compra IS NOT NULL
         AND public.normalizar_texto_fatura(c.descricao) = public.normalizar_texto_fatura(p_reg->>'descricao')
         AND round(c.valor_total * 100) = round(NULLIF(p_reg->>'valor_total', '')::numeric * 100)
         AND GREATEST(1, c.numero_parcelas) = v_np
    )
    SELECT DISTINCT pg.ano_mes FROM public.pagamentos_fatura pg
      JOIN faixas f
        ON (split_part(pg.ano_mes, '-', 1)::int * 12 + split_part(pg.ano_mes, '-', 2)::int - 1)
           BETWEEN f.ini AND f.ini + f.n - 1
     WHERE pg.usuario_id = v_uid AND pg.cartao_id = v_cartao AND pg.status = 'ativo';
END;
$$;

-- Campos que, se mudarem, tornam a alteração relevante para a fatura.
CREATE OR REPLACE FUNCTION public._fatura_campos_relevantes(p_tabela TEXT, p_reg JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_tabela
    WHEN 'compras_cartao' THEN jsonb_build_object(
      'cartao_id', p_reg->'cartao_id', 'valor_total', p_reg->'valor_total',
      'data_compra', p_reg->'data_compra', 'numero_parcelas', p_reg->'numero_parcelas')
    WHEN 'parcelamentos' THEN jsonb_build_object(
      'cartao_id', p_reg->'cartao_id', 'valor_total', p_reg->'valor_total',
      'numero_parcelas', p_reg->'numero_parcelas', 'primeira_parcela', p_reg->'primeira_parcela',
      'quitado_em', p_reg->'quitado_em')
    WHEN 'faturas_cartao' THEN jsonb_build_object(
      'cartao_id', p_reg->'cartao_id', 'ano_mes', p_reg->'ano_mes',
      'valor_total', p_reg->'valor_total')
    ELSE '{}'::jsonb
  END;
$$;

-- A alteração muda o total da fatura? Campos numéricos/de data/cartão sempre contam. A descrição só
-- conta quando pode mexer no dedupe parcelamento x compra de total_fatura_ciclo_servidor (mesma
-- descrição normalizada no mesmo cartão); editar só o texto de uma compra comum não é relevante.
CREATE OR REPLACE FUNCTION public._fatura_mudanca_relevante(p_tabela TEXT, p_old JSONB, p_new JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_do     TEXT;
  v_dn     TEXT;
  v_cartao UUID;
  v_uid    UUID;
BEGIN
  IF public._fatura_campos_relevantes(p_tabela, p_old) <> public._fatura_campos_relevantes(p_tabela, p_new) THEN
    RETURN TRUE;
  END IF;
  IF p_tabela NOT IN ('compras_cartao', 'parcelamentos') THEN
    RETURN FALSE;
  END IF;
  v_do := public.normalizar_texto_fatura(p_old->>'descricao');
  v_dn := public.normalizar_texto_fatura(p_new->>'descricao');
  IF v_do = v_dn THEN
    RETURN FALSE;
  END IF;
  v_cartao := NULLIF(p_new->>'cartao_id', '')::uuid;
  v_uid    := NULLIF(p_new->>'usuario_id', '')::uuid;
  IF v_cartao IS NULL OR v_uid IS NULL THEN
    RETURN FALSE;
  END IF;
  IF p_tabela = 'compras_cartao' THEN
    RETURN EXISTS (SELECT 1 FROM public.parcelamentos p
                    WHERE p.cartao_id = v_cartao AND p.usuario_id = v_uid AND p.quitado_em IS NULL
                      AND public.normalizar_texto_fatura(p.descricao) IN (v_do, v_dn));
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.compras_cartao c
                  WHERE c.cartao_id = v_cartao AND c.usuario_id = v_uid
                    AND public.normalizar_texto_fatura(c.descricao) IN (v_do, v_dn));
END;
$$;

-- Recusa (FP001) se a competência está quitada: P > 0 e P >= T.
CREATE OR REPLACE FUNCTION public._fatura_recusar_se_quitada(p_cartao UUID, p_usuario_id UUID, p_ano_mes TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pago  NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(pg.valor), 0) INTO v_pago FROM public.pagamentos_fatura pg
   WHERE pg.usuario_id = p_usuario_id AND pg.cartao_id = p_cartao
     AND pg.ano_mes = p_ano_mes AND pg.status = 'ativo';
  IF v_pago <= 0 THEN RETURN; END IF;
  v_total := public.total_fatura_ciclo_servidor(p_cartao, p_usuario_id, p_ano_mes);
  IF v_pago >= v_total THEN
    RAISE EXCEPTION 'A fatura % deste cartão já está quitada. Compras, parcelamentos e faturas de uma fatura quitada não podem ser alterados diretamente.', p_ano_mes
      USING ERRCODE = 'FP001',
            HINT = 'Use a função alterar_historico_fatura informando o motivo (a alteração fica registrada no histórico).';
  END IF;
END;
$$;

-- ------------------------------------------------------------
-- 6. Reconciliação do crédito: C = max(P - T, 0); grava só a diferença para o crédito já lançado.
-- Chamada sempre sob lock do cartão. Interna.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconciliar_credito_fatura(
  p_cartao      UUID,
  p_usuario_id  UUID,
  p_ano_mes     TEXT,
  p_registro_id UUID,
  p_motivo      TEXT,
  p_via         TEXT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pago    NUMERIC(12,2);
  v_total   NUMERIC(12,2);
  v_credito NUMERIC(12,2);
  v_prev    NUMERIC(12,2);
  v_delta   NUMERIC(12,2);
  v_via     TEXT := p_via;
BEGIN
  SELECT COALESCE(SUM(pg.valor), 0) INTO v_pago FROM public.pagamentos_fatura pg
   WHERE pg.usuario_id = p_usuario_id AND pg.cartao_id = p_cartao
     AND pg.ano_mes = p_ano_mes AND pg.status = 'ativo';
  v_total   := public.total_fatura_ciclo_servidor(p_cartao, p_usuario_id, p_ano_mes);
  v_credito := GREATEST(v_pago - v_total, 0);

  SELECT COALESCE(SUM(a.valor), 0) INTO v_prev FROM public.ajustes_fatura a
   WHERE a.usuario_id = p_usuario_id AND a.cartao_id = p_cartao
     AND a.ano_mes = p_ano_mes AND a.tipo = 'credito';

  v_delta := v_credito - v_prev;
  IF v_delta <> 0 THEN
    IF v_via IS NULL THEN
      SELECT c.o_via INTO v_via FROM public._fatura_contexto() c;
    END IF;
    INSERT INTO public.ajustes_fatura
      (usuario_id, cartao_id, ano_mes, tipo, valor, registro_id, pago_ativo, total_depois, via, motivo)
    VALUES
      (p_usuario_id, p_cartao, p_ano_mes, 'credito', v_delta, p_registro_id, v_pago, v_total, v_via, p_motivo);
  END IF;
  RETURN v_credito;
END;
$$;

-- ------------------------------------------------------------
-- 7. Triggers de guarda e auditoria (compras_cartao, parcelamentos, faturas_cartao)
-- ------------------------------------------------------------

-- Guarda BEFORE ROW: recusa (FP001) DML direto de usuário comum em competência quitada.
CREATE OR REPLACE FUNCTION public.trg_fatura_guardar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ym  TEXT;
BEGIN
  -- Contexto administrativo (service role, SQL Editor, dono): auth.uid() nulo. Liberações
  -- 'zerar' e 'controlado' valem só na transação atual e para o usuário atual.
  IF v_uid IS NULL
     OR public.fatura_liberacao_ativa('zerar')
     OR public.fatura_liberacao_ativa('controlado') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mudar pago, pago_em, categoria etc. não é relevante para o total da fatura.
    IF NOT public._fatura_mudanca_relevante(TG_TABLE_NAME::text, to_jsonb(OLD), to_jsonb(NEW)) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Só avalia linhas do próprio usuário (a RLS rejeita as demais depois).
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    IF OLD.usuario_id = v_uid THEN
      FOR v_ym IN SELECT public.competencias_pagas_registro(TG_TABLE_NAME::text, to_jsonb(OLD)) LOOP
        PERFORM public._fatura_recusar_se_quitada(OLD.cartao_id, v_uid, v_ym);
      END LOOP;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.usuario_id = v_uid THEN
      FOR v_ym IN SELECT public.competencias_pagas_registro(TG_TABLE_NAME::text, to_jsonb(NEW)) LOOP
        PERFORM public._fatura_recusar_se_quitada(NEW.cartao_id, v_uid, v_ym);
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Auditoria AFTER ROW: para cada mês com pagamento ativo registra a alteração e reconcilia o crédito.
CREATE OR REPLACE FUNCTION public.trg_fatura_auditar_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tipo    TEXT;
  v_antes   JSONB;
  v_depois  JSONB;
  v_usuario UUID;
  v_reg_id  UUID;
  v_ym      TEXT;
  v_chaves  TEXT[] := ARRAY[]::TEXT[];
  v_chave   TEXT;
  v_cartao  UUID;
  v_via     TEXT;
  v_motivo  TEXT;
  v_pago    NUMERIC(12,2);
  v_total   NUMERIC(12,2);
BEGIN
  -- O zerar_dados_financeiros apaga o histórico do próprio usuário por inteiro.
  IF public.fatura_liberacao_ativa('zerar') THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NOT public._fatura_mudanca_relevante(TG_TABLE_NAME::text, to_jsonb(OLD), to_jsonb(NEW)) THEN
      RETURN NULL;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_tipo := 'inclusao'; v_depois := to_jsonb(NEW); v_usuario := NEW.usuario_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_tipo := 'edicao'; v_antes := to_jsonb(OLD); v_depois := to_jsonb(NEW); v_usuario := NEW.usuario_id;
  ELSE
    v_tipo := 'exclusao'; v_antes := to_jsonb(OLD); v_usuario := OLD.usuario_id;
  END IF;
  v_reg_id := COALESCE((v_depois->>'id')::uuid, (v_antes->>'id')::uuid);

  IF v_antes IS NOT NULL THEN
    FOR v_ym IN SELECT public.competencias_pagas_registro(TG_TABLE_NAME::text, v_antes) LOOP
      v_chaves := array_append(v_chaves, (v_antes->>'cartao_id') || '|' || v_ym);
    END LOOP;
  END IF;
  IF v_depois IS NOT NULL THEN
    FOR v_ym IN SELECT public.competencias_pagas_registro(TG_TABLE_NAME::text, v_depois) LOOP
      v_chaves := array_append(v_chaves, (v_depois->>'cartao_id') || '|' || v_ym);
    END LOOP;
  END IF;

  IF COALESCE(array_length(v_chaves, 1), 0) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT c.o_via, c.o_motivo INTO v_via, v_motivo FROM public._fatura_contexto() c;

  FOR v_chave IN SELECT DISTINCT x FROM unnest(v_chaves) AS t(x) ORDER BY x LOOP
    v_cartao := split_part(v_chave, '|', 1)::uuid;
    v_ym     := split_part(v_chave, '|', 2);

    SELECT COALESCE(SUM(pg.valor), 0) INTO v_pago FROM public.pagamentos_fatura pg
     WHERE pg.usuario_id = v_usuario AND pg.cartao_id = v_cartao
       AND pg.ano_mes = v_ym AND pg.status = 'ativo';
    v_total := public.total_fatura_ciclo_servidor(v_cartao, v_usuario, v_ym);

    INSERT INTO public.ajustes_fatura
      (usuario_id, cartao_id, ano_mes, tipo, tabela_origem, registro_id,
       dados_antes, dados_depois, pago_ativo, total_depois, via, motivo)
    VALUES
      (v_usuario, v_cartao, v_ym, v_tipo, TG_TABLE_NAME::text, v_reg_id,
       v_antes, v_depois, v_pago, v_total, v_via, v_motivo);

    PERFORM public.reconciliar_credito_fatura(v_cartao, v_usuario, v_ym, v_reg_id, v_motivo, v_via);
  END LOOP;

  RETURN NULL;
END;
$$;

-- cartoes: (a) recusa excluir cartão que tenha QUALQUER pagamento (inclusive estornado) ou linha na
-- razão, porque a cascata de FK apagaria a rastreabilidade; (b) recusa mudar dia_fechamento com
-- pagamento ativo, porque isso reclassifica compras entre competências e muda o total de faturas
-- pagas sem guarda nem razão. Exceções: zerar_dados_financeiros (liberação 'zerar') e contexto
-- administrativo (auth.uid() nulo, incluindo a exclusão de usuário em auth.users).
CREATE OR REPLACE FUNCTION public.trg_fatura_proteger_cartao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.fatura_liberacao_ativa('zerar') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.usuario_id = v_uid AND (
         EXISTS (SELECT 1 FROM public.pagamentos_fatura pg
                  WHERE pg.cartao_id = OLD.id AND pg.usuario_id = OLD.usuario_id)
         OR EXISTS (SELECT 1 FROM public.ajustes_fatura a
                     WHERE a.cartao_id = OLD.id AND a.usuario_id = OLD.usuario_id)) THEN
      RAISE EXCEPTION 'Este cartão tem histórico de pagamentos ou ajustes de fatura e não pode ser excluído.'
        USING ERRCODE = 'FP001',
              HINT = 'O histórico de faturas é preservado. Para apagar tudo, use "Zerar dados".';
    END IF;
    RETURN OLD;
  END IF;

  -- UPDATE OF dia_fechamento
  IF NEW.dia_fechamento IS DISTINCT FROM OLD.dia_fechamento
     AND OLD.usuario_id = v_uid
     AND EXISTS (SELECT 1 FROM public.pagamentos_fatura pg
                  WHERE pg.cartao_id = OLD.id AND pg.usuario_id = OLD.usuario_id AND pg.status = 'ativo') THEN
    RAISE EXCEPTION 'O dia de fechamento não pode ser alterado enquanto o cartão tiver pagamentos de fatura ativos.'
      USING ERRCODE = 'FP001',
            HINT = 'A mudança reclassificaria compras entre faturas já pagas. Estorne os pagamentos antes de alterar.';
  END IF;
  RETURN NEW;
END;
$$;

-- ajustes_fatura: append-only. SECURITY INVOKER de propósito (current_user é o papel do cliente).
-- A cascata de FK roda como dono da tabela e passa.
CREATE OR REPLACE FUNCTION public.trg_ajustes_fatura_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon', 'service_role')
     AND NOT public.fatura_liberacao_ativa('zerar') THEN
    RAISE EXCEPTION 'O histórico de ajustes de fatura é somente de inclusão (não aceita alteração nem exclusão).'
      USING ERRCODE = 'FP001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- pagamentos_fatura: UPDATE só para ativo -> estornado sem mexer nos demais campos (qualquer
-- papel); DELETE recusado para papéis de cliente, salvo a liberação do zerar.
CREATE OR REPLACE FUNCTION public.trg_pagamentos_fatura_imutavel()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'ativo' AND NEW.status = 'estornado'
       AND NEW.valor = OLD.valor AND NEW.cartao_id = OLD.cartao_id
       AND NEW.ano_mes = OLD.ano_mes AND NEW.usuario_id = OLD.usuario_id
       AND NEW.data_pagamento = OLD.data_pagamento AND NEW.origem = OLD.origem
       AND NEW.idempotency_key = OLD.idempotency_key AND NEW.legado = OLD.legado THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Pagamentos de fatura não podem ser alterados. O único ajuste permitido é o estorno.'
      USING ERRCODE = 'FP001',
            HINT = 'Use estornar_pagamento_fatura.';
  END IF;

  IF current_user IN ('authenticated', 'anon', 'service_role')
     AND NOT public.fatura_liberacao_ativa('zerar') THEN
    RAISE EXCEPTION 'Pagamentos de fatura não podem ser apagados. Use o estorno.'
      USING ERRCODE = 'FP001',
            HINT = 'Use estornar_pagamento_fatura.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS ab_fatura_guardar_historico ON public.compras_cartao;
CREATE TRIGGER ab_fatura_guardar_historico BEFORE INSERT OR UPDATE OR DELETE ON public.compras_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_guardar_historico();
DROP TRIGGER IF EXISTS zz_fatura_auditar_historico ON public.compras_cartao;
CREATE TRIGGER zz_fatura_auditar_historico AFTER INSERT OR UPDATE OR DELETE ON public.compras_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_auditar_historico();

DROP TRIGGER IF EXISTS ab_fatura_guardar_historico ON public.parcelamentos;
CREATE TRIGGER ab_fatura_guardar_historico BEFORE INSERT OR UPDATE OR DELETE ON public.parcelamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_guardar_historico();
DROP TRIGGER IF EXISTS zz_fatura_auditar_historico ON public.parcelamentos;
CREATE TRIGGER zz_fatura_auditar_historico AFTER INSERT OR UPDATE OR DELETE ON public.parcelamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_auditar_historico();

DROP TRIGGER IF EXISTS ab_fatura_guardar_historico ON public.faturas_cartao;
CREATE TRIGGER ab_fatura_guardar_historico BEFORE INSERT OR UPDATE OR DELETE ON public.faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_guardar_historico();
DROP TRIGGER IF EXISTS zz_fatura_auditar_historico ON public.faturas_cartao;
CREATE TRIGGER zz_fatura_auditar_historico AFTER INSERT OR UPDATE OR DELETE ON public.faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_auditar_historico();

DROP TRIGGER IF EXISTS ab_fatura_proteger_cartao ON public.cartoes;
CREATE TRIGGER ab_fatura_proteger_cartao BEFORE DELETE ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_proteger_cartao();
DROP TRIGGER IF EXISTS ab_fatura_proteger_cartao_fechamento ON public.cartoes;
CREATE TRIGGER ab_fatura_proteger_cartao_fechamento BEFORE UPDATE OF dia_fechamento ON public.cartoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_proteger_cartao();

DROP TRIGGER IF EXISTS ab_ajustes_fatura_imutavel ON public.ajustes_fatura;
CREATE TRIGGER ab_ajustes_fatura_imutavel BEFORE UPDATE OR DELETE ON public.ajustes_fatura
  FOR EACH ROW EXECUTE FUNCTION public.trg_ajustes_fatura_imutavel();

DROP TRIGGER IF EXISTS ab_pagamentos_fatura_imutavel ON public.pagamentos_fatura;
CREATE TRIGGER ab_pagamentos_fatura_imutavel BEFORE UPDATE OR DELETE ON public.pagamentos_fatura
  FOR EACH ROW EXECUTE FUNCTION public.trg_pagamentos_fatura_imutavel();

-- ------------------------------------------------------------
-- 8. RPC: alterar_historico_fatura (único caminho para mexer em fatura quitada)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.alterar_historico_fatura(
  p_tabela  TEXT,
  p_id      UUID,
  p_acao    TEXT,
  p_dados   JSONB,
  p_motivo  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_motivo  TEXT := btrim(COALESCE(p_motivo, ''));
  v_reg     JSONB;
  v_novo    JSONB;
  v_orig    UUID;
  v_dest    UUID;
  v_chave   TEXT;
  v_permit  TEXT[];
  v_ref     JSONB;
  v_ajustes INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Alteração de histórico de fatura exige isolamento READ COMMITTED (atual: %). Repita em nova transação.',
      current_setting('transaction_isolation')
      USING ERRCODE = '25006';
  END IF;
  IF char_length(v_motivo) NOT BETWEEN 5 AND 300 THEN
    RAISE EXCEPTION 'Informe o motivo da alteração (entre 5 e 300 caracteres)' USING ERRCODE = '22023';
  END IF;
  IF p_tabela IS NULL OR p_tabela NOT IN ('compras_cartao', 'parcelamentos', 'faturas_cartao') THEN
    RAISE EXCEPTION 'Tabela inválida: %', COALESCE(p_tabela, 'NULL') USING ERRCODE = '22023';
  END IF;
  IF p_acao IS NULL OR p_acao NOT IN ('editar', 'excluir') THEN
    RAISE EXCEPTION 'Ação inválida: use editar ou excluir' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Registro não informado' USING ERRCODE = '22023';
  END IF;

  IF p_acao = 'editar' THEN
    IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' OR p_dados = '{}'::jsonb THEN
      RAISE EXCEPTION 'Informe os campos a alterar' USING ERRCODE = '22023';
    END IF;
    v_permit := CASE p_tabela
      WHEN 'compras_cartao' THEN ARRAY['descricao', 'valor_total', 'data_compra', 'numero_parcelas', 'categoria_id', 'subcategoria_id', 'cartao_id']
      WHEN 'parcelamentos'  THEN ARRAY['descricao', 'valor_total', 'numero_parcelas', 'primeira_parcela', 'categoria_id', 'quitado_em', 'cartao_id']
      ELSE ARRAY['valor_total']
    END;
    FOR v_chave IN SELECT jsonb_object_keys(p_dados) LOOP
      IF NOT (v_chave = ANY (v_permit)) THEN
        RAISE EXCEPTION 'Campo não permitido para alteração: %', v_chave USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  -- Leitura prévia (sem lock) só para descobrir o cartão de origem.
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1 AND t.usuario_id = $2', p_tabela)
    INTO v_reg USING p_id, v_uid;
  IF v_reg IS NULL THEN
    RAISE EXCEPTION 'Registro não encontrado' USING ERRCODE = '42501';
  END IF;
  v_orig := NULLIF(v_reg->>'cartao_id', '')::uuid;
  IF p_acao = 'editar' AND p_dados ? 'cartao_id' THEN
    v_dest := NULLIF(p_dados->>'cartao_id', '')::uuid;
    IF v_dest IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.cartoes c WHERE c.id = v_dest AND c.usuario_id = v_uid) THEN
      RAISE EXCEPTION 'Cartão de destino não encontrado' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Mesma ordem global dos triggers aa_fatura_travar_usuario da 000001: TODOS os cartões do
  -- usuário em ordem ascendente de id, antes de qualquer DML. Travar só origem e destino e deixar
  -- o trigger de statement travar o resto depois inverteria a ordem (deadlock com DML comum do
  -- mesmo usuário). Cobre também o cartão de destino. Os travamentos seguintes do trigger
  -- reaproveitam locks que esta transação já tem.
  PERFORM public.travar_cartoes_fatura(
    ARRAY(SELECT c.id FROM public.cartoes c WHERE c.usuario_id = v_uid ORDER BY c.id), v_uid);

  -- Relê já sob lock (o registro pode ter mudado ou sumido enquanto esperava).
  v_reg := NULL;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1 AND t.usuario_id = $2', p_tabela)
    INTO v_reg USING p_id, v_uid;
  IF v_reg IS NULL THEN
    RAISE EXCEPTION 'Registro não encontrado' USING ERRCODE = '42501';
  END IF;
  -- O cartão do registro não pode ter mudado entre a leitura prévia e o lock (só ocorreria por DML
  -- sem auth.uid(), que não segue o lock por usuário): se mudou, a decisão foi tomada com dados
  -- velhos. Erro repetível (mesmo código de "fatura desatualizada").
  IF NULLIF(v_reg->>'cartao_id', '')::uuid IS DISTINCT FROM v_orig THEN
    RAISE EXCEPTION 'O registro mudou de cartão durante a operação. Repita.' USING ERRCODE = '40001';
  END IF;

  IF p_acao = 'editar' THEN
    -- A função roda como dono (sem RLS): valida a posse das referências recebidas.
    IF p_dados ? 'categoria_id' AND NULLIF(p_dados->>'categoria_id', '') IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.categorias k
                      WHERE k.id = (p_dados->>'categoria_id')::uuid
                        AND (k.usuario_id IS NULL OR k.usuario_id = v_uid)) THEN
        RAISE EXCEPTION 'Categoria não encontrada' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF p_dados ? 'subcategoria_id' AND NULLIF(p_dados->>'subcategoria_id', '') IS NOT NULL THEN
      -- A definição de subcategorias não está versionada neste repositório: se a tabela tiver
      -- usuario_id, exige que seja do dono; se não tiver, apenas exige que exista.
      EXECUTE 'SELECT to_jsonb(s) FROM public.subcategorias s WHERE s.id = $1'
        INTO v_ref USING (p_dados->>'subcategoria_id')::uuid;
      IF v_ref IS NULL OR (v_ref ? 'usuario_id' AND v_ref->>'usuario_id' IS NOT NULL
                           AND (v_ref->>'usuario_id')::uuid <> v_uid) THEN
        RAISE EXCEPTION 'Subcategoria não encontrada' USING ERRCODE = '42501';
      END IF;
    END IF;
    v_novo := v_reg || p_dados;
  END IF;

  -- Mesma poda de liberar_historico_zerar: sobras de outras transações do usuário e linhas antigas.
  DELETE FROM public._fatura_liberacoes
   WHERE criado_em < NOW() - INTERVAL '1 hour'
      OR (usuario_id = v_uid AND txid <> txid_current())
      OR (usuario_id = v_uid AND txid = txid_current() AND escopo = 'controlado');
  INSERT INTO public._fatura_liberacoes (txid, usuario_id, escopo, motivo)
  VALUES (txid_current(), v_uid, 'controlado', v_motivo);

  IF p_acao = 'excluir' THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND usuario_id = $2', p_tabela)
      USING p_id, v_uid;
  ELSIF p_tabela = 'compras_cartao' THEN
    UPDATE public.compras_cartao t
       SET descricao = r.descricao, valor_total = r.valor_total, data_compra = r.data_compra,
           numero_parcelas = r.numero_parcelas, categoria_id = r.categoria_id,
           subcategoria_id = r.subcategoria_id, cartao_id = r.cartao_id
      FROM jsonb_populate_record(NULL::public.compras_cartao, v_novo) r
     WHERE t.id = p_id AND t.usuario_id = v_uid;
  ELSIF p_tabela = 'parcelamentos' THEN
    UPDATE public.parcelamentos t
       SET descricao = r.descricao, valor_total = r.valor_total, numero_parcelas = r.numero_parcelas,
           primeira_parcela = r.primeira_parcela, categoria_id = r.categoria_id,
           quitado_em = r.quitado_em, cartao_id = r.cartao_id
      FROM jsonb_populate_record(NULL::public.parcelamentos, v_novo) r
     WHERE t.id = p_id AND t.usuario_id = v_uid;
  ELSE
    UPDATE public.faturas_cartao t
       SET valor_total = r.valor_total
      FROM jsonb_populate_record(NULL::public.faturas_cartao, v_novo) r
     WHERE t.id = p_id AND t.usuario_id = v_uid;
  END IF;

  -- Linhas da razão geradas nesta transação (xmin é o xid de 32 bits da transação atual).
  SELECT count(*)::int INTO v_ajustes FROM public.ajustes_fatura a
   WHERE a.usuario_id = v_uid
     AND a.xmin::text::bigint = (txid_current() % 4294967296);

  DELETE FROM public._fatura_liberacoes
   WHERE txid = txid_current() AND usuario_id = v_uid AND escopo = 'controlado';

  RETURN jsonb_build_object('ok', TRUE, 'ajustes', v_ajustes, 'tabela', p_tabela, 'acao', p_acao, 'id', p_id);
END;
$$;

-- ------------------------------------------------------------
-- 9. Estorno com motivo opcional (2 argumentos, sem DEFAULT para não ficar ambígua)
-- A versão de 1 argumento passa a chamar a de 2 (CREATE OR REPLACE, sem DROP).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_pagamento_fatura(p_pagamento_id UUID, p_motivo TEXT)
RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_cartao UUID;
  v_pg     public.pagamentos_fatura;
  v_motivo TEXT := NULLIF(btrim(COALESCE(p_motivo, '')), '');
  v_pago   NUMERIC(12,2);
  v_total  NUMERIC(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF v_motivo IS NOT NULL AND char_length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'Motivo do estorno acima de 300 caracteres' USING ERRCODE = '22023';
  END IF;

  SELECT cartao_id INTO v_cartao FROM public.pagamentos_fatura
   WHERE id = p_pagamento_id AND usuario_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = '42501';
  END IF;

  IF public.travar_cartoes_fatura(ARRAY[v_cartao], v_uid) = 0 THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pg FROM public.pagamentos_fatura
   WHERE id = p_pagamento_id AND usuario_id = v_uid
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_pg.status = 'estornado' THEN
    RAISE EXCEPTION 'Pagamento já estornado' USING ERRCODE = '23505';
  END IF;

  UPDATE public.pagamentos_fatura
     SET status = 'estornado', estornado_em = NOW()
   WHERE id = p_pagamento_id
  RETURNING * INTO v_pg;

  SELECT COALESCE(SUM(pg.valor), 0) INTO v_pago FROM public.pagamentos_fatura pg
   WHERE pg.usuario_id = v_uid AND pg.cartao_id = v_pg.cartao_id
     AND pg.ano_mes = v_pg.ano_mes AND pg.status = 'ativo';
  v_total := public.total_fatura_ciclo_servidor(v_pg.cartao_id, v_uid, v_pg.ano_mes);

  INSERT INTO public.ajustes_fatura
    (usuario_id, cartao_id, ano_mes, tipo, valor, tabela_origem, registro_id,
     pago_ativo, total_depois, via, motivo, pagamento_id)
  VALUES
    (v_uid, v_pg.cartao_id, v_pg.ano_mes, 'estorno', v_pg.valor, 'pagamentos_fatura', v_pg.id,
     v_pago, v_total, 'controlado', v_motivo, v_pg.id);

  PERFORM public.reconciliar_credito_fatura(v_pg.cartao_id, v_uid, v_pg.ano_mes, v_pg.id, v_motivo, 'controlado');

  RETURN v_pg;
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_pagamento_fatura(p_pagamento_id UUID)
RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.estornar_pagamento_fatura(p_pagamento_id, NULL::text);
END;
$$;

-- ------------------------------------------------------------
-- 10. zerar_dados_financeiros: corpo de 2026-11_rpc_zerar_dados_financeiros_CORRECAO_FINAL.sql
-- (SECURITY INVOKER, search_path, auth.uid(), EXCEPTION, ordem dos DELETEs e GRANT mantidos),
-- acrescido da liberação transacional 'zerar' logo após validar auth.uid() e do seu
-- encerramento antes do RETURN. Pagamentos e razão saem por cascata de FK ao apagar cartoes
-- (a cascata roda como dono; não é preciso GRANT de DELETE). O nome deste arquivo ordena
-- depois de '2026-11_...', então esta é a definição final.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zerar_dados_financeiros()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER  -- Roda com os privilégios do usuário autenticado (RLS aplicado)
SET search_path = public  -- Previne SQL injection via search_path
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INTEGER;
BEGIN
  -- 1. Valida autenticação: obrigatório ter usuário logado
  v_usuario_id := auth.uid();

  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. É necessário estar logado para executar esta operação.'
      USING HINT = 'Faça login e tente novamente.';
  END IF;

  -- Libera, só nesta transação e só para este usuário, a guarda do histórico de faturas pagas.
  PERFORM public.liberar_historico_zerar();

  -- 2. Exclusão em ORDEM correta (foreign keys: filhos antes dos pais)
  -- Cada DELETE é protegido por RLS automaticamente (SECURITY INVOKER).
  -- Qualquer erro (permissão, FK, timeout) causará ROLLBACK de toda a transação.

  -- Histórico de importações (filhos primeiro)
  DELETE FROM public.importacoes_itens WHERE usuario_id = v_usuario_id;
  DELETE FROM public.importacoes WHERE usuario_id = v_usuario_id;

  -- Metas vinculadas a investimentos (CONDICIONAL: só se a tabela existir)
  IF to_regclass('public.metas_investimentos') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.metas_investimentos WHERE usuario_id = $1'
      USING v_usuario_id;
  END IF;

  -- Amortizações de parcelamentos
  DELETE FROM public.amortizacoes WHERE usuario_id = v_usuario_id;

  -- Movimentações de benefícios e investimentos
  DELETE FROM public.beneficios_movimentacoes WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos_movimentacoes WHERE usuario_id = v_usuario_id;

  -- Faturas e exceções (dependem de cartões/despesas)
  DELETE FROM public.faturas_cartao WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas_tipo_excecoes WHERE usuario_id = v_usuario_id;

  -- Compras de cartão
  DELETE FROM public.compras_cartao WHERE usuario_id = v_usuario_id;

  -- Entidades principais
  DELETE FROM public.beneficios WHERE usuario_id = v_usuario_id;
  DELETE FROM public.parcelamentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.despesas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.receitas WHERE usuario_id = v_usuario_id;
  DELETE FROM public.investimentos WHERE usuario_id = v_usuario_id;
  DELETE FROM public.metas WHERE usuario_id = v_usuario_id;
  -- Cartões: pagamentos_fatura e ajustes_fatura saem por cascata de FK.
  DELETE FROM public.cartoes WHERE usuario_id = v_usuario_id;

  -- Categorias personalizadas (usuario_id não nulo)
  -- Categorias padrão (usuario_id IS NULL) são preservadas
  DELETE FROM public.categorias WHERE usuario_id = v_usuario_id;

  -- 3. Reseta campos financeiros no perfil
  -- Mantém: nome, email, cor_tema, papel, ativo, datas de auditoria
  UPDATE public.perfis
  SET
    saldo_base = NULL,
    saldo_base_data = NULL,
    reserva_atual = 0,
    meta_reserva = 0,
    reserva_percentual = 20,
    reserva_configurada = FALSE,
    modo_limite = 'auto',
    limite_diario = NULL,
    onboarding_concluido = FALSE,
    atualizado_em = NOW()
  WHERE id = v_usuario_id;

  -- 4. Valida que o perfil foi atualizado
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Perfil não encontrado para o usuário autenticado.'
      USING HINT = 'Verifique se o perfil existe na tabela public.perfis.';
  END IF;

  -- Encerra a liberação antes de devolver (ela também some em rollback e é podada após 1 hora).
  PERFORM public.encerrar_liberacao_zerar();

  -- 5. Sucesso: retorna TRUE
  RETURN TRUE;

EXCEPTION
  WHEN OTHERS THEN
    -- Qualquer erro causa rollback automático de toda a transação
    RAISE EXCEPTION 'Erro ao zerar dados financeiros: % (SQLSTATE: %)',
      SQLERRM, SQLSTATE
      USING HINT = 'A operação foi revertida completamente. Nenhum dado foi excluído.';
END;
$$;

COMMENT ON FUNCTION public.zerar_dados_financeiros() IS
'Exclui TODOS os dados financeiros do usuário autenticado de forma transacional (atômica).
SECURITY INVOKER (RLS aplicado), auth.uid() obrigatório, search_path fixo, rollback completo em qualquer erro.
Integridade histórica (20261124000002): libera a guarda de faturas pagas apenas nesta transação e para este usuário
(liberar_historico_zerar/encerrar_liberacao_zerar). Pagamentos e ajustes_fatura saem por cascata ao apagar cartoes.
Mantém categorias padrão e os dados de conta (nome, email, papel).';

-- ------------------------------------------------------------
-- 11. Permissões (todas as funções DEFINER com search_path fixo; REVOKE explícito)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.fatura_liberacao_ativa(TEXT) FROM PUBLIC, anon, authenticated;
-- Os triggers INVOKER (ajustes_fatura, pagamentos_fatura) a chamam com o papel do cliente.
GRANT EXECUTE ON FUNCTION public.fatura_liberacao_ativa(TEXT) TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public._fatura_contexto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.competencias_pagas_registro(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fatura_campos_relevantes(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fatura_mudanca_relevante(TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._fatura_recusar_se_quitada(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconciliar_credito_fatura(UUID, UUID, TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fatura_guardar_historico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fatura_auditar_historico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fatura_proteger_cartao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_ajustes_fatura_imutavel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_pagamentos_fatura_imutavel() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.liberar_historico_zerar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.liberar_historico_zerar() TO authenticated;
REVOKE ALL ON FUNCTION public.encerrar_liberacao_zerar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encerrar_liberacao_zerar() TO authenticated;

REVOKE ALL ON FUNCTION public.alterar_historico_fatura(TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_historico_fatura(TEXT, UUID, TEXT, JSONB, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.estornar_pagamento_fatura(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_fatura(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.estornar_pagamento_fatura(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_fatura(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.zerar_dados_financeiros() FROM anon;
GRANT EXECUTE ON FUNCTION public.zerar_dados_financeiros() TO authenticated;
