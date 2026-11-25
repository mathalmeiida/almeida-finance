/**
 * Traduz erros técnicos para mensagens amigáveis em português
 */

export function traduzirErro(error) {
  if (!error) return 'Algo deu errado'

  const mensagem = error.message || String(error)
  const codigo = error.code || error.status

  // Erros de conexão
  if (
    mensagem.includes('fetch') ||
    mensagem.includes('network') ||
    mensagem.includes('Failed to fetch') ||
    codigo === 'NETWORK_ERROR'
  ) {
    return 'Você está sem conexão. Verifique sua internet'
  }

  // Erros de autenticação
  if (
    codigo === 'PGRST301' ||
    codigo === '401' ||
    mensagem.includes('JWT') ||
    mensagem.includes('expired') ||
    mensagem.includes('invalid_token')
  ) {
    return 'Sua sessão expirou. Entre novamente'
  }

  // Erros de permissão (RLS)
  if (
    codigo === 'PGRST301' ||
    codigo === '42501' ||
    codigo === '403' ||
    mensagem.includes('permission') ||
    mensagem.includes('policy')
  ) {
    return 'Você não tem permissão para fazer isso'
  }

  // Sem dados / não encontrado
  if (
    codigo === 'PGRST116' ||
    codigo === '404' ||
    mensagem.includes('not found') ||
    mensagem.includes('No rows')
  ) {
    return 'Não encontramos informações para este período'
  }

  // Validação de campos
  if (
    mensagem.includes('required') ||
    mensagem.includes('obrigatório') ||
    mensagem.includes('null value')
  ) {
    return 'Preencha os campos obrigatórios'
  }

  // Duplicidade
  if (
    mensagem.includes('duplicate') ||
    mensagem.includes('unique') ||
    mensagem.includes('already exists')
  ) {
    return 'Este item já existe'
  }

  // Valor inválido
  if (
    mensagem.includes('invalid') ||
    mensagem.includes('inválido') ||
    mensagem.includes('check constraint')
  ) {
    return 'Valor inválido. Verifique os dados'
  }

  // Timeout
  if (
    mensagem.includes('timeout') ||
    mensagem.includes('timed out')
  ) {
    return 'A operação demorou muito. Tente novamente'
  }

  // Erro do servidor
  if (
    codigo >= 500 ||
    mensagem.includes('Internal Server Error') ||
    mensagem.includes('server')
  ) {
    return 'Problema no servidor. Tente novamente'
  }

  // Fallback genérico
  if (mensagem.length < 100) {
    // Se a mensagem é curta e clara, pode exibir
    return mensagem
  }

  return 'Não conseguimos salvar. Tente novamente'
}

/**
 * Hook para tratamento de erros amigáveis
 * 
 * Uso:
 * const { tratarErro } = useErroAmigavel()
 * 
 * try {
 *   await salvar()
 * } catch (err) {
 *   const mensagemAmigavel = tratarErro(err)
 *   notificar.erro(mensagemAmigavel)
 * }
 */
export function useErroAmigavel() {
  const tratarErro = (error, contexto = '') => {
    // Log técnico (console)
    console.error(`[Erro${contexto ? ` em ${contexto}` : ''}]:`, error)

    // Mensagem amigável
    return traduzirErro(error)
  }

  return { tratarErro }
}

/**
 * Tipos de erro para categorização
 */
export const TiposErro = {
  CONEXAO: 'conexao',
  AUTENTICACAO: 'autenticacao',
  PERMISSAO: 'permissao',
  NAO_ENCONTRADO: 'nao_encontrado',
  VALIDACAO: 'validacao',
  DUPLICIDADE: 'duplicidade',
  TIMEOUT: 'timeout',
  SERVIDOR: 'servidor',
  DESCONHECIDO: 'desconhecido'
}

/**
 * Identifica o tipo do erro (para tratamento específico)
 */
export function identificarTipoErro(error) {
  const mensagem = error?.message || String(error)
  const codigo = error?.code || error?.status

  if (mensagem.includes('fetch') || mensagem.includes('network')) {
    return TiposErro.CONEXAO
  }

  if (codigo === 'PGRST301' || codigo === '401' || mensagem.includes('JWT')) {
    return TiposErro.AUTENTICACAO
  }

  if (codigo === '42501' || codigo === '403' || mensagem.includes('permission')) {
    return TiposErro.PERMISSAO
  }

  if (codigo === 'PGRST116' || codigo === '404') {
    return TiposErro.NAO_ENCONTRADO
  }

  if (mensagem.includes('required') || mensagem.includes('null value')) {
    return TiposErro.VALIDACAO
  }

  if (mensagem.includes('duplicate') || mensagem.includes('unique')) {
    return TiposErro.DUPLICIDADE
  }

  if (mensagem.includes('timeout')) {
    return TiposErro.TIMEOUT
  }

  if (codigo >= 500) {
    return TiposErro.SERVIDOR
  }

  return TiposErro.DESCONHECIDO
}
