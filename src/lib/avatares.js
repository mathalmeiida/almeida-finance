/**
 * Avatares predefinidos para o Almeida Finance
 * Design: moderno, discreto e profissional
 * Consistente com a identidade visual Vinho Premium
 */

export const AVATARES_PREDEFINIDOS = [
  {
    id: 'avatar-01',
    nome: 'Profissional 1',
    emoji: '👤',
    cor: '#801D39',  // Vinho Premium
  },
  {
    id: 'avatar-02',
    nome: 'Profissional 2',
    emoji: '👔',
    cor: '#420D1D',  // Vinho escuro
  },
  {
    id: 'avatar-03',
    nome: 'Gestão Financeira',
    emoji: '💼',
    cor: '#C4507A',  // Rosa vinho
  },
  {
    id: 'avatar-04',
    nome: 'Investidor',
    emoji: '📈',
    cor: '#801D39',
  },
  {
    id: 'avatar-05',
    nome: 'Planejamento',
    emoji: '📊',
    cor: '#420D1D',
  },
  {
    id: 'avatar-06',
    nome: 'Economia',
    emoji: '🏦',
    cor: '#C4507A',
  },
  {
    id: 'avatar-07',
    nome: 'Poupança',
    emoji: '🐷',
    cor: '#801D39',
  },
  {
    id: 'avatar-08',
    nome: 'Sucesso',
    emoji: '🎯',
    cor: '#420D1D',
  },
  {
    id: 'avatar-09',
    nome: 'Crescimento',
    emoji: '🌱',
    cor: '#C4507A',
  },
  {
    id: 'avatar-10',
    nome: 'Objetivo',
    emoji: '⭐',
    cor: '#801D39',
  },
  {
    id: 'avatar-11',
    nome: 'Conquista',
    emoji: '🏆',
    cor: '#420D1D',
  },
  {
    id: 'avatar-12',
    nome: 'Estratégia',
    emoji: '♟️',
    cor: '#C4507A',
  },
]

/**
 * Retorna o avatar pelo ID
 */
export function obterAvatar(avatarId) {
  return AVATARES_PREDEFINIDOS.find(a => a.id === avatarId) || null
}

/**
 * Retorna as iniciais do nome para usar como fallback
 */
export function obterIniciais(nome, email) {
  const nomeExibido = nome || email?.split('@')[0] || 'Usuário'
  return nomeExibido.slice(0, 2).toUpperCase()
}
