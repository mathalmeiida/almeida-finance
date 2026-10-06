import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import logoAlmeida from '../../assets/Logo Corporativo Almeida Finance.png'

// ─── Callback de confirmação de e-mail ────────────────────────────────────────
// Para onde o link "Confirmar cadastro" do e-mail redireciona (emailRedirectTo).
// Processa, NA MESMA ABA, os dois formatos que o Supabase pode usar:
//   (a) PKCE / fluxo novo:  ?code=<...>        → exchangeCodeForSession(code)
//   (b) Implícito / antigo: #access_token=...&type=signup → detectSessionInUrl
//       (o supabase-js já cria a sessão automaticamente ao carregar)
// Depois mostra uma mensagem clara e segue para o app (se autenticou) ou para
// o login. Nunca deixa a aba presa em loading/tela branca.
export default function ConfirmarEmail() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState('processando') // processando | sucesso | erro
  const [mensagem, setMensagem] = useState('')
  // Evita rodar o processamento duas vezes (StrictMode em desenvolvimento).
  const jaProcessou = useRef(false)

  useEffect(() => {
    if (jaProcessou.current) return
    jaProcessou.current = true

    async function processar() {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        // Erros vêm tanto na query (?error=...) quanto no fragmento (#error=...).
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const erroUrl = url.searchParams.get('error_description')
          || url.searchParams.get('error')
          || hashParams.get('error_description')
          || hashParams.get('error')

        if (erroUrl) {
          // Link expirado/ inválido ou já utilizado.
          setEstado('erro')
          setMensagem(traduzirErro(erroUrl))
          return
        }

        // (a) Fluxo novo (PKCE): troca o "code" por uma sessão.
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
        }
        // (b) Fluxo antigo (#access_token): o supabase-js, com
        // detectSessionInUrl: true, já criou a sessão ao carregar a página.
        // Garantimos abaixo lendo a sessão atual.

        // Limpa os parâmetros sensíveis da barra de endereço (code/tokens).
        window.history.replaceState({}, document.title, '/auth/callback')

        const { data: { session } } = await supabase.auth.getSession()

        setEstado('sucesso')
        if (session) {
          // Já autenticado nesta aba → leva direto ao app após a mensagem.
          setMensagem('E-mail confirmado com sucesso! Redirecionando para sua conta...')
          setTimeout(() => navigate('/', { replace: true }), 1800)
        } else {
          // E-mail confirmado, mas sem sessão (ex.: confirmação exige login).
          setMensagem('E-mail confirmado com sucesso! Agora você pode entrar na sua conta.')
          setTimeout(() => navigate('/login', { replace: true }), 2500)
        }
      } catch (err) {
        setEstado('erro')
        setMensagem(traduzirErro(err?.message))
      }
    }

    processar()
  }, [navigate])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-8">
          <img src={logoAlmeida} alt="Almeida Finance" className="w-[200px] h-auto object-contain" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {estado === 'processando' && (
            <>
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Confirmando seu e-mail...</h2>
              <p className="text-sm text-gray-500">Só um instante.</p>
            </>
          )}

          {estado === 'sucesso' && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">E-mail confirmado!</h2>
              <p className="text-gray-500 text-sm mb-6">{mensagem}</p>
              <Link to="/login" className="btn-primary block text-center">
                Ir para o login
              </Link>
            </>
          )}

          {estado === 'erro' && (
            <>
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Não foi possível confirmar</h2>
              <p className="text-gray-500 text-sm mb-6">{mensagem}</p>
              <Link to="/login" className="btn-primary block text-center">
                Ir para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (!msg) return 'O link pode ter expirado ou já ter sido utilizado. Tente entrar na sua conta ou solicite um novo cadastro.'
  const m = String(msg).toLowerCase()
  if (m.includes('expired'))
    return 'O link de confirmação expirou. Faça login — se preciso, solicite um novo e-mail de confirmação.'
  if (m.includes('already') || m.includes('used'))
    return 'Este link já foi utilizado. Sua conta provavelmente já está confirmada: tente entrar normalmente.'
  if (m.includes('invalid'))
    return 'O link de confirmação é inválido. Verifique se abriu o link mais recente que enviamos.'
  return 'O link pode ter expirado ou já ter sido utilizado. Tente entrar na sua conta.'
}
