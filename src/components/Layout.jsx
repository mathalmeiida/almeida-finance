import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ShoppingCart,
  Target,
  Menu,
  X,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoAlmeida from '../assets/Logo Almeida Finance Geométrico.png'

const navItems = [
  { to: '/',              label: 'Início',         icon: LayoutDashboard },
  { to: '/receitas',      label: 'Receitas',       icon: TrendingUp      },
  { to: '/despesas',      label: 'Despesas',       icon: TrendingDown    },
  { to: '/projecao',      label: 'Projeção',       icon: BarChart2       },
  { to: '/posso-comprar', label: 'Posso Comprar?', icon: ShoppingCart    },
  { to: '/metas',         label: 'Metas',          icon: Target          },
]

function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <item.icon size={18} />
      <span>{item.label}</span>
    </NavLink>
  )
}

function UserFooter({ onSair, perfil, usuario }) {
  const nomeExibido = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const iniciais = nomeExibido.slice(0, 2).toUpperCase()

  return (
    <div className="px-3 py-3 border-t border-gray-100">
      {/* Info do usuário */}
      <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-blue-700">{iniciais}</span>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-800 truncate">{nomeExibido}</p>
          <p className="text-xs text-gray-400 truncate">{usuario?.email}</p>
        </div>
      </div>
      {/* Botão sair */}
      <button
        onClick={onSair}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <LogOut size={15} />
        <span>Sair</span>
      </button>
    </div>
  )
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { sair, usuario, perfil } = useAuth()
  const navigate = useNavigate()

  async function handleSair() {
    try {
      await sair()
      navigate('/login')
    } catch (err) {
      console.error('Erro ao sair:', err)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Sidebar desktop ── */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 fixed top-0 left-0 h-full z-30">
        {/* Logo */}
        <div className="flex items-center px-4 py-5 border-b border-gray-100">
          <img
            src={logoAlmeida}
            alt="Almeida Finance"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.to} item={item} />
          ))}
        </nav>

        {/* Usuário + Sair */}
        <UserFooter onSair={handleSair} perfil={perfil} usuario={usuario} />
      </aside>

      {/* ── Overlay mobile ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Drawer mobile ── */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-white z-50 flex flex-col transition-transform duration-300 md:hidden shadow-xl ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
          <img
            src={logoAlmeida}
            alt="Almeida Finance"
            className="h-9 w-auto object-contain"
          />
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavItem key={item.to} item={item} onClick={() => setMobileOpen(false)} />
          ))}
        </nav>

        <UserFooter onSair={handleSair} perfil={perfil} usuario={usuario} />
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Topbar mobile */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center flex-1">
            <img
              src={logoAlmeida}
              alt="Almeida Finance"
              className="h-7 w-auto object-contain"
            />
          </div>
        </header>

        {/* Conteúdo da página */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
