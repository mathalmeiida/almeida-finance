// ─── Reconhecimento de bancos, emissores de cartão e corretoras ─────────────
// Pelo código COMPE (OFX BANKID/FID) ou por palavras no conteúdo do documento.

import { normalizarDescricao } from './normalizar.js'

const INSTITUICOES = [
  { nome: 'Nubank', codigos: ['260', '0260'], termos: ['NUBANK', 'NU PAGAMENTOS', 'NU FINANCEIRA', 'NU INVEST'] },
  { nome: 'Itaú', codigos: ['341', '0341'], termos: ['ITAU', 'ITAUCARD', 'ITAU UNIBANCO'] },
  { nome: 'Bradesco', codigos: ['237', '0237'], termos: ['BRADESCO', 'BRADESCARD'] },
  { nome: 'Banco do Brasil', codigos: ['001', '1', '0001'], termos: ['BANCO DO BRASIL', 'OUROCARD', 'BB S A'] },
  { nome: 'Caixa', codigos: ['104', '0104'], termos: ['CAIXA ECONOMICA', 'CAIXA FEDERAL'] },
  { nome: 'Santander', codigos: ['033', '33', '0033'], termos: ['SANTANDER'] },
  { nome: 'Inter', codigos: ['077', '77', '0077'], termos: ['BANCO INTER', 'INTER S A', 'INTERINVEST'] },
  { nome: 'C6 Bank', codigos: ['336', '0336'], termos: ['C6 BANK', 'BANCO C6', 'C6 S A'] },
  { nome: 'BTG Pactual', codigos: ['208', '0208'], termos: ['BTG PACTUAL', 'BTG'] },
  { nome: 'XP Investimentos', codigos: ['102', '348'], termos: ['XP INVESTIMENTOS', 'BANCO XP', 'XP INC'] },
  { nome: 'Rico', codigos: [], termos: ['RICO INVESTIMENTOS', 'RICO CTVM'] },
  { nome: 'Clear', codigos: [], termos: ['CLEAR CORRETORA', 'CLEAR CTVM'] },
  { nome: 'Sicoob', codigos: ['756', '0756'], termos: ['SICOOB'] },
  { nome: 'Sicredi', codigos: ['748', '0748'], termos: ['SICREDI'] },
  { nome: 'Banco Original', codigos: ['212', '0212'], termos: ['BANCO ORIGINAL'] },
  { nome: 'PicPay', codigos: ['380', '0380'], termos: ['PICPAY'] },
  { nome: 'Mercado Pago', codigos: ['323', '0323'], termos: ['MERCADO PAGO'] },
  { nome: 'PagBank', codigos: ['290', '0290'], termos: ['PAGBANK', 'PAGSEGURO'] },
  { nome: 'Neon', codigos: ['735', '0735'], termos: ['BANCO NEON', 'NEON PAGAMENTOS'] },
  { nome: 'Banrisul', codigos: ['041', '41', '0041'], termos: ['BANRISUL'] },
  { nome: 'Safra', codigos: ['422', '0422'], termos: ['BANCO SAFRA', 'SAFRA'] },
  { nome: 'B3', codigos: [], termos: ['AREA DO INVESTIDOR', 'B3 S A', 'BRASIL BOLSA BALCAO'] },
  { nome: 'Tesouro Direto', codigos: [], termos: ['TESOURO DIRETO'] },
]

/**
 * @param {{ codigos?: (string|null)[], texto?: string }} pistas
 * @returns {string|null}
 */
export function reconhecerInstituicao({ codigos = [], texto = '' } = {}) {
  for (const c of codigos.filter(Boolean)) {
    const limpo = String(c).replace(/\D/g, '')
    const achada = INSTITUICOES.find(i => i.codigos.includes(limpo) || i.codigos.includes(limpo.replace(/^0+/, '')))
    if (achada) return achada.nome
  }
  const n = ` ${normalizarDescricao(texto).slice(0, 20000)} `
  let melhor = null
  let melhorPos = Infinity
  for (const inst of INSTITUICOES) {
    for (const termo of inst.termos) {
      const pos = n.indexOf(` ${termo} `)
      // A instituição citada primeiro (cabeçalho) tende a ser a emissora.
      if (pos >= 0 && pos < melhorPos) { melhor = inst.nome; melhorPos = pos }
    }
  }
  return melhor
}

// Sugere o cartão cadastrado que corresponde à instituição reconhecida.
export function sugerirCartao(cartoes, instituicao) {
  if (!instituicao || !Array.isArray(cartoes) || cartoes.length === 0) return cartoes?.length === 1 ? cartoes[0].id : null
  const alvo = normalizarDescricao(instituicao).split(' ')[0]
  const achado = cartoes.find(c => normalizarDescricao(`${c.banco || ''} ${c.nome || ''}`).includes(alvo))
  return achado ? achado.id : (cartoes.length === 1 ? cartoes[0].id : null)
}
