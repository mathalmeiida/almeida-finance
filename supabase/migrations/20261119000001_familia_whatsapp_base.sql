-- ============================================================================
-- ALMEIDA FAMÍLIA + WHATSAPP + MONETIZAÇÃO - CORRIGIDA
-- Migration compatível com hooks criados
-- Data: 2026-11-19
-- ============================================================================

-- 1. PLANOS DE ASSINATURA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_mensal INTEGER NOT NULL DEFAULT 0, -- centavos
  whatsapp_msgs_mes INTEGER NOT NULL DEFAULT 0,
  familia_grupos BOOLEAN NOT NULL DEFAULT FALSE,
  consultoria_acesso BOOLEAN NOT NULL DEFAULT FALSE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plans (id, nome, preco_mensal, whatsapp_msgs_mes, familia_grupos, consultoria_acesso)
VALUES
  ('free', 'Almeida Free', 0, 0, FALSE, FALSE),
  ('premium', 'Almeida Premium', 1990, 100, TRUE, TRUE),
  ('plus', 'Almeida Plus', 2990, 300, TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  preco_mensal = EXCLUDED.preco_mensal,
  whatsapp_msgs_mes = EXCLUDED.whatsapp_msgs_mes,
  familia_grupos = EXCLUDED.familia_grupos,
  consultoria_acesso = EXCLUDED.consultoria_acesso;

-- Adiciona coluna aos perfis
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
  ADD COLUMN IF NOT EXISTS plano_override BOOLEAN NOT NULL DEFAULT FALSE;

-- Atualiza default e FK
UPDATE public.perfis SET subscription_plan = 'free' WHERE subscription_plan IS NULL;

ALTER TABLE public.perfis
  ALTER COLUMN subscription_plan SET NOT NULL,
  ALTER COLUMN subscription_plan SET DEFAULT 'free';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'perfis_subscription_plan_fkey'
  ) THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_subscription_plan_fkey 
      FOREIGN KEY (subscription_plan) REFERENCES public.subscription_plans(id);
  END IF;
END $$;

-- Função para verificar se tem acesso Premium (plano OU override OU admin)
CREATE OR REPLACE FUNCTION public.tem_acesso_premium()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan TEXT;
  user_override BOOLEAN;
  user_admin BOOLEAN;
BEGIN
  SELECT subscription_plan, plano_override
  INTO user_plan, user_override
  FROM public.perfis
  WHERE id = auth.uid();
  
  -- Verifica se é admin
  user_admin := public.e_admin();
  
  -- Tem acesso se: premium/plus OU override OU admin
  RETURN (user_plan IN ('premium', 'plus')) OR user_override OR user_admin;
END;
$$;

-- 2. GRUPOS FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.family_groups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros veem seus grupos" ON public.family_groups;
  CREATE POLICY "Membros veem seus grupos" ON public.family_groups FOR SELECT
  USING (
    id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins gerenciam grupos" ON public.family_groups;
  CREATE POLICY "Admins gerenciam grupos" ON public.family_groups FOR ALL
  USING (
    id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  )
  WITH CHECK (
    id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  );
END $$;

-- Permite inserir (criador ainda não é membro)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuários criam grupos" ON public.family_groups;
  CREATE POLICY "Usuários criam grupos" ON public.family_groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
END $$;

-- 3. MEMBROS DOS GRUPOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel TEXT NOT NULL DEFAULT 'membro' CHECK (papel IN ('admin', 'membro')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  juntou_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_family_members_group ON public.family_members(group_id);
CREATE INDEX IF NOT EXISTS idx_family_members_user ON public.family_members(user_id);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros veem membros do grupo" ON public.family_members;
  CREATE POLICY "Membros veem membros do grupo" ON public.family_members FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins gerenciam membros" ON public.family_members;
  CREATE POLICY "Admins gerenciam membros" ON public.family_members FOR ALL
  USING (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  );
END $$;

-- Permite inserir criador e aceitar convites
DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuários se juntam" ON public.family_members;
  CREATE POLICY "Usuários se juntam" ON public.family_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid() OR
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  );
END $$;

-- 4. CONVITES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  email_convidado TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  respondido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_family_invitations_group ON public.family_invitations(group_id);
CREATE INDEX IF NOT EXISTS idx_family_invitations_email ON public.family_invitations(email_convidado);

ALTER TABLE public.family_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins criam convites" ON public.family_invitations;
  CREATE POLICY "Admins criam convites" ON public.family_invitations FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND papel = 'admin' AND ativo = TRUE
    )
  );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros veem convites" ON public.family_invitations;
  CREATE POLICY "Membros veem convites" ON public.family_invitations FOR SELECT
  USING (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
    OR email_convidado = (SELECT email FROM public.perfis WHERE id = auth.uid())
  );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Convidados respondem" ON public.family_invitations;
  CREATE POLICY "Convidados respondem" ON public.family_invitations FOR UPDATE
  USING (email_convidado = (SELECT email FROM public.perfis WHERE id = auth.uid()));
END $$;

-- 5. DIVISÕES DE DESPESAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor_total INTEGER NOT NULL, -- centavos
  paid_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_expense_splits_group ON public.family_expense_splits(group_id);

ALTER TABLE public.family_expense_splits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros gerenciam divisões" ON public.family_expense_splits;
  CREATE POLICY "Membros gerenciam divisões" ON public.family_expense_splits FOR ALL
  USING (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  );
END $$;

-- 6. PARTICIPANTES DAS DIVISÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_split_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id UUID NOT NULL REFERENCES public.family_expense_splits(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor_devido INTEGER NOT NULL, -- centavos
  pago BOOLEAN NOT NULL DEFAULT FALSE,
  pago_em TIMESTAMPTZ,
  UNIQUE(split_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_family_split_participants_split ON public.family_split_participants(split_id);
CREATE INDEX IF NOT EXISTS idx_family_split_participants_user ON public.family_split_participants(participant_id);

ALTER TABLE public.family_split_participants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros veem participações" ON public.family_split_participants;
  CREATE POLICY "Membros veem participações" ON public.family_split_participants FOR SELECT
  USING (
    split_id IN (
      SELECT id FROM public.family_expense_splits 
      WHERE group_id IN (
        SELECT group_id FROM public.family_members 
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
    )
  );
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros atualizam participações" ON public.family_split_participants;
  CREATE POLICY "Membros atualizam participações" ON public.family_split_participants FOR ALL
  USING (
    split_id IN (
      SELECT id FROM public.family_expense_splits 
      WHERE group_id IN (
        SELECT group_id FROM public.family_members 
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
    )
  )
  WITH CHECK (
    split_id IN (
      SELECT id FROM public.family_expense_splits 
      WHERE group_id IN (
        SELECT group_id FROM public.family_members 
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
    )
  );
END $$;

-- 7. METAS FAMILIARES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_alvo INTEGER NOT NULL, -- centavos
  data_alvo DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_goals_group ON public.family_goals(group_id);

ALTER TABLE public.family_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros gerenciam metas" ON public.family_goals;
  CREATE POLICY "Membros gerenciam metas" ON public.family_goals FOR ALL
  USING (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT group_id FROM public.family_members 
      WHERE user_id = auth.uid() AND ativo = TRUE
    )
  );
END $$;

-- 8. CONTRIBUIÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.family_goal_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.family_goals(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  valor INTEGER NOT NULL, -- centavos
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_family_goal_contributions_goal ON public.family_goal_contributions(goal_id);
CREATE INDEX IF NOT EXISTS idx_family_goal_contributions_user ON public.family_goal_contributions(contributor_id);

ALTER TABLE public.family_goal_contributions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Membros gerenciam contribuições" ON public.family_goal_contributions;
  CREATE POLICY "Membros gerenciam contribuições" ON public.family_goal_contributions FOR ALL
  USING (
    goal_id IN (
      SELECT id FROM public.family_goals 
      WHERE group_id IN (
        SELECT group_id FROM public.family_members 
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
    )
  )
  WITH CHECK (
    goal_id IN (
      SELECT id FROM public.family_goals 
      WHERE group_id IN (
        SELECT group_id FROM public.family_members 
        WHERE user_id = auth.uid() AND ativo = TRUE
      )
    )
  );
END $$;

-- 9. CONEXÕES WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'conectado', 'desconectado', 'erro')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_user ON public.whatsapp_connections(user_id);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuário gerencia conexão" ON public.whatsapp_connections;
  CREATE POLICY "Usuário gerencia conexão" ON public.whatsapp_connections FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
END $$;

-- 10. EVENTOS WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text TEXT NOT NULL,
  metadata JSONB,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_user ON public.whatsapp_message_events(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created ON public.whatsapp_message_events(criado_em DESC);

ALTER TABLE public.whatsapp_message_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuário vê mensagens" ON public.whatsapp_message_events;
  CREATE POLICY "Usuário vê mensagens" ON public.whatsapp_message_events FOR SELECT
  USING (user_id = auth.uid());
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuário cria mensagens" ON public.whatsapp_message_events;
  CREATE POLICY "Usuário cria mensagens" ON public.whatsapp_message_events FOR INSERT
  WITH CHECK (user_id = auth.uid());
END $$;

-- 11. USO WHATSAPP
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_referencia DATE NOT NULL,
  mensagens_enviadas INTEGER NOT NULL DEFAULT 0,
  mensagens_recebidas INTEGER NOT NULL DEFAULT 0,
  total_mensagens INTEGER NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_usage_user_mes ON public.whatsapp_usage(user_id, mes_referencia DESC);

ALTER TABLE public.whatsapp_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Usuário vê próprio uso" ON public.whatsapp_usage;
  CREATE POLICY "Usuário vê próprio uso" ON public.whatsapp_usage FOR SELECT
  USING (user_id = auth.uid());
END $$;

-- Sistema atualiza contadores
DO $$ BEGIN
  DROP POLICY IF EXISTS "Sistema atualiza uso" ON public.whatsapp_usage;
  CREATE POLICY "Sistema atualiza uso" ON public.whatsapp_usage FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
END $$;

-- 12. CONFIG CUSTOS (ADMIN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_cost_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  custo_por_mensagem DECIMAL(10,6) NOT NULL DEFAULT 0.01,
  orcamento_mensal DECIMAL(10,2) NOT NULL DEFAULT 1000,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.whatsapp_cost_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.whatsapp_cost_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admin gerencia custos" ON public.whatsapp_cost_settings;
  CREATE POLICY "Admin gerencia custos" ON public.whatsapp_cost_settings FOR ALL
  USING (public.e_admin())
  WITH CHECK (public.e_admin());
END $$;

-- ============================================================================
-- FIM DA MIGRATION CORRIGIDA
-- ============================================================================
