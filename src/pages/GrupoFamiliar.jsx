import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, UserPlus, Settings, Crown, DollarSign, Target,
  Calendar, CheckCircle, XCircle, Clock, Plus, TrendingUp, Receipt
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useFamilyMembers } from '../hooks/useFamilyMembers';
import { useFamilyExpenseSplits } from '../hooks/useFamilyExpenseSplits';
import { useFamilyGoals } from '../hooks/useFamilyGoals';
import { useFamilyInvitations } from '../hooks/useFamilyInvitations';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';
import InputMoeda from '../components/InputMoeda';
import { formatCurrency } from '../lib/utils';

export default function GrupoFamiliar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, perfil } = useAuth();
  
  const [grupo, setGrupo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState('despesas'); // despesas, metas, membros
  
  const { membros, ehAdmin, alterarPapel, removerMembro } = useFamilyMembers(id);
  const { divisoes, criarDivisao, dividirIgualmente, marcarPago, calcularBalanco } = useFamilyExpenseSplits(id);
  const { metas, criarMeta, contribuir } = useFamilyGoals(id);
  const { criarConvite } = useFamilyInvitations(perfil?.email);
  
  const [modalDespesa, setModalDespesa] = useState(false);
  const [modalMeta, setModalMeta] = useState(false);
  const [modalConvite, setModalConvite] = useState(false);

  useEffect(() => {
    carregarGrupo();
  }, [id]);

  const carregarGrupo = async () => {
    try {
      setCarregando(true);
      
      const { data, error } = await supabase
        .from('family_groups')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setGrupo(data);
    } catch (err) {
      console.error('Erro ao carregar grupo:', err);
      navigate('/familia');
    } finally {
      setCarregando(false);
    }
  };

  const saldos = calcularBalanco(divisoes);
  const usuarioEhAdmin = ehAdmin(user?.id);

  if (carregando || !grupo) {
    return (
      <div className="af-container py-8">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="af-container py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/familia')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para grupos
          </button>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{grupo.nome}</h1>
                {grupo.descricao && (
                  <p className="text-gray-600">{grupo.descricao}</p>
                )}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {membros.length} {membros.length === 1 ? 'membro' : 'membros'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Receipt className="w-4 h-4" />
                    {divisoes.length} {divisoes.length === 1 ? 'despesa' : 'despesas'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {metas.length} {metas.length === 1 ? 'meta' : 'metas'}
                  </span>
                </div>
              </div>

              {usuarioEhAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setModalConvite(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <UserPlus className="w-4 h-4" />
                    Convidar
                  </button>
                  <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Abas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setAbaAtiva('despesas')}
                className={`flex-1 px-6 py-3 font-medium transition-colors ${
                  abaAtiva === 'despesas'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Despesas
              </button>
              <button
                onClick={() => setAbaAtiva('metas')}
                className={`flex-1 px-6 py-3 font-medium transition-colors ${
                  abaAtiva === 'metas'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Metas
              </button>
              <button
                onClick={() => setAbaAtiva('membros')}
                className={`flex-1 px-6 py-3 font-medium transition-colors ${
                  abaAtiva === 'membros'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Membros
              </button>
            </div>
          </div>

          <div className="p-6">
            {abaAtiva === 'despesas' && (
              <AbaDespesas
                divisoes={divisoes}
                membros={membros}
                saldos={saldos}
                onCriar={() => setModalDespesa(true)}
                onMarcarPago={marcarPago}
              />
            )}

            {abaAtiva === 'metas' && (
              <AbaMetas
                metas={metas}
                membros={membros}
                onCriar={() => setModalMeta(true)}
                onContribuir={contribuir}
              />
            )}

            {abaAtiva === 'membros' && (
              <AbaMembros
                membros={membros}
                usuarioEhAdmin={usuarioEhAdmin}
                userId={user?.id}
                onAlterarPapel={alterarPapel}
                onRemover={removerMembro}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      <ModalNovaDespesa
        isOpen={modalDespesa}
        onClose={() => setModalDespesa(false)}
        membros={membros}
        onSalvar={async (dados) => {
          await criarDivisao(dados);
          setModalDespesa(false);
        }}
        dividirIgualmente={dividirIgualmente}
      />

      <ModalNovaMeta
        isOpen={modalMeta}
        onClose={() => setModalMeta(false)}
        onSalvar={async (dados) => {
          await criarMeta(dados);
          setModalMeta(false);
        }}
      />

      <ModalConvite
        isOpen={modalConvite}
        onClose={() => setModalConvite(false)}
        groupId={id}
        onConvidar={criarConvite}
      />
    </div>
  );
}

// Componente Aba Despesas
function AbaDespesas({ divisoes, membros, saldos, onCriar, onMarcarPago }) {
  if (divisoes.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Nenhuma despesa compartilhada
        </h3>
        <p className="text-gray-600 mb-6">
          Comece dividindo uma conta do grupo
        </p>
        <button
          onClick={onCriar}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Adicionar despesa
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balanço */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Balanço do grupo</h3>
        <div className="space-y-2">
          {Object.entries(saldos).map(([userId, saldo]) => {
            const membro = membros.find(m => m.user?.id === userId);
            if (!membro) return null;

            return (
              <div key={userId} className="flex items-center justify-between">
                <span className="text-gray-700">{membro.user.nome_completo}</span>
                <span
                  className={`font-medium ${
                    saldo > 0
                      ? 'text-green-600'
                      : saldo < 0
                      ? 'text-red-600'
                      : 'text-gray-600'
                  }`}
                >
                  {formatCurrency(saldo / 100)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista de despesas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Despesas recentes</h3>
          <button
            onClick={onCriar}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova despesa
          </button>
        </div>

        <div className="space-y-3">
          {divisoes.map(divisao => (
            <DespesaItem
              key={divisao.id}
              divisao={divisao}
              membros={membros}
              onMarcarPago={onMarcarPago}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente Item de Despesa
function DespesaItem({ divisao, membros, onMarcarPago }) {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={() => setExpandido(!expandido)}
      >
        <div className="flex-1">
          <h4 className="font-medium text-gray-900">{divisao.descricao}</h4>
          <p className="text-sm text-gray-600">
            Pago por {divisao.pago_por?.nome_completo}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-gray-900">
            {formatCurrency(divisao.valor_total / 100)}
          </p>
          <p className="text-xs text-gray-500">
            {new Date(divisao.criado_em).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {expandido && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          {divisao.family_split_participants?.map(p => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{p.participant?.nome_completo}</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900">
                  {formatCurrency(p.valor_devido / 100)}
                </span>
                <button
                  onClick={() => onMarcarPago(p.id)}
                  className={`p-1 rounded ${
                    p.pago
                      ? 'text-green-600 bg-green-50'
                      : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                  }`}
                >
                  {p.pago ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente Aba Metas
function AbaMetas({ metas, membros, onCriar, onContribuir }) {
  if (metas.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Nenhuma meta criada
        </h3>
        <p className="text-gray-600 mb-6">
          Defina objetivos financeiros em grupo
        </p>
        <button
          onClick={onCriar}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Criar meta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Metas do grupo</h3>
        <button
          onClick={onCriar}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nova meta
        </button>
      </div>

      {metas.map(meta => (
        <MetaItem key={meta.id} meta={meta} onContribuir={onContribuir} />
      ))}
    </div>
  );
}

// Componente Item de Meta
function MetaItem({ meta, onContribuir }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{meta.nome}</h4>
          {meta.descricao && (
            <p className="text-sm text-gray-600">{meta.descricao}</p>
          )}
        </div>
        {meta.concluida && (
          <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium">
            Concluída
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Progresso</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(meta.total_contribuido / 100)} de{' '}
            {formatCurrency(meta.valor_alvo / 100)}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${meta.progresso}%` }}
          />
        </div>

        {meta.data_alvo && (
          <p className="text-xs text-gray-500">
            Meta: {new Date(meta.data_alvo).toLocaleDateString('pt-BR')}
          </p>
        )}
      </div>
    </div>
  );
}

// Componente Aba Membros
function AbaMembros({ membros, usuarioEhAdmin, userId, onAlterarPapel, onRemover }) {
  return (
    <div className="space-y-3">
      {membros.map(membro => (
        <div
          key={membro.id}
          className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-medium">
                {membro.user?.nome_completo?.charAt(0) || '?'}
              </span>
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {membro.user?.nome_completo}
                {membro.user?.id === userId && (
                  <span className="text-sm text-gray-500 ml-2">(você)</span>
                )}
              </p>
              <p className="text-sm text-gray-600">{membro.user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {membro.papel === 'admin' && (
                <div className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Admin
                </div>
              )}
              {membro.papel === 'membro' && (
                <div className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-medium">
                  Membro
                </div>
              )}
            </div>

            {usuarioEhAdmin && membro.user?.id !== userId && (
              <button
                onClick={() => onRemover(membro.id)}
                className="text-red-600 hover:bg-red-50 p-2 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Modal Nova Despesa (simplificado - pode ser expandido)
function ModalNovaDespesa({ isOpen, onClose, membros, onSalvar, dividirIgualmente }) {
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!descricao || !valor) return;

    try {
      setSalvando(true);
      
      const valorNumerico = parseFloat(valor);
      const participantes = dividirIgualmente(valorNumerico, membros);

      await onSalvar({
        descricao,
        valor_total: Math.round(valorNumerico * 100),
        paid_by: membros[0]?.user?.id, // Simplificado
        categoria: 'outros',
        participantes
      });

      setDescricao('');
      setValor('');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Nova despesa compartilhada</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <input
              type="text"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: Conta de luz"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor total</label>
            <InputMoeda
              valor={valor}
              onChange={setValor}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={salvando}
            className="flex-1 px-4 py-2 border rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!descricao || !valor || salvando}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Modal Nova Meta (simplificado)
function ModalNovaMeta({ isOpen, onClose, onSalvar }) {
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!nome || !valor) return;

    try {
      setSalvando(true);
      await onSalvar({
        nome,
        valor_alvo: parseFloat(valor),
        data_alvo: null
      });
      setNome('');
      setValor('');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Nova meta</h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Nome da meta</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Ex: Viagem em família"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Valor alvo</label>
            <InputMoeda
              valor={valor}
              onChange={setValor}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={salvando} className="flex-1 px-4 py-2 border rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={!nome || !valor || salvando}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {salvando ? 'Criando...' : 'Criar meta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Modal Convite (simplificado)
function ModalConvite({ isOpen, onClose, groupId, onConvidar }) {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);

  const handleConvidar = async () => {
    if (!email) return;

    try {
      setEnviando(true);
      await onConvidar(groupId, email);
      setEmail('');
      onClose();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Convidar membro</h2>
        
        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="exemplo@email.com"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={enviando} className="flex-1 px-4 py-2 border rounded-lg">
            Cancelar
          </button>
          <button
            onClick={handleConvidar}
            disabled={!email || enviando}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {enviando ? 'Enviando...' : 'Enviar convite'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
