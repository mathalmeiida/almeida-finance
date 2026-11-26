import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Wallet, Target, ShoppingCart, Sparkles, Smartphone, CheckCircle2, ArrowRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import Apresentacao from '../../components/Apresentacao'

const BENEFICIOS = [
  { icon: Wallet, titulo: 'Controle financeiro', desc: 'Acompanhe receitas, despesas, cartões e investimentos.' },
  { icon: Target, titulo: 'Planejamento inteligente', desc: 'Defina metas e projete seu futuro financeiro.' },
  { icon: ShoppingCart, titulo: 'Posso comprar?', desc: 'Simule compras e veja o impacto no orçamento.' },
  { icon: Sparkles, titulo: 'Cenários financeiros', desc: 'Explore diferentes cenários antes de decidir.' },
  { icon: ShieldCheck, titulo: 'Segurança e privacidade', desc: 'Controle o acesso e a visibilidade dos seus valores.' },
  { icon: Smartphone, titulo: 'Acesso em qualquer lugar', desc: 'Use pelo celular ou computador.' },
]
const CHAVE_APRES_PUBLICA = 'almeida_apresentacao_publica_vista'
const campo = 'w-full rounded-xl border border-[#dac9cd] bg-white/75 text-[#32101d] placeholder:text-[#806d74] py-3.5 pl-12 pr-4 text-base outline-none focus:border-[#a72a50] focus:ring-2 focus:ring-[#a72a50]/20 transition-colors'

function Marca({ mobile = false }) {
  return <div className={`flex items-center gap-4 ${mobile ? 'justify-center' : ''}`}>
    <img src="/branding/af-icone.png" alt="" className={`${mobile ? 'w-16' : 'w-24'} h-auto object-contain shrink-0`} />
    <div className="border-l border-white/25 pl-4">
      <p className="text-lg sm:text-2xl tracking-tight text-white leading-tight"><strong>ALMEIDA</strong> <span className="font-light">FINANCE</span></p>
      <p className="text-[9px] sm:text-[10px] tracking-[0.16em] uppercase text-[#f2cbd0] mt-2">Controle · Planejamento · Liberdade</p>
    </div>
  </div>
}

function Fundo() {
  return <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" fill="none">
      <defs>
        <linearGradient id="af-login-luz"><stop stopColor="#f65b83" stopOpacity="0"/><stop offset=".48" stopColor="#f789a0"/><stop offset="1" stopColor="#c52b51" stopOpacity="0"/></linearGradient>
        <linearGradient id="af-login-onda" x2="0" y2="1"><stop stopColor="#c62750" stopOpacity=".28"/><stop offset="1" stopColor="#480a20" stopOpacity="0"/></linearGradient>
      </defs>
      <path d="M-180 630 C120 1050 300 850 530 945 S850 1120 1050 1020 L-180 1150 Z" fill="url(#af-login-onda)"/>
      <path d="M-180 630 C120 1050 300 850 530 945 S850 1120 1050 1020" stroke="url(#af-login-luz)" strokeWidth="2"/>
      <path d="M750 -60 C1040 210 1180 -120 1390 15 S1670 280 1780 120" stroke="url(#af-login-luz)" strokeWidth="1.5"/>
    </svg>
  </div>
}

export default function Login() {
  const { entrar } = useAuth()
  const navigate = useNavigate()
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
    if (carregando) return
    setCarregando(true)
    setErro('')
    try {
      await entrar({ email: form.email, senha: form.senha })
      navigate('/')
    } catch (err) {
      setErro(traduzirErro(err?.message))
    } finally {
      setCarregando(false)
    }
  }
  if (mostrarApresentacao) {
    return <Apresentacao onComecar={comecarAgora} onEntrar={concluirApresentacaoPublica} />
  }
  return (
    <div className="relative isolate min-h-[100dvh] w-full overflow-x-hidden text-white flex items-center" style={{ background: 'radial-gradient(ellipse at 12% 5%, #7b1535 0%, transparent 43%), radial-gradient(ellipse at 0% 96%, #841634 0%, transparent 36%), linear-gradient(145deg,#42091b,#240611 72%,#350918)', paddingTop: 'max(24px, env(safe-area-inset-top))', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <Fundo />
      <div className="relative w-full max-w-[1440px] mx-auto px-4 sm:px-8 xl:px-16 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 xl:gap-20 items-center">
        <aside className="hidden lg:flex flex-col gap-9 min-w-0">
          <Marca />
          <div>
            <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.08] text-white">Suas finanças em<br/><span className="text-[#f4d2b5]">um só lugar</span></h1>
            <div className="w-16 h-1.5 rounded-full bg-[#d04b70] my-6" />
            <p className="text-lg xl:text-xl text-[#f5dfe3] leading-relaxed max-w-xl">Organize seu dinheiro, planeje o futuro e tome decisões melhores com o Almeida Finance.</p>
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-7">
            {BENEFICIOS.map(b => <li key={b.titulo} className="flex items-start gap-3 min-w-0">
              <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-[#e67692]/30 shadow-lg" style={{background:'linear-gradient(145deg,#96304e,#4a0d23)'}}><b.icon size={24} className="text-[#f5dac7]" /></span>
              <div className="min-w-0"><p className="font-semibold text-sm xl:text-base text-white">{b.titulo}</p><p className="mt-1 text-sm leading-relaxed text-[#edd0d8]">{b.desc}</p></div>
            </li>)}
          </ul>
        </aside>
        <main className="w-full max-w-[540px] mx-auto min-w-0">
          <div className="lg:hidden mb-7"><Marca mobile /><p className="text-center text-sm text-[#f4d9df] mt-5">Suas finanças em um só lugar</p></div>
          <div className="rounded-[26px] border border-white/60 shadow-2xl shadow-black/40 p-5 sm:p-9 text-[#32101d]" style={{background:'linear-gradient(155deg,#fffdfc,#f6eeed 70%,#efdddd)'}}>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Bem-vindo de volta</h2>
            <p className="text-sm sm:text-base text-[#65515a] mt-2 mb-7 leading-relaxed">Entre para continuar cuidando das suas finanças.</p>
            {erro && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm p-3 mb-5"><AlertCircle size={18} className="shrink-0 mt-0.5"/><span>{erro}</span></div>}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="af-login-email" className="block text-sm font-semibold mb-2">E-mail</label>
                <div className="relative"><Mail size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8c3b53]"/><input id="af-login-email" type="email" name="email" value={form.email} onChange={handleChange} placeholder="seu@email.com" className={campo} required autoComplete="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}/></div>
              </div>
              <div>
                <label htmlFor="af-login-senha" className="block text-sm font-semibold mb-2">Senha</label>
                <div className="relative"><Lock size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#8c3b53]"/><input id="af-login-senha" type={mostrarSenha ? 'text' : 'password'} name="senha" value={form.senha} onChange={handleChange} placeholder="Sua senha" className={`${campo} !pr-14`} required autoComplete="current-password"/><button type="button" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha} onClick={() => setMostrarSenha(v => !v)} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-[#8c3b53] hover:bg-[#8c3b53]/10 focus-visible:ring-2 focus-visible:ring-[#8c3b53]">{mostrarSenha ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div>
                <div className="flex justify-end mt-3"><Link to="/recuperar-senha" className="text-sm text-[#871638] hover:underline font-semibold">Esqueci minha senha</Link></div>
              </div>
              <button type="submit" disabled={carregando} className="w-full rounded-xl py-4 flex items-center justify-center gap-3 text-lg font-bold text-white shadow-lg shadow-[#7c1336]/20 hover:brightness-110 active:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed transition focus-visible:ring-2 focus-visible:ring-[#b32b55] focus-visible:ring-offset-2" style={{background:'linear-gradient(115deg,#a82950,#650c2a 60%,#420719)'}}>{carregando ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin motion-reduce:animate-none"/>Entrando...</> : <>Entrar <ArrowRight size={20}/></>}</button>
            </form>
            <div className="border-t border-[#d9c6cb] mt-7 pt-5">
              <section className="rounded-2xl border border-white/80 bg-white/35 p-4 sm:p-5">
                <div className="flex items-start gap-3"><ShieldCheck size={30} className="text-[#841c3c] shrink-0"/><div><h3 className="font-bold text-base sm:text-lg">Sua privacidade importa</h3><p className="text-xs sm:text-sm text-[#65515a] mt-1 leading-relaxed">Seus dados financeiros são pessoais e merecem proteção.</p></div></div>
                <ul className="space-y-3 mt-4 text-xs sm:text-sm"><li className="flex items-start gap-2"><CheckCircle2 size={19} className="text-emerald-700 shrink-0"/><span>Controles de acesso protegem suas informações.</span></li><li className="flex items-start gap-2"><CheckCircle2 size={19} className="text-emerald-700 shrink-0"/><span>Você pode ocultar valores financeiros no aplicativo.</span></li></ul>
              </section>
            </div>
          </div>
          <p className="text-center text-sm sm:text-base mt-6 text-[#f5e1e5]">Não tem conta?{' '}<Link to="/cadastro" className="font-bold text-white underline underline-offset-4">Criar conta gratuita</Link></p>
          <div className="flex items-center justify-center gap-3 mt-5"><span className="h-px flex-1 max-w-16 bg-[#b94f70]/60"/><button type="button" onClick={() => setMostrarApresentacao(true)} className="text-sm font-semibold text-[#f0cbd3] hover:text-white hover:underline">Conhecer o Almeida Finance</button><span className="h-px flex-1 max-w-16 bg-[#b94f70]/60"/></div>
          <ul className="grid grid-cols-2 gap-2 mt-8 lg:hidden">{BENEFICIOS.map(b => <li key={b.titulo} className="flex items-center gap-2 border border-white/10 bg-white/5 rounded-xl p-3 min-w-0"><b.icon size={18} className="shrink-0 text-[#f4d2b5]"/><span className="text-xs text-white/90">{b.titulo}</span></li>)}</ul>
        </main>
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'Erro desconhecido. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet. Verifique e tente novamente.'
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'E-mail ou senha incorretos.'
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
  if (m.includes('too many requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (m.includes('user not found')) return 'Nenhuma conta encontrada com este e-mail.'
  return 'Erro ao entrar. Tente novamente.'
}