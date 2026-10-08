import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, AlertTriangle, Loader2, Trash2, LogOut, Sparkles, Eye, EyeOff, Clock, MessageSquarePlus, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useZerarDados } from '../hooks/useZerarDados'
import { useConsultoriaAcessos } from '../hooks/useConsultoriaAcessos'
import { useFeedbacks } from '../hooks/useFeedbacks'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

// Card para o usuário ENVIAR um feedback (sugestão, dúvida ou problema). O
// envio usa a mesma fonte/hook do painel Admin (useFeedbacks). RLS garante que
// o registro é criado só em nome do próprio usuário.
function EnviarFeedback() {
  const { criar } = useFeedbacks()
  const [tipo, setTipo] = useState('sugestao')
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  const TIPOS = [
    { value: 'sugestao', label: 'Sugestão' },
    { value: 'duvida',   label: 'Dúvida' },
    { value: 'problema', label: 'Problema' },
  ]

  async function handleEnviar(e) {
    e.preventDefault()
    if (!mensagem.trim() || enviando) return
    setEnviando(true); setErro('')
    try {
      await criar({ tipo, mensagem })
      setEnviado(true)
      setMensagem('')
      setTipo('sugestao')
    } catch {
      setErro('Não foi possível enviar seu feedback agora. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <MessageSquarePlus size={16} className="text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Enviar feedback</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tem uma sugestão, dúvida ou encontrou um problema? Conte pra gente.
          </p>

          {enviado ? (
            <div className="flex items-center gap-2 mt-3">
              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">Feedback enviado.</span>{' '}
                Obrigado! Vamos analisar com carinho.
              </p>
              <button
                onClick={() => setEnviado(false)}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 ml-auto flex-shrink-0"
              >
                Enviar outro
              </button>
            </div>
          ) : (
            <form onSubmit={handleEnviar} className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {TIPOS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      tipo === t.value
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <textarea
                className="input min-h-[88px] resize-y"
                placeholder="Escreva aqui sua sugestão, dúvida ou problema..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                maxLength={2000}
              />
              {erro && <p className="text-xs text-red-500">{erro}</p>}
              <button
                type="submit"
                disabled={enviando || !mensagem.trim()}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : 'Enviar feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// Card que lista os acessos de consultoria do CLIENTE (consultores autorizados
// ou com solicitação pendente) e permite revogar/recusar. Só aparece se houver
// algum vínculo relevante. Busca o nome dos consultores para exibir.
function AcessosConsultoria() {
  const { comoCliente, autorizar, recusar, revogar, carregando } = useConsultoriaAcessos()
  const [nomes, setNomes] = useState({}) // consultor_id → nome
  const [agindo, setAgindo] = useState(null) // id em processamento

  // Mostra apenas vínculos ativos/relevantes (autorizado ou pendente).
  const relevantes = comoCliente.filter(a => a.status === 'autorizado' || a.status === 'pendente')

  useEffect(() => {
    let vivo = true
    async function buscarNomes() {
      const ids = [...new Set(relevantes.map(a => a.consultor_id))]
      if (ids.length === 0) return
      const { data } = await supabase.from('perfis').select('id, nome, email').in('id', ids)
      if (vivo && data) {
        const mapa = {}
        for (const p of data) mapa[p.id] = p.nome || p.email || 'Consultor'
        setNomes(mapa)
      }
    }
    buscarNomes()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relevantes.length])

  async function acao(fn, id) {
    setAgindo(id)
    try { await fn(id) } finally { setAgindo(null) }
  }

  if (carregando || relevantes.length === 0) return null

  return (
    <div className="card">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Acessos de consultoria</h2>
      <p className="text-sm text-gray-500 mb-4">
        Consultores que podem (ou pediram para) visualizar seus dados financeiros em
        modo somente leitura. Você controla o acesso aqui.
      </p>
      <div className="space-y-3">
        {relevantes.map(a => {
          const nome = nomes[a.consultor_id] || 'Consultor'
          const ocupado = agindo === a.id
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 border border-gray-200 rounded-xl p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                {a.status === 'autorizado' ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-700">
                    <Eye size={12} /> Acesso autorizado
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                    <Clock size={12} /> Aguardando sua autorização
                  </span>
                )}
              </div>
              {a.status === 'autorizado' ? (
                <button
                  onClick={() => acao(revogar, a.id)}
                  disabled={ocupado}
                  className="btn-secondary flex items-center gap-1.5 !py-1.5 !px-3 text-sm flex-shrink-0"
                >
                  {ocupado ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
                  Revogar
                </button>
              ) : (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => acao(recusar, a.id)} disabled={ocupado}
                    className="btn-secondary !py-1.5 !px-3 text-sm">Recusar</button>
                  <button onClick={() => acao(autorizar, a.id)} disabled={ocupado}
                    className="btn-primary !py-1.5 !px-3 text-sm flex items-center gap-1.5">
                    {ocupado ? <Loader2 size={14} className="animate-spin" /> : null} Autorizar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Mesma chave lida em App.jsx (AreaAutenticada) para reabrir o onboarding.
const CHAVE_REFAZER = 'almeida_refazer_onboarding'

const PALAVRA_ENCERRAR = 'ENCERRAR'

export default function Configuracoes() {
  const { usuario, perfil, ehAdmin, encerrarMinhaConta } = useAuth()
  const { zerarDados } = useZerarDados()
  const navigate = useNavigate()

  // Reabre o fluxo de configuração financeira (onboarding). Não apaga dados:
  // é o mesmo fluxo do 1º acesso, útil para revisar/complementar informações.
  function refazerConfiguracao() {
    try { localStorage.setItem(CHAVE_REFAZER, '1') } catch { /* ignore */ }
    navigate('/') // a Home (AreaAutenticada) detecta a flag e abre o onboarding
  }

  const [modalAberto, setModalAberto] = useState(false)
  const [zerando, setZerando] = useState(false)
  const [erro, setErro] = useState('')

  // Encerrar conta (desativação da própria conta)
  const [modalEncerrar, setModalEncerrar] = useState(false)
  const [textoEncerrar, setTextoEncerrar] = useState('')
  const [encerrando, setEncerrando] = useState(false)
  const [erroEncerrar, setErroEncerrar] = useState('')

  const nome = perfil?.nome || usuario?.email?.split('@')[0] || 'Usuário'
  const encerrarValido = textoEncerrar.trim().toUpperCase() === PALAVRA_ENCERRAR

  function abrirModal() {
    setErro('')
    setModalAberto(true)
  }

  function abrirModalEncerrar() {
    setTextoEncerrar('')
    setErroEncerrar('')
    setModalEncerrar(true)
  }

  async function handleZerar() {
    setZerando(true)
    setErro('')
    try {
      await zerarDados()
      // Recarrega o app inteiro: todos os hooks releem o banco (agora vazio),
      // o Dashboard aparece zerado e a sessão/login permanece ativa.
      window.location.assign('/')
    } catch (err) {
      setErro(err.message || 'Erro ao zerar os dados. Tente novamente.')
      setZerando(false)
    }
  }

  async function handleEncerrar() {
    if (!encerrarValido) return
    setEncerrando(true)
    setErroEncerrar('')
    try {
      await encerrarMinhaConta() // desativa o perfil (ativo=false) + signOut
      // Redireciona para o login. Ao tentar entrar de novo, a conta estará
      // desativada e o app mostra a tela "Conta desativada" já existente.
      window.location.assign('/login')
    } catch (err) {
      // Se um admin tentar encerrar a própria conta, o trigger do banco
      // (impedir_autodesativacao) lança erro e a conta NÃO é encerrada.
      setErroEncerrar(err.message || 'Não foi possível encerrar a conta. Tente novamente.')
      setEncerrando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-1">Minha conta</p>
      </div>

      {/* Dados da conta */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Minha conta</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Nome</p>
              <p className="text-sm font-medium text-gray-900">{nome}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail size={16} className="text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-gray-400">E-mail</p>
              <p className="text-sm font-medium text-gray-900">{usuario?.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Acessos de consultoria (autorizar/recusar/revogar) */}
      <AcessosConsultoria />

      {/* Enviar feedback (sugestão / dúvida / problema) */}
      <EnviarFeedback />

      {/* Refazer configuração financeira (reabre o onboarding) */}
      <div className="card">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Sparkles size={16} className="text-blue-700" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Refazer configuração financeira</h2>
            <p className="text-sm text-gray-500 mt-1">
              Revise saldo, receitas, despesas, cartão e reserva no mesmo passo a passo do primeiro
              acesso. Seus dados atuais não são apagados.
            </p>
            <button
              onClick={refazerConfiguracao}
              className="mt-3 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Sparkles size={15} /> Refazer configuração
            </button>
          </div>
        </div>
      </div>

      {/* Zona de perigo: Zerar meus dados */}
      <div className="card border-red-200">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Zerar meus dados</h2>
            <p className="text-sm text-gray-500 mt-1">
              Apaga todas as suas informações financeiras e faz o Almeida Finance voltar ao estado
              inicial. Sua conta e seu acesso continuam ativos.
            </p>
            <button
              onClick={abrirModal}
              className="mt-3 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
            >
              <Trash2 size={15} /> Zerar meus dados
            </button>
          </div>
        </div>
      </div>

      {/* Zona de perigo: Encerrar minha conta — SEPARADA do "Zerar dados".
          São ações diferentes: zerar apaga dados e mantém a conta ativa;
          encerrar desativa a conta (ativo=false) sem apagar dados. */}
      <div className="card border-red-300">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <LogOut size={16} className="text-red-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Encerrar minha conta</h2>
            <p className="text-sm text-gray-500 mt-1">
              Desativa sua conta e você perde o acesso ao Almeida Finance. Seus dados
              <strong> não são apagados</strong> neste momento.
            </p>
            {ehAdmin ? (
              <p className="mt-3 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                Contas de administrador não podem ser encerradas por aqui.
              </p>
            ) : (
              <button
                onClick={abrirModalEncerrar}
                className="mt-3 inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
              >
                <LogOut size={15} /> Encerrar minha conta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de confirmação — Zerar dados */}
      <Modal aberto={modalAberto} onFechar={() => !zerando && setModalAberto(false)} titulo="Zerar todas as informações">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Tem certeza de que deseja zerar todas as suas informações?
              Esta ação não poderá ser desfeita.
            </p>
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erro}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalAberto(false)}
              disabled={zerando}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleZerar}
              disabled={zerando}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {zerando
                ? <><Loader2 size={15} className="animate-spin" /> Zerando...</>
                : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal de confirmação — Encerrar conta */}
      <Modal aberto={modalEncerrar} onFechar={() => !encerrando && setModalEncerrar(false)} titulo="Encerrar minha conta">
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">
              Sua conta será desativada e você perderá o acesso ao Almeida Finance.
              Seus dados não serão apagados neste momento.
            </p>
          </div>

          <div>
            <label className="label">
              Para confirmar, digite <strong className="text-red-600">{PALAVRA_ENCERRAR}</strong>
            </label>
            <input
              type="text"
              value={textoEncerrar}
              onChange={e => setTextoEncerrar(e.target.value)}
              placeholder={PALAVRA_ENCERRAR}
              className="input"
              autoFocus
              disabled={encerrando}
            />
          </div>

          {erroEncerrar && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroEncerrar}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalEncerrar(false)}
              disabled={encerrando}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleEncerrar}
              disabled={!encerrarValido || encerrando}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {encerrando
                ? <><Loader2 size={15} className="animate-spin" /> Encerrando...</>
                : 'Encerrar minha conta'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
