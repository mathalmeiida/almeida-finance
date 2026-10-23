import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck,
  Wallet, Target, ShoppingCart, Sparkles, Smartphone, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LogoMarca from '../../components/LogoMarca'

// Benefícios exibidos na apresentação (coluna esquerda, desktop).
const BENEFICIOS = [
  { icon: Wallet, titulo: 'Controle completo', desc: 'Receitas, despesas, cartões e investimentos.' },
  { icon: Target, titulo: 'Planejamento inteligente', desc: 'Metas e projeções financeiras.' },
  { icon: ShoppingCart, titulo: 'Posso comprar?', desc: 'Simule compras antes de decidir.' },
  { icon: Sparkles, titulo: 'E se...?', desc: 'Simule cenários financeiros.' },
  { icon: ShieldCheck, titulo: 'Segurança e privacidade', desc: 'Seus dados protegidos e só seus.' },
  { icon: Smartphone, titulo: 'Em qualquer lugar', desc: 'Acesse pelo celular ou computador.' },
]

// ─── Mockups leves (CSS/React, sem imagens/APIs). Valores são FICTÍCIOS. ───
function MockHome() {
  return (
    <div className="w-44 rounded-[1.4rem] bg-slate-900/80 border border-white/10 p-2.5 shadow-xl">
      <div className="rounded-2xl bg-marca-grad-dark p-3 text-white">
        <p className="text-[9px] text-white/70">Saldo atual</p>
        <p className="text-base font-extrabold">R$ 3.250</p>
        <div className="mt-2 rounded-lg bg-black/20 px-2 py-1">
          <p className="text-[8px] text-white/70">Limite de hoje</p>
          <p className="text-xs font-bold">R$ 82/dia</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        <div className="rounded-lg bg-white/10 text-white text-[8px] font-medium px-2 py-2 text-center">Posso comprar?</div>
        <div className="rounded-lg bg-white/10 text-white text-[8px] font-medium px-2 py-2 text-center">E se...?</div>
      </div>
      <p className="text-[7px] text-white/40 mt-2 text-center">Exemplo ilustrativo</p>
    </div>
  )
}
function MockESe() {
  const opcoes = ['Variação de renda', 'Nova despesa', 'Desligamento', 'Simulação de compra']
  return (
    <div className="w-40 rounded-[1.4rem] bg-slate-900/80 border border-white/10 p-2.5 shadow-xl">
      <div className="flex items-center gap-1.5 text-white mb-2">
        <Sparkles size={12} /><p className="text-[10px] font-bold">E se...?</p>
      </div>
      <div className="space-y-1.5">
        {opcoes.map(o => (
          <div key={o} className="rounded-lg bg-white/10 text-white text-[8px] font-medium px-2 py-1.5">{o}</div>
        ))}
      </div>
      <p className="text-[7px] text-white/40 mt-2 text-center">Exemplo ilustrativo</p>
    </div>
  )
}

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
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ── Apresentação (desktop) — fundo azul-marinho com gradiente discreto ── */}
      <aside
        className="hidden lg:flex flex-col justify-center gap-8 p-10 xl:p-14 text-white relative overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(120% 120% at 100% 0%, rgba(96,141,214,0.25), rgba(96,141,214,0) 55%), linear-gradient(135deg, #0b1f3a 0%, #0a1626 100%)' }}
      >
        <div>
          <LogoMarca imgClassName="w-[150px] h-auto" padding="px-5 py-3.5" />
          <h1 className="text-3xl font-extrabold mt-7 leading-tight">Suas finanças em um só lugar</h1>
          <p className="text-sm text-slate-300 mt-2 max-w-md">
            Organize, planeje e tome decisões melhores com o Almeida Finance.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-x-6 gap-y-4 max-w-lg">
          {BENEFICIOS.map(b => (
            <li key={b.titulo} className="flex items-start gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                <b.icon size={16} className="text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{b.titulo}</p>
                <p className="text-xs text-slate-300 leading-snug">{b.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* Mockups das telas (ilustrativos) */}
        <div className="flex items-end gap-4 pt-2">
          <MockHome />
          <MockESe />
        </div>
      </aside>

      {/* ── Login (direita no desktop; única coluna no mobile) ── */}
      <main className="flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm">
          {/* Logo só no mobile (no desktop ela aparece na apresentação). */}
          <div className="flex justify-center mb-8 lg:hidden">
            <LogoMarca imgClassName="w-[180px] h-auto" padding="px-7 py-5" />
          </div>

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

          {/* Card de privacidade — contraste melhorado (navy translúcido). */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 mt-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-white flex-shrink-0" />
              <h3 className="text-sm font-semibold">Sua privacidade importa</h3>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Seus dados financeiros são pessoais e merecem proteção.
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-start gap-2 text-xs text-slate-200">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                Controles de acesso protegem suas informações.
              </li>
              <li className="flex items-start gap-2 text-xs text-slate-200">
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                Você pode ocultar valores financeiros no aplicativo.
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
      </main>
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
