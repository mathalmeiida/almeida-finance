import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LogoMarca from '../../components/LogoMarca'

export default function Login() {
  const { entrar } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', senha: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErro('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      await entrar({ email: form.email, senha: form.senha })
      navigate('/')
    } catch (err) {
      setErro(traduzirErro(err.message))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo (branco) sobre painel na cor da marca p/ contraste no claro */}
        <div className="flex justify-center mb-8">
          <LogoMarca imgClassName="w-[180px] h-auto" padding="px-7 py-5" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900">Bem-vindo de volta</h2>
          <p className="text-sm text-gray-500 mt-1 mb-5">Entre para continuar cuidando das suas finanças.</p>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  className="input pl-9"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="label">Senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  name="senha"
                  value={form.senha}
                  onChange={handleChange}
                  placeholder="Sua senha"
                  className="input pl-9 pr-10"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="flex justify-end mt-1.5">
                <Link to="/recuperar-senha" className="text-xs text-marca hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {carregando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Card discreto de privacidade — mesmo padrão da tela de cadastro.
            Apenas afirmações verificáveis, sem promessas não comprovadas. */}
        <div className="bg-white/70 border border-gray-100 rounded-2xl p-4 mt-4">
          <div className="flex items-center gap-2">
            <Lock size={16} className="text-marca flex-shrink-0" />
            <h3 className="text-sm font-semibold text-gray-900">Sua privacidade importa</h3>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Seus dados financeiros são pessoais e merecem proteção.
          </p>
          <ul className="mt-3 space-y-1.5">
            <li className="flex items-start gap-2 text-xs text-gray-600">
              <ShieldCheck size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
              Utilizamos controles de acesso para proteger suas informações.
            </li>
            <li className="flex items-start gap-2 text-xs text-gray-600">
              <EyeOff size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
              Você pode ocultar valores financeiros dentro do aplicativo.
            </li>
          </ul>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          Não tem conta?{' '}
          <Link to="/cadastro" className="text-marca font-medium hover:underline">
            Criar conta gratuita
          </Link>
        </p>
      </div>
    </div>
  )
}

// Traduz as mensagens de erro do Supabase para português
function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials'))
    return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed'))
    return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (m.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (m.includes('user not found'))
    return 'Nenhuma conta encontrada com este e-mail.'
  return 'Erro ao entrar. Tente novamente.'
}
