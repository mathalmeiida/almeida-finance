import React, { useState } from 'react'
import { User, Mail, AlertTriangle, Loader2, Trash2, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useZerarDados } from '../hooks/useZerarDados'
import Modal from '../components/Modal'

const PALAVRA_ENCERRAR = 'ENCERRAR'

export default function Configuracoes() {
  const { usuario, perfil, ehAdmin, encerrarMinhaConta } = useAuth()
  const { zerarDados } = useZerarDados()

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
