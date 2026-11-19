-- ============================================================================
-- ALMEIDA FAMÍLIA + WHATSAPP + MONETIZAÇÃO
-- Migration segura e idempotente
-- Criada: 2026-11-19
-- ============================================================================

-- 1. PLANOS DE ASSINATURA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
  whatsapp_franquia INTEGER NOT NULL DEFAULT 0,
  whatsapp_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  familia_habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dados iniciais dos planos
INSERT INTO public.subscription_plans (id, nome, preco_mensal, whatsapp_franquia, whatsapp_habilitado, familia_habilitado, ordem, ativo)
VALUES
  ('free', 'Almeida Free', 0, 0, FALSE, FALSE, 1, TRUE),
  ('premium', 'Almeida Premium', 19.90, 100, TRUE, TRUE, 2, TRUE),
  ('plus', 'Almeida Plus', 29.90, 300, TRUE, TRUE, 3, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Adiciona coluna de plano aos perfis
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free' REFERENCES public.subscription_plans(id);

-- 2. GRUPOS FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  criador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_family_groups_criador ON public.family_groups(criador_id);

-- RLS: Membros veem apenas grupos dos quais fazem parte
ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_groups' AND policyname='Membros veem seus grupos'
  ) THEN
    CREATE POLICY "Membros veem seus grupos" ON public.family_groups FOR SELECT
    USING (
      id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_groups' AND policyname='Criador gerencia grupo'
  ) THEN
    CREATE POLICY "Criador gerencia grupo" ON public.family_groups FOR ALL
    USING (criador_id = auth.uid())
    WITH CHECK (criador_id = auth.uid());
  END IF;
END $$;

-- 3. MEMBROS DOS GRUPOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'membro')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_group ON public.family_members(group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(usuario_id);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_members' AND policyname='Membros veem membros do grupo'
  ) THEN
    CREATE POLICY "Membros veem membros do grupo" ON public.family_members FOR SELECT
    USING (
      group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    );
  END IF;
END $$;

-- 4. CONVITES FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  convidado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'expirado')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usado_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_family_invitations_token ON public.family_invitations(token);
CREATE INDEX IF NOT EXISTS idx_family_invitations_group ON public.family_invitations(group_id);

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_invitations' AND policyname='Membros gerenciam convites'
  ) THEN
    CREATE POLICY "Membros gerenciam convites" ON public.family_invitations FOR ALL
    USING (
      group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    );
  END IF;
END $$;

-- 5. DIVISÕES DE DESPESAS FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  pagador_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_expense_splits_despesa ON public.family_expense_splits(despesa_id);
CREATE INDEX IF NOT EXISTS idx_family_expense_splits_group ON public.family_expense_splits(group_id);

ALTER TABLE public.family_expense_splits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_expense_splits' AND policyname='Membros veem divisões do grupo'
  ) THEN
    CREATE POLICY "Membros veem divisões do grupo" ON public.family_expense_splits FOR SELECT
    USING (
      group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    );
  END IF;
END $$;

-- 6. PARTICIPANTES DAS DIVISÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_split_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id UUID NOT NULL REFERENCES public.family_expense_splits(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_devido DECIMAL(10,2) NOT NULL,
  pago BOOLEAN NOT NULL DEFAULT FALSE,
  pago_em TIMESTAMPTZ,
  UNIQUE(split_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_family_split_participants_split ON public.family_split_participants(split_id);
CREATE INDEX IF NOT EXISTS idx_family_split_participants_user ON public.family_split_participants(usuario_id);

ALTER TABLE public.family_split_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_split_participants' AND policyname='Usuário vê suas participações'
  ) THEN
    CREATE POLICY "Usuário vê suas participações" ON public.family_split_participants FOR ALL
    USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());
  END IF;
END $$;

-- 7. METAS FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  valor_alvo DECIMAL(10,2) NOT NULL,
  valor_atual DECIMAL(10,2) NOT NULL DEFAULT 0,
  data_limite DATE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_goals_group ON public.family_goals(group_id);

ALTER TABLE public.family_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_goals' AND policyname='Membros gerenciam metas do grupo'
  ) THEN
    CREATE POLICY "Membros gerenciam metas do grupo" ON public.family_goals FOR ALL
    USING (
      group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    )
    WITH CHECK (
      group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
    );
  END IF;
END $$;

-- 8. CONTRIBUIÇÕES PARA METAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.family_goals(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_goal_contributions_goal ON public.family_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_family_goal_contributions_user ON public.family_goal_contributions(usuario_id);

ALTER TABLE public.family_goal_contributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='family_goal_contributions' AND policyname='Membros veem contribuições'
  ) THEN
    CREATE POLICY "Membros veem contribuições" ON public.family_goal_contributions FOR SELECT
    USING (
      goal_id IN (
        SELECT id FROM public.family_goals 
        WHERE group_id IN (SELECT group_id FROM public.family_members WHERE usuario_id = auth.uid())
      )
    );
  END IF;
END $$;

-- 9. CONEXÕES WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  verificado BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user ON public.whatsapp_connections(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_phone ON public.whatsapp_connections(phone_number);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_connections' AND policyname='Usuário gerencia própria conexão'
  ) THEN
    CREATE POLICY "Usuário gerencia própria conexão" ON public.whatsapp_connections FOR ALL
    USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_connections' AND policyname='Admin vê todas conexões'
  ) THEN
    CREATE POLICY "Admin vê todas conexões" ON public.whatsapp_connections FOR SELECT
    USING (public.e_admin());
  END IF;
END $$;

-- 10. EVENTOS DE MENSAGENS WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone_number TEXT NOT NULL,
  message_text TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  status TEXT,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user ON public.whatsapp_message_events(usuario_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_message_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON public.whatsapp_message_events(direction);

ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_message_events' AND policyname='Usuário vê próprias mensagens'
  ) THEN
    CREATE POLICY "Usuário vê próprias mensagens" ON public.whatsapp_message_events FOR SELECT
    USING (usuario_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_message_events' AND policyname='Admin vê todas mensagens'
  ) THEN
    CREATE POLICY "Admin vê todas mensagens" ON public.whatsapp_message_events FOR SELECT
    USING (public.e_admin());
  END IF;
END $$;

-- 11. USO DO WHATSAPP (FRANQUIA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciclo_mes INTEGER NOT NULL,
  ciclo_ano INTEGER NOT NULL,
  mensagens_recebidas INTEGER NOT NULL DEFAULT 0,
  mensagens_enviadas INTEGER NOT NULL DEFAULT 0,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(usuario_id, ciclo_mes, ciclo_ano)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usage_user_ciclo ON public.whatsapp_usage(usuario_id, ciclo_ano DESC, ciclo_mes DESC);

ALTER TABLE public.whatsapp_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_usage' AND policyname='Usuário vê próprio uso'
  ) THEN
    CREATE POLICY "Usuário vê próprio uso" ON public.whatsapp_usage FOR SELECT
    USING (usuario_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_usage' AND policyname='Admin vê todo uso'
  ) THEN
    CREATE POLICY "Admin vê todo uso" ON public.whatsapp_usage FOR SELECT
    USING (public.e_admin());
  END IF;
END $$;

-- 12. CONFIGURAÇÕES DE CUSTOS WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_cost_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  custo_mensagem_servico DECIMAL(10,6) NOT NULL DEFAULT 0.005,
  custo_mensagem_utilidade DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  custo_mensagem_marketing DECIMAL(10,6) NOT NULL DEFAULT 0.05,
  custo_transcricao_minuto DECIMAL(10,4) NOT NULL DEFAULT 0.006,
  orcamento_mensal DECIMAL(10,2) NOT NULL DEFAULT 1000,
  alerta_percentual INTEGER NOT NULL DEFAULT 80,
  versao INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.whatsapp_cost_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.whatsapp_cost_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' 
    AND tablename='whatsapp_cost_settings' AND policyname='Admin gerencia custos'
  ) THEN
    CREATE POLICY "Admin gerencia custos" ON public.whatsapp_cost_settings FOR ALL
    USING (public.e_admin())
    WITH CHECK (public.e_admin());
  END IF;
END $$;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
