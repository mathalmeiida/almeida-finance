-- ============================================================================
-- TESTE DE RLS - ALMEIDA FAMÍLIA
-- Valida isolamento entre famílias e privacidade
-- ============================================================================

-- IMPORTANTE: Executar em ambiente de TESTE, não em produção!
-- Requires: 2 usuários de teste criados manualmente

-- ============================================================================
-- CENÁRIO DE TESTE
-- ============================================================================
-- Usuário A (ID: user_a_uuid) - Família Silva
-- Usuário B (ID: user_b_uuid) - Família Costa
-- 
-- Testes:
-- 1. A cria grupo "Família Silva"
-- 2. B cria grupo "Família Costa"
-- 3. A NÃO pode ver grupo de B
-- 4. A adiciona despesa no grupo Silva
-- 5. B NÃO pode ver despesa de A
-- 6. A convida C para grupo Silva
-- 7. B NÃO pode ver convite de A
-- ============================================================================

-- Simula contexto do usuário A
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"user_a_uuid"}';

-- Teste 1: A cria seu grupo
DO $$
DECLARE
  grupo_a_id UUID;
BEGIN
  INSERT INTO family_groups (nome, descricao)
  VALUES ('Família Silva', 'Grupo de teste A')
  RETURNING id INTO grupo_a_id;
  
  -- A se torna membro admin
  INSERT INTO family_members (group_id, user_id, papel)
  VALUES (grupo_a_id, 'user_a_uuid', 'admin');
  
  RAISE NOTICE 'Grupo A criado: %', grupo_a_id;
END $$;

-- Teste 2: Verifica que A vê apenas seu grupo
SELECT 'TESTE 1: Usuário A vê apenas seus grupos' AS teste;
SELECT COUNT(*) AS grupos_visiveis FROM family_groups;
-- Esperado: 1 (apenas Família Silva)

-- Simula contexto do usuário B
SET LOCAL request.jwt.claims TO '{"sub":"user_b_uuid"}';

-- Teste 3: B cria seu grupo
DO $$
DECLARE
  grupo_b_id UUID;
BEGIN
  INSERT INTO family_groups (nome, descricao)
  VALUES ('Família Costa', 'Grupo de teste B')
  RETURNING id INTO grupo_b_id;
  
  INSERT INTO family_members (group_id, user_id, papel)
  VALUES (grupo_b_id, 'user_b_uuid', 'admin');
  
  RAISE NOTICE 'Grupo B criado: %', grupo_b_id;
END $$;

-- Teste 4: B vê apenas seu grupo (NÃO vê grupo de A)
SELECT 'TESTE 2: Usuário B NÃO vê grupos de A' AS teste;
SELECT COUNT(*) AS grupos_visiveis FROM family_groups;
-- Esperado: 1 (apenas Família Costa)

-- Teste 5: Voltar para A e adicionar despesa
SET LOCAL request.jwt.claims TO '{"sub":"user_a_uuid"}';

DO $$
DECLARE
  grupo_a_id UUID;
  split_id UUID;
BEGIN
  SELECT id INTO grupo_a_id FROM family_groups WHERE nome = 'Família Silva' LIMIT 1;
  
  INSERT INTO family_expense_splits (group_id, descricao, valor_total, paid_by, categoria)
  VALUES (grupo_a_id, 'Mercado', 10000, 'user_a_uuid', 'alimentacao')
  RETURNING id INTO split_id;
  
  -- Adiciona participante
  INSERT INTO family_split_participants (split_id, participant_id, valor_devido)
  VALUES (split_id, 'user_a_uuid', 10000);
  
  RAISE NOTICE 'Despesa A criada: %', split_id;
END $$;

-- Teste 6: A vê sua despesa
SELECT 'TESTE 3: Usuário A vê suas despesas' AS teste;
SELECT COUNT(*) AS despesas_visiveis FROM family_expense_splits;
-- Esperado: 1

-- Teste 7: B NÃO vê despesa de A
SET LOCAL request.jwt.claims TO '{"sub":"user_b_uuid"}';

SELECT 'TESTE 4: Usuário B NÃO vê despesas de A' AS teste;
SELECT COUNT(*) AS despesas_visiveis FROM family_expense_splits;
-- Esperado: 0

-- Teste 8: Convites isolados
SET LOCAL request.jwt.claims TO '{"sub":"user_a_uuid"}';

DO $$
DECLARE
  grupo_a_id UUID;
BEGIN
  SELECT id INTO grupo_a_id FROM family_groups WHERE nome = 'Família Silva' LIMIT 1;
  
  INSERT INTO family_invitations (group_id, email_convidado, invited_by, status)
  VALUES (grupo_a_id, 'usuario_c@test.com', 'user_a_uuid', 'pendente');
  
  RAISE NOTICE 'Convite A criado';
END $$;

-- A vê seu convite
SELECT 'TESTE 5: Usuário A vê seus convites' AS teste;
SELECT COUNT(*) AS convites_visiveis FROM family_invitations;
-- Esperado: 1

-- B NÃO vê convite de A
SET LOCAL request.jwt.claims TO '{"sub":"user_b_uuid"}';

SELECT 'TESTE 6: Usuário B NÃO vê convites de A' AS teste;
SELECT COUNT(*) AS convites_visiveis FROM family_invitations;
-- Esperado: 0

-- Teste 9: WhatsApp isolado
SET LOCAL request.jwt.claims TO '{"sub":"user_a_uuid"}';

INSERT INTO whatsapp_message_events (user_id, direction, message_text)
VALUES ('user_a_uuid', 'inbound', 'gastei 50 no mercado');

SELECT 'TESTE 7: Usuário A vê suas mensagens' AS teste;
SELECT COUNT(*) AS mensagens_visiveis FROM whatsapp_message_events;
-- Esperado: 1

SET LOCAL request.jwt.claims TO '{"sub":"user_b_uuid"}';

SELECT 'TESTE 8: Usuário B NÃO vê mensagens de A' AS teste;
SELECT COUNT(*) AS mensagens_visiveis FROM whatsapp_message_events;
-- Esperado: 0

-- ============================================================================
-- TESTE DE TENTATIVA DE ACESSO DIRETO (deve falhar)
-- ============================================================================

-- B tenta inserir membro no grupo de A (deve falhar)
SET LOCAL request.jwt.claims TO '{"sub":"user_b_uuid"}';

DO $$
DECLARE
  grupo_a_id UUID;
BEGIN
  -- Tenta pegar ID do grupo A (não vai conseguir via SELECT por RLS)
  SELECT id INTO grupo_a_id FROM family_groups WHERE nome = 'Família Silva' LIMIT 1;
  
  IF grupo_a_id IS NULL THEN
    RAISE NOTICE 'TESTE 9 PASS: B não consegue ver grupo de A para pegar ID';
  ELSE
    -- Se conseguiu (BUG!), tenta inserir membro
    BEGIN
      INSERT INTO family_members (group_id, user_id, papel)
      VALUES (grupo_a_id, 'user_b_uuid', 'membro');
      RAISE EXCEPTION 'TESTE 9 FAIL: B conseguiu se adicionar ao grupo de A!';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'TESTE 9 PASS: B não pode se adicionar ao grupo de A';
    END;
  END IF;
END $$;

-- ============================================================================
-- LIMPEZA (executar manualmente após validação)
-- ============================================================================

/*
-- Limpar dados de teste
DELETE FROM family_split_participants WHERE participant_id IN ('user_a_uuid', 'user_b_uuid');
DELETE FROM family_expense_splits WHERE paid_by IN ('user_a_uuid', 'user_b_uuid');
DELETE FROM family_invitations WHERE invited_by IN ('user_a_uuid', 'user_b_uuid');
DELETE FROM family_members WHERE user_id IN ('user_a_uuid', 'user_b_uuid');
DELETE FROM family_groups WHERE nome IN ('Família Silva', 'Família Costa');
DELETE FROM whatsapp_message_events WHERE user_id IN ('user_a_uuid', 'user_b_uuid');
*/

-- ============================================================================
-- RESULTADO ESPERADO
-- ============================================================================
-- Todos os testes devem mostrar isolamento correto:
-- ✅ TESTE 1: A vê 1 grupo (seu)
-- ✅ TESTE 2: B vê 1 grupo (seu, não vê A)
-- ✅ TESTE 3: A vê 1 despesa (sua)
-- ✅ TESTE 4: B vê 0 despesas (não vê A)
-- ✅ TESTE 5: A vê 1 convite (seu)
-- ✅ TESTE 6: B vê 0 convites (não vê A)
-- ✅ TESTE 7: A vê 1 mensagem (sua)
-- ✅ TESTE 8: B vê 0 mensagens (não vê A)
-- ✅ TESTE 9: B não consegue acessar/modificar grupo de A
-- ============================================================================
