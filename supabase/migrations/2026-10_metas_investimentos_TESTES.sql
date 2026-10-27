-- ============================================================
-- TESTES (revisão manual) — Vínculos Metas + Investimentos
-- ============================================================
-- NÃO é parte da migration e NÃO deve rodar em produção. São roteiros para
-- validar, em ambiente de teste/staging, a migration 2026-10_metas_investimentos.sql:
--   A) isolamento RLS entre dois usuários;
--   B) rejeição de alocação acima do saldo disponível;
--   C) rejeição ao reduzir saldo/aumentar reserva abaixo do alocado;
--   D) concorrência (duas sessões alocando o mesmo investimento).
--
-- Como usar: rode cada bloco no SQL Editor do Supabase OU via psql. Os blocos
-- A–C usam SET LOCAL request.jwt.claims para simular auth.uid() (o mesmo que o
-- PostgREST injeta). Substitua os UUIDs pelos de contas de TESTE.
-- ------------------------------------------------------------

-- Pré: tenha 2 usuários de teste em auth.users e, para cada um, 1 meta e 1
-- investimento. Exemplo de placeholders:
--   :u1  = UUID do usuário 1          :u2  = UUID do usuário 2
--   :m1  = meta do usuário 1          :i1  = investimento do usuário 1 (valor_atual=1000, reserva_valor=0)
--   :m2  = meta do usuário 2          :i2  = investimento do usuário 2

-- ------------------------------------------------------------
-- A) ISOLAMENTO RLS — usuário 2 NÃO enxerga/insere vínculo do usuário 1.
-- ------------------------------------------------------------
BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":":u1","role":"authenticated"}';
  -- u1 cria um vínculo válido (200 de 1000 disponíveis):
  INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
  VALUES (':u1', ':m1', ':i1', 200);   -- espera: OK

  SET LOCAL "request.jwt.claims" = '{"sub":":u2","role":"authenticated"}';
  -- u2 tenta ver os vínculos: deve retornar 0 linhas (RLS).
  SELECT count(*) AS deve_ser_zero FROM public.metas_investimentos;   -- espera: 0

  -- u2 tenta vincular o investimento de u1 à própria meta: deve FALHAR
  -- (FK composta + policy + trigger de propriedade).
  -- INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
  -- VALUES (':u2', ':m2', ':i1', 50);   -- espera: ERRO (propriedade/RLS)
ROLLBACK;

-- ------------------------------------------------------------
-- B) ALOCAÇÃO EXCESSIVA — soma acima de (valor_atual - reserva_valor) é barrada.
-- ------------------------------------------------------------
BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":":u1","role":"authenticated"}';
  -- i1 tem valor_atual=1000, reserva_valor=0. Aloca 900 (OK):
  INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
  VALUES (':u1', ':m1', ':i1', 900);   -- espera: OK
  -- Tenta subir para 1100 (> disponível): deve FALHAR com check_violation.
  -- UPDATE public.metas_investimentos SET valor_alocado = 1100
  --   WHERE usuario_id=':u1' AND meta_id=':m1' AND investimento_id=':i1';  -- espera: ERRO
ROLLBACK;

-- ------------------------------------------------------------
-- C) REDUÇÃO DE SALDO / AUMENTO DE RESERVA abaixo do alocado — barrado.
-- ------------------------------------------------------------
BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL "request.jwt.claims" = '{"sub":":u1","role":"authenticated"}';
  INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
  VALUES (':u1', ':m1', ':i1', 800);   -- aloca 800 de 1000
  -- Reduzir valor_atual para 500 (< 800 alocado): deve FALHAR.
  -- UPDATE public.investimentos SET valor_atual = 500 WHERE id=':i1';  -- espera: ERRO
  -- Aumentar reserva_valor para 300 (disponível cairia p/ 700 < 800): deve FALHAR.
  -- UPDATE public.investimentos SET reserva_valor = 300 WHERE id=':i1'; -- espera: ERRO
ROLLBACK;

-- ------------------------------------------------------------
-- D) CONCORRÊNCIA — duas sessões alocando o MESMO investimento.
-- ------------------------------------------------------------
-- Abra DUAS conexões psql (sessão 1 e sessão 2). i1: valor_atual=1000, reserva=0.
--
-- Sessão 1:
--   BEGIN;
--   SET LOCAL "request.jwt.claims" = '{"sub":":u1","role":"authenticated"}';
--   INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
--   VALUES (':u1', ':m1', ':i1', 700);     -- adquire lock da linha de i1 (FOR UPDATE)
--   -- (ainda NÃO commitou)
--
-- Sessão 2 (em paralelo):
--   BEGIN;
--   SET LOCAL "request.jwt.claims" = '{"sub":":u1","role":"authenticated"}';
--   INSERT INTO public.metas_investimentos (usuario_id, meta_id, investimento_id, valor_alocado)
--   VALUES (':u1', <outra_meta_do_u1>, ':i1', 500);  -- BLOQUEIA no lock até a sessão 1 terminar
--
-- Sessão 1:
--   COMMIT;                                -- libera o lock (700 alocados)
--
-- Sessão 2 (desbloqueia e revalida): 700 + 500 = 1200 > 1000 → deve FALHAR com
--   check_violation. Resultado esperado: apenas UMA das alocações concorrentes
--   que estouraria o saldo é rejeitada; nunca as duas passam.
-- ------------------------------------------------------------
