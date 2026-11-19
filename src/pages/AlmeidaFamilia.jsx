import React, { useState } from 'react';
import { Users, Plus, Settings, Crown, UserPlus, Calendar, PiggyBank, TrendingUp, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamilyGroups } from '../hooks/useFamilyGroups';
import { useFamilyInvitations } from '../hooks/useFamilyInvitations';
import Modal from '../components/Modal';

export default function AlmeidaFamilia() {
  const { user, perfil } = useAuth();
  const { grupos, carregando, criarGrupo } = useFamilyGroups(user?.id);
  const { convites, aceitarConvite, recusarConvite } = useFamilyInvitations(perfil?.email);
  
  const [modalCriar, setModalCriar] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [descricaoGrupo, setDescricaoGrupo] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Verifica se usuário tem plano Premium ou Plus (ou override/admin)
  const temAcessoFamilia = perfil?.subscription_plan && perfil.subscription_plan !== 'free' 
    || perfil?.plano_override 
    || false; // ehAdmin verificado via backend

  const handleCriarGrupo = async () => {
    if (!nomeGrupo.trim()) return;

    try {
      setSalvando(true);
      await criarGrupo(nomeGrupo, descricaoGrupo || null);
      setModalCriar(false);
      setNomeGrupo('');
      setDescricaoGrupo('');
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="af-container py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando grupos familiares...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!temAcessoFamilia) {
    return (
      <div className="af-container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center border border-blue-100">
            <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Almeida Família</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Gerencie as finanças da sua família de forma colaborativa. 
              Controle despesas compartilhadas, crie metas em conjunto e tenha visibilidade total.
            </p>
            
            <div className="bg-white rounded-xl p-6 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-4">Recursos inclusos:</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Grupos familiares ilimitados</p>
                    <p className="text-sm text-gray-600">Organize diferentes núcleos (casa, filhos, pais)</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <PiggyBank className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Despesas compartilhadas</p>
                    <p className="text-sm text-gray-600">Divida contas e acompanhe pagamentos</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Metas em grupo</p>
                    <p className="text-sm text-gray-600">Planeje viagens, compras e conquistas juntos</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Calendário unificado</p>
                    <p className="text-sm text-gray-600">Visualize todas as despesas da família</p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.href = '/planos'}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Ver planos Premium e Plus
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-6 py-3 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors border border-gray-300"
              >
                Voltar ao início
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="af-container py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 rounded-xl p-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Almeida Família</h1>
                <p className="text-gray-600">Gerencie as finanças da sua família</p>
              </div>
            </div>
            <button
              onClick={() => setModalCriar(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar grupo
            </button>
          </div>
        </div>

        {/* Convites pendentes */}
        {convites.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-yellow-600" />
              Convites pendentes ({convites.length})
            </h3>
            <div className="space-y-2">
              {convites.map(convite => (
                <div key={convite.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{convite.family_groups?.nome}</p>
                    <p className="text-sm text-gray-600">
                      Convidado por {convite.convidado_por?.nome_completo || convite.convidado_por?.email}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => aceitarConvite(convite.id, convite.group_id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => recusarConvite(convite.id)}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de grupos */}
        {grupos.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-12 text-center">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum grupo familiar ainda</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Crie seu primeiro grupo familiar para começar a gerenciar despesas compartilhadas e metas em conjunto
            </p>
            <button
              onClick={() => setModalCriar(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Criar primeiro grupo
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {grupos.map(grupo => (
              <div
                key={grupo.id}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
                onClick={() => window.location.href = `/familia/${grupo.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{grupo.nome}</h3>
                      {grupo.papel === 'admin' && (
                        <div className="bg-yellow-100 rounded-full p-1">
                          <Crown className="w-3 h-3 text-yellow-600" />
                        </div>
                      )}
                    </div>
                    {grupo.descricao && (
                      <p className="text-sm text-gray-600">{grupo.descricao}</p>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    Ver detalhes
                  </span>
                  {grupo.papel === 'admin' && (
                    <span className="flex items-center gap-1">
                      <Settings className="w-4 h-4" />
                      Gerenciar
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar grupo */}
      <Modal isOpen={modalCriar} onClose={() => !salvando && setModalCriar(false)}>
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Criar grupo familiar</h2>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do grupo *
              </label>
              <input
                type="text"
                value={nomeGrupo}
                onChange={(e) => setNomeGrupo(e.target.value)}
                placeholder="Ex: Família Silva, Casa própria, etc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={salvando}
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <textarea
                value={descricaoGrupo}
                onChange={(e) => setDescricaoGrupo(e.target.value)}
                placeholder="Descreva o propósito deste grupo..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={salvando}
                maxLength={200}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setModalCriar(false)}
              disabled={salvando}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCriarGrupo}
              disabled={!nomeGrupo.trim() || salvando}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {salvando ? 'Criando...' : 'Criar grupo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
