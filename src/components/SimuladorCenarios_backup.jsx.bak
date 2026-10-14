import React, { useState } from 'react'
import { TrendingUp, TrendingDown, Briefcase, Info, AlertTriangle, Landmark, Wallet } from 'lucide-react'
import InputMoeda from './InputMoeda'
import DestaqueValor from './DestaqueValor'
import { formatCurrency } from '../lib/utils'
import {
  simularImpactoRenda, projetarHorizontes, resumoRescisao,
} from '../lib/cenarios'

// ─────────────────────────────────────────────────────────────────────────────
// Simulador "E se...?" — cenários financeiros TEMPORÁRIOS. Usa a receita e a
// despesa mensais REAIS (vindas por props de resumoMes) e a reserva acumulada;
// não grava nada, não altera saldos. Tudo é estimativa.
// ─────────────────────────────────────────────────────────────────────────────

const CENARIOS = [
  { id: 'aumento',   nome: 'Aumento de renda',   icone: TrendingUp,   sinal: 1 },
  { id: 'reducao',   nome: 'Redução de renda',   icone: TrendingDown, sinal: -1 },
  { id: 'perda',     nome: 'Perda de renda',     icone: TrendingDown, sinal: -1 },
  { id: 'extra',     nome: 'Renda extra',        icone: TrendingUp,   sinal: 1 },
  { id: 'desligamento', nome: 'Perda de emprego / rescisão', icone: Briefcase, sinal: -1 },
]

export default function SimuladorCenarios({ receitaAtual = 0, despesaMensal = 0, reservaAtual = 0 }) {
  const [cenario, setCenario] = useState('aumento')
  const [valor, setValor] = useState('') // delta de renda (aumento/redução/extra)

  // Campos do desligamento (todos manuais/opcionais).
  const [modalidade, setModalidade] = useState('sem_justa_causa')
  const [saqueAniversario, setSaqueAniversario] = useState(false)
  const [fgts, setFgts] = useState('')
  const [saldoSalario, setSaldoSalario] = useState('')
  const [ferias, setFerias] = useState('')
  const [decimo, setDecimo] = useState('')
  const [aviso, setAviso] = useState('')
  const [adicionais, setAdicionais] = useState('')
  const [descontos, setDescontos] = useState('')
  const [rendaTemporaria, setRendaTemporaria] = useState('') // ex.: seguro-desemprego mensal informado

  const ehDesligamento = cenario === 'desligamento'

  // deltaRenda do cenário: perda/desligamento zeram a renda; aumento/redução/
  // extra aplicam o valor informado com o sinal do cenário.
  const valorNum = Number(valor) || 0
  const deltaRenda = cenario === 'perda' || ehDesligamento
    ? -receitaAtual + (Number(rendaTemporaria) || 0) // sem salário (+ renda temporária informada)
    : (CENARIOS.find(c => c.id === cenario)?.sinal || 1) * valorNum

  // Situação ATUAL (base de comparação).
  const atual = simularImpactoRenda({ receitaAtual, despesaMensal, reservaAtual, deltaRenda: 0 })
  // Cenário SIMULADO.
  const sim = simularImpactoRenda({ receitaAtual, despesaMensal, reservaAtual, deltaRenda })
  const horizontes = projetarHorizontes({ reservaAtual, saldoMensal: sim.saldoMensal })

  // Rescisão (só no desligamento) — valores manuais.
  const rescisao = ehDesligamento
    ? resumoRescisao({
        modalidade,
        saldoSalario, ferias, decimoTerceiro: decimo, avisoPrevio: aviso,
        adicionais, descontos, saldoFgts: fgts,
      })
    : null
  // Elegibilidade do FGTS respeita o saque-aniversário escolhido.
  const fgtsBloqueadoAniversario = ehDesligamento && saqueAniversario && Number(fgts) > 0

  return (
    <div className="space-y-4">
      {/* Seletor de cenário */}
      <div>
        <label className="label">Escolha o cenário</label>
        <div className="grid grid-cols-2 gap-2">
          {CENARIOS.map(c => (
            <button key={c.id} type="button" onClick={() => setCenario(c.id)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                cenario === c.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
              }`}>
              <c.icone size={16} className="flex-shrink-0" /> <span className="min-w-0 truncate">{c.nome}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Entrada por cenário */}
      {!ehDesligamento && (
        <div>
          <label className="label">
            {cenario === 'aumento' ? 'Quanto a renda aumenta por mês? (R$)'
              : cenario === 'reducao' ? 'Quanto a renda reduz por mês? (R$)'
              : cenario === 'extra' ? 'Valor da renda extra mensal (R$)'
              : 'Renda que ainda entra por mês, se houver (R$)'}
          </label>
          <InputMoeda valor={valor} onChangeValor={setValor} className="input" prefixo={null} />
          {cenario === 'perda' && (
            <p className="text-xs text-gray-400 mt-1">Perda total: a renda vai a zero. Informe acima só se ainda houver alguma entrada.</p>
          )}
        </div>
      )}

      {/* Desligamento: tipo + verbas manuais */}
      {ehDesligamento && (
        <div className="space-y-3">
          <div>
            <label className="label">Tipo de desligamento</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'sem_justa_causa', nome: 'Sem justa causa' },
                { id: 'pedido_demissao', nome: 'Pedido de demissão' },
                { id: 'acordo', nome: 'Acordo' },
              ].map(op => (
                <button key={op.id} type="button" onClick={() => setModalidade(op.id)}
                  className={`p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                    modalidade === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                  }`}>
                  {op.nome}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Saldo de salário (R$)</label><InputMoeda valor={saldoSalario} onChangeValor={setSaldoSalario} className="input" prefixo={null} /></div>
            <div><label className="label">Férias + 1/3 (R$)</label><InputMoeda valor={ferias} onChangeValor={setFerias} className="input" prefixo={null} /></div>
            <div><label className="label">13º proporcional (R$)</label><InputMoeda valor={decimo} onChangeValor={setDecimo} className="input" prefixo={null} /></div>
            <div><label className="label">Aviso-prévio (R$)</label><InputMoeda valor={aviso} onChangeValor={setAviso} className="input" prefixo={null} /></div>
            <div><label className="label">Verbas adicionais (R$)</label><InputMoeda valor={adicionais} onChangeValor={setAdicionais} className="input" prefixo={null} /></div>
            <div><label className="label">Descontos (R$)</label><InputMoeda valor={descontos} onChangeValor={setDescontos} className="input" prefixo={null} /></div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <label className="label flex items-center gap-1.5"><Landmark size={15} className="text-sky-600" /> Saldo de FGTS (R$)</label>
            <InputMoeda valor={fgts} onChangeValor={setFgts} className="input" prefixo={null} />
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={saqueAniversario} onChange={(e) => setSaqueAniversario(e.target.checked)} className="w-4 h-4" />
              Optei pelo saque-aniversário
            </label>
          </div>

          <div>
            <label className="label">Renda mensal durante o período, se houver (R$)</label>
            <InputMoeda valor={rendaTemporaria} onChangeValor={setRendaTemporaria} className="input" prefixo={null} />
            <p className="text-xs text-gray-400 mt-1">Ex.: seguro-desemprego ou bico. Informe o valor que você já conhece.</p>
          </div>
        </div>
      )}

      {/* ── Rescisão estimada (desligamento) ── */}
      {ehDesligamento && rescisao && (
        <div className="card border-2 border-marca">
          <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2">Rescisão estimada</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Verbas (c/ multa FGTS)</span><strong>{formatCurrency(rescisao.totalVerbas)}</strong></div>
            <div className="flex justify-between"><span className="text-gray-500">Descontos</span><strong className="text-red-500">− {formatCurrency(rescisao.totalDescontos)}</strong></div>
            <div className="flex justify-between pt-1 border-t border-gray-100"><span className="font-medium text-gray-700">Líquido da rescisão</span><strong className="text-marca">{formatCurrency(rescisao.liquidoRescisao)}</strong></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <DestaqueValor rotulo="FGTS sacável" valor={formatCurrency(rescisao.fgtsSacavel)} cor={rescisao.fgtsPodeSacar ? 'text-emerald-600' : 'text-gray-400'} />
            <DestaqueValor rotulo="Dinheiro imediato" valor={formatCurrency(rescisao.dinheiroImediato)} cor="text-marca" sub="líquido + FGTS sacável" />
          </div>
          {(!rescisao.fgtsPodeSacar || fgtsBloqueadoAniversario) && Number(fgts) > 0 && (
            <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">{rescisao.fgtsMotivo}</p>
            </div>
          )}
          <div className="mt-2 flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <Info size={15} className="text-marca flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600">
              {rescisao.seguroElegivel ? 'Pode ter direito ao seguro-desemprego (valor/parcelas conforme o tempo trabalhado).' : rescisao.seguroMotivo}
            </p>
          </div>
        </div>
      )}

      {/* ── Comparativo atual × simulado ── */}
      <div className="card">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Wallet size={14} className="text-emerald-600" /> Atual × simulado
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
            <p className="text-xs text-gray-400 mb-1">Hoje</p>
            <p className="text-xs text-gray-500">Saldo mensal</p>
            <p className={`text-lg font-bold ${atual.saldoMensal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(atual.saldoMensal)}</p>
            <p className="text-xs text-gray-400 mt-1">Gasto diário ~ {formatCurrency(atual.gastoDiario)}</p>
          </div>
          <div className="rounded-xl bg-marca-100 border border-marca p-3">
            <p className="text-xs text-marca mb-1">No cenário</p>
            <p className="text-xs text-gray-500">Saldo mensal</p>
            <p className={`text-lg font-bold ${sim.saldoMensal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(sim.saldoMensal)}</p>
            <p className="text-xs text-gray-400 mt-1">Gasto diário ~ {formatCurrency(sim.gastoDiario)}</p>
          </div>
        </div>

        {/* Reserva: por quantos meses sustenta o déficit */}
        {sim.deficitMensal > 0 && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Com déficit de <strong>{formatCurrency(sim.deficitMensal)}/mês</strong>, sua reserva de {formatCurrency(reservaAtual)} sustentaria as contas por cerca de{' '}
              <strong>{sim.mesesReserva != null ? `${sim.mesesReserva.toLocaleString('pt-BR')} ${sim.mesesReserva === 1 ? 'mês' : 'meses'}` : '—'}</strong>.
            </p>
          </div>
        )}

        {/* Projeção 3/6/12 meses */}
        <div className="mt-3">
          <p className="text-xs text-gray-500 mb-1.5">Saldo acumulado projetado (reserva + saldo mensal)</p>
          <div className="grid grid-cols-3 gap-2">
            {horizontes.resultado.map(h => (
              <div key={h.meses} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5 text-center">
                <p className="text-xs text-gray-400">{h.meses} meses</p>
                <p className={`text-sm font-bold ${h.acumulado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(h.acumulado)}</p>
              </div>
            ))}
          </div>
          {horizontes.mesEsgota != null && (
            <p className="text-xs text-amber-700 mt-2">Nesse ritmo, o dinheiro acaba por volta do mês {horizontes.mesEsgota}.</p>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Simulação temporária para planejamento. Não altera seus dados. Os valores são estimativas e não substituem o cálculo rescisório oficial.
        </p>
      </div>
    </div>
  )
}
