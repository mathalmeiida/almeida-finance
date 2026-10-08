-- ============================================================
-- Migration: marcador de "reserva de emergência respondida"
-- ============================================================
-- Objetivo: diferenciar, no progresso do onboarding, o usuário que AINDA NÃO
-- respondeu a etapa de reserva daquele que respondeu conscientemente R$ 0,00.
--
-- Antes, o progresso usava apenas (reserva_atual > 0 OR meta_reserva > 0) para
-- considerar a etapa concluída — o que tratava "R$ 0,00 informado" como
-- "não respondido". Esta coluna resolve isso sem mexer em nenhum cálculo
-- financeiro: é APENAS um marcador de progresso de configuração.
--
-- NÃO afeta: saldo, receitas, despesas, cartões, Horizonte Financeiro,
-- projeções, Posso Comprar?, consultoria, admin ou autenticação.
--
-- Seguro de rodar mais de uma vez (IF NOT EXISTS). O app também funciona SEM
-- esta coluna (há fallback no código), mas rodar a migration habilita a
-- distinção correta entre "pulou" e "respondeu R$ 0,00".
-- ------------------------------------------------------------

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS reserva_configurada BOOLEAN NOT NULL DEFAULT FALSE;

-- Retrocompatibilidade: contas que JÁ têm algum sinal de reserva informada
-- (valor guardado ou meta definida) são consideradas como "respondidas",
-- para não exibir a etapa como pendente para quem já configurou antes.
UPDATE public.perfis
   SET reserva_configurada = TRUE
 WHERE reserva_configurada = FALSE
   AND (
        (reserva_atual IS NOT NULL AND reserva_atual > 0)
     OR (meta_reserva  IS NOT NULL AND meta_reserva  > 0)
   );
