import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import logoAlmeida from '../../assets/Logo Corporativo Almeida Finance.png'

export default function Cadastro() {
  const { cadastrar } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ nome: '', email: '', senha: '', confirmarSenha: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setErro('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')

    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (form.senha !== form.confirmarSenha) {
      setErro('As senhas não coincidem.')
      return
    }

    setCarregando(true)
    try {
      await cadastrar({ nome: form.nome, email: form.email, senha: form.senha })
      setSucesso(true)
    } catch (err) {
      setErro(traduzirErro(err.message))
    } finally {
      setCarregando(false)
    }
  }

  // Tela de sucesso (quando o Supabase exige confirmação por e-mail)
  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Conta criada!</h2>
            <p className="text-gray-500 text-sm mb-6">
              Enviamos um e-mail de confirmação para <strong>{form.email}</strong>.
              Clique no link do e-mail para ativar sua conta e depois faça login.
            </p>
            <Link to="/login" className="btn-primary block text-center">
              Ir para o login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Força de senha
  const forca = calcularForcaSenha(form.senha)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src={logoAlmeida}
            alt="Almeida Finance"
            className="w-[220px] h-auto object-contain"
          />
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Criar conta</h2>

          {erro && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3 mb-4">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nome</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="nome"
                  value={form.nome}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  className="input pl-9"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

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
                  placeholder="Mínimo 6 caracteres"
                  className="input pl-9 pr-10"
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Indicador de força da senha */}
              {form.senha.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= forca.nivel
                            ? forca.cor
                            : 'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className={`text-xs mt-1 ${forca.textoCor}`}>{forca.label}</p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Confirmar senha</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  name="confirmarSenha"
                  value={form.confirmarSenha}
                  onChange={handleChange}
                  placeholder="Repita a senha"
                  className="input pl-9"
                  required
                  autoComplete="new-password"
                />
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
                  Criando conta...
                </>
              ) : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          Já tem conta?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}

function calcularForcaSenha(senha) {
  if (!senha) return { nivel: 0, label: '', cor: '', textoCor: '' }
  let score = 0
  if (senha.length >= 6) score++
  if (senha.length >= 10) score++
  if (/[A-Z]/.test(senha) && /[0-9]/.test(senha)) score++
  if (/[^A-Za-z0-9]/.test(senha)) score++

  const configs = [
    { nivel: 1, label: 'Fraca', cor: 'bg-red-400', textoCor: 'text-red-500' },
    { nivel: 2, label: 'Razoável', cor: 'bg-orange-400', textoCor: 'text-orange-500' },
    { nivel: 3, label: 'Boa', cor: 'bg-yellow-400', textoCor: 'text-yellow-600' },
    { nivel: 4, label: 'Forte', cor: 'bg-green-500', textoCor: 'text-green-600' },
  ]
  return configs[Math.max(0, score - 1)] ?? configs[0]
}

function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Este e-mail já está cadastrado. Tente fazer login.'
  if (m.includes('password should be at least'))
    return 'A senha deve ter pelo menos 6 caracteres.'
  if (m.includes('unable to validate email'))
    return 'E-mail inválido. Verifique e tente novamente.'
  if (m.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos.'
  return 'Erro ao criar conta. Tente novamente.'
}
