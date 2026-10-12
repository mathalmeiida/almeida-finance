import React, { useState } from 'react'
import { Users, Home, Car, Info, AlertTriangle, Wallet } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../lib/utils'
import InputMoeda from '../components/InputMoeda'
import DestaqueValor from '../components/DestaqueValor'
import { calcularConsorcio, comprometimentoRenda } from '../lib/financiamento'

const fmtPct = (v, casas = 0) => `${(Number(v) || 0).toFixed(casas).replace('.', ',')}%`

export default function SimuladorConsorcio() {
  const { resumoMes } = useProjecao()
  const { perfil } = useAuth()

  const reservaDisponivel = Number(perfil?.reserva_atual) || 0
  const rendaMensal = Number(resumoMes?.receitaTotal) || 0

  // ── Formulário ──
  const [tipo, setTipo] = useState('imovel')      // 'imovel' | 'automovel'
  const [modo, setModo] = useState('rapida')      // 'rapida' | 'completa'
  const [carta, setCarta] = useState('')
  const [prazo, setPrazo] = useState('')
  const [taxaAdm, setTaxaAdm] = useState('18')    // % total (referência comum)
  const [fundoReserva, setFundoReserva] = useState('')
  const [seguroMensal, setSeguroMensal] = useState('')
  const [lance, setLance] = useState('')

  const [resultado, setResultado] = useState(null)
  const [erro, setErro] = useState('')

  const ehCompleta = modo === 'completa'

  function limpar() { setResultado(null); setErro('') }

  function handleSimular(e) {
    e.preventDefault()
    setErro('')
    const valorCarta = Number(carta) || 0
    const n = Math.max(0, Math.floor(Number(prazo) || 0))
    const taxaNum = parseFloat(String(taxaAdm).replace(',', '.')) || 0
    if (valorCarta <= 0) { setErro('Informe o valor da carta de crédito.'); return }
    if (n <= 0) { setErro('Informe o prazo em meses.'); return }
    if (taxaNum <= 0) { setErro('Informe a taxa de administração total.'); return }

    const sim = calcularConsorcio({
      carta: valorCarta,
      prazoMeses: n,
      taxaAdmPercent: taxaNum,
      // Campos só da simulação completa; na rápida entram como 0.
      fundoReservaPercent: ehCompleta ? (parseFloat(String(fundoReserva).replace(',', '.')) || 0) : 0,
      seguroMensal: ehCompleta ? (Number(seguroMensal) || 0) : 0,
      lance: ehCompleta ? (Number(lance) || 0) : 0,
    })
    const pctRenda = comprometimentoRenda(sim.parcela, rendaMensal)
    setResultado({ ...sim, tipo, pctRenda })
  }

  const corPct = resultado?.pctRenda == null ? 'text-gray-900'
    : resultado.pctRenda >= 40 ? 'text-red-600'
    : resultado.pctRenda >= 30 ? 'text-amber-600'
    : 'text-green-600'

  // "Cabe no meu orçamento?" — compara a parcela com a sobra mensal já
  // calculada (receitas − despesas − parcelas − faturas), sem duplicar dados.
  const orcamentoDisponivel = Number(resumoMes?.sobraPrevista) || 0
  const sobraAposParcela = resultado ? orcamentoDisponivel - resultado.parcela : null

  return (
    <div className="space-y-6">
      {/* Resumo: reserva + renda (apenas leitura) */}
      <div className="card bg-gray-50 border-gray-100">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-400">Reserva disponível</p>
            <p className="text-sm font-bold text-emerald-600 break-words">{formatCurrency(reservaDisponivel)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Sua renda mensal</p>
            <p className="text-sm font-bold text-green-600 break-words">{formatCurrency(rendaMensal)}</p>
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <form onSubmit={handleSimular} className="card space-y-4">
        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <Users size={18} className="text-marca" /> Dados do consórcio
        </h2>

        {/* Tipo: imóvel ou automóvel */}
        <div>
          <label className="label">Tipo de consórcio</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ id: 'imovel', nome: 'Imóvel', icone: Home }, { id: 'automovel', nome: 'Automóvel', icone: Car }].map(op => (
              <button key={op.id} type="button" onClick={() => { setTipo(op.id); limpar() }}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  tipo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <op.icone size={16} /> {op.nome}
              </button>
            ))}
          </div>
        </div>

        {/* Modo: rápida ou completa */}
        <div>
          <label className="label">Simulação</label>
          <div className="grid grid-cols-2 gap-3">
            {[{ id: 'rapida', nome: 'Rápida', desc: 'carta, prazo e taxa' }, { id: 'completa', nome: 'Completa', desc: 'todos os campos' }].map(op => (
              <button key={op.id} type="button" onClick={() => { setModo(op.id); limpar() }}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 text-center transition-all ${
                  modo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <span className="text-sm font-semibold">{op.nome}</span>
                <span className="text-xs text-gray-400">{op.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Valor da carta de crédito (R$)</label>
          <InputMoeda valor={carta} onChangeValor={(n) => { setCarta(n); limpar() }}
            className="input" prefixo={null} />
        </div>

        <div>
          <label className="label">Prazo (meses)</label>
          <input type="number" min="1" inputMode="numeric" value={prazo}
            onChange={(e) => { setPrazo(e.target.value); limpar() }}
            className="input" placeholder={tipo === 'imovel' ? 'Ex: 180' : 'Ex: 60'} />
        </div>

        <div>
          <label className="label">Taxa de administração total (%)</label>
          <input type="text" inputMode="decimal" value={taxaAdm}
            onChange={(e) => { setTaxaAdm(e.target.value); limpar() }}
            className="input" placeholder="Ex: 18" />
          <p className="text-xs text-gray-400 mt-1">
            Percentual total cobrado pela administradora sobre a carta, diluído nas parcelas.
          </p>
        </div>

        {/* Campos extras só na simulação completa */}
        {ehCompleta && (
          <>
            <div>
              <label className="label">Fundo de reserva (%)</label>
              <input type="text" inputMode="decimal" value={fundoReserva}
                onChange={(e) => { setFundoReserva(e.target.value); limpar() }}
                className="input" placeholder="Ex: 2 (opcional)" />
              <p className="text-xs text-gray-400 mt-1">Opcional. Percentual sobre a carta, diluído nas parcelas.</p>
            </div>
            <div>
              <label className="label">Seguro mensal (R$)</label>
              <InputMoeda valor={seguroMensal} onChangeValor={(n) => { setSeguroMensal(n); limpar() }}
                className="input" prefixo={null} />
              <p className="text-xs text-gray-400 mt-1">Opcional. Somado a cada parcela.</p>
            </div>
            <div>
              <label className="label">Lance planejado (R$)</label>
              <InputMoeda valor={lance} onChangeValor={(n) => { setLance(n); limpar() }}
                className="input" prefixo={null} />
              <p className="text-xs text-gray-400 mt-1">
                Opcional e apenas informativo. Não abate carta, parcela ou saldo nesta simulação.
              </p>
            </div>
          </>
        )}

        {erro && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

        <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base">
          <Users size={18} /> Simular consórcio
        </button>
      </form>

      {/* ── Resultado ── */}
      {resultado && (
        <>
          <div className="card border-2 border-marca">
            <p className="text-xs text-gray-600 font-medium uppercase tracking-wide mb-3">Resultado da simulação</p>

            <div className="grid grid-cols-2 gap-3">
              <DestaqueValor rotulo="Carta de crédito" valor={formatCurrency(resultado.carta)} />
              <DestaqueValor rotulo="Parcela mensal" valor={`${resultado.prazoMeses}x de ${formatCurrency(resultado.parcela)}`} cor="text-marca" />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <DestaqueValor rotulo="Total taxa de administração" valor={formatCurrency(resultado.totalTaxaAdm)} cor="text-red-500" />
              <DestaqueValor rotulo="Total fundo de reserva" valor={formatCurrency(resultado.totalFundoReserva)} cor="text-red-500" />
            </div>

            <div className="mt-3">
              <DestaqueValor rotulo="Custo total estimado" valor={formatCurrency(resultado.custoTotal)} cor="text-marca"
                sub="parcelas somadas no prazo" />
            </div>

            <div className="mt-3">
              <DestaqueValor
                rotulo="Comprometimento da renda"
                valor={resultado.pctRenda == null ? '—' : fmtPct(resultado.pctRenda, 0)}
                cor={corPct}
                sub="pela parcela mensal"
              />
            </div>

            {resultado.lance > 0 && (
              <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <Info size={15} className="text-marca flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600">
                  Lance planejado informado: <strong>{formatCurrency(resultado.lance)}</strong>. Apenas informativo — não abate carta, parcela ou saldo nesta simulação.
                </p>
              </div>
            )}

            {resultado.pctRenda != null && resultado.pctRenda >= 30 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  A parcela compromete uma parte elevada da sua renda ({fmtPct(resultado.pctRenda, 0)}). Avalie com calma antes de decidir.
                </p>
              </div>
            )}
          </div>

          {/* ── Cabe no meu orçamento? ── */}
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" /> Cabe no meu orçamento?
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Sobra mensal atual</span>
                <strong className="text-gray-900">{formatCurrency(orcamentoDisponivel)}</strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Parcela do consórcio</span>
                <strong className="text-gray-900">{formatCurrency(resultado.parcela)}</strong>
              </div>
              <div className="flex justify-between gap-2 pt-2 border-t border-gray-100">
                <span className="text-gray-600 font-medium">Saldo mensal estimado</span>
                <strong className={sobraAposParcela >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  {formatCurrency(sobraAposParcela)}
                </strong>
              </div>
            </div>
            {sobraAposParcela < 0 && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                <AlertTriangle size={15} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  A parcela ultrapassa a sua sobra mensal atual. Reveja o orçamento antes de aderir ao consórcio.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              Estimativa com base na sua sobra mensal (receitas − despesas − parcelas − faturas), sem duplicar despesas já cadastradas.
            </p>
          </div>
        </>
      )}

      {/* Aviso legal específico de consórcio */}
      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3">
        <Info size={16} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          Consórcio não possui juros de financiamento, mas tem taxas e possíveis reajustes. A contemplação depende de sorteio ou lance e não é garantida.
        </p>
      </div>
    </div>
  )
}
