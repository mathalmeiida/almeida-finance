-- ============================================================
-- Migration: subcategoria nas compras de cartão (compras_cartao)
-- ============================================================
-- Objetivo: permitir salvar a SUBCATEGORIA de uma compra no cartão, igual ao
-- que já existe em "despesas" (coluna subcategoria_id). O app passou a oferecer
-- o seletor de categoria + subcategoria também na aba Cartões; esta coluna é o
-- destino onde a subcategoria escolhida é persistida.
--
-- Pré-requisito: a tabela public.subcategorias já existe (usada por despesas).
--
-- SEGURO e idempotente (ADD COLUMN IF NOT EXISTS). NÃO altera dados existentes
-- (compras antigas ficam com subcategoria_id NULL). NÃO mexe em faturas,
-- parcelamentos, RLS, cálculos ou outras tabelas. ON DELETE SET NULL: se a
-- subcategoria for removida, a compra é preservada (apenas perde o vínculo).
-- ------------------------------------------------------------

ALTER TABLE public.compras_cartao
  ADD COLUMN IF NOT EXISTS subcategoria_id UUID
    REFERENCES public.subcategorias(id) ON DELETE SET NULL;
