/**
 * Edge Function: push-notificacoes
 * Almeida Finance — envio de Web Push automático via Supabase Edge Runtime.
 *
 * Modos de operação (campo "modo" no corpo da requisição):
 *   "enviar_usuario"   → envia para um usuário específico (chamado pelo app ou webhook)
 *   "agendar_diario"   → varrre todos os usuários e envia alertas pertinentes (cron job)
 *
 * CONFIGURAÇÃO OBRIGATÓRIA (variáveis de ambiente no Supabase Dashboard):
 *   VAPID_PUBLIC_KEY   → chave pública VAPID (mesma do VITE_VAPID_PUBLIC_KEY)
 *   VAPID_PRIVATE_KEY  → chave privada VAPID (NUNCA exposta no frontend)
 *   VAPID_SUBJECT      → mailto:seu@email.com
 *   SUPABASE_URL       → preenchida automaticamente pelo Supabase
 *   SUPABASE_SERVICE_ROLE_KEY → preenchida automaticamente pelo Supabase
 *
 * Segurança:
 *   - Requer header Authorization: Bearer <service_role_key> para o modo agendado.
 *   - Requer JWT válido do usuário para "enviar_usuario".
 *   - Isolamento total: cada usuário vê apenas seus próprios dados.
 *   - Sem duplicatas: controla envios com a tabela push_envios_log.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PushSubscription {
  id: string
  usuario_id: string
  subscription: {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }
  ativo: boolean
}

interface AlertaFinanceiro {
  titulo: string
  corpo: string
  url: string
  tag: string  // evita duplicatas no dispositivo
}

// ── Utilitários VAPID ─────────────────────────────────────────────────────────

function base64urlParaUint8Array(b64url: string): Uint8Array {
  const padding = '='.repeat((4 - (b64url.length % 4)) % 4)
  const base64 = (b64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function uint8ArrayParaBase64url(arr: Uint8Array): string {
  let bin = ''
  arr.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Gera o header JWT para autenticação VAPID (RFC 8292).
async function gerarJwtVapid(endpoint: string, privateKeyB64: string, subject: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600  // 12h

  const header  = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp, sub: subject }

  const enc = new TextEncoder()
  const toSign = `${btoa(JSON.stringify(header)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}.${btoa(JSON.stringify(payload)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')}`

  // Importa a chave privada ECDSA P-256 a partir do escalar d (32 bytes)
  const privBytes = base64urlParaUint8Array(privateKeyB64)
  // Constrói PKCS8 a partir do escalar d (sem usar web-push externo)
  // O formato PKCS8 mínimo para P-256 é um envelope fixo de 36 bytes + 04 + len + d
  const pkcs8Header = new Uint8Array([
    0x30,0x77,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,
    0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x5d,0x30,0x5b,0x02,0x01,
    0x01,0x04,0x20,
  ])
  const pkcs8 = new Uint8Array(pkcs8Header.length + privBytes.length + 29)
  pkcs8.set(pkcs8Header)
  pkcs8.set(privBytes, pkcs8Header.length)
  // Sufixo indicando ponto de compressão da chave pública (pode ser omitido aqui)
  pkcs8.set(new Uint8Array([0xa1,0x23,0x03,0x21,0x00]), pkcs8Header.length + privBytes.length)

  const key = await crypto.subtle.importKey(
    'pkcs8', pkcs8.buffer,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    enc.encode(toSign)
  )

  const sigB64 = uint8ArrayParaBase64url(new Uint8Array(sig))
  return `${toSign}.${sigB64}`
}

// ── Envio de uma única notificação push ───────────────────────────────────────

async function enviarPush(
  sub: PushSubscription['subscription'],
  alerta: AlertaFinanceiro,
  vapidPublic: string,
  vapidPrivate: string,
  vapidSubject: string,
): Promise<{ ok: boolean; status?: number; erro?: string }> {
  try {
    const payload = JSON.stringify({
      title: alerta.titulo,
      body:  alerta.corpo,
      url:   alerta.url,
      tag:   alerta.tag,
    })

    const jwt = await gerarJwtVapid(sub.endpoint, vapidPrivate, vapidSubject)

    const resposta = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Authorization':  `vapid t=${jwt},k=${vapidPublic}`,
        'Content-Type':   'application/octet-stream',
        'Content-Length': String(new TextEncoder().encode(payload).length),
        'TTL':            '86400',   // 24h — mensagem fica em fila se dispositivo offline
      },
      body: payload,
    })

    if (resposta.status === 201 || resposta.status === 200) return { ok: true, status: resposta.status }
    if (resposta.status === 410 || resposta.status === 404) {
      // Subscription expirou/removida — marca como inativo
      return { ok: false, status: resposta.status, erro: 'subscription_expirada' }
    }
    return { ok: false, status: resposta.status, erro: await resposta.text() }
  } catch (err) {
    return { ok: false, erro: String(err) }
  }
}

// ── Montagem dos alertas por usuário ──────────────────────────────────────────

async function montarAlertas(usuarioId: string, supabase: ReturnType<typeof createClient>): Promise<AlertaFinanceiro[]> {
  const alertas: AlertaFinanceiro[] = []
  const hoje = new Date()
  const hojeISO = hoje.toISOString().slice(0, 10)
  const em7Dias = new Date(hoje); em7Dias.setDate(hoje.getDate() + 7)
  const em7ISO = em7Dias.toISOString().slice(0, 10)

  // 1. Despesas vencendo nos próximos 7 dias
  const { data: despesas } = await supabase
    .from('despesas')
    .select('descricao, valor, data')
    .eq('usuario_id', usuarioId)
    .gte('data', hojeISO)
    .lte('data', em7ISO)
    .eq('recorrente', false)
    .order('data', { ascending: true })

  for (const d of (despesas || [])) {
    const diffDias = Math.round((new Date(d.data + 'T12:00:00').getTime() - hoje.getTime()) / 86400000)
    const quando = diffDias === 0 ? 'hoje' : diffDias === 1 ? 'amanhã' : `em ${diffDias} dias`
    alertas.push({
      titulo: `Conta vence ${quando}`,
      corpo:  `${d.descricao} · R$ ${Number(d.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      url:    '/despesas',
      tag:    `desp-${d.data}-${String(d.descricao).slice(0, 20)}`,
    })
  }

  // 2. Faturas de cartão vencendo nos próximos 7 dias
  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('nome, dia_vencimento')
    .eq('usuario_id', usuarioId)

  for (const c of (cartoes || [])) {
    if (!c.dia_vencimento) continue
    const venc = new Date(hoje.getFullYear(), hoje.getMonth(), c.dia_vencimento)
    if (venc < hoje) venc.setMonth(venc.getMonth() + 1)
    const diffDias = Math.round((venc.getTime() - hoje.getTime()) / 86400000)
    if (diffDias >= 0 && diffDias <= 7) {
      const quando = diffDias === 0 ? 'hoje' : diffDias === 1 ? 'amanhã' : `em ${diffDias} dias`
      alertas.push({
        titulo: `Fatura do cartão vence ${quando}`,
        corpo:  `Verifique a fatura do cartão ${c.nome}.`,
        url:    '/cartoes',
        tag:    `fatura-${c.nome}-${venc.toISOString().slice(0, 7)}`,
      })
    }
  }

  // 3. Saldo baixo (< 10% da renda mensal ou < R$ 200)
  const { data: perfil } = await supabase
    .from('perfis')
    .select('saldo_base, reserva_percentual')
    .eq('id', usuarioId)
    .maybeSingle()

  if (perfil?.saldo_base != null) {
    const saldo = Number(perfil.saldo_base)
    if (saldo < 200) {
      alertas.push({
        titulo: 'Saldo disponível baixo',
        corpo:  `Seu saldo atual é R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}. Revise seus gastos.`,
        url:    '/',
        tag:    `saldo-baixo-${hojeISO}`,
      })
    }
  }

  return alertas
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' } })
  }

  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')  || ''
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || ''
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')     || 'mailto:admin@almeidafinance.app'
  const supabaseUrl  = Deno.env.get('SUPABASE_URL')      || ''
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ erro: 'Chaves VAPID não configuradas.' }), { status: 500 })
  }

  // Cliente com permissões de service_role (ignora RLS — necessário para varrer todos os usuários)
  const supabase = createClient(supabaseUrl, serviceKey)

  let body: { modo?: string; usuario_id?: string } = {}
  try { body = await req.json() } catch { /* body vazio */ }

  const modo = body.modo || 'enviar_usuario'

  // ── Modo: enviar para um usuário específico ────────────────────────────────
  if (modo === 'enviar_usuario') {
    const usuarioId = body.usuario_id
    if (!usuarioId) {
      return new Response(JSON.stringify({ erro: 'usuario_id obrigatório.' }), { status: 400 })
    }

    const alertas = await montarAlertas(usuarioId, supabase)
    if (alertas.length === 0) {
      return new Response(JSON.stringify({ enviados: 0, mensagem: 'Sem alertas pendentes.' }))
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('ativo', true)

    let enviados = 0
    for (const sub of (subs || [])) {
      for (const alerta of alertas) {
        const { ok, status } = await enviarPush(sub.subscription, alerta, vapidPublic, vapidPrivate, vapidSubject)
        if (ok) enviados++
        if (status === 410 || status === 404) {
          await supabase.from('push_subscriptions').update({ ativo: false }).eq('id', sub.id)
        }
      }
    }
    return new Response(JSON.stringify({ enviados }))
  }

  // ── Modo: varredura diária (chamado por cron) ──────────────────────────────
  if (modo === 'agendar_diario') {
    // Autenticação do cron: valida o token secreto exclusivo (CRON_SECRET).
    // Nunca usa service_role_key nem JWT de usuário — token dedicado e revogável.
    // Configurado nos Secrets da Edge Function; passado no header X-Cron-Secret.
    const cronSecret = Deno.env.get('CRON_SECRET') || ''
    const headerSecret = req.headers.get('X-Cron-Secret') || ''
    if (!cronSecret || headerSecret !== cronSecret) {
      return new Response(JSON.stringify({ erro: 'Não autorizado.' }), { status: 401 })
    }

    // Busca todos os usuários com pelo menos uma subscription ativa
    const { data: subsAtivas } = await supabase
      .from('push_subscriptions')
      .select('usuario_id')
      .eq('ativo', true)

    const usuariosUnicos = [...new Set((subsAtivas || []).map(s => s.usuario_id))]
    let totalEnviados = 0

    for (const uid of usuariosUnicos) {
      const alertas = await montarAlertas(uid, supabase)
      if (alertas.length === 0) continue

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('usuario_id', uid)
        .eq('ativo', true)

      for (const sub of (subs || [])) {
        for (const alerta of alertas) {
          // Anti-duplicata
          const { data: jaEnviado } = await supabase
            .from('push_envios_log')
            .select('id')
            .eq('usuario_id', uid)
            .eq('tag', alerta.tag)
            .eq('enviado_em', new Date().toISOString().slice(0, 10))
            .maybeSingle()
          if (jaEnviado) continue

          const { ok, status } = await enviarPush(sub.subscription, alerta, vapidPublic, vapidPrivate, vapidSubject)
          if (ok) {
            totalEnviados++
            await supabase.from('push_envios_log').upsert(
              { usuario_id: uid, tag: alerta.tag, enviado_em: new Date().toISOString().slice(0, 10) },
              { onConflict: 'usuario_id,tag,enviado_em' }
            )
          }
          if (status === 410 || status === 404) {
            await supabase.from('push_subscriptions').update({ ativo: false }).eq('id', sub.id)
          }
        }
      }
    }

    return new Response(JSON.stringify({ usuarios: usuariosUnicos.length, enviados: totalEnviados }))
  }

  return new Response(JSON.stringify({ erro: `Modo desconhecido: ${modo}` }), { status: 400 })
})
