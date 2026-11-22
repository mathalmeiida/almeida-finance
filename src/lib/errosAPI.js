/**
 * HUMANIZAÇÃO DE ERROS — Almeida Finance
 * 
 * Converte erros técnicos do Supabase/banco em mensagens compreensíveis.
 * Nunca mostra "RLS policy violation", "schema cache", "Cannot read property".
 * 
 * Princípio: o usuário não precisa entender a arquitetura do sistema.
 */

/**
 * Converte erro da API em mensagem amigável
 * @param {Error|string} erro - Erro capturado
 * @param {string} contexto - O que o usuário estava tentando fazer
 * @returns {string} Mensagem humanizada
 */
export function humanizarErro(erro, contexto = '') {
  const msg = String(erro?.message || erro || '').toLowerCase()
  
  // Erros de autenticação
  if (msg.includes('jwt') || msg.includes('token') || msg.includes('unauthorized')) {
    return 'Sua sessão expirou. Por favor, faça login novamente.'
  }
  
  // Erros de permissão (RLS)
  if (msg.includes('rls') || msg.includes('policy') || msg.includes('permission denied')) {
    return 'Você não tem permissão para fazer isso. Entre em contato com o suporte.'
  }
  
  // Erros de conexão
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('conexão')) {
    return 'Problema de conexão. Verifique sua internet e tente novamente.'
  }
  
  // Erros de validação do banco
  if (msg.includes('unique') || msg.includes('duplicate') || msg.includes('já existe')) {
    return 'Este item já foi cadastrado anteriormente.'
  }
  
  if (msg.includes('foreign key') || msg.includes('violates')) {
    return 'Este item está vinculado a outros dados e não pode ser alterado agora.'
  }
  
  if (msg.includes('not null') || msg.includes('required')) {
    return 'Preencha todos os campos obrigatórios.'
  }
  
  // Erros de tipo/formato
  if (msg.includes('invalid') || msg.includes('inválido') || msg.includes('formato')) {
    return 'Os dados informados estão em formato incorreto. Verifique e tente novamente.'
  }
  
  // Erros de limite
  if (msg.includes('limit') || msg.includes('quota') || msg.includes('exceeded')) {
    return 'Limite atingido. Entre em contato com o suporte.'
  }
  
  // Contexto específico
  const msgContexto = contexto ? ` ao ${contexto}` : ''
  
  // Fallback genérico (evita mostrar stack traces)
  return `Não foi possível completar a operação${msgContexto}. Tente novamente.`
}

/**
 * Wrapper para try-catch que humaniza automaticamente
 * @param {Function} fn - Função async a executar
 * @param {string} contexto - Contexto da operação
 * @returns {Promise<{sucesso: boolean, dados?: any, erro?: string}>}
 */
export async function executarComErroHumanizado(fn, contexto = '') {
  try {
    const dados = await fn()
    return { sucesso: true, dados }
  } catch (erro) {
    console.error(`[Erro ${contexto}]:`, erro) // Log técnico para debug
    return { sucesso: false, erro: humanizarErro(erro, contexto) }
  }
}

/**
 * Mensagens de sucesso amigáveis
 */
export const MENSAGENS_SUCESSO = {
  salvar: 'Salvo com sucesso!',
  excluir: 'Excluído com sucesso!',
  atualizar: 'Atualizado com sucesso!',
  criar: 'Criado com sucesso!',
  
  // Específicas
  gasto: (valor) => `Gasto de ${valor} registrado!`,
  receita: (valor) => `Receita de ${valor} registrada!`,
  despesa: (valor) => `Despesa de ${valor} adicionada!`,
  transferencia: (valor) => `Transferência de ${valor} concluída!`,
}
