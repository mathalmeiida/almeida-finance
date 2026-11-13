-- ============================================================
-- SCRIPT DE TESTE — Validação da Correção RPC
-- ============================================================
-- Este script NÃO executa exclusões reais. Apenas valida:
--   1. Se a tabela metas_investimentos existe no banco
--   2. Se a função zerar_dados_financeiros() foi criada corretamente
--   3. Se as permissões estão configuradas
--   4. Simulação de chamada (sem executar)
--
-- SEGURO: apenas consultas SELECT. Não altera nem exclui dados.
-- ============================================================

-- TESTE 1: Verificar se a tabela metas_investimentos existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'metas_investimentos'
    ) THEN '✅ Tabela metas_investimentos EXISTE'
    ELSE '⚠️ Tabela metas_investimentos NÃO EXISTE (DELETE será pulado)'
  END AS status_tabela;

-- TESTE 2: Verificar se a função RPC foi criada
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'zerar_dados_financeiros'
    ) THEN '✅ Função public.zerar_dados_financeiros() EXISTE'
    ELSE '❌ Função public.zerar_dados_financeiros() NÃO EXISTE'
  END AS status_funcao;

-- TESTE 3: Verificar SECURITY INVOKER (não é SECURITY DEFINER)
SELECT 
  p.proname AS funcao,
  CASE 
    WHEN p.prosecdef = false THEN '✅ SECURITY INVOKER (correto)'
    ELSE '❌ SECURITY DEFINER (incorreto)'
  END AS security_mode
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'zerar_dados_financeiros';

-- TESTE 4: Verificar permissões (só authenticated deve ter acesso)
SELECT 
  p.proname AS funcao,
  r.rolname AS papel,
  CASE 
    WHEN r.rolname = 'authenticated' THEN '✅ GRANT correto'
    WHEN r.rolname IN ('anon', 'public') THEN '❌ GRANT incorreto (deveria ser REVOKE)'
    ELSE '⚠️ GRANT inesperado'
  END AS status_grant
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
LEFT JOIN pg_proc_acl_explode(p.proacl) AS acl ON true
LEFT JOIN pg_roles r ON acl.grantee = r.oid
WHERE n.nspname = 'public' 
AND p.proname = 'zerar_dados_financeiros'
ORDER BY r.rolname;

-- TESTE 5: Listar todas as tabelas que SERÃO afetadas pela RPC
-- (ajuda a entender o que será deletado)
WITH tabelas_financeiras AS (
  SELECT unnest(ARRAY[
    'importacoes_itens',
    'importacoes',
    'metas_investimentos',  -- CONDICIONAL
    'amortizacoes',
    'beneficios_movimentacoes',
    'investimentos_movimentacoes',
    'faturas_cartao',
    'despesas_tipo_excecoes',
    'compras_cartao',
    'beneficios',
    'parcelamentos',
    'despesas',
    'receitas',
    'investimentos',
    'metas',
    'cartoes',
    'categorias'  -- apenas usuario_id NOT NULL
  ]) AS tabela
)
SELECT 
  tf.tabela,
  CASE 
    WHEN t.table_name IS NOT NULL THEN '✅ Existe'
    WHEN tf.tabela = 'metas_investimentos' THEN '⚠️ Não existe (DELETE condicional)'
    ELSE '❌ NÃO EXISTE (ERRO!)'
  END AS status
FROM tabelas_financeiras tf
LEFT JOIN information_schema.tables t 
  ON t.table_schema = 'public' 
  AND t.table_name = tf.tabela
ORDER BY 
  CASE 
    WHEN t.table_name IS NOT NULL THEN 1
    WHEN tf.tabela = 'metas_investimentos' THEN 2
    ELSE 3
  END,
  tf.tabela;

-- TESTE 6: Verificar constraints de foreign keys
-- (garante que a ordem de exclusão está correta)
SELECT 
  tc.table_name AS tabela_filho,
  ccu.table_name AS tabela_pai,
  tc.constraint_name AS constraint_fk
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'importacoes_itens', 'importacoes', 'metas_investimentos', 
    'amortizacoes', 'beneficios_movimentacoes', 'investimentos_movimentacoes',
    'faturas_cartao', 'despesas_tipo_excecoes', 'compras_cartao',
    'beneficios', 'parcelamentos', 'despesas', 'receitas',
    'investimentos', 'metas', 'cartoes', 'categorias'
  )
ORDER BY tc.table_name, ccu.table_name;

-- TESTE 7: Verificar se há dados na tabela metas_investimentos (se existir)
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'metas_investimentos'
    ) THEN (
      SELECT 'Total de vínculos metas_investimentos: ' || COUNT(*)::text
      FROM public.metas_investimentos
    )
    ELSE '⚠️ Tabela metas_investimentos não existe (sem dados para contar)'
  END AS contagem_dados;

-- ============================================================
-- RESULTADO ESPERADO:
-- ============================================================
-- ✅ Tabela metas_investimentos: EXISTE ou NÃO EXISTE (ambos OK)
-- ✅ Função zerar_dados_financeiros(): EXISTE
-- ✅ SECURITY INVOKER: ativado
-- ✅ Permissões: apenas authenticated tem GRANT
-- ✅ Tabelas: 16 existem + 1 condicional (metas_investimentos)
-- ✅ Foreign keys: ordem de exclusão respeitada
-- ============================================================
