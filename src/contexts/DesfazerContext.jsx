import React, { createContext, useContext, useState, useCallback, useRef } from 'react'

const DesfazerContext = createContext()

const TEMPO_EXPIRACAO = 10000 // 10 segundos

export function DesfazerProvider({ children }) {
  const [acaoAtual, setAcaoAtual] = useState(null)
  const timeoutRef = useRef(null)

  const limparTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const expirar = useCallback(() => {
    setAcaoAtual(null)
    limparTimeout()
  }, [limparTimeout])

  const registrarAcao = useCallback((acao) => {
    limparTimeout()
    
    setAcaoAtual({
      ...acao,
      timestamp: Date.now()
    })

    timeoutRef.current = setTimeout(expirar, TEMPO_EXPIRACAO)
  }, [limparTimeout, expirar])

  const desfazer = useCallback(async () => {
    if (!acaoAtual || !acaoAtual.desfazer) return false

    try {
      await acaoAtual.desfazer()
      setAcaoAtual(null)
      limparTimeout()
      return true
    } catch (err) {
      console.error('[Desfazer] Erro:', err)
      return false
    }
  }, [acaoAtual, limparTimeout])

  const cancelar = useCallback(() => {
    setAcaoAtual(null)
    limparTimeout()
  }, [limparTimeout])

  return (
    <DesfazerContext.Provider value={{ acaoAtual, desfazer, cancelar, registrarAcao }}>
      {children}
    </DesfazerContext.Provider>
  )
}

export function useDesfazer() {
  const context = useContext(DesfazerContext)
  if (!context) {
    throw new Error('useDesfazer deve ser usado dentro de DesfazerProvider')
  }
  return context
}
