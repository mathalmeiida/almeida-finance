-- ============================================================
-- Migration: 2026-11_categorias_receita_expandidas.sql
-- Adiciona novas categorias de receita ao sistema.
-- Categorias são globais (usuario_id = NULL) e aparecem para
-- todos os usuários. ON CONFLICT DO NOTHING garante idempotência.
-- COMO APLICAR: Cole no SQL Editor do Supabase e execute.
-- ============================================================

INSERT INTO public.categorias (usuario_id, nome, icone, cor, tipo) VALUES
  (NULL, '13º salário',            '🎁', '#16a34a', 'receita'),
  (NULL, 'PLR',                    '🏆', '#059669', 'receita'),
  (NULL, 'Bônus',                  '💎', '#10b981', 'receita'),
  (NULL, 'Férias',                 '🏖️', '#34d399', 'receita'),
  (NULL, 'Adiantamento salarial',  '⏩', '#22c55e', 'receita'),
  (NULL, 'Dividendos / JCP',       '📊', '#15803d', 'receita'),
  (NULL, 'Rendimentos',            '📈', '#166534', 'receita'),
  (NULL, 'Aluguel recebido',       '🏠', '#14532d', 'receita'),
  (NULL, 'Reembolso',              '↩️', '#4ade80', 'receita'),
  (NULL, 'Rescisão',               '📋', '#86efac', 'receita'),
  (NULL, 'Seguro-desemprego',      '🛡️', '#bbf7d0', 'receita'),
  (NULL, 'Presente / Doação',      '🎀', '#f9a8d4', 'receita'),
  (NULL, 'Venda de bens',          '🏷️', '#fcd34d', 'receita'),
  (NULL, 'Outras receitas',        '💵', '#d1d5db', 'receita')
ON CONFLICT DO NOTHING;
