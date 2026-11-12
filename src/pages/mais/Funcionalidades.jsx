import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, TrendingDown, CreditCard, UtensilsCrossed,
  PiggyBank, BarChart2, Activity, Target, ShoppingCart, Sparkles,
  MessagesSquare, Settings, ShieldCheck, PlayCircle, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PaginaInterna from '../../components/PaginaInterna'

// ─── Todas as funcionalidades ────────────────────────────────────────────────
// Catálogo organizado por categoria. Cada item aponta para uma rota REAL e
// ÚNICA do App.jsx (sem duplicatas e sem módulos inventados).
// Parcelamentos vivem na aba "Parceladas" de Despesas (rota /parcelamentos
// apenas redireciona), por isso não têm item separado.
const CATEGORIAS = [
  {
    titulo: 'Visão geral',
    itens: [
      { rota: '/', Icone: LayoutDashboard, titulo: 'Início e calendário', detalhe: 'Saldo, limite do dia, calendário financeiro e lançamentos rápidos', cor: '#7c3aed', bg: '#ede9fe' },
      { rota: '/minha-evolucao', Icone: Activity, titulo: 'Minha evolução', detalhe: 'Acompanhe o progresso da sua vida financeira', cor: '#7c3aed', bg: '#ede9fe' },
    ],
  },
  {
    titulo: 'Movimentações',
    itens: [
      { rota: '/receitas', Icone: TrendingUp, titulo: 'Receitas', detalhe: 'Entradas, recorrências e categorias', cor: '#059669', bg: '#d1fae5' },
      { rota: '/despesas', Icone: TrendingDown, titulo: 'Despesas e parcelamentos', detalhe: 'Gastos, contas fixas e compras parceladas', cor: '#e11d48', bg: '#ffe4e6' },
      { rota: '/cartoes', Icone: CreditCard, titulo: 'Cartões e faturas', detalhe: 'Limites, compras e faturas dos cartões', cor: '#0284c7', bg: '#e0f2fe' },
      { rota: '/beneficios', Icone: UtensilsCrossed, titulo: 'Benefícios VR/VA', detalhe: 'Saldo e gastos de vale-refeição e alimentação', cor: '#d97706', bg: '#fef3c7' },
    ],
  },
  {
    titulo: 'Planejamento e investimentos',
    itens: [
      { rota: '/investimentos', Icone: PiggyBank, titulo: 'Investimentos', detalhe: 'Aportes, resgates e rentabilidade', cor: '#059669', bg: '#d1fae5' },
      { rota: '/metas', Icone: Target, titulo: 'Metas', detalhe: 'Objetivos financeiros e progresso', cor: '#d97706', bg: '#fef3c7' },
      { rota: '/projecao', Icone: BarChart2, titulo: 'Planejamento e projeção', detalhe: 'Organize hoje e projete os próximos meses', cor: '#7c3aed', bg: '#ede9fe' },
    ],
  },
  {
    titulo: 'Simulações',
    itens: [
      { rota: '/posso-comprar', Icone: ShoppingCart, titulo: 'Posso comprar?', detalhe: 'Veja o impacto de uma compra no seu orçamento', cor: '#801D39', bg: '#fce7f3' },
      { rota: '/e-se', Icone: Sparkles, titulo: 'E se...?', detalhe: 'Compare cenários financeiros', cor: '#7c3aed', bg: '#ede9fe' },
    ],
  },
  {
    titulo: 'Conta e suporte',
    itens: [
      { rota: '/consultoria', Icone: MessagesSquare, titulo: 'Consultoria', detalhe: 'Solicitações e acessos de consultoria', cor: '#0891b2', bg: '#cffafe' },
      { rota: '/configuracoes', Icone: Settings, titulo: 'Configurações', detalhe: 'Aparência, notificações e privacidade', cor: '#475569', bg: '#e2e8f0' },
      { rota: '/apresentacao', Icone: PlayCircle, titulo: 'Rever apresentação', detalhe: 'Reveja a apresentação inicial do app', cor: '#801D39', bg: '#fce7f3' },
    ],
  },
]

const CATEGORIA_ADMIN = {
  titulo: 'Administração',
  itens: [
    { rota: '/admin', Icone: ShieldCheck, titulo: 'Painel administrativo', detalhe: 'Usuários e feedbacks (apenas administradores)', cor: '#7c3aed', bg: '#ede9fe' },
  ],
}

export default function Funcionalidades() {
  const navigate = useNavigate()
  const { ehAdmin } = useAuth()
  const categorias = ehAdmin ? [...CATEGORIAS, CATEGORIA_ADMIN] : CATEGORIAS

  return (
    <PaginaInterna largo titulo="Todas as funcionalidades" descricao="Toque em um recurso para abri-lo.">
      <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-5 md:items-start" data-testid="funcionalidades-grade">
      {categorias.map(cat => (
        <section key={cat.titulo} aria-label={cat.titulo}>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">{cat.titulo}</h2>
          <div className="card !p-0 divide-y divide-gray-100 overflow-hidden">
            {cat.itens.map(item => (
              <button
                key={item.rota}
                type="button"
                onClick={() => navigate(item.rota)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: item.bg, color: item.cor }}>
                  <item.Icone size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-gray-900">{item.titulo}</span>
                  <span className="block text-xs text-gray-500">{item.detalhe}</span>
                </span>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </section>
      ))}
      </div>
    </PaginaInterna>
  )
}
