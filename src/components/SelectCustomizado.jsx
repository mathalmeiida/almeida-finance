import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Select customizado acessível para substituir <select> nativo.
 * 
 * Resolve problemas visuais de sobreposição e cortes no dropdown nativo,
 * especialmente em iPhone/Safari e Android.
 * 
 * Features:
 * - Dropdown controlado sem overflow/z-index issues
 * - Navegação por teclado (↑↓ Enter Escape)
 * - Foco visível (acessibilidade)
 * - Fecha ao clicar fora
 * - Altura mínima 44px (touch-friendly)
 * - Font-size 16px no mobile (previne zoom iOS)
 * - Paleta vinho atual
 * 
 * @param {Object} props
 * @param {string} props.id - ID para label (acessibilidade)
 * @param {string} props.value - Valor selecionado
 * @param {function} props.onChange - Callback (value) => void
 * @param {Array} props.options - [{ value, label }, ...]
 * @param {string} props.placeholder - Texto quando vazio
 * @param {boolean} props.disabled - Desabilita o select
 * @param {string} props.className - Classes CSS adicionais
 */
export default function SelectCustomizado({
  id,
  value,
  onChange,
  options = [],
  placeholder = 'Selecione...',
  disabled = false,
  className = '',
}) {
  const [aberto, setAberto] = useState(false)
  const [focoIndice, setFocoIndice] = useState(-1)
  const containerRef = useRef(null)
  const listaRef = useRef(null)

  const selecionada = options.find(opt => opt.value === value)
  const textoVisivel = selecionada?.label || placeholder

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return
    
    function handleClickFora(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAberto(false)
        setFocoIndice(-1)
      }
    }

    document.addEventListener('mousedown', handleClickFora)
    document.addEventListener('touchstart', handleClickFora)
    
    return () => {
      document.removeEventListener('mousedown', handleClickFora)
      document.removeEventListener('touchstart', handleClickFora)
    }
  }, [aberto])

  // Scroll automático para opção focada
  useEffect(() => {
    if (aberto && focoIndice >= 0 && listaRef.current) {
      const opcao = listaRef.current.children[focoIndice]
      if (opcao) {
        opcao.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focoIndice, aberto])

  function toggleAberto() {
    if (disabled) return
    setAberto(!aberto)
    if (!aberto) {
      // Ao abrir, foca a opção selecionada
      const indice = options.findIndex(opt => opt.value === value)
      setFocoIndice(indice >= 0 ? indice : 0)
    } else {
      setFocoIndice(-1)
    }
  }

  function selecionar(opcao) {
    if (disabled) return
    onChange(opcao.value)
    setAberto(false)
    setFocoIndice(-1)
  }

  function handleKeyDown(e) {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!aberto) {
          toggleAberto()
        } else if (focoIndice >= 0) {
          selecionar(options[focoIndice])
        }
        break

      case 'Escape':
        e.preventDefault()
        setAberto(false)
        setFocoIndice(-1)
        break

      case 'ArrowDown':
        e.preventDefault()
        if (!aberto) {
          toggleAberto()
        } else {
          setFocoIndice(prev => Math.min(prev + 1, options.length - 1))
        }
        break

      case 'ArrowUp':
        e.preventDefault()
        if (aberto) {
          setFocoIndice(prev => Math.max(prev - 1, 0))
        }
        break

      case 'Home':
        if (aberto) {
          e.preventDefault()
          setFocoIndice(0)
        }
        break

      case 'End':
        if (aberto) {
          e.preventDefault()
          setFocoIndice(options.length - 1)
        }
        break

      default:
        // Navegação por letra (primeira que coincide)
        if (aberto && e.key.length === 1) {
          const letra = e.key.toLowerCase()
          const indice = options.findIndex((opt, i) =>
            i > focoIndice && opt.label.toLowerCase().startsWith(letra)
          )
          if (indice >= 0) {
            setFocoIndice(indice)
          }
        }
        break
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      data-testid={id ? `${id}-container` : 'select-container'}
    >
      {/* Botão de ativação (substitui o <select>) */}
      <button
        type="button"
        id={id}
        onClick={toggleAberto}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-labelledby={id ? `${id}-label` : undefined}
        className={`
          w-full bg-white border rounded-lg px-3 py-2
          flex items-center justify-between gap-2
          text-left transition-colors
          ${disabled
            ? 'border-gray-200 text-gray-400 cursor-not-allowed'
            : aberto
            ? 'border-marca ring-2 ring-marca focus:outline-none'
            : 'border-gray-300 text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-marca focus:border-transparent'
          }
        `}
        style={{
          minHeight: '44px',
          fontSize: '16px',
          lineHeight: '1.5',
        }}
      >
        <span className={`truncate ${!selecionada ? 'text-gray-400' : ''}`}>
          {textoVisivel}
        </span>
        <ChevronDown
          size={16}
          className={`flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''} ${disabled ? 'text-gray-300' : 'text-gray-500'}`}
        />
      </button>

      {/* Dropdown (lista de opções) */}
      {aberto && !disabled && (
        <div
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
          style={{ maxHeight: '280px' }}
        >
          <ul
            ref={listaRef}
            role="listbox"
            aria-labelledby={id ? `${id}-label` : undefined}
            tabIndex={-1}
            className="overflow-y-auto"
            style={{ maxHeight: '280px' }}
          >
            {options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">
                Nenhuma opção disponível
              </li>
            ) : (
              options.map((opcao, indice) => {
                const estaSelecionada = opcao.value === value
                const estaFocada = indice === focoIndice

                return (
                  <li
                    key={opcao.value}
                    role="option"
                    aria-selected={estaSelecionada}
                    onClick={() => selecionar(opcao)}
                    onMouseEnter={() => setFocoIndice(indice)}
                    className={`
                      px-3 py-2.5 cursor-pointer flex items-center justify-between gap-2
                      transition-colors
                      ${estaFocada
                        ? 'bg-marca-100'
                        : estaSelecionada
                        ? 'bg-gray-50'
                        : 'hover:bg-gray-50'
                      }
                    `}
                    style={{
                      fontSize: '16px',
                      lineHeight: '1.5',
                    }}
                  >
                    <span className={`truncate ${estaSelecionada ? 'font-medium text-marca' : 'text-gray-900'}`}>
                      {opcao.label}
                    </span>
                    {estaSelecionada && (
                      <Check size={16} className="flex-shrink-0 text-marca" />
                    )}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
