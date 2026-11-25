import React from 'react'
import { Link } from 'react-router-dom'
import { 
  ArrowLeft, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, 
  Calendar, Shield, PiggyBank, CreditCard, Loader2, Info 
} from 'lucide-react'
import { useSaudeFinanceira } from '../hooks/useSaudeFinanceira'
import { formatCurrency } from '../lib/utils'

const ICONES_CATEGORIA = {
  'Contas em dia': Calendar,
  'Controle de gastos': TrendingDown,
  'Reserva de emergência': Shield,
  'Endividamento': CreditCard,
  'Capacidade de economizar': PiggyBank
}

export default function SaudeFinanceira() {
  const { saudeFinanceira, carregando } = useSaudeFinanceira()

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-marca" />
      </div>
    )
  }

  if (!saudeFinanceira || !saudeFinanceira.temDados) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Saúde Financeira</h1>
        </div>

        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Info size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Dados insuficientes</h2>
          <p className="text-sm text-gray-500 mb-6">
            Cadastre suas receitas e despesas para acompanhar sua saúde financeira.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/receitas" className="btn-primary">Cadastrar receitas</Link>
            <Link to="/despesas" className="btn-secondary">Cadastrar despesas</Link>
          </div>
        </div>
      </div>
    )
  }

  const { pontuacao, nivelTexto, cor, indicadores, recomendacoes, alertas, metricas } = saudeFinanceira

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Saúde Financeira</h1>
      </div>

      {/* Alertas críticos */}
      {alertas.length > 0 && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-red-900 mb-2">Pontos de atenção</h3>
              <ul className="space-y-1">
                {alertas.map((alerta, i) => (
                  <li key={i} className="text-sm text-red-700">• {alerta}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Card principal: Pontuação */}
      <div className="card text-center" style={{ background: `linear-gradient(135deg, ${cor}15 0%, ${cor}05 100%)`, borderColor: `${cor}40` }}>
        <div className="inline-flex items-center justify-center w-32 h-32 rounded-full mx-auto mb-4"
          style={{ background: `conic-gradient(${cor} ${pontuacao * 3.6}deg, #e5e7eb ${pontuacao * 3.6}deg)` }}>
          <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center">
            <span className="text-5xl font-bold" style={{ color: cor }}>{pontuacao}</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{nivelTexto}</h2>
        <p className="text-sm text-gray-600">Sua situação financeira atual</p>
      </div>

      {/* Indicadores por categoria */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Indicadores</h2>
        <div className="grid gap-3">
          {indicadores.map((ind, i) => {
            const Icone = ICONES_CATEGORIA[ind.categoria] || Info
            const corStatus = {
              excelente: 'bg-green-50 border-green-200 text-green-700',
              bom: 'bg-blue-50 border-blue-200 text-blue-700',
              atencao: 'bg-amber-50 border-amber-200 text-amber-700',
              critico: 'bg-red-50 border-red-200 text-red-700',
              neutro: 'bg-gray-50 border-gray-200 text-gray-700'
            }[ind.status] || 'bg-gray-50 border-gray-200 text-gray-700'

            return (
              <div key={i} className={`card ${corStatus}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icone size={20} className="flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{ind.categoria}</p>
                      <p className="text-xs opacity-80 mt-0.5">{ind.descricao}</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold flex-shrink-0">{ind.pontos}/20</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Métricas resumidas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Renda comprometida</p>
            <p className="text-2xl font-bold text-gray-900">{metricas.pctComprometido}%</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Reserva de emergência</p>
            <p className="text-2xl font-bold text-gray-900">{metricas.mesesReserva} meses</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Contas vencidas</p>
            <p className="text-2xl font-bold text-gray-900">{metricas.despesasVencidas}</p>
          </div>
          {metricas.totalDividas > 0 && (
            <div className="card text-center">
              <p className="text-xs text-gray-500 mb-1">Total em dívidas</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(metricas.totalDividas)}</p>
            </div>
          )}
          {metricas.totalInvestido > 0 && (
            <div className="card text-center">
              <p className="text-xs text-gray-500 mb-1">Total investido</p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(metricas.totalInvestido)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recomendações */}
      {recomendacoes.length > 0 && (
        <div className="card bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Recomendações para você</h3>
              <ul className="space-y-2">
                {recomendacoes.map((rec, i) => (
                  <li key={i} className="text-sm text-blue-700 flex items-start gap-2">
                    <span className="text-blue-500 flex-shrink-0">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <p className="text-xs text-gray-600 leading-relaxed">
          <strong>Como calculamos:</strong> A pontuação é baseada em 5 critérios transparentes: 
          contas em dia (20 pts), controle de gastos (25 pts), reserva de emergência (25 pts), 
          endividamento (20 pts) e capacidade de economizar (10 pts). 
          Total máximo: 100 pontos.
        </p>
      </div>
    </div>
  )
}
