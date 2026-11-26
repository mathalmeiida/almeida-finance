import React, { useState, useEffect, useRef } from 'react'
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
  Users,
  Bell,
  Heart,
  Shield,
  FileText,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import NavegacaoInferior from './NavegacaoInferior'
import LogoMarca from './LogoMarca'
import FotoPerfil from './FotoPerfil'
import MenusMobileAlmeidaFinance from './MenusMobileAlmeidaFinance'

const DividaIcon = TrendingDown

const navGrupos = [
  { id: 'inicio', titulo: 'Início', icon: LayoutDashboard, direto: true, itens: [
    { to: '/',              label: 'Início',         icon: LayoutDashboard, corIcone: 'text-marca'       },
  ] },
  { id: 'financas', titulo: 'Finanças', icon: CreditCard, direto: false, itens: [
    { to: '/receitas',      label: 'Receitas',       icon: TrendingUp,    corIcone: 'text-green-400'    },
    { to: '/despesas',      label: 'Despesas',       icon: TrendingDown,  corIcone: 'text-rose-400'     },
    { to: '/cartoes',       label: 'Cartões',        icon: CreditCard,    corIcone: 'text-sky-400'      },
    { to: '/beneficios',    label: 'Benefícios',     icon: UtensilsCrossed, corIcone: 'text-emerald-400' },
    { to: '/investimentos', label: 'Investimentos',  icon: PiggyBank,     corIcone: 'text-green-400'    },
    { to: '/assinaturas',   label: 'Assinaturas',    icon: Receipt,       corIcone: 'text-purple-400'   },
  ] },
  { id: 'planejamento', titulo: 'Planejamento', icon: CalendarDays, direto: false, itens: [
    { to: '/projecao',      label: 'Projeção',       icon: BarChart2,     corIcone: 'text-marca'        },
    { to: '/fechamento',    label: 'Fechamento',     icon: FileText,      corIcone: 'text-marca'        },
    { to: '/custo-de-vida',  label: 'Custo de Vida',  icon: Receipt,       corIcone: 'text-marca'        },
    { to: '/minha-evolucao', label: 'Minha evolução', icon: Activity,     corIcone: 'text-marca'        },
  ] },
  { id: 'simuladores', titulo: 'Simuladores', icon: ShoppingCart, direto: false, itens: [
    { to: '/posso-comprar', label: 'Posso comprar?', icon: ShoppingCart,  corIcone: 'text-marca'        },
    { to: '/e-se',          label: 'E se...?',       icon: Sparkles,      corIcone: 'text-marca'        },
    { to: '/planejador-dividas', label: 'Dívidas',   icon: DividaIcon,    corIcone: 'text-red-400'      },
  ] },
  { id: 'metas', titulo: 'Metas e patrimônio', icon: Target, direto: false, itens: [
    { to: '/metas',              label: 'Minhas metas',       icon: Target,  corIcone: 'text-amber-400'    },
    { to: '/saude-financeira',   label: 'Saúde Financeira',   icon: Heart,   corIcone: 'text-pink-400'     },
    { to: '/reserva-emergencia', label: 'Reserva Emergência', icon: Shield,  corIcone: 'text-blue-400'     },
  ] },
  { id: 'servicos', titulo: 'Serviços', icon: Users, direto: false, itens: [
    { to: '/familia',       label: 'Almeida Família', icon: Users,        corIcone: 'text-marca', premiumOnly: true },
    { to: '/consultoria',   label: 'Consultoria',    icon: MessagesSquare, corIcone: 'text-marca'       },
    { to: '/admin/whatsapp', label: 'WhatsApp Financeiro', icon: MessagesSquare, corIcone: 'text-marca', adminOnly: true },
    { to: '/central-importacao', label: 'Importação', icon: Upload,       corIcone: 'text-marca'        },
  ] },
  { id: 'configuracoes', titulo: 'Configurações', icon: Settings, direto: false, itens: [
    { to: '/mais/perfil',   label: 'Meu perfil',     icon: UserRound,     corIcone: 'text-marca'        },
    { to: '/configuracoes', label: 'Configurações',  icon: Settings,      corIcone: 'text-gray-400'     },
    { to: '/alertas',       label: 'Alertas',        icon: Bell,          corIcone: 'text-red-400'      },
    { to: '/mais/funcionalidades', label: 'Funcionalidades', icon: Grid2X2, corIcone: 'text-marca'    },
    { to: '/mais/ajuda',    label: 'Ajuda & feedback', icon: CircleHelp,  corIcone: 'text-amber-400'    },
    { to: '/mais/sobre',    label: 'Sobre o app',    icon: Info,          corIcone: 'text-marca'        },
  ] },
  { id: 'admin', titulo: 'Admin', icon: ShieldCheck, direto: true, itens: [
    { to: '/admin',         label: 'Admin',          icon: ShieldCheck,   corIcone: 'text-marca', adminOnly: true },
  ] },
];

function rotaAtiva(pathname, rota) {
  return rota === '/' ? pathname === '/' : pathname === rota || pathname.startsWith(rota + '/')
}

function grupoDaRota(pathname) {
  return navGrupos.find(g => !g.direto && g.itens.some(i => rotaAtiva(pathname, i.to)))?.id || null
}

function NavItem({ item, recolhida = false, subitem = false }) {
  return (
    <NavLink to={item.to} end={item.to === '/' || item.to === '/admin'} title={recolhida ? item.label : undefined}
      aria-label={item.label}
      className={({ isActive }) => `flex items-center gap-3 rounded-xl text-sm font-medium transition-colors ${recolhida ? 'justify-center px-1 py-3' : subitem ? 'px-3 py-2.5' : 'px-3 py-3'} ${isActive ? 'bg-marca text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
      {({ isActive }) => <>
        <item.icon size={subitem ? 17 : 20} className={`shrink-0 ${isActive ? '' : 'text-marca'}`} />
        {!recolhida && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      </>}
    </NavLink>
  )
}

function UserFooter({ onSair, perfil, usuario }) {
  const nomeExibido = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  return (
    <div className="shrink-0 px-3 pt-2 pb-2 border-t border-gray-100">
      <NavLink to="/mais/perfil" className="flex items-center gap-3 px-1 py-2 mb-1 rounded-lg hover:bg-gray-100">
        <FotoPerfil perfil={perfil} usuario={usuario} tamanho="sm" />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-gray-800 truncate">{nomeExibido}</p>
          <p className="text-xs text-gray-400 truncate">{usuario?.email}</p>
        </div>
      </NavLink>
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
  const [grupoAberto, setGrupoAberto] = useState(() => grupoDaRota(location.pathname))
  useEffect(() => {
    setGrupoAberto(grupoDaRota(location.pathname))
  }, [location.pathname])

  function abrirGrupo(id) {
    if (recolhida) {
      toggleSidebar()
      setGrupoAberto(id)
    } else {
      setGrupoAberto(atual => atual === id ? null : id)
    }
  }
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
  // Reserva exata para o menu inferior: mede a altura real (itens + área segura) e
  // publica em --af-nav-h; o conteúdo reserva essa altura + um respiro pequeno.
  const navRef = useRef(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return undefined
    const aplicar = () => document.documentElement.style.setProperty('--af-nav-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    aplicar()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(aplicar); ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.removeProperty('--af-nav-h') }
  }, [])
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
    <div className="min-h-[100dvh] flex w-full max-w-full min-w-0 standalone:min-h-screen">
      {/* ── Sidebar desktop recolhível ── */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-gray-200/70 fixed top-0 left-0 h-full z-30 transition-[width] duration-200 ${recolhida ? 'w-16' : 'w-60'}`}>
        <div className={`shrink-0 border-b border-gray-100 flex items-center ${recolhida ? 'justify-center py-3' : 'gap-2 px-3 py-4'}`}>
          <LogoMarca imgClassName={recolhida ? 'h-8 w-auto' : 'h-10 w-auto'} padding="px-1 py-1" />
          {!recolhida && <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">Almeida Finance</p>
            <p className="text-[11px] text-gray-500">Seu dinheiro, organizado.</p>
          </div>}
        </div>
        <nav aria-label="Menu principal" className="flex-1 min-h-0 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-1">
          {navGrupos.map(grupo => {
            const itens = grupo.itens.filter(i => {
              if (i.adminOnly && !ehAdmin) return false
              if (i.premiumOnly && perfil?.subscription_plan === 'free') return false
              return true
            })
            if (!itens.length) return null
            if (grupo.direto) return <NavItem key={grupo.id} item={itens[0]} recolhida={recolhida} />
            const ativo = itens.some(i => rotaAtiva(location.pathname, i.to))
            const aberto = !recolhida && grupoAberto === grupo.id
            return (
              <div key={grupo.id}>
                <button type="button" onClick={() => abrirGrupo(grupo.id)}
                  title={recolhida ? grupo.titulo : undefined}
                  aria-label={grupo.titulo} aria-expanded={aberto}
                  aria-controls={`af-menu-${grupo.id}`}
                  className={`w-full flex items-center gap-3 rounded-xl text-sm font-semibold transition-colors ${recolhida ? 'justify-center px-1 py-3' : 'px-3 py-3'} ${ativo ? 'bg-marca-100 text-marca' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                  <grupo.icon size={20} className="shrink-0 text-marca" />
                  {!recolhida && <><span className="flex-1 text-left truncate">{grupo.titulo}</span><ChevronDown size={16} className={`shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} /></>}
                </button>
                <div id={`af-menu-${grupo.id}`} hidden={!aberto} className="ml-4 pl-2 mt-1 mb-2 border-l border-gray-200 space-y-0.5">
                  {itens.map(item => <NavItem key={item.to} item={item} subitem />)}
                </div>
              </div>
            )
          })}
        </nav>
        {!recolhida && <UserFooter onSair={handleSair} perfil={perfil} usuario={usuario} />}
        {recolhida && <button type="button" onClick={handleSair} title="Sair" aria-label="Sair" className="shrink-0 flex justify-center py-3 text-gray-500 hover:text-red-600"><LogOut size={18} /></button>}
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
      <div className={`flex-1 min-w-0 max-w-full flex flex-col min-h-[100dvh] standalone:min-h-screen transition-[margin] duration-200 ${recolhida ? 'md:ml-16' : 'md:ml-60'}`}>
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
        {/* Header mobile: apenas nas telas internas (seta voltar + avatar).
            Na Home não renderiza nada pois tem cabeçalho próprio. */}
        {!ehHome && (
          <header className="af-header-mobile md:hidden bg-white border-b border-gray-100 px-4 flex items-center justify-between sticky top-0 z-20">
            <button
              onClick={voltar}
              aria-label="Voltar"
              className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft size={22} />
            </button>
            <button
            type="button"
              onClick={() => setMenuMobile('mais')}
              aria-label="Abrir mais ações e minha conta"
              aria-expanded={menuMobile === 'mais'}
            >
              <FotoPerfil perfil={perfil} usuario={usuario} tamanho="sm" />
            </button>
          </header>
        )}
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
            IMPORTANTE: usa flex-1 para esticar até o fim disponível sem forçar altura
            adicional. O padding pb-mobilenav já garante o espaço para o menu. */}
        <main className="flex-1 min-w-0 w-full max-w-none px-4 pt-1 pb-mobilenav md:px-6 md:pt-5 md:pb-8 xl:px-8">
          {children}
        </main>
      </div>

      {/* Navegação mobile nova */}
      <NavegacaoInferior />

      <MenusMobileAlmeidaFinance
        aberto={menuMobile}
        onFechar={() => setMenuMobile(null)}
        onNavigate={(rota) => { setMenuMobile(null); navigate(rota) }}
        onSair={handleSair}
      />
    </div>
  )
}