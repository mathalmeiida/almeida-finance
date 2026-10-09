import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import LogoMarca from '../../components/LogoMarca'

export default function RedefinirSenha() {
  const { redefinirSenha } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({ senha: '', confirmar: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)
  // undefined = verificando; true = tem sessão de recuperação; false = link inválido
  const [temSessao, setTemSessao] = useState(undefined)

  // Ao abrir pelo link do e-mail, o Supabase dispara PASSWORD_RECOVERY e cria a sessão.
  useEffect(() => {
    // Verifica se já há sessão (o detectSessionInUrl do cliente processa o link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setTemSessao(!!session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setTemSessao(true)
    })
    return () => subscription.unsubscribe()
  }, [])

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
    if (form.senha !== form.confirmar) {
      setErro('As senhas não coincidem.')
      return
    }
    setCarregando(true)
    try {
      await redefinirSenha(form.senha)
      setSucesso(true)
      // Encerra a sessão de recuperação e volta ao login após alguns segundos
      setTimeout(async () => {
        await supabase.auth.signOut()
        navigate('/login')
      }, 3000)
    } catch (err) {
      setErro(traduzirErro(err.message))
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <LogoMarca imgClassName="w-[180px] h-auto" padding="px-7 py-5" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {/* Sucesso */}
          {sucesso ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Senha alterada!</h2>
              <p className="text-gray-500 text-sm mb-6">
                Sua senha foi redefinida com sucesso. Você será levado ao login em instantes.
              </p>
              <Link to="/login" className="btn-primary block text-center">Ir para o login agora</Link>
            </div>
          ) : temSessao === false ? (
            /* Link inválido ou expirado */
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Link inválido ou expirado</h2>
              <p className="text-gray-500 text-sm mb-6">
                O link de redefinição não é mais válido. Solicite um novo para redefinir sua senha.
              </p>
              <Link to="/recuperar-senha" className="btn-primary block text-center">Solicitar novo link</Link>
            </div>
          ) : temSessao === undefined ? (
            /* Verificando */
            <div className="flex items-center justify-center py-8">
              <span className="w-6 h-6 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            /* Formulário de nova senha */
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Definir nova senha</h2>
              <p className="text-sm text-gray-500 mb-5">Escolha uma nova senha para sua conta.</p>

              {erro && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3 mb-4">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nova senha</label>
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
                      autoFocus
                    />
                    <button type="button" onClick={() => setMostrarSenha(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">Confirmar nova senha</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={mostrarSenha ? 'text' : 'password'}
                      name="confirmar"
                      value={form.confirmar}
                      onChange={handleChange}
                      placeholder="Repita a nova senha"
                      className="input pl-9"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button type="submit" disabled={carregando}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {carregando ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : 'Salvar nova senha'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'Erro ao redefinir a senha. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('should be at least') || m.includes('password'))
    return 'A senha deve ter pelo menos 6 caracteres.'
  if (m.includes('session') || m.includes('expired') || m.includes('token'))
    return 'Sua sessão de redefinição expirou. Solicite um novo link.'
  return 'Erro ao redefinir a senha. Tente novamente.'
}
