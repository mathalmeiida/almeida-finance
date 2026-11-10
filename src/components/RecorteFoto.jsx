import React, { useEffect, useRef, useState } from 'react'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { recorteQuadrado, LADO_SAIDA } from '../lib/fotoPerfil'

// Ajuste do enquadramento circular: arraste para posicionar e use o zoom.
// Recebe uma imagem já decodificada (HTMLImageElement) e expõe gerarBlob()
// pela ref, que devolve um JPEG quadrado de 512 px (leve para envio).
const PREVIA = 240

const RecorteFoto = React.forwardRef(function RecorteFoto({ imagem }, ref) {
  const canvasRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [desloc, setDesloc] = useState({ x: 0, y: 0 })
  const arraste = useRef(null)

  const largura = imagem?.naturalWidth || 1
  const altura = imagem?.naturalHeight || 1

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !imagem) return
    const dpr = window.devicePixelRatio || 1
    cv.width = PREVIA * dpr; cv.height = PREVIA * dpr
    const ctx = cv.getContext('2d')
    const { sx, sy, lado } = recorteQuadrado({ largura, altura, zoom, deslocX: desloc.x, deslocY: desloc.y })
    ctx.clearRect(0, 0, cv.width, cv.height)
    ctx.drawImage(imagem, sx, sy, lado, lado, 0, 0, cv.width, cv.height)
  }, [imagem, zoom, desloc, largura, altura])

  React.useImperativeHandle(ref, () => ({
    gerarBlob: () => new Promise((resolve, reject) => {
      const cv = document.createElement('canvas')
      cv.width = LADO_SAIDA; cv.height = LADO_SAIDA
      const ctx = cv.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, LADO_SAIDA, LADO_SAIDA) // PNG transparente → fundo branco
      const { sx, sy, lado } = recorteQuadrado({ largura, altura, zoom, deslocX: desloc.x, deslocY: desloc.y })
      ctx.drawImage(imagem, sx, sy, lado, lado, 0, 0, LADO_SAIDA, LADO_SAIDA)
      cv.toBlob(b => (b ? resolve(b) : reject(new Error('Falha ao preparar a foto.'))), 'image/jpeg', 0.88)
    }),
  }), [imagem, zoom, desloc, largura, altura])

  // Arrastar: converte pixels da prévia na fração da sobra da imagem.
  function mover(e) {
    if (!arraste.current) return
    const { x0, y0, d0 } = arraste.current
    const lado = Math.min(largura, altura) / zoom
    const fx = (largura - lado) > 0 ? ((e.clientX - x0) / PREVIA) * lado / ((largura - lado) / 2) : 0
    const fy = (altura - lado) > 0 ? ((e.clientY - y0) / PREVIA) * lado / ((altura - lado) / 2) : 0
    const c = v => Math.max(-1, Math.min(1, v))
    setDesloc({ x: c(d0.x - fx), y: c(d0.y - fy) })
  }

  return (
    <div className="flex flex-col items-center gap-3" data-testid="recorte-foto">
      <canvas
        ref={canvasRef}
        style={{ width: PREVIA, height: PREVIA, touchAction: 'none' }}
        className="rounded-full border-4 border-marca-100 cursor-grab active:cursor-grabbing bg-gray-100"
        aria-label="Prévia da foto. Arraste para ajustar o enquadramento."
        role="img"
        onPointerDown={e => { e.currentTarget.setPointerCapture?.(e.pointerId); arraste.current = { x0: e.clientX, y0: e.clientY, d0: desloc } }}
        onPointerMove={mover}
        onPointerUp={() => { arraste.current = null }}
        onPointerCancel={() => { arraste.current = null }}
      />
      <div className="flex items-center gap-2 w-full max-w-[260px]">
        <ZoomOut size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
        <input type="range" min="1" max="3" step="0.05" value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          className="flex-1 accent-current text-marca" aria-label="Zoom da foto" />
        <ZoomIn size={16} className="text-gray-400 flex-shrink-0" aria-hidden="true" />
      </div>
      <p className="text-xs text-gray-500">Arraste a foto para ajustar o enquadramento.</p>
    </div>
  )
})

export default RecorteFoto
