import React, { useState, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { hojeISO, partesHojeBrasil } from '../lib/utils'

/**
 * Componente de filtro de período padronizado
 * 
 * Uso:
 * const [periodo, setPeriodo] = useState({
 *   tipo: 'mes-atual',
 *   inicio: '2026-01-01',
 *   fim: '2026-01-31'
 * })
 * 
 * <FiltroPeriodo
 *   valor={periodo}
 *   onChange={setPeriodo}
 *   opcoes={['mes-atual', 'mes-anterior', 'ultimos-3-meses', 'personalizado']}
 * />
 */

const OPCOES_PERIODO = {
  'mes-atual': {
    label: 'Mês atual',
    calcular: () => {
      const { ano, mes } = partesHojeBrasil()
      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
      return { inicio, fim }
    }
  },
  'mes-anterior': {
    label: 'Mês anterior',
    calcular: () => {
      const { ano, mes } = partesHojeBrasil()
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anoAnterior = mes === 1 ? ano - 1 : ano
      const inicio = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`
      const ultimoDia = new Date(anoAnterior, mesAnterior, 0).getDate()
      const fim = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
      return { inicio, fim }
    }
  },
  'ultimos-3-meses': {
    label: 'Últimos 3 meses',
    calcular: () => {
      const hoje = hojeISO()
      const data3MesesAtras = new Date()
      data3MesesAtras.setMonth(data3MesesAtras.getMonth() - 3)
      const inicio = data3MesesAtras.toISOString().split('T')[0]
      return { inicio, fim: hoje }
    }
  },
  'ultimos-6-meses': {
    label: 'Últimos 6 meses',
    calcular: () => {
      const hoje = hojeISO()
      const data6MesesAtras = new Date()
      data6MesesAtras.setMonth(data6MesesAtras.getMonth() - 6)
      const inicio = data6MesesAtras.toISOString().split('T')[0]
      return { inicio, fim: hoje }
    }
  },
  'este-ano': {
    label: 'Este ano',
    calcular: () => {
      const { ano } = partesHojeBrasil()
      const inicio = `${ano}-01-01`
      const fim = `${ano}-12-31`
      return { inicio, fim }
    }
  },
  'personalizado': {
    label: 'Período personalizado',
    calcular: () => {
      const hoje = hojeISO()
      return { inicio: hoje, fim: hoje }
    }
  }
}

export default function FiltroPeriodo({ 
  valor, 
  onChange, 
  opcoes = ['mes-atual', 'mes-anterior', 'personalizado'],
  mostrarNavegacao = true 
}) {
  const [modoPersonalizado, setModoPersonalizado] = useState(false)

  const opcoesDisponiveis = useMemo(() => {
    return opcoes.map(id => ({
      id,
      ...OPCOES_PERIODO[id]
    }))
  }, [opcoes])

  const handleChangeTipo = (novoTipo) => {
    if (novoTipo === 'personalizado') {
      setModoPersonalizado(true)
      onChange({
        tipo: novoTipo,
        inicio: valor.inicio,
        fim: valor.fim
      })
    } else {
      setModoPersonalizado(false)
      const { inicio, fim } = OPCOES_PERIODO[novoTipo].calcular()
      onChange({
        tipo: novoTipo,
        inicio,
        fim
      })
    }
  }

  const handleChangePeriodoPersonalizado = (campo, novoValor) => {
    onChange({
      ...valor,
      [campo]: novoValor
    })
  }

  // Navegação de mês (anterior/próximo)
  const handleNavegar = (direcao) => {
    const [ano, mes] = valor.inicio.split('-').map(Number)
    const novoMes = direcao === 'proximo' ? mes + 1 : mes - 1
    const novoAno = novoMes > 12 ? ano + 1 : novoMes < 1 ? ano - 1 : ano
    const mesFinal = novoMes > 12 ? 1 : novoMes < 1 ? 12 : novoMes

    const inicio = `${novoAno}-${String(mesFinal).padStart(2, '0')}-01`
    const ultimoDia = new Date(novoAno, mesFinal, 0).getDate()
    const fim = `${novoAno}-${String(mesFinal).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

    onChange({
      tipo: 'mes-atual', // Reseta para mês atual
      inicio,
      fim
    })
  }

  return (
    <div className="space-y-3">
      {/* Seletor de tipo de período */}
      <div className="flex items-center gap-2 flex-wrap">
        {opcoesDisponiveis.map((opcao) => (
          <button
            key={opcao.id}
            type="button"
            onClick={() => handleChangeTipo(opcao.id)}
            className={`
              px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${valor.tipo === opcao.id
                ? 'bg-marca text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {opcao.label}
          </button>
        ))}
      </div>

      {/* Navegação de mês (se aplicável) */}
      {mostrarNavegacao && !modoPersonalizado && valor.tipo === 'mes-atual' && (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleNavegar('anterior')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar size={16} />
            <span>
              {new Date(valor.inicio + 'T12:00:00').toLocaleDateString('pt-BR', {
                month: 'long',
                year: 'numeric'
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleNavegar('proximo')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Próximo mês"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Campos de data personalizada */}
      {modoPersonalizado && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs">Data inicial</label>
            <input
              type="date"
              value={valor.inicio}
              onChange={(e) => handleChangePeriodoPersonalizado('inicio', e.target.value)}
              className="input text-sm"
            />
          </div>
          <div>
            <label className="label text-xs">Data final</label>
            <input
              type="date"
              value={valor.fim}
              onChange={(e) => handleChangePeriodoPersonalizado('fim', e.target.value)}
              className="input text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Hook auxiliar para gerenciar estado do filtro
 * 
 * const { periodo, setPeriodo, filtrarDados } = useFiltroPeriodo('mes-atual')
 */
export function useFiltroPeriodo(tipoInicial = 'mes-atual') {
  const [periodo, setPeriodo] = useState(() => {
    const { inicio, fim } = OPCOES_PERIODO[tipoInicial].calcular()
    return { tipo: tipoInicial, inicio, fim }
  })

  const filtrarDados = (dados, campoData = 'data') => {
    return dados.filter(item => {
      const data = item[campoData]
      if (!data) return false
      return data >= periodo.inicio && data <= periodo.fim
    })
  }

  return { periodo, setPeriodo, filtrarDados }
}
