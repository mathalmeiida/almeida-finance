/**
 * Motor de classificação automática de despesas.
 * Classifica como 'fixa' ou 'variavel' com base em:
 *   1. Palavras-chave na descrição (maior prioridade)
 *   2. Nome da categoria selecionada
 *   3. Fallback: 'variavel'
 *
 * Não usa API externa — apenas regras locais.
 * Fixa/Variável é independente de Recorrente/Pontual.
 */

// ─── Prioridade 1: palavras-chave na descrição ────────────────────────────────

const PALAVRAS_FIXAS = [
  // Moradia
  'aluguel', 'condominio', 'condomínio', 'iptu', 'financiamento', 'hipoteca',
  // Serviços de telecomunicação
  'internet', 'banda larga', 'fibra', 'telefone', 'celular', 'tim', 'claro',
  'vivo', 'oi', 'net', 'operadora',
  // Streaming / assinaturas
  'streaming', 'netflix', 'spotify', 'prime', 'amazon', 'disney', 'hbo',
  'max', 'globoplay', 'deezer', 'apple tv', 'apple music', 'youtube premium',
  'assinatura', 'mensalidade',
  // Educação
  'escola', 'faculdade', 'universidade', 'curso', 'anuidade', 'colegio',
  'colégio', 'creche', 'bolsa',
  // Saúde — apenas modalidades fixas
  'plano', 'convenio', 'convênio', 'seguro saude', 'seguro saúde',
  // Outros seguros
  'seguro', 'previdencia', 'previdência',
  // Academia / bem-estar fixo
  'academia', 'gym', 'pilates', 'crossfit', 'musculacao', 'musculação',
  'natacao', 'natação',
  // Utilidades domésticas fixas
  'agua', 'água', 'luz', 'energia', 'gas', 'gás', 'conta de',
]

const PALAVRAS_VARIAVEIS = [
  // Alimentação fora
  'mercado', 'supermercado', 'feira', 'hortifruti', 'padaria', 'açougue',
  'acougue', 'peixaria',
  // Restaurantes / delivery
  'restaurante', 'lanchonete', 'lanche', 'pizzaria', 'hamburger', 'hamburguer',
  'delivery', 'ifood', 'rappi', 'uber eats', 'ubereats', 'aiqfome',
  'sushi', 'rodizio', 'rodízio', 'churrasco', 'bar ',
  // Transporte variável
  'gasolina', 'combustivel', 'combustível', 'alcool', 'álcool', 'etanol',
  'uber', '99pop', '99', 'taxi', 'táxi', 'estacionamento', 'pedagio', 'pedágio',
  'onibus', 'ônibus', 'metro', 'metrô',
  // Saúde variável
  'farmacia', 'farmácia', 'remedio', 'remédio', 'medicamento', 'consulta',
  'exame', 'laboratorio', 'laboratório', 'dentista', 'ortopedista',
  // Vestuário / compras
  'roupa', 'calcado', 'calçado', 'sapato', 'tenis', 'tênis', 'shopping',
  'loja', 'zara', 'renner', 'c&a', 'riachuelo',
  // Manutenção
  'manutencao', 'manutenção', 'reparo', 'conserto', 'reforma', 'encanador',
  'eletricista', 'tecnico', 'técnico',
  // Lazer variável
  'cinema', 'teatro', 'show', 'ingresso', 'viagem', 'hotel', 'pousada',
  'passagem', 'passeio',
]

// ─── Prioridade 2: categoria ──────────────────────────────────────────────────

const CATEGORIAS_FIXAS = [
  'moradia', 'educação', 'educacao', 'serviços', 'servicos',
]

const CATEGORIAS_VARIAVEIS = [
  'alimentação', 'alimentacao', 'transporte', 'saúde', 'saude',
  'lazer', 'vestuário', 'vestuario', 'pets', 'outros',
  'eletrônicos', 'eletronicos', 'móveis', 'moveis', 'viagem',
]

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {string} params.descricao  - texto digitado pelo usuário
 * @param {string} params.categoria  - nome da categoria selecionada (pode ser null)
 * @returns {'fixa' | 'variavel'}
 */
export function classificarDespesa({ descricao = '', categoria = '' }) {
  const desc = descricao.toLowerCase().trim()
  const cat  = (categoria || '').toLowerCase().trim()

  // Prioridade 1a: palavras que indicam FIXA na descrição
  for (const palavra of PALAVRAS_FIXAS) {
    if (desc.includes(palavra)) return 'fixa'
  }

  // Prioridade 1b: palavras que indicam VARIÁVEL na descrição
  for (const palavra of PALAVRAS_VARIAVEIS) {
    if (desc.includes(palavra)) return 'variavel'
  }

  // Prioridade 2a: categoria FIXA
  for (const c of CATEGORIAS_FIXAS) {
    if (cat.includes(c)) return 'fixa'
  }

  // Prioridade 2b: categoria VARIÁVEL
  for (const c of CATEGORIAS_VARIAVEIS) {
    if (cat.includes(c)) return 'variavel'
  }

  // Fallback
  return 'variavel'
}

/**
 * Retorna o label e estilo visual para cada tipo.
 */
export function labelTipoDespesa(tipo) {
  if (tipo === 'fixa') {
    return {
      label: 'Fixa',
      classes: 'bg-blue-100 text-blue-700',
      icone: '📌',
    }
  }
  return {
    label: 'Variável',
    classes: 'bg-gray-100 text-gray-600',
    icone: '🛒',
  }
}
