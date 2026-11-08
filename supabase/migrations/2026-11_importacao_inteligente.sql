-- ============================================================
-- Migration: Importação Inteligente de dados financeiros
-- ============================================================
-- O QUE CRIA
--   • public.importacoes                 — histórico de cada importação
--   • public.importacoes_itens           — vínculo item importado → registro criado
--                                          (permite reconhecer reimportações e desfazer)
--   • public.importacao_regras_categoria — aprendizado de categorias POR USUÁRIO
--   • investimentos_movimentacoes.afeta_saldo (BOOLEAN, padrão TRUE)
--   • RPCs: importacao_confirmar(jsonb), importacao_desfazer(uuid)
--
-- PRIVACIDADE / LGPD
--   • O ARQUIVO do usuário NUNCA chega ao banco: é lido no aparelho, dentro de
--     um Web Worker. Aqui guardamos só o hash SHA-256, o formato e o tamanho
--     (para avisar reimportação do mesmo arquivo) e os lançamentos CONFIRMADOS.
--   • Retenção: o histórico (importacoes + itens) expira em 365 dias
--     (coluna expira_em) e é apagado automaticamente na próxima importação do
--     usuário. Os lançamentos financeiros importados NÃO expiram.
--   • RLS dono-only em todas as tabelas. Regras aprendidas nunca são
--     compartilhadas entre usuários.
--
-- SEGURANÇA
--   • RPCs com SECURITY INVOKER: rodam com as permissões do usuário logado, ou
--     seja, TODA escrita passa pelas policies RLS já existentes (despesas,
--     receitas, compras_cartao, investimentos...). Nenhuma chave de serviço.
--   • Validação no servidor de todos os campos (tipos, limites, tamanho,
--     propriedade de cartão/categoria/investimento) e limite de 2.000 itens.
--   • Tudo em UMA transação: ou grava a importação inteira, ou nada.
--
-- COMPATIBILIDADE
--   • afeta_saldo = TRUE (padrão) mantém o comportamento atual de todas as
--     movimentações existentes. Movimentações IMPORTADAS são gravadas com
--     afeta_saldo = FALSE: entram no histórico sem somar ao valor da posição
--     (o valor só muda por conciliação explícita da posição).
--   • NÃO altera nem apaga dados existentes. Idempotente.
--   • NÃO executar automaticamente. Aplicar no SQL Editor do Supabase
--     (staging primeiro), depois rodar supabase/tests/importacao-rls.test.sql.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0) Coluna de compatibilidade nas movimentações de investimento
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.investimentos_movimentacoes
  ADD COLUMN IF NOT EXISTS afeta_saldo BOOLEAN NOT NULL DEFAULT TRUE;

-- ────────────────────────────────────────────────────────────
-- 1) Tabelas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.importacoes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id          UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_documento      TEXT NOT NULL CHECK (tipo_documento IN ('extrato_bancario','fatura_cartao','extrato_investimentos')),
  instituicao         TEXT CHECK (instituicao IS NULL OR char_length(instituicao) <= 80),
  -- [{ formato, hash (sha-256 hex), tamanho (bytes) }] — nunca o conteúdo.
  arquivos            JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(arquivos) = 'array'),
  periodo_inicio      DATE,
  periodo_fim         DATE,
  total_identificados INTEGER NOT NULL DEFAULT 0 CHECK (total_identificados >= 0),
  total_aceitos       INTEGER NOT NULL DEFAULT 0 CHECK (total_aceitos >= 0),
  total_ignorados     INTEGER NOT NULL DEFAULT 0 CHECK (total_ignorados >= 0),
  total_duplicados    INTEGER NOT NULL DEFAULT 0 CHECK (total_duplicados >= 0),
  status              TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('concluida','desfeita','desfeita_parcial')),
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  desfeita_em         TIMESTAMPTZ,
  expira_em           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '365 days'),
  CONSTRAINT importacoes_id_usuario_unico UNIQUE (id, usuario_id)
);

CREATE TABLE IF NOT EXISTS public.importacoes_itens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  importacao_id     UUID NOT NULL,
  tabela            TEXT NOT NULL CHECK (tabela IN ('despesas','receitas','compras_cartao','investimentos','investimentos_movimentacoes')),
  registro_id       UUID NOT NULL,
  acao              TEXT NOT NULL CHECK (acao IN ('criado','complementado','substituido','conciliado')),
  impressao_digital TEXT CHECK (impressao_digital IS NULL OR char_length(impressao_digital) <= 128),
  -- md5 do registro logo após a importação: se mudar, o usuário editou
  -- depois, e o desfazer PRESERVA o registro.
  hash_registro     TEXT NOT NULL,
  -- Estado anterior (só para complementado/substituido/conciliado).
  dados_anteriores  JSONB,
  situacao          TEXT NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','desfeito','mantido_alterado','ja_removido')),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT importacoes_itens_da_importacao_do_dono
    FOREIGN KEY (importacao_id, usuario_id)
    REFERENCES public.importacoes (id, usuario_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.importacao_regras_categoria (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  destino        TEXT NOT NULL CHECK (destino IN ('despesas','receitas','compras_cartao')),
  padrao         TEXT NOT NULL CHECK (char_length(padrao) BETWEEN 2 AND 80),
  categoria_id   UUID REFERENCES public.categorias(id) ON DELETE CASCADE,
  categoria_nome TEXT CHECK (categoria_nome IS NULL OR char_length(categoria_nome) <= 60),
  usos           INTEGER NOT NULL DEFAULT 1 CHECK (usos >= 1),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT importacao_regras_unica UNIQUE (usuario_id, destino, padrao)
);

CREATE INDEX IF NOT EXISTS idx_importacoes_usuario ON public.importacoes (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_importacoes_itens_importacao ON public.importacoes_itens (importacao_id);
CREATE INDEX IF NOT EXISTS idx_importacoes_itens_impressao ON public.importacoes_itens (usuario_id, impressao_digital)
  WHERE impressao_digital IS NOT NULL;

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacoes_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_regras_categoria ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='importacoes'
                 AND policyname='Importações: apenas o dono') THEN
    CREATE POLICY "Importações: apenas o dono" ON public.importacoes FOR ALL
      USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='importacoes_itens'
                 AND policyname='Itens de importação: apenas o dono') THEN
    CREATE POLICY "Itens de importação: apenas o dono" ON public.importacoes_itens FOR ALL
      USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='importacao_regras_categoria'
                 AND policyname='Regras de categoria: apenas o dono') THEN
    CREATE POLICY "Regras de categoria: apenas o dono" ON public.importacao_regras_categoria FOR ALL
      USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
  END IF;
END $$;

REVOKE ALL ON public.importacoes, public.importacoes_itens, public.importacao_regras_categoria FROM anon;

-- ────────────────────────────────────────────────────────────
-- 2) Funções auxiliares de validação (puras)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importacao_texto(p TEXT, p_max INTEGER, p_obrigatorio BOOLEAN DEFAULT FALSE)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v TEXT;
BEGIN
  v := btrim(regexp_replace(COALESCE(p, ''), '[[:cntrl:]]', ' ', 'g'));
  v := regexp_replace(v, '\s+', ' ', 'g');
  v := left(v, p_max);
  IF v = '' THEN
    IF p_obrigatorio THEN RAISE EXCEPTION 'texto obrigatório ausente'; END IF;
    RETURN NULL;
  END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.importacao_valor(p TEXT)
RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE v NUMERIC;
BEGIN
  IF p IS NULL OR p !~ '^-?[0-9]+(\.[0-9]+)?$' THEN RAISE EXCEPTION 'valor inválido'; END IF;
  v := ROUND(p::NUMERIC, 2);
  IF v <= 0 OR v > 1000000000 THEN RAISE EXCEPTION 'valor fora do limite'; END IF;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.importacao_data(p TEXT, p_obrigatoria BOOLEAN DEFAULT TRUE)
RETURNS DATE LANGUAGE plpgsql STABLE SET search_path = public, pg_temp AS $$
DECLARE v DATE;
BEGIN
  IF p IS NULL OR p = '' THEN
    IF p_obrigatoria THEN RAISE EXCEPTION 'data ausente'; END IF;
    RETURN NULL;
  END IF;
  IF p !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'data inválida'; END IF;
  v := p::DATE;
  IF v < DATE '1990-01-01' OR v > CURRENT_DATE + 400 THEN RAISE EXCEPTION 'data fora do limite'; END IF;
  RETURN v;
END $$;

-- md5 do registro do PRÓPRIO usuário (NULL se não existir / não for dele).
CREATE OR REPLACE FUNCTION public.importacao_hash(p_tabela TEXT, p_id UUID)
RETURNS TEXT LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE v TEXT;
BEGIN
  IF p_tabela NOT IN ('despesas','receitas','compras_cartao','investimentos','investimentos_movimentacoes') THEN
    RAISE EXCEPTION 'tabela não permitida';
  END IF;
  EXECUTE format('SELECT md5(to_jsonb(t)::text) FROM public.%I t WHERE t.id = $1 AND t.usuario_id = $2', p_tabela)
    INTO v USING p_id, auth.uid();
  RETURN v;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3) RPC: confirmar importação (grava tudo em uma transação)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.importacao_confirmar(p_dados JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_tipo      TEXT;
  v_itens     JSONB;
  v_arquivos  JSONB;
  v_regras    JSONB;
  v_imp_id    UUID;
  v_item      JSONB;
  v_d         JSONB;
  v_regra     JSONB;
  v_arq       JSONB;
  v_idx       INTEGER := 0;
  v_acao      TEXT;
  v_tabela    TEXT;
  v_reg_id    UUID;
  v_refs      JSONB := '{}'::jsonb;
  v_cat       UUID;
  v_cat_txt   TEXT;
  v_inv       UUID;
  v_n         INTEGER;
  v_ant       JSONB;
  v_qtd       NUMERIC;
  v_preco     NUMERIC;
  v_criados   INTEGER := 0;
  v_alterados INTEGER := 0;
  v_regras_n  INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado. Faça login novamente.' USING ERRCODE = '42501';
  END IF;
  IF (SELECT to_jsonb(p)->>'ativo' FROM public.perfis p WHERE p.id = v_uid) = 'false' THEN
    RAISE EXCEPTION 'Conta desativada.' USING ERRCODE = '42501';
  END IF;
  IF p_dados IS NULL OR jsonb_typeof(p_dados) <> 'object' THEN
    RAISE EXCEPTION 'Dados da importação inválidos.' USING ERRCODE = '22023';
  END IF;
  IF octet_length(p_dados::text) > 3000000 THEN
    RAISE EXCEPTION 'Importação grande demais. Divida em arquivos menores.' USING ERRCODE = '22023';
  END IF;

  v_tipo := p_dados->>'tipo_documento';
  IF v_tipo IS NULL OR v_tipo NOT IN ('extrato_bancario','fatura_cartao','extrato_investimentos') THEN
    RAISE EXCEPTION 'Tipo de documento inválido.' USING ERRCODE = '22023';
  END IF;

  v_itens := p_dados->'itens';
  IF v_itens IS NULL OR jsonb_typeof(v_itens) <> 'array' OR jsonb_array_length(v_itens) = 0 THEN
    RAISE EXCEPTION 'Nenhum lançamento selecionado.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(v_itens) > 2000 THEN
    RAISE EXCEPTION 'Limite de 2.000 lançamentos por importação.' USING ERRCODE = '22023';
  END IF;

  v_arquivos := COALESCE(p_dados->'arquivos', '[]'::jsonb);
  IF jsonb_typeof(v_arquivos) <> 'array' OR jsonb_array_length(v_arquivos) > 5 THEN
    RAISE EXCEPTION 'Lista de arquivos inválida (máximo 5).' USING ERRCODE = '22023';
  END IF;
  FOR v_arq IN SELECT value FROM jsonb_array_elements(v_arquivos) LOOP
    IF COALESCE(v_arq->>'formato', '') NOT IN ('pdf','csv','ofx','xls','xlsx')
       OR COALESCE(v_arq->>'hash', '') !~ '^[0-9a-f]{64}$'
       OR COALESCE(v_arq->>'tamanho', '') !~ '^[0-9]{1,9}$'
       OR (v_arq->>'tamanho')::BIGINT NOT BETWEEN 1 AND 10485760 THEN
      RAISE EXCEPTION 'Metadados de arquivo inválidos.' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Retenção: remove o histórico expirado do próprio usuário.
  DELETE FROM public.importacoes WHERE usuario_id = v_uid AND expira_em < NOW();

  INSERT INTO public.importacoes (
    usuario_id, tipo_documento, instituicao, arquivos, periodo_inicio, periodo_fim,
    total_identificados, total_ignorados, total_duplicados
  ) VALUES (
    v_uid, v_tipo,
    public.importacao_texto(p_dados->>'instituicao', 80),
    COALESCE((SELECT jsonb_agg(jsonb_build_object('formato', a->>'formato', 'hash', a->>'hash', 'tamanho', (a->>'tamanho')::BIGINT))
              FROM jsonb_array_elements(v_arquivos) a), '[]'::jsonb),
    public.importacao_data(p_dados->>'periodo_inicio', FALSE),
    public.importacao_data(p_dados->>'periodo_fim', FALSE),
    LEAST(GREATEST(COALESCE((p_dados->>'total_identificados')::INTEGER, 0), 0), 100000),
    LEAST(GREATEST(COALESCE((p_dados->>'total_ignorados')::INTEGER, 0), 0), 100000),
    LEAST(GREATEST(COALESCE((p_dados->>'total_duplicados')::INTEGER, 0), 0), 100000)
  ) RETURNING id INTO v_imp_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_itens) LOOP
    v_idx := v_idx + 1;
    BEGIN
      v_acao   := v_item->>'acao';
      v_tabela := v_item->>'tabela';
      v_d      := v_item->'dados';
      v_reg_id := NULL;
      v_ant    := NULL;
      IF v_d IS NULL OR jsonb_typeof(v_d) <> 'object' THEN RAISE EXCEPTION 'dados ausentes'; END IF;

      -- Categoria de despesa/cartão: precisa ser visível ao usuário
      -- (sistema ou própria — a RLS de categorias garante isso).
      v_cat := NULLIF(v_d->>'categoria_id', '')::UUID;
      IF v_cat IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = v_cat) THEN
        RAISE EXCEPTION 'categoria inválida';
      END IF;

      IF v_acao = 'criar' THEN
        IF v_tabela = 'despesas' THEN
          INSERT INTO public.despesas (usuario_id, descricao, valor, data, categoria_id, tipo_despesa, forma_pagamento, frequencia, recorrente)
          VALUES (
            v_uid,
            public.importacao_texto(v_d->>'descricao', 200, TRUE),
            public.importacao_valor(v_d->>'valor'),
            public.importacao_data(v_d->>'data'),
            v_cat,
            CASE WHEN v_d->>'tipo_despesa' = 'fixa' THEN 'fixa' ELSE 'variavel' END,
            CASE WHEN v_d->>'forma_pagamento' IN ('cartao_credito','cartao_debito','pix','boleto','debito_automatico','transferencia')
                 THEN v_d->>'forma_pagamento' END,
            'nao_repete', FALSE
          ) RETURNING id INTO v_reg_id;

        ELSIF v_tabela = 'receitas' THEN
          INSERT INTO public.receitas (usuario_id, descricao, valor, data, categoria, recorrente, frequencia)
          VALUES (
            v_uid,
            public.importacao_texto(v_d->>'descricao', 200, TRUE),
            public.importacao_valor(v_d->>'valor'),
            public.importacao_data(v_d->>'data'),
            public.importacao_texto(v_d->>'categoria', 60),
            FALSE, 'nao_repete'
          ) RETURNING id INTO v_reg_id;

        ELSIF v_tabela = 'compras_cartao' THEN
          IF NOT EXISTS (SELECT 1 FROM public.cartoes c WHERE c.id = NULLIF(v_d->>'cartao_id', '')::UUID AND c.usuario_id = v_uid) THEN
            RAISE EXCEPTION 'cartão inválido';
          END IF;
          v_n := COALESCE(NULLIF(v_d->>'numero_parcelas', '')::INTEGER, 1);
          IF v_n < 1 OR v_n > 120 THEN RAISE EXCEPTION 'número de parcelas inválido'; END IF;
          INSERT INTO public.compras_cartao (usuario_id, cartao_id, descricao, valor_total, data_compra, numero_parcelas, categoria_id)
          VALUES (
            v_uid,
            (v_d->>'cartao_id')::UUID,
            public.importacao_texto(v_d->>'descricao', 200, TRUE),
            public.importacao_valor(v_d->>'valor_total'),
            public.importacao_data(v_d->>'data_compra'),
            v_n,
            v_cat
          ) RETURNING id INTO v_reg_id;

        ELSIF v_tabela = 'investimentos' THEN
          IF COALESCE(v_d->>'categoria', '') NOT IN ('tesouro','cdb','lci','lca','acoes','fii','etf','fundo','previdencia','outro') THEN
            RAISE EXCEPTION 'categoria de investimento inválida';
          END IF;
          v_qtd := NULLIF(v_d->>'quantidade', '')::NUMERIC;
          v_preco := NULLIF(v_d->>'preco_unitario', '')::NUMERIC;
          IF v_qtd IS NOT NULL AND (v_qtd < 0 OR v_qtd > 1e12) THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
          IF v_preco IS NOT NULL AND (v_preco < 0 OR v_preco > 1e9) THEN RAISE EXCEPTION 'preço inválido'; END IF;
          INSERT INTO public.investimentos (usuario_id, nome, instituicao, categoria, valor_aplicado, valor_atual, quantidade, preco_unitario, data_aplicacao)
          VALUES (
            v_uid,
            public.importacao_texto(v_d->>'nome', 120, TRUE),
            public.importacao_texto(v_d->>'instituicao', 80),
            v_d->>'categoria',
            LEAST(GREATEST(ROUND(COALESCE(NULLIF(v_d->>'valor_aplicado', '')::NUMERIC, 0), 2), 0), 1000000000),
            LEAST(GREATEST(ROUND(COALESCE(NULLIF(v_d->>'valor_atual', '')::NUMERIC, 0), 2), 0), 1000000000),
            v_qtd, v_preco,
            public.importacao_data(v_d->>'data_aplicacao', FALSE)
          ) RETURNING id INTO v_reg_id;
          IF COALESCE(v_item->>'ref', '') <> '' THEN
            v_refs := v_refs || jsonb_build_object(left(v_item->>'ref', 140), v_reg_id);
          END IF;

        ELSIF v_tabela = 'investimentos_movimentacoes' THEN
          v_inv := COALESCE(NULLIF(v_d->>'investimento_id', '')::UUID, NULLIF(v_refs->>(v_d->>'investimento_ref'), '')::UUID);
          IF v_inv IS NULL OR NOT EXISTS (SELECT 1 FROM public.investimentos i WHERE i.id = v_inv AND i.usuario_id = v_uid) THEN
            RAISE EXCEPTION 'investimento inválido';
          END IF;
          IF COALESCE(v_d->>'tipo', '') NOT IN ('aporte','resgate','rendimento','dividendo','juros','amortizacao') THEN
            RAISE EXCEPTION 'tipo de movimentação inválido';
          END IF;
          -- afeta_saldo = FALSE: histórico importado não soma ao valor da posição.
          INSERT INTO public.investimentos_movimentacoes (usuario_id, investimento_id, tipo, valor, data, descricao, afeta_saldo)
          VALUES (
            v_uid, v_inv, v_d->>'tipo',
            public.importacao_valor(v_d->>'valor'),
            public.importacao_data(v_d->>'data'),
            public.importacao_texto(v_d->>'descricao', 200),
            FALSE
          ) RETURNING id INTO v_reg_id;
        ELSE
          RAISE EXCEPTION 'destino inválido';
        END IF;
        v_criados := v_criados + 1;

      ELSIF v_acao IN ('complementar', 'substituir') THEN
        IF v_tabela NOT IN ('despesas','receitas','compras_cartao') THEN RAISE EXCEPTION 'destino inválido'; END IF;
        v_reg_id := NULLIF(v_item->>'registro_id', '')::UUID;
        EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE t.id = $1 AND t.usuario_id = $2', v_tabela)
          INTO v_ant USING v_reg_id, v_uid;
        IF v_ant IS NULL THEN RAISE EXCEPTION 'registro existente não encontrado'; END IF;

        IF v_acao = 'complementar' THEN
          -- Só preenche o que está vazio (hoje: categoria). Nada é sobrescrito.
          IF v_tabela = 'despesas' THEN
            UPDATE public.despesas SET categoria_id = COALESCE(categoria_id, v_cat) WHERE id = v_reg_id AND usuario_id = v_uid;
          ELSIF v_tabela = 'receitas' THEN
            v_cat_txt := public.importacao_texto(v_d->>'categoria', 60);
            UPDATE public.receitas SET categoria = COALESCE(NULLIF(categoria, ''), v_cat_txt) WHERE id = v_reg_id AND usuario_id = v_uid;
          ELSE
            UPDATE public.compras_cartao SET categoria_id = COALESCE(categoria_id, v_cat) WHERE id = v_reg_id AND usuario_id = v_uid;
          END IF;
        ELSE
          -- Substituir: proibido para lançamentos recorrentes (alteraria todos os meses).
          IF v_tabela IN ('despesas','receitas')
             AND (COALESCE((v_ant->>'recorrente')::BOOLEAN, FALSE) OR COALESCE(v_ant->>'frequencia', 'nao_repete') <> 'nao_repete') THEN
            RAISE EXCEPTION 'não é possível substituir um lançamento recorrente';
          END IF;
          IF v_tabela = 'despesas' THEN
            UPDATE public.despesas SET
              descricao = public.importacao_texto(v_d->>'descricao', 200, TRUE),
              valor = public.importacao_valor(v_d->>'valor'),
              data = public.importacao_data(v_d->>'data'),
              categoria_id = COALESCE(v_cat, categoria_id)
            WHERE id = v_reg_id AND usuario_id = v_uid;
          ELSIF v_tabela = 'receitas' THEN
            UPDATE public.receitas SET
              descricao = public.importacao_texto(v_d->>'descricao', 200, TRUE),
              valor = public.importacao_valor(v_d->>'valor'),
              data = public.importacao_data(v_d->>'data'),
              categoria = COALESCE(public.importacao_texto(v_d->>'categoria', 60), categoria)
            WHERE id = v_reg_id AND usuario_id = v_uid;
          ELSE
            IF NOT EXISTS (SELECT 1 FROM public.cartoes c WHERE c.id = NULLIF(v_d->>'cartao_id', '')::UUID AND c.usuario_id = v_uid) THEN
              RAISE EXCEPTION 'cartão inválido';
            END IF;
            v_n := COALESCE(NULLIF(v_d->>'numero_parcelas', '')::INTEGER, 1);
            IF v_n < 1 OR v_n > 120 THEN RAISE EXCEPTION 'número de parcelas inválido'; END IF;
            UPDATE public.compras_cartao SET
              descricao = public.importacao_texto(v_d->>'descricao', 200, TRUE),
              valor_total = public.importacao_valor(v_d->>'valor_total'),
              data_compra = public.importacao_data(v_d->>'data_compra'),
              numero_parcelas = v_n,
              categoria_id = COALESCE(v_cat, categoria_id)
            WHERE id = v_reg_id AND usuario_id = v_uid;
          END IF;
        END IF;
        v_alterados := v_alterados + 1;

      ELSIF v_acao = 'conciliar' THEN
        -- Conciliação explícita da posição: SUBSTITUI o valor atual (nunca soma).
        IF v_tabela <> 'investimentos' THEN RAISE EXCEPTION 'destino inválido'; END IF;
        v_reg_id := NULLIF(v_item->>'registro_id', '')::UUID;
        SELECT to_jsonb(i) INTO v_ant FROM public.investimentos i WHERE i.id = v_reg_id AND i.usuario_id = v_uid;
        IF v_ant IS NULL THEN RAISE EXCEPTION 'investimento não encontrado'; END IF;
        v_qtd := NULLIF(v_d->>'quantidade', '')::NUMERIC;
        IF v_qtd IS NOT NULL AND (v_qtd < 0 OR v_qtd > 1e12) THEN RAISE EXCEPTION 'quantidade inválida'; END IF;
        UPDATE public.investimentos SET
          valor_atual = public.importacao_valor(v_d->>'valor_atual'),
          quantidade = COALESCE(v_qtd, quantidade)
        WHERE id = v_reg_id AND usuario_id = v_uid;
        v_alterados := v_alterados + 1;
      ELSE
        RAISE EXCEPTION 'ação inválida';
      END IF;

      INSERT INTO public.importacoes_itens (usuario_id, importacao_id, tabela, registro_id, acao, impressao_digital, hash_registro, dados_anteriores)
      VALUES (
        v_uid, v_imp_id, v_tabela, v_reg_id,
        CASE v_acao WHEN 'criar' THEN 'criado' WHEN 'complementar' THEN 'complementado'
                    WHEN 'substituir' THEN 'substituido' ELSE 'conciliado' END,
        NULLIF(left(COALESCE(v_item->>'impressao', ''), 128), ''),
        public.importacao_hash(v_tabela, v_reg_id),
        v_ant
      );
    EXCEPTION WHEN OTHERS THEN
      -- Interrompe TODA a importação (rollback) indicando o item com problema.
      RAISE EXCEPTION 'Lançamento %: %', v_idx, SQLERRM USING ERRCODE = '22023';
    END;
  END LOOP;

  -- Aprendizado de categorias do usuário (no máximo 300 por importação).
  v_regras := COALESCE(p_dados->'regras', '[]'::jsonb);
  IF jsonb_typeof(v_regras) = 'array' THEN
    FOR v_regra IN SELECT value FROM jsonb_array_elements(v_regras) LIMIT 300 LOOP
      BEGIN
        IF COALESCE(v_regra->>'destino', '') NOT IN ('despesas','receitas','compras_cartao') THEN CONTINUE; END IF;
        IF char_length(COALESCE(v_regra->>'padrao', '')) NOT BETWEEN 2 AND 80 THEN CONTINUE; END IF;
        v_cat := NULLIF(v_regra->>'categoria_id', '')::UUID;
        IF v_regra->>'destino' <> 'receitas' AND (v_cat IS NULL OR NOT EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = v_cat)) THEN CONTINUE; END IF;
        IF v_regra->>'destino' = 'receitas' AND public.importacao_texto(v_regra->>'categoria_nome', 60) IS NULL THEN CONTINUE; END IF;
        INSERT INTO public.importacao_regras_categoria (usuario_id, destino, padrao, categoria_id, categoria_nome)
        VALUES (
          v_uid, v_regra->>'destino', upper(v_regra->>'padrao'),
          CASE WHEN v_regra->>'destino' = 'receitas' THEN NULL ELSE v_cat END,
          public.importacao_texto(v_regra->>'categoria_nome', 60)
        )
        ON CONFLICT (usuario_id, destino, padrao) DO UPDATE SET
          categoria_id = EXCLUDED.categoria_id,
          categoria_nome = EXCLUDED.categoria_nome,
          usos = public.importacao_regras_categoria.usos + 1,
          atualizado_em = NOW();
        v_regras_n := v_regras_n + 1;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE; -- regra inválida não impede a importação
      END;
    END LOOP;
  END IF;

  UPDATE public.importacoes SET total_aceitos = v_criados + v_alterados WHERE id = v_imp_id;

  RETURN jsonb_build_object(
    'importacao_id', v_imp_id,
    'criados', v_criados,
    'alterados', v_alterados,
    'regras', v_regras_n
  );
END $$;

-- ────────────────────────────────────────────────────────────
-- 4) RPC: desfazer importação (somente o que é seguro)
-- ────────────────────────────────────────────────────────────
-- Regras:
--   • Registro alterado depois da importação (hash diferente) → PRESERVADO.
--   • Registro já apagado pelo usuário → apenas marcado "ja_removido".
--   • Investimento criado pela importação só é apagado se não tiver outras
--     movimentações nem vínculo com metas.
--   • Complemento/substituição/conciliação → restaura o estado anterior.
CREATE OR REPLACE FUNCTION public.importacao_desfazer(p_importacao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_imp      public.importacoes%ROWTYPE;
  v_it       public.importacoes_itens%ROWTYPE;
  v_hash     TEXT;
  v_sit      TEXT;
  v_tem_meta BOOLEAN;
  v_desfeitos INTEGER := 0;
  v_mantidos  INTEGER := 0;
  v_removidos INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado. Faça login novamente.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_imp FROM public.importacoes WHERE id = p_importacao_id AND usuario_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Importação não encontrada.' USING ERRCODE = '22023'; END IF;
  IF v_imp.status = 'desfeita' THEN RAISE EXCEPTION 'Esta importação já foi desfeita.' USING ERRCODE = '22023'; END IF;

  FOR v_it IN
    SELECT * FROM public.importacoes_itens
    WHERE importacao_id = p_importacao_id AND usuario_id = v_uid AND situacao = 'ativo'
    ORDER BY CASE tabela WHEN 'investimentos_movimentacoes' THEN 0 WHEN 'investimentos' THEN 2 ELSE 1 END, criado_em DESC
  LOOP
    BEGIN
      v_hash := public.importacao_hash(v_it.tabela, v_it.registro_id);
      IF v_hash IS NULL THEN
        v_sit := 'ja_removido';
      ELSIF v_hash <> v_it.hash_registro THEN
        v_sit := 'mantido_alterado';
      ELSIF v_it.acao = 'criado' THEN
        IF v_it.tabela = 'investimentos' THEN
          v_tem_meta := FALSE;
          IF to_regclass('public.metas_investimentos') IS NOT NULL THEN
            EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.metas_investimentos WHERE investimento_id = $1)'
              INTO v_tem_meta USING v_it.registro_id;
          END IF;
          IF v_tem_meta OR EXISTS (SELECT 1 FROM public.investimentos_movimentacoes WHERE investimento_id = v_it.registro_id) THEN
            v_sit := 'mantido_alterado';
          ELSE
            DELETE FROM public.investimentos WHERE id = v_it.registro_id AND usuario_id = v_uid;
            v_sit := 'desfeito';
          END IF;
        ELSE
          EXECUTE format('DELETE FROM public.%I WHERE id = $1 AND usuario_id = $2', v_it.tabela)
            USING v_it.registro_id, v_uid;
          v_sit := 'desfeito';
        END IF;
      ELSE
        IF v_it.tabela = 'despesas' THEN
          UPDATE public.despesas d SET descricao = r.descricao, valor = r.valor, data = r.data, categoria_id = r.categoria_id
          FROM jsonb_populate_record(NULL::public.despesas, v_it.dados_anteriores) r
          WHERE d.id = v_it.registro_id AND d.usuario_id = v_uid;
        ELSIF v_it.tabela = 'receitas' THEN
          UPDATE public.receitas x SET descricao = r.descricao, valor = r.valor, data = r.data, categoria = r.categoria
          FROM jsonb_populate_record(NULL::public.receitas, v_it.dados_anteriores) r
          WHERE x.id = v_it.registro_id AND x.usuario_id = v_uid;
        ELSIF v_it.tabela = 'compras_cartao' THEN
          UPDATE public.compras_cartao x SET descricao = r.descricao, valor_total = r.valor_total, data_compra = r.data_compra,
            numero_parcelas = r.numero_parcelas, categoria_id = r.categoria_id
          FROM jsonb_populate_record(NULL::public.compras_cartao, v_it.dados_anteriores) r
          WHERE x.id = v_it.registro_id AND x.usuario_id = v_uid;
        ELSIF v_it.tabela = 'investimentos' THEN
          UPDATE public.investimentos x SET valor_atual = r.valor_atual, quantidade = r.quantidade
          FROM jsonb_populate_record(NULL::public.investimentos, v_it.dados_anteriores) r
          WHERE x.id = v_it.registro_id AND x.usuario_id = v_uid;
        END IF;
        v_sit := 'desfeito';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Qualquer bloqueio (ex.: regra de metas) preserva o registro.
      v_sit := 'mantido_alterado';
    END;

    UPDATE public.importacoes_itens SET situacao = v_sit WHERE id = v_it.id;
    IF v_sit = 'desfeito' THEN v_desfeitos := v_desfeitos + 1;
    ELSIF v_sit = 'ja_removido' THEN v_removidos := v_removidos + 1;
    ELSE v_mantidos := v_mantidos + 1;
    END IF;
  END LOOP;

  UPDATE public.importacoes
  SET status = CASE WHEN NOT EXISTS (
                      SELECT 1 FROM public.importacoes_itens
                      WHERE importacao_id = p_importacao_id AND situacao IN ('ativo','mantido_alterado'))
                    THEN 'desfeita' ELSE 'desfeita_parcial' END,
      desfeita_em = NOW()
  WHERE id = p_importacao_id AND usuario_id = v_uid;

  RETURN jsonb_build_object('desfeitos', v_desfeitos, 'mantidos', v_mantidos, 'ja_removidos', v_removidos);
END $$;

-- ────────────────────────────────────────────────────────────
-- 5) Permissões: somente usuários autenticados
-- ────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.importacao_texto(TEXT, INTEGER, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importacao_valor(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importacao_data(TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importacao_hash(TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importacao_confirmar(JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.importacao_desfazer(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.importacao_texto(TEXT, INTEGER, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importacao_valor(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importacao_data(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importacao_hash(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importacao_confirmar(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.importacao_desfazer(UUID) TO authenticated;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
