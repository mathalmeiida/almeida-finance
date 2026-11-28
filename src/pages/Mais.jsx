import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserRound, Settings, Grid2X2, CircleHelp, Info,
  LogOut, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import FotoPerfil from '../components/FotoPerfil'

// ─── Mais ─────────────────────────────────────────────────────────────────────
// Versão desktop/página da navegação "Mais".
// Exibe as mesmas 5 opções do menu mobile com destinos corretos.
// Em mobile esta rota não é usada diretamente (o sheet substitui),
// mas fica disponível como página normal no desktop.

const ITENS = [
  { titulo: 'Usuários e acessos', detalhe: 'Ambientes pessoal, familiar e empresarial', Icone: UserRound, rota: '/acessos', bgIcon: 'bg-surface-2', corIcon: 'text-marca' },
  { titulo: 'Planos e assinatura', detalhe: 'Conheça os planos', Icone: Settings, rota: '/planos', bgIcon: 'bg-surface-2', corIcon: 'text-marca' },
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
    bgIcon: 'bg-surface-2',
    corIcon: 'text-marca',
  },
  {
    titulo: 'Todas as funcionalidades',
    detalhe: 'Acessar os recursos do app',
    Icone: Grid2X2,
    rota: '/mais/funcionalidades',
    bgIcon: 'bg-surface-2',
    corIcon: 'text-marca',
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

  async function handleSair() {
    try { await sair(); navigate('/login', { replace: true }) }
    catch (e) { console.error('Erro ao sair:', e) }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-mobilenav md:pb-8">
      {/* Cabeçalho com perfil - horizontal no desktop, compacto no mobile */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
          <FotoPerfil perfil={perfil} usuario={usuario} tamanho="lg" />
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{nome}</h1>
            <p className="text-sm text-gray-500 mb-3">{email}</p>
            <button
              type="button"
              onClick={handleSair}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </div>
      </div>

      {/* Grid de opções - 2 colunas no tablet, 3 no desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ITENS.map(item => (
          <button
            key={item.rota}
            type="button"
            onClick={() => navigate(item.rota)}
            className="card !p-6 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="flex items-start gap-4 mb-3">
              <span
                className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${item.bgIcon} group-hover:scale-110 transition-transform`}
              >
                <item.Icone size={24} className={item.corIcon} />
              </span>
              <ChevronRight size={18} className="text-gray-400 group-hover:text-marca transition-colors mt-3" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{item.titulo}</h3>
            <p className="text-sm text-gray-500">{item.detalhe}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
