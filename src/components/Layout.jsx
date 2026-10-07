import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CreditCard,
  BarChart2,
  ShoppingCart,
  Target,
  MessagesSquare,
  Settings,
  ShieldCheck,
  MoreHorizontal,
  Plus,
  Receipt,
  PiggyBank,
  X,
  LogOut,
  ArrowLeft,
  Eye,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logoAlmeida from '../assets/Logo Corporativo Almeida Finance.png'

// Agrupamento VISUAL da sidebar desktop (mesmas rotas/itens de navItems,
// apenas organizados em seções). As permissões seguem iguais: itens com
// adminOnly só aparecem quando ehAdmin (filtrado na renderização).
const navGrupos = [
  { titulo: 'Principal', itens: [
    { to: '/',              label: 'Início',         icon: LayoutDashboard, corIcone: 'text-blue-400'   },
  ]},
  { titulo: 'Finanças', itens: [
    { to: '/receitas',      label: 'Receitas',       icon: TrendingUp,    corIcone: 'text-green-400'    },
    { to: '/despesas',      label: 'Despesas',       icon: TrendingDown,  corIcone: 'text-rose-400'     },
    { to: '/cartoes',       label: 'Cartões',        icon: CreditCard,    corIcone: 'text-sky-400'      },
    { to: '/projecao',      label: 'Projeção',       icon: BarChart2,     corIcone: 'text-violet-400'   },
  ]},
  { titulo: 'Planejamento', itens: [
    { to: '/posso-comprar', label: 'Simular compra', icon: ShoppingCart,  corIcone: 'text-blue-400'     },
    { to: '/metas',         label: 'Metas',          icon: Target,        corIcone: 'text-amber-400'    },
    { to: '/consultoria',   label: 'Consultoria',    icon: MessagesSquare, corIcone: 'text-cyan-400' },
  ]},
  { titulo: 'Conta', itens: [
    { to: '/configuracoes', label: 'Configurações',  icon: Settings,      corIcone: 'text-gray-400'     },
  ]},
  { titulo: 'Administração', itens: [
    { to: '/admin',         label: 'Admin',          icon: ShieldCheck,   corIcone: 'text-violet-400', adminOnly: true },
  ]},
]

// Itens que aparecem no sheet "Mais" (mobile)
const maisItems = [
  { to: '/receitas',      label: 'Receitas',       icon: TrendingUp,    corIcone: 'text-green-400'  },
  { to: '/cartoes',       label: 'Cartões',        icon: CreditCard,    corIcone: 'text-sky-400'    },
  { to: '/projecao',      label: 'Projeção',       icon: BarChart2,     corIcone: 'text-violet-400' },
  { to: '/metas',         label: 'Metas',          icon: Target,        corIcone: 'text-amber-400'  },
  { to: '/consultoria',   label: 'Consultoria',    icon: MessagesSquare, corIcone: 'text-cyan-400' },
  { to: '/configuracoes', label: 'Configurações',  icon: Settings,      corIcone: 'text-gray-400'   },
  { to: '/admin',         label: 'Admin',          icon: ShieldCheck,   corIcone: 'text-violet-400', adminOnly: true },
]

// Ações do botão central "+". Cada opção NAVEGA para a página do fluxo e passa
// um parâmetro (?novo=...) que faz a própria página abrir o modal/formulário
// JÁ existente. Não há formulário novo nem regra duplicada — é só um atalho.
const acoesRapidas = [
  { to: '/?novo=gasto',       label: 'Gasto rápido',      desc: 'Registre uma compra em segundos',  icon: Receipt,     cor: 'text-rose-500',   bg: 'bg-rose-50'   },
  { to: '/receitas?novo=1',   label: 'Nova receita',      desc: 'Registre uma entrada',             icon: TrendingUp,  cor: 'text-green-600',  bg: 'bg-green-50'  },
  { to: '/cartoes',           label: 'Compra no cartão',  desc: 'Registre uma compra no cartão',    icon: CreditCard,  cor: 'text-blue-600',   bg: 'bg-blue-50'   },
  { to: '/?novo=reserva',     label: 'Atualizar reserva', desc: 'Informe quanto possui na reserva', icon: PiggyBank,   cor: 'text-violet-600', bg: 'bg-violet-50' },
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
            ? 'bg-blue-600 text-white shadow-sm'
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
  const iniciais = nomeExibido.slice(0, 2).toUpperCase()

  return (
    <div className="px-4 pt-3 pb-4 border-t border-gray-100">
      <div className="flex items-center gap-3 px-1 py-2 mb-1">
        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-blue-700">{iniciais}</span>
        </div>
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
        className={({ isActive }) => `${base} ${isActive ? 'text-blue-500' : 'text-gray-400'}`}
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
    <button onClick={onClick} className={`${base} ${ativo ? 'text-blue-500' : 'text-gray-400'}`}>
      <Icon size={21} className={ativo ? '' : (corIcone || '')} />
      <span>{label}</span>
    </button>
  )
}

export default function Layout({ children }) {
  const [maisAberto, setMaisAberto] = useState(false)
  const [acoesAberto, setAcoesAberto] = useState(false)
  const { sair, usuario, perfil, ehAdmin, modoConsultoria, consultoriaAlvo, sairModoConsultoria, somenteLeitura } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const itensMais = maisItems.filter(item => !item.adminOnly || ehAdmin)

  const nomeExibido = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const iniciais = nomeExibido.slice(0, 2).toUpperCase()

  // Alguma rota do "Mais" está ativa? (destaca o botão Mais na barra inferior)
  const maisAtivo = itensMais.some(i => location.pathname.startsWith(i.to) && i.to !== '/')

  // Home não tem seta de voltar; as demais telas internas sim.
  const ehHome = location.pathname === '/'
  // Volta respeitando o histórico de navegação. Se não houver histórico
  // (ex.: entrou direto por link), cai na Home como destino seguro.
  function voltar() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  // Fecha os sheets ao trocar de rota
  useEffect(() => { setMaisAberto(false); setAcoesAberto(false) }, [location.pathname])

  // Trava o scroll de fundo quando qualquer sheet está aberto
  useEffect(() => {
    const aberto = maisAberto || acoesAberto
    document.body.classList.toggle('no-scroll', aberto)
    return () => document.body.classList.remove('no-scroll')
  }, [maisAberto, acoesAberto])

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
      {/* ── Sidebar desktop (redesenho visual; rotas/permissões inalteradas) ── */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-200/70 fixed top-0 left-0 h-full z-30">
        {/* Logo + subtítulo. Logo transparente sobre o próprio fundo da
            sidebar (sem quadrado/background atrás da imagem). */}
        <div className="px-5 pt-6 pb-5 border-b border-gray-100 flex flex-col items-center text-center">
          <img src={logoAlmeida} alt="Almeida Finance" className="h-24 w-auto object-contain" />
          <p className="text-[13px] text-gray-500 mt-2">Controle financeiro</p>
        </div>

        {/* Navegação agrupada em seções */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          {navGrupos.map(grupo => {
            const itens = grupo.itens.filter(i => !i.adminOnly || ehAdmin)
            if (itens.length === 0) return null
            return (
              <div key={grupo.titulo}>
                <SecaoLabel>{grupo.titulo}</SecaoLabel>
                <div className="space-y-0.5">
                  {itens.map(item => (
                    <NavItem key={item.to} item={item} />
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <UserFooter onSair={handleSair} perfil={perfil} usuario={usuario} />
      </aside>

      {/* ── Conteúdo principal ── */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* ── Banner GLOBAL "Modo Consultoria" ──
            Fica fixo no topo de todas as telas internas enquanto o consultor
            visualiza os dados de um cliente (somente leitura). */}
        {modoConsultoria && (
          <div className="sticky top-0 z-40 bg-blue-600 text-white px-4 py-2 flex items-center justify-between gap-3 pt-safe">
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
            <img src={logoAlmeida} alt="Almeida Finance" className="h-[38px] w-auto object-contain" />
          ) : (
            <button
              onClick={voltar}
              aria-label="Voltar"
              className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
            >
              <ArrowLeft size={22} />
            </button>
          )}
          <NavLink
            to="/configuracoes"
            className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0"
            aria-label="Minha conta"
          >
            <span className="text-xs font-bold text-blue-700">{iniciais}</span>
          </NavLink>
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

        {/* Conteúdo da página. No mobile reserva espaço para a barra inferior. */}
        <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto pb-mobilenav md:pb-8">
          {children}
        </main>
      </div>

      {/* ── Barra de navegação inferior premium (apenas mobile) ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-1px_12px_rgba(0,0,0,0.06)] flex items-end justify-around px-1 pb-safe">
        <BottomNavItem to="/" label="Início" icon={LayoutDashboard} corIcone="text-blue-400" />
        <BottomNavItem to="/despesas" label="Despesas" icon={TrendingDown} corIcone="text-rose-400" />

        {/* Botão central "+" em destaque (ações rápidas).
            Oculto no modo consultoria (somente leitura): o consultor não cria
            nem edita dados do cliente. */}
        <div className="flex-1 flex justify-center">
          {!somenteLeitura && (
            <button
              onClick={() => setAcoesAberto(true)}
              aria-label="Adicionar"
              className="-mt-5 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all"
            >
              <Plus size={26} />
            </button>
          )}
        </div>

        <BottomNavItem to="/posso-comprar" label="Simular" icon={ShoppingCart} corIcone="text-blue-400" />
        <BottomNavItem label="Mais" icon={MoreHorizontal} onClick={() => setMaisAberto(true)} ativo={maisAtivo || maisAberto} />
      </nav>

      {/* ── Sheet de ações rápidas do "+" (apenas mobile) ── */}
      {acoesAberto && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAcoesAberto(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl pb-safe">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">O que você quer adicionar?</h3>
              <button
                onClick={() => setAcoesAberto(false)}
                className="touch-target rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              {acoesRapidas.map(a => (
                <button
                  key={a.to}
                  onClick={() => { setAcoesAberto(false); navigate(a.to) }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${a.bg}`}>
                    <a.icon size={20} className={a.cor} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800">{a.label}</span>
                    <span className="block text-xs text-gray-500">{a.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sheet "Mais" (apenas mobile) ── */}
      {maisAberto && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMaisAberto(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl shadow-xl pb-safe max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Mais opções</h3>
              <button
                onClick={() => setMaisAberto(false)}
                className="touch-target rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {itensMais.map(item => (
                <NavItem key={item.to} item={item} onClick={() => setMaisAberto(false)} />
              ))}
              <button
                onClick={handleSair}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} /> <span>Sair</span>
              </button>
            </nav>
            {/* Identificação do usuário no rodapé do sheet */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-blue-700">{iniciais}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{nomeExibido}</p>
                <p className="text-xs text-gray-400 truncate">{usuario?.email}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
