import { useCallback, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { normalizarConfigAtalhos, configPadraoAtalhos } from '../lib/atalhosHome'

// Preferência dos atalhos da Home, por usuário.
// Fonte: perfis.atalhos_home (Supabase) quando a coluna existe e está
// preenchida; senão, cópia local no localStorage (mesmo dispositivo).
// Sempre usa o perfil REAL do logado — no modo consultoria não lê nem grava
// a preferência do cliente.
function chaveLocal(userId) {
  return `almeida_atalhos_home_${userId || 'anon'}`
}

function lerLocal(userId) {
  try {
    const bruto = localStorage.getItem(chaveLocal(userId))
    return bruto ? JSON.parse(bruto) : null
  } catch {
    return null
  }
}

export function useAtalhosHome() {
  const { usuario, perfilProprio, atualizarAtalhosHome, somenteLeitura } = useAuth()
  const userId = usuario?.id
  // Força releitura do localStorage após salvar (quando o banco não aceita).
  const [versaoLocal, setVersaoLocal] = useState(0)

  const config = useMemo(() => {
    const doBanco = perfilProprio?.atalhos_home
    if (doBanco && typeof doBanco === 'object') return normalizarConfigAtalhos(doBanco)
    const local = lerLocal(userId)
    return local ? normalizarConfigAtalhos(local) : configPadraoAtalhos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilProprio?.atalhos_home, userId, versaoLocal])

  const salvar = useCallback(async (nova) => {
    if (somenteLeitura) return { ok: false, noServidor: false }
    const normalizada = normalizarConfigAtalhos(nova)
    try { localStorage.setItem(chaveLocal(userId), JSON.stringify(normalizada)) } catch { /* ignora */ }
    setVersaoLocal(v => v + 1)
    const noServidor = await atualizarAtalhosHome(normalizada)
    return { ok: true, noServidor }
  }, [somenteLeitura, userId, atualizarAtalhosHome])

  return { config, salvar }
}
