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

  { id: 'desligamento', nome: 'Desemprego', icone: Briefcase, sinal: -1 },

]



// Cenários genéricos do modo "Renda profissional" (apenas rótulos; NÃO há
// cálculo específico por cenário — todos usam os mesmos 4 campos locais).
const CENARIOS_PRO = [
  'Mais demandas',
  'Aumentar ticket médio',
  'Redução de demanda',
  'Contratar apoio',
  'Comprar equipamentos',
  'Expandir operação',
]

export default function SimuladorCenarios({ receitaAtual = 0, despesaMensal = 0, reservaAtual = 0 }) {

  // Modo do simulador: 'pessoal' (como já era) ou 'profissional' (novo).
  const [modo, setModo] = useState('pessoal')

  // ── Estado do modo profissional (campos locais; não grava nada) ──
  const [cenarioPro, setCenarioPro] = useState(CENARIOS_PRO[0])
  const [receitaExtraMensal, setReceitaExtraMensal] = useState('')
  const [reducaoReceitaMensal, setReducaoReceitaMensal] = useState('')
  const [custoExtraMensal, setCustoExtraMensal] = useState('')
  const [investimentoPontual, setInvestimentoPontual] = useState('')

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

  const deltaRenda = ehDesligamento
    ? -receitaAtual + (Number(rendaTemporaria) || 0)
    : cenario === 'perda'
      ? -receitaAtual + valorNum
      : (CENARIOS.find(c => c.id === cenario)?.sinal || 1) * valorNum

  // Situação ATUAL (base de comparação).

  const atual = simularImpactoRenda({ receitaAtual, despesaMensal, reservaAtual, deltaRenda: 0 })

  // Cenário SIMULADO.

  const sim = simularImpactoRenda({ receitaAtual, despesaMensal, reservaAtual, deltaRenda })

  const horizontes = projetarHorizontes({ reservaAtual, saldoMensal: sim.saldoMensal })

  const diferencaMensal = sim.saldoMensal - atual.saldoMensal
  const semRenda = (cenario === 'perda' || ehDesligamento)
  const recomendacao = sim.saldoMensal < 0
    ? 'A projeção indica déficit. Revise despesas essenciais e a reserva disponível antes de assumir novos compromissos.'
    : diferencaMensal > 0
      ? 'Considere destinar parte da sobra adicional à reserva financeira antes de aumentar despesas fixas.'
      : diferencaMensal < 0
        ? 'Revise despesas variáveis e compare a nova sobra com seus compromissos mensais.'
        : 'Acompanhe seus gastos e mantenha uma margem financeira para imprevistos.'




  // Rescisão (só no desligamento) — valores manuais.

  const rescisao = ehDesligamento

    ? resumoRescisao({

        modalidade,

        saldoSalario, ferias, decimoTerceiro: decimo, avisoPrevio: aviso,

        adicionais, descontos, saldoFgts: fgts, saqueAniversario,

      })

    : null

  // Elegibilidade do FGTS respeita o saque-aniversário escolhido.

  const fgtsBloqueadoAniversario = ehDesligamento && saqueAniversario && Number(fgts) > 0



 return (
  <div className="space-y-4">
    {/* Seletor de MODO: Finanças pessoais × Renda profissional */}
    <div className="grid grid-cols-2 gap-2">
      {[
        { id: 'pessoal', nome: 'Finanças pessoais' },
        { id: 'profissional', nome: 'Renda profissional' },
      ].map(op => (
        <button
          key={op.id}
          type="button"
          onClick={() => setModo(op.id)}
          className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
            modo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
          }`}
        >
          {op.nome}
        </button>
      ))}
    </div>

    {modo === 'pessoal' && (
    <>
    {/* Seletor de cenário */}
    <div>
      <label className="label">Escolha o cenário</label>

      <div className="grid grid-cols-2 gap-2">
        {CENARIOS.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCenario(c.id)}
            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
              cenario === c.id
                ? 'border-marca bg-marca-100 text-marca'
                : 'border-gray-200 text-gray-600'
            }`}
          >
  <c.icone size={16} className="flex-shrink-0" />
  <span className="min-w-0">{c.nome}</span>
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

            <p className="text-xs text-gray-400 mt-1">Sua renda principal será zerada. Informe apenas a renda mensal que continuará entrando.</p>

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

            <div className="flex justify-between"><span className="text-gray-500">Verbas + multa FGTS (estimada)</span><strong>{formatCurrency(rescisao.totalVerbas)}</strong></div>

            <div className="flex justify-between"><span className="text-gray-500">Descontos</span><strong className="text-red-500">− {formatCurrency(rescisao.totalDescontos)}</strong></div>

            <div className="flex justify-between pt-1 border-t border-gray-100"><span className="font-medium text-gray-700">Líquido da rescisão</span><strong className="text-marca">{formatCurrency(rescisao.liquidoRescisao)}</strong></div>

          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">

            <DestaqueValor rotulo="FGTS sacável" valor={formatCurrency(rescisao.fgtsSacavel)} cor={rescisao.fgtsPodeSacar ? 'text-emerald-600' : 'text-gray-400'} />

            <DestaqueValor rotulo="Total potencial" valor={formatCurrency(rescisao.dinheiroImediato)} cor="text-marca" sub="recebido em prazos diferentes" />

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

            <p className="text-xs text-gray-500">Sobra mensal estimada</p>

            <p className={`text-lg font-bold ${atual.saldoMensal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(atual.saldoMensal)}</p>

            <p className="text-xs text-gray-400 mt-1">Gasto diário ~ {formatCurrency(atual.gastoDiario)}</p>

          </div>

          <div className="rounded-xl bg-marca-100 border border-marca p-3">

            <p className="text-xs text-marca mb-1">No cenário</p>

            <p className="text-xs text-gray-500">Sobra mensal estimada</p>

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



        {/* Diferença mensal estimada (+ variação %) e impacto adicional
            acumulado — mesmo padrão do modo profissional. Reaproveita
            diferencaMensal já calculado. O modo pessoal não tem investimento
            pontual, então investimentoPessoal = 0 (descontado uma única vez). */}
        {(() => {
          const investimentoPessoal = 0
          const variacaoPct = atual.saldoMensal !== 0
            ? (diferencaMensal / Math.abs(atual.saldoMensal)) * 100
            : null
          const impacto = [3, 6, 12].map(meses => ({
            meses,
            valor: diferencaMensal * meses - investimentoPessoal,
          }))
          return (
            <>
              {/* Diferença mensal estimada */}
              <div className="mt-3 rounded-2xl bg-marca-grad text-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-white/85">Diferença mensal estimada</p>
                <p className="text-2xl sm:text-3xl font-extrabold mt-1 break-words">
                  {diferencaMensal >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diferencaMensal))}
                  <span className="text-sm font-semibold text-white/85 ml-2">
                    {variacaoPct == null ? 'Não aplicável' : `${variacaoPct >= 0 ? '+' : ''}${variacaoPct.toFixed(1).replace('.', ',')}%`}
                  </span>
                </p>
                <p className="text-xs text-white/85 mt-1">
                  {diferencaMensal > 0 ? 'Cenário positivo — sua sobra mensal aumentaria.'
                    : diferencaMensal < 0 ? 'Cenário negativo — sua sobra mensal diminuiria.'
                    : 'Sem alteração na sua sobra mensal.'}
                </p>
              </div>

              {/* Impacto adicional acumulado (ganho/perda extra, não o saldo total) */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1.5">Impacto adicional acumulado (só o ganho ou perda extra do cenário)</p>
                <div className="grid grid-cols-3 gap-2">
                  {impacto.map(h => (
                    <div key={h.meses} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5 text-center">
                      <p className="text-xs text-gray-400">{h.meses} meses</p>
                      <p className={`text-sm font-bold break-words ${h.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {h.valor >= 0 ? '+' : '−'}{formatCurrency(Math.abs(h.valor))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}

      </div>



      <div className="card space-y-3" aria-live="polite">
        <div className="flex items-center gap-2">
          <Info size={16} className="text-marca" />
          <strong className="text-sm text-gray-900">Análise do seu cenário</strong>
        </div>
        <p className="text-sm text-gray-700">
          {diferencaMensal > 0
            ? `Sua sobra mensal estimada cresce ${formatCurrency(diferencaMensal)} em relação à situação atual.`
            : diferencaMensal < 0
              ? `Sua sobra mensal estimada diminui ${formatCurrency(Math.abs(diferencaMensal))} em relação à situação atual.`
              : 'A sobra mensal permanece igual à situação atual com os valores informados.'}
        </p>
        {semRenda && (
          <p className="text-xs text-gray-600">
            {sim.deficitMensal > 0
              ? `Sem a renda principal, o déficit estimado é de ${formatCurrency(sim.deficitMensal)} por mês. A reserva inicial considerada é de ${formatCurrency(reservaAtual)}.`
              : 'Com as entradas informadas, não há déficit mensal estimado neste cenário.'}
          </p>
        )}
        <p className="text-sm text-gray-700"><strong>Recomendação:</strong> {recomendacao}</p>
        <p className="text-xs text-gray-400">
          Projeções usam valores mensais constantes e reserva informada. Não incluem rendimentos, inflação nem verbas rescisórias, salvo se explicitamente incorporadas nos cálculos.
        </p>
      </div>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">

        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />

        <p className="text-xs text-blue-700">

          Simulação temporária: não altera seus dados. Multa do FGTS usa o saldo informado como aproximação; a base real pode ser diferente. Valores não são necessariamente liberados juntos nem substituem cálculo rescisório oficial.

        </p>

      </div>
    </>
    )}

    {modo === 'profissional' && (() => {
      // Campos locais → cálculo genérico (sem cálculo específico por cenário).
      const receitaExtra = Number(receitaExtraMensal) || 0
      const reducaoReceita = Number(reducaoReceitaMensal) || 0
      const custoExtra = Number(custoExtraMensal) || 0
      const investimento = Number(investimentoPontual) || 0

      const receitaSimulada = receitaAtual + receitaExtra - reducaoReceita
      const despesaSimulada = despesaMensal + custoExtra
      const resultadoAtual = receitaAtual - despesaMensal
      const resultadoSimulado = receitaSimulada - despesaSimulada
      const diferenca = resultadoSimulado - resultadoAtual

      const projPro = projetarHorizontes({ reservaAtual, saldoMensal: resultadoSimulado })

      const recomendacaoPro = resultadoSimulado < 0
        ? 'O cenário fica no vermelho. Reavalie custos extras e o investimento antes de seguir.'
        : diferenca > 0
          ? 'O cenário melhora seu resultado mensal. Reserve parte do ganho antes de assumir custos fixos.'
          : diferenca < 0
            ? 'O cenário reduz seu resultado mensal. Verifique se o retorno compensa os custos adicionais.'
            : 'O resultado mensal se mantém. Ajuste os valores para comparar possibilidades.'

      const mesesRetorno = (investimento > 0 && diferenca > 0)
        ? Math.ceil(investimento / diferenca)
        : null

      return (
        <div className="space-y-4">
          {/* Cenários genéricos (apenas seleção; mesmo cálculo p/ todos) */}
          <div>
            <label className="label">Escolha o cenário</label>
            <div className="grid grid-cols-2 gap-2">
              {CENARIOS_PRO.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCenarioPro(c)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                    cenarioPro === c ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <Briefcase size={16} className="flex-shrink-0" />
                  <span className="min-w-0">{c}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Campos locais */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Receita extra mensal (R$)</label><InputMoeda valor={receitaExtraMensal} onChangeValor={setReceitaExtraMensal} className="input" prefixo={null} /></div>
            <div><label className="label">Redução de receita mensal (R$)</label><InputMoeda valor={reducaoReceitaMensal} onChangeValor={setReducaoReceitaMensal} className="input" prefixo={null} /></div>
            <div><label className="label">Custo extra mensal (R$)</label><InputMoeda valor={custoExtraMensal} onChangeValor={setCustoExtraMensal} className="input" prefixo={null} /></div>
            <div><label className="label">Investimento pontual (R$)</label><InputMoeda valor={investimentoPontual} onChangeValor={setInvestimentoPontual} className="input" prefixo={null} /></div>
          </div>

          {/* ── Resultado da sua simulação ── */}
          {(() => {
            // Variação % vs. resultado atual (Não aplicável se atual = 0).
            const variacaoPct = resultadoAtual !== 0
              ? (diferenca / Math.abs(resultadoAtual)) * 100
              : null
            // Impacto adicional acumulado: SÓ o ganho adicional (diferença),
            // descontando o investimento UMA única vez. Não inclui o resultado
            // atual nem é o saldo total projetado.
            const impacto = [3, 6, 12].map(meses => ({
              meses,
              valor: diferenca * meses - investimento,
            }))
            // Recuperação do investimento: só faz sentido se a diferença for
            // positiva. Caso contrário, não há recuperação no horizonte.
            const recupera = investimento > 0 && diferenca > 0
              ? Math.ceil(investimento / diferenca)
              : null
            const semRecuperacao = investimento > 0 && diferenca <= 0
            const sinal = diferenca > 0 ? 'pos' : diferenca < 0 ? 'neg' : 'zero'
            const Icone = sinal === 'pos' ? TrendingUp : sinal === 'neg' ? TrendingDown : Wallet
            const corDif = sinal === 'pos' ? 'text-emerald-600' : sinal === 'neg' ? 'text-red-600' : 'text-gray-700'

            // Explicação automática simples e correta.
            const explica = sinal === 'pos'
              ? `Neste cenário você ganha cerca de ${formatCurrency(diferenca)} a mais por mês. Esse é o ganho adicional (não o seu saldo total).${investimento > 0 ? (recupera ? ` O investimento de ${formatCurrency(investimento)} se recupera em ~${recupera} ${recupera === 1 ? 'mês' : 'meses'}.` : '') : ''}`
              : sinal === 'neg'
                ? `Neste cenário seu resultado mensal cai cerca de ${formatCurrency(Math.abs(diferenca))}. Avalie se o retorno compensa os custos adicionais.`
                : 'Com os valores informados, o resultado mensal não muda em relação à situação atual.'

            return (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wide flex items-center gap-1.5">
                  <Wallet size={14} className="text-emerald-600" /> Resultado da sua simulação
                </p>

                {/* Dois cards: resultado atual × simulado por mês */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <p className="text-xs text-gray-500">Resultado atual / mês</p>
                    <p className={`text-lg font-bold break-words ${resultadoAtual >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(resultadoAtual)}</p>
                  </div>
                  <div className="rounded-xl bg-marca-100 border border-marca p-3">
                    <p className="text-xs text-marca">Resultado simulado / mês</p>
                    <p className={`text-lg font-bold break-words ${resultadoSimulado >= 0 ? 'text-gray-900' : 'text-red-600'}`}>{formatCurrency(resultadoSimulado)}</p>
                  </div>
                </div>

                {/* Card principal destacado: diferença mensal + variação % */}
                <div className="rounded-2xl bg-marca-grad text-white p-4">
                  <div className="flex items-center gap-2">
                    <Icone size={18} className="flex-shrink-0" />
                    <p className="text-xs font-medium uppercase tracking-wide text-white/85">Diferença mensal estimada</p>
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold mt-1 break-words">
                    {diferenca >= 0 ? '+' : '−'}{formatCurrency(Math.abs(diferenca))}
                    <span className="text-sm font-semibold text-white/85 ml-2">
                      {variacaoPct == null ? 'Não aplicável' : `${variacaoPct >= 0 ? '+' : ''}${variacaoPct.toFixed(1).replace('.', ',')}%`}
                    </span>
                  </p>
                  <p className="text-xs text-white/85 mt-1">
                    {sinal === 'pos' ? 'Cenário positivo — ganho mensal estimado.'
                      : sinal === 'neg' ? 'Cenário negativo — redução no resultado mensal.'
                      : 'Sem alteração no resultado mensal.'}
                  </p>
                </div>

                {/* Impacto adicional acumulado (3/6/12 meses) */}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">Impacto adicional acumulado (ganho/perda extra, já descontando o investimento uma vez)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {impacto.map(h => (
                      <div key={h.meses} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5 text-center">
                        <p className="text-xs text-gray-400">{h.meses} meses</p>
                        <p className={`text-sm font-bold break-words ${h.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {h.valor >= 0 ? '+' : '−'}{formatCurrency(Math.abs(h.valor))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Investimento inicial + recuperação */}
                {investimento > 0 && (
                  <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                    <Info size={15} className="text-marca flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-600">
                      Investimento inicial de <strong>{formatCurrency(investimento)}</strong>.{' '}
                      {recupera
                        ? <>Recuperação estimada em <strong>~{recupera} {recupera === 1 ? 'mês' : 'meses'}</strong> com o ganho mensal.</>
                        : semRecuperacao
                          ? 'Sem recuperação no horizonte calculado, pois não há ganho mensal positivo.'
                          : 'Informe um ganho mensal positivo para estimar a recuperação.'}
                    </p>
                  </div>
                )}

                {/* O que isso significa? */}
                <div className="card space-y-2" aria-live="polite">
                  <div className="flex items-center gap-2">
                    <Info size={16} className="text-marca" />
                    <strong className="text-sm text-gray-900">O que isso significa?</strong>
                  </div>
                  <p className={`text-sm ${corDif}`}>{explica}</p>
                  <p className="text-xs text-gray-400">
                    Estimativas com valores mensais constantes. "Diferença" e "impacto acumulado" são o ganho ADICIONAL do cenário — não o seu saldo total nem faturamento.
                  </p>
                </div>

                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-700">
                    Simulação temporária: não altera seus dados. Estimativas genéricas para apoiar a decisão.
                  </p>
                </div>
              </div>
            )
          })()}
        </div>
      )
    })()}

    </div>

  )

}