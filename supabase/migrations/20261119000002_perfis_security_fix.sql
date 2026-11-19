-- ============================================================================
-- CORREÇÃO CRÍTICA DE SEGURANÇA - PERFIS
-- Previne escalonamento de privilégios
-- ============================================================================

-- PROBLEMA: Usuários comuns podem alterar papel, subscription_plan, plano_override
-- SOLUÇÃO: Restringir UPDATE de colunas sensíveis apenas para admins

-- ============================================================================
-- 1. FUNÇÃO PARA VERIFICAR MUDANÇAS DE COLUNAS SENSÍVEIS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevenir_escalacao_privilegios()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica se usuário está tentando alterar campos sensíveis
  -- e NÃO é admin
  IF NOT public.e_admin() THEN
    
    -- Previne alteração de papel
    IF OLD.papel IS DISTINCT FROM NEW.papel THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o papel do usuário.';
    END IF;
    
    -- Previne alteração de plano (exceto se for o próprio admin via override)
    IF OLD.subscription_plan IS DISTINCT FROM NEW.subscription_plan THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o plano de assinatura.';
    END IF;
    
    -- Previne alteração de override
    IF OLD.plano_override IS DISTINCT FROM NEW.plano_override THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o override de plano.';
    END IF;
    
    -- Previne alteração de ativo (desativar conta)
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
      RAISE EXCEPTION 'Apenas administradores podem ativar/desativar contas.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. APLICAR TRIGGER EM PERFIS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_prevenir_escalacao_privilegios ON public.perfis;

CREATE TRIGGER trg_prevenir_escalacao_privilegios
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.prevenir_escalacao_privilegios();

-- ============================================================================
-- 3. REFORÇAR POLÍTICA UPDATE DE PERFIS
-- ============================================================================

-- Remove política antiga sem restrição
DROP POLICY IF EXISTS "Usuário atualiza apenas o próprio perfil" ON public.perfis;

-- Cria nova com restrição explícita
CREATE POLICY "Usuário atualiza apenas o próprio perfil"
ON public.perfis FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  -- O trigger já previne alterações indevidas, mas explicitamos aqui também
);

-- ============================================================================
-- 4. GARANTIR QUE APENAS ADMIN PODE INSERIR COM PAPEL/OVERRIDE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validar_insert_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se não é admin, força valores seguros
  IF NOT public.e_admin() THEN
    NEW.papel := 'user';
    NEW.subscription_plan := 'free';
    NEW.plano_override := FALSE;
    NEW.ativo := TRUE;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_insert_perfil ON public.perfis;

CREATE TRIGGER trg_validar_insert_perfil
  BEFORE INSERT ON public.perfis
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_insert_perfil();

-- ============================================================================
-- 5. TESTAR SEGURANÇA (comentado - executar manualmente)
-- ============================================================================

/*
-- Como usuário comum, tentar escalar privilégios:
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"user_test_uuid"}';

-- Deve FALHAR:
UPDATE perfis SET papel = 'admin' WHERE id = 'user_test_uuid';
UPDATE perfis SET subscription_plan = 'plus' WHERE id = 'user_test_uuid';
UPDATE perfis SET plano_override = TRUE WHERE id = 'user_test_uuid';

-- Como admin, deve FUNCIONAR:
-- (executar com usuário real admin no Supabase)
UPDATE perfis SET subscription_plan = 'premium' WHERE id = 'user_test_uuid';
UPDATE perfis SET plano_override = TRUE WHERE id = 'user_test_uuid';
*/

-- ============================================================================
-- FIM DA CORREÇÃO DE SEGURANÇA
-- ============================================================================
