import React from 'react';
import { Check, X, Users, MessageCircle, Sparkles, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Planos() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const planoAtual = perfil?.subscription_plan || 'trial';

  // Calcular dias restantes do trial (exemplo - deve vir do backend)
  const diasTrial = 7; // TODO: Calcular do perfil.trial_end_date

  const planos = [
    {
      id: 'premium',
      nome: 'Almeida Premium',
      preco: 'R$ 19,90',
      periodo: '/mês',
      cor: 'blue',
      destaque: true,
      recursos: [
        { texto: 'Gestão financeira completa', incluido: true },
        { texto: 'Calendário financeiro', incluido: true },
        { texto: 'Receitas e despesas ilimitadas', incluido: true },
        { texto: 'Cartões e faturas', incluido: true },
        { texto: 'Investimentos', incluido: true },
        { texto: 'Metas pessoais', incluido: true },
        { texto: 'Parcelamentos', incluido: true },
        { texto: 'Simuladores', incluido: true },
        { texto: 'Central de Importação', incluido: true },
        { texto: 'Almeida Família', incluido: true },
        { texto: 'WhatsApp: até 100 respostas/mês', incluido: true },
        { texto: 'WhatsApp: até 300 respostas/mês', incluido: false },
        { texto: 'Automações avançadas', incluido: false },
      ],
    },
    {
      id: 'plus',
      nome: 'Almeida Plus',
      preco: 'R$ 29,90',
      periodo: '/mês',
      cor: 'violet',
      recursos: [
        { texto: 'Tudo do Premium', incluido: true, bold: true },
        { texto: 'WhatsApp: até 300 respostas/mês', incluido: true },
        { texto: 'Automações financeiras avançadas', incluido: true },
        { texto: 'Recursos de maior capacidade', incluido: true },
        { texto: 'Prioridade no suporte', incluido: true },
      ],
    },
  ];

  const getCores = (cor) => {
    const cores = {
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        texto: 'text-blue-900',
        botao: 'bg-marca hover:bg-[#6b1729]',
        badge: 'bg-blue-100 text-blue-700',
      },
      violet: {
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        texto: 'text-violet-900',
        botao: 'bg-violet-600 hover:bg-violet-700',
      },
    };
    return cores[cor] || cores.blue;
  };

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 space-y-8 pb-mobilenav">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Planos Almeida Finance
        </h1>
        <p className="text-base md:text-lg text-gray-600 max-w-3xl mx-auto">
          Teste grátis por 7 dias e escolha o plano ideal para suas finanças
        </p>
      </div>

      {/* Aviso de Trial */}
      {planoAtual === 'trial' && (
        <div className="card bg-gradient-to-r from-blue-50 to-violet-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Teste grátis ativo</h3>
              <p className="text-sm text-gray-600">
                Você tem {diasTrial} {diasTrial === 1 ? 'dia' : 'dias'} restantes para testar todos os recursos do Almeida Plus.
                Após o período, escolha o plano que melhor atende suas necessidades.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Cards dos planos */}
      <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {planos.map((plano) => {
          const cores = getCores(plano.cor);
          const ehAtual = plano.id === planoAtual;

          return (
            <div
              key={plano.id}
              className={`relative rounded-2xl border-2 ${
                plano.destaque ? 'border-marca shadow-xl md:scale-105' : cores.border
              } bg-white overflow-hidden`}
            >
              {plano.destaque && (
                <div className="absolute top-0 right-0 text-white text-xs font-bold px-4 py-1 rounded-bl-lg" style={{background: '#801D39'}}>
                  PRINCIPAL
                </div>
              )}

              <div className={`${cores.bg} p-6 border-b-2 ${cores.border}`}>
                <h3 className={`text-2xl font-bold ${cores.texto} mb-2`}>
                  {plano.nome}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900">{plano.preco}</span>
                  <span className="text-gray-600">{plano.periodo}</span>
                </div>
              </div>

              <div className="p-6">
                <ul className="space-y-2.5 mb-6 min-h-[320px]">
                  {plano.recursos.map((recurso, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        {recurso.incluido ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <span
                        className={`text-sm ${
                          recurso.incluido ? 'text-gray-700' : 'text-gray-400 line-through'
                        } ${recurso.bold ? 'font-semibold' : ''}`}
                      >
                        {recurso.texto}
                      </span>
                    </li>
                  ))}
                </ul>

                {ehAtual ? (
                  <div className="w-full text-center px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-xl">
                    Plano atual
                  </div>
                ) : (
                  <button
                    disabled
                    className={`w-full px-6 py-3 ${cores.botao} text-white font-medium rounded-xl transition-colors opacity-50 cursor-not-allowed`}
                  >
                    Em breve
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recursos em destaque */}
      <div className="card bg-gradient-to-br from-blue-50 to-violet-50 border-blue-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Recursos Premium em destaque
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{background: '#FFF5F7'}}>
              <Users className="w-6 h-6" style={{color: '#801D39'}} />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Almeida Família</h3>
            <p className="text-sm text-gray-600">
              Crie grupos, divida despesas e atinja metas financeiras em conjunto com sua família.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">WhatsApp Financeiro</h3>
            <p className="text-sm text-gray-600">
              Receba respostas rápidas sobre suas finanças pelo WhatsApp quando o recurso estiver ativo.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 text-center hover:shadow-lg transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Automações Avançadas</h3>
            <p className="text-sm text-gray-600">
              Recursos de maior capacidade e automações financeiras disponíveis no plano Plus.
            </p>
          </div>
        </div>
      </div>

      {/* Consultoria - Serviço separado */}
      <div className="card border-2 border-cyan-200 bg-gradient-to-br from-cyan-50 to-blue-50">
        <div className="flex flex-col md:flex-row items-start gap-6">
          <div className="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MessageCircle className="w-8 h-8 text-cyan-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Consultoria Almeida</h3>
            <p className="text-gray-600 mb-4">
              Serviço profissional de consultoria financeira com contratação e preço próprios.
              Não está incluído nos planos de assinatura.
            </p>
            <button
              onClick={() => navigate('/consultoria')}
              className="btn-secondary inline-flex items-center gap-2"
            >
              Saiba mais sobre Consultoria
            </button>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Perguntas frequentes</h2>
        
        <div className="space-y-3">
          <details className="card cursor-pointer group">
            <summary className="font-semibold text-gray-900 list-none flex items-center justify-between">
              Como funciona o teste grátis?
              <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Você tem 7 dias para testar os recursos disponíveis do Almeida Plus gratuitamente.
              Após o período, escolha o plano que melhor atende suas necessidades. Não é necessário cadastrar cartão.
            </p>
          </details>

          <details className="card cursor-pointer group">
            <summary className="font-semibold text-gray-900 list-none flex items-center justify-between">
              Posso cancelar a qualquer momento?
              <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Sim. Não há fidelidade. Você pode cancelar quando quiser e continuará tendo acesso
              aos recursos até o final do período pago.
            </p>
          </details>

          <details className="card cursor-pointer group">
            <summary className="font-semibold text-gray-900 list-none flex items-center justify-between">
              Meus dados ficam privados no grupo familiar?
              <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Sim. Apenas despesas marcadas como "familiares" são compartilhadas no grupo.
              Seu saldo, investimentos e despesas pessoais permanecem completamente privados.
            </p>
          </details>

          <details className="card cursor-pointer group">
            <summary className="font-semibold text-gray-900 list-none flex items-center justify-between">
              Como funciona o WhatsApp Financeiro?
              <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              O WhatsApp Financeiro permite receber respostas sobre suas finanças quando o recurso estiver ativo.
              A franquia é mensal e varia conforme o plano escolhido.
            </p>
          </details>

          <details className="card cursor-pointer group">
            <summary className="font-semibold text-gray-900 list-none flex items-center justify-between">
              A Consultoria está incluída?
              <ChevronRight className="w-5 h-5 text-gray-400 group-open:rotate-90 transition-transform" />
            </summary>
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">
              Não. A Consultoria Almeida é um serviço profissional separado, com contratação e preço próprios.
              Consulte a página de Consultoria para mais informações.
            </p>
          </details>
        </div>
      </div>

      {/* CTA final */}
      <div className="text-center pt-4">
        <p className="text-gray-600 mb-4">
          Ainda tem dúvidas? Entre em contato pelo suporte.
        </p>
        <button
          onClick={() => navigate('/mais/ajuda')}
          className="btn-secondary inline-flex items-center gap-2"
        >
          Falar com suporte
        </button>
      </div>
    </div>
  );
}
