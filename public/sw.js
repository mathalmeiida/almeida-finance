// ============================================================
// Almeida Finance — Service Worker v4
// Gerencia push notifications no background.
// v4: corrige SimuladorCustoVida para incluir 100% das despesas.
// NÃO faz cache agressivo de assets — o Vite/Vercel gerencia isso via
// content-hash. Apenas garante que o SW antigo seja substituído.
// ============================================================

const SW_VERSION  = 'v4'
const APP_NAME    = 'Almeida Finance'
const APP_ICON    = '/branding/icon-192.png'
const APP_URL     = self.location.origin

// ── Push handler ─────────────────────────────────────────────────────────────
// Recebe a notificação do servidor, extrai os dados e exibe.
// Formato esperado do payload (JSON):
// {
//   title:  "Vencimento amanhã",
//   body:   "Aluguel R$ 1.800,00 vence em 05/11",
//   url:    "/despesas",       // rota para abrir ao clicar (opcional)
//   tag:    "venc-despesa-42"  // evita duplicatas — mesmo tag substitui anterior
// }
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try { data = event.data.json() } catch { data = { title: APP_NAME, body: event.data.text() } }

  const title = data.title || APP_NAME
  const options = {
    body:    data.body  || 'Você tem uma notificação financeira.',
    icon:    APP_ICON,
    badge:   APP_ICON,
    tag:     data.tag   || 'af-notif',   // substitui anterior com o mesmo tag
    renotify: false,                      // não toca som se já existia
    data:    { url: data.url || '/' },
    vibrate: [150, 50, 100],
    actions: [
      { action: 'open',    title: 'Ver agora' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Click handler ─────────────────────────────────────────────────────────────
// Ao clicar na notificação, foca a aba existente ou abre uma nova na URL correta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const url = (event.notification.data?.url)
    ? new URL(event.notification.data.url, APP_URL).href
    : APP_URL

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Foca aba já aberta do app, se existir
        for (const client of clients) {
          if (client.url.startsWith(APP_URL) && 'focus' in client) {
            client.navigate(url)
            return client.focus()
          }
        }
        // Senão, abre nova aba
        if (self.clients.openWindow) return self.clients.openWindow(url)
      })
  )
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────
// skipWaiting: o novo SW v3 toma controle imediatamente (sem esperar abas fecharem).
// Isso garante que os novos ícones sejam servidos assim que o usuário recarregar.
self.addEventListener('install', (e) => {
  console.log(`[SW] ${SW_VERSION} instalando`)
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  console.log(`[SW] ${SW_VERSION} ativado`)
  // Limpa caches antigos de ícones/assets que possam ter sido criados por
  // versões anteriores do SW, sem apagar dados do usuário (Supabase cuida disso).
  e.waitUntil(
    caches.keys().then(nomes =>
      Promise.all(
        nomes
          .filter(n => n.startsWith('af-assets-') && n !== `af-assets-${SW_VERSION}`)
          .map(n => {
            console.log(`[SW] Removendo cache antigo: ${n}`)
            return caches.delete(n)
          })
      )
    ).then(() => self.clients.claim())
  )
})
