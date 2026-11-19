import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFamilyMembers(groupId) {
  const [membros, setMembros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (groupId) {
      carregarMembros();
    }
  }, [groupId]);

  const carregarMembros = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_members')
        .select(`
          id,
          papel,
          juntou_em,
          ativo,
          user:perfis!user_id (
            id,
            nome_completo,
            email,
            avatar_url,
            subscription_plan
          )
        `)
        .eq('group_id', groupId)
        .eq('ativo', true)
        .order('juntou_em', { ascending: true });

      if (error) throw error;

      setMembros(data || []);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const alterarPapel = async (memberId, novoPapel) => {
    try {
      setCarregando(true);
      setErro(null);

      if (!['admin', 'membro'].includes(novoPapel)) {
        throw new Error('Papel inválido');
      }

      const { error } = await supabase
        .from('family_members')
        .update({ papel: novoPapel })
        .eq('id', memberId);

      if (error) throw error;

      await carregarMembros();
    } catch (err) {
      console.error('Erro ao alterar papel:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const removerMembro = async (memberId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_members')
        .update({ ativo: false })
        .eq('id', memberId);

      if (error) throw error;

      await carregarMembros();
    } catch (err) {
      console.error('Erro ao remover membro:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const ehAdmin = (userId) => {
    const membro = membros.find(m => m.user?.id === userId);
    return membro?.papel === 'admin';
  };

  const temAdmin = () => {
    return membros.some(m => m.papel === 'admin');
  };

  const quantidadeAdmins = () => {
    return membros.filter(m => m.papel === 'admin').length;
  };

  return {
    membros,
    carregando,
    erro,
    alterarPapel,
    removerMembro,
    ehAdmin,
    temAdmin,
    quantidadeAdmins,
    recarregar: carregarMembros
  };
}
