import React from 'react'
import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, Wallet, MessageSquare, MoreHorizontal } from 'lucide-react'

export default function NavegacaoInferior() {
  const itens = [
    { to: '/', icon: Home, label: 'Início', end: true },
    { to: '/calendario', icon: CalendarDays, label: 'Calendário' },
    { to: '/registrar', icon: Wallet, label: 'Registrar', destaque: true },
    { to: '/consultoria', icon: MessageSquare, label: 'Consultoria' },
    { to: '/mais', icon: MoreHorizontal, label: 'Mais' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-40">
      <div className="flex items-center justify-around max-w-screen-xl mx-auto">
        {itens.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 py-2 px-3 min-w-0 flex-1 transition-colors ${
                item.destaque
                  ? isActive
                    ? 'text-white'
                    : 'text-marca'
                  : isActive
                  ? 'text-marca'
                  : 'text-gray-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    item.destaque
                      ? 'bg-marca text-white'
                      : isActive
                      ? 'bg-marca/10'
                      : ''
                  }`}
                >
                  <item.icon size={20} />
                </div>
                <span className="text-[10px] font-medium truncate max-w-full">
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
