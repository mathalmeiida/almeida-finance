import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserRound, Settings, Grid2X2, CircleHelp, Info,
  LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

// ─── Mais ─────────────────────────────────────────────────────────────────────
// Versão desktop/página da navegação "Mais".
// Exibe as mesmas 5 opções do menu mobile com destinos corretos.
// Em mobile esta rota não é usada diretamente (o sheet substitui),
// mas fica disponível como página normal no desktop.

const ITENS = [
  {
    titulo: 'Meu perfil',
    detalhe: 'Dados pessoais e segurança',
    Icone: UserRound,
    rota: '/mais/perfil',
    bgIcon: 'bg-marca-100',
    corIcon: 'text-marca',
  },
  {
    titulo: 'Configurações',
    detalhe: 'Tema, notificações e preferências',
    Icone: Settings,
    rota: '/configuracoes',
    bgIcon: 'bg-violet-100',
    corIcon: 'text-violet-600',
  },
  {
    titulo: 'Todas as funcionalidades',
    detalhe: 'Acessar os recursos do app',
    Icone: Grid2X2,
    rota: '/mais/funcionalidades',
    bgIcon: 'bg-blue-100',
    corIcon: 'text-blue-600',
  },
  {
    titulo: 'Ajuda & feedback',
    detalhe: 'Dúvidas, suporte e sugestões',
    Icone: CircleHelp,
    rota: '/mais/ajuda',
    bgIcon: 'bg-amber-100',
    corIcon: 'text-amber-600',
  },
  {
    titulo: 'Sobre o Almeida Finance',
    detalhe: 'Informações do aplicativo',
    Icone: Info,
    rota: '/mais/sobre',
    bgIcon: 'bg-cyan-100',
    corIcon: 'text-cyan-600',
  },
]

export default function Mais() {
  const navigate = useNavigate()
  const { sair, perfil, usuario } = useAuth()

  const nome    = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const email   = usuario?.email || ''
  const iniciais = nome.slice(0, 2).toUpperCase()

  async function handleSair() {
    try { await sair(); navigate('/login', { replace: true }) }
    catch (e) { console.error('Erro ao sair:', e) }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-mobilenav md:pb-8">
      {/* Avatar + dados do usuário */}
      <div className="card flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-white text-lg font-bold"
          style={{ background: 'linear-gradient(135deg,#801D39,#420D1D)' }}
        >
          {iniciais}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{nome}</p>
          <p className="text-xs text-gray-500 truncate">{email}</p>
        </div>
      </div>

      {/* Lista de itens */}
      <div className="card !p-0 divide-y divide-gray-100 overflow-hidden">
        {ITENS.map(item => (
          <button
            key={item.rota}
            type="button"
            onClick={() => navigate(item.rota)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            <span
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bgIcon}`}
            >
              <item.Icone size={20} className={item.corIcon} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{item.titulo}</p>
              <p className="text-xs text-gray-500">{item.detalhe}</p>
            </div>
            <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Sair */}
      <button
        type="button"
        onClick={handleSair}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
      >
        <LogOut size={18} /> Sair da conta
      </button>
    </div>
  )
}
