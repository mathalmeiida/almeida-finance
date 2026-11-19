/**
 * Simulador de webhook do WhatsApp Business API
 * 
 * Em desenvolvimento/testes: processa mensagens localmente
 * Em produção: seria substituído por endpoint real que recebe webhooks da Meta
 * 
 * NÃO FAZ chamadas à API do WhatsApp - apenas simula o fluxo
 */

import { supabase } from './supabase';
import { parseWhatsAppMessage, formatConfirmacao, validarMensagem } from './whatsappParser';

/**
 * Processa mensagem recebida (simulado)
 * Em prod: seria chamado pelo webhook real da Meta
 */
export async function processarMensagemRecebida(userId, mensagemTexto) {
  try {
    // Validar mensagem
    const validacao = validarMensagem(mensagemTexto);
    if (!validacao.valida) {
      return {
        sucesso: false,
        erro: validacao.erro
      };
    }

    // Parsear mensagem
    const dados = parseWhatsAppMessage(mensagemTexto);
    
    if (!dados) {
      return {
        sucesso: false,
        erro: 'Não foi possível identificar uma transação financeira na mensagem'
      };
    }

    // Verificar limite de mensagens
    const podeProcessar = await verificarLimiteWhatsApp(userId);
    if (!podeProcessar) {
      return {
        sucesso: false,
        erro: 'Limite de mensagens WhatsApp atingido para este mês'
      };
    }

    // Registrar evento da mensagem
    await registrarEvento(userId, 'inbound', mensagemTexto, dados);

    // Criar transação no banco
    const transacao = await criarTransacao(userId, dados);

    // Atualizar contadores de uso
    await atualizarUsoWhatsApp(userId, 'recebida');

    // Gerar mensagem de confirmação
    const confirmacao = formatConfirmacao(dados);

    return {
      sucesso: true,
      transacao,
      confirmacao,
      confianca: dados.confianca
    };

  } catch (err) {
    console.error('Erro ao processar mensagem WhatsApp:', err);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

/**
 * Simula envio de mensagem de confirmação
 * Em prod: faria POST para API do WhatsApp Business
 */
export async function enviarConfirmacao(userId, telefone, mensagem) {
  try {
    // Verificar limite
    const podeEnviar = await verificarLimiteWhatsApp(userId);
    if (!podeEnviar) {
      throw new Error('Limite de mensagens atingido');
    }

    // Registrar evento (simulado - não envia de verdade)
    await registrarEvento(userId, 'outbound', mensagem, {
      tipo: 'confirmacao',
      destinatario: telefone
    });

    // Atualizar contadores
    await atualizarUsoWhatsApp(userId, 'enviada');

    // Em desenvolvimento, apenas loga
    console.log('[WhatsApp Simulado] Enviando para:', telefone);
    console.log('[WhatsApp Simulado] Mensagem:', mensagem);

    return {
      sucesso: true,
      mensagem_id: `sim_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

  } catch (err) {
    console.error('Erro ao enviar confirmação WhatsApp:', err);
    throw err;
  }
}

/**
 * Verifica se usuário ainda tem mensagens disponíveis no plano
 */
async function verificarLimiteWhatsApp(userId) {
  try {
    // Buscar plano do usuário
    const { data: perfil, error: perfilError } = await supabase
      .from('perfis')
      .select(`
        subscription_plan,
        subscription_plans (whatsapp_msgs_mes)
      `)
      .eq('id', userId)
      .single();

    if (perfilError) throw perfilError;

    const limite = perfil.subscription_plans?.whatsapp_msgs_mes || 0;
    if (limite === 0) return false;

    // Buscar uso do mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { data: uso, error: usoError } = await supabase
      .from('whatsapp_usage')
      .select('total_mensagens')
      .eq('user_id', userId)
      .gte('mes_referencia', inicioMes.toISOString())
      .maybeSingle();

    if (usoError) throw usoError;

    const usado = uso?.total_mensagens || 0;
    return usado < limite;

  } catch (err) {
    console.error('Erro ao verificar limite WhatsApp:', err);
    return false;
  }
}

/**
 * Registra evento de mensagem no banco
 */
async function registrarEvento(userId, direction, mensagem, metadata) {
  try {
    const { error } = await supabase
      .from('whatsapp_message_events')
      .insert([{
        user_id: userId,
        direction,
        message_text: mensagem,
        metadata,
        processed: true
      }]);

    if (error) throw error;
  } catch (err) {
    console.error('Erro ao registrar evento WhatsApp:', err);
    // Não falha o processamento se o registro de log falhar
  }
}

/**
 * Atualiza contadores de uso mensal
 */
async function atualizarUsoWhatsApp(userId, tipo) {
  try {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    // Tentar buscar registro existente
    const { data: usoExistente } = await supabase
      .from('whatsapp_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('mes_referencia', inicioMes.toISOString())
      .maybeSingle();

    if (usoExistente) {
      // Atualizar registro existente
      const updates = {
        total_mensagens: usoExistente.total_mensagens + 1
      };

      if (tipo === 'enviada') {
        updates.mensagens_enviadas = usoExistente.mensagens_enviadas + 1;
      } else if (tipo === 'recebida') {
        updates.mensagens_recebidas = usoExistente.mensagens_recebidas + 1;
      }

      const { error } = await supabase
        .from('whatsapp_usage')
        .update(updates)
        .eq('id', usoExistente.id);

      if (error) throw error;
    } else {
      // Criar novo registro
      const novoUso = {
        user_id: userId,
        mes_referencia: inicioMes.toISOString(),
        mensagens_enviadas: tipo === 'enviada' ? 1 : 0,
        mensagens_recebidas: tipo === 'recebida' ? 1 : 0,
        total_mensagens: 1
      };

      const { error } = await supabase
        .from('whatsapp_usage')
        .insert([novoUso]);

      if (error) throw error;
    }
  } catch (err) {
    console.error('Erro ao atualizar uso WhatsApp:', err);
    // Não falha o processamento se a atualização de contadores falhar
  }
}

/**
 * Cria transação financeira a partir dos dados parseados
 */
async function criarTransacao(userId, dados) {
  try {
    const tabela = dados.tipo === 'receita' ? 'receitas' : 'despesas';
    
    const transacao = {
      user_id: userId,
      descricao: dados.descricao,
      valor: Math.round(dados.valor * 100), // centavos
      data: new Date().toISOString().split('T')[0],
      origem: 'whatsapp',
      metadata: {
        confianca: dados.confianca,
        original_message: true
      }
    };

    // Adicionar campos específicos
    if (dados.tipo === 'despesa') {
      transacao.categoria = dados.categoria;
      transacao.forma_pagamento = 'pix'; // default
      
      if (dados.familiar) {
        transacao.familiar = true;
      }
      
      if (dados.parcelas && dados.parcelas > 1) {
        transacao.parcelado = true;
        transacao.parcelas_total = dados.parcelas;
        transacao.parcela_atual = 1;
      }
    } else {
      transacao.tipo_receita = 'extra';
    }

    const { data: nova, error } = await supabase
      .from(tabela)
      .insert([transacao])
      .select()
      .single();

    if (error) throw error;

    return nova;
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    throw err;
  }
}

/**
 * Webhook mock para testes locais
 * Simula recebimento de mensagem do WhatsApp
 */
export function simularWebhookLocal(userId, mensagem) {
  // Em ambiente de desenvolvimento, pode ser chamado diretamente
  // para testar o fluxo sem precisar de webhook real
  console.log('[WhatsApp Mock] Simulando recebimento de mensagem...');
  return processarMensagemRecebida(userId, mensagem);
}
