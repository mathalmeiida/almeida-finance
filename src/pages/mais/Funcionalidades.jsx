import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, CalendarDays, CreditCard, TrendingUp,
  ShoppingCart, Target, BarChart2, TrendingDown,
  Receipt, MessagesSquare,
} from 'lucide-react'

// ─── Todas as Funcionalidades ────────────────────────────────────────────────
// Grade 3 colunas com atalhos para todos os módulos reais do app.
// Conforme design aprovado — sem páginas em branco ou destinos fictícios.

const FUNCIONALIDADES = [
  {
    label: 'Calendário\nFinanceiro',
    Icone: CalendarDays,
    rota: '/',
    cor: '#7c3aed',
    bg: '#ede9fe',
  },
  {
    label: 'Cartões\ne Faturas',
    Icone: CreditCard,
    rota: '/cartoes',
    cor: '#0284c7',
    bg: '#e0f2fe',
  },
  {
    label: 'Investimentos',
    Icone: TrendingUp,
    rota: '/investimentos',
    cor: '#059669',
    bg: '#d1fae5',
  },
  {
    label: 'Simular\nCompra (E Se)',
    Icone: ShoppingCart,
    rota: '/posso-comprar',
    cor: '#801D39',
    bg: '#fce7f3',
  },
  {
    label: 'Metas\nFinanceiras',
    Icone: Target,
    rota: '/metas',
    cor: '#d97706',
    bg: '#fef3c7',
  },
  {
    label: 'Projeções\n(12 meses)',
    Icone: BarChart2,
    rota: '/projecao',
    cor: '#7c3aed',
    bg: '#ede9fe',
  },
  {
    label: 'Receitas\ne Despesas',
    Icone: TrendingDown,
    rota: '/despesas',
    cor: '#e11d48',
    bg: '#ffe4e6',
  },
  {
    label: 'Parcelamentos',
    Icone: Receipt,
    rota: '/despesas',        // integrado na aba "Parceladas" de Despesas
    cor: '#d97706',
    bg: '#fef3c7',
  },
  {
    label: 'Consultoria',
    Icone: MessagesSquare,
    rota: '/consultoria',
    cor: '#0891b2',
    bg: '#cffafe',
  },
]

export default function Funcionalidades() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[100dvh] bg-gray-50 -mx-4 -mt-1">
      {/* Cabeçalho */}
      <header className="sticky top-0 z-10 flex items-center gap-3 bg-white border-b border-gray-100 px-4 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => navigate(-1)} aria-label="Voltar"
          className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 text-center">Todas as funcionalidades</h1>
        <span className="w-9" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
        <p className="text-sm text-gray-500 mb-5">
          Catálogo completo de recursos do Almeida Finance. Toque em qualquer item para acessar.
        </p>

        {/* Grade 3 colunas */}
        <div className="grid grid-cols-3 gap-3">
          {FUNCIONALIDADES.map(f => (
            <button
              key={f.rota + f.label}
              type="button"
              onClick={() => navigate(f.rota)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-center shadow-sm transition-all active:scale-95 hover:shadow-md"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl"
                style={{ background: f.bg, color: f.cor }}
              >
                <f.Icone size={24} />
              </span>
              <span className="text-xs font-semibold text-gray-800 leading-tight whitespace-pre-line">
                {f.label}
              </span>
            </button>
          ))}
        </div>

        {/* Nota de rodapé */}
        <p className="text-xs text-gray-400 text-center mt-6">
          Almeida Finance · Todas as funcionalidades disponíveis no app
        </p>
      </div>
    </div>
  )
}
