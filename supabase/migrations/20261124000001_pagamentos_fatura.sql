-- MIGRAÇÃO - Almeida Finance
-- Pagamentos de fatura de cartão (total, parcial e antecipado) com histórico e estorno.
--
-- Execute no DEV primeiro (SQL Editor > New query > cole TUDO > Run).
-- COMO APLICAR: como UMA transação única. O SQL Editor executa tudo em uma única requisição.
-- O nome segue o formato <versão numérica>_<nome>.sql reconhecido pelo Supabase CLI. As
-- migrations anteriores (2026-10_*, 2026-11_*) NÃO têm prefixo numérico e o CLI não as
-- reconhece: elas precisam estar aplicadas ANTES (ordem em supabase/migrations/README.md).
-- O prefixo 20261124000001 é maior que 20261119000002, preservando a ordem das dependências.
-- NÃO use `supabase db push` contra produção; produção não recebe migration manual aqui.
-- Em psql use:  psql -1 -v ON_ERROR_STOP=1 -f supabase/migrations/20261124000001_pagamentos_fatura.sql
-- (sem -1 e ON_ERROR_STOP, o erro do bloco DO de pré-requisitos não impede os comandos
-- seguintes e a garantia "nada fica meio aplicado" não vale).
-- PRODUÇÃO somente depois da aprovação dos testes no DEV.
--
-- SEGURO:
--   • Idempotente (IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING).
--   • Sem DROP destrutivo. Não altera faturas_cartao (colunas pago/pago_em seguem
--     existindo por compatibilidade; deixam de ser a fonte da verdade).
--   • RLS: o usuário só LÊ os próprios pagamentos. Não há INSERT/UPDATE/DELETE
--     direto para authenticated: toda escrita passa pelas RPCs abaixo.
--
-- Modelo:
--   • A fatura é PROJETADA no app (compras_cartao + parcelamentos); portanto o
--     pagamento referencia (cartao_id, ano_mes) = competência (mês de fechamento).
--   • O pagamento NÃO é despesa: a compra já foi contada como gasto. O saldo da
--     conta é DERIVADO (ver src/lib/saldoDisponivel.js): saldo informado + receitas
--     - despesas - pagamentos ativos com origem = 'saldo_principal'. Assim o débito
--       e o estorno são atômicos (uma única linha) e nada é contado duas vezes.
--   • Estorno = status 'estornado' (a linha é mantida para o histórico).
--   • Duplicidade: UNIQUE (usuario_id, idempotency_key) e trava por cartão
--     (SELECT ... FOR UPDATE) dentro da RPC.
--   • Limite do valor (v4): o SERVIDOR calcula o total do ciclo com
--     public.total_fatura_ciclo_servidor (mesma regra de src/lib/faturaCartao.js).
--     O p_total_ciclo enviado pelo cliente NÃO é confiável e NUNCA define o teto: é só
--     uma dica de consistência. Se divergir do total do servidor, a RPC recusa com
--     'Fatura desatualizada' (o app refaz a leitura). Regra: pagamentos ativos + novo
--     valor <= total do servidor. Novas compras após pagamento parcial seguem
--     permitidas: o total sobe, pagamentos ativos são preservados (sem estorno) e o
--     em aberto é total - pago. total_ciclo_ref guarda o total do SERVIDOR no momento
--     de cada pagamento (snapshot).
--   • Regras do total reproduzidas do cliente (cada uma coberta em supabase/tests/paridade-fatura.mjs):
--       - competência = mês de fechamento; compra após o dia de fechamento (ajustado
--         ao último dia de meses curtos) entra no ciclo seguinte;
--       - parcelas em centavos: base = floor(total/n); a última parcela leva o resto;
--       - parcelamentos (tabela parcelamentos) pela data da 1ª parcela, mesma regra de
--         fechamento; quitados (quitado_em) ficam fora; parcelamento que repete uma compra
--         (mesmo cartão, descrição normalizada, valor total e nº de parcelas) não duplica;
--       - fatura informada (faturas_cartao) ENTRA no cálculo, como no app: total do ciclo =
--         maior entre o valor informado e a soma das compras. Decisão explícita: é o total
--         que o app mostra e cobra; o dado é do próprio usuário (RLS) e não vem do
--         parâmetro da RPC;
--       - o boolean legado faturas_cartao.pago NÃO entra: virou pagamento legado no backfill.
--   • Concorrência (v5): UM ÚNICO mecanismo de serialização por cartão, a função
--     public.travar_cartoes_fatura(ids, usuario): SELECT ... FOR UPDATE em public.cartoes, uma
--     linha por cartão, em ordem ASCENDENTE de id (ids deduplicados, NULL ignorado). Ele é
--     usado por:
--       - pagar_fatura_cartao e estornar_pagamento_fatura (cartão primeiro; depois, só no
--         estorno, a linha do pagamento: ordem global cartão -> pagamento);
--       - triggers nas três tabelas que compõem o total (compras_cartao, parcelamentos,
--         faturas_cartao), em INSERT, UPDATE e DELETE:
--           * BEFORE STATEMENT (trg_fatura_travar_usuario): com auth.uid(), trava TODOS os
--             cartões do usuário em ordem ascendente ANTES de qualquer linha ser tocada.
--             Granularidade: por USUÁRIO (pagar o cartão A espera DML de compras do cartão B
--             do mesmo usuário até o commit). Decisão aceita: as transações são curtas e a
--             ordem única de locks vale para DML em massa, multi-cartão e
--             zerar_dados_financeiros;
--           * BEFORE ROW (trg_fatura_travar_cartao): trava OLD.cartao_id e NEW.cartao_id
--             (mudança de cartão trava origem e destino em ordem). Com auth.uid() só trava
--             cartões do próprio usuário (um UUID alheio não segura lock de terceiro). Cobre
--             também service role e SQL Editor, onde auth.uid() é nulo;
--           * BEFORE DELETE STATEMENT em public.cartoes (mesma função do statement): a
--             exclusão de cartão (e a cascata para as filhas) trava todos os cartões do
--             usuário em ordem ANTES de travar a linha do cartão excluído, sem inverter a ordem.
--     Por que BEFORE e não AFTER com tabelas de transição (REFERENCING OLD/NEW TABLE): triggers
--     com tabelas de transição só existem em AFTER, depois do DML. Lá a FK (KEY SHARE em
--     cartoes) já foi tomada, e converter para FOR UPDATE faria duas sessões concorrentes do
--     mesmo cartão se bloquearem mutuamente (upgrade de lock = deadlock). Em BEFORE o
--     FOR UPDATE é o primeiro lock em cartoes, sem upgrade. Preço assumido: o escopo do
--     statement é o usuário inteiro, não só os cartões afetados.
--     LIMITES DA GARANTIA (o que NÃO é prometido):
--       - Com auth.uid() (app, RPC como zerar_dados_financeiros) a ordem é global e ascendente.
--       - SEM auth.uid() (service role, SQL Editor) não há como saber os cartões afetados antes
--         do DML; só vale o trigger de linha, que trava na ordem em que as linhas são visitadas.
--         Duas operações em massa concorrentes com ordens opostas podem receber 40P01. É
--         seguro (aborta sem pagamento indevido) e repetível.
--       - Não é afirmado "sem deadlock" em geral: a garantia é pagamento nunca acima do total
--         sob lock e, no caminho autenticado, ordem consistente de locks de cartão.
--     Assim o banco serializa independentemente do cliente (supabase-js direto, RPC, service
--     role, edge function). Não se depende de lock no frontend. Não foi revogado DML direto:
--     os hooks continuam válidos e a garantia está no banco.
--     Consequência: o pagamento é validado contra o total COMMITADO sob o lock do cartão;
--     o total e o pago são recalculados na mesma transação, imediatamente antes do INSERT.
--     Editar ou remover compra DEPOIS do pagamento é uma operação posterior válida (igual
--     ao uso sequencial) e NÃO é bloqueada, para que zerar dados e exclusões funcionem.
--     A RPC exige isolamento READ COMMITTED (em REPEATABLE READ/SERIALIZABLE o snapshot
--     seria anterior ao lock e o total ficaria obsoleto): fora disso recusa com erro.
--     Conflitos: 40001 (fatura desatualizada), 40P01 (deadlock) e 55P03 (lock_timeout) abortam
--     a transação sem pagamento indevido e podem ser repetidos com a MESMA idempotency_key.
--     Deadlock residual possível: DML em massa sem auth.uid() (ver LIMITES) e transações
--     multi-statement que misturem DML com locks manuais em cartoes fora desse mecanismo.
--     Decisão original (v5), SUPERADA pela migration 20261124000002: editar ou excluir compra
--     depois do pagamento podia deixar o total abaixo do pago. A 000002 passa a recusar DML
--     direto em fatura QUITADA (SQLSTATE FP001; só a RPC alterar_historico_fatura, com motivo e
--     auditoria) e registra crédito quando o total cai abaixo do pago. Fatura aberta ou parcial
--     continua editável. O limite do pagamento vale no instante do pagamento, sob lock.
--     UNIQUE (usuario_id, idempotency_key) é a barreira final; unique_violation concorrente
--     devolve o original se os parâmetros coincidem.
--   • Origem: somente 'saldo_principal' (não há múltiplas contas). 'outra_conta'
--     existe só em pagamentos legados migrados, que não debitam saldo.
--   • Idempotência: mesma chave + mesmos parâmetros devolve o original; mesma chave
--     com parâmetros diferentes é recusada. Estorno repetido é recusado (sem dupla
--     reversão).

-- ------------------------------------------------------------
-- PRÉ-REQUISITOS (falha explícita, antes de qualquer alteração).
-- Tudo abaixo roda num único script/transação: se faltar dependência, nada é aplicado.
-- Ordem: 2026-10_consultoria_acessos.sql (public.consultor_autorizado) e as migrations
-- de cartões/faturas devem estar aplicadas antes desta.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 130000 THEN
    RAISE EXCEPTION 'PostgreSQL 13 ou superior é necessário (normalize NFD, gen_random_uuid). Versão atual: %', current_setting('server_version')
      USING ERRCODE = '0A000';
  END IF;
  IF (SELECT pg_encoding_to_char(encoding) FROM pg_database WHERE datname = current_database()) <> 'UTF8' THEN
    RAISE EXCEPTION 'O banco deve usar codificação UTF8 (normalize NFD e regex Unicode).'
      USING ERRCODE = '0A000';
  END IF;
  IF to_regprocedure('public.consultor_autorizado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: public.consultor_autorizado(uuid). Aplique 2026-10_consultoria_acessos.sql antes de 20261124000001_pagamentos_fatura.sql.'
      USING ERRCODE = '42883';
  END IF;
  IF to_regclass('public.cartoes') IS NULL OR to_regclass('public.compras_cartao') IS NULL
     OR to_regclass('public.parcelamentos') IS NULL OR to_regclass('public.faturas_cartao') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: tabelas cartoes, compras_cartao, parcelamentos e faturas_cartao devem existir (schema.sql e 2026-10_faturas_cartao_total.sql).'
      USING ERRCODE = '42P01';
  END IF;
  -- Reaplicar esta migration DEPOIS da 20261124000002 restauraria estornar_pagamento_fatura(uuid)
  -- sem razão nem reconciliação de crédito (o app chama exatamente essa assinatura), em silêncio.
  -- Falha explícita: a 000002 já aplicada significa que esta migration não deve rodar de novo.
  IF to_regprocedure('public.estornar_pagamento_fatura(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A migration 20261124000002_integridade_historica_fatura.sql já está aplicada. Reaplicar 20261124000001_pagamentos_fatura.sql restauraria o estorno sem auditoria. Não reaplique a 000001.'
      USING ERRCODE = '0A000';
  END IF;
END $$;

-- parcelamentos.cartao_id: o app já usa a coluna (parcelamento vinculado ao cartão) e a
-- migration 20250124_proteger_exclusao_cartao.sql a referencia, mas schema.sql não a
-- declara. Garante a coluna (no-op quando já existe).
ALTER TABLE public.parcelamentos
  ADD COLUMN IF NOT EXISTS cartao_id UUID REFERENCES public.cartoes(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'parcelamentos' AND column_name = 'cartao_id') THEN
    RAISE EXCEPTION 'Coluna public.parcelamentos.cartao_id ausente após o ALTER TABLE.' USING ERRCODE = '42703';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.pagamentos_fatura (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id        UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  ano_mes          TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_pagamento   DATE NOT NULL,
  origem           TEXT NOT NULL DEFAULT 'saldo_principal'
                   CHECK (origem IN ('saldo_principal', 'outra_conta')),
  conta_nome       TEXT CHECK (conta_nome IS NULL OR char_length(conta_nome) <= 80),
  total_ciclo_ref  NUMERIC(12,2),
  status           TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'estornado')),
  estornado_em     TIMESTAMPTZ,
  legado           BOOLEAN NOT NULL DEFAULT FALSE,
  idempotency_key  TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 100),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_cartao_mes
  ON public.pagamentos_fatura (cartao_id, ano_mes);
CREATE INDEX IF NOT EXISTS idx_pagamentos_fatura_usuario
  ON public.pagamentos_fatura (usuario_id, data_pagamento);

ALTER TABLE public.pagamentos_fatura ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='pagamentos_fatura'
      AND policyname='Usuário lê apenas os próprios pagamentos de fatura') THEN
    CREATE POLICY "Usuário lê apenas os próprios pagamentos de fatura"
      ON public.pagamentos_fatura FOR SELECT
      USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- Consultoria: o consultor autorizado lê (somente leitura) os pagamentos do cliente,
-- como nas demais tabelas financeiras (2026-10_consultoria_acessos.sql). A dependência
-- é verificada no pré-requisito acima: se faltar, a migration inteira falha (nunca
-- deixa de criar a policy em silêncio).
DO $$
BEGIN
  IF to_regprocedure('public.consultor_autorizado(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Dependência ausente: public.consultor_autorizado(uuid). Aplique 2026-10_consultoria_acessos.sql antes.'
      USING ERRCODE = '42883';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='pagamentos_fatura'
         AND policyname='Consultor autorizado lê pagamentos de fatura do cliente') THEN
    CREATE POLICY "Consultor autorizado lê pagamentos de fatura do cliente"
      ON public.pagamentos_fatura FOR SELECT
      USING (public.consultor_autorizado(usuario_id));
  END IF;
END $$;

-- Escrita somente via RPC (SECURITY DEFINER).
REVOKE ALL ON public.pagamentos_fatura FROM anon, authenticated;
GRANT SELECT ON public.pagamentos_fatura TO authenticated;

-- ------------------------------------------------------------
-- Serialização por cartão (UNICO mecanismo de lock; ver "Concorrência" no cabeçalho).
-- Trava as linhas de public.cartoes em ordem ASCENDENTE de id, uma a uma, para que
-- qualquer combinação de cartões (mover compra A->B e B->A, DML em massa) adquira os
-- locks na mesma ordem global (reduz o risco de deadlock; ver LIMITES no cabeçalho). Retorna quantos cartões travou.
-- Interna: EXECUTE revogado de clientes (recebe ids arbitrários).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.travar_cartoes_fatura(
  p_ids        UUID[],
  p_usuario_id UUID DEFAULT NULL
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_n  INT := 0;
BEGIN
  FOR v_id IN
    SELECT DISTINCT x FROM unnest(COALESCE(p_ids, ARRAY[]::uuid[])) AS t(x)
     WHERE x IS NOT NULL
     ORDER BY x ASC
  LOOP
    PERFORM 1 FROM public.cartoes c
     WHERE c.id = v_id
       AND (p_usuario_id IS NULL OR c.usuario_id = p_usuario_id)
     FOR UPDATE;
    IF FOUND THEN v_n := v_n + 1; END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.travar_cartoes_fatura(UUID[], UUID) FROM PUBLIC, anon, authenticated;

-- BEFORE STATEMENT: com usuário autenticado, trava todos os cartões dele (ordem ascendente).
CREATE OR REPLACE FUNCTION public.trg_fatura_travar_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NOT NULL THEN
    PERFORM public.travar_cartoes_fatura(
      ARRAY(SELECT id FROM public.cartoes WHERE usuario_id = v_uid ORDER BY id), v_uid);
  END IF;
  RETURN NULL;
END;
$$;

-- BEFORE ROW: trava o cartão antigo e o novo da linha (cobre service role e mudança de cartão).
-- Com auth.uid(), filtra por dono: não segura lock de cartão de terceiro (o WITH CHECK de RLS
-- só roda depois dos triggers BEFORE).
CREATE OR REPLACE FUNCTION public.trg_fatura_travar_cartao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.travar_cartoes_fatura(ARRAY[NEW.cartao_id], v_uid);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.travar_cartoes_fatura(ARRAY[OLD.cartao_id], v_uid);
  ELSE
    PERFORM public.travar_cartoes_fatura(ARRAY[OLD.cartao_id, NEW.cartao_id], v_uid);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_fatura_travar_usuario() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_fatura_travar_cartao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS aa_fatura_travar_usuario ON public.compras_cartao;
CREATE TRIGGER aa_fatura_travar_usuario BEFORE INSERT OR UPDATE OR DELETE ON public.compras_cartao
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fatura_travar_usuario();
DROP TRIGGER IF EXISTS aa_fatura_travar_cartao ON public.compras_cartao;
CREATE TRIGGER aa_fatura_travar_cartao BEFORE INSERT OR UPDATE OR DELETE ON public.compras_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_travar_cartao();

DROP TRIGGER IF EXISTS aa_fatura_travar_usuario ON public.parcelamentos;
CREATE TRIGGER aa_fatura_travar_usuario BEFORE INSERT OR UPDATE OR DELETE ON public.parcelamentos
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fatura_travar_usuario();
DROP TRIGGER IF EXISTS aa_fatura_travar_cartao ON public.parcelamentos;
CREATE TRIGGER aa_fatura_travar_cartao BEFORE INSERT OR UPDATE OR DELETE ON public.parcelamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_travar_cartao();

DROP TRIGGER IF EXISTS aa_fatura_travar_usuario ON public.faturas_cartao;
CREATE TRIGGER aa_fatura_travar_usuario BEFORE INSERT OR UPDATE OR DELETE ON public.faturas_cartao
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fatura_travar_usuario();
DROP TRIGGER IF EXISTS aa_fatura_travar_cartao ON public.faturas_cartao;
CREATE TRIGGER aa_fatura_travar_cartao BEFORE INSERT OR UPDATE OR DELETE ON public.faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION public.trg_fatura_travar_cartao();

-- Exclusão de cartão: trava todos os cartões do usuário em ordem antes de travar a linha
-- excluída e antes da cascata para as tabelas filhas (evita inversão de ordem de locks).
DROP TRIGGER IF EXISTS aa_fatura_travar_usuario ON public.cartoes;
CREATE TRIGGER aa_fatura_travar_usuario BEFORE DELETE ON public.cartoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_fatura_travar_usuario();

-- ------------------------------------------------------------
-- Total do ciclo calculado no servidor (fonte confiável do teto de pagamento).
-- Reproduz src/lib/faturaCartao.js (totalFaturaComOverride). Ver regras no cabeçalho.
-- ------------------------------------------------------------

-- Normalização de descrição para o dedupe parcelamento x compra (equivale a
-- normalizarTexto do JS: NFD sem marcas combinantes, minúsculas, espaços colapsados, trim).
-- normalize(..., NFD) exige PostgreSQL 13+ e banco UTF8. Ainda NÃO executado (PENDENTE no DEV).
CREATE OR REPLACE FUNCTION public.normalizar_texto_fatura(p_texto TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(
    lower(regexp_replace(normalize(COALESCE(p_texto, ''), NFD), '[\u0300-\u036f]', '', 'g')),
    '\s+', ' ', 'g'));
$$;

-- Índice de competência (ano*12 + mes - 1) da 1ª parcela de uma data, pela regra de
-- fechamento: depois do dia de fechamento (limitado ao último dia do mês) vai para o
-- mês seguinte.
CREATE OR REPLACE FUNCTION public.competencia_fatura_indice(p_data DATE, p_dia_fechamento INT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT (EXTRACT(YEAR FROM p_data)::int * 12 + EXTRACT(MONTH FROM p_data)::int - 1)
    + CASE WHEN EXTRACT(DAY FROM p_data)::int >
                LEAST(GREATEST(1, LEAST(31, COALESCE(p_dia_fechamento, 20))),
                      EXTRACT(DAY FROM (date_trunc('month', p_data)::date + INTERVAL '1 month - 1 day'))::int)
           THEN 1 ELSE 0 END;
$$;

-- Função INTERNA: recebe o usuário como parâmetro, então NÃO pode ser chamada por
-- clientes (EXECUTE revogado abaixo). Só as RPCs SECURITY DEFINER a usam, passando
-- auth.uid(). Todas as consultas filtram por usuario_id (o dono roda sem RLS).
CREATE OR REPLACE FUNCTION public.total_fatura_ciclo_servidor(
  p_cartao_id  UUID,
  p_usuario_id UUID,
  p_ano_mes    TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fech     INT;
  v_idx      INT;
  v_compras  BIGINT;
  v_parcel   BIGINT;
  v_manual   BIGINT;
BEGIN
  IF p_ano_mes IS NULL OR p_ano_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023';
  END IF;

  SELECT c.dia_fechamento INTO v_fech FROM public.cartoes c
   WHERE c.id = p_cartao_id AND c.usuario_id = p_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cartão não encontrado' USING ERRCODE = '42501';
  END IF;

  v_idx := split_part(p_ano_mes, '-', 1)::int * 12 + split_part(p_ano_mes, '-', 2)::int - 1;

  -- Compras do cartão: parcela k = ciclo - ciclo da 1ª parcela; centavos com o resto na última.
  SELECT COALESCE(SUM(CASE WHEN x.k = x.n - 1 THEN x.tc - (x.tc / x.n) * (x.n - 1)
                           ELSE x.tc / x.n END), 0)
    INTO v_compras
    FROM (
      SELECT round(c.valor_total * 100)::bigint AS tc,
             GREATEST(1, c.numero_parcelas)     AS n,
             v_idx - public.competencia_fatura_indice(c.data_compra, v_fech) AS k
        FROM public.compras_cartao c
       WHERE c.cartao_id = p_cartao_id AND c.usuario_id = p_usuario_id
    ) x
   WHERE x.k >= 0 AND x.k < x.n;

  -- Parcelamentos do cartão: não quitados e sem repetir uma compra já cadastrada.
  SELECT COALESCE(SUM(CASE WHEN x.k = x.n - 1 THEN x.tc - (x.tc / x.n) * (x.n - 1)
                           ELSE x.tc / x.n END), 0)
    INTO v_parcel
    FROM (
      SELECT round(p.valor_total * 100)::bigint AS tc,
             GREATEST(1, p.numero_parcelas)     AS n,
             v_idx - public.competencia_fatura_indice(p.primeira_parcela, v_fech) AS k
        FROM public.parcelamentos p
       WHERE p.cartao_id = p_cartao_id AND p.usuario_id = p_usuario_id
         AND p.quitado_em IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.compras_cartao c
            WHERE c.cartao_id = p.cartao_id AND c.usuario_id = p_usuario_id
              AND public.normalizar_texto_fatura(c.descricao) = public.normalizar_texto_fatura(p.descricao)
              AND round(c.valor_total * 100) = round(p.valor_total * 100)
              AND GREATEST(1, c.numero_parcelas) = GREATEST(1, p.numero_parcelas))
    ) x
   WHERE x.k >= 0 AND x.k < x.n;

  -- Fatura informada: total = maior entre o informado e as compras detalhadas.
  SELECT round(f.valor_total * 100)::bigint INTO v_manual
    FROM public.faturas_cartao f
   WHERE f.cartao_id = p_cartao_id AND f.usuario_id = p_usuario_id AND f.ano_mes = p_ano_mes;

  RETURN GREATEST(COALESCE(v_manual, 0), v_compras + v_parcel)::numeric / 100;
END;
$$;

-- Função pública para o app (ex.: atualizar a tela): usa SEMPRE auth.uid(); não aceita
-- usuário arbitrário, então não expõe dados de terceiros.
CREATE OR REPLACE FUNCTION public.total_fatura_ciclo(p_cartao_id UUID, p_ano_mes TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  RETURN public.total_fatura_ciclo_servidor(p_cartao_id, v_uid, p_ano_mes);
END;
$$;

-- ------------------------------------------------------------
-- RPC: pagar_fatura_cartao
-- p_total_ciclo é mantido por compatibilidade e é apenas uma DICA do cliente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pagar_fatura_cartao(
  p_cartao_id        UUID,
  p_ano_mes          TEXT,
  p_valor            NUMERIC,
  p_data_pagamento   DATE,
  p_origem           TEXT,
  p_conta_nome       TEXT,
  p_total_ciclo      NUMERIC,
  p_idempotency_key  TEXT
) RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_pago      NUMERIC(12,2);
  v_total     NUMERIC(12,2);
  v_aberto    NUMERIC(12,2);
  v_existente public.pagamentos_fatura;
  v_novo      public.pagamentos_fatura;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento deve ser maior que zero' USING ERRCODE = '22023';
  END IF;
  IF p_total_ciclo IS NOT NULL AND (p_total_ciclo < 0 OR p_total_ciclo > 999999999) THEN
    RAISE EXCEPTION 'Total da fatura inválido' USING ERRCODE = '22023';
  END IF;
  IF p_ano_mes IS NULL OR p_ano_mes !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida' USING ERRCODE = '22023';
  END IF;
  IF p_data_pagamento IS NULL OR p_data_pagamento > (NOW() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RAISE EXCEPTION 'Data do pagamento não pode ser futura' USING ERRCODE = '22023';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(p_idempotency_key) NOT BETWEEN 8 AND 100 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida' USING ERRCODE = '22023';
  END IF;
  -- Só existe uma conta (saldo principal). 'outra_conta' segue válida no CHECK da
  -- tabela apenas para o backfill legado e não pode ser criada por esta RPC.
  IF COALESCE(p_origem, 'saldo_principal') <> 'saldo_principal' THEN
    RAISE EXCEPTION 'Conta de origem inválida: somente saldo_principal' USING ERRCODE = '22023';
  END IF;

  -- Em REPEATABLE READ/SERIALIZABLE o snapshot é anterior ao lock e o total ficaria obsoleto.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Pagamento de fatura exige isolamento READ COMMITTED (atual: %). Repita em nova transação.',
      current_setting('transaction_isolation')
      USING ERRCODE = '25006';
  END IF;

  -- Trava o cartão (e valida o dono) com o mecanismo único: serializa pagar x pagar,
  -- pagar x estornar e pagar x qualquer INSERT/UPDATE/DELETE de compras, parcelamentos
  -- e faturas informadas (triggers).
  IF public.travar_cartoes_fatura(ARRAY[p_cartao_id], v_uid) = 0 THEN
    RAISE EXCEPTION 'Cartão não encontrado' USING ERRCODE = '42501';
  END IF;

  -- Repetição da mesma operação (duplo clique, retry, outro dispositivo): devolve a original.
  SELECT * INTO v_existente FROM public.pagamentos_fatura
   WHERE usuario_id = v_uid AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existente.cartao_id = p_cartao_id AND v_existente.ano_mes = p_ano_mes
       AND v_existente.valor = round(p_valor, 2)
       AND v_existente.data_pagamento = p_data_pagamento THEN
      IF v_existente.status <> 'ativo' THEN
        RAISE EXCEPTION 'Este pagamento já foi estornado. Gere um novo pagamento.' USING ERRCODE = '22023';
      END IF;
      RETURN v_existente;
    END IF;
    RAISE EXCEPTION 'Chave de idempotência já usada em outro pagamento' USING ERRCODE = '23505';
  END IF;

  -- Fonte da verdade: total e pago recalculados AQUI, sob o lock do cartão, na mesma transação
  -- e imediatamente antes do INSERT (writers concorrentes já commitaram ou aguardam o lock).
  v_total := public.total_fatura_ciclo_servidor(p_cartao_id, v_uid, p_ano_mes);

  -- Cliente com tela desatualizada (ou total adulterado): recusa em vez de aceitar.
  IF p_total_ciclo IS NOT NULL AND round(p_total_ciclo, 2) <> v_total THEN
    RAISE EXCEPTION 'Fatura desatualizada: o total no servidor é % e a tela mostra %. Atualize a tela e tente novamente.',
      to_char(v_total, 'FM999999990.00'), to_char(round(p_total_ciclo, 2), 'FM999999990.00')
      USING ERRCODE = '40001';
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Fatura sem valor a pagar neste ciclo' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(valor), 0) INTO v_pago FROM public.pagamentos_fatura
   WHERE usuario_id = v_uid AND cartao_id = p_cartao_id
     AND ano_mes = p_ano_mes AND status = 'ativo';

  v_aberto := GREATEST(v_total - v_pago, 0);
  IF v_aberto <= 0 THEN
    RAISE EXCEPTION 'Fatura sem saldo em aberto: já está quitada' USING ERRCODE = '22023';
  END IF;

  -- Pagamentos ativos nunca são alterados nem exigem estorno; o teto é o total do servidor.
  IF round(p_valor, 2) > v_aberto THEN
    RAISE EXCEPTION 'Valor excede o saldo em aberto da fatura (em aberto: %)',
      to_char(v_aberto, 'FM999999990.00')
      USING ERRCODE = '22003';
  END IF;

  BEGIN
    INSERT INTO public.pagamentos_fatura
      (usuario_id, cartao_id, ano_mes, valor, data_pagamento, origem, conta_nome,
       total_ciclo_ref, idempotency_key)
    VALUES
      (v_uid, p_cartao_id, p_ano_mes, round(p_valor, 2), p_data_pagamento,
       'saldo_principal', NULL, v_total, p_idempotency_key)
    RETURNING * INTO v_novo;
  EXCEPTION WHEN unique_violation THEN
    -- Corrida na mesma chave (ex.: chave igual em cartões diferentes): devolve o original
    -- se os parâmetros coincidem; senão recusa.
    SELECT * INTO v_existente FROM public.pagamentos_fatura
     WHERE usuario_id = v_uid AND idempotency_key = p_idempotency_key;
    IF FOUND AND v_existente.cartao_id = p_cartao_id AND v_existente.ano_mes = p_ano_mes
       AND v_existente.valor = round(p_valor, 2)
       AND v_existente.data_pagamento = p_data_pagamento THEN
      IF v_existente.status <> 'ativo' THEN
        RAISE EXCEPTION 'Este pagamento já foi estornado. Gere um novo pagamento.' USING ERRCODE = '22023';
      END IF;
      RETURN v_existente;
    END IF;
    RAISE EXCEPTION 'Chave de idempotência já usada em outro pagamento' USING ERRCODE = '23505';
  END;

  RETURN v_novo;
END;
$$;

-- ------------------------------------------------------------
-- RPC: estornar_pagamento_fatura
-- Ordem de lock igual à de pagar: cartão primeiro, depois a linha do pagamento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estornar_pagamento_fatura(p_pagamento_id UUID)
RETURNS public.pagamentos_fatura
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_cartao UUID;
  v_pg     public.pagamentos_fatura;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
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

  RETURN v_pg;
END;
$$;

-- Funções internas/auxiliares: sem acesso de clientes (recebem usuario_id arbitrário).
REVOKE ALL ON FUNCTION public.total_fatura_ciclo_servidor(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.normalizar_texto_fatura(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.competencia_fatura_indice(DATE, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.total_fatura_ciclo(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.total_fatura_ciclo(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.pagar_fatura_cartao(UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.estornar_pagamento_fatura(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pagar_fatura_cartao(UUID, TEXT, NUMERIC, DATE, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_pagamento_fatura(UUID) TO authenticated;

-- ------------------------------------------------------------
-- Backfill: faturas marcadas como pagas (boolean) viram pagamento LEGADO.
-- Não debita saldo (origem 'outra_conta'): o app antigo nunca debitou.
-- Idempotente pela chave 'legado-<id da fatura>'.
-- ------------------------------------------------------------
INSERT INTO public.pagamentos_fatura
  (usuario_id, cartao_id, ano_mes, valor, data_pagamento, origem, conta_nome,
   total_ciclo_ref, legado, idempotency_key)
SELECT f.usuario_id, f.cartao_id, f.ano_mes, f.valor_total,
       COALESCE(f.pago_em, f.criado_em::date, CURRENT_DATE),
       'outra_conta', 'Pagamento anterior (migrado)', f.valor_total, TRUE,
       'legado-' || f.id::text
  FROM public.faturas_cartao f
 WHERE f.pago = TRUE AND f.valor_total > 0
ON CONFLICT (usuario_id, idempotency_key) DO NOTHING;

-- ------------------------------------------------------------
-- Realtime: sincroniza pagamentos entre aparelhos (idempotente).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pagamentos_fatura') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos_fatura;
  END IF;
END $$;
