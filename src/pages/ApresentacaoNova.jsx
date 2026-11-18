import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import LogoMarca from '../components/LogoMarca'

export default function ApresentacaoNova() {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)

  const slides = [
    {
      titulo: 'Organize suas finanças',
      descricao: 'Controle receitas, despesas, cartões e benefícios (VR/VA) com calendário financeiro completo',
      imagem: '📊',
    },
    {
      titulo: 'Simule e planeje',
      descricao: 'Use E SE?, Simular compra e Custo de vida para tomar decisões inteligentes',
      imagem: '🎯',
    },
    {
      titulo: 'Invista e cresça',
      descricao: 'Acompanhe investimentos, defina metas e use nossa Consultoria para montar sua carteira',
      imagem: '📈',
    },
  ]

  function proximo() {
    if (slide < slides.length - 1) setSlide(slide + 1)
    else navigate('/cadastro')
  }

  function anterior() {
    if (slide > 0) setSlide(slide - 1)
  }

  function pular() {
    navigate('/cadastro')
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-marca/5 to-white flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6 pb-32">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center mb-12">
            <LogoMarca tamanho={48} />
            <h1 className="text-2xl font-bold text-gray-900 ml-3">Almeida Finance</h1>
          </div>

          <div className="text-center mb-12">
            <div className="text-8xl mb-6">{slides[slide].imagem}</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{slides[slide].titulo}</h2>
            <p className="text-gray-600">{slides[slide].descricao}</p>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`h-2 rounded-full transition-all ${
                  i === slide ? 'w-8 bg-marca' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 safe-bottom">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <button
            onClick={anterior}
            disabled={slide === 0}
            className="p-2 disabled:opacity-0"
          >
            <ChevronLeft className="text-gray-600" />
          </button>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <button onClick={pular} className="btn-secondary flex-1">
                Pular
              </button>
              <button onClick={proximo} className="btn-primary flex-1">
                {slide === slides.length - 1 ? 'Começar' : 'Próximo'}
              </button>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="text-xs text-gray-500 hover:text-gray-700 text-center py-1"
            >
              Já tenho conta
            </button>
          </div>

          <button
            onClick={proximo}
            className="p-2"
          >
            <ChevronRight className="text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}
