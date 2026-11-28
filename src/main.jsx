import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Atualiza o worker existente sem apagar dados nem forçar reload durante edição.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const verificarWorker = async () => {
    try {
      const registro = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      await registro.update()
    } catch { /* A indisponibilidade do worker não impede o uso online. */ }
  }
  window.addEventListener('load', verificarWorker, { once: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') verificarWorker()
  })
}
