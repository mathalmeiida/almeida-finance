-- ============================================================
-- Migration: marcador de "card Complete sua configuração dispensado"
-- ============================================================
-- Objetivo: permitir que o usuário DISPENSE o card "Complete sua configuração"
-- da Home. A preferência é persistida no perfil (não em localStorage), por
-- conta → vale em qualquer dispositivo. Quando TRUE, o card não reaparece,
-- mesmo com configuração pendente, até o usuário reabrir o fluxo em
-- Configurações ("Atualizar meus dados financeiros").
--
-- É APENAS um marcador de UI: NÃO afeta saldo, receitas, despesas, cartões,
-- benefícios, reserva, metas, projeção, limite diário, consultoria, admin nem
-- autenticação. NÃO apaga nem altera nenhum dado existente.
--
-- Seguro e idempotente (ADD COLUMN IF NOT EXISTS). O app funciona SEM esta
-- coluna: enquanto ela não existir, a dispensa vale apenas na sessão atual
-- (fallback no código). Rodar a migration habilita a dispensa persistente.
-- ------------------------------------------------------------

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS comece_por_aqui_dispensado BOOLEAN NOT NULL DEFAULT FALSE;
