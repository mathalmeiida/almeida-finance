-- ============================================================
-- MIGRAÇÃO — Almeida Finance
-- Preferência de COR DO TEMA por usuário (Aparência: Azul / Rosa / Verde / Roxo).
-- Escolhida na 1ª etapa do onboarding e alterável em Configurações → Aparência.
--
-- Execute no Supabase: SQL Editor > New query > cole TUDO > Run.
-- SEGURO e idempotente:
--   • ADD COLUMN IF NOT EXISTS (não recria/zera a existente).
--   • NÃO usa DROP, não altera dados, não mexe em RLS.
--   • Apenas identidade visual — não afeta cálculos, saldo, receitas,
--     despesas, cartões, reserva, consultoria, admin nem autenticação.
--
-- Lida/escrita pelo próprio usuário via a policy de UPDATE já existente em
-- "perfis" ("Usuário atualiza apenas o próprio perfil") — sem policy nova.
-- ------------------------------------------------------------

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS cor_tema TEXT NOT NULL DEFAULT 'azul'
    CHECK (cor_tema IN ('azul','rosa','verde','roxo'));

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
