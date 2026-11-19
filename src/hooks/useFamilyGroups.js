import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFamilyGroups(userId) {
  const [grupos, setGrupos] = useState([]);
  const [carregando, setCarregando] = useState(!!userId);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!userId) {
      setGrupos([]);
      setCarregando(false);
      setErro(null);
      return;
    }
    carregarGrupos();
  }, [userId]);

  const carregarGrupos = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_members')
        .select(`
          papel,
          family_groups (
            id,
            nome,
            descricao,
            criado_em,
            ativo
          )
        `)
        .eq('user_id', userId)
        .eq('ativo', true);

      if (error) throw error;

      const gruposFormatados = data
        .filter(m => m.family_groups && m.family_groups.ativo)
        .map(m => ({
          ...m.family_groups,
          papel: m.papel
        }));

      setGrupos(gruposFormatados);
    } catch (err) {
      console.error('Erro ao carregar grupos:', err);
      setErro(err.message);
      // Em caso de erro (tabela não existe), retorna array vazio
      setGrupos([]);
    } finally {
      setCarregando(false);
    }
  };

  const criarGrupo = async (nome, descricao = null) => {
    try {
      setCarregando(true);
      setErro(null);

      // Criar grupo
      const { data: grupo, error: grupoError } = await supabase
        .from('family_groups')
        .insert([{ nome, descricao }])
        .select()
        .single();

      if (grupoError) throw grupoError;

      // Adicionar criador como admin
      const { error: membroError } = await supabase
        .from('family_members')
        .insert([{
          group_id: grupo.id,
          user_id: userId,
          papel: 'admin'
        }]);

      if (membroError) throw membroError;

      await carregarGrupos();
      return grupo;
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const atualizarGrupo = async (groupId, dados) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_groups')
        .update(dados)
        .eq('id', groupId);

      if (error) throw error;

      await carregarGrupos();
    } catch (err) {
      console.error('Erro ao atualizar grupo:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const desativarGrupo = async (groupId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_groups')
        .update({ ativo: false })
        .eq('id', groupId);

      if (error) throw error;

      await carregarGrupos();
    } catch (err) {
      console.error('Erro ao desativar grupo:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const sairDoGrupo = async (groupId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_members')
        .update({ ativo: false })
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      await carregarGrupos();
    } catch (err) {
      console.error('Erro ao sair do grupo:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  return {
    grupos,
    carregando,
    erro,
    criarGrupo,
    atualizarGrupo,
    desativarGrupo,
    sairDoGrupo,
    recarregar: carregarGrupos
  };
}
