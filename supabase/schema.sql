-- ============================================================
-- POSSO COMPRAR? — Script de banco de dados
-- Execute este script no SQL Editor do Supabase
-- (menu lateral > SQL Editor > New query > cole e clique em Run)
-- ============================================================


-- ============================================================
-- 1. TABELA: perfis
-- Armazena informações do usuário (complementa o auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfis (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT,
  email       TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- Colunas adicionadas por evolução do app (rode os ALTERs no banco já criado):
-- Reserva de emergência: percentual mensal a separar da renda (padrão 20%).
-- ALTER TABLE public.perfis ADD COLUMN reserva_percentual INTEGER DEFAULT 20;
-- Valor JÁ guardado como reserva de emergência (patrimônio). NÃO entra em
-- renda nem no disponível para gastar — é apenas informativo.
-- ALTER TABLE public.perfis
--   ADD COLUMN IF NOT EXISTS reserva_atual NUMERIC(12,2) DEFAULT 0
--   CHECK (reserva_atual IS NULL OR reserva_atual >= 0);
-- Meta TOTAL da reserva de emergência (objetivo a acumular). Também informativo;
-- usado só para progresso/"falta acumular". NÃO afeta nenhum cálculo financeiro.
-- ALTER TABLE public.perfis
--   ADD COLUMN IF NOT EXISTS meta_reserva NUMERIC(12,2) DEFAULT 0
--   CHECK (meta_reserva IS NULL OR meta_reserva >= 0);
-- Saldo atual real informado pelo usuário ("Quanto você tem disponível hoje?").
-- saldo_base = valor informado; saldo_base_data = marco temporal (a partir dele
-- as receitas/despesas alteram o saldo, evitando dupla contagem do histórico).
-- NULL = não configurado (usuários existentes). NÃO inclui a reserva.
-- ALTER TABLE public.perfis
--   ADD COLUMN IF NOT EXISTS saldo_base NUMERIC(12,2),
--   ADD COLUMN IF NOT EXISTS saldo_base_data DATE;

-- RLS: cada usuário acessa apenas o próprio perfil
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê apenas o próprio perfil"
  ON public.perfis FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Usuário insere apenas o próprio perfil"
  ON public.perfis FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Usuário atualiza apenas o próprio perfil"
  ON public.perfis FOR UPDATE
  USING (auth.uid() = id);


-- ============================================================
-- 2. TABELA: categorias
-- usuario_id = NULL  → categoria padrão do sistema (todos veem)
-- usuario_id = <id>  → categoria personalizada do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  icone       TEXT DEFAULT '📁',
  cor         TEXT DEFAULT '#6b7280',
  tipo        TEXT CHECK (tipo IN ('despesa', 'receita', 'ambos')) DEFAULT 'despesa',
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: usuário vê as categorias do sistema (NULL) + as próprias
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê categorias do sistema e próprias"
  ON public.categorias FOR SELECT
  USING (usuario_id IS NULL OR auth.uid() = usuario_id);

CREATE POLICY "Usuário insere apenas categorias próprias"
  ON public.categorias FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuário atualiza apenas categorias próprias"
  ON public.categorias FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuário apaga apenas categorias próprias"
  ON public.categorias FOR DELETE
  USING (auth.uid() = usuario_id);


-- ============================================================
-- 3. TABELA: receitas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.receitas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao   TEXT NOT NULL,
  valor       NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data        DATE NOT NULL,
  recorrente  BOOLEAN DEFAULT FALSE,
  categoria   TEXT,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias receitas"
  ON public.receitas FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 4. TABELA: despesas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.despesas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao     TEXT NOT NULL,
  valor         NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data          DATE NOT NULL,
  recorrente    BOOLEAN DEFAULT FALSE,
  categoria_id  UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  -- Classificação automática: 'fixa' (valor estável) ou 'variavel' (valor flutuante)
  -- Independente de recorrente. Definida pelo app via regras de categoria/descrição.
  -- Pode ser corrigida manualmente pelo usuário.
  tipo_despesa  TEXT CHECK (tipo_despesa IN ('fixa', 'variavel')) DEFAULT 'variavel',
  -- Duração da recorrência em meses (só se aplica quando frequencia = 'por_meses').
  -- NULL = recorrência sem prazo definido (repete indefinidamente).
  -- A coluna "data" é considerada a primeira ocorrência.
  recorrencia_meses INTEGER CHECK (recorrencia_meses IS NULL OR recorrencia_meses > 0),
  -- Frequência da recorrência:
  --   'nao_repete' | 'mensal' | 'semanal' | 'diaria' | 'por_meses'
  -- O booleano "recorrente" é mantido por compatibilidade (TRUE p/ qualquer
  -- frequência != 'nao_repete').
  frequencia    TEXT CHECK (frequencia IN ('nao_repete','mensal','semanal','diaria','por_meses')) DEFAULT 'nao_repete',
  -- Forma de pagamento (texto livre controlado pelo app). NULL = não informado.
  forma_pagamento TEXT,
  -- Pagamento antecipado: data em que a despesa foi efetivamente paga.
  -- NULL = segue a regra normal (afeta o saldo quando a "data" de vencimento
  -- chega). Preenchida = paga nesse dia; o app usa pago_em (e não "data") como
  -- o momento em que o dinheiro saiu, sem contar duas vezes. A "data"
  -- (vencimento) nunca é alterada ao antecipar.
  -- ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS pago_em DATE DEFAULT NULL;
  pago_em       DATE DEFAULT NULL,
  criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- ATENÇÃO: se o banco já foi criado, execute apenas estes comandos adicionais:
-- ALTER TABLE public.despesas ADD COLUMN tipo_despesa TEXT CHECK (tipo_despesa IN ('fixa', 'variavel')) DEFAULT 'variavel';
-- ALTER TABLE public.despesas ADD COLUMN recorrencia_meses INTEGER CHECK (recorrencia_meses IS NULL OR recorrencia_meses > 0);
-- ALTER TABLE public.despesas ADD COLUMN frequencia TEXT CHECK (frequencia IN ('nao_repete','mensal','semanal','diaria','por_meses')) DEFAULT 'nao_repete';
-- ALTER TABLE public.despesas ADD COLUMN forma_pagamento TEXT;
-- Migração dos dados existentes para a nova coluna frequencia:
-- UPDATE public.despesas SET frequencia = 'por_meses' WHERE recorrente = TRUE AND recorrencia_meses IS NOT NULL;
-- UPDATE public.despesas SET frequencia = 'mensal'    WHERE recorrente = TRUE AND recorrencia_meses IS NULL;

-- RLS
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias despesas"
  ON public.despesas FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 4b. TABELA: despesas_tipo_excecoes
-- Override MENSAL do tipo (fixa/variável) de uma despesa recorrente,
-- sem alterar o registro base nem duplicar o lançamento. Afeta apenas
-- o rótulo e os totais Fixas/Variáveis do mês indicado.
-- (Criada pela migração 2026-10_editar_tipo_e_antecipar_pagamento.sql)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.despesas_tipo_excecoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  despesa_id    UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  ano_mes       TEXT NOT NULL CHECK (ano_mes ~ '^[0-9]{4}-[0-9]{2}$'),
  tipo_despesa  TEXT NOT NULL CHECK (tipo_despesa IN ('fixa','variavel')),
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (despesa_id, ano_mes)
);

ALTER TABLE public.despesas_tipo_excecoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias exceções de tipo"
  ON public.despesas_tipo_excecoes FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 5. TABELA: parcelamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parcelamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  valor_total      NUMERIC(12,2) NOT NULL CHECK (valor_total > 0),
  numero_parcelas  INTEGER NOT NULL CHECK (numero_parcelas > 0),
  valor_parcela    NUMERIC(12,2) GENERATED ALWAYS AS (ROUND(valor_total / numero_parcelas, 2)) STORED,
  primeira_parcela DATE NOT NULL,
  categoria_id     UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  -- Quitação antecipada: NULL = ativo; data preenchida = quitado naquela data
  -- Preserva o histórico. Parcelas futuras saem da projeção automaticamente.
  -- ALTER TABLE para bancos já criados:
  -- ALTER TABLE public.parcelamentos ADD COLUMN quitado_em DATE DEFAULT NULL;
  quitado_em       DATE DEFAULT NULL,
  -- Forma de pagamento (texto livre controlado pelo app). NULL = não informado.
  -- ALTER TABLE public.parcelamentos ADD COLUMN forma_pagamento TEXT;
  forma_pagamento  TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.parcelamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas os próprios parcelamentos"
  ON public.parcelamentos FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 6. TABELA: metas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.metas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  valor_desejado NUMERIC(12,2) NOT NULL CHECK (valor_desejado > 0),
  valor_atual    NUMERIC(12,2) DEFAULT 0 CHECK (valor_atual >= 0),
  prazo          DATE,
  cor            TEXT DEFAULT '#2563eb',
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias metas"
  ON public.metas FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 7. TRIGGER: criar perfil automaticamente ao cadastrar usuário
-- Quando alguém se cadastra, um registro em "perfis" é criado
-- ============================================================
CREATE OR REPLACE FUNCTION public.criar_perfil_novo_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER ao_criar_usuario
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_perfil_novo_usuario();


-- ============================================================
-- 8. CATEGORIAS PADRÃO DO SISTEMA (usuario_id = NULL)
-- ============================================================
INSERT INTO public.categorias (usuario_id, nome, icone, cor, tipo) VALUES
  -- Despesas
  (NULL, 'Moradia',      '🏠', '#3b82f6', 'despesa'),
  (NULL, 'Alimentação',  '🍽️', '#f97316', 'despesa'),
  (NULL, 'Transporte',   '🚗', '#eab308', 'despesa'),
  (NULL, 'Saúde',        '❤️', '#ef4444', 'despesa'),
  (NULL, 'Educação',     '📚', '#6366f1', 'despesa'),
  (NULL, 'Lazer',        '🎮', '#8b5cf6', 'despesa'),
  (NULL, 'Serviços',     '📱', '#14b8a6', 'despesa'),
  (NULL, 'Internet',     '🌐', '#06b6d4', 'despesa'),
  (NULL, 'Empréstimos',  '💰', '#f43f5e', 'despesa'),
  (NULL, 'Vestuário',    '👕', '#ec4899', 'despesa'),
  (NULL, 'Pets',         '🐾', '#84cc16', 'despesa'),
  (NULL, 'Outros',       '📦', '#6b7280', 'despesa'),
  -- Receitas
  (NULL, 'Salário',      '💼', '#22c55e', 'receita'),
  (NULL, 'Freelance',    '💻', '#06b6d4', 'receita'),
  (NULL, 'Renda extra',  '💰', '#a3e635', 'receita'),
  (NULL, 'Investimento', '📈', '#10b981', 'receita'),
  -- Parcelamentos / Ambos
  (NULL, 'Eletrônicos',  '📺', '#2563eb', 'ambos'),
  (NULL, 'Móveis',       '🛋️', '#d97706', 'ambos'),
  (NULL, 'Viagem',       '✈️', '#0ea5e9', 'ambos')
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. TABELA: cartoes (cartões de crédito do usuário)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cartoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,            -- ex: "Bradesco Visa", "Nubank"
  banco           TEXT,                     -- instituição
  limite_total    NUMERIC(12,2) NOT NULL CHECK (limite_total >= 0),
  dia_fechamento  INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento  INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  cor             TEXT DEFAULT '#6366f1',
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas os próprios cartões"
  ON public.cartoes FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- 10. TABELA: compras_cartao (compras lançadas em um cartão)
-- Uma compra parcelada é UM registro; as parcelas são projetadas
-- pelo app (sem criar N linhas), evitando duplicidade.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.compras_cartao (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cartao_id        UUID NOT NULL REFERENCES public.cartoes(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  valor_total      NUMERIC(12,2) NOT NULL CHECK (valor_total > 0),
  data_compra      DATE NOT NULL,
  numero_parcelas  INTEGER NOT NULL DEFAULT 1 CHECK (numero_parcelas > 0),
  categoria_id     UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.compras_cartao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia apenas as próprias compras de cartão"
  ON public.compras_cartao FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
