import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { definirOcultarValoresGlobal } from '../lib/utils'
import { supabase } from '../lib/supabase'

// Controla a preferência de OCULTAR os valores financeiros na interface.
// É apenas visual — não altera nenhum cálculo ou dado. A preferência é mantida
// durante a utilização (localStorage), persistindo entre reloads, e sincronizada
// com o banco de dados para funcionar entre dispositivos.
const OcultarValoresContext = createContext(null)

const CHAVE = 'almeida_valores_ocultos'

export function OcultarValoresProvider({ children }) {
  const [ocultar, setOcultar] = useState(() => {
    try { return localStorage.getItem(CHAVE) === '1' } catch { return false }
  })
  const [sincronizando, setSincronizando] = useState(false)

  // Sincroniza o estado global que o formatCurrency() consulta, para que TODA
  // exibição de moeda no app seja mascarada/revelada de uma vez. Feito de forma
  // síncrona na renderização (não em efeito) para já valer no 1º paint após um
  // reload com a preferência ativa.
  definirOcultarValoresGlobal(ocultar)

  // Carrega preferência do banco ao montar
  useEffect(() => {
    const carregarPreferencia = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('perfis')
          .select('preferencias')
          .eq('id', user.id)
          .single()

        if (error) throw error

        if (data?.preferencias?.valores_ocultos !== undefined) {
          const valorBanco = data.preferencias.valores_ocultos
          setOcultar(valorBanco)
          localStorage.setItem(CHAVE, valorBanco ? '1' : '0')
        }
      } catch (err) {
        console.warn('[OcultarValores] Erro ao carregar preferência:', err)
      }
    }

    carregarPreferencia()
  }, [])

  // Salva no localStorage e banco quando muda
  useEffect(() => {
    definirOcultarValoresGlobal(ocultar)
    
    // Salva no localStorage
    try { 
      localStorage.setItem(CHAVE, ocultar ? '1' : '0') 
    } catch { /* ignora */ }

    // Salva no banco (debounced para evitar múltiplas escritas)
    const salvarNoBanco = async () => {
      setSincronizando(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // Busca preferências atuais
        const { data: perfil } = await supabase
          .from('perfis')
          .select('preferencias')
          .eq('id', user.id)
          .single()

        // Merge com nova preferência
        const prefsAtualizadas = {
          ...(perfil?.preferencias || {}),
          valores_ocultos: ocultar
        }

        const { error } = await supabase
          .from('perfis')
          .update({ preferencias: prefsAtualizadas })
          .eq('id', user.id)

        if (error) throw error
      } catch (err) {
        console.warn('[OcultarValores] Erro ao salvar preferência:', err)
      } finally {
        setSincronizando(false)
      }
    }

    const timeout = setTimeout(salvarNoBanco, 500)
    return () => clearTimeout(timeout)
  }, [ocultar])

  const alternar = useCallback(() => setOcultar(v => !v), [])

  return (
    <OcultarValoresContext.Provider value={{ ocultar, alternar, sincronizando }}>
      {children}
    </OcultarValoresContext.Provider>
  )
}

export function useOcultarValores() {
  const ctx = useContext(OcultarValoresContext)
  // Fallback seguro se usado fora do provider (não quebra a tela).
  if (!ctx) return { ocultar: false, alternar: () => {}, sincronizando: false }
  return ctx
}
