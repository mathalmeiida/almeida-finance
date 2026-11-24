// Mensagens amigaveis para erros das RPCs pagar_fatura_cartao / estornar_pagamento_fatura.
// Modulo puro (sem React nem supabase) para ser testavel em node.

/** Conflito transacional (abortado com seguranca, pode repetir): 40001, 40P01 (deadlock), 55P03 (lock_timeout). */
export function ehConflitoTransacional(err) {
  return ['40001', '40P01', '55P03'].includes(err?.code)
}

/** Erro de "fatura desatualizada" ou conflito: o total da tela pode divergir do servidor, recarregar. */
export function ehFaturaDesatualizada(err) {
  const m = String(err?.message || err || '')
  return /fatura desatualizada/i.test(m) || ehConflitoTransacional(err)
}

export function mensagemAmigavel(err) {
  const m = String(err?.message || err || '')
  if (ehConflitoTransacional(err) && err.code !== '40001') {
    return 'Outra alteração em andamento no cartão impediu o pagamento. Nada foi cobrado. Atualizamos os dados: confira o total e tente novamente.'
  }
  if (ehFaturaDesatualizada(err)) {
    return 'A fatura mudou desde que a tela foi carregada. Atualizamos os dados: confira o novo total e tente de novo.'
  }
  if (/excede o saldo em aberto/i.test(m)) return m
  if (/sem saldo em aberto|j[aá] est[aá] quitada/i.test(m)) return 'Esta fatura não tem saldo em aberto.'
  if (/sem valor a pagar/i.test(m)) return 'Esta fatura não tem valor a pagar neste ciclo.'
  // "Pagamento já estornado" (estorno repetido) e "Este pagamento já foi estornado"
  // (retry de pagamento estornado), com ou sem acento.
  if (/j[aá]\s+(foi\s+)?estornad/i.test(m)) return 'Este pagamento já foi estornado.'
  if (/n[aã]o encontrado/i.test(m)) return 'Cartão ou pagamento não encontrado.'
  if (/futura/i.test(m)) return 'A data do pagamento não pode ser futura.'
  if (/idempot/i.test(m) && /outro pagamento/i.test(m)) {
    return 'Esta tentativa de pagamento já foi usada com outros dados. Tente novamente.'
  }
  if (/function .*does not exist|schema cache/i.test(m)) {
    return 'Pagamento de fatura indisponível: a migração 20261124000001_pagamentos_fatura.sql ainda não foi aplicada neste ambiente.'
  }
  return m || 'Erro ao registrar o pagamento.'
}
