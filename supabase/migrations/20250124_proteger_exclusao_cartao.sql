-- ============================================================
-- MIGRATION: PROTEGER EXCLUSÃO DE CARTÃO COM HISTÓRICO
-- ============================================================
-- Bug #8 REVISADO: Preservar histórico financeiro
-- Data: 24/01/2025
-- Prioridade: SEGURANÇA DOS DADOS
-- ============================================================

-- DECISÃO DE DESIGN:
-- NÃO aplicar CASCADE DELETE automático.
-- Motivo: Preservar histórico financeiro crítico.
-- 
-- SOLUÇÃO:
-- 1. Bloquear exclusão via aplicação (useCartoes.js - já implementado)
-- 2. Manter RESTRICT no banco (comportamento padrão)
-- 3. Sugerir desativação/arquivamento em vez de exclusão

-- ============================================================
-- 1. VERIFICAR CONSTRAINT ATUAL
-- ============================================================

SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'compras_cartao'
  AND kcu.column_name = 'cartao_id';

-- Resultado esperado: delete_rule = 'NO ACTION' ou 'RESTRICT'
-- Significa: banco já protege exclusão de cartão com compras

-- ============================================================
-- 2. GARANTIR RESTRICT (se não estiver configurado)
-- ============================================================

-- Remove CASCADE se alguém aplicou por engano
ALTER TABLE compras_cartao
DROP CONSTRAINT IF EXISTS compras_cartao_cartao_id_fkey CASCADE;

-- Recria com RESTRICT (bloqueio de exclusão)
ALTER TABLE compras_cartao
ADD CONSTRAINT compras_cartao_cartao_id_fkey
  FOREIGN KEY (cartao_id)
  REFERENCES cartoes(id)
  ON DELETE RESTRICT;

-- Mesmo para parcelamentos vinculados
ALTER TABLE parcelamentos
DROP CONSTRAINT IF EXISTS parcelamentos_cartao_id_fkey CASCADE;

ALTER TABLE parcelamentos
ADD CONSTRAINT parcelamentos_cartao_id_fkey
  FOREIGN KEY (cartao_id)
  REFERENCES cartoes(id)
  ON DELETE RESTRICT;

-- E faturas informadas
ALTER TABLE faturas_cartao
DROP CONSTRAINT IF EXISTS faturas_cartao_cartao_id_fkey CASCADE;

ALTER TABLE faturas_cartao
ADD CONSTRAINT faturas_cartao_cartao_id_fkey
  FOREIGN KEY (cartao_id)
  REFERENCES cartoes(id)
  ON DELETE RESTRICT;

-- ============================================================
-- 3. ADICIONAR COLUNA "ATIVO" (OPCIONAL - FUTURO)
-- ============================================================

-- DESCOMENTE PARA IMPLEMENTAR DESATIVAÇÃO:
/*
ALTER TABLE cartoes
ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

COMMENT ON COLUMN cartoes.ativo IS 
  'Cartão ativo (true) ou arquivado (false). Cartões inativos não aparecem ' ||
  'em novas compras mas preservam histórico.';

-- Index para filtrar cartões ativos
CREATE INDEX IF NOT EXISTS idx_cartoes_ativo 
  ON cartoes(usuario_id, ativo) WHERE ativo = true;
*/

-- ============================================================
-- 4. VALIDAÇÃO
-- ============================================================

-- Verificar que RESTRICT está ativo
SELECT
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN ('compras_cartao', 'parcelamentos', 'faturas_cartao')
  AND EXISTS (
    SELECT 1 FROM information_schema.key_column_usage kcu
    WHERE kcu.constraint_name = tc.constraint_name
      AND kcu.column_name = 'cartao_id'
  );

-- Resultado esperado: 3 constraints com delete_rule = 'RESTRICT'

-- ============================================================
-- 5. TESTE (EXECUTAR EM DEV)
-- ============================================================

-- Criar cartão de teste
/*
INSERT INTO cartoes (nome, dia_fechamento, dia_vencimento, usuario_id)
VALUES ('Teste Protegido', 20, 28, 'SEU_USER_ID')
RETURNING id;
*/

-- Criar compra vinculada
/*
INSERT INTO compras_cartao (cartao_id, descricao, valor_total, numero_parcelas, data_compra, usuario_id)
VALUES ('ID_DO_CARTAO', 'Compra teste', 100, 1, '2025-01-24', 'SEU_USER_ID');
*/

-- Tentar deletar cartão (deve FALHAR com erro de constraint)
/*
DELETE FROM cartoes WHERE id = 'ID_DO_CARTAO';
-- Esperado: ERROR: update or delete on table "cartoes" violates foreign key constraint
*/

-- Limpar teste
/*
DELETE FROM compras_cartao WHERE cartao_id = 'ID_DO_CARTAO';
DELETE FROM cartoes WHERE id = 'ID_DO_CARTAO';
*/

-- ============================================================
-- ✅ MIGRATION CONCLUÍDA
-- ============================================================

-- IMPORTANTE:
-- Esta migration PROTEGE dados em vez de deletá-los.
-- Comportamento da aplicação (useCartoes.js):
--   - Verifica se cartão tem compras antes de deletar
--   - Bloqueia exclusão se houver histórico
--   - Sugere desativação/arquivamento
-- 
-- Comportamento do banco (RESTRICT):
--   - Bloqueia DELETE se houver FK vinculadas
--   - Usuário deve limpar dependências manualmente
--   - Preserva integridade referencial

-- LOG:
-- [ ] Executado em DEV (gxfcfpdwyjqcrfssxgbi)
-- [ ] Testado tentativa de exclusão com compras (deve FALHAR)
-- [ ] Testado exclusão de cartão vazio (deve FUNCIONAR)
-- [ ] Executado em PROD (ievccupeijzuzhomphwn)
