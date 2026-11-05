/**
 * cotacoes.js — Integração com API de cotações (brapi.dev)
 *
 * STATUS: OPCIONAL / NÃO ATIVO POR PADRÃO.
 *
 * Para ativar: adicione VITE_BRAPI_TOKEN no .env.local com o token gratuito
 * obtido em https://brapi.dev (plano gratuito: 15.000 requisições/mês).
 *
 * SEM O TOKEN: a função retorna null para todos os ativos — o app continua
 * funcionando normalmente com atualização manual dos valores.
 *
 * Ativos suportados pela brapi.dev:
 *   - Ações BR (B3): PETR4, ITUB4, VALE3...
 *   - FIIs: MXRF11, KNRI11...
 *   - ETFs: BOVA11, IVVB11...
 *   - Tesouro Direto: via endpoint separado (não implementado aqui)
 *   - CDB/LCI/LCA: sem cotação de mercado (taxa é contratual)
 *
 * NÃO são usadas aqui:
 *   - Chaves privadas
 *   - Dados de usuários
 *   - Supabase
 *
 * LIMITAÇÕES CONHECIDAS:
 *   - Plano gratuito: 15.000 req/mês (~500/dia)
 *   - Delay de até 15 min em relação ao mercado ao vivo
 *   - Não cobre todos os ativos da B3
 *   - Tesouro Direto requer endpoint adicional (não implementado)
 *   - Fundos de investimento (cotas): não disponível nesta API
 */

const BRAPI_TOKEN = import.meta.env.VITE_BRAPI_TOKEN || ''
const BRAPI_BASE  = 'https://brapi.dev/api'

// Campos retornados pela brapi por ação/FII/ETF:
//   regularMarketPrice   → preço atual
//   regularMarketChange  → variação absoluta
//   regularMarketChangePercent → variação %
//   updatedAt            → timestamp da última atualização

/**
 * Busca cotação de um ou mais tickers (ex.: ['PETR4', 'MXRF11']).
 * Retorna Map<ticker, { preco, variacao, variacaoPct, atualizadoEm }> ou null se sem token.
 *
 * Uso:
 *   const cotacoes = await buscarCotacoes(['PETR4', 'MXRF11'])
 *   const petr4 = cotacoes?.get('PETR4')  // { preco: 38.50, ... } ou undefined
 */
export async function buscarCotacoes(tickers) {
  if (!BRAPI_TOKEN || !Array.isArray(tickers) || tickers.length === 0) return null

  // Remove duplicatas e garante uppercase
  const uniqueTickers = [...new Set(tickers.map(t => String(t).toUpperCase().trim()))]
    .filter(Boolean)
    .slice(0, 20) // limite por chamada

  try {
    const url = `${BRAPI_BASE}/quote/${uniqueTickers.join(',')}?token=${BRAPI_TOKEN}&fundamental=false`
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) {
      console.warn(`[cotacoes] brapi retornou ${resp.status} para ${uniqueTickers.join(',')}`)
      return null
    }
    const json = await resp.json()
    const resultados = new Map()
    for (const item of (json.results || [])) {
      if (!item.symbol) continue
      resultados.set(item.symbol, {
        preco:         Number(item.regularMarketPrice)         || null,
        variacao:      Number(item.regularMarketChange)        || null,
        variacaoPct:   Number(item.regularMarketChangePercent) || null,
        atualizadoEm:  item.updatedAt || null,
      })
    }
    return resultados
  } catch (err) {
    // Timeout ou erro de rede: retorna null sem quebrar o app
    console.warn('[cotacoes] Erro ao buscar cotações:', err?.message || err)
    return null
  }
}

/**
 * Busca cotação de um único ticker.
 * Retorna { preco, variacao, variacaoPct, atualizadoEm } ou null.
 */
export async function buscarCotacao(ticker) {
  const m = await buscarCotacoes([ticker])
  return m?.get(String(ticker).toUpperCase()) ?? null
}

/**
 * Verifica se a integração está configurada.
 * Útil para exibir badge "cotação ao vivo" vs "atualização manual".
 */
export function cotacoesDisponiveis() {
  return Boolean(BRAPI_TOKEN)
}
