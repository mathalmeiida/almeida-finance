-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Consultoria (interesses dos clientes) + Agenda do administrador
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO para o banco atual:
--   • NÃO cria/recria a função e_admin() — apenas REUTILIZA a já existente.
--   • NÃO usa DROP em nada.
--   • Não altera nem apaga tabelas/dados existentes.
--   • Idempotente: CREATE TABLE/INDEX IF NOT EXISTS e criação de policy
--     condicionada a NÃO existir (via pg_policies), então pode rodar de novo.
--
-- Pré-requisito: a função public.e_admin() JÁ EXISTE no seu projeto (é usada
-- hoje no painel admin). Este script depende dela, mas não a modifica.
--
-- Segurança (RLS) de consultoria_interesses:
--   • SELECT: usuário vê só os PRÓPRIOS; admin vê TODOS.
--   • INSERT: usuário cria só com o próprio usuario_id.
--   • UPDATE: SOMENTE admin (gestão do status/dados).
--   • DELETE: SOMENTE admin.
--   • agendamentos: SOMENTE o admin acessa (todas as operações).
-- ============================================================


-- ------------------------------------------------------------
-- TABELA: consultoria_interesses
-- Um registro por solicitação de interesse do usuário na consultoria.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consultoria_interesses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  whatsapp    TEXT NOT NULL,                 -- somente dígitos: 'DDDNÚMERO'
  status      TEXT NOT NULL DEFAULT 'novo'
              CHECK (status IN ('novo','contatado','agendado','concluido','cancelado')),
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.consultoria_interesses ENABLE ROW LEVEL SECURITY;

-- Policies criadas condicionalmente (sem DROP): só cria se ainda não existir.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_interesses'
      AND policyname='Interesses: ver') THEN
    CREATE POLICY "Interesses: ver"
      ON public.consultoria_interesses FOR SELECT
      USING (auth.uid() = usuario_id OR public.e_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_interesses'
      AND policyname='Interesses: inserir') THEN
    CREATE POLICY "Interesses: inserir"
      ON public.consultoria_interesses FOR INSERT
      WITH CHECK (auth.uid() = usuario_id);
  END IF;

  -- UPDATE: SOMENTE admin (gestão do status/dados da solicitação).
  -- O usuário comum não altera o próprio interesse depois de criado.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_interesses'
      AND policyname='Interesses: atualizar') THEN
    CREATE POLICY "Interesses: atualizar"
      ON public.consultoria_interesses FOR UPDATE
      USING (public.e_admin())
      WITH CHECK (public.e_admin());
  END IF;

  -- DELETE: SOMENTE admin.
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='consultoria_interesses'
      AND policyname='Interesses: apagar') THEN
    CREATE POLICY "Interesses: apagar"
      ON public.consultoria_interesses FOR DELETE
      USING (public.e_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_consultoria_usuario ON public.consultoria_interesses (usuario_id);
CREATE INDEX IF NOT EXISTS idx_consultoria_status  ON public.consultoria_interesses (status);


-- ------------------------------------------------------------
-- TABELA: agendamentos (agenda administrativa)
-- Um agendamento criado pelo admin, opcionalmente a partir de um interesse.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Interesse de origem (opcional). Se o interesse for apagado, mantém o
  -- agendamento mas zera o vínculo.
  interesse_id  UUID REFERENCES public.consultoria_interesses(id) ON DELETE SET NULL,
  -- Cliente (opcional): referência ao usuário, se o agendamento vier de um
  -- interesse de um usuário do app.
  cliente_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  whatsapp      TEXT,                          -- somente dígitos
  data          DATE NOT NULL,
  horario       TIME NOT NULL,
  observacoes   TEXT,
  status        TEXT NOT NULL DEFAULT 'agendado'
                CHECK (status IN ('agendado','concluido','cancelado')),
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Policy única: SOMENTE admin acessa (todas as operações). Criada só se faltar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='agendamentos'
      AND policyname='Agenda: admin gerencia tudo') THEN
    CREATE POLICY "Agenda: admin gerencia tudo"
      ON public.agendamentos FOR ALL
      USING (public.e_admin())
      WITH CHECK (public.e_admin());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON public.agendamentos (data, horario);


-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
