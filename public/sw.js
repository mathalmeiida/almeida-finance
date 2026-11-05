// ============================================================
// Almeida Finance — Service Worker
// Gerencia push notifications no background.
// NÃO modifica cache, rotas nem qualquer lógica do app.
// ============================================================

const APP_NAME = 'Almeida Finance'
const APP_ICON = '/branding/af-icone.png'
const APP_URL  = self.location.origin

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
// Ativa imediatamente sem esperar abas fecharem.
self.addEventListener('install',  () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
