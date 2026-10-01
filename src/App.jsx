import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

// Páginas autenticadas
import Dashboard from './pages/Dashboard'
import Receitas from './pages/Receitas'
import Despesas from './pages/Despesas'
import Projecao from './pages/Projecao'
import PossoComprar from './pages/PossoCComprar'
import Metas from './pages/Metas'

// Páginas públicas (autenticação)
import Login from './pages/auth/Login'
import Cadastro from './pages/auth/Cadastro'

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

      {/* Rotas privadas — todas dentro do Layout */}
      <Route
        path="/*"
        element={
          <RotaPrivada>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/receitas" element={<Receitas />} />
                <Route path="/despesas" element={<Despesas />} />
                {/* Parcelamentos foi integrado à tela de Despesas (aba "Parceladas") */}
                <Route path="/parcelamentos" element={<Navigate to="/despesas" replace />} />
                <Route path="/projecao" element={<Projecao />} />
                <Route path="/posso-comprar" element={<PossoComprar />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
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
        <Rotas />
      </AuthProvider>
    </BrowserRouter>
  )
}
