import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFamilyGoals(groupId) {
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (groupId) {
      carregarMetas();
    }
  }, [groupId]);

  const carregarMetas = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_goals')
        .select(`
          *,
          family_goal_contributions (
            id,
            valor,
            criado_em,
            contributor:perfis!contributor_id (
              nome_completo,
              email
            )
          )
        `)
        .eq('group_id', groupId)
        .eq('ativo', true)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      // Calcular progresso de cada meta
      const metasComProgresso = (data || []).map(meta => {
        const totalContribuido = (meta.family_goal_contributions || [])
          .reduce((sum, c) => sum + c.valor, 0);
        
        const progresso = meta.valor_alvo > 0 
          ? (totalContribuido / meta.valor_alvo) * 100 
          : 0;

        return {
          ...meta,
          total_contribuido: totalContribuido,
          progresso: Math.min(progresso, 100),
          concluida: totalContribuido >= meta.valor_alvo
        };
      });

      setMetas(metasComProgresso);
    } catch (err) {
      console.error('Erro ao carregar metas:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const criarMeta = async ({ nome, descricao, valor_alvo, data_alvo }) => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_goals')
        .insert([{
          group_id: groupId,
          nome,
          descricao,
          valor_alvo: Math.round(valor_alvo * 100), // centavos
          data_alvo
        }])
        .select()
        .single();

      if (error) throw error;

      await carregarMetas();
      return data;
    } catch (err) {
      console.error('Erro ao criar meta:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const atualizarMeta = async (goalId, dados) => {
    try {
      setCarregando(true);
      setErro(null);

      // Converter valor_alvo se presente
      if (dados.valor_alvo !== undefined) {
        dados.valor_alvo = Math.round(dados.valor_alvo * 100);
      }

      const { error } = await supabase
        .from('family_goals')
        .update(dados)
        .eq('id', goalId);

      if (error) throw error;

      await carregarMetas();
    } catch (err) {
      console.error('Erro ao atualizar meta:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const desativarMeta = async (goalId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_goals')
        .update({ ativo: false })
        .eq('id', goalId);

      if (error) throw error;

      await carregarMetas();
    } catch (err) {
      console.error('Erro ao desativar meta:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const contribuir = async (goalId, valor, contributorId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_goal_contributions')
        .insert([{
          goal_id: goalId,
          contributor_id: contributorId,
          valor: Math.round(valor * 100) // centavos
        }]);

      if (error) throw error;

      await carregarMetas();
    } catch (err) {
      console.error('Erro ao registrar contribuição:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Calcula quanto falta arrecadar e divisão sugerida
   */
  const calcularDivisao = (meta, numParticipantes) => {
    const faltante = meta.valor_alvo - meta.total_contribuido;
    
    if (faltante <= 0) {
      return {
        faltante: 0,
        valorPorPessoa: 0,
        concluida: true
      };
    }

    const valorPorPessoa = Math.ceil(faltante / numParticipantes);

    return {
      faltante,
      valorPorPessoa,
      concluida: false
    };
  };

  return {
    metas,
    carregando,
    erro,
    criarMeta,
    atualizarMeta,
    desativarMeta,
    contribuir,
    calcularDivisao,
    recarregar: carregarMetas
  };
}
