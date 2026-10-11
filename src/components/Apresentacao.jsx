import React, { useState } from 'react'
import { ArrowRight, ArrowLeft, Wallet, TrendingUp, ShieldCheck } from 'lucide-react'
import LogoMarca from './LogoMarca'

// ─── Apresentação inicial (3 telas) ──────────────────────────────────────────
// Carrossel exibido UMA VEZ antes do onboarding, no primeiro acesso. Puramente
// informativo: apresenta o Almeida Finance e o que o usuário vai configurar.
// Não toca em dados nem autenticação. Ao concluir (ou pular), chama aoConcluir()
// e o fluxo segue para a configuração (Onboarding). O controle de "já viu" fica
// no componente que o renderiza (Onboarding), via localStorage por usuário.
const SLIDES = [
  {
    icone: Wallet,
    titulo: 'Bem-vindo ao Almeida Finance',
    texto: 'Seu dinheiro organizado em um só lugar: saldo, contas, cartões e benefícios. Simples, claro e sem planilhas.',
  },
  {
    icone: TrendingUp,
    titulo: 'Saiba quanto pode gastar hoje',
    texto: 'A partir da sua renda, despesas e reserva, calculamos um limite diário e mostramos sua projeção para os próximos meses.',
  },
  {
    icone: ShieldCheck,
    titulo: 'Decisões com segurança',
    texto: 'Planeje compras, acompanhe faturas e proteja sua reserva de emergência. Vamos começar configurando suas informações.',
  },
]

export default function Apresentacao({ aoConcluir }) {
  const [i, setI] = useState(0)
  const ultimo = i === SLIDES.length - 1
  const Slide = SLIDES[i]
  const Icone = Slide.icone

  const avancar = () => (ultimo ? aoConcluir?.() : setI(n => Math.min(n + 1, SLIDES.length - 1)))
  const voltar = () => setI(n => Math.max(n - 1, 0))

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card text-center py-6">
          {/* Logo da marca no topo (acompanha o tema). */}
          <div className="flex justify-center mb-6">
            <LogoMarca imgClassName="h-12 w-auto" padding="px-5 py-3" />
          </div>

          {/* Ícone do slide atual */}
          <div className="w-16 h-16 bg-marca-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icone size={30} className="text-marca" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">{Slide.titulo}</h1>
          <p className="text-sm text-gray-500 mb-6 px-2 leading-relaxed">{Slide.texto}</p>

          {/* Indicadores (bolinhas) das 3 telas */}
          <div className="flex items-center justify-center gap-2 mb-6" aria-hidden="true">
            {SLIDES.map((_, idx) => (
              <span
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === i ? 'w-6 bg-marca' : 'w-2 bg-gray-300'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {i > 0 ? (
              <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3" aria-label="Voltar">
                <ArrowLeft size={16} />
              </button>
            ) : (
              // Pular a apresentação (só na primeira tela, para não poluir).
              <button
                onClick={() => aoConcluir?.()}
                className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 px-3"
              >
                Pular
              </button>
            )}
            <button onClick={avancar} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {ultimo ? <>Começar <ArrowRight size={16} /></> : <>Próximo <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
      </div>
    </div>
  )
}
