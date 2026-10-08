import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { definirOcultarValoresGlobal } from '../lib/utils'

// Controla a preferência de OCULTAR os valores financeiros na interface.
// É apenas visual — não altera nenhum cálculo ou dado. A preferência é mantida
// durante a utilização (localStorage), persistindo entre reloads.
const OcultarValoresContext = createContext(null)

const CHAVE = 'almeida_valores_ocultos'

export function OcultarValoresProvider({ children }) {
  const [ocultar, setOcultar] = useState(() => {
    try { return localStorage.getItem(CHAVE) === '1' } catch { return false }
  })

  // Sincroniza o estado global que o formatCurrency() consulta, para que TODA
  // exibição de moeda no app seja mascarada/revelada de uma vez. Feito de forma
  // síncrona na renderização (não em efeito) para já valer no 1º paint após um
  // reload com a preferência ativa.
  definirOcultarValoresGlobal(ocultar)

  useEffect(() => {
    definirOcultarValoresGlobal(ocultar)
    try { localStorage.setItem(CHAVE, ocultar ? '1' : '0') } catch { /* ignora */ }
  }, [ocultar])

  const alternar = useCallback(() => setOcultar(v => !v), [])

  return (
    <OcultarValoresContext.Provider value={{ ocultar, alternar }}>
      {children}
    </OcultarValoresContext.Provider>
  )
}

export function useOcultarValores() {
  const ctx = useContext(OcultarValoresContext)
  // Fallback seguro se usado fora do provider (não quebra a tela).
  if (!ctx) return { ocultar: false, alternar: () => {} }
  return ctx
}
