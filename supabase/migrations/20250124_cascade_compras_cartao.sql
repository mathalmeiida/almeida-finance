-- ============================================================
-- MIGRATION: CASCADE DELETE - COMPRAS DE CARTÃO
-- ============================================================
-- Bug #8: Exclusão de cartão não remove compras associadas
-- Data: 24/01/2025
-- Ambiente: DEV (gxfcfpdwyjqcrfssxgbi) e PROD (ievccupeijzuzhomphwn)
-- ============================================================

-- PROBLEMA:
-- Ao deletar um cartão, as compras vinculadas ficam órfãs com
-- cartao_id inválido, causando:
--   - Dados inconsistentes no banco
--   - Falhas em queries de fatura (JOIN com id inválido)
--   - Acúmulo de lixo no banco

-- SOLUÇÃO:
-- Adicionar CASCADE DELETE na foreign key de compras_cartao
-- Quando um cartão for deletado, todas as compras vinculadas
-- serão removidas automaticamente

-- ============================================================
-- 1. VERIFICAÇÃO PRÉVIA
-- ============================================================

-- Verificar compras órfãs existentes (cartao_id aponta para cartão inexistente)
SELECT 
  cc.id,
  cc.descricao,
  cc.valor_total,
  cc.cartao_id,
  cc.usuario_id,
  cc.data_compra
FROM compras_cartao cc
LEFT JOIN cartoes c ON c.id = cc.cartao_id
WHERE c.id IS NULL;

-- Se houver compras órfãs, elas serão exibidas acima.
-- Decisão: deletar ou manter? (migration não remove automaticamente)

-- ============================================================
-- 2. LIMPEZA (OPCIONAL)
-- ============================================================

-- OPÇÃO A: Deletar todas as compras órfãs
-- DESCOMENTE SE QUISER LIMPAR:
-- DELETE FROM compras_cartao cc
-- WHERE NOT EXISTS (
--   SELECT 1 FROM cartoes c WHERE c.id = cc.cartao_id
-- );

-- OPÇÃO B: Manter compras órfãs (vincular a cartão "Desconhecido")
-- Não recomendado — melhor deletar

-- ============================================================
-- 3. ALTERAR CONSTRAINT
-- ============================================================

-- Remove a constraint antiga (se existir)
ALTER TABLE compras_cartao
DROP CONSTRAINT IF EXISTS compras_cartao_cartao_id_fkey;

-- Adiciona nova constraint com CASCADE DELETE
ALTER TABLE compras_cartao
ADD CONSTRAINT compras_cartao_cartao_id_fkey
  FOREIGN KEY (cartao_id)
  REFERENCES cartoes(id)
  ON DELETE CASCADE;

-- ============================================================
-- 4. VALIDAÇÃO
-- ============================================================

-- Verificar se a constraint foi criada corretamente
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
  AND rc.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'compras_cartao'
  AND kcu.column_name = 'cartao_id';

-- Resultado esperado:
-- constraint_name: compras_cartao_cartao_id_fkey
-- delete_rule: CASCADE

-- ============================================================
-- 5. TESTE (EXECUTAR EM DEV, NÃO EM PRODUÇÃO)
-- ============================================================

-- Criar cartão de teste
/*
INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, usuario_id)
VALUES ('Teste CASCADE', 20, 28, 'SEU_USER_ID_AQUI')
RETURNING id;
*/

-- Usar o ID retornado acima para criar compras
/*
INSERT INTO compras_cartao (cartao_id, descricao, valor_total, numero_parcelas, data_compra, usuario_id)
VALUES 
  ('ID_DO_CARTAO_TESTE', 'Compra 1', 100, 1, '2025-01-24', 'SEU_USER_ID_AQUI'),
  ('ID_DO_CARTAO_TESTE', 'Compra 2', 200, 1, '2025-01-24', 'SEU_USER_ID_AQUI');
*/

-- Verificar quantas compras existem
/*
SELECT COUNT(*) FROM compras_cartao WHERE cartao_id = 'ID_DO_CARTAO_TESTE';
-- Resultado esperado: 2
*/

-- Deletar o cartão
/*
DELETE FROM cartoes WHERE id = 'ID_DO_CARTAO_TESTE';
*/

-- Verificar se as compras foram deletadas automaticamente
/*
SELECT COUNT(*) FROM compras_cartao WHERE cartao_id = 'ID_DO_CARTAO_TESTE';
-- Resultado esperado: 0 (CASCADE funcionou)
*/

-- ============================================================
-- 6. ROLLBACK (SE NECESSÁRIO)
-- ============================================================

-- Para reverter a migration (NÃO RECOMENDADO):
/*
ALTER TABLE compras_cartao
DROP CONSTRAINT IF EXISTS compras_cartao_cartao_id_fkey;

ALTER TABLE compras_cartao
ADD CONSTRAINT compras_cartao_cartao_id_fkey
  FOREIGN KEY (cartao_id)
  REFERENCES cartoes(id)
  ON DELETE RESTRICT;  -- Comportamento anterior (bloqueia delete)
*/

-- ============================================================
-- ✅ MIGRATION CONCLUÍDA
-- ============================================================

-- IMPORTANTE:
-- 1. Executar em DEV primeiro (gxfcfpdwyjqcrfssxgbi)
-- 2. Testar exclusão de cartão
-- 3. Verificar se compras foram removidas
-- 4. Só então executar em PROD (ievccupeijzuzhomphwn)

-- LOG:
-- [ ] Executado em DEV (gxfcfpdwyjqcrfssxgbi) em ____/____/____
-- [ ] Testado e validado em DEV
-- [ ] Executado em PROD (ievccupeijzuzhomphwn) em ____/____/____
-- [ ] Validado em PROD

