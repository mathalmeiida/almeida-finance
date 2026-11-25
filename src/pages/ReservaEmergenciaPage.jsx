import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Shield, TrendingUp, Target, AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useDespesas } from '../hooks/useDespesas'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { useMetas } from '../hooks/useMetas'
import { formatCurrency } from '../lib/utils'

export default function ReservaEmergenciaPage() {
  const { resumoMes, carregando: carregandoProjecao } = useProjecao()
  const { despesas } = useDespesas()
  const { investimentos } = useInvestimentos()
  const { metas } = useMetas()

  if (carregandoProjecao) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-marca" />
      </div>
    )
  }

  const hoje = new Date()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

  // ═══════════════════════════════════════════════════════
  // 1. CUSTO DE VIDA MENSAL (despesas essenciais do mês)
  // ═══════════════════════════════════════════════════════
  const custoVidaMensal = despesas
    .filter(d => {
      if (!d.data_vencimento) return false
      const data = new Date(d.data_vencimento + 'T12:00:00')
      return data.getMonth() + 1 === mesAtual && data.getFullYear() === anoAtual
    })
    .reduce((acc, d) => acc + (Number(d.valor) || 0), 0)

  // ═══════════════════════════════════════════════════════
  // 2. RESERVA ATUAL (saldo disponível + investimentos líquidos)
  // ═══════════════════════════════════════════════════════
  const reservaAtual = resumoMes.reservaAtual || 0

  // ═══════════════════════════════════════════════════════
  // 3. META DE RESERVA (ideal: 6 meses de custo de vida)
  // ═══════════════════════════════════════════════════════
  const metaReservaIdeal = custoVidaMensal * 6
  const metaReservaMinima = custoVidaMensal * 3

  // ═══════════════════════════════════════════════════════
  // 4. PROGRESSO ATUAL
  // ═══════════════════════════════════════════════════════
  const mesesCobertos = custoVidaMensal > 0 ? reservaAtual / custoVidaMensal : 0
  const pctProgresso = metaReservaIdeal > 0 ? (reservaAtual / metaReservaIdeal) * 100 : 0
  const faltaParaMinimo = Math.max(0, metaReservaMinima - reservaAtual)
  const faltaParaIdeal = Math.max(0, metaReservaIdeal - reservaAtual)

  // ═══════════════════════════════════════════════════════
  // 5. CAPACIDADE DE ECONOMIA (sobra mensal)
  // ═══════════════════════════════════════════════════════
  const receitaMensal = resumoMes.receitaMes || 0
  const comprometimentoMensal = resumoMes.compromissosMes || 0
  const sobraMensal = receitaMensal - comprometimentoMensal

  // ═══════════════════════════════════════════════════════
  // 6. ESTIMATIVA DE TEMPO (meses até atingir meta)
  // ═══════════════════════════════════════════════════════
  const mesesParaMinimo = sobraMensal > 0 ? Math.ceil(faltaParaMinimo / sobraMensal) : null
  const mesesParaIdeal = sobraMensal > 0 ? Math.ceil(faltaParaIdeal / sobraMensal) : null

  // ═══════════════════════════════════════════════════════
  // 7. VERIFICAR SE JÁ EXISTE META DE RESERVA
  // ═══════════════════════════════════════════════════════
  const metaReservaExistente = metas.find(m => 
    !m.atingida && 
    (m.nome || '').toLowerCase().includes('reserva') ||
    (m.nome || '').toLowerCase().includes('emergência')
  )

  // ═══════════════════════════════════════════════════════
  // 8. STATUS E RECOMENDAÇÕES
  // ═══════════════════════════════════════════════════════
  let status, cor, icone, mensagem, recomendacoes

  if (mesesCobertos >= 6) {
    status = 'excelente'
    cor = '#10b981'
    icone = '✅'
    mensagem = 'Reserva excelente!'
    recomendacoes = [
      'Sua reserva está no nível ideal',
      'Continue mantendo este valor de segurança',
      'Considere investir o excedente em ativos de maior retorno'
    ]
  } else if (mesesCobertos >= 3) {
    status = 'bom'
    cor = '#3b82f6'
    icone = '👍'
    mensagem = 'Reserva adequada'
    recomendacoes = [
      `Você está a ${formatCurrency(faltaParaIdeal)} da meta ideal (6 meses)`,
      sobraMensal > 0 && mesesParaIdeal
        ? `Continue guardando: faltam aproximadamente ${mesesParaIdeal} meses`
        : 'Busque aumentar sua capacidade de economizar',
      'Mantenha este valor em investimentos líquidos e seguros'
    ].filter(Boolean)
  } else if (mesesCobertos >= 1) {
    status = 'atencao'
    cor = '#f59e0b'
    icone = '⚠️'
    mensagem = 'Reserva insuficiente'
    recomendacoes = [
      `Priorize construir reserva de 3-6 meses (falta ${formatCurrency(faltaParaMinimo)})`,
      sobraMensal > 0 && mesesParaMinimo
        ? `Guardando ${formatCurrency(sobraMensal)}/mês, levará ${mesesParaMinimo} meses`
        : 'Revise seus gastos para aumentar a capacidade de economizar',
      'Evite fazer novas dívidas ou grandes compras'
    ].filter(Boolean)
  } else if (reservaAtual > 0) {
    status = 'critico'
    cor = '#ef4444'
    icone = '🚨'
    mensagem = 'Reserva crítica'
    recomendacoes = [
      'Sua reserva não cobre nem 1 mês de despesas',
      'Priorize URGENTEMENTE construir uma reserva',
      sobraMensal > 0
        ? `Comece guardando ${formatCurrency(sobraMensal)}/mês`
        : 'Corte gastos não essenciais para liberar recursos'
    ].filter(Boolean)
  } else {
    status = 'critico'
    cor = '#ef4444'
    icone = '❌'
    mensagem = 'Sem reserva de emergência'
    recomendacoes = [
      'Você está totalmente desprotegido contra imprevistos',
      'Comece HOJE a construir uma reserva de emergência',
      'Meta inicial: 1 mês de despesas (' + formatCurrency(custoVidaMensal) + ')'
    ]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reserva de Emergência</h1>
          <p className="text-sm text-gray-500 mt-1">Proteja-se contra imprevistos</p>
        </div>
      </div>

      {/* Card status */}
      <div
        className="card text-center"
        style={{
          background: `linear-gradient(135deg, ${cor}15 0%, ${cor}05 100%)`,
          borderColor: `${cor}40`
        }}
      >
        <div className="text-6xl mb-4">{icone}</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: cor }}>
          {mensagem}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Você tem {mesesCobertos.toFixed(1)} mês(es) de reserva
        </p>
        <div className="max-w-xs mx-auto">
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.min(100, pctProgresso)}%`,
                backgroundColor: cor
              }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {Math.round(pctProgresso)}% da meta ideal (6 meses)
          </p>
        </div>
      </div>

      {/* Métricas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sua situação</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Reserva atual</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(reservaAtual)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Custo de vida/mês</p>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(custoVidaMensal)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Meses cobertos</p>
            <p className="text-lg font-bold text-gray-900">{mesesCobertos.toFixed(1)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Meta mínima (3 meses)</p>
            <p className="text-sm font-bold text-amber-600">{formatCurrency(metaReservaMinima)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Meta ideal (6 meses)</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(metaReservaIdeal)}</p>
          </div>
          <div className="card text-center">
            <p className="text-xs text-gray-500 mb-1">Sobra mensal</p>
            <p className={`text-sm font-bold ${sobraMensal > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(sobraMensal)}
            </p>
          </div>
        </div>
      </div>

      {/* Recomendações */}
      <div className="card bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Plano de ação</h3>
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

      {/* Meta existente */}
      {metaReservaExistente && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-start gap-3">
            <Target size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-green-900 mb-1">
                Meta ativa: {metaReservaExistente.nome}
              </h3>
              <p className="text-sm text-green-700 mb-3">
                Progresso: {formatCurrency(Number(metaReservaExistente.valor_atual) || 0)} de{' '}
                {formatCurrency(Number(metaReservaExistente.valor_alvo) || 0)}
              </p>
              <Link to="/metas" className="text-xs font-medium text-green-600 hover:underline">
                Ver meta →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Criar meta (se não existir) */}
      {!metaReservaExistente && faltaParaMinimo > 0 && (
        <div className="card bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <Target size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-900 mb-2">Sugestão: Crie uma meta</h3>
              <p className="text-sm text-amber-700 mb-3">
                Meta sugerida: {formatCurrency(metaReservaMinima)} em{' '}
                {mesesParaMinimo ? `${mesesParaMinimo} meses` : 'prazo flexível'}
              </p>
              <Link to="/metas" className="btn-primary text-sm">
                Criar meta de reserva
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="card bg-gray-50 border-gray-200">
        <div className="flex items-start gap-2">
          <Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            A reserva de emergência deve cobrir de 3 a 6 meses de despesas essenciais. Mantenha esse
            valor em investimentos líquidos e de baixo risco (poupança, CDB, Tesouro Selic).
          </p>
        </div>
      </div>
    </div>
  )
}
