import React, { useState } from 'react'
import { Mail, UserRound, CheckCircle2, Loader2, Pencil, X, Camera } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import PaginaInterna from '../../components/PaginaInterna'
import FotoPerfil from '../../components/FotoPerfil'
import SeletorFotoPerfil from '../../components/SeletorFotoPerfil'
// Reaproveita os fluxos reais já existentes em Configurações (sem duplicar lógica):
//  - AlterarSenha: supabase.auth.updateUser({ password }) via AuthContext
//  - ConfigurarBiometria: passkeys do Supabase Auth (só aparece se o dispositivo
//    e o projeto Supabase suportarem; caso contrário não renderiza nada)
import { AlterarSenha, ConfigurarBiometria } from '../Configuracoes'

// ─── Meu Perfil ───────────────────────────────────────────────────────────────
// Dados reais do usuário autenticado. Nome é gravado em perfis.nome (a RLS
// permite apenas o próprio registro). O e-mail é gerenciado pela autenticação
// e não é editável aqui. Foto/avatar configuráveis via SeletorFotoPerfil.
export default function Perfil() {
  const { usuario, perfil, perfilProprio, atualizarPreferenciasLimite, somenteLeitura, recarregarPerfil } = useAuth()

  // Sempre o perfil do PRÓPRIO usuário (no modo consultoria `perfil` é o do cliente).
  const meuPerfil = perfilProprio || perfil
  const email = usuario?.email || ''
  const nome = meuPerfil?.nome || email.split('@')[0] || 'Usuário'

  const [editando, setEditando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [modalFoto, setModalFoto] = useState(false)

  function iniciarEdicao() {
    setNovoNome(meuPerfil?.nome || '')
    setErro(''); setSucesso(false); setEditando(true)
  }

  async function salvarNome(e) {
    e.preventDefault()
    const txt = novoNome.trim().replace(/\s+/g, ' ')
    if (txt.length < 2) { setErro('Informe um nome com pelo menos 2 caracteres.'); return }
    if (txt === meuPerfil?.nome) { setEditando(false); return }
    setSalvando(true); setErro('')
    try {
      await atualizarPreferenciasLimite({ nome: txt })
      setEditando(false)
      setSucesso(true)
      setTimeout(() => setSucesso(false), 4000)
    } catch (err) {
      setErro(err?.message || 'Não foi possível salvar o nome. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleAtualizarFoto() {
    // Recarregar perfil após alterar foto/avatar
    if (recarregarPerfil) {
      await recarregarPerfil()
    }
  }

  return (
    <PaginaInterna largo titulo="Meu perfil" descricao="Seus dados de acesso e segurança da conta.">
      {/* Identidade com foto/avatar editável */}
      <div className="card flex items-center gap-4">
        <div className="relative">
          <FotoPerfil 
            perfil={meuPerfil}
            usuario={usuario}
            tamanho="lg"
            onClick={() => !somenteLeitura && setModalFoto(true)}
            showEditIcon={!somenteLeitura}
            className={somenteLeitura ? '' : 'relative group'}
          />
          {!somenteLeitura && (
            <button
              type="button"
              onClick={() => setModalFoto(true)}
              className="absolute bottom-0 right-0 w-8 h-8 bg-marca rounded-full flex items-center justify-center text-white shadow-lg hover:bg-marca/90 transition-colors"
              title="Alterar foto"
            >
              <Camera size={16} />
            </button>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{nome}</p>
          <p className="text-sm text-gray-500 truncate">{email}</p>
        </div>
      </div>

      <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start" data-testid="perfil-colunas">
      {/* Dados pessoais */}
      <section aria-labelledby="perfil-dados">
        <h2 id="perfil-dados" className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Dados pessoais</h2>
        <div className="card !p-0 divide-y divide-gray-100 overflow-hidden">
          <div className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
                <UserRound size={17} className="text-marca" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Nome</p>
                {editando ? (
                  <form onSubmit={salvarNome} className="space-y-2" noValidate>
                    <input
                      value={novoNome}
                      onChange={e => setNovoNome(e.target.value)}
                      className="input"
                      autoFocus
                      maxLength={80}
                      autoComplete="name"
                      aria-label="Nome"
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={salvando}
                        className="btn-primary text-sm flex items-center justify-center gap-1 disabled:opacity-60">
                        {salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : 'Salvar'}
                      </button>
                      <button type="button" onClick={() => setEditando(false)} disabled={salvando}
                        className="btn-secondary text-sm flex items-center gap-1">
                        <X size={14} /> Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
                    {!somenteLeitura && (
                      <button type="button" onClick={iniciarEdicao}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-marca flex-shrink-0 py-1">
                        <Pencil size={13} /> Editar
                      </button>
                    )}
                  </div>
                )}
                {erro && <p role="alert" className="text-xs text-red-600 mt-1.5">{erro}</p>}
                {sucesso && (
                  <p role="status" className="text-xs text-green-700 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Nome atualizado com sucesso.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail size={17} className="text-blue-600" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 mb-0.5">E-mail de acesso</p>
              <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Segurança: fluxos reais já existentes */}
      {!somenteLeitura && (
        <section aria-labelledby="perfil-seguranca" className="space-y-4">
          <h2 id="perfil-seguranca" className="text-xs font-semibold uppercase tracking-wider text-gray-500 px-1">Segurança da conta</h2>
          <AlterarSenha />
          <ConfigurarBiometria />
        </section>
      )}
      </div>

      {/* Modal de seleção de foto/avatar */}
      {modalFoto && (
        <SeletorFotoPerfil
          usuario={usuario}
          perfil={meuPerfil}
          onAtualizar={handleAtualizarFoto}
          onFechar={() => setModalFoto(false)}
        />
      )}
    </PaginaInterna>
  )
}
