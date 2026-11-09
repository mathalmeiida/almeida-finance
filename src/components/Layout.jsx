import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart2,
  Activity,
  CalendarDays,
  ShoppingCart,
  Sparkles,
  Target,
  MessagesSquare,
  Settings,
  ShieldCheck,
  MoreHorizontal,
  Plus,
  Receipt,
  PiggyBank,
  UtensilsCrossed,
  X,
  LogOut,
  ArrowLeft,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  UserRound,
  Grid2X2,
  CircleHelp,
  Info,
  Upload,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import LogoMarca from './LogoMarca'
import FotoPerfil from './FotoPerfil'
import MenusMobileAlmeidaFinance from './MenusMobileAlmeidaFinance'
// Agrupamento VISUAL da sidebar desktop (mesmas rotas/itens de navItems,
// apenas organizados em seções). As permissões seguem iguais: itens com
// adminOnly só aparecem quando ehAdmin (filtrado na renderização).
const navGrupos = [
  { titulo: 'Principal', itens: [
    { to: '/',              label: 'Início',         icon: LayoutDashboard, corIcone: 'text-marca'       },
  ]},
  { titulo: 'Finanças', itens: [
    { to: '/receitas',      label: 'Receitas',       icon: TrendingUp,    corIcone: 'text-green-400'    },
    { to: '/despesas',      label: 'Despesas',       icon: TrendingDown,  corIcone: 'text-rose-400'     },
    { to: '/cartoes',       label: 'Cartões',        icon: CreditCard,    corIcone: 'text-sky-400'      },
    { to: '/beneficios',    label: 'Benefícios',     icon: UtensilsCrossed, corIcone: 'text-emerald-400' },
    { to: '/investimentos', label: 'Investimentos',  icon: TrendingUp,    corIcone: 'text-green-400'    },
      { to: '/importacao',    label: 'Importação',     icon: Upload,        corIcone: 'text-sky-400'      },
    { to: '/projecao',      label: 'Projeção',       icon: BarChart2,     corIcone: 'text-violet-400'   },
    { to: '/minha-evolucao', label: 'Minha evolução', icon: Activity, corIcone: 'text-violet-400' },
  ]},
  { titulo: 'Planejamento', itens: [
    { to: '/posso-comprar', label: 'Simular compra', icon: ShoppingCart,  corIcone: 'text-marca'        },
    { to: '/e-se',          label: 'E se...?',       icon: Sparkles,     corIcone: 'text-violet-400' },
    { to: '/metas',         label: 'Metas',          icon: Target,        corIcone: 'text-amber-400'    },
    { to: '/consultoria',   label: 'Consultoria',    icon: MessagesSquare, corIcone: 'text-cyan-400' },
  ]},
  { titulo: 'Conta', itens: [
    { to: '/mais/perfil',   label: 'Meu perfil',     icon: UserRound,     corIcone: 'text-marca'        },
    { to: '/configuracoes', label: 'Configurações',  icon: Settings,      corIcone: 'text-gray-400'     },
    { to: '/mais/funcionalidades', label: 'Funcionalidades', icon: Grid2X2, corIcone: 'text-sky-400'    },
    { to: '/mais/ajuda',    label: 'Ajuda & feedback', icon: CircleHelp,  corIcone: 'text-amber-400'    },
    { to: '/mais/sobre',    label: 'Sobre o app',    icon: Info,          corIcone: 'text-cyan-400'     },
  ]},
  { titulo: 'Administração', itens: [
    { to: '/admin',         label: 'Admin',          icon: ShieldCheck,   corIcone: 'text-violet-400', adminOnly: true },
  ]},
]
function NavItem({ item, onClick }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
          isActive
            ? 'bg-marca text-white shadow-sm'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Só o ÍCONE recebe cor (corIcone) quando inativo; selecionado herda
              o branco do container. O texto segue a cor do item (nunca colorido). */}
          <item.icon
            size={19}
            className={`flex-shrink-0 ${isActive ? '' : (item.corIcone || '')}`}
          />
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
              isActive ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
            }`}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}
function UserFooter({ onSair, perfil, usuario }) {
  const nomeExibido = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  return (
    <div className="px-4 pt-3 pb-4 border-t border-gray-100">
      <div className="flex items-center gap-3 px-1 py-2 mb-1">
        <FotoPerfil perfil={perfil} usuario={usuario} tamanho="sm" />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-gray-800 truncate">{nomeExibido}</p>
          <p className="text-xs text-gray-400 truncate">{usuario?.email}</p>
        </div>
      </div>
      <button
        onClick={onSair}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
      >
        <LogOut size={16} />
        <span>Sair</span>
      </button>
    </div>
  )
}
// Rótulo discreto de seção na sidebar desktop
function SecaoLabel({ children }) {
  return (
    <p className="px-3 pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
      {children}
    </p>
  )
}
// Item da barra inferior mobile (ícone + rótulo, alvo de toque confortável).
// Suporta tanto NavLink (to) quanto botão de ação (onClick + ativo manual).
function BottomNavItem({ to, label, icon: Icon, onClick, ativo, corIcone }) {
  const base = 'bottom-nav-item'
  if (to) {
    return (
      <NavLink
        to={to}
        end={to === '/'}
        className={({ isActive }) => `${base} ${isActive ? 'text-marca' : 'text-gray-400'}`}
      >
        {({ isActive }) => (
          <>
            {/* Só o ícone recebe cor quando inativo; selecionado fica azul (herdado). */}
            <Icon size={21} className={isActive ? '' : (corIcone || '')} />
            <span>{label}</span>
          </>
        )}
      </NavLink>
    )
  }
  return (
    <button onClick={onClick} className={`${base} ${ativo ? 'text-marca' : 'text-gray-400'}`}>
      <Icon size={21} className={ativo ? '' : (corIcone || '')} />
      <span>{label}</span>
    </button>
  )
}
export default function Layout({ children }) {
  const [menuMobile, setMenuMobile] = useState(null)
  // Sidebar recolhível: persiste no localStorage entre sessões
  const CHAVE_SIDEBAR = 'almeida_sidebar_recolhida'
  const [recolhida, setRecolhida] = useState(() => {
    try { return localStorage.getItem(CHAVE_SIDEBAR) === '1' } catch { return false }
  })
  function toggleSidebar() {
    setRecolhida(v => {
      const novo = !v
      try { localStorage.setItem(CHAVE_SIDEBAR, novo ? '1' : '0') } catch {}
      return novo
    })
  }
  const { sair, usuario, perfil, ehAdmin, modoConsultoria, consultoriaAlvo, sairModoConsultoria, somenteLeitura } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const nomeExibido = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  // Home não tem seta de voltar; as demais telas internas sim.
  const ehHome = location.pathname === '/'
  // Volta respeitando o histórico de navegação. Se não houver histórico
  // (ex.: entrou direto por link), cai na Home como destino seguro.
  function voltar() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }
  // Fecha os sheets ao trocar de rota
  useEffect(() => { setMenuMobile(null) }, [location.pathname, location.search])
  // Trava o scroll de fundo quando qualquer sheet está aberto
  useEffect(() => {
    const aberto = Boolean(menuMobile)
    document.body.classList.toggle('no-scroll', aberto)
    return () => document.body.classList.remove('no-scroll')
  }, [menuMobile])
  async function handleSair() {
    try {
      await sair()
      // replace: remove a área autenticada do histórico, então "Voltar" não a reabre.
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Erro ao sair:', err)
    }
  }
  return (
    <div className="min-h-[100dvh] flex w-full max-w-full min-w-0">
      {/* ── Sidebar desktop recolhível ── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200/70 fixed top-0 left-0 h-full z-30 transition-[width] duration-200 ${recolhida ? 'w-16' : 'w-60'}`}>
        {/* Cabeçalho da sidebar: logo quando expandida, só ícone quando recolhida */}
        <div className={`border-b border-gray-100 flex items-center ${recolhida ? 'justify-center px-0 py-4' : 'flex-col items-center text-center px-5 pt-6 pb-5'}`}>
          {!recolhida && (
            <>
              <LogoMarca imgClassName="h-16 w-auto" padding="px-5 py-4" />
              <p className="text-[13px] text-gray-500 mt-2.5">Seu dinheiro, organizado.</p>
            </>
          )}
          {recolhida && (
            <LogoMarca imgClassName="h-8 w-auto" padding="px-1 py-1" />
          )}
        </div>
        {/* Navegação agrupada em seções */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
          {navGrupos.map(grupo => {
            const itens = grupo.itens.filter(i => !i.adminOnly || ehAdmin)
            if (itens.length === 0) return null
            return (
              <div key={grupo.titulo}>
                {!recolhida && <SecaoLabel>{grupo.titulo}</SecaoLabel>}
                <div className="space-y-0.5">
                  {itens.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      title={recolhida ? item.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-2 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
                          recolhida ? 'justify-center' : ''
                        } ${isActive ? 'bg-marca text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={19} className={`flex-shrink-0 ${isActive ? '' : item.corIcone || ''}`} />
                          {!recolhida && <span className="flex-1 truncate">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>
        {!recolhida && <UserFooter onSair={handleSair} perfil={perfil} usuario={usuario} />}
        {/* Botão toggle recolher/expandir */}
        <button
          onClick={toggleSidebar}
          aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          className="hidden md:flex items-center justify-center gap-2 px-3 py-3 border-t border-gray-100 text-gray-400 hover:text-marca hover:bg-gray-50 transition-colors text-xs font-medium"
        >
          {recolhida ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /><span>Recolher</span></>}
        </button>
      </aside>
      {/* ── Conteúdo principal (margem esquerda acompanha sidebar) ── */}
      <div className={`flex-1 min-w-0 max-w-full flex flex-col min-h-[100dvh] transition-[margin] duration-200 ${recolhida ? 'md:ml-16' : 'md:ml-60'}`}>
        {/* ── Banner GLOBAL "Modo Consultoria" ──
            Fica fixo no topo de todas as telas internas enquanto o consultor
            visualiza os dados de um cliente (somente leitura). */}
        {modoConsultoria && (
          <div className="sticky top-0 z-40 bg-marca text-white px-4 py-2 flex items-center justify-between gap-3 pt-safe">
            <span className="flex items-center gap-2 text-sm font-medium min-w-0">
              <Eye size={16} className="flex-shrink-0" />
              <span className="truncate">
                Modo Consultoria — Visualizando {consultoriaAlvo?.nome || 'cliente'}
              </span>
            </span>
            <button
              onClick={sairModoConsultoria}
              className="flex-shrink-0 text-xs font-semibold bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1.5 transition-colors"
            >
              Sair da visualização
            </button>
          </div>
        )}
        {/* Header mobile compacto. Na Home: logo à esquerda. Nas telas internas:
            seta de voltar à esquerda. Avatar sempre à direita. */}
        <header className="md:hidden bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between sticky top-0 z-20 pt-safe">
          {ehHome ? (
            <LogoMarca imgClassName="h-7 w-auto" padding="px-2.5 py-1.5" />
          ) : (
            <button
              onClick={voltar}
              aria-label="Voltar"
              className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuMobile('mais')}
            aria-label="Abrir mais ações e minha conta"
            aria-expanded={menuMobile === 'mais'}
          >
            <FotoPerfil perfil={perfil} usuario={usuario} tamanho="sm" />
          </button>
        </header>
        {/* Barra de voltar no DESKTOP (que não tem header). Só fora da Home. */}
        {!ehHome && (
          <div className="hidden md:block px-8 pt-6">
            <button
              onClick={voltar}
              aria-label="Voltar"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={18} /> Voltar
            </button>
          </div>
        )}
        {/* Conteúdo da página. No mobile reserva espaço para a barra inferior.
            IMPORTANTE: o esticamento (flex-1) é aplicado SÓ no desktop (md:flex-1).
            No mobile o <main> fica com a altura NATURAL do conteúdo — sem isso,
            flex-1 + min-h-screen do pai faziam o main crescer até o fim da tela,
            criando o vão em branco acima da barra inferior fixa quando o
            conteúdo era curto. */}
        <main className="md:flex-1 min-w-0 w-full max-w-none px-4 pt-1 pb-mobilenav md:px-6 md:pt-5 md:pb-8 xl:px-8">
          {children}
        </main>
      </div>
      {/* Navegação mobile: cinco destinos, alinhados e sem botão flutuante. */}
      <nav aria-label="Navegação principal" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] flex items-stretch justify-around px-1 pb-safe">
        <BottomNavItem to="/" label="Início" icon={LayoutDashboard} corIcone="text-marca" />
        <BottomNavItem to="/consultoria" label="Consultoria" icon={MessagesSquare} corIcone="text-marca" />
        {somenteLeitura ? (
          <div className="bottom-nav-item text-gray-400" aria-label="Adicionar indisponível no modo somente leitura">
            <Plus size={21} /><span>Adicionar</span>
          </div>
        ) : (
          <BottomNavItem label="Adicionar" icon={Plus} onClick={() => setMenuMobile('adicionar')} ativo={menuMobile === 'adicionar'} corIcone="text-marca" />
        )}
        <BottomNavItem to="/minha-evolucao" label="Evolução" icon={Activity} corIcone="text-violet-400" />
        <BottomNavItem label="Mais" icon={MoreHorizontal} onClick={() => setMenuMobile('mais')} ativo={menuMobile === 'mais'} corIcone="text-marca" />
      </nav>
      <MenusMobileAlmeidaFinance
        aberto={menuMobile}
        onFechar={() => setMenuMobile(null)}
        onNavigate={(rota) => { setMenuMobile(null); navigate(rota) }}
        onSair={handleSair}
      />
    </div>
  )
}