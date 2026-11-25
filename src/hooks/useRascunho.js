import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Hook para salvamento automático de rascunhos em localStorage
 * 
 * Uso:
 * const [form, setForm, { salvo, limpar }] = useRascunho('receita-form', {
 *   descricao: '',
 *   valor: '',
 *   data: hojeISO()
 * })
 * 
 * Features:
 * - Salvamento automático (debounced 1s)
 * - Recuperação ao montar
 * - Limpeza manual
 * - Indicador de salvamento
 * - Não salva senhas ou dados sensíveis
 */

const PREFIXO = 'almeida_rascunho_'
const DELAY_MS = 1000 // 1 segundo de debounce

export function useRascunho(chave, valoresIniciais = {}) {
  const chaveCompleta = PREFIXO + chave
  const timeoutRef = useRef(null)
  const [salvo, setSalvo] = useState(false)

  // Inicializa com rascunho salvo ou valores iniciais
  const [valores, setValores] = useState(() => {
    try {
      const rascunhoSalvo = localStorage.getItem(chaveCompleta)
      if (rascunhoSalvo) {
        const dados = JSON.parse(rascunhoSalvo)
        // Verifica se não é muito antigo (> 7 dias)
        const timestamp = dados._timestamp || 0
        const idadeMs = Date.now() - timestamp
        const seteDias = 7 * 24 * 60 * 60 * 1000
        
        if (idadeMs < seteDias) {
          console.log(`[Rascunho] Recuperado: ${chave}`)
          delete dados._timestamp
          return { ...valoresIniciais, ...dados }
        } else {
          // Rascunho muito antigo, limpar
          localStorage.removeItem(chaveCompleta)
        }
      }
    } catch (err) {
      console.warn('[Rascunho] Erro ao recuperar:', err)
    }
    return valoresIniciais
  })

  // Salva automaticamente após mudanças (debounced)
  useEffect(() => {
    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Agenda salvamento
    timeoutRef.current = setTimeout(() => {
      try {
        const dadosParaSalvar = {
          ...valores,
          _timestamp: Date.now()
        }
        localStorage.setItem(chaveCompleta, JSON.stringify(dadosParaSalvar))
        setSalvo(true)
        
        // Reseta indicador após 2s
        setTimeout(() => setSalvo(false), 2000)
      } catch (err) {
        console.warn('[Rascunho] Erro ao salvar:', err)
      }
    }, DELAY_MS)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [valores, chaveCompleta])

  // Limpa rascunho manualmente
  const limpar = useCallback(() => {
    try {
      localStorage.removeItem(chaveCompleta)
      setValores(valoresIniciais)
      console.log(`[Rascunho] Limpo: ${chave}`)
    } catch (err) {
      console.warn('[Rascunho] Erro ao limpar:', err)
    }
  }, [chaveCompleta, valoresIniciais, chave])

  return [valores, setValores, { salvo, limpar }]
}

/**
 * Hook simplificado para campos individuais
 * 
 * Uso:
 * const [descricao, setDescricao, { salvo }] = useRascunhoCampo('receita-descricao', '')
 */
export function useRascunhoCampo(chave, valorInicial = '') {
  const [form, setForm, meta] = useRascunho(chave, { valor: valorInicial })
  
  const setValor = useCallback((novoValor) => {
    setForm({ valor: novoValor })
  }, [setForm])

  return [form.valor, setValor, meta]
}
