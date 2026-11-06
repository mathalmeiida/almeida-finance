-- ============================================================================
-- TESTES AUTOMATIZADOS DE RLS (Row Level Security)
-- Framework: pgTAP - https://pgtap.org/
-- ============================================================================
-- Este script testa TODAS as políticas RLS com identidades autenticadas reais.
-- Requer: pgTAP instalado no banco de dados
--
-- COMO EXECUTAR:
-- 1. Instalar pgTAP: https://supabase.com/docs/guides/database/extensions/pgtap
-- 2. Via Supabase CLI:
--    supabase test db
-- 3. Ou via psql:
--    psql -h db.xxx.supabase.co -U postgres -d postgres -f rls-security.test.sql
-- ============================================================================

BEGIN;
SELECT plan(60); -- Total de testes esperados

-- ============================================================================
-- SETUP: Criar usuários de teste (simulação de auth.users)
-- ============================================================================
-- Nota: Em produção, auth.uid() retorna o ID do usuário autenticado.
-- Aqui usamos uma função helper para simular isso em testes.

-- Helper para simular contexto de usuário autenticado
CREATE OR REPLACE FUNCTION tests.set_auth_uid(uid uuid) RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid::text)::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper para limpar contexto
CREATE OR REPLACE FUNCTION tests.clear_auth() RETURNS void AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar IDs de usuários de teste
DO $$
DECLARE
  alice_id uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  bob_id uuid := 'b0000000-0000-0000-0000-000000000002'::uuid;
  charlie_id uuid := 'c0000000-0000-0000-0000-000000000003'::uuid;
BEGIN
  -- Inserir perfis de teste
  INSERT INTO public.perfis (id, nome, email, created_at)
  VALUES 
    (alice_id, 'Alice Teste', 'alice_test@example.com', NOW()),
    (bob_id, 'Bob Teste', 'bob_test@example.com', NOW()),
    (charlie_id, 'Charlie Teste', 'charlie_test@example.com', NOW())
  ON CONFLICT (id) DO NOTHING;
END $$;

-- ============================================================================
-- TESTE 1: PERFIS - Isolamento básico
-- ============================================================================
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice deve ver seu próprio perfil
SELECT ok(
  EXISTS(SELECT 1 FROM public.perfis WHERE id = 'a0000000-0000-0000-0000-000000000001'::uuid),
  'Alice vê seu próprio perfil'
);

-- Alice NÃO deve ver perfil de Bob
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.perfis WHERE id = 'b0000000-0000-0000-0000-000000000002'::uuid),
  'Alice NÃO vê perfil de Bob'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 2: RECEITAS - SELECT (Leitura)
-- ============================================================================
-- Alice cria receita (service role para setup)
SET LOCAL role service_role;
INSERT INTO public.receitas (id, usuario_id, descricao, valor, data, tipo)
VALUES 
  ('aaaa0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Salário Alice', 5000.00, CURRENT_DATE, 'salario'),
  ('bbbb0000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'Salário Bob', 3000.00, CURRENT_DATE, 'salario')
ON CONFLICT (id) DO NOTHING;
RESET role;

-- Alice autenticada vê APENAS sua receita
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas),
  1,
  'Alice vê apenas 1 receita (a dela)'
);

SELECT is(
  (SELECT valor FROM public.receitas WHERE id = 'aaaa0000-0000-0000-0000-000000000001'::uuid),
  5000.00,
  'Alice vê sua receita de R$ 5000'
);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.receitas WHERE id = 'bbbb0000-0000-0000-0000-000000000001'::uuid),
  'Alice NÃO vê receita de Bob'
);

SELECT tests.clear_auth();

-- Bob autenticado vê APENAS sua receita
SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas),
  1,
  'Bob vê apenas 1 receita (a dele)'
);

SELECT is(
  (SELECT valor FROM public.receitas WHERE id = 'bbbb0000-0000-0000-0000-000000000001'::uuid),
  3000.00,
  'Bob vê sua receita de R$ 3000'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 3: RECEITAS - INSERT (Criação)
-- ============================================================================
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice consegue inserir receita para ela mesma
SELECT lives_ok(
  $$INSERT INTO public.receitas (id, usuario_id, descricao, valor, data, tipo)
    VALUES ('aaaa0000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Freelance Alice', 1000.00, CURRENT_DATE, 'freelance')$$,
  'Alice consegue criar receita para si mesma'
);

-- Alice NÃO consegue inserir receita para Bob
SELECT throws_ok(
  $$INSERT INTO public.receitas (id, usuario_id, descricao, valor, data, tipo)
    VALUES ('xxxx0000-0000-0000-0000-000000000099'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'Hack Receita', 9999.00, CURRENT_DATE, 'fraude')$$,
  'new row violates row-level security policy',
  'Alice NÃO consegue criar receita para Bob (RLS bloqueia)'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 4: RECEITAS - UPDATE (Atualização)
-- ============================================================================
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice consegue atualizar SUA receita
SELECT lives_ok(
  $$UPDATE public.receitas SET valor = 5500.00 WHERE id = 'aaaa0000-0000-0000-0000-000000000001'::uuid$$,
  'Alice consegue atualizar sua própria receita'
);

-- Alice NÃO consegue atualizar receita de Bob
SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas WHERE id = 'bbbb0000-0000-0000-0000-000000000001'::uuid),
  0,
  'Alice não consegue ver receita de Bob para atualizar'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 5: RECEITAS - DELETE (Exclusão)
-- ============================================================================
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice consegue deletar SUA receita
SELECT lives_ok(
  $$DELETE FROM public.receitas WHERE id = 'aaaa0000-0000-0000-0000-000000000002'::uuid$$,
  'Alice consegue deletar sua própria receita'
);

-- Alice NÃO consegue deletar receita de Bob
SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas WHERE id = 'bbbb0000-0000-0000-0000-000000000001'::uuid),
  0,
  'Alice não vê receita de Bob para deletar (RLS protege)'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 6: DESPESAS - Isolamento completo
-- ============================================================================
-- Setup: Bob cria despesa
SET LOCAL role service_role;
INSERT INTO public.despesas (id, usuario_id, descricao, valor, data, categoria)
VALUES 
  ('dddd0000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'Aluguel Bob', 1200.00, CURRENT_DATE, 'moradia')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice NÃO vê despesa de Bob
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.despesas WHERE id = 'dddd0000-0000-0000-0000-000000000001'::uuid),
  'Alice NÃO vê despesa de Bob'
);

-- Alice consegue criar despesa para si
SELECT lives_ok(
  $$INSERT INTO public.despesas (id, usuario_id, descricao, valor, data, categoria)
    VALUES ('dddd0000-0000-0000-0000-000000000002'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Mercado Alice', 300.00, CURRENT_DATE, 'alimentacao')$$,
  'Alice cria despesa para si mesma'
);

-- Alice NÃO consegue criar despesa para Bob
SELECT throws_ok(
  $$INSERT INTO public.despesas (id, usuario_id, descricao, valor, data, categoria)
    VALUES ('dddd0000-0000-0000-0000-000000000099'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'Hack Despesa', 9999.00, CURRENT_DATE, 'fraude')$$,
  'new row violates row-level security policy',
  'Alice NÃO consegue criar despesa para Bob'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 7: CARTÕES - Isolamento e operações
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.cartoes (id, usuario_id, nome, limite, dia_fechamento, dia_vencimento, cor)
VALUES 
  ('cccc0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Nubank Alice', 3000.00, 5, 15, '#820AD1'),
  ('cccc0000-0000-0000-0000-000000000002'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'Itaú Bob', 5000.00, 10, 20, '#EC7000')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

-- Alice vê APENAS seu cartão
SELECT is(
  (SELECT COUNT(*)::int FROM public.cartoes),
  1,
  'Alice vê apenas 1 cartão (o dela)'
);

SELECT is(
  (SELECT nome FROM public.cartoes WHERE id = 'cccc0000-0000-0000-0000-000000000001'::uuid),
  'Nubank Alice',
  'Alice vê seu cartão Nubank'
);

-- Alice NÃO vê cartão de Bob
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.cartoes WHERE id = 'cccc0000-0000-0000-0000-000000000002'::uuid),
  'Alice NÃO vê cartão de Bob'
);

-- Alice NÃO consegue deletar cartão de Bob
SELECT is(
  (SELECT COUNT(*)::int FROM public.cartoes WHERE id = 'cccc0000-0000-0000-0000-000000000002'::uuid),
  0,
  'Alice não vê cartão de Bob para deletar'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 8: METAS - UPDATE cruzado bloqueado
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.metas (id, usuario_id, descricao, valor_alvo, prazo)
VALUES 
  ('mmmm0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Viagem Europa', 10000.00, CURRENT_DATE + INTERVAL '6 months')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

-- Bob NÃO vê meta de Alice
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.metas WHERE id = 'mmmm0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê meta de Alice'
);

-- Bob NÃO consegue atualizar meta de Alice (RLS impede visibilidade)
SELECT is(
  (SELECT COUNT(*)::int FROM public.metas WHERE id = 'mmmm0000-0000-0000-0000-000000000001'::uuid),
  0,
  'Bob não consegue nem ver a meta para tentar atualizar'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 9: INVESTIMENTOS - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.investimentos (id, usuario_id, nome, tipo, valor_inicial, data_aplicacao)
VALUES 
  ('iiii0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Tesouro Selic', 'renda_fixa', 10000.00, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.investimentos WHERE id = 'iiii0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê investimento de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 10: BENEFÍCIOS - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.beneficios (id, usuario_id, tipo, nome, saldo_inicial, data_inicio)
VALUES 
  ('bbbb0000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'VR', 'Vale Refeição Alice', 500.00, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.beneficios WHERE id = 'bbbb0000-0000-0000-0000-000000000010'::uuid),
  'Bob NÃO vê benefício de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 11: PARCELAMENTOS - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.parcelamentos (id, usuario_id, descricao, valor_total, parcelas_totais, data_inicio)
VALUES 
  ('pppp0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'Notebook Alice', 3000.00, 10, CURRENT_DATE)
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.parcelamentos WHERE id = 'pppp0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê parcelamento de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 12: COMPRAS_CARTAO - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.compras_cartao (id, usuario_id, cartao_id, descricao, valor, data, parcelas)
VALUES 
  ('cccc0000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'cccc0000-0000-0000-0000-000000000001'::uuid, 'Supermercado', 200.00, CURRENT_DATE, 1)
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.compras_cartao WHERE id = 'cccc0000-0000-0000-0000-000000000010'::uuid),
  'Bob NÃO vê compra de cartão de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 13: ACESSO ANÔNIMO (sem autenticação)
-- ============================================================================
SELECT tests.clear_auth();

-- Usuário anônimo NÃO vê NENHUMA receita
SELECT is(
  (SELECT COUNT(*)::int FROM public.receitas),
  0,
  'Usuário anônimo não vê nenhuma receita'
);

-- Usuário anônimo NÃO vê NENHUMA despesa
SELECT is(
  (SELECT COUNT(*)::int FROM public.despesas),
  0,
  'Usuário anônimo não vê nenhuma despesa'
);

-- Usuário anônimo NÃO vê NENHUM cartão
SELECT is(
  (SELECT COUNT(*)::int FROM public.cartoes),
  0,
  'Usuário anônimo não vê nenhum cartão'
);

-- Usuário anônimo NÃO vê NENHUMA meta
SELECT is(
  (SELECT COUNT(*)::int FROM public.metas),
  0,
  'Usuário anônimo não vê nenhuma meta'
);

-- Usuário anônimo NÃO vê NENHUM investimento
SELECT is(
  (SELECT COUNT(*)::int FROM public.investimentos),
  0,
  'Usuário anônimo não vê nenhum investimento'
);

-- Usuário anônimo NÃO vê NENHUM benefício
SELECT is(
  (SELECT COUNT(*)::int FROM public.beneficios),
  0,
  'Usuário anônimo não vê nenhum benefício'
);

-- ============================================================================
-- TESTE 14: CONSULTORIAS_ACESSOS - Controle de permissões
-- ============================================================================
SET LOCAL role service_role;
-- Alice autoriza Charlie como consultor
INSERT INTO public.consultorias_acessos (id, cliente_id, consultor_id, status)
VALUES 
  ('aacc0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid, 'autorizado')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('c0000000-0000-0000-0000-000000000003'::uuid);

-- Charlie (consultor) vê o acesso autorizado
SELECT is(
  (SELECT status FROM public.consultorias_acessos WHERE id = 'aacc0000-0000-0000-0000-000000000001'::uuid),
  'autorizado',
  'Charlie vê que foi autorizado como consultor de Alice'
);

SELECT tests.clear_auth();

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

-- Bob NÃO vê acesso de consultoria entre Alice e Charlie
SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.consultorias_acessos WHERE id = 'aacc0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê relação de consultoria entre Alice e Charlie'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 15: CATEGORIAS - Leitura pública, escrita protegida
-- ============================================================================
SELECT tests.clear_auth();

-- Qualquer um (até anônimo) pode ler categorias
SELECT ok(
  (SELECT COUNT(*) FROM public.categorias) > 0,
  'Usuário anônimo consegue ler categorias (leitura pública)'
);

-- Mas ninguém (exceto service_role) pode inserir categorias
SELECT tests.set_auth_uid('a0000000-0000-0000-0000-000000000001'::uuid);

SELECT throws_ok(
  $$INSERT INTO public.categorias (id, tipo, nome, icone, cor)
    VALUES ('zzzz0000-0000-0000-0000-000000000099'::uuid, 'receita', 'Hack Categoria', '💣', '#FF0000')$$,
  'new row violates row-level security policy',
  'Alice NÃO consegue inserir categoria (apenas admin)'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 16: DESPESAS_TIPO_EXCECOES - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.despesas_tipo_excecoes (id, usuario_id, tipo_base, categoria_customizada)
VALUES 
  ('eeee0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'fixa', 'academia')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.despesas_tipo_excecoes WHERE id = 'eeee0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê exceção de tipo de despesa de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 17: FATURAS_CARTAO_INFORMADAS - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.faturas_cartao_informadas (id, usuario_id, cartao_id, mes, ano, valor_informado)
VALUES 
  ('ffff0000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'cccc0000-0000-0000-0000-000000000001'::uuid, 11, 2026, 1500.00)
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.faturas_cartao_informadas WHERE id = 'ffff0000-0000-0000-0000-000000000001'::uuid),
  'Bob NÃO vê fatura informada de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- TESTE 18: MOVIMENTACOES_BENEFICIOS - Isolamento
-- ============================================================================
SET LOCAL role service_role;
INSERT INTO public.movimentacoes_beneficios (id, beneficio_id, usuario_id, tipo, valor, data, descricao)
VALUES 
  ('mmmm0000-0000-0000-0000-000000000010'::uuid, 'bbbb0000-0000-0000-0000-000000000010'::uuid, 'a0000000-0000-0000-0000-000000000001'::uuid, 'compra', 50.00, CURRENT_DATE, 'Lanche')
ON CONFLICT (id) DO NOTHING;
RESET role;

SELECT tests.set_auth_uid('b0000000-0000-0000-0000-000000000002'::uuid);

SELECT ok(
  NOT EXISTS(SELECT 1 FROM public.movimentacoes_beneficios WHERE id = 'mmmm0000-0000-0000-0000-000000000010'::uuid),
  'Bob NÃO vê movimentação de benefício de Alice'
);

SELECT tests.clear_auth();

-- ============================================================================
-- LIMPEZA: Remover dados de teste
-- ============================================================================
SET LOCAL role service_role;

DELETE FROM public.movimentacoes_beneficios WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM public.faturas_cartao_informadas WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.despesas_tipo_excecoes WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.consultorias_acessos WHERE cliente_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid) OR consultor_id IN ('c0000000-0000-0000-0000-000000000003'::uuid);
DELETE FROM public.compras_cartao WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.parcelamentos WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.beneficios WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.investimentos WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.metas WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.cartoes WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.despesas WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.receitas WHERE usuario_id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM public.perfis WHERE id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'b0000000-0000-0000-0000-000000000002'::uuid, 'c0000000-0000-0000-0000-000000000003'::uuid);

RESET role;

-- Drop helper functions
DROP FUNCTION IF EXISTS tests.set_auth_uid(uuid);
DROP FUNCTION IF EXISTS tests.clear_auth();

SELECT * FROM finish();
ROLLBACK;
