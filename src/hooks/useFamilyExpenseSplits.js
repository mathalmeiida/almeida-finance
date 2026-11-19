import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useFamilyExpenseSplits(groupId) {
  const [divisoes, setDivisoes] = useState([]);
  const [carregando, setCarregando] = useState(!!groupId);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setDivisoes([]);
      setCarregando(false);
      setErro(null);
      return;
    }
    carregarDivisoes();
  }, [groupId]);

  const carregarDivisoes = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const { data, error } = await supabase
        .from('family_expense_splits')
        .select(`
          *,
          pago_por:perfis!paid_by (
            nome_completo,
            email
          ),
          family_split_participants (
            id,
            valor_devido,
            pago,
            pago_em,
            participant:perfis!participant_id (
              id,
              nome_completo,
              email
            )
          )
        `)
        .eq('group_id', groupId)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      setDivisoes(data || []);
    } catch (err) {
      console.error('Erro ao carregar divisões:', err);
      setErro(err.message);
      // Em caso de erro (tabela não existe), retorna array vazio
      setDivisoes([]);
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Cria divisão de despesa
   * @param {object} params
   * @param {string} params.descricao - Descrição da despesa
   * @param {number} params.valor_total - Valor total em centavos
   * @param {string} params.paid_by - ID do usuário que pagou
   * @param {string} params.categoria - Categoria da despesa
   * @param {Array} params.participantes - Array de {user_id, valor_devido} em centavos
   */
  const criarDivisao = async ({ descricao, valor_total, paid_by, categoria, participantes }) => {
    try {
      setCarregando(true);
      setErro(null);

      // Validar soma das partes = total
      const somaPartes = participantes.reduce((sum, p) => sum + p.valor_devido, 0);
      if (Math.abs(somaPartes - valor_total) > 1) { // tolerância de 1 centavo
        throw new Error('Soma das divisões não corresponde ao valor total');
      }

      // Criar divisão
      const { data: divisao, error: divisaoError } = await supabase
        .from('family_expense_splits')
        .insert([{
          group_id: groupId,
          descricao,
          valor_total,
          paid_by,
          categoria
        }])
        .select()
        .single();

      if (divisaoError) throw divisaoError;

      // Criar participantes
      const participantesData = participantes.map(p => ({
        split_id: divisao.id,
        participant_id: p.user_id,
        valor_devido: p.valor_devido
      }));

      const { error: participantesError } = await supabase
        .from('family_split_participants')
        .insert(participantesData);

      if (participantesError) throw participantesError;

      await carregarDivisoes();
      return divisao;
    } catch (err) {
      console.error('Erro ao criar divisão:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Divide valor igualmente entre participantes
   * Usa centavos para evitar erros de arredondamento
   */
  const dividirIgualmente = (valorTotal, participantes) => {
    const valorCentavos = Math.round(valorTotal * 100);
    const numParticipantes = participantes.length;
    const valorPorPessoa = Math.floor(valorCentavos / numParticipantes);
    const resto = valorCentavos % numParticipantes;

    return participantes.map((p, index) => ({
      user_id: p.user_id || p.id,
      valor_devido: valorPorPessoa + (index < resto ? 1 : 0) // distribui centavos restantes
    }));
  };

  /**
   * Divide por percentuais personalizados
   */
  const dividirPorPercentual = (valorTotal, participantes) => {
    const valorCentavos = Math.round(valorTotal * 100);
    let somaAlocada = 0;

    const divisoes = participantes.map((p, index) => {
      // Último participante recebe o resto (evita erro de arredondamento)
      if (index === participantes.length - 1) {
        return {
          user_id: p.user_id || p.id,
          valor_devido: valorCentavos - somaAlocada
        };
      }

      const valor = Math.round((valorCentavos * p.percentual) / 100);
      somaAlocada += valor;

      return {
        user_id: p.user_id || p.id,
        valor_devido: valor
      };
    });

    return divisoes;
  };

  /**
   * Marca participante como pago
   */
  const marcarPago = async (participantId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_split_participants')
        .update({
          pago: true,
          pago_em: new Date().toISOString()
        })
        .eq('id', participantId);

      if (error) throw error;

      await carregarDivisoes();
    } catch (err) {
      console.error('Erro ao marcar pagamento:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Desmarca pagamento
   */
  const desmarcarPago = async (participantId) => {
    try {
      setCarregando(true);
      setErro(null);

      const { error } = await supabase
        .from('family_split_participants')
        .update({
          pago: false,
          pago_em: null
        })
        .eq('id', participantId);

      if (error) throw error;

      await carregarDivisoes();
    } catch (err) {
      console.error('Erro ao desmarcar pagamento:', err);
      setErro(err.message);
      throw err;
    } finally {
      setCarregando(false);
    }
  };

  /**
   * Calcula balanço (quem deve para quem)
   */
  const calcularBalanco = (divisoes) => {
    const saldos = {}; // user_id -> saldo em centavos

    divisoes.forEach(divisao => {
      // Quem pagou tem crédito
      if (!saldos[divisao.paid_by]) saldos[divisao.paid_by] = 0;
      saldos[divisao.paid_by] += divisao.valor_total;

      // Participantes têm débito (valor devido)
      divisao.family_split_participants?.forEach(p => {
        if (!saldos[p.participant_id]) saldos[p.participant_id] = 0;
        // Subtrai valor devido (débito)
        saldos[p.participant_id] -= p.valor_devido;
      });
    });

    return saldos;
  };

  return {
    divisoes,
    carregando,
    erro,
    criarDivisao,
    dividirIgualmente,
    dividirPorPercentual,
    marcarPago,
    desmarcarPago,
    calcularBalanco,
    recarregar: carregarDivisoes
  };
}
