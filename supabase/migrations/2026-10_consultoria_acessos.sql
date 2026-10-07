-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Acesso de consultoria: o ADMIN (consultor) pode VISUALIZAR os dados
-- financeiros de um cliente em modo SOMENTE LEITURA, mas apenas após
-- AUTORIZAÇÃO EXPLÍCITA do próprio cliente.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
--
-- SEGURO para o banco atual:
--   • NÃO cria/recria a função e_admin() — apenas REUTILIZA a já existente.
--   • NÃO usa DROP em nada.
--   • NÃO desativa RLS de nenhuma tabela.
--   • NÃO altera nem apaga tabelas/dados existentes.
--   • Apenas ADICIONA uma tabela nova (consultoria_acessos), uma função
--     de verificação (consultor_autorizado) e policies de SELECT extras
--     (nunca de escrita) nas tabelas financeiras + perfis.
--   • Idempotente: CREATE ... IF NOT EXISTS e policies criadas só se faltarem
--     (via pg_policies). Pode rodar de novo sem efeito colateral.
--
-- Pré-requisito: a função public.e_admin() JÁ EXISTE no seu projeto (usada
-- hoje no painel admin). Esta migração depende dela, mas não a modifica.
--
-- MODELO DE SEGURANÇA:
--   • Uma linha em consultoria_acessos liga um CONSULTOR (admin) a um CLIENTE.
--   • status: 'pendente' (consultor pediu) → 'autorizado' (cliente aceitou)
--             → 'revogado'/'recusado' (cliente negou/cancelou).
--   • O consultor só enxerga os dados financeiros do cliente ENQUANTO existir
--     uma linha com status='autorizado'. Qualquer outro status = sem acesso.
--   • O acesso é SOMENTE LEITURA: as policies extras são apenas FOR SELECT.
--     Nenhuma policy nova de INSERT/UPDATE/DELETE é concedida ao consultor,
--     então o consultor NUNCA consegue alterar os dados do cliente.
--   • O cliente controla tudo: autoriza, recusa e revoga quando quiser.
-- ============================================================


-- ------------------------------------------------------------
-- TABELA: consultoria_acessos
-- Uma linha por par (consultor, cliente). Guarda o estado da autorização.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultoria_acessos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Consultor (admin) que solicita/recebe o acesso.
  consultor_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Cliente dono dos dados financeiros.
  cliente_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pendente'
                CHECK (status IN ('pendente','autorizado','recusado','revogado')),
  solicitado_em TIMESTAMPTZ DEFAULT NOW(),
  respondido_em TIMESTAMPTZ,
  -- Um único vínculo por par consultor/cliente (reutilizado via UPDATE de status).
  UNIQUE (consultor_id, cliente_id),
  -- Um consultor não solicita acesso aos próprios dados.
  CHECK (consultor_id <> cliente_id)
);

ALTER TABLE public.consultoria_acessos ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cons_acessos_cliente   ON public.consultoria_acessos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cons_acessos_consultor ON public.consultoria_acessos (consultor_id);
CREATE INDEX IF NOT EXISTS idx_cons_acessos_status    ON public.consultoria_acessos (status);


-- ------------------------------------------------------------
-- POLICIES da própria tabela consultoria_acessos
--   • SELECT: o consultor (admin) vê as próprias solicitações; o cliente vê as
--     solicitações direcionadas a ele.
--   • INSERT: SOMENTE admin, e apenas como consultor_id = ele mesmo (não pode
--     criar solicitação em nome de outro consultor). status inicial 'pendente'.
--   • UPDATE: o CLIENTE pode mudar o status da SUA linha (autorizar/recusar/
--     revogar); o admin pode mudar as linhas em que é o consultor (ex.: cancelar
--     uma solicitação pendente). Cada um só mexe nas próprias linhas.
--   • DELETE: cliente ou consultor da própria linha.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_acessos'
      AND policyname='Acessos: ver (cliente ou consultor)') THEN
    CREATE POLICY "Acessos: ver (cliente ou consultor)"
      ON public.consultoria_acessos FOR SELECT
      USING (auth.uid() = cliente_id OR auth.uid() = consultor_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_acessos'
      AND policyname='Acessos: solicitar (admin consultor)') THEN
    CREATE POLICY "Acessos: solicitar (admin consultor)"
      ON public.consultoria_acessos FOR INSERT
      WITH CHECK (public.e_admin() AND auth.uid() = consultor_id);
  END IF;

  -- UPDATE do status é EXCLUSIVO do CLIENTE (autorizar/recusar/revogar).
  -- O consultor NÃO pode alterar o status (não pode se auto-autorizar); para
  -- desistir de uma solicitação pendente ele usa DELETE (policy abaixo).
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_acessos'
      AND policyname='Acessos: responder (somente cliente)') THEN
    CREATE POLICY "Acessos: responder (somente cliente)"
      ON public.consultoria_acessos FOR UPDATE
      USING (auth.uid() = cliente_id)
      WITH CHECK (auth.uid() = cliente_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_acessos'
      AND policyname='Acessos: apagar (próprio vínculo)') THEN
    CREATE POLICY "Acessos: apagar (próprio vínculo)"
      ON public.consultoria_acessos FOR DELETE
      USING (auth.uid() = cliente_id OR auth.uid() = consultor_id);
  END IF;
END $$;


-- ------------------------------------------------------------
-- FUNÇÃO: public.consultor_autorizado(dono_id UUID)
-- Retorna TRUE se o usuário atual (auth.uid()) é um consultor com acesso
-- AUTORIZADO e vigente aos dados de "dono_id".
--
-- SECURITY DEFINER + search_path fixo: a checagem consulta consultoria_acessos
-- sem ficar presa à RLS da própria tabela (evita recursão/ambiguidade) e roda
-- de forma estável. STABLE: não altera dados.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consultor_autorizado(dono_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consultoria_acessos a
    WHERE a.consultor_id = auth.uid()
      AND a.cliente_id   = dono_id
      AND a.status       = 'autorizado'
  );
$$;


-- ------------------------------------------------------------
-- POLICIES EXTRAS DE LEITURA (SELECT) nas tabelas financeiras + perfis.
-- Cada uma é ADICIONAL: a policy existente do dono (auth.uid() = usuario_id)
-- continua intacta. A nova policy concede SELECT ao consultor autorizado.
-- NENHUMA policy de escrita é criada → o consultor só lê.
-- ------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
  pol TEXT;
  tabelas TEXT[] := ARRAY[
    'receitas','despesas','cartoes','compras_cartao','metas',
    'parcelamentos','despesas_tipo_excecoes','faturas_cartao'
  ];
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    -- Só age se a tabela existir (faturas_cartao vem de outra migração).
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      pol := 'Consultor autorizado vê ' || t;
      IF NOT EXISTS (SELECT 1 FROM pg_policies
                     WHERE schemaname='public' AND tablename=t AND policyname=pol) THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.%I FOR SELECT USING (public.consultor_autorizado(usuario_id));',
          pol, t
        );
      END IF;
    END IF;
  END LOOP;

  -- perfis: o consultor autorizado precisa ler o perfil do cliente (nome,
  -- reserva, saldo_base etc.) para o modo de visualização funcionar. A coluna
  -- de dono em perfis é "id" (não "usuario_id").
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE schemaname='public' AND tablename='perfis'
                   AND policyname='Consultor autorizado vê perfil do cliente') THEN
    CREATE POLICY "Consultor autorizado vê perfil do cliente"
      ON public.perfis FOR SELECT
      USING (public.consultor_autorizado(id));
  END IF;

  -- categorias: o cliente pode ter categorias próprias (usuario_id = cliente).
  -- Libera leitura delas ao consultor autorizado (as do sistema já são visíveis
  -- a todos pela policy existente). Sem isso, despesas/receitas do cliente que
  -- referenciam categorias próprias viriam sem o nome/ícone da categoria.
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='categorias') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE schemaname='public' AND tablename='categorias'
                     AND policyname='Consultor autorizado vê categorias do cliente') THEN
      CREATE POLICY "Consultor autorizado vê categorias do cliente"
        ON public.categorias FOR SELECT
        USING (usuario_id IS NOT NULL AND public.consultor_autorizado(usuario_id));
    END IF;
  END IF;
END $$;


-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
