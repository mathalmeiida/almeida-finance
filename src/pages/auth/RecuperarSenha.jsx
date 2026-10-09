import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LogoMarca from '../../components/LogoMarca'

export default function RecuperarSenha() {
  const { solicitarRecuperacaoSenha } = useAuth()
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setCarregando(true)
    setErro('')
    try {
      await solicitarRecuperacaoSenha(email)
      setEnviado(true)
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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {enviado ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Verifique seu e-mail</h2>
              <p className="text-gray-500 text-sm mb-6">
                Se existir uma conta com <strong>{email}</strong>, enviamos um link para você redefinir sua senha.
                Confira também a caixa de spam.
              </p>
              <Link to="/login" className="btn-primary block text-center">Voltar ao login</Link>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Esqueci minha senha</h2>
              <p className="text-sm text-gray-500 mb-5">
                Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.
              </p>

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
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="input pl-9"
                      required
                      autoComplete="email"
                      autoFocus
                    />
                  </div>
                </div>

                <button type="submit" disabled={carregando}
                  className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                  {carregando ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Enviando...
                    </>
                  ) : 'Enviar link de redefinição'}
                </button>
              </form>
            </>
          )}
        </div>

        {!enviado && (
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-gray-600 mt-4 hover:text-gray-900">
            <ArrowLeft size={15} /> Voltar ao login
          </Link>
        )}
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'Erro ao enviar o e-mail. Tente novamente.'
  const m = msg.toLowerCase()
  if (m.includes('rate limit') || m.includes('too many'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  if (m.includes('invalid email') || m.includes('unable to validate'))
    return 'E-mail inválido. Verifique e tente novamente.'
  return 'Erro ao enviar o e-mail. Tente novamente.'
}
