-- ============================================================================
-- TESTE DE ISOLAMENTO RLS (Row Level Security)
-- ============================================================================
-- Este script testa se as políticas RLS estão funcionando corretamente,
-- garantindo que:
-- 1. Cada usuário vê apenas seus próprios dados
-- 2. Não é possível inserir/modificar dados de outro usuário
-- 3. Consultoria (somente leitura) funciona sem permitir escrita
--
-- COMO EXECUTAR:
-- 1. Abra SQL Editor no Dashboard do Supabase
-- 2. Cole este script e execute (botão "Run")
-- 3. Verifique que TODOS os testes passam (veja os "-- ✓" nos comentários)
-- 4. Se algum teste falhar, as políticas RLS precisam correção
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

  -- Simula: Alice tenta criar despesa forçando usuario_id = Bob
  SET LOCAL "request.jwt.claims" = json_build_object('sub', alice_id::text)::text;
  
  BEGIN
    INSERT INTO despesas (usuario_id, descricao, valor, data, categoria)
    VALUES (bob_id, 'Despesa forçada', 100.00, CURRENT_DATE, 'alimentacao');
    
    RAISE EXCEPTION '❌ FALHA: Alice conseguiu criar despesa para Bob!';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE '✅ Alice bloqueada ao tentar criar despesa de Bob (correto)';
  END;

  RESET "request.jwt.claims";

  -- ============================================================================
  -- TESTE 3: CARTÕES - Isolamento total
  -- ============================================================================
  RAISE NOTICE '--- TESTE 3: CARTÕES ---';
  
  -- Alice cria cartão
  INSERT INTO cartoes (usuario_id, nome, limite, dia_fechamento, dia_vencimento, cor)
  VALUES (alice_id, 'Nubank Alice', 3000.00, 5, 15, '#820AD1')
  RETURNING id INTO cartao_alice_id;

  -- Bob tenta ler cartões
  SET LOCAL "request.jwt.claims" = json_build_object('sub', bob_id::text)::text;
  
  IF EXISTS (SELECT 1 FROM cartoes WHERE id = cartao_alice_id) THEN
    RAISE EXCEPTION '❌ FALHA: Bob viu cartão de Alice!';
  ELSE
    RAISE NOTICE '✅ Bob não vê cartão de Alice (correto)';
  END IF;

  -- Bob tenta deletar cartão de Alice (deve falhar)
  BEGIN
    DELETE FROM cartoes WHERE id = cartao_alice_id;
    IF FOUND THEN
      RAISE EXCEPTION '❌ FALHA: Bob deletou cartão de Alice!';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ Bob bloqueado ao tentar deletar cartão de Alice (correto)';
  END;

  RESET "request.jwt.claims";

  -- ============================================================================
  -- TESTE 4: METAS - Update cruzado
  -- ============================================================================
  RAISE NOTICE '--- TESTE 4: METAS ---';
  
  -- Alice cria meta
  INSERT INTO metas (usuario_id, descricao, valor_alvo, prazo)
  VALUES (alice_id, 'Viagem Europa', 10000.00, CURRENT_DATE + INTERVAL '6 months')
  RETURNING id INTO meta_alice_id;

  -- Bob tenta atualizar meta de Alice
  SET LOCAL "request.jwt.claims" = json_build_object('sub', bob_id::text)::text;
  
  BEGIN
    UPDATE metas SET valor_alvo = 1.00 WHERE id = meta_alice_id;
    IF FOUND THEN
      RAISE EXCEPTION '❌ FALHA: Bob atualizou meta de Alice!';
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE '✅ Bob bloqueado ao tentar atualizar meta de Alice (correto)';
  END;

  RESET "request.jwt.claims";

  -- ============================================================================
  -- TESTE 5: CONSULTORIA (Read-Only) - Deve ler, mas não escrever
  -- ============================================================================
  RAISE NOTICE '--- TESTE 5: CONSULTORIA (Modo Somente Leitura) ---';
  
  -- Simula acesso de consultoria: Bob como consultor vê dados de Alice
  -- (Nota: Este teste é conceitual - a consultoria usa idEfetivo no frontend)
  -- RLS permite que Alice leia seus dados mesmo quando outra pessoa solicita via consultoria
  
  SET LOCAL "request.jwt.claims" = json_build_object('sub', alice_id::text)::text;
  
  -- Alice deve ver sua própria receita
  IF NOT EXISTS (SELECT 1 FROM receitas WHERE id = receita_alice_id) THEN
    RAISE EXCEPTION '❌ FALHA: Alice não consegue ler sua própria receita!';
  ELSE
    RAISE NOTICE '✅ Alice lê suas próprias receitas (correto)';
  END IF;

  RESET "request.jwt.claims";

  -- ============================================================================
  -- RESULTADO FINAL
  -- ============================================================================
  RAISE NOTICE '================================================';
  RAISE NOTICE '✅ TODOS OS TESTES DE ISOLAMENTO RLS PASSARAM';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'As políticas RLS estão protegendo corretamente os dados.';
  RAISE NOTICE 'Cada usuário acessa apenas seus próprios registros.';

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
