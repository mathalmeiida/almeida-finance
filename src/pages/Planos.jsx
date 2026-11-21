import React from 'react';
import { Check, X, Users, MessageCircle, Sparkles, ChevronRight, Building2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Planos() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const planoAtual = perfil?.subscription_plan || 'trial';
  const diasTrial = 7;

  const planos = [
    {
      id: 'premium',
      nome: 'Almeida Premium',
      preco: 'R$ 29,90',
      periodo: '/mês',
      destaque: false,
      emBreve: false,
      descricao: 'Gestão financeira pessoal completa',
      recursos: [
        'Gestão financeira pessoal completa',
        'Calendário financeiro',
        'Receitas, despesas e cartões',
        'Investimentos e metas',
        'Parcelamentos',
        'Simuladores "Posso comprar?" e "E se...?"',
        'Central de importação',
        'Almeida Família',
        'WhatsApp: até 100 respostas/mês¹',
      ],
    },
    {
      id: 'plus',
      nome: 'Almeida Plus',
      preco: 'R$ 49,90',
      periodo: '/mês',
      destaque: true,
      emBreve: false,
      descricao: 'O mais completo para quem leva finanças a sério',
      recursos: [
        'Tudo do Premium',
        'WhatsApp: até 300 respostas/mês¹',
        'Automações financeiras avançadas',
        'Recursos de maior capacidade',
        'Suporte prioritário',
      ],
    },
    {
      id: 'empresas',
      nome: 'Almeida Empresas',
      preco: 'R$ 79,90',
      periodo: '/mês',
      destaque: false,
      emBreve: true,
      descricao: 'Ambiente financeiro empresarial independente',
      recursos: [
        'Fluxo de caixa empresarial',
        'Receitas e despesas empresariais',
        'Contas a pagar e receber',
        'Faturamento',
        'Lucro e prejuízo',
        'Pró-labore',
        'Simuladores empresariais',
        'Relatórios financeiros',
      ],
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 space-y-8 pb-mobilenav">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Planos Almeida Finance
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
          Teste grátis por 7 dias. Sem cartão de crédito.
        </p>
      </div>

      {/* Aviso de Trial */}
      {planoAtual === 'trial' && (
        <div className="card bg-surface-2 border-border-col max-w-2xl mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-marca" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Teste grátis ativo</h3>
              <p className="text-sm text-gray-600">
                Você tem {diasTrial} {diasTrial === 1 ? 'dia' : 'dias'} restantes para testar todos os recursos do Almeida Plus.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cards dos planos */}
      <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto items-stretch">
        {planos.map((plano) => {
          const ehAtual = plano.id === planoAtual;

          return (
            <div
              key={plano.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-white overflow-hidden transition-shadow ${
                plano.destaque
                  ? 'border-marca shadow-xl md:-mt-2 md:-mb-2'
                  : plano.emBreve
                    ? 'border-gray-200 opacity-80'
                    : 'border-gray-200'
              }`}
            >
              {/* Badge de destaque */}
              {plano.destaque && (
                <div
                  className="text-white text-xs font-bold text-center py-1.5 tracking-wide"
                  style={{ background: '#801D39' }}
                >
                  ⭐ MAIS RECOMENDADO
                </div>
              )}
              {plano.emBreve && (
                <div className="bg-gray-100 text-gray-500 text-xs font-bold text-center py-1.5 tracking-wide flex items-center justify-center gap-1">
                  <Lock size={11} /> EM BREVE
                </div>
              )}

              {/* Cabeçalho */}
              <div
                className={`p-6 border-b-2 ${plano.destaque ? 'border-marca/20' : 'border-gray-100'}`}
                style={plano.destaque ? { background: 'linear-gradient(135deg,#FFF5F7 0%,#fff 100%)' } : {}}
              >
                {plano.id === 'empresas' && (
                  <Building2 className="w-6 h-6 text-gray-400 mb-2" />
                )}
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plano.nome}</h3>
                <p className="text-xs text-gray-500 mb-3">{plano.descricao}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${plano.destaque ? 'text-marca' : 'text-gray-900'}`}>
                    {plano.preco}
                  </span>
                  <span className="text-gray-500 text-sm">{plano.periodo}</span>
                </div>
              </div>

              {/* Recursos */}
              <div className="p-6 flex-1 flex flex-col">
                <ul className="space-y-2.5 flex-1">
                  {plano.recursos.map((recurso, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plano.emBreve ? 'text-gray-300' : 'text-green-600'}`}
                      />
                      <span className={`text-sm ${plano.emBreve ? 'text-gray-400' : 'text-gray-700'} ${idx === 0 && plano.id === 'plus' ? 'font-semibold' : ''}`}>
                        {recurso}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Botão */}
                <div className="mt-6">
                  {plano.emBreve ? (
                    <div className="w-full text-center px-6 py-3 bg-gray-100 text-gray-400 font-medium rounded-xl text-sm flex items-center justify-center gap-2">
                      <Lock size={14} /> Em breve
                    </div>
                  ) : ehAtual ? (
                    <div className="w-full text-center px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl text-sm">
                      Plano atual
                    </div>
                  ) : (
                    <button
                      disabled
                      className={`w-full px-6 py-3 font-medium rounded-xl text-sm transition-colors opacity-50 cursor-not-allowed text-white`}
                      style={{ background: '#801D39' }}
                    >
                      Em breve
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 max-w-xl mx-auto">
        ¹ WhatsApp disponível quando o recurso estiver ativo. Franquia mensal renovada automaticamente.
      </p>

      {/* Recursos em destaque */}
      <div className="card bg-gradient-to-br from-pink-50 to-rose-50 border-pink-100">
        <h2 className="text-xl font-bold text-gray-900 mb-5 text-center">
          Recursos inclusos em todos os planos pagos
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: <Users className="w-6 h-6" style={{ color: '#801D39' }} />,
              bg: 'bg-pink-50',
              titulo: 'Almeida Família',
              desc: 'Crie grupos, divida despesas e atinja metas financeiras em conjunto.',
            },
            {
              icon: <MessageCircle className="w-6 h-6 text-green-600" />,
              bg: 'bg-green-50',
              titulo: 'WhatsApp Financeiro',
              desc: 'Consulte suas finanças pelo WhatsApp quando o recurso estiver ativo.',
            },
            {
              icon: <Sparkles className="w-6 h-6 text-violet-600" />,
              bg: 'bg-violet-50',
              titulo: 'Central de Importação',
              desc: 'Importe extratos, faturas e investimentos automaticamente.',
            },
          ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-5 text-center">
              <div className={`w-11 h-11 ${item.bg} rounded-full flex items-center justify-center mx-auto mb-3`}>
                {item.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-1 text-sm">{item.titulo}</h3>
              <p className="text-xs text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Consultoria */}
      <div className="card border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-14 h-14 bg-cyan-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-7 h-7 text-cyan-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Consultoria Almeida</h3>
            <p className="text-sm text-gray-600 mb-4">
              Serviço profissional de consultoria financeira com preço próprio, não incluído nos planos.
            </p>
            <button onClick={() => navigate('/consultoria')} className="btn-secondary inline-flex items-center gap-2 text-sm">
              Saiba mais
            </button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-5">Perguntas frequentes</h2>
        <div className="space-y-3">
          {[
            {
              q: 'Como funciona o teste grátis?',
              a: 'Você tem 7 dias para testar todos os recursos do Almeida Plus gratuitamente. Sem cartão de crédito. Após o período, escolha o plano ideal.',
            },
            {
              q: 'Posso cancelar a qualquer momento?',
              a: 'Sim. Sem fidelidade. Cancele quando quiser e mantenha o acesso até o fim do período pago.',
            },
            {
              q: 'Meus dados ficam privados no grupo familiar?',
              a: 'Sim. Somente despesas marcadas como "familiares" são compartilhadas. Saldo, investimentos e despesas pessoais são completamente privados.',
            },
            {
              q: 'A Consultoria está incluída nos planos?',
              a: 'Não. A Consultoria é um serviço profissional separado com contratação e preço próprios.',
            },
          ].map((item, i) => (
            <details key={i} className="card cursor-pointer group">
              <summary className="font-semibold text-gray-900 list-none flex items-center justify-between text-sm">
                {item.q}
                <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform flex-shrink-0 ml-2" />
              </summary>
              <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="text-center pt-2">
        <button onClick={() => navigate('/mais/ajuda')} className="btn-secondary inline-flex items-center gap-2 text-sm">
          Falar com suporte
        </button>
      </div>
    </div>
  );
}
