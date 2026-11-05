/**
 * usePushNotificacoes — gerencia o ciclo completo de Web Push no Almeida Finance.
 *
 * Responsabilidades:
 *  1. Detectar suporte e plataforma (iOS/Android/Desktop).
 *  2. Detectar se o app está instalado como PWA (necessário no iOS 16.4+).
 *  3. Registrar/desregistrar o service worker.
 *  4. Solicitar permissão SOMENTE após clique explícito do usuário.
 *  5. Criar/deletar a PushSubscription no navegador.
 *  6. Persistir/remover a subscription na tabela push_subscriptions do Supabase.
 *  7. Nunca tentar contornar permissões do sistema.
 *
 * Não modifica cálculos financeiros, autenticação ou qualquer outra área.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// VAPID public key (configurada em .env.local como VITE_VAPID_PUBLIC_KEY).
// Sem ela, push funciona em teste local mas não em produção.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

const SW_PATH = '/sw.js'

// Converte a VAPID public key de base64url para Uint8Array
// (formato exigido pela PushManager.subscribe).
function base64urlParaUint8Array(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// ── Detecção de plataforma ──────────────────────────────────────────────────
function detectarPlataforma() {
  const ua = navigator.userAgent || ''
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  if (/android/i.test(ua))           return 'android'
  return 'desktop'
}

function detectarEhiOS() {
  return detectarPlataforma() === 'ios'
}

// iOS 16.4+ suporta push SOMENTE quando instalado como PWA (add to home screen).
// Detecta pelo modo de display: "standalone" = instalado.
function detectarInstalado() {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator?.standalone === true   // Safari legacy
}

// Suporte real ao Web Push: requer SW + PushManager + Notification.
// iOS: requer instalação como PWA (standalone).
function detectarSuportePush() {
  if (typeof window === 'undefined') return false
  const temAPI = 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  if (!temAPI) return false
  // iOS: só funciona instalado
  if (detectarEhiOS()) return detectarInstalado()
  return true
}

// ── Hook principal ──────────────────────────────────────────────────────────
export function usePushNotificacoes() {
  const { usuario } = useAuth()

  // Estado da permissão atual do navegador
  const [permissao, setPermissao]     = useState(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission   // 'default' | 'granted' | 'denied'
  })

  // true = subscription ativa e gravada no banco
  const [ativado, setAtivado]         = useState(false)
  const [carregando, setCarregando]   = useState(false)
  const [erro, setErro]               = useState(null)

  const suportado  = detectarSuportePush()
  const ehiOS      = detectarEhiOS()
  const instalado  = detectarInstalado()
  const plataforma = detectarPlataforma()

  // Verifica se já há subscription ativa para este dispositivo no banco.
  useEffect(() => {
    if (!usuario?.id || !suportado) return
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (!sub) { setAtivado(false); return }

        const { data } = await supabase
          .from('push_subscriptions')
          .select('id, ativo')
          .eq('endpoint', sub.endpoint)
          .eq('usuario_id', usuario.id)
          .maybeSingle()

        setAtivado(!!data?.ativo)
      } catch { setAtivado(false) }
    })()
  }, [usuario?.id, suportado])

  // ── Registrar service worker ─────────────────────────────────────────────
  async function registrarSW() {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker não suportado.')
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: '/' })
    // Aguarda o SW estar pronto (importante no primeiro registro)
    await navigator.serviceWorker.ready
    return reg
  }

  // ── Ativar notificações ──────────────────────────────────────────────────
  // Chamado SOMENTE após clique explícito do usuário. Nunca chamado
  // automaticamente. Solicita permissão, cria PushSubscription e grava no banco.
  const ativar = useCallback(async () => {
    if (!usuario?.id)  throw new Error('Usuário não autenticado.')
    if (!suportado)    throw new Error('Notificações push não suportadas neste dispositivo.')
    if (carregando)    return

    setCarregando(true)
    setErro(null)
    try {
      // 1. Registrar service worker
      const reg = await registrarSW()

      // 2. Solicitar permissão (diálogo nativo do sistema)
      const resultado = await Notification.requestPermission()
      setPermissao(resultado)

      if (resultado !== 'granted') {
        throw new Error(
          resultado === 'denied'
            ? 'Permissão negada. Ative as notificações nas configurações do navegador.'
            : 'Permissão não concedida.'
        )
      }

      // 3. Criar PushSubscription no navegador
      if (!VAPID_PUBLIC_KEY) {
        // Sem VAPID key, registramos permissão mas não conseguimos enviar pelo servidor.
        // Útil para testes locais.
        console.warn('[Push] VITE_VAPID_PUBLIC_KEY não configurada. Subscription não criada.')
        setAtivado(true)
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:     true,
        applicationServerKey: base64urlParaUint8Array(VAPID_PUBLIC_KEY),
      })

      // 4. Gravar no Supabase (upsert por endpoint — sem duplicatas)
      const subJSON = sub.toJSON()
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          usuario_id:   usuario.id,
          subscription: subJSON,
          endpoint:     sub.endpoint,
          user_agent:   navigator.userAgent?.slice(0, 500) || '',
          plataforma,
          ativo:        true,
        }, { onConflict: 'endpoint' })

      if (error) throw error

      setAtivado(true)
    } catch (err) {
      setErro(err.message || 'Não foi possível ativar as notificações.')
      throw err
    } finally {
      setCarregando(false)
    }
  }, [usuario?.id, suportado, carregando, plataforma])

  // ── Desativar notificações ───────────────────────────────────────────────
  const desativar = useCallback(async () => {
    if (!usuario?.id) return
    setCarregando(true)
    setErro(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()

      // Marca como inativo no banco (preserva o registro histórico)
      if (sub) {
        await supabase
          .from('push_subscriptions')
          .update({ ativo: false })
          .eq('endpoint', sub.endpoint)
          .eq('usuario_id', usuario.id)

        await sub.unsubscribe()
      }

      setAtivado(false)
    } catch (err) {
      setErro(err.message || 'Não foi possível desativar as notificações.')
    } finally {
      setCarregando(false)
    }
  }, [usuario?.id])

  return {
    // Estado
    suportado,
    ativado,
    permissao,
    carregando,
    erro,
    // Informações de plataforma (usadas pela UI para guiar o usuário)
    ehiOS,
    instalado,
    plataforma,
    // Ações
    ativar,
    desativar,
  }
}
