import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFamilyInvitations(userId) {
  const [convites, setConvites] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (userId) {
      carregarConvites();
    }
  }, [userId]);

  const carregarConvites = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_invitations')
        .select(`
          id,
          group_id,
          email_convidado,
          status,
          criado_em,
          family_groups (
            id,
            nome,
            descricao
          ),
          convidado_por:perfis!invited_by (
            nome_completo,
            email
          )
        `)
        .eq('email_convidado', userId)
        .eq('status', 'pendente');

      if (error) throw error;

      setConvites(data || []);
    } catch (err) {
      console.error('Erro ao carregar convites:', err);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  const criarConvite = async (groupId, emailConvidado) => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_invitations')
        .insert([{
          group_id: groupId,
          email_convidado: emailConvidado,
          invited_by: userId
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (err) {
      console.error('Erro ao criar convite:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const aceitarConvite = async (inviteId, groupId) => {
    try {
      setCarregando(true);
      setErro(null);

      // Atualizar status do convite
      const { error: updateError } = await supabase
        .from('family_invitations')
        .update({ status: 'aceito' })
        .eq('id', inviteId);

      if (updateError) throw updateError;

      // Adicionar como membro do grupo
      const { error: memberError } = await supabase
        .from('family_members')
        .insert([{
          group_id: groupId,
          user_id: userId,
          papel: 'membro'
        }]);

      if (memberError) throw memberError;

      await carregarConvites();
    } catch (err) {
      console.error('Erro ao aceitar convite:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  const recusarConvite = async (inviteId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_invitations')
        .update({ status: 'recusado' })
        .eq('id', inviteId);

      if (error) throw error;

      await carregarConvites();
    } catch (err) {
      console.error('Erro ao recusar convite:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  return {
    convites,
    carregando,
    erro,
    criarConvite,
    aceitarConvite,
    recusarConvite,
    recarregar: carregarConvites
  };
}
