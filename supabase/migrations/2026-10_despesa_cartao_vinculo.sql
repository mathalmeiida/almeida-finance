-- ============================================================
-- Migration: vínculo opcional de despesa a um cartão (metadado)
-- ============================================================
-- Objetivo: permitir que uma despesa com forma de pagamento "cartão de crédito"
-- registre QUAL cartão cadastrado foi usado — tanto no onboarding quanto no
-- cadastro/edição de despesas à vista. É APENAS um vínculo informativo.
--
-- IMPORTANTE (sem dupla contagem): esta coluna NÃO cria fatura, NÃO cria
-- compra em compras_cartao e NÃO gera parcelamento. A despesa continua sendo
-- apenas uma linha em public.despesas (contabilizada uma única vez no limite
-- diário / projeções). O caminho de compra PARCELADA no cartão permanece
-- inalterado (continua indo para compras_cartao / parcelamentos).
--
-- NÃO afeta: cálculo de saldo, limite diário, Horizonte Financeiro, projeções,
-- faturas, benefícios (VR/VA), consultoria, admin ou autenticação.
--
-- Seguro de rodar mais de uma vez (IF NOT EXISTS). O app funciona SEM esta
-- coluna (o vínculo é opcional), mas rodar a migration habilita a seleção e a
-- edição do cartão vinculado à despesa.
-- ------------------------------------------------------------

ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS cartao_id UUID
    REFERENCES public.cartoes(id) ON DELETE SET NULL;

-- Índice leve para consultas que filtram despesas por cartão (opcional).
CREATE INDEX IF NOT EXISTS idx_despesas_cartao_id
  ON public.despesas (cartao_id);

-- ------------------------------------------------------------
-- Garante o RLS HABILITADO em despesas (defensivo e idempotente).
-- Sem RLS habilitado, NENHUMA política tem efeito — então reafirmamos aqui.
-- ENABLE é idempotente: se já estiver habilitado, não faz nada e não há erro,
-- não altera dados. (No schema atual já está habilitado; isto é um reforço.)
-- ------------------------------------------------------------
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- RLS: validação de PROPRIEDADE do cartão vinculado (defesa no banco)
-- ------------------------------------------------------------
-- COEXISTÊNCIA COM OUTRAS POLÍTICAS (verificado):
-- A migração 2026-10_consultoria_acessos.sql cria em "despesas" a política
-- "Consultor autorizado vê despesas" — FOR SELECT, somente leitura, usando
-- public.consultor_autorizado(usuario_id). Ela é PRESERVADA por esta migration
-- (o DROP abaixo remove SOMENTE a política antiga "FOR ALL" do dono) e NÃO
-- permite escrita: como só existe para SELECT, não há como um consultor inserir
-- ou atualizar uma despesa, logo a validação do cartao_id em INSERT/UPDATE não
-- pode ser contornada por ela. No PostgreSQL, políticas permissivas do mesmo
-- comando se combinam por OR — ter duas de SELECT (dono + consultor) é correto
-- e não afeta INSERT/UPDATE, que têm políticas próprias e isoladas abaixo.
--
-- POR QUE ENDURECER (a brecha fechada aqui):
-- A política ANTERIOR de "despesas" validava apenas usuario_id = auth.uid().
-- Isso NÃO impede um usuário de vincular a PRÓPRIA despesa a um cartao_id de
-- OUTRO usuário (bastaria enviar o próprio usuario_id + um cartao_id alheio).
-- Como o vínculo é só metadado (não cria fatura/compra e a RLS de "cartoes"
-- impede LER o cartão alheio), o risco é de integridade referencial cruzada —
-- mas fechamos a brecha aqui, espelhando o reforço já feito em
-- beneficios_movimentacoes.
--
-- Regra: além de usuario_id = auth.uid(), quando cartao_id NÃO for NULL ele
-- precisa referenciar um cartão do PRÓPRIO usuário (EXISTS em public.cartoes).
-- cartao_id NULL continua permitido (o vínculo é opcional).
--
-- Políticas separadas por operação (SELECT/INSERT/UPDATE/DELETE) para o
-- controle ser explícito. NÃO altera nem apaga dados — apenas regras de acesso.
-- DROP de política remove só a REGRA, nunca linhas. Idempotente.
--
-- NOTA sobre SELECT: a condição do cartão fica só no INSERT/UPDATE (escrita).
-- No SELECT mantemos apenas usuario_id = auth.uid(), para NÃO esconder uma
-- despesa já existente caso algum dado legado tenha um cartao_id inconsistente
-- (não queremos sumir com despesas do próprio usuário na leitura).
DO $$
BEGIN
  -- Remove a política antiga abrangente (FOR ALL), se existir.
  DROP POLICY IF EXISTS "Usuário gerencia apenas as próprias despesas" ON public.despesas;

  -- SELECT: dono vê as próprias despesas (sem restrição extra de cartão).
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='despesas'
      AND policyname='Despesas: ver (dono)') THEN
    CREATE POLICY "Despesas: ver (dono)"
      ON public.despesas FOR SELECT
      USING (auth.uid() = usuario_id);
  END IF;

  -- INSERT: dono + (cartao_id NULL OU cartão do dono).
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='despesas'
      AND policyname='Despesas: inserir (dono + cartão do dono)') THEN
    CREATE POLICY "Despesas: inserir (dono + cartão do dono)"
      ON public.despesas FOR INSERT
      WITH CHECK (
        auth.uid() = usuario_id
        AND (
          cartao_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.cartoes c
            WHERE c.id = cartao_id AND c.usuario_id = auth.uid()
          )
        )
      );
  END IF;

  -- UPDATE: a linha atual é do dono E a linha resultante também respeita a
  -- regra do cartão (impede "mover" a despesa para um cartão de terceiro).
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='despesas'
      AND policyname='Despesas: atualizar (dono + cartão do dono)') THEN
    CREATE POLICY "Despesas: atualizar (dono + cartão do dono)"
      ON public.despesas FOR UPDATE
      USING (auth.uid() = usuario_id)
      WITH CHECK (
        auth.uid() = usuario_id
        AND (
          cartao_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.cartoes c
            WHERE c.id = cartao_id AND c.usuario_id = auth.uid()
          )
        )
      );
  END IF;

  -- DELETE: dono apaga as próprias despesas.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='despesas'
      AND policyname='Despesas: apagar (dono)') THEN
    CREATE POLICY "Despesas: apagar (dono)"
      ON public.despesas FOR DELETE
      USING (auth.uid() = usuario_id);
  END IF;
END $$;

-- ------------------------------------------------------------
-- DIAGNÓSTICO (não destrutivo): inspeciona o estado final de "despesas".
-- Apenas informativo (RAISE NOTICE/WARNING) — não altera nada no banco.
-- Confirme no output:
--   1) RLS habilitado = true.
--   2) Existem as políticas: ver/inserir/atualizar/apagar (desta migration) e,
--      se a consultoria estiver instalada, "Consultor autorizado vê despesas"
--      (FOR SELECT). A antiga "FOR ALL" NÃO deve mais aparecer.
--   3) Toda política de ESCRITA (INSERT/UPDATE/ALL) referencia cartao_id/cartoes
--      no WITH CHECK — se alguma de escrita NÃO fizer isso, é um ALERTA de
--      possível brecha (vínculo de cartão sem validação de propriedade).
-- ------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  rls_on BOOLEAN;
  escrita_sem_validacao INT := 0;
BEGIN
  SELECT relrowsecurity INTO rls_on
    FROM pg_class WHERE oid = 'public.despesas'::regclass;
  RAISE NOTICE 'RLS habilitado em public.despesas: %', rls_on;
  IF rls_on IS NOT TRUE THEN
    RAISE WARNING 'ATENCAO: RLS NAO esta habilitado em public.despesas — as politicas nao terao efeito!';
  END IF;

  RAISE NOTICE 'Políticas RLS atuais em public.despesas:';
  FOR r IN
    SELECT policyname, cmd, qual, with_check
      FROM pg_policies
     WHERE schemaname='public' AND tablename='despesas'
     ORDER BY cmd, policyname
  LOOP
    RAISE NOTICE '  • [%] % | USING: % | WITH CHECK: %',
      r.cmd, r.policyname, COALESCE(r.qual, '—'), COALESCE(r.with_check, '—');

    -- Toda política que permite ESCRITA deve validar o cartão (menção a
    -- "cartao_id" no WITH CHECK). SELECT/DELETE não vinculam cartão, então
    -- ficam de fora da checagem.
    IF r.cmd IN ('INSERT', 'UPDATE', 'ALL') THEN
      IF r.with_check IS NULL OR position('cartao_id' in r.with_check) = 0 THEN
        escrita_sem_validacao := escrita_sem_validacao + 1;
        RAISE WARNING 'ALERTA: política de escrita "%" (%) NAO valida cartao_id no WITH CHECK — revise antes de confiar na trava.',
          r.policyname, r.cmd;
      END IF;
    END IF;
  END LOOP;

  IF escrita_sem_validacao = 0 THEN
    RAISE NOTICE 'OK: todas as políticas de escrita validam a propriedade do cartão (cartao_id).';
  ELSE
    RAISE WARNING 'Encontradas % política(s) de escrita sem validação de cartao_id — ver avisos acima.', escrita_sem_validacao;
  END IF;
END $$;
