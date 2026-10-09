import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserPlus, Activity, CheckCircle2, Loader2, ShieldCheck,
  MoreVertical, Eye, UserX, UserCheck, AlertTriangle, MessageCircle, CalendarClock,
  RotateCcw, Clock, EyeOff, MessageSquarePlus
} from 'lucide-react'
import { useAdminUsuarios } from '../hooks/useAdminUsuarios'
import { useConsultoriaInteresses } from '../hooks/useConsultoria'
import { useConsultoriaAcessos } from '../hooks/useConsultoriaAcessos'
import { useFeedbacks } from '../hooks/useFeedbacks'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import AdminConsultorias from './admin/AdminConsultorias'
import AdminAgenda from './admin/AdminAgenda'
import AdminFeedbacks from './admin/AdminFeedbacks'

// Rótulo do status de acesso de consultoria de um cliente (visão do consultor).
function BadgeAcessoConsultoria({ status }) {
  if (status === 'pendente') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock size={12} /> Aguardando autorização
      </span>
    )
  }
  if (status === 'autorizado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
        <CheckCircle2 size={12} /> Acesso autorizado
      </span>
    )
  }
  if (status === 'recusado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <UserX size={12} /> Acesso recusado
      </span>
    )
  }
  if (status === 'revogado') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
        <EyeOff size={12} /> Acesso revogado
      </span>
    )
  }
  return <span className="text-xs text-gray-400">—</span>
}

// Formata um TIMESTAMPTZ (ISO) para data pt-BR; traço se nulo.
function fmtData(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
// Data + hora curtas para "último acesso".
function fmtDataHora(iso) {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function CardMetrica({ icon: Icon, label, valor, cor, bg }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon size={18} className={cor} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900">{valor}</p>
        </div>
      </div>
    </div>
  )
}

function BadgeStatus({ ativo }) {
  return ativo ? (
    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle2 size={12} /> Ativo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
      <UserX size={12} /> Desativado
    </span>
  )
}

// Menu de ações (três pontos) por linha.
function MenuAcoes({
  usuario, ehPropriaConta, acesso,
  onVerDetalhes, onDesativar, onReativar, onReiniciarOnboarding,
  onSolicitarConsultoria, onVisualizarComoCliente,
}) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function clicarFora(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false)
    }
    if (aberto) document.addEventListener('mousedown', clicarFora)
    return () => document.removeEventListener('mousedown', clicarFora)
  }, [aberto])

  const statusAcesso = acesso?.status
  const autorizado = statusAcesso === 'autorizado'
  // "Solicitar acesso" aparece quando ainda não há vínculo ativo (sem acesso,
  // recusado ou revogado). Enquanto pendente, mostramos "Cancelar solicitação".
  const podeSolicitar = !statusAcesso || statusAcesso === 'recusado' || statusAcesso === 'revogado'
  const pendente = statusAcesso === 'pendente'

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        onClick={() => setAberto(v => !v)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        aria-label="Ações"
      >
        <MoreVertical size={16} />
      </button>
      {aberto && (
        <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1">
          <button
            onClick={() => { setAberto(false); onVerDetalhes(usuario) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <Eye size={15} /> Ver detalhes
          </button>
          <button
            onClick={() => { setAberto(false); onReiniciarOnboarding(usuario) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <RotateCcw size={15} /> Reiniciar onboarding
          </button>

          {/* ── Acesso de consultoria — nunca para a própria conta admin ── */}
          {!ehPropriaConta && (
            <>
              <div className="my-1 border-t border-gray-100" />
              {autorizado ? (
                <button
                  onClick={() => { setAberto(false); onVisualizarComoCliente(usuario) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                >
                  <Eye size={15} /> Visualizar como cliente
                </button>
              ) : pendente ? (
                <button
                  onClick={() => { setAberto(false); onSolicitarConsultoria(usuario, acesso) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  <Clock size={15} /> Cancelar solicitação
                </button>
              ) : podeSolicitar ? (
                <button
                  onClick={() => { setAberto(false); onSolicitarConsultoria(usuario, acesso) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <MessageCircle size={15} /> Solicitar acesso para consultoria
                </button>
              ) : null}
            </>
          )}

          <div className="my-1 border-t border-gray-100" />
          {usuario.ativo ? (
            <button
              onClick={() => { setAberto(false); onDesativar(usuario) }}
              disabled={ehPropriaConta}
              title={ehPropriaConta ? 'Você não pode desativar a própria conta' : ''}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <UserX size={15} /> Desativar usuário
            </button>
          ) : (
            <button
              onClick={() => { setAberto(false); onReativar(usuario) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-700 hover:bg-green-50"
            >
              <UserCheck size={15} /> Reativar usuário
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Linha de detalhe no modal "Ver detalhes".
function LinhaDetalhe({ rotulo, valor }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{rotulo}</span>
      <span className="text-sm text-gray-800 text-right">{valor}</span>
    </div>
  )
}

export default function Admin() {
  const { usuario: usuarioLogado, entrarModoConsultoria } = useAuth()
  const navigate = useNavigate()
  const { usuarios, carregando, erro, metricas, desativar, reativar, reiniciarOnboarding } = useAdminUsuarios()
  // Interesses de consultoria — FONTE ÚNICA, compartilhada com a aba
  // Consultorias (via props). Assim o badge e a lista usam o MESMO array:
  // mudar o status atualiza o indicador na hora, sem precisar recarregar.
  const { interesses, carregando: carregandoInteresses, atualizarStatus } = useConsultoriaInteresses()
  const novasSolicitacoes = interesses.filter(i => i.status === 'novo').length
  // Feedbacks — fonte única compartilhada com a aba Feedbacks (badge + lista).
  const {
    feedbacks,
    carregando: carregandoFeedbacks,
    atualizarStatus: atualizarStatusFeedback,
  } = useFeedbacks()
  const novosFeedbacks = feedbacks.filter(f => f.status === 'novo').length

  // Acessos de consultoria (autorizações). statusPorCliente: clienteId → linha.
  const { statusPorCliente, solicitarAcesso, cancelarSolicitacao } = useConsultoriaAcessos()

  const [aba, setAba] = useState('usuarios') // 'usuarios' | 'consultorias' | 'agenda'
  // Interesse selecionado para virar agendamento (passa da aba Consultorias → Agenda).
  const [interesseParaAgendar, setInteresseParaAgendar] = useState(null)

  const [detalhe, setDetalhe] = useState(null)       // usuário em "ver detalhes"
  const [confirmando, setConfirmando] = useState(null) // usuário a desativar
  const [reiniciando, setReiniciando] = useState(null) // usuário a reiniciar onboarding
  // Solicitação/cancelamento de acesso de consultoria: { usuario, acesso } | null
  const [consultoriaAlvo, setConsultoriaAlvo] = useState(null)
  const [processando, setProcessando] = useState(false)
  const [erroAcao, setErroAcao] = useState('')

  // Abre o modal de solicitar/cancelar acesso de consultoria.
  function abrirConsultoria(usuario, acesso) {
    setErroAcao('')
    setConsultoriaAlvo({ usuario, acesso: acesso || null })
  }

  // Confirma a solicitação (ou o cancelamento, se já estava pendente).
  async function confirmarConsultoria() {
    if (!consultoriaAlvo) return
    const { usuario, acesso } = consultoriaAlvo
    setProcessando(true); setErroAcao('')
    try {
      if (acesso?.status === 'pendente') {
        await cancelarSolicitacao(acesso.id)
      } else {
        await solicitarAcesso(usuario.id)
      }
      setConsultoriaAlvo(null)
    } catch (e) {
      setErroAcao(e.message || 'Não foi possível concluir a ação.')
    } finally {
      setProcessando(false)
    }
  }

  // Entra no modo "Visualizar como cliente" (somente leitura) e vai à Home.
  async function visualizarComoCliente(usuario) {
    setErroAcao('')
    try {
      await entrarModoConsultoria({ id: usuario.id, nome: usuario.nome, email: usuario.email })
      navigate('/')
    } catch (e) {
      setErroAcao(e.message || 'Não foi possível abrir a visualização do cliente.')
    }
  }

  function agendarInteresse(interesse) {
    setInteresseParaAgendar(interesse)
    setAba('agenda')
  }

  const ABAS = [
    { id: 'usuarios',     label: 'Usuários',     icon: Users },
    { id: 'consultorias', label: 'Consultorias', icon: MessageCircle, badge: novasSolicitacoes },
    { id: 'agenda',       label: 'Agenda',       icon: CalendarClock },
    { id: 'feedbacks',    label: 'Feedbacks',    icon: MessageSquarePlus, badge: novosFeedbacks },
  ]

  async function confirmarDesativar() {
    if (!confirmando) return
    setProcessando(true); setErroAcao('')
    try {
      await desativar(confirmando.id)
      setConfirmando(null)
    } catch (e) {
      setErroAcao(e.message || 'Não foi possível desativar a conta.')
    } finally {
      setProcessando(false)
    }
  }

  async function handleReativar(u) {
    setErroAcao('')
    try {
      await reativar(u.id)
    } catch (e) {
      setErroAcao(e.message || 'Não foi possível reativar a conta.')
    }
  }

  async function confirmarReiniciarOnboarding() {
    if (!reiniciando) return
    setProcessando(true); setErroAcao('')
    try {
      await reiniciarOnboarding(reiniciando.id)
      setReiniciando(null)
    } catch (e) {
      setErroAcao(e.message || 'Não foi possível reiniciar o onboarding.')
    } finally {
      setProcessando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel administrativo</h1>
          <p className="text-sm text-gray-500">Gestão do Almeida Finance</p>
        </div>
      </div>

      {/* Navegação por abas (rolável no mobile, sem scroll horizontal da página) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {ABAS.map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
              aba === t.id ? 'bg-marca text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <t.icon size={15} />
            {t.label}
            {/* Indicador de novas solicitações de consultoria */}
            {t.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                aba === t.id ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
              }`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Consultorias ── (recebe a FONTE ÚNICA de interesses) */}
      {aba === 'consultorias' && (
        <AdminConsultorias
          interesses={interesses}
          carregando={carregandoInteresses}
          atualizarStatus={atualizarStatus}
          onAgendar={agendarInteresse}
        />
      )}

      {/* Aviso de novas solicitações — card no topo do painel (qualquer aba). */}
      {novasSolicitacoes > 0 && aba !== 'consultorias' && (
        <button
          onClick={() => setAba('consultorias')}
          className="w-full card border-red-200 bg-red-50/50 flex items-center gap-3 text-left hover:bg-red-50 transition-colors"
        >
          <span className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <MessageCircle size={18} className="text-red-600" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">
              {novasSolicitacoes} nova{novasSolicitacoes > 1 ? 's' : ''} solicitaç{novasSolicitacoes > 1 ? 'ões' : 'ão'} de consultoria
            </span>
            <span className="block text-xs text-gray-500">Toque para ver os clientes interessados</span>
          </span>
        </button>
      )}

      {/* ── Aba: Agenda ── */}
      {aba === 'agenda' && (
        <AdminAgenda
          interesseParaAgendar={interesseParaAgendar}
          onConsumido={() => setInteresseParaAgendar(null)}
        />
      )}

      {/* ── Aba: Feedbacks ── (fonte única de feedbacks) */}
      {aba === 'feedbacks' && (
        <AdminFeedbacks
          feedbacks={feedbacks}
          carregando={carregandoFeedbacks}
          atualizarStatus={atualizarStatusFeedback}
        />
      )}

      {/* ── Aba: Usuários ── */}
      {aba === 'usuarios' && (carregando ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : erro ? (
        <div className="card text-sm text-red-600">
          Não foi possível carregar os dados: {erro}
        </div>
      ) : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <CardMetrica icon={Users} label="Total de usuários" valor={metricas.total}
              cor="text-blue-600" bg="bg-blue-50" />
            <CardMetrica icon={UserPlus} label="Novos (7 dias)" valor={metricas.novos7}
              cor="text-green-600" bg="bg-green-50" />
            <CardMetrica icon={UserPlus} label="Novos (30 dias)" valor={metricas.novos30}
              cor="text-emerald-600" bg="bg-emerald-50" />
            <CardMetrica icon={Activity} label="Ativos (30 dias)" valor={metricas.ativos30}
              cor="text-amber-600" bg="bg-amber-50" />
            <CardMetrica icon={CheckCircle2} label="Onboarding concluído" valor={metricas.onboardingConcluido}
              cor="text-indigo-600" bg="bg-indigo-50" />
          </div>

          {erroAcao && (
            <div className="card text-sm text-red-600 flex items-center gap-2">
              <AlertTriangle size={16} /> {erroAcao}
            </div>
          )}

          {/* Lista de usuários */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Usuários cadastrados ({usuarios.length})
            </h2>

            {usuarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário encontrado.</p>
            ) : (
              <>
              {/* Desktop (md+): tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Nome</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">E-mail</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Cadastro</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Último acesso</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Onboarding</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Consultoria</th>
                      <th className="pb-2 pr-4 text-xs font-medium text-gray-500">Status</th>
                      <th className="pb-2 text-xs font-medium text-gray-500 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {usuarios.map(u => {
                      const ehPropriaConta = u.id === usuarioLogado?.id
                      const acesso = statusPorCliente[u.id]
                      return (
                        <tr key={u.id} className={u.ativo === false ? 'bg-red-50/30' : ''}>
                          <td className="py-2.5 pr-4 text-gray-800">
                            <span className="flex items-center gap-2">
                              {u.nome || '—'}
                              {u.papel === 'admin' && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                                  admin
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">{u.email || '—'}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{fmtData(u.criado_em)}</td>
                          <td className="py-2.5 pr-4 text-gray-600">{fmtDataHora(u.ultimo_acesso)}</td>
                          <td className="py-2.5 pr-4">
                            {u.onboarding_concluido ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                                <CheckCircle2 size={12} /> Concluído
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            {ehPropriaConta ? <span className="text-xs text-gray-400">—</span>
                              : <BadgeAcessoConsultoria status={acesso?.status} />}
                          </td>
                          <td className="py-2.5 pr-4">
                            <BadgeStatus ativo={u.ativo !== false} />
                          </td>
                          <td className="py-2.5 text-right">
                            <MenuAcoes
                              usuario={u}
                              ehPropriaConta={ehPropriaConta}
                              acesso={acesso}
                              onVerDetalhes={setDetalhe}
                              onDesativar={setConfirmando}
                              onReativar={handleReativar}
                              onReiniciarOnboarding={setReiniciando}
                              onSolicitarConsultoria={abrirConsultoria}
                              onVisualizarComoCliente={visualizarComoCliente}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile (<md): cada usuário como card */}
              <div className="md:hidden space-y-3">
                {usuarios.map(u => {
                  const ehPropriaConta = u.id === usuarioLogado?.id
                  const acesso = statusPorCliente[u.id]
                  return (
                    <div
                      key={u.id}
                      className={`rounded-xl border p-3 ${u.ativo === false ? 'border-red-100 bg-red-50/30' : 'border-gray-100 bg-white'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                            <span className="truncate">{u.nome || '—'}</span>
                            {u.papel === 'admin' && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">admin</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{u.email || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <BadgeStatus ativo={u.ativo !== false} />
                          <MenuAcoes
                            usuario={u}
                            ehPropriaConta={ehPropriaConta}
                            acesso={acesso}
                            onVerDetalhes={setDetalhe}
                            onDesativar={setConfirmando}
                            onReativar={handleReativar}
                            onReiniciarOnboarding={setReiniciando}
                            onSolicitarConsultoria={abrirConsultoria}
                            onVisualizarComoCliente={visualizarComoCliente}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 pt-3 border-t border-gray-100">
                        <div>
                          <p className="text-[11px] text-gray-400">Cadastro</p>
                          <p className="text-xs text-gray-700">{fmtData(u.criado_em)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">Último acesso</p>
                          <p className="text-xs text-gray-700">{fmtDataHora(u.ultimo_acesso)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">Onboarding</p>
                          <p className="text-xs text-gray-700">{u.onboarding_concluido ? 'Concluído' : 'Pendente'}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-gray-400">Consultoria</p>
                          {ehPropriaConta
                            ? <p className="text-xs text-gray-400">—</p>
                            : <div className="mt-0.5"><BadgeAcessoConsultoria status={acesso?.status} /></div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              </>
            )}
          </div>
        </>
      ))}

      {/* Modal: Ver detalhes */}
      {detalhe && (
        <Modal aberto={true} onFechar={() => setDetalhe(null)} titulo="Detalhes do usuário">
          <div className="space-y-1">
            <LinhaDetalhe rotulo="Nome" valor={detalhe.nome || '—'} />
            <LinhaDetalhe rotulo="E-mail" valor={detalhe.email || '—'} />
            <LinhaDetalhe rotulo="Data de cadastro" valor={fmtData(detalhe.criado_em)} />
            <LinhaDetalhe rotulo="Último acesso" valor={fmtDataHora(detalhe.ultimo_acesso)} />
            <LinhaDetalhe
              rotulo="Onboarding"
              valor={detalhe.onboarding_concluido ? 'Concluído' : 'Pendente'}
            />
            <LinhaDetalhe
              rotulo="Papel"
              valor={detalhe.papel === 'admin' ? 'Administrador' : 'Usuário'}
            />
            <LinhaDetalhe
              rotulo="Status da conta"
              valor={detalhe.ativo !== false ? 'Ativo' : 'Desativado'}
            />
            <LinhaDetalhe
              rotulo="Acesso de consultoria"
              valor={(() => {
                const s = statusPorCliente[detalhe.id]?.status
                if (s === 'pendente') return 'Aguardando autorização'
                if (s === 'autorizado') return 'Acesso autorizado'
                if (s === 'recusado') return 'Acesso recusado'
                if (s === 'revogado') return 'Acesso revogado'
                return 'Sem solicitação'
              })()}
            />
          </div>
        </Modal>
      )}

      {/* Modal: confirmação de desativação */}
      {confirmando && (
        <Modal aberto={true} onFechar={() => !processando && setConfirmando(null)} titulo="Desativar usuário">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                Você vai desativar <strong>{confirmando.nome || confirmando.email}</strong>.
                A pessoa perderá o acesso ao aplicativo, mas <strong>nenhum dado será apagado</strong>.
                Você pode reativar a conta depois.
              </p>
            </div>
            {erroAcao && <p className="text-xs text-red-500">{erroAcao}</p>}
            <div className="flex gap-3">
              <button onClick={() => setConfirmando(null)} disabled={processando}
                className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmarDesativar} disabled={processando}
                className="btn-primary flex-1 flex items-center justify-center gap-2 !bg-red-600 hover:!bg-red-700">
                {processando ? <><Loader2 size={15} className="animate-spin" /> Desativando...</> : 'Desativar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: confirmação de reinício do onboarding */}
      {reiniciando && (
        <Modal aberto={true} onFechar={() => !processando && setReiniciando(null)} titulo="Reiniciar onboarding deste usuário?">
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
              <RotateCcw size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-800">
                Na próxima vez que <strong>{reiniciando.nome || reiniciando.email}</strong> acessar
                o Almeida Finance, ele começará novamente pela primeira etapa do onboarding.
                Nenhum dado financeiro é apagado — receitas, despesas, cartões, parcelas e saldo
                permanecem intactos.
              </p>
            </div>
            {erroAcao && <p className="text-xs text-red-500">{erroAcao}</p>}
            <div className="flex gap-3">
              <button onClick={() => setReiniciando(null)} disabled={processando}
                className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmarReiniciarOnboarding} disabled={processando}
                className="btn-primary flex-1 flex items-center justify-center gap-2">
                {processando ? <><Loader2 size={15} className="animate-spin" /> Reiniciando...</> : 'Confirmar reinício'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: solicitar / cancelar acesso de consultoria */}
      {consultoriaAlvo && (() => {
        const ehCancelamento = consultoriaAlvo.acesso?.status === 'pendente'
        const nome = consultoriaAlvo.usuario.nome || consultoriaAlvo.usuario.email
        return (
          <Modal
            aberto={true}
            onFechar={() => !processando && setConsultoriaAlvo(null)}
            titulo={ehCancelamento ? 'Cancelar solicitação?' : 'Solicitar acesso para consultoria?'}
          >
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
                <MessageCircle size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  {ehCancelamento ? (
                    <>A solicitação pendente para <strong>{nome}</strong> será cancelada.</>
                  ) : (
                    <>
                      Será enviada a <strong>{nome}</strong> uma solicitação para visualizar os
                      dados financeiros durante a consultoria. O acesso só é liberado depois que
                      o cliente <strong>autorizar</strong>, é <strong>somente leitura</strong> e
                      pode ser revogado por ele a qualquer momento.
                    </>
                  )}
                </p>
              </div>
              {erroAcao && <p className="text-xs text-red-500">{erroAcao}</p>}
              <div className="flex gap-3">
                <button onClick={() => setConsultoriaAlvo(null)} disabled={processando}
                  className="btn-secondary flex-1">Voltar</button>
                <button onClick={confirmarConsultoria} disabled={processando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {processando
                    ? <><Loader2 size={15} className="animate-spin" /> Processando...</>
                    : (ehCancelamento ? 'Cancelar solicitação' : 'Enviar solicitação')}
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
