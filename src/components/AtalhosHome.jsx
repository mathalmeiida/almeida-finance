import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, SlidersHorizontal, Wallet } from 'lucide-react'
import { atalhosVisiveis } from '../lib/atalhosHome'
import { useAtalhosHome } from '../hooks/useAtalhosHome'
import { ICONES_ATALHOS } from './iconesAtalhos'
import ModalPersonalizarAtalhos from './ModalPersonalizarAtalhos'
const CHAVE_DICA_VISTA = 'almeida_atalhos_dica_vista'
function prefereMenosMovimento() { return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches }
export default function AtalhosHome({ onAbrirModal, somenteLeitura = false, sangria = false, modo = 'carrossel' }) {
  const grade = modo === 'grade'
  const navigate = useNavigate()
  const { config, salvar } = useAtalhosHome()
  const itens = atalhosVisiveis(config, { somenteLeitura })
  const trilhoRef = useRef(null)
  const gesto = useRef(null)
  const bloquearClique = useRef(false)
  const [arrastando, setArrastando] = useState(false)
  function iniciar(e) {
    bloquearClique.current = false
    if (e.pointerType !== 'mouse' || e.button !== 0 || !estado.transborda) return
    gesto.current = { id: e.pointerId, x: e.clientX, scroll: e.currentTarget.scrollLeft, ativo: false }
  }
  function mover(e) {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    if (!(e.buttons & 1)) { finalizar(e); return }
    const delta = e.clientX - g.x
    if (!g.ativo && Math.abs(delta) < 7) return
    if (!g.ativo) {
      g.ativo = true
      bloquearClique.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      e.currentTarget.style.scrollSnapType = 'none'
      setArrastando(true)
    }
    e.preventDefault()
    e.currentTarget.scrollLeft = g.scroll - delta
  }
  function finalizar(e) {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    if (g.ativo) {
      e.currentTarget.style.scrollSnapType = ''
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      setArrastando(false)
      medir()
    }
  }
  const [estado, setEstado] = useState({ transborda: false, esquerda: false, direita: false, paginas: 1, ativa: 0 })
  const [dicaVista, setDicaVista] = useState(() => { try { return localStorage.getItem(CHAVE_DICA_VISTA) === '1' } catch { return false } })
  const [personalizando, setPersonalizando] = useState(false)
  const medir = useCallback(() => {
    const el = trilhoRef.current
    if (!el || !el.clientWidth) return
    const max = el.scrollWidth - el.clientWidth
    const transborda = max > 2
    const paginas = transborda ? Math.max(2, Math.ceil(el.scrollWidth / el.clientWidth)) : 1
    const ativa = transborda ? Math.max(0, Math.min(paginas - 1, Math.round(el.scrollLeft / max * (paginas - 1)))) : 0
    const novo = { transborda, esquerda: el.scrollLeft > 2, direita: el.scrollLeft < max - 2, paginas, ativa }
    setEstado(prev => JSON.stringify(prev) === JSON.stringify(novo) ? prev : novo)
  }, [])
  useEffect(() => {
    const el = trilhoRef.current
    if (!el) return
    medir()
    const aoRolar = () => { medir(); if (!dicaVista && el.scrollLeft > 8) { setDicaVista(true); try { localStorage.setItem(CHAVE_DICA_VISTA, '1') } catch {} } }
    el.addEventListener('scroll', aoRolar, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(el)
    window.addEventListener('resize', medir)
    return () => { el.removeEventListener('scroll', aoRolar); ro?.disconnect(); window.removeEventListener('resize', medir) }
  }, [medir, dicaVista, itens.length, grade])
  function rolar(direcao) {
    const el = trilhoRef.current
    if (el) el.scrollBy({ left: direcao * el.clientWidth * 0.8, behavior: prefereMenosMovimento() ? 'auto' : 'smooth' })
  }
  function executar(a) { if (a.modal) onAbrirModal?.(a.modal); else if (a.rota) navigate(a.rota) }
  return (
    <section aria-label="Atalhos" className={`relative ${sangria ? '-mx-4' : ''}`} data-testid="atalhos-home">
      <div className="relative">
        <div ref={trilhoRef}
          onPointerDown={iniciar} onPointerMove={mover} onPointerUp={finalizar}
          onPointerCancel={finalizar} onLostPointerCapture={finalizar}
          onPointerLeave={e => { if (!gesto.current?.ativo) finalizar(e) }}
          onClickCapture={e => { if (bloquearClique.current && e.detail !== 0) { e.preventDefault(); e.stopPropagation(); bloquearClique.current = false } }}
          onDragStart={e => e.preventDefault()}
          className={`flex ${grade ? 'gap-3' : 'gap-2'} overflow-x-auto py-1 snap-x snap-mandatory scrollbar-hide overscroll-x-contain select-none ${sangria ? 'px-4 scroll-px-4' : ''}`}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'manipulation', cursor: arrastando ? 'grabbing' : estado.transborda ? 'grab' : undefined }} data-testid="atalhos-trilho">
          {itens.map(a => {
            const principal = a.id === 'gastar-hoje'
            const Icone = principal ? Wallet : (ICONES_ATALHOS[a.id] || Wallet)
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => executar(a)}
                className={grade ? 'af-shortcut-btn af-shortcut-grade snap-start flex-shrink-0' : 'af-shortcut-btn snap-start flex-shrink-0'}
                style={{
                  flex: grade ? '0 0 calc((100% - 48px) / 5)' : undefined,
                  minWidth: grade ? 0 : undefined,
                  cursor: arrastando ? 'grabbing' : undefined,
                  background: principal ? 'linear-gradient(135deg,#801D39,#420D1D)' : undefined,
                  color: principal ? '#fff' : undefined,
                  borderColor: principal ? '#801D39' : undefined
                }}
                aria-label={a.label}
                data-atalho={a.id}
              >
                <div className="af-shortcut-icon" style={principal ? { background: 'rgba(255,255,255,.16)', color: '#fff' } : undefined}>
                  <Icone size={24} strokeWidth={1.8} />
                </div>
                <span className={['text-center leading-tight', principal ? 'text-white font-semibold' : 'text-text-sec', grade ? 'text-xs font-medium' : 'text-[10px]'].join(' ')} style={principal ? { color: '#fff' } : undefined}>
                  {a.label}
                </span>
              </button>
            )
          })}
        </div>
        {estado.esquerda && <button type="button" onClick={() => rolar(-1)} aria-label="Ver atalhos anteriores" className="af-shortcut-seta hidden md:flex left-0" data-testid="atalhos-seta-esquerda"><ChevronLeft size={16} /></button>}
        {estado.direita && <button type="button" onClick={() => rolar(1)} aria-label="Ver mais atalhos" className="af-shortcut-seta hidden md:flex right-0" data-testid="atalhos-seta-direita"><ChevronRight size={16} /></button>}
      </div>
      <div className={`flex items-center justify-between gap-3 mt-1 min-h-[20px] ${sangria ? 'px-4' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          {estado.transborda && <div className="flex items-center gap-1" aria-hidden="true" data-testid="atalhos-indicadores">{Array.from({ length: estado.paginas }).map((_,i) => <span key={i} className="af-shortcut-dot" data-ativo={i === estado.ativa ? 'true' : 'false'} />)}</div>}
          {estado.transborda && <span className="text-[10px] text-text-sec truncate" data-testid="atalhos-dica">Arraste para ver mais</span>}
        </div>
        {!somenteLeitura && <button type="button" onClick={() => setPersonalizando(true)} className="flex items-center gap-1 text-[11px] font-semibold text-marca hover:underline flex-shrink-0" data-testid="atalhos-personalizar"><SlidersHorizontal size={12} /> Personalizar</button>}
      </div>
      {personalizando && !somenteLeitura && <ModalPersonalizarAtalhos aberto={personalizando} configInicial={config} onFechar={() => setPersonalizando(false)} onSalvar={async nova => { const r = await salvar(nova); if (r?.ok) setPersonalizando(false); return r }} />}
    </section>
  )
}
