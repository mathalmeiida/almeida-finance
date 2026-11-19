import React from 'react';
import { Check, X, Users, MessageCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Planos() {
  const { perfil } = useAuth();
  const navigate = useNavigate();
  const planoAtual = perfil?.subscription_plan || 'free';

  const planos = [
    {
      id: 'free',
      nome: 'Almeida Free',
      preco: 'R$ 0',
      periodo: '',
      cor: 'gray',
      recursos: [
        { texto: 'Receitas e despesas ilimitadas', incluido: true },
        { texto: 'Cartões e faturas', incluido: true },
        { texto: 'Metas pessoais', incluido: true },
        { texto: 'Investimentos', incluido: true },
        { texto: 'Projeção financeira', incluido: true },
        { texto: 'Calendário financeiro', incluido: true },
        { texto: 'Grupos familiares', incluido: false },
        { texto: 'WhatsApp Financeiro', incluido: false },
        { texto: 'Consultoria', incluido: false },
      ],
    },
    {
      id: 'premium',
      nome: 'Almeida Premium',
      preco: 'R$ 19,90',
      periodo: '/mês',
      cor: 'blue',
      destaque: true,
      recursos: [
        { texto: 'Tudo do Free', incluido: true, bold: true },
        { texto: 'Grupos familiares ilimitados', incluido: true },
        { texto: 'Divisão de despesas', incluido: true },
        { texto: 'Metas compartilhadas', incluido: true },
        { texto: 'WhatsApp: 100 mensagens/mês', incluido: true },
        { texto: 'Registro automático por WhatsApp', incluido: true },
        { texto: 'Acesso à Consultoria', incluido: true },
        { texto: 'WhatsApp: 300 mensagens/mês', incluido: false },
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
        { texto: 'WhatsApp: 300 mensagens/mês', incluido: true },
        { texto: 'Prioridade no suporte', incluido: true },
        { texto: 'Acesso antecipado a novos recursos', incluido: true },
      ],
    },
  ];

  const getCores = (cor) => {
    const cores = {
      gray: {
        bg: 'bg-gray-50',
        border: 'border-gray-200',
        texto: 'text-gray-900',
        botao: 'bg-gray-600 hover:bg-gray-700',
      },
      blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        texto: 'text-blue-900',
        botao: 'bg-blue-600 hover:bg-blue-700',
        badge: 'bg-blue-100 text-blue-700',
      },
      violet: {
        bg: 'bg-violet-50',
        border: 'border-violet-200',
        texto: 'text-violet-900',
        botao: 'bg-violet-600 hover:bg-violet-700',
      },
    };
    return cores[cor] || cores.gray;
  };

  return (
    <div className="af-container py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Escolha o plano ideal para você
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Comece gratuitamente e faça upgrade quando quiser gerenciar finanças em família
            ou automatizar registros pelo WhatsApp.
          </p>
        </div>

        {/* Cards dos planos */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {planos.map((plano) => {
            const cores = getCores(plano.cor);
            const ehAtual = plano.id === planoAtual;

            return (
              <div
                key={plano.id}
                className={`relative rounded-2xl border-2 ${
                  plano.destaque ? 'border-blue-400 shadow-xl scale-105' : cores.border
                } bg-white overflow-hidden`}
              >
                {plano.destaque && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                    RECOMENDADO
                  </div>
                )}

                <div className={`${cores.bg} p-6 border-b-2 ${cores.border}`}>
                  <h3 className={`text-2xl font-bold ${cores.texto} mb-2`}>
                    {plano.nome}
                  </h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{plano.preco}</span>
                    {plano.periodo && (
                      <span className="text-gray-600">{plano.periodo}</span>
                    )}
                  </div>
                </div>

                <div className="p-6">
                  <ul className="space-y-3 mb-6">
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
                            recurso.incluido ? 'text-gray-700' : 'text-gray-400'
                          } ${recurso.bold ? 'font-semibold' : ''}`}
                        >
                          {recurso.texto}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {ehAtual ? (
                    <div className="w-full text-center px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg">
                      Plano atual
                    </div>
                  ) : plano.id === 'free' ? (
                    <div className="w-full text-center px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg">
                      Plano básico
                    </div>
                  ) : (
                    <button
                      onClick={() => navigate('/configuracoes?tab=assinatura')}
                      className={`w-full px-6 py-3 ${cores.botao} text-white font-medium rounded-lg transition-colors`}
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
        <div className="bg-gradient-to-br from-blue-50 to-violet-50 rounded-2xl p-8 border border-blue-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Recursos Premium em destaque
          </h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Almeida Família</h3>
              <p className="text-sm text-gray-600">
                Crie grupos, divida despesas e atinja metas financeiras em conjunto com sua família.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">WhatsApp Financeiro</h3>
              <p className="text-sm text-gray-600">
                Registre despesas e receitas enviando mensagens simples pelo WhatsApp.
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Consultoria</h3>
              <p className="text-sm text-gray-600">
                Compartilhe seus dados com consultor financeiro autorizado para orientação personalizada.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-12 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Perguntas frequentes</h2>
          
          <div className="space-y-4">
            <details className="bg-white rounded-lg border border-gray-200 p-4">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                Como funciona o WhatsApp Financeiro?
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                Você envia mensagens simples como "gastei R$ 50 no mercado" e o sistema registra automaticamente
                a despesa. Funciona com despesas, receitas e até parcelas. A franquia é mensal e reinicia todo dia 1º.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                Posso cancelar a qualquer momento?
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                Sim. Não há fidelidade. Você pode cancelar quando quiser e continuará tendo acesso
                aos recursos Premium até o final do período pago.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                Meus dados individuais ficam privados no grupo familiar?
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                Sim. Apenas despesas marcadas como "familiares" são compartilhadas no grupo.
                Seu saldo, investimentos e despesas pessoais permanecem completamente privados.
              </p>
            </details>

            <details className="bg-white rounded-lg border border-gray-200 p-4">
              <summary className="font-semibold text-gray-900 cursor-pointer">
                O que acontece se eu ultrapassar a franquia do WhatsApp?
              </summary>
              <p className="mt-2 text-sm text-gray-600">
                O sistema para de processar mensagens automaticamente até o próximo ciclo (dia 1º do mês).
                Você pode fazer upgrade para Plus (300 mensagens) ou registrar manualmente no app.
              </p>
            </details>
          </div>
        </div>

        {/* CTA final */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Ainda tem dúvidas? Entre em contato pelo suporte.
          </p>
          <button
            onClick={() => navigate('/mais/ajuda')}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Falar com suporte
          </button>
        </div>
      </div>
    </div>
  );
}
