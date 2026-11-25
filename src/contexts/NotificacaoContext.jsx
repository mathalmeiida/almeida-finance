import React, { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'

/**
 * Sistema de notificações globais (toast)
 * 
 * Tipos:
 * - sucesso: confirmações de ações bem-sucedidas
 * - erro: problemas e falhas
 * - aviso: alertas e avisos
 * - info: informações gerais
 * 
 * Uso:
 * const { notificar } = useNotificacao()
 * notificar.sucesso('Receita cadastrada')
 * notificar.erro('Não conseguimos salvar. Tente novamente')
 */

const NotificacaoContext = createContext(null)

export function NotificacaoProvider({ children }) {
  const [notificacoes, setNotificacoes] = useState([])

  const remover = useCallback((id) => {
    setNotificacoes(prev => prev.filter(n => n.id !== id))
  }, [])

  const adicionar = useCallback((tipo, mensagem, duracao = 4000) => {
    const id = Date.now() + Math.random()
    
    setNotificacoes(prev => [...prev, { id, tipo, mensagem }])

    // Auto-remover após duração
    if (duracao > 0) {
      setTimeout(() => remover(id), duracao)
    }

    return id
  }, [remover])

  const notificar = {
    sucesso: (msg, duracao) => adicionar('sucesso', msg, duracao),
    erro: (msg, duracao) => adicionar('erro', msg, duracao),
    aviso: (msg, duracao) => adicionar('aviso', msg, duracao),
    info: (msg, duracao) => adicionar('info', msg, duracao),
  }

  return (
    <NotificacaoContext.Provider value={{ notificar, remover }}>
      {children}
      <Notificacoes notificacoes={notificacoes} onRemover={remover} />
    </NotificacaoContext.Provider>
  )
}

export function useNotificacao() {
  const ctx = useContext(NotificacaoContext)
  if (!ctx) {
    // Fallback seguro se usado fora do provider
    return {
      notificar: {
        sucesso: () => {},
        erro: () => {},
        aviso: () => {},
        info: () => {},
      },
      remover: () => {},
    }
  }
  return ctx
}

// Componente de exibição das notificações
function Notificacoes({ notificacoes, onRemover }) {
  if (notificacoes.length === 0) return null

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      {notificacoes.map((notificacao) => (
        <Notificacao
          key={notificacao.id}
          notificacao={notificacao}
          onRemover={onRemover}
        />
      ))}
    </div>
  )
}

function Notificacao({ notificacao, onRemover }) {
  const { id, tipo, mensagem } = notificacao

  const configs = {
    sucesso: {
      Icon: CheckCircle2,
      classe: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    erro: {
      Icon: XCircle,
      classe: 'bg-red-50 border-red-200 text-red-700',
    },
    aviso: {
      Icon: AlertCircle,
      classe: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    info: {
      Icon: Info,
      classe: 'bg-blue-50 border-blue-200 text-blue-700',
    },
  }

  const config = configs[tipo] || configs.info
  const { Icon, classe } = config

  return (
    <div
      className={`
        pointer-events-auto
        flex items-start gap-3 
        rounded-xl border px-4 py-3 
        shadow-lg
        animate-in slide-in-from-right-5 duration-300
        ${classe}
      `}
      role="alert"
      aria-live="polite"
    >
      <Icon size={18} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-sm font-medium flex-1 min-w-0 break-words">
        {mensagem}
      </span>
      <button
        type="button"
        onClick={() => onRemover(id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Fechar notificação"
      >
        <X size={16} />
      </button>
    </div>
  )
}
