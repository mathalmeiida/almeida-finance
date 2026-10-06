import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OcultarValoresProvider } from './contexts/OcultarValoresContext'
import Layout from './components/Layout'

// Páginas autenticadas
import Dashboard from './pages/Dashboard'
import Receitas from './pages/Receitas'
import Despesas from './pages/Despesas'
import Cartoes from './pages/Cartoes'
import Projecao from './pages/Projecao'
import PossoComprar from './pages/PossoCComprar'
import Metas from './pages/Metas'
import Consultoria from './pages/Consultoria'
import Configuracoes from './pages/Configuracoes'
import Admin from './pages/Admin'

// Páginas públicas (autenticação)
import Login from './pages/auth/Login'
import Cadastro from './pages/auth/Cadastro'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import ConfirmarEmail from './pages/auth/ConfirmarEmail'

// Tela de carregamento enquanto verifica a sessão
function Carregando() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    </div>
  )
}

// Guarda de rota: redireciona para /login se não autenticado
function RotaPrivada({ children }) {
  const { autenticado, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (!autenticado) return <Navigate to="/login" replace />
  return children
}

// Tela exibida quando a conta foi desativada por um administrador.
// O usuário não acessa o app (e a RLS já bloqueia os dados no banco).
function ContaDesativada() {
  const { sair } = useAuth()
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Conta desativada</h1>
        <p className="text-sm text-gray-500 mb-6">
          Sua conta foi desativada e o acesso ao Almeida Finance está suspenso no momento.
          Seus dados foram preservados. Se achar que isso é um engano, entre em contato com o
          administrador.
        </p>
        <button onClick={() => sair()} className="btn-secondary w-full">Sair</button>
      </div>
    </div>
  )
}

// Decide, para o usuário já autenticado, entre: conta desativada ou o app normal.
// O tutorial/onboarding obrigatório de primeiro acesso foi desativado — a
// orientação inicial agora é feita pelo card "Complete sua configuração" na Home.
function AreaAutenticada({ children }) {
  const { usuario, perfil, contaDesativada } = useAuth()
  // Enquanto o perfil não carrega, não decide nada (evita piscar telas).
  if (usuario && perfil == null) return <Carregando />
  // Conta desativada tem prioridade sobre qualquer outra tela.
  if (contaDesativada) return <ContaDesativada />
  return children
}

// Guarda de rota de administrador. A segurança real está no banco (RLS +
// função e_admin); aqui apenas evitamos exibir a página a quem não é admin,
// inclusive se digitar /admin na URL — nesse caso redireciona para a Início.
function RotaAdmin({ children }) {
  const { usuario, perfil, ehAdmin } = useAuth()
  // Perfil ainda carregando (usuário autenticado mas perfil não chegou).
  if (usuario && perfil == null) return <Carregando />
  if (!ehAdmin) return <Navigate to="/" replace />
  return children
}

// Guarda de rota pública: redireciona para / se já autenticado
function RotaPublica({ children }) {
  const { autenticado, carregando } = useAuth()
  if (carregando) return <Carregando />
  if (autenticado) return <Navigate to="/" replace />
  return children
}

function Rotas() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/login" element={<RotaPublica><Login /></RotaPublica>} />
      <Route path="/cadastro" element={<RotaPublica><Cadastro /></RotaPublica>} />
      <Route path="/recuperar-senha" element={<RotaPublica><RecuperarSenha /></RotaPublica>} />
      {/* Redefinir senha: rota independente — o usuário chega com sessão de recuperação
          vinda do link do e-mail, então NÃO passa por RotaPublica/RotaPrivada */}
      <Route path="/redefinir-senha" element={<RedefinirSenha />} />
      {/* Confirmação de e-mail: destino do link "Confirmar cadastro". Rota
          independente — processa o retorno do Supabase (code/#access_token) na
          MESMA aba, mostra a mensagem e redireciona. Não passa pelos guards
          para o redirect automático não interromper o processamento. */}
      <Route path="/auth/callback" element={<ConfirmarEmail />} />

      {/* Rotas privadas — todas dentro do Layout */}
      <Route
        path="/*"
        element={
          <RotaPrivada>
            <AreaAutenticada>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/receitas" element={<Receitas />} />
                <Route path="/despesas" element={<Despesas />} />
                {/* Parcelamentos foi integrado à tela de Despesas (aba "Parceladas") */}
                <Route path="/parcelamentos" element={<Navigate to="/despesas" replace />} />
                <Route path="/cartoes" element={<Cartoes />} />
                <Route path="/projecao" element={<Projecao />} />
                <Route path="/posso-comprar" element={<PossoComprar />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="/consultoria" element={<Consultoria />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/admin" element={<RotaAdmin><Admin /></RotaAdmin>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
            </AreaAutenticada>
          </RotaPrivada>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OcultarValoresProvider>
          <Rotas />
        </OcultarValoresProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
