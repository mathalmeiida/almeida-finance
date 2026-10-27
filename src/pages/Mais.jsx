import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, CalendarClock, UtensilsCrossed, PiggyBank,
  Target, BarChart2, LineChart, ShoppingCart, Sparkles, Landmark,
  MessagesSquare, Palette, Settings, ShieldCheck, LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// Página "Mais" — ferramentas do app organizadas em 3 grupos. SOMENTE rotas e
// funcionalidades REAIS já existentes no projeto (nada de página vazia).
// "Movimentações"/"Parcelamentos" levam a /despesas (parcelas vivem na aba
// Parceladas). "Calendário" e "Horizonte diário" vivem na Home/Planejamento:
// apontamos para rotas reais (/ e /projecao). "Aparência" abre Configurações
// (onde fica o seletor de tema). Admin só para adminOnly.
const GRUPOS = [
  {
    titulo: 'Meu dinheiro',
    itens: [
      { to: '/despesas',      label: 'Movimentações',    icon: TrendingDown,    cor: 'text-rose-400' },
      { to: '/cartoes',       label: 'Cartões',          icon: CreditCard,      cor: 'text-sky-400' },
      { to: '/',              label: 'Calendário',       icon: CalendarClock,   cor: 'text-blue-400' },
      { to: '/beneficios',    label: 'Benefícios VR/VA', icon: UtensilsCrossed, cor: 'text-emerald-400' },
      { to: '/investimentos', label: 'Investimentos',    icon: PiggyBank,       cor: 'text-emerald-400' },
      { to: '/despesas',      label: 'Parcelamentos',    icon: CreditCard,      cor: 'text-amber-400' },
    ],
  },
  {
    titulo: 'Planejamento',
    itens: [
      { to: '/metas',         label: 'Metas',                 icon: Target,       cor: 'text-amber-400' },
      { to: '/projecao',      label: 'Projeção financeira',   icon: BarChart2,    cor: 'text-violet-400' },
      { to: '/projecao',      label: 'Horizonte diário',      icon: LineChart,    cor: 'text-violet-400' },
      { to: '/posso-comprar', label: 'Posso comprar?',        icon: ShoppingCart, cor: 'text-blue-400' },
      { to: '/e-se',          label: 'E se...?',              icon: Sparkles,     cor: 'text-violet-400' },
      { to: '/e-se',          label: 'Financiamento e consórcio', icon: Landmark, cor: 'text-cyan-400' },
    ],
  },
  {
    titulo: 'Conta e serviços',
    itens: [
      { to: '/consultoria',   label: 'Consultoria',    icon: MessagesSquare, cor: 'text-cyan-400' },
      { to: '/configuracoes', label: 'Aparência',      icon: Palette,        cor: 'text-fuchsia-400' },
      { to: '/configuracoes', label: 'Configurações',  icon: Settings,       cor: 'text-gray-400' },
      { to: '/admin',         label: 'Admin',          icon: ShieldCheck,    cor: 'text-violet-400', adminOnly: true },
    ],
  },
]

function LinhaItem({ item, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-2.5 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left">
      <span className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
        <item.icon size={18} className={item.cor} />
      </span>
      <span className="flex-1 text-sm font-medium text-gray-900">{item.label}</span>
    </button>
  )
}

export default function Mais() {
  const navigate = useNavigate()
  const { ehAdmin, sair, perfil, usuario } = useAuth()

  const grupos = GRUPOS.map(g => ({
    ...g,
    itens: g.itens.filter(i => !i.adminOnly || ehAdmin),
  })).filter(g => g.itens.length > 0)

  const nome = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const iniciais = nome.slice(0, 2).toUpperCase()

  async function handleSair() {
    try { await sair(); navigate('/login') } catch (e) { console.error('Erro ao sair:', e) }
  }

  return (
    <div className="space-y-5 pb-mobilenav md:pb-0">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-marca-100 text-marca flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold">{iniciais}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{nome}</h1>
          <p className="text-xs text-gray-500 truncate">{usuario?.email}</p>
        </div>
      </div>

      {grupos.map(grupo => (
        <section key={grupo.titulo} className="card !p-2">
          <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{grupo.titulo}</p>
          <div className="divide-y divide-gray-100">
            {grupo.itens.map(item => (
              <LinhaItem key={item.label} item={item} onClick={() => navigate(item.to)} />
            ))}
          </div>
        </section>
      ))}

      <button onClick={handleSair}
        className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
        <LogOut size={18} /> Sair da conta
      </button>
    </div>
  )
}
