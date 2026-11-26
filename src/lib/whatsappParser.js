/**
 * Parser de mensagens do WhatsApp para registro automático de despesas/receitas
 * Não requer API do WhatsApp para funcionar - processa texto puro
 */

const PALAVRAS_CHAVE_DESPESA = ['gastei', 'paguei', 'comprei', 'despesa', 'saiu'];
const PALAVRAS_CHAVE_RECEITA = ['recebi', 'ganhei', 'entrada', 'receita'];
const PALAVRAS_CHAVE_FAMILIAR = ['familia', 'familiar', 'conjunta', 'conjunt', 'grupo', 'família'];

const CATEGORIAS = {
  alimentacao: ['mercado', 'supermercado', 'feira', 'padaria', 'açougue', 'acougue', 'restaurante', 'lanche', 'comida', 'almoço', 'almoco', 'jantar'],
  transporte: ['uber', '99', 'taxi', 'onibus', 'ônibus', 'metro', 'metrô', 'gasolina', 'combustível', 'combustivel', 'estacionamento'],
  saude: ['farmacia', 'farmácia', 'remedio', 'remédio', 'medico', 'médico', 'consulta', 'exame', 'hospital', 'clinica', 'clínica'],
  lazer: ['cinema', 'teatro', 'show', 'jogo', 'parque', 'viagem', 'passeio', 'festa'],
  educacao: ['escola', 'curso', 'livro', 'material escolar', 'faculdade', 'universidade'],
  moradia: ['aluguel', 'condominio', 'condomínio', 'luz', 'agua', 'água', 'internet', 'gas', 'gás'],
  vestuario: ['roupa', 'calça', 'calca', 'camisa', 'sapato', 'tenis', 'tênis', 'loja'],
  outros: []
};

/**
 * Extrai valor monetário da mensagem
 */
function extrairValor(texto) {
  // Padrões: R$ 50, 50 reais, R$50.00, 50,00, 1500 (sem símbolo)
  const padroes = [
    /R\$\s*(\d+(?:[.,]\d{2})?)/i,
    /(\d+(?:[.,]\d{2})?)\s*reais/i,
    /(\d+(?:[.,]\d{2})?)\s*R\$/i,
    /(?:^|\s)(\d+[.,]\d{2})(?:\s|$)/,
    /(?:^|\s)(\d{2,5})(?:\s|$)(?!x)/ // números grandes sem x (evita parcelas)
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) {
      const valorStr = match[1].replace(',', '.');
      const valor = parseFloat(valorStr);
      if (!isNaN(valor) && valor > 0) {
        return valor;
      }
    }
  }

  return null;
}

/**
 * Identifica se é despesa ou receita
 */
function identificarTipo(texto) {
  const textoLower = texto.toLowerCase();
  
  const temDespesa = PALAVRAS_CHAVE_DESPESA.some(palavra => textoLower.includes(palavra));
  const temReceita = PALAVRAS_CHAVE_RECEITA.some(palavra => textoLower.includes(palavra));

  if (temReceita) return 'receita';
  if (temDespesa) return 'despesa';
  
  // Default: se tem valor e não identificou, assume despesa
  return 'despesa';
}

/**
 * Identifica categoria baseada em palavras-chave
 */
function identificarCategoria(texto) {
  const textoLower = texto.toLowerCase();

  for (const [categoria, palavras] of Object.entries(CATEGORIAS)) {
    if (palavras.some(palavra => textoLower.includes(palavra))) {
      return categoria;
    }
  }

  return 'outros';
}

/**
 * Identifica se é despesa familiar/compartilhada
 */
function ehFamiliar(texto) {
  const textoLower = texto.toLowerCase();
  return PALAVRAS_CHAVE_FAMILIAR.some(palavra => textoLower.includes(palavra));
}

/**
 * Extrai número de parcelas
 */
function extrairParcelas(texto) {
  const padroes = [
    /(\d+)x/i,
    /(\d+)\s*parcelas/i,
    /em\s*(\d+)/i
  ];

  for (const padrao of padroes) {
    const match = texto.match(padrao);
    if (match) {
      const parcelas = parseInt(match[1]);
      if (!isNaN(parcelas) && parcelas > 1 && parcelas <= 48) {
        return parcelas;
      }
    }
  }

  return null;
}

/**
 * Extrai descrição (remove valor e palavras-chave)
 */
function extrairDescricao(texto) {
  let descricao = texto
    .replace(/R\$\s*\d+(?:[.,]\d{2})?/gi, '')
    .replace(/\d+(?:[.,]\d{2})?\s*reais/gi, '')
    .replace(/\d+x/gi, '')
    .replace(/gastei|paguei|comprei|recebi/gi, '')
    .trim();

  // Capitaliza primeira letra
  if (descricao.length > 0) {
    descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  }

  return descricao || 'Sem descrição';
}

/**
 * Parser principal - converte mensagem em objeto estruturado
 * @param {string} mensagem - Texto da mensagem
 * @returns {object} - { sucesso: boolean, transacao?: object, erro?: string }
 */
export function parseWhatsAppMessage(mensagem) {
  if (!mensagem || typeof mensagem !== 'string') {
    return { sucesso: false, erro: 'Mensagem inválida' };
  }

  const valor = extrairValor(mensagem);
  
  if (!valor) {
    return { sucesso: false, erro: 'Não foi possível identificar um valor monetário válido na mensagem' };
  }

  const tipo = identificarTipo(mensagem);
  const categoria = identificarCategoria(mensagem);
  const familiar = ehFamiliar(mensagem);
  const parcelas = extrairParcelas(mensagem);
  const descricao = extrairDescricao(mensagem);

  return {
    sucesso: true,
    transacao: {
      valor,
      tipo,
      categoria,
      familiar,
      parcelas,
      descricao,
      confianca: calcularConfianca(mensagem, valor, tipo, categoria)
    }
  };
}

/**
 * Calcula nível de confiança do parsing (0-1)
 */
function calcularConfianca(mensagem, valor, tipo, categoria) {
  let pontos = 0;
  const textoLower = mensagem.toLowerCase();

  // Valor bem formatado (+0.3)
  if (/R\$\s*\d+[.,]\d{2}/.test(mensagem)) pontos += 0.3;
  
  // Palavra-chave explícita (+0.3)
  if ([...PALAVRAS_CHAVE_DESPESA, ...PALAVRAS_CHAVE_RECEITA].some(p => textoLower.includes(p))) {
    pontos += 0.3;
  }
  
  // Categoria identificada (+0.2)
  if (categoria !== 'outros') pontos += 0.2;
  
  // Descrição presente (+0.2)
  if (mensagem.length > 15) pontos += 0.2;

  return Math.min(pontos, 1);
}

/**
 * Formata mensagem de confirmação para enviar ao usuário
 */
export function formatConfirmacao(dados) {
  const emoji = dados.tipo === 'receita' ? '💰' : '💸';
  const tipoTexto = dados.tipo === 'receita' ? 'Receita' : 'Despesa';
  
  let msg = `${emoji} *${tipoTexto} registrada!*\n\n`;
  msg += `📝 ${dados.descricao}\n`;
  msg += `💵 R$ ${dados.valor.toFixed(2)}\n`;
  msg += `🏷️ ${dados.categoria}\n`;
  
  if (dados.familiar) {
    msg += `👨‍👩‍👧‍👦 Despesa familiar\n`;
  }
  
  if (dados.parcelas) {
    msg += `📊 ${dados.parcelas}x de R$ ${(dados.valor / dados.parcelas).toFixed(2)}\n`;
  }

  return msg;
}

/**
 * Valida se mensagem pode ser processada
 */
export function validarMensagem(mensagem) {
  if (!mensagem || typeof mensagem !== 'string') {
    return { valida: false, erro: 'Mensagem inválida' };
  }

  if (mensagem.length < 5) {
    return { valida: false, erro: 'Mensagem muito curta' };
  }

  if (mensagem.length > 500) {
    return { valida: false, erro: 'Mensagem muito longa' };
  }

  return { valida: true };
}
