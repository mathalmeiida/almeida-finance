-- MIGRAÇÃO — Almeida Finance
-- Pagamento das faturas informadas: colunas "pago" e "pago_em" em faturas_cartao.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO para o banco atual:
--   • NÃO altera outras tabelas.
--   • NÃO usa DROP.
--   • Idempotente: ADD COLUMN IF NOT EXISTS.
--   • Preserva RLS e policies existentes (nada é alterado aqui sobre segurança).
--
-- Por que é necessária: a tela "Ver fatura" tem os botões "Marcar como paga" e
-- "Desfazer pagamento", e o hook useFaturasCartao.marcarFaturaPaga grava nos
-- campos "pago" (boolean) e "pago_em" (date). A tabela criada em
-- 2026-10_faturas_cartao_total.sql ainda NÃO possui essas colunas; sem esta
-- migração, marcar/desfazer pagamento falha com erro de coluna inexistente.
--
-- Semântica:
--   pago     = FALSE (padrão)  → fatura informada ainda em aberto (compromisso)
--   pago     = TRUE            → fatura quitada; deixa de ser "compromisso futuro"
--   pago_em  = data (America/Sao_Paulo) em que foi marcada como paga; NULL ao desfazer
--
-- Observação de cálculo: marcar como paga NÃO cria despesa nem reduz o saldo
-- manual do usuário. Apenas remove a fatura dos "compromissos a vencer" na
-- previsão de fim do mês (ver src/hooks/useProjecao.js → faturasAVencer).
-- ============================================================

ALTER TABLE public.faturas_cartao
  ADD COLUMN IF NOT EXISTS pago     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pago_em  DATE DEFAULT NULL;
