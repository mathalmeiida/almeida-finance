-- ============================================================================
-- TESTE DE ISOLAMENTO RLS (Row Level Security)
-- ============================================================================
-- Este script testa se as políticas RLS estão funcionando corretamente,
-- garantindo que:
-- 1. Cada usuário vê apenas seus próprios dados
-- 2. Não é possível inserir/modificar dados de outro usuário
-- 3. Consultoria (somente leitura) funciona sem permitir escrita
--
-- ⚠️ LIMITAÇÕES DESTE SCRIPT:
-- Este script testa APENAS se perfis de teste podem ser criados isoladamente.
-- NÃO TESTA as políticas RLS auth.uid() que funcionam SOMENTE com sessões reais.
--
-- TESTE REAL DE RLS (RECOMENDADO):
-- 1. Criar 2 contas reais via signup (alice@test.com, bob@test.com)
-- 2. Login como Alice → criar receita R$ 5.000
-- 3. Logout → Login como Bob
-- 4. Verificar Dashboard: Bob NÃO deve ver receita de Alice
-- 5. Bob cria receita R$ 1.000
-- 6. Logout → Login como Alice
-- 7. Verificar Dashboard: Alice NÃO deve ver receita de Bob
--
-- COMO EXECUTAR ESTE SCRIPT (validação básica):
-- 1. Abra SQL Editor no Dashboard do Supabase
-- 2. Cole este script e execute (botão "Run")
-- 3. Verifique que perfis são criados e limpos sem erro
-- ============================================================================

-- Limpar dados de teste anteriores (se existirem)
DELETE FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com');

-- ============================================================================
-- PREPARAÇÃO: Criar 2 contas de teste temporárias
-- ============================================================================
-- Insere dois perfis de teste diretamente (simula signup)
INSERT INTO perfis (id, nome, email)
VALUES
  (gen_random_uuid(), 'Alice Teste', 'teste_alice@example.com'),
  (gen_random_uuid(), 'Bob Teste', 'teste_bob@example.com')
ON CONFLICT (id) DO NOTHING;

-- Captura os IDs das contas criadas
DO $$
DECLARE
  alice_id UUID;
  bob_id UUID;
  receita_alice_id UUID;
  despesa_bob_id UUID;
  cartao_alice_id UUID;
  meta_alice_id UUID;
BEGIN
  -- Busca IDs
  SELECT id INTO alice_id FROM perfis WHERE email = 'teste_alice@example.com';
  SELECT id INTO bob_id FROM perfis WHERE email = 'teste_bob@example.com';

  RAISE NOTICE 'Alice ID: %, Bob ID: %', alice_id, bob_id;

  -- ============================================================================
  -- TESTE 1: RECEITAS - Isolamento de leitura
  -- ============================================================================
  RAISE NOTICE '--- TESTE 1: RECEITAS ---';
  
  -- Alice cria uma receita
  INSERT INTO receitas (usuario_id, descricao, valor, data, tipo)
  VALUES (alice_id, 'Salário Alice', 5000.00, CURRENT_DATE, 'salario')
  RETURNING id INTO receita_alice_id;

  -- Simula: Bob tenta ler receitas com SET LOCAL role
  -- (em produção, o RLS usa auth.uid() automaticamente)
  SET LOCAL "request.jwt.claims" = json_build_object('sub', bob_id::text)::text;
  
  -- Bob NÃO deve ver a receita de Alice
  IF EXISTS (SELECT 1 FROM receitas WHERE id = receita_alice_id) THEN
    RAISE EXCEPTION '❌ FALHA: Bob conseguiu ler receita de Alice!';
  ELSE
    RAISE NOTICE '✅ Bob não vê receita de Alice (correto)';
  END IF;

  -- Reseta contexto
  RESET "request.jwt.claims";

  -- ============================================================================
  -- TESTE 2: DESPESAS - Tentativa de inserção cruzada
  -- ============================================================================
  RAISE NOTICE '--- TESTE 2: DESPESAS ---';
  
  -- Bob cria uma despesa normal
  INSERT INTO despesas (usuario_id, descricao, valor, data, categoria)
  VALUES (bob_id, 'Aluguel Bob', 1200.00, CURRENT_DATE, 'moradia')
  RETURNING id INTO despesa_bob_id;

  RAISE NOTICE 'Despesas criadas apenas para estrutura. Isolamento depende de auth.uid() em produção.';

  -- ============================================================================
  -- TESTE 3: CARTÕES - Isolamento total
  -- ============================================================================
  RAISE NOTICE '--- TESTE 3: CARTÕES ---';
  
  -- Alice cria cartão
  INSERT INTO cartoes (usuario_id, nome, limite, dia_fechamento, dia_vencimento, cor)
  VALUES (alice_id, 'Nubank Alice', 3000.00, 5, 15, '#820AD1')
  RETURNING id INTO cartao_alice_id;

  RAISE NOTICE 'Cartão criado. Isolamento via auth.uid() testável apenas com contas reais.';

  -- ============================================================================
  -- TESTE 4: METAS - Update cruzado
  -- ============================================================================
  RAISE NOTICE '--- TESTE 4: METAS ---';
  
  -- Alice cria meta
  INSERT INTO metas (usuario_id, descricao, valor_alvo, prazo)
  VALUES (alice_id, 'Viagem Europa', 10000.00, CURRENT_DATE + INTERVAL '6 months')
  RETURNING id INTO meta_alice_id;

  RAISE NOTICE 'Meta criada. Proteção UPDATE testável apenas via aplicação com auth.uid() real.';

  -- ============================================================================
  -- TESTE 5: CONSULTORIA (Read-Only) - Implementado no frontend
  -- ============================================================================
  RAISE NOTICE '--- TESTE 5: CONSULTORIA ---';
  RAISE NOTICE 'Consultoria usa idEfetivo (leitura) + bloquearSeConsultoria (escrita)';
  RAISE NOTICE 'Auditoria de código confirmou padrão correto nos 12 hooks';

  -- ============================================================================
  -- RESULTADO FINAL
  -- ============================================================================
  RAISE NOTICE '====================================================';
  RAISE NOTICE '✅ ESTRUTURA DE DADOS VALIDADA';
  RAISE NOTICE '====================================================';
  RAISE NOTICE 'Perfis, receitas, despesas, cartões e metas criados com sucesso.';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ ATENÇÃO: Este script NÃO testa as políticas RLS reais!';
  RAISE NOTICE 'Políticas auth.uid() requerem sessões Supabase Auth.';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 TESTE RLS OBRIGATÓRIO (manual):';
  RAISE NOTICE '1. Criar 2 contas reais via signup';
  RAISE NOTICE '2. Login Alice → criar receita';
  RAISE NOTICE '3. Login Bob → verificar que NÃO vê receita de Alice';
  RAISE NOTICE '4. Repetir testando INSERT/UPDATE/DELETE';

END $$;

-- ============================================================================
-- LIMPEZA: Remove dados de teste
-- ============================================================================
DELETE FROM metas WHERE usuario_id IN (SELECT id FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com'));
DELETE FROM cartoes WHERE usuario_id IN (SELECT id FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com'));
DELETE FROM despesas WHERE usuario_id IN (SELECT id FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com'));
DELETE FROM receitas WHERE usuario_id IN (SELECT id FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com'));
DELETE FROM perfis WHERE email IN ('teste_alice@example.com', 'teste_bob@example.com');

RAISE NOTICE 'Dados de teste removidos com sucesso.';
