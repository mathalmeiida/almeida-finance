import { parseWhatsAppMessage, formatConfirmacao } from './whatsappParser';

// Simulador sem efeitos no banco, sem envio externo e sem consumo de cotas.
export async function processarMensagemRecebida(userId, mensagemTexto) {
  if (!userId) return { sucesso: false, erro: 'Usuário não identificado.' };
  const resultado = parseWhatsAppMessage(mensagemTexto);
  if (!resultado.sucesso) return resultado;
  return { sucesso: true, transacao: resultado.transacao,
    confirmacao: formatConfirmacao(resultado.transacao),
    confianca: resultado.transacao.confianca, simulacao: true, requerConfirmacao: true, gravado: false };
}
export async function enviarConfirmacao(userId, telefone, mensagem) {
  if (!userId || !telefone || !mensagem) return { sucesso: false, erro: 'Dados incompletos.' };
  return { sucesso: true, simulacao: true, enviado: false, mensagem_id: `sim_${Date.now()}`, timestamp: new Date().toISOString() };
}
export function simularWebhookLocal(userId, mensagem) { return processarMensagemRecebida(userId, mensagem); }
