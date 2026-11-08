import React, { useState } from 'react'
import { ChevronUp, ChevronDown, Star, Eye, EyeOff, GripVertical, RotateCcw, Loader2 } from 'lucide-react'
import Modal from './Modal'
import { ICONES_ATALHOS } from './iconesAtalhos'
import {
  CATALOGO_ATALHOS, normalizarConfigAtalhos, configPadraoAtalhos, moverAtalho,
  reposicionarAtalho, alternarOcultoAtalho, alternarFavoritoAtalho, configsAtalhosIguais,
} from '../lib/atalhosHome'

const POR_ID = Object.fromEntries(CATALOGO_ATALHOS.map(a => [a.id, a]))

// Personalização dos atalhos da Home: ordem, visibilidade e favoritos.
// Reordenação por arrastar e soltar (mouse/trackpad) e por botões ↑ ↓
// (toque e teclado). Edita um rascunho e só grava ao clicar em "Salvar".
// Reutilizável: a Parte B (onboarding) usa este mesmo componente.
export default function ModalPersonalizarAtalhos({ aberto, configInicial, onFechar, onSalvar }) {
  const [rascunho, setRascunho] = useState(() => normalizarConfigAtalhos(configInicial))
  const [arrastando, setArrastando] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const ocultos = new Set(rascunho.ocultos)
  const favoritos = new Set(rascunho.favoritos)
  const alterado = !configsAtalhosIguais(rascunho, configInicial)

  async function salvar() {
    if (salvando) return // evita gravações repetidas por clique duplo
    setSalvando(true)
    try {
      await onSalvar?.(rascunho)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Personalizar atalhos">
      <p className="text-xs text-gray-500 mb-3">
        Favoritos aparecem primeiro. Arraste ou use as setas para mudar a ordem.
      </p>

      <ul className="space-y-1.5" data-testid="lista-personalizar-atalhos">
        {rascunho.ordem.map((id, i) => {
          const a = POR_ID[id]
          const Icone = ICONES_ATALHOS[id]
          const oculto = ocultos.has(id)
          const favorito = favoritos.has(id)
          return (
            <li
              key={id}
              draggable
              onDragStart={e => { setArrastando(id); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={e => { if (arrastando && arrastando !== id) e.preventDefault() }}
              onDrop={e => {
                e.preventDefault()
                if (arrastando) setRascunho(c => reposicionarAtalho(c, arrastando, id))
                setArrastando(null)
              }}
              onDragEnd={() => setArrastando(null)}
              className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                arrastando === id ? 'opacity-50' : ''
              } ${oculto ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}
              data-item-atalho={id}
            >
              <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab hidden sm:block" aria-hidden="true" />
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${oculto ? 'text-gray-300' : 'text-marca'}`}
                style={{ background: oculto ? 'transparent' : '#FFF0F3' }}>
                <Icone size={16} />
              </span>
              <span className={`flex-1 min-w-0 text-sm truncate ${oculto ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                {a.label}
              </span>
              <button type="button" onClick={() => setRascunho(c => alternarFavoritoAtalho(c, id))}
                aria-pressed={favorito} aria-label={favorito ? `Remover ${a.label} dos favoritos` : `Favoritar ${a.label}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                <Star size={15} className={favorito ? 'text-amber-500 fill-amber-400' : 'text-gray-400'} />
              </button>
              <button type="button" onClick={() => setRascunho(c => alternarOcultoAtalho(c, id))}
                aria-pressed={!oculto} aria-label={oculto ? `Mostrar ${a.label}` : `Ocultar ${a.label}`}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-gray-100">
                {oculto ? <EyeOff size={15} className="text-gray-400" /> : <Eye size={15} className="text-gray-600" />}
              </button>
              <div className="flex flex-col">
                <button type="button" disabled={i === 0} onClick={() => setRascunho(c => moverAtalho(c, id, -1))}
                  aria-label={`Mover ${a.label} para cima`}
                  className="w-7 h-4 flex items-center justify-center text-gray-500 disabled:text-gray-200">
                  <ChevronUp size={14} />
                </button>
                <button type="button" disabled={i === rascunho.ordem.length - 1} onClick={() => setRascunho(c => moverAtalho(c, id, 1))}
                  aria-label={`Mover ${a.label} para baixo`}
                  className="w-7 h-4 flex items-center justify-center text-gray-500 disabled:text-gray-200">
                  <ChevronDown size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between gap-2 mt-4">
        <button type="button" onClick={() => setRascunho(configPadraoAtalhos())}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900">
          <RotateCcw size={14} /> Restaurar padrão
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onFechar} className="btn-secondary text-sm">Cancelar</button>
          <button type="button" onClick={salvar} disabled={salvando || !alterado}
            className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
            {salvando && <Loader2 size={14} className="animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </Modal>
  )
}
