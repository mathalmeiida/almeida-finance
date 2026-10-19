// Ajuste visual: superfícies transparentes e texto herdado para acompanhar o tema do aplicativo.
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
  const [calculoAutomatico, setCalculoAutomatico] = useState(true)
  const [salarioBruto, setSalarioBruto] = useState('')
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [dataDesligamento, setDataDesligamento] = useState(new Date().toISOString().slice(0, 10))
  const [feriasAjustadas, setFeriasAjustadas] = useState('')
  const [avisoIndenizado, setAvisoIndenizado] = useState(true)
  const [solicitacoesSeguro, setSolicitacoesSeguro] = useState('3')
  const [salarioMedioSeguro, setSalarioMedioSeguro] = useState('')
  const [mesesRendaManual, setMesesRendaManual] = useState('5')
  const [recursosLiberados, setRecursosLiberados] = useState(true)

  const numero = v => Math.max(0, Number(v) || 0)
  const admissao = dataAdmissao ? new Date(`${dataAdmissao}T12:00:00`) : null
  const desligamento = dataDesligamento ? new Date(`${dataDesligamento}T12:00:00`) : null
  const datasValidas = admissao && desligamento && !isNaN(admissao) && !isNaN(desligamento) && desligamento >= admissao
  const mesesServico = datasValidas
    ? Math.max(0, (desligamento.getFullYear() - admissao.getFullYear()) * 12 + desligamento.getMonth() - admissao.getMonth() - (desligamento.getDate() < admissao.getDate() ? 1 : 0))
    : 0
  const anosCompletos = Math.floor(mesesServico / 12)
  const diasAviso = Math.min(90, 30 + 3 * anosCompletos)
  const salarioAuto = numero(salarioBruto)
  const saldoSalarioAuto = datasValidas ? salarioAuto / 30 * Math.min(30, desligamento.getDate()) : 0
  const avisoAuto = datasValidas && avisoIndenizado && modalidade !== 'pedido_demissao'
    ? salarioAuto / 30 * diasAviso * (modalidade === 'acordo' ? 0.5 : 1) : 0
  const fimProjetado = datasValidas ? new Date(desligamento.getFullYear(), desligamento.getMonth(), desligamento.getDate() + (avisoIndenizado && modalidade !== 'pedido_demissao' ? diasAviso : 0)) : null
  const avos13 = fimProjetado ? Array.from({ length: 12 }, (_, i) => i).filter(m => {
    const ano = fimProjetado.getFullYear()
    const inicioMes = new Date(ano, m, 1)
    const fimMes = new Date(ano, m + 1, 0)
    const inicioContagem = admissao > inicioMes ? admissao : inicioMes
    const fimContagem = fimProjetado < fimMes ? fimProjetado : fimMes
    return fimContagem >= inicioContagem && (Math.floor((fimContagem - inicioContagem) / 86400000) + 1) >= 15
  }).length : 0
  const decimoAuto = salarioAuto * avos13 / 12
  const camposAutoValidos = calculoAutomatico && datasValidas && salarioAuto > 0
  const verbasCalculadas = {
    saldo: camposAutoValidos ? saldoSalarioAuto : saldoSalario,
    ferias: camposAutoValidos ? feriasAjustadas : ferias,
    decimo: camposAutoValidos ? decimoAuto : decimo,
    aviso: camposAutoValidos ? avisoAuto : aviso,
  }
  // Tabela do MTE vigente em 2026. Requer confirmação dos requisitos individuais.
  const mediaSeguro = numero(salarioMedioSeguro || salarioBruto)
  const parcelaSeguro = mediaSeguro <= 0 ? 0 : Math.min(2518.65, Math.max(1621,
    mediaSeguro <= 2222.17 ? mediaSeguro * 0.8 : mediaSeguro <= 3703.99 ? 1777.74 + (mediaSeguro - 2222.17) * 0.5 : 2518.65))
  const parcelasSeguro = modalidade !== 'sem_justa_causa' ? 0 :
    solicitacoesSeguro === '1' ? (mesesServico >= 24 ? 5 : mesesServico >= 12 ? 4 : 0) :
    solicitacoesSeguro === '2' ? (mesesServico >= 24 ? 5 : mesesServico >= 12 ? 4 : mesesServico >= 9 ? 3 : 0) :
    mesesServico >= 24 ? 5 : mesesServico >= 12 ? 4 : mesesServico >= 6 ? 3 : 0
  const seguroEstimado = camposAutoValidos && parcelasSeguro > 0 ? parcelaSeguro : 0


  const ehDesligamento = cenario === 'desligamento'

  // deltaRenda do cenário: perda/desligamento zeram a renda; aumento/redução/

  // extra aplicam o valor informado com o sinal do cenário.

  const valorNum = Number(valor) || 0

  const deltaRenda = ehDesligamento

    ? -receitaAtual + (camposAutoValidos ? seguroEstimado : (Number(rendaTemporaria) || 0))

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

        saldoSalario: verbasCalculadas.saldo, ferias: verbasCalculadas.ferias, decimoTerceiro: verbasCalculadas.decimo, avisoPrevio: verbasCalculadas.aviso,

        adicionais, descontos, saldoFgts: fgts, saqueAniversario,

      })

    : null

  // Fluxo de caixa após a demissão: verba rescisória entra uma única vez.
  // O usuário escolhe se já pode contar com a liberação desses recursos.
  const dinheiroRescisao = Math.max(0, Number(rescisao?.dinheiroImediato) || 0)
  const rendaMensalTransicao = camposAutoValidos ? seguroEstimado : numero(rendaTemporaria)
  const mesesRendaTransicao = camposAutoValidos ? parcelasSeguro : Math.min(60, Math.floor(numero(mesesRendaManual)))
  const saldoInicialTransicao = numero(reservaAtual) + (recursosLiberados ? dinheiroRescisao : 0)
  const gastoMensalTransicao = numero(despesaMensal)
  const projetarSaldoTransicao = (meses) => {
    let saldo = saldoInicialTransicao
    for (let mes = 1; mes <= meses; mes++) {
      const recebe = mes <= mesesRendaTransicao ? rendaMensalTransicao : 0
      saldo += recebe - gastoMensalTransicao
    }
    return saldo
  }
  const mesesCoberturaTransicao = (() => {
    if (gastoMensalTransicao <= 0) return null
    for (let mes = 1; mes <= 600; mes++) {
      if (projetarSaldoTransicao(mes) < 0) return mes - 1
    }
    return null
  })()

  // Elegibilidade do FGTS respeita o saque-aniversário escolhido.

  const fgtsBloqueadoAniversario = ehDesligamento && saqueAniversario && Number(fgts) > 0

 return (

  <div className="space-y-6">

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

          className={`p-3.5 rounded-xl !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca text-sm sm:text-base font-medium transition-all ${

            modo === op.id ? 'bg-marca-100 text-marca shadow-sm' : 'bg-slate-500/10 text-inherit hover:bg-slate-500/20'

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

            className={`flex items-center gap-2 p-3.5 rounded-xl !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca text-sm sm:text-base font-medium text-left transition-all ${

              cenario === c.id

                ? 'bg-marca-100 text-marca shadow-sm'

                : 'bg-slate-500/10 text-inherit hover:bg-slate-500/20'

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

            <p className="text-sm opacity-80 mt-1">Sua renda principal será zerada. Informe apenas a renda mensal que continuará entrando.</p>

          )}

        </div>

      )}

      {/* Desligamento: dados e cálculo assistido */}
      {ehDesligamento && (
        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl !border-0 bg-transparent p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2"><Briefcase size={18} className="text-marca"/><h3 className="text-base font-semibold text-inherit">Dados do desligamento</h3></div>
            <label className="label">Tipo de desligamento</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[{id:'sem_justa_causa',nome:'Sem justa causa'}, {id:'pedido_demissao',nome:'Pedido'}, {id:'acordo',nome:'Acordo'}].map(op => (
                <button key={op.id} type="button" onClick={() => setModalidade(op.id)} className={`min-w-0 rounded-xl !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca px-2.5 py-3 text-xs sm:text-sm font-medium ${modalidade === op.id ? 'bg-marca-100 text-marca shadow-sm' : 'bg-slate-500/10 text-inherit hover:bg-slate-500/20'}`}>{op.nome}</button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-inherit cursor-pointer">
              <input type="checkbox" checked={calculoAutomatico} onChange={e => setCalculoAutomatico(e.target.checked)} /> Calcular verbas pelo contrato
            </label>
            {calculoAutomatico && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Salário bruto mensal</label><InputMoeda valor={salarioBruto} onChangeValor={setSalarioBruto} className="input" prefixo={null}/></div>
                <div><label className="label">Data de admissão</label><input className="input w-full" type="date" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)}/></div>
                <div><label className="label">Data de desligamento</label><input className="input w-full" type="date" value={dataDesligamento} onChange={e => setDataDesligamento(e.target.value)}/></div>
                <div><label className="label">Férias pendentes + 1/3</label><InputMoeda valor={feriasAjustadas} onChangeValor={setFeriasAjustadas} className="input" prefixo={null}/></div>
              </div>
            )}
            {calculoAutomatico && (
              <>
                <label className="flex items-center gap-2 text-xs text-inherit"><input type="checkbox" checked={avisoIndenizado} onChange={e => setAvisoIndenizado(e.target.checked)}/> Aviso indenizado (estimativa)</label>
                {camposAutoValidos ? <p className="text-xs text-inherit">Tempo de serviço: {anosCompletos} anos completos · aviso de referência: {diasAviso} dias · 13º: {avos13}/12. Férias devem ser preenchidas conforme os períodos ainda devidos.</p> : <p className="text-xs text-amber-400">Informe salário e datas válidas para calcular automaticamente. Até lá, as verbas ficam zeradas.</p>}
              </>
            )}
          </div>
          <div className="rounded-2xl !border-0 p-4 sm:p-5 space-y-4">
            <h3 className="text-base font-semibold text-inherit">Detalhamento das verbas</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ['Saldo de salário', verbasCalculadas.saldo],
                ['Férias + 1/3', verbasCalculadas.ferias],
                ['13º proporcional', verbasCalculadas.decimo],
                ['Aviso-prévio', verbasCalculadas.aviso]
              ].map(([rotulo,quantia]) => <div key={rotulo} className="rounded-xl bg-slate-500/10 !border-0 p-3 min-w-0"><p className="text-sm opacity-80">{rotulo}</p><p className="text-lg font-semibold text-inherit break-words">{formatCurrency(Number(quantia)||0)}</p></div>)}
            </div>
            {!calculoAutomatico && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Saldo de salário</label><InputMoeda valor={saldoSalario} onChangeValor={setSaldoSalario} className="input" prefixo={null}/></div>
              <div><label className="label">Férias + 1/3</label><InputMoeda valor={ferias} onChangeValor={setFerias} className="input" prefixo={null}/></div>
              <div><label className="label">13º proporcional</label><InputMoeda valor={decimo} onChangeValor={setDecimo} className="input" prefixo={null}/></div>
              <div><label className="label">Aviso-prévio</label><InputMoeda valor={aviso} onChangeValor={setAviso} className="input" prefixo={null}/></div>
            </div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><label className="label">Verbas adicionais</label><InputMoeda valor={adicionais} onChangeValor={setAdicionais} className="input" prefixo={null}/></div>
              <div><label className="label">Descontos estimados</label><InputMoeda valor={descontos} onChangeValor={setDescontos} className="input" prefixo={null}/></div>
            </div>
            <p className="text-sm opacity-80">Estimativas brutas. Informe descontos, férias e verbas específicas conforme os documentos trabalhistas.</p>
          </div>
          <div className="rounded-2xl !border-0 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2"><Landmark size={17} className="text-marca"/><h3 className="text-base font-semibold">FGTS</h3></div>
            <div><label className="label">Saldo informado no extrato</label><InputMoeda valor={fgts} onChangeValor={setFgts} className="input" prefixo={null}/></div>
            <label className="flex items-center gap-2 text-sm text-inherit"><input type="checkbox" checked={saqueAniversario} onChange={e => setSaqueAniversario(e.target.checked)}/> Optei pelo saque-aniversário</label>
            <p className="text-sm opacity-80">O saldo disponível e a base de cálculo da multa podem ser diferentes. Confira o valor com o extrato rescisório.</p>
          </div>
          <div className="rounded-2xl !border-0 p-4 sm:p-5 space-y-4">
            <h3 className="text-base font-semibold">Seguro-desemprego e renda durante a transição</h3>
            {calculoAutomatico && <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="label">Média dos 3 últimos salários</label><InputMoeda valor={salarioMedioSeguro} onChangeValor={setSalarioMedioSeguro} className="input" prefixo={null}/></div>
                <div><label className="label">Solicitação do seguro</label><select className="input w-full" value={solicitacoesSeguro} onChange={e=>setSolicitacoesSeguro(e.target.value)}><option value="1">Primeira</option><option value="2">Segunda</option><option value="3">Terceira ou posterior</option></select></div>
              </div>
              <div className="rounded-xl bg-marca-100 !border-0 p-3">
                <p className="text-xs text-marca">Benefício potencial (tabela 2026)</p>
                <p className="text-lg font-bold text-inherit">{parcelasSeguro} parcelas de {formatCurrency(seguroEstimado)}</p>
                <p className="text-xs text-inherit">Total estimado: {formatCurrency(parcelasSeguro * seguroEstimado)}. Sujeito à análise oficial, histórico de salários e demais requisitos.</p>
              </div>
            </>}
            {!calculoAutomatico && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="label">Renda temporária mensal (seguro, trabalhos etc.)</label><InputMoeda valor={rendaTemporaria} onChangeValor={setRendaTemporaria} className="input" prefixo={null}/></div><div><label className="label">Por quantos meses?</label><input type="number" min="0" max="60" step="1" value={mesesRendaManual} onChange={e => setMesesRendaManual(e.target.value)} className="input w-full" /></div></div>}
            <p className="text-sm opacity-80">Seguro-desemprego é renda mensal temporária e não integra a rescisão. Uma nova contratação pode suspender parcelas.</p>
          </div>
        </div>
      )}

      {/* ── Rescisão estimada (desligamento) ── */}

      {ehDesligamento && rescisao && (

        <div className="card !border-0">

          <p className="text-xs text-inherit font-medium uppercase tracking-wide mb-2">Rescisão estimada (bruta, salvo descontos informados)</p>

          <div className="space-y-1 text-sm">

            <div className="flex justify-between"><span className="text-current">Verbas + multa FGTS (estimada)</span><strong>{formatCurrency(rescisao.totalVerbas)}</strong></div>

            <div className="flex justify-between"><span className="text-current">Descontos</span><strong className="text-red-500">− {formatCurrency(rescisao.totalDescontos)}</strong></div>

            <div className="flex justify-between pt-1 border-t border-slate-500/15"><span className="font-medium text-inherit">Líquido da rescisão</span><strong className="text-marca">{formatCurrency(rescisao.liquidoRescisao)}</strong></div>

          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">

            <DestaqueValor rotulo="FGTS sacável (projeção)" valor={formatCurrency(rescisao.fgtsSacavel)} cor={rescisao.fgtsPodeSacar ? 'text-emerald-600' : 'text-current'} />

            <DestaqueValor rotulo="Total potencial" valor={formatCurrency(rescisao.dinheiroImediato)} cor="text-marca" sub="recebido em prazos diferentes" />

          </div>

          {(!rescisao.fgtsPodeSacar || fgtsBloqueadoAniversario) && Number(fgts) > 0 && (

            <div className="mt-2 flex items-start gap-2 bg-transparent !border-0 rounded-xl px-3 py-2">

              <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />

              <p className="text-xs text-amber-400">{rescisao.fgtsMotivo}</p>

            </div>

          )}

          <div className="mt-2 flex items-start gap-2 bg-transparent !border-0 rounded-xl px-3 py-2">

            <Info size={15} className="text-marca flex-shrink-0 mt-0.5" />

            <p className="text-xs text-inherit">

              {rescisao.seguroElegivel ? 'Pode ter direito ao seguro-desemprego (valor/parcelas conforme o tempo trabalhado).' : rescisao.seguroMotivo}

            </p>

          </div>

        </div>

      )}

      {/* Planejamento de caixa após desligamento — não duplica valores mensais. */}
      {ehDesligamento && rescisao && (
        <div className="rounded-2xl !border-0 p-4 sm:p-5 space-y-5 min-w-0">
          <div>
            <div className="flex items-center gap-2"><Wallet size={18} className="text-marca"/><h3 className="text-base font-semibold text-inherit">Por quanto tempo o dinheiro dura?</h3></div>
            <p className="text-sm opacity-80 mt-1">Projeção de caixa usando suas despesas cadastradas. A rescisão entra apenas uma vez, sem virar renda mensal.</p>
          </div>
          <label className="flex gap-2 items-start text-xs text-inherit">
            <input type="checkbox" className="mt-0.5" checked={recursosLiberados} onChange={e=>setRecursosLiberados(e.target.checked)}/>
            Considerar o total potencial da rescisão e FGTS como já disponível no início da projeção
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-500/10 !border-0 p-3"><p className="text-sm opacity-80">Dinheiro inicial disponível</p><p className="text-xl font-bold break-words text-inherit">{formatCurrency(saldoInicialTransicao)}</p></div>
            <div className="rounded-xl bg-slate-500/10 !border-0 p-3"><p className="text-sm opacity-80">Despesas por mês</p><p className="text-xl font-bold break-words text-inherit">{formatCurrency(gastoMensalTransicao)}</p></div>
            <div className="rounded-xl bg-slate-500/10 !border-0 p-3"><p className="text-sm opacity-80">Renda temporária por mês</p><p className="text-xl font-bold break-words text-inherit">{formatCurrency(rendaMensalTransicao)}</p><p className="text-sm opacity-80">Por {mesesRendaTransicao} meses</p></div>
            <div className="rounded-xl bg-marca-100 !border-0 p-3"><p className="text-xs text-marca">Tempo de cobertura</p><p className="text-xl font-bold break-words text-inherit">{mesesCoberturaTransicao === null ? 'Não esgota em 50 anos*' : `${mesesCoberturaTransicao} meses completos`}</p></div>
          </div>
          <p className="text-sm opacity-80">Saldo estimado após cada período, já descontando as despesas mensais:</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[3,6,12].map(mes => {
              const saldo = projetarSaldoTransicao(mes)
              return <div key={mes} className="rounded-xl !border-0 bg-slate-500/10 p-2.5 min-w-0 text-center"><p className="text-sm opacity-80">{mes} meses</p><p className={`text-base font-bold break-words ${saldo < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(saldo)}</p></div>
            })}
          </div>
          <p className="text-xs text-amber-400">Atenção: o dinheiro pode ser liberado em datas diferentes. A projeção começa após a disponibilidade dos valores marcados e presume despesas constantes, sem juros, inflação, tributos adicionais ou novo emprego. Seguro-desemprego e outras rendas temporárias param após os meses informados. *Limite da projeção: 600 meses.</p>
        </div>
      )}

      {/* ── Comparativo atual × simulado ── */}

      {!ehDesligamento && <><div className="card !border-0">

        <p className="text-xs text-inherit font-medium uppercase tracking-wide mb-2 flex items-center gap-1.5">

          <Wallet size={14} className="text-emerald-600" /> Atual × simulado

        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <div className="rounded-xl bg-slate-500/10 !border-0 p-3">

            <p className="text-sm opacity-80 mb-1">Hoje</p>

            <p className="text-sm opacity-80">Sobra mensal estimada</p>

            <p className={`text-lg font-bold ${atual.saldoMensal >= 0 ? 'text-inherit' : 'text-red-600'}`}>{formatCurrency(atual.saldoMensal)}</p>

            <p className="text-sm opacity-80 mt-1">Gasto diário ~ {formatCurrency(atual.gastoDiario)}</p>

          </div>

          <div className="rounded-xl bg-marca-100 !border-0 p-3">

            <p className="text-xs text-marca mb-1">No cenário</p>

            <p className="text-sm opacity-80">Sobra mensal estimada</p>

            <p className={`text-lg font-bold ${sim.saldoMensal >= 0 ? 'text-inherit' : 'text-red-600'}`}>{formatCurrency(sim.saldoMensal)}</p>

            <p className="text-sm opacity-80 mt-1">Gasto diário ~ {formatCurrency(sim.gastoDiario)}</p>

          </div>

        </div>

        {/* Reserva: por quantos meses sustenta o déficit */}

        {sim.deficitMensal > 0 && (

          <div className="mt-3 flex items-start gap-2 bg-transparent !border-0 rounded-xl px-3 py-2">

            <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />

            <p className="text-xs text-amber-400">

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

                <p className="text-sm font-medium uppercase tracking-wide text-white/85">Diferença mensal estimada</p>

                <p className="text-3xl sm:text-4xl font-extrabold mt-1 break-words">

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

                <p className="text-sm opacity-80 mb-1.5">Impacto adicional acumulado (só o ganho ou perda extra do cenário)</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  {impacto.map(h => (

                    <div key={h.meses} className="rounded-xl bg-slate-500/10 !border-0 p-2.5 text-center">

                      <p className="text-sm opacity-80">{h.meses} meses</p>

                      <p className={`text-base font-bold break-words ${h.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>

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

      <div className="card !border-0 space-y-3" aria-live="polite">

        <div className="flex items-center gap-2">

          <Info size={16} className="text-marca" />

          <strong className="text-sm text-inherit">Análise do seu cenário</strong>

        </div>

        <p className="text-sm text-inherit">

          {diferencaMensal > 0

            ? `Sua sobra mensal estimada cresce ${formatCurrency(diferencaMensal)} em relação à situação atual.`

            : diferencaMensal < 0

              ? `Sua sobra mensal estimada diminui ${formatCurrency(Math.abs(diferencaMensal))} em relação à situação atual.`

              : 'A sobra mensal permanece igual à situação atual com os valores informados.'}

        </p>

        {semRenda && (

          <p className="text-xs text-inherit">

            {sim.deficitMensal > 0

              ? `Sem a renda principal, o déficit estimado é de ${formatCurrency(sim.deficitMensal)} por mês. A reserva inicial considerada é de ${formatCurrency(reservaAtual)}.`

              : 'Com as entradas informadas, não há déficit mensal estimado neste cenário.'}

          </p>

        )}

        <p className="text-sm text-inherit"><strong>Recomendação:</strong> {recomendacao}</p>

        <p className="text-sm opacity-80">

          Projeções usam valores mensais constantes e reserva informada. Não incluem rendimentos, inflação nem verbas rescisórias, salvo se explicitamente incorporadas nos cálculos.

        </p>

      </div>

      </>}

      <div className="flex items-start gap-2.5 bg-transparent !border-0 rounded-xl p-3">

        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />

        <p className="text-xs text-sky-400">

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

        <div className="space-y-6">

          {/* Cenários genéricos (apenas seleção; mesmo cálculo p/ todos) */}

          <div>

            <label className="label">Escolha o cenário</label>

            <div className="grid grid-cols-2 gap-2">

              {CENARIOS_PRO.map(c => (

                <button

                  key={c}

                  type="button"

                  onClick={() => setCenarioPro(c)}

                  className={`flex items-center gap-2 p-3.5 rounded-xl !border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca text-sm sm:text-base font-medium text-left transition-all ${

                    cenarioPro === c ? 'bg-marca-100 text-marca shadow-sm' : 'bg-slate-500/10 text-inherit hover:bg-slate-500/20'

                  }`}

                >

                  <Briefcase size={16} className="flex-shrink-0" />

                  <span className="min-w-0">{c}</span>

                </button>

              ))}

            </div>

          </div>

          {/* Campos locais */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

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

            const corDif = sinal === 'pos' ? 'text-emerald-600' : sinal === 'neg' ? 'text-red-600' : 'text-inherit'

            // Explicação automática simples e correta.

            const explica = sinal === 'pos'

              ? `Neste cenário você ganha cerca de ${formatCurrency(diferenca)} a mais por mês. Esse é o ganho adicional (não o seu saldo total).${investimento > 0 ? (recupera ? ` O investimento de ${formatCurrency(investimento)} se recupera em ~${recupera} ${recupera === 1 ? 'mês' : 'meses'}.` : '') : ''}`

              : sinal === 'neg'

                ? `Neste cenário seu resultado mensal cai cerca de ${formatCurrency(Math.abs(diferenca))}. Avalie se o retorno compensa os custos adicionais.`

                : 'Com os valores informados, o resultado mensal não muda em relação à situação atual.'

            return (

              <div className="space-y-3">

                <p className="text-xs text-inherit font-medium uppercase tracking-wide flex items-center gap-1.5">

                  <Wallet size={14} className="text-emerald-600" /> Resultado da sua simulação

                </p>

                {/* Dois cards: resultado atual × simulado por mês */}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  <div className="rounded-xl bg-slate-500/10 !border-0 p-3">

                    <p className="text-sm opacity-80">Resultado atual / mês</p>

                    <p className={`text-lg font-bold break-words ${resultadoAtual >= 0 ? 'text-inherit' : 'text-red-600'}`}>{formatCurrency(resultadoAtual)}</p>

                  </div>

                  <div className="rounded-xl bg-marca-100 !border-0 p-3">

                    <p className="text-xs text-marca">Resultado simulado / mês</p>

                    <p className={`text-lg font-bold break-words ${resultadoSimulado >= 0 ? 'text-inherit' : 'text-red-600'}`}>{formatCurrency(resultadoSimulado)}</p>

                  </div>

                </div>

                {/* Card principal destacado: diferença mensal + variação % */}

                <div className="rounded-2xl bg-marca-grad text-white p-4">

                  <div className="flex items-center gap-2">

                    <Icone size={18} className="flex-shrink-0" />

                    <p className="text-sm font-medium uppercase tracking-wide text-white/85">Diferença mensal estimada</p>

                  </div>

                  <p className="text-3xl sm:text-4xl font-extrabold mt-1 break-words">

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

                  <p className="text-sm opacity-80 mb-1.5">Impacto adicional acumulado (ganho/perda extra, já descontando o investimento uma vez)</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                    {impacto.map(h => (

                      <div key={h.meses} className="rounded-xl bg-slate-500/10 !border-0 p-2.5 text-center">

                        <p className="text-sm opacity-80">{h.meses} meses</p>

                        <p className={`text-base font-bold break-words ${h.valor >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>

                          {h.valor >= 0 ? '+' : '−'}{formatCurrency(Math.abs(h.valor))}

                        </p>

                      </div>

                    ))}

                  </div>

                </div>

                {/* Investimento inicial + recuperação */}

                {investimento > 0 && (

                  <div className="flex items-start gap-2 bg-transparent !border-0 rounded-xl px-3 py-2.5">

                    <Info size={15} className="text-marca flex-shrink-0 mt-0.5" />

                    <p className="text-xs text-inherit">

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

                <div className="card !border-0 space-y-2" aria-live="polite">

                  <div className="flex items-center gap-2">

                    <Info size={16} className="text-marca" />

                    <strong className="text-sm text-inherit">O que isso significa?</strong>

                  </div>

                  <p className={`text-sm ${corDif}`}>{explica}</p>

                  <p className="text-sm opacity-80">

                    Estimativas com valores mensais constantes. "Diferença" e "impacto acumulado" são o ganho ADICIONAL do cenário — não o seu saldo total nem faturamento.

                  </p>

                </div>

                <div className="flex items-start gap-2.5 bg-transparent !border-0 rounded-xl p-3">

                  <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />

                  <p className="text-xs text-sky-400">

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