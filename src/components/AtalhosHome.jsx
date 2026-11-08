import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react'
import { atalhosVisiveis } from '../lib/atalhosHome'
import { useAtalhosHome } from '../hooks/useAtalhosHome'
import { ICONES_ATALHOS } from './iconesAtalhos'
import ModalPersonalizarAtalhos from './ModalPersonalizarAtalhos'

const CHAVE_DICA_VISTA = 'almeida_atalhos_dica_vista'

function prefereMenosMovimento() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

// Faixa horizontal de atalhos da Home (mobile e desktop).
// - Rolagem nativa com CSS Scroll Snap (sem biblioteca).
// - touch-action: manipulation → permite deslizar na horizontal E rolar a
//   página na vertical começando o gesto sobre os cards (o antigo `pan-x`
//   bloqueava a rolagem vertical e o pinch-zoom de acessibilidade).
// - Setas só aparecem quando há conteúdo oculto naquela direção.
// - Indicadores acompanham a posição real e somem quando tudo cabe.
// Props:
//   onAbrirModal(tipo) — abre um modal existente da Home ('calendario' | 'gasto' | 'planejamento')
//   somenteLeitura     — modo consultoria: oculta "Registrar gasto" e "Personalizar"
//   sangria            — estende a faixa até as bordas da tela (layout mobile)
export default function AtalhosHome({ onAbrirModal, somenteLeitura = false, sangria = false }) {
  const navigate = useNavigate()
  const { config, salvar } = useAtalhosHome()
  const itens = atalhosVisiveis(config, { somenteLeitura })

  const trilhoRef = useRef(null)
  const [estado, setEstado] = useState({ transborda: false, esquerda: false, direita: false, paginas: 1, ativa: 0 })
  const [dicaVista, setDicaVista] = useState(() => {
    try { return localStorage.getItem(CHAVE_DICA_VISTA) === '1' } catch { return false }
  })
  const [personalizando, setPersonalizando] = useState(false)

  const medir = useCallback(() => {
    const el = trilhoRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const transborda = max > 2
    const paginas = transborda ? Math.max(2, Math.ceil(el.scrollWidth / el.clientWidth)) : 1
    const ativa = transborda ? Math.round((el.scrollLeft / max) * (paginas - 1)) : 0
    setEstado(prev => {
      const novo = {
        transborda,
        esquerda: el.scrollLeft > 2,
        direita: el.scrollLeft < max - 2,
        paginas,
        ativa,
      }
      return JSON.stringify(prev) === JSON.stringify(novo) ? prev : novo
    })
  }, [])

  useEffect(() => {
    const el = trilhoRef.current
    if (!el) return
    medir()
    const aoRolar = () => {
      medir()
      if (!dicaVista && el.scrollLeft > 8) {
        setDicaVista(true)
        try { localStorage.setItem(CHAVE_DICA_VISTA, '1') } catch { /* ignora */ }
      }
    }
    el.addEventListener('scroll', aoRolar, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    window.addEventListener('resize', medir)
    return () => {
      el.removeEventListener('scroll', aoRolar)
      ro?.disconnect()
      window.removeEventListener('resize', medir)
    }
  }, [medir, dicaVista, itens.length])

  function rolar(direcao) {
    const el = trilhoRef.current
    if (!el) return
    el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: prefereMenosMovimento() ? 'auto' : 'smooth' })
  }

  function executar(atalho) {
    if (atalho.modal) onAbrirModal?.(atalho.modal)
    else if (atalho.rota) navigate(atalho.rota)
  }

  return (
    <section aria-label="Atalhos" className={`relative ${sangria ? '-mx-4' : ''}`} data-testid="atalhos-home">
      <div className="relative">
        <div
          ref={trilhoRef}
          className={`flex gap-2 overflow-x-auto py-1 snap-x snap-mandatory scrollbar-hide overscroll-x-contain ${sangria ? 'px-4 scroll-px-4' : ''}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'manipulation' }}
          data-testid="atalhos-trilho"
        >
          {itens.map(a => {
            const Icone = ICONES_ATALHOS[a.id]
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => executar(a)}
                className="af-shortcut-btn snap-start flex-shrink-0"
                aria-label={a.label}
                data-atalho={a.id}
              >
                <div className="af-shortcut-icon"><Icone size={22} strokeWidth={1.8} /></div>
                <span className="text-[10px] text-[#D4A8B6] text-center leading-tight">{a.label}</span>
              </button>
            )
          })}
        </div>

        {/* Setas: só quando há conteúdo oculto naquela direção. Em telas de
            toque pequenas ficam ocultas (o gesto de deslizar é o controle). */}
        {estado.esquerda && (
          <button
            type="button"
            onClick={() => rolar(-1)}
            aria-label="Ver atalhos anteriores"
            className="af-shortcut-seta hidden md:flex left-0"
            data-testid="atalhos-seta-esquerda"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {estado.direita && (
          <button
            type="button"
            onClick={() => rolar(1)}
            aria-label="Ver mais atalhos"
            className="af-shortcut-seta hidden md:flex right-0"
            data-testid="atalhos-seta-direita"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      <div className={`flex items-center justify-between gap-3 mt-1 min-h-[20px] ${sangria ? 'px-4' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          {estado.transborda && (
            <div className="flex items-center gap-1" aria-hidden="true" data-testid="atalhos-indicadores">
              {Array.from({ length: estado.paginas }).map((_, i) => (
                <span
                  key={i}
                  className="af-shortcut-dot"
                  data-ativo={i === estado.ativa ? 'true' : 'false'}
                />
              ))}
            </div>
          )}
          {estado.transborda && !dicaVista && (
            <span className="text-[10px] text-[#D4A8B6] md:hidden truncate" data-testid="atalhos-dica">Deslize para ver mais</span>
          )}
        </div>
        {!somenteLeitura && (
          <button
            type="button"
            onClick={() => setPersonalizando(true)}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#C4507A] hover:underline flex-shrink-0"
            data-testid="atalhos-personalizar"
          >
            <SlidersHorizontal size={12} /> Personalizar
          </button>
        )}
      </div>

      {personalizando && (
        <ModalPersonalizarAtalhos
          aberto={personalizando}
          configInicial={config}
          onFechar={() => setPersonalizando(false)}
          onSalvar={async nova => {
            const r = await salvar(nova)
            setPersonalizando(false)
            return r
          }}
        />
      )}
    </section>
  )
}
