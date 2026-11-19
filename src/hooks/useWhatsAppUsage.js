import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useWhatsAppUsage(userId) {
  const [uso, setUso] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (userId) {
      carregarUso();
    }
  }, [userId]);

  const carregarUso = async () => {
    try {
      setCarregando(true);
      setErro(null);

      // Buscar uso do mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('whatsapp_usage')
        .select('*')
        .eq('user_id', userId)
        .gte('mes_referencia', inicioMes.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      setUso(data || {
        user_id: userId,
        mes_referencia: inicioMes.toISOString(),
        mensagens_enviadas: 0,
        mensagens_recebidas: 0,
        total_mensagens: 0
      });
    } catch (err) {
      console.error('Erro ao carregar uso WhatsApp:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const calcularLimite = (plano) => {
    if (!plano) return 0;
    return plano.whatsapp_msgs_mes || 0;
  };

  const calcularProgresso = (plano) => {
    const limite = calcularLimite(plano);
    if (limite === 0) return 0;
    
    const usado = uso?.total_mensagens || 0;
    return Math.min((usado / limite) * 100, 100);
  };

  const podeEnviar = (plano) => {
    const limite = calcularLimite(plano);
    if (limite === 0) return false;
    
    const usado = uso?.total_mensagens || 0;
    return usado < limite;
  };

  const mensagensRestantes = (plano) => {
    const limite = calcularLimite(plano);
    const usado = uso?.total_mensagens || 0;
    return Math.max(limite - usado, 0);
  };

  return {
    uso,
    carregando,
    erro,
    calcularLimite,
    calcularProgresso,
    podeEnviar,
    mensagensRestantes,
    recarregar: carregarUso
  };
}

/**
 * Hook para gerenciar conexão do WhatsApp
 */
export function useWhatsAppConnection(userId) {
  const [conexao, setConexao] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (userId) {
      carregarConexao();
    }
  }, [userId]);

  const carregarConexao = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;

      setConexao(data);
    } catch (err) {
      console.error('Erro ao carregar conexão WhatsApp:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const conectar = async (telefone) => {
    try {
      setCarregando(true);
      setErro(null);

      // Desativar conexões anteriores
      await supabase
        .from('whatsapp_connections')
        .update({ ativo: false })
        .eq('user_id', userId);

      // Criar nova conexão (em dev, sem credenciais reais)
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .insert([{
          user_id: userId,
          phone_number: telefone,
          status: 'pendente' // 'conectado' quando integrar API real
        }])
        .select()
        .single();

      if (error) throw error;

      await carregarConexao();
      return data;
    } catch (err) {
      console.error('Erro ao conectar WhatsApp:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const desconectar = async () => {
    try {
      setCarregando(true);
      setErro(null);

      if (!conexao) return;

      const { error } = await supabase
        .from('whatsapp_connections')
        .update({ 
          ativo: false,
          status: 'desconectado'
        })
        .eq('id', conexao.id);

      if (error) throw error;

      await carregarConexao();
    } catch (err) {
      console.error('Erro ao desconectar WhatsApp:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const estaConectado = () => {
    return conexao?.status === 'conectado';
  };

  return {
    conexao,
    carregando,
    erro,
    conectar,
    desconectar,
    estaConectado,
    recarregar: carregarConexao
  };
}
