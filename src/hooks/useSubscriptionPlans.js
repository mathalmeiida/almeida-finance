import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useSubscriptionPlans() {
  const [planos, setPlanos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    carregarPlanos();
  }, []);

  const carregarPlanos = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('ativo', true)
        .order('preco_mensal', { ascending: true });

      if (error) throw error;

      setPlanos(data || []);
    } catch (err) {
      console.error('Erro ao carregar planos:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const obterPlano = (planoId) => {
    return planos.find(p => p.id === planoId);
  };

  const verificarRecurso = (planoId, recurso) => {
    const plano = obterPlano(planoId);
    if (!plano) return false;

    switch (recurso) {
      case 'familia':
        return plano.familia_grupos;
      case 'whatsapp':
        return plano.whatsapp_msgs_mes > 0;
      case 'consultoria':
        return plano.consultoria_acesso;
      default:
        return false;
    }
  };

  const limiteWhatsApp = (planoId) => {
    const plano = obterPlano(planoId);
    return plano?.whatsapp_msgs_mes || 0;
  };

  const formatarPreco = (valor) => {
    if (valor === 0) return 'Grátis';
    return `R$ ${(valor / 100).toFixed(2).replace('.', ',')}`;
  };

  return {
    planos,
    carregando,
    erro,
    obterPlano,
    verificarRecurso,
    limiteWhatsApp,
    formatarPreco,
    recarregar: carregarPlanos
  };
}

/**
 * Hook para gerenciar assinatura do usuário atual
 */
export function useUserSubscription(userId) {
  const [assinatura, setAssinatura] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (userId) {
      carregarAssinatura();
    }
  }, [userId]);

  const carregarAssinatura = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data: perfil, error } = await supabase
        .from('perfis')
        .select(`
          subscription_plan,
          subscription_plans (
            id,
            nome,
            preco_mensal,
            familia_grupos,
            whatsapp_msgs_mes,
            consultoria_acesso
          )
        `)
        .eq('id', userId)
        .single();

      if (error) throw error;

      setAssinatura(perfil);
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const alterarPlano = async () => { throw new Error('Contratação ainda não habilitada. A assinatura será validada pelo servidor.') }
  const cancelarAssinatura = async () => { throw new Error('Gerenciamento de assinatura ainda não habilitado. Entre em contato com o suporte.') }

  const temRecurso = (recurso) => {
    if (!assinatura?.subscription_plans) return false;

    switch (recurso) {
      case 'familia':
        return assinatura.subscription_plans.familia_grupos;
      case 'whatsapp':
        return assinatura.subscription_plans.whatsapp_msgs_mes > 0;
      case 'consultoria':
        return assinatura.subscription_plans.consultoria_acesso;
      default:
        return false;
    }
  };

  const planoAtual = assinatura?.subscription_plans;

  return {
    assinatura,
    planoAtual,
    carregando,
    erro,
    alterarPlano,
    cancelarAssinatura,
    temRecurso,
    recarregar: carregarAssinatura
  };
}
