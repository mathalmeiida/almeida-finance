/**
 * cotacoes.js — Integração segura com API de cotações via Edge Function
 * 
 * MUDANÇA DE ARQUITETURA (Segurança):
 * - Token BRAPI_TOKEN movido para Edge Function (backend)
 * - Frontend chama Edge Function com autenticação
 * - Proteção contra abuso com rate limiting
 * 
 * ATIVAR COTAÇÕES:
 * 1. Deploy da Edge Function: supabase/functions/buscar-cotacoes
 * 2. Configurar BRAPI_TOKEN nos secrets do Supabase:
 *    `supabase secrets set BRAPI_TOKEN=seu_token_aqui`
 * 3. Token fica protegido no backend
 * 
 * SEM EDGE FUNCTION ATIVA: retorna null (modo manual).
 */

import { supabase } from './supabase'

/**
 * Busca cotações via Edge Function segura (token protegido no backend)
 */
export async function buscarCotacoes(tickers) {
  const timestamp = new Date().toISOString()
  
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return {
      sucesso: false,
      cotacoes: null,
      erro: 'Nenhum ticker informado',
      timestamp
    }
  }

  try {
    // Chama Edge Function com autenticação automática
    const { data, error } = await supabase.functions.invoke('buscar-cotacoes', {
      body: { tickers }
    })

    if (error) {
      // Edge Function não disponível ou erro de rede
      console.warn('[Cotações] Edge Function não disponível:', error.message)
      return {
        sucesso: false,
        cotacoes: null,
        erro: 'Serviço de cotações indisponível',
        timestamp
      }
    }

    // Converte objeto de volta para Map para retrocompatibilidade
    if (data.sucesso && data.cotacoes) {
      data.cotacoes = new Map(Object.entries(data.cotacoes))
    }

    return data
  } catch (err) {
    console.warn('[Cotações] Erro ao buscar:', err?.message || err)
    return {
      sucesso: false,
      cotacoes: null,
      erro: 'Erro de conexão',
      timestamp
    }
  }
}

/**
 * Busca cotação de um único ticker (retrocompatibilidade)
 */
export async function buscarCotacao(ticker) {
  const resultado = await buscarCotacoes([ticker])
  if (!resultado.sucesso || !resultado.cotacoes) return null
  return resultado.cotacoes.get(String(ticker).toUpperCase()) ?? null
}

/**
 * Verifica se cotações estão disponíveis
 * Agora sempre retorna true pois a verificação é feita no backend
 */
export function cotacoesDisponiveis() {
  return true // Edge Function decide se há token configurado
}
