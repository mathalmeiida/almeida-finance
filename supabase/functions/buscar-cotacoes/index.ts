// ═══════════════════════════════════════════════════════════════════════════
// Edge Function: buscar-cotacoes
// Proxy seguro para API brapi.dev — protege token do backend
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BRAPI_TOKEN = Deno.env.get('BRAPI_TOKEN') || ''
const BRAPI_BASE = 'https://brapi.dev/api'

// Limite de requisições por usuário (previne abuso)
const RATE_LIMIT_PER_MINUTE = 10

interface CotacaoRequest {
  tickers: string[]
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verifica autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ erro: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verifica usuário
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ erro: 'Usuário inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting simples (baseado em tempo)
    const now = Date.now()
    const rateLimitKey = `rate_limit_${user.id}`
    
    // TODO: Implementar rate limit real com Redis ou KV storage
    // Por enquanto, apenas log
    console.log(`[Cotações] Requisição de ${user.id} em ${new Date(now).toISOString()}`)

    // Verifica se token está configurado
    if (!BRAPI_TOKEN) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Token da API não configurado no servidor',
          timestamp: new Date().toISOString()
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse body
    const { tickers }: CotacaoRequest = await req.json()

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(
        JSON.stringify({ 
          sucesso: false, 
          erro: 'Parâmetro tickers inválido',
          timestamp: new Date().toISOString()
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Sanitiza tickers
    const uniqueTickers = [...new Set(tickers.map(t => String(t).toUpperCase().trim()))]
      .filter(Boolean)
      .slice(0, 20) // máximo 20 por requisição

    // Busca cotações na brapi
    const url = `${BRAPI_BASE}/quote/${uniqueTickers.join(',')}?token=${BRAPI_TOKEN}&fundamental=false`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (!response.ok) {
        const erroMsg = response.status === 401 
          ? 'Token inválido'
          : response.status === 429
          ? 'Limite de requisições excedido'
          : `Erro ${response.status}`

        return new Response(
          JSON.stringify({
            sucesso: false,
            cotacoes: null,
            erro: erroMsg,
            timestamp: new Date().toISOString()
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const json = await response.json()
      const resultados = new Map()

      for (const item of (json.results || [])) {
        if (!item.symbol) continue
        resultados.set(item.symbol, {
          preco: Number(item.regularMarketPrice) || null,
          variacao: Number(item.regularMarketChange) || null,
          variacaoPct: Number(item.regularMarketChangePercent) || null,
          atualizadoEm: item.updatedAt || null,
        })
      }

      return new Response(
        JSON.stringify({
          sucesso: true,
          cotacoes: Object.fromEntries(resultados),
          erro: null,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (err) {
      clearTimeout(timeoutId)
      const erroMsg = err.name === 'AbortError' 
        ? 'Tempo limite excedido'
        : 'Erro de conexão'

      return new Response(
        JSON.stringify({
          sucesso: false,
          cotacoes: null,
          erro: erroMsg,
          timestamp: new Date().toISOString()
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('[Cotações] Erro:', error)
    return new Response(
      JSON.stringify({ 
        sucesso: false, 
        erro: 'Erro interno do servidor',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
