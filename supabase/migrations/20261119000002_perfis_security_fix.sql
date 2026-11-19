-- ============================================================================
-- SEGURANÇA ADICIONAL - PERFIS (CAMADA EXTRA)
-- Triggers de validação para campos administrativos
-- ============================================================================

-- NOTA: PostgreSQL já protege via GRANT por coluna (não há GRANT UPDATE para
-- papel, subscription_plan, plano_override em authenticated).
-- Esta migration adiciona camada EXTRA de validação via trigger.

-- DEPENDÊNCIA: Requer 20261119000001_familia_whatsapp_base.sql aplicada primeiro
-- (cria colunas subscription_plan e plano_override)

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
    
    -- Previne alteração de plano
    IF OLD.subscription_plan IS DISTINCT FROM NEW.subscription_plan THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o plano de assinatura.';
    END IF;
    
    -- Previne alteração de override
    IF OLD.plano_override IS DISTINCT FROM NEW.plano_override THEN
      RAISE EXCEPTION 'Apenas administradores podem alterar o override de plano.';
    END IF;
    
    -- Previne alteração de ativo
    IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
      RAISE EXCEPTION 'Apenas administradores podem ativar/desativar contas.';
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$;
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
-- 3. GARANTIR QUE APENAS ADMIN PODE INSERIR COM PAPEL/OVERRIDE
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
    NEW.subscription_plan := COALESCE(NEW.subscription_plan, 'free');
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
-- FIM DA CAMADA EXTRA DE SEGURANÇA
-- ============================================================================
