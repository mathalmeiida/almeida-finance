import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck,
  Wallet, Target, ShoppingCart, Sparkles, Smartphone, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Apresentacao from '../../components/Apresentacao'

// Benefícios exibidos na apresentação (coluna esquerda, desktop).
const BENEFICIOS = [
  { icon: Wallet, titulo: 'Controle completo', desc: 'Receitas, despesas, cartões e investimentos.' },
  { icon: Target, titulo: 'Planejamento inteligente', desc: 'Metas e projeções financeiras.' },
  { icon: ShoppingCart, titulo: 'Posso comprar?', desc: 'Simule compras antes de decidir.' },
  { icon: Sparkles, titulo: 'E se...?', desc: 'Simule cenários financeiros.' },
  { icon: ShieldCheck, titulo: 'Segurança e privacidade', desc: 'Seus dados protegidos e só seus.' },
  { icon: Smartphone, titulo: 'Em qualquer lugar', desc: 'Acesse pelo celular ou computador.' },
]

// Chave localStorage para não re-exibir a apresentação se o usuário já a viu
// neste dispositivo (antes de criar conta).
const CHAVE_APRES_PUBLICA = 'almeida_apresentacao_publica_vista'

export default function Login() {
  const { entrar } = useAuth()
  const navigate = useNavigate()

  // Apresentação pública: exibida na primeira visita deste dispositivo (celular
  // ou computador), antes do formulário. Depois que o visitante escolhe
  // "Começar agora" ou "Já tenho uma conta" (ou pula), não aparece de novo a
  // cada login. Pode ser revista pelo link "Conhecer o Almeida Finance".
  const [mostrarApresentacao, setMostrarApresentacao] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem(CHAVE_APRES_PUBLICA) !== '1' }
    catch { return false }
  })

  function marcarApresentacaoVista() {
    try { localStorage.setItem(CHAVE_APRES_PUBLICA, '1') } catch { /* ignora */ }
  }

  function concluirApresentacaoPublica() {
    marcarApresentacaoVista()
    setMostrarApresentacao(false)
  }

  // "Começar agora" → cadastro. Marca como vista para que, ao voltar do
  // cadastro para o login, a apresentação não reapareça (evita o vai-e-volta).
  function comecarAgora() {
    marcarApresentacaoVista()
    navigate('/cadastro')
  }

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

  // Apresentação mobile para usuários não autenticados — com botões de acesso reais.
  // A Apresentacao padrão usa aoConcluir para "Pular" e "Começar agora".
  // Aqui usamos uma versão com rodapé customizado: Cadastrar + Já tenho conta.
  if (mostrarApresentacao) {
    return <Apresentacao onComecar={comecarAgora} onEntrar={concluirApresentacaoPublica} />
  }

  return (
    // Fundo vinho escuro uniforme — identidade Almeida Finance Premium.
    <div
      className="min-h-[100dvh] text-white overflow-x-hidden flex items-center justify-center p-4 sm:p-6"
      style={{ background: 'linear-gradient(160deg, #3d0a18 0%, #250610 100%)' }}
    >
      {/* Container centralizado com grid de 2 colunas equilibradas */}
      <div className="w-full max-w-7xl mx-auto lg:grid lg:grid-cols-2 lg:gap-20 lg:items-center">
        
        {/* ── Apresentação (desktop) — coluna esquerda ── */}
        <aside className="hidden lg:flex flex-col justify-center gap-10">
          <div className="space-y-5">
            <img src="/branding/af-icone.png" alt="Almeida Finance"
              className="w-32 h-auto" />
            <div>
              <h1 className="text-4xl font-bold leading-tight">Suas finanças em um só lugar</h1>
              <p className="text-lg text-white/80 mt-4 leading-relaxed">
                Organize, planeje e tome decisões melhores com o Almeida Finance.
              </p>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-x-8 gap-y-6">
            {BENEFICIOS.map(b => (
              <li key={b.titulo} className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <b.icon size={20} className="text-white" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{b.titulo}</p>
                  <p className="text-sm text-white/70 leading-relaxed mt-1">{b.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Login (direita no desktop; único bloco no mobile) ── */}
        <main className="flex items-center justify-center">
          <div className="w-full max-w-[420px]">
            {/* Mobile: logo e título compactos acima do formulário */}
            <div className="flex flex-col items-center text-center mb-8 lg:hidden">
              <img src="/branding/af-icone.png" alt="Almeida Finance"
                className="w-24 h-auto mb-3" />
              <p className="text-lg text-white/90">Suas finanças em um só lugar</p>
            </div>

            <div className="bg-white rounded-t-2xl shadow-2xl shadow-black/40 ring-1 ring-white/10 border-b border-gray-100 p-8">
              <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
              <p className="text-base text-gray-600 mt-2.5 mb-7 leading-relaxed">Entre para continuar cuidando das suas finanças.</p>

              {erro && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3.5 mb-5">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{erro}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="label text-sm font-semibold text-gray-700 mb-2 block">E-mail</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="seu@email.com"
                      className="input pl-11 py-3 text-base"
                      required
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                </div>

                <div>
                  <label className="label text-sm font-semibold text-gray-700 mb-2 block">Senha</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      name="senha"
                      value={form.senha}
                      onChange={handleChange}
                      placeholder="Sua senha"
                      className="input pl-11 pr-11 py-3 text-base"
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-2">
                    <Link to="/recuperar-senha" className="text-sm text-marca hover:underline font-medium">
                      Esqueci minha senha
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={carregando}
                  className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-all"
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

            {/* Card de privacidade — extensão do card, fundo vinho escuro. */}
            <div className="bg-[#21121F]/95 text-white rounded-b-2xl p-7 border-t border-white/10 shadow-2xl shadow-black/40 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-white flex-shrink-0" />
                <h3 className="text-base font-semibold">Sua privacidade importa</h3>
              </div>
              <p className="text-sm text-white/80 mt-3 leading-relaxed">
                Seus dados financeiros são pessoais e merecem proteção.
              </p>
              <ul className="mt-5 space-y-3">
                <li className="flex items-start gap-3 text-sm text-white/90">
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Controles de acesso protegem suas informações.</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-white/90">
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">Você pode ocultar valores financeiros no aplicativo.</span>
                </li>
              </ul>
            </div>

            <p className="text-center text-base text-white/90 mt-7 leading-relaxed">
              Não tem conta?{' '}
              <Link to="/cadastro" className="text-white font-semibold underline decoration-white/50 underline-offset-4 hover:decoration-white transition-colors">
                Criar conta gratuita
              </Link>
            </p>
            <p className="text-center mt-3">
              <button type="button" onClick={() => setMostrarApresentacao(true)}
                className="text-sm text-white/70 hover:text-white underline-offset-2 hover:underline transition-colors">
                Conhecer o Almeida Finance
              </button>
            </p>

            {/* Benefícios — só no mobile, abaixo do formulário. */}
            <ul className="grid grid-cols-2 gap-3 mt-10 lg:hidden">
              {BENEFICIOS.map(b => (
                <li key={b.titulo} className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/10 p-3">
                  <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <b.icon size={16} className="text-white" />
                  </span>
                  <p className="text-xs font-medium text-white/95 leading-tight">{b.titulo}</p>
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  )
}

// Traduz as mensagens de erro do Supabase para português
function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('network'))
    return 'Sem conexão com a internet. Verifique e tente novamente.'
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
