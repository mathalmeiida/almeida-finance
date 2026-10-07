import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { OcultarValoresProvider } from './contexts/OcultarValoresContext'
import { useOnboarding } from './hooks/useOnboarding'
import Layout from './components/Layout'
import Onboarding from './pages/Onboarding'
import ErrorBoundary from './components/ErrorBoundary'
import Splash from './components/Splash'
import SolicitacaoConsultoria from './components/SolicitacaoConsultoria'
import { useConsultoriaAcessos } from './hooks/useConsultoriaAcessos'

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

// Gatilho de "refazer configuração financeira": a tela de Configurações grava
// esta flag no localStorage e redireciona para a Home; aqui o onboarding é
// reaberto mesmo que a conta já tenha dados (não depende de conta vazia).
const CHAVE_REFAZER = 'almeida_refazer_onboarding'

// Decide, para o usuário já autenticado, entre: conta desativada, onboarding
// (primeiro acesso OU refazer) ou o app normal.
function AreaAutenticada({ children }) {
  const { usuario, perfil, contaDesativada, modoConsultoria } = useAuth()
  const { verificando, precisaOnboarding, concluir } = useOnboarding()
  // Solicitações de consultoria direcionadas a ESTE usuário (como cliente).
  const { pendentesParaMim, autorizar, recusar } = useConsultoriaAcessos()
  const [respondendoConsultoria, setRespondendoConsultoria] = useState(false)

  // Responde (autoriza/recusa) a solicitação de consultoria pendente mais recente.
  const responderConsultoria = useCallback(async (status) => {
    const alvo = pendentesParaMim[0]
    if (!alvo) return
    setRespondendoConsultoria(true)
    try {
      if (status === 'autorizado') await autorizar(alvo.id)
      else await recusar(alvo.id)
    } finally {
      setRespondendoConsultoria(false)
    }
  }, [pendentesParaMim, autorizar, recusar])

  // Flag de "refazer" lida do localStorage (setada em Configurações).
  const [refazer, setRefazer] = useState(() => {
    try { return localStorage.getItem(CHAVE_REFAZER) === '1' } catch { return false }
  })

  // Reage caso a flag seja alterada em outra aba/fluxo.
  useEffect(() => {
    function sync() {
      try { setRefazer(localStorage.getItem(CHAVE_REFAZER) === '1') } catch { /* ignore */ }
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const encerrarOnboarding = useCallback(async () => {
    try { localStorage.removeItem(CHAVE_REFAZER) } catch { /* ignore */ }
    setRefazer(false)
    await concluir() // grava onboarding_concluido = true
  }, [concluir])

  // Enquanto o perfil não carrega, não decide nada (evita piscar telas).
  if (usuario && perfil == null) return <Carregando />
  // Conta desativada tem prioridade sobre qualquer outra tela.
  if (contaDesativada) return <ContaDesativada />
  // Enquanto verifica o status do onboarding, aguarda (evita piscar o app).
  if (verificando) return <Carregando />
  // Onboarding: primeiro acesso (precisaOnboarding) OU refazer manual.
  if (precisaOnboarding || refazer) {
    return <Onboarding aoConcluir={encerrarOnboarding} />
  }
  // Solicitação de consultoria pendente para o cliente: mostra a tela de
  // autorização antes do app. Não aplica quando o próprio usuário está no modo
  // consultoria (visualizando outra conta) — ali ele é o consultor, não o alvo.
  if (!modoConsultoria && pendentesParaMim.length > 0) {
    return (
      <SolicitacaoConsultoria
        solicitacao={pendentesParaMim[0]}
        aoResponder={responderConsultoria}
        processando={respondendoConsultoria}
      />
    )
  }
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
  // Splash de abertura (~2s no total). O AuthProvider e as rotas ficam montados
  // por baixo, então a sessão carrega durante a splash e, quando ela some, o app
  // cai direto em Login ou Home sem piscar.
  //  - fade-in da logo: ~0,6s (no CSS .animate-splash-logo)
  //  - permanece visível até ~1,5s
  //  - fade-out suave de 0,5s (1,5s → 2,0s)
  //  - remove a splash em ~2,0s
  const [mostrarSplash, setMostrarSplash] = useState(true)
  const [saindoSplash, setSaindoSplash] = useState(false)

  useEffect(() => {
    const tFadeOut = setTimeout(() => setSaindoSplash(true), 1500)
    const tRemover = setTimeout(() => setMostrarSplash(false), 2000)
    return () => {
      clearTimeout(tFadeOut)
      clearTimeout(tRemover)
    }
  }, [])

  return (
    <ErrorBoundary>
      {mostrarSplash && <Splash saindo={saindoSplash} />}
      <BrowserRouter>
        <AuthProvider>
          <OcultarValoresProvider>
            <Rotas />
          </OcultarValoresProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
