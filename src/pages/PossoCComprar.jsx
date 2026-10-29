import React, { useState, useMemo } from 'react'

import { useNavigate } from 'react-router-dom'

import {

  ShoppingCart, AlertTriangle, CheckCircle2, XCircle, Calculator, Info,

  Loader2, RotateCcw, Home, Car, Users, Wallet, CreditCard,

  UtensilsCrossed, ShoppingBag, ArrowRight, Pencil, CalendarDays

} from 'lucide-react'

import { useProjecao } from '../hooks/useProjecao'

import { useBeneficios } from '../hooks/useBeneficios'

import { useAuth } from '../contexts/AuthContext'

import { useOcultarValores } from '../contexts/OcultarValoresContext'

import { formatCurrency, exibirMoeda } from '../lib/utils'

import InputMoeda from '../components/InputMoeda'

import SimuladorFinanciamento from './SimuladorFinanciamento'

import SimuladorAutomovel from './SimuladorAutomovel'

import SimuladorConsorcio from './SimuladorConsorcio'
import CalendarioCenario from '../components/CalendarioCenario'



const FONTES = [

  { id: 'saldo', label: 'Saldo bancário', Icon: Wallet },

  { id: 'cartao', label: 'Cartão de crédito', Icon: CreditCard },

  { id: 'VR', label: 'VR', Icon: UtensilsCrossed },

  { id: 'VA', label: 'VA', Icon: ShoppingBag },

]

const CORES = {

  verde: { titulo: 'Cabe no orçamento simulado', Icon: CheckCircle2, fundo: 'bg-green-50 border-green-200', texto: 'text-green-700' },

  amarelo: { titulo: 'Exige atenção ao orçamento', Icon: AlertTriangle, fundo: 'bg-amber-50 border-amber-200', texto: 'text-amber-700' },

  vermelho: { titulo: 'Pode comprometer o orçamento', Icon: XCircle, fundo: 'bg-red-50 border-red-200', texto: 'text-red-700' },

}



function classificar(antes, depois) {

  if (antes <= 0 || depois < 0) return 'vermelho'

  const pct = (depois / antes) * 100

  return pct >= 50 ? 'verde' : pct >= 20 ? 'amarelo' : 'vermelho'

}



function diasRestantesNoMes(ref = new Date()) {

  return new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate() - ref.getDate() + 1

}



function Indicador({ titulo, valor, cor }) {

  return (

    <div className="min-w-0 rounded-xl bg-gray-50 border border-gray-100 px-2 py-3 text-center">

      <p className="text-[11px] sm:text-xs text-gray-500">{titulo}</p>

      <p className={`text-xs sm:text-base font-bold break-words mt-1 ${cor}`}>{formatCurrency(valor)}</p>

    </div>

  )

}




// Calendário EXCLUSIVAMENTE estimativo. Os dados mensais não possuem dias de
// recebimento/vencimento, por isso não mostramos estes valores como saldo real.
// À vista: aplica a compra no dia da simulação (somente saldo bancário).
// Parcelado: assume a primeira parcela neste mês e uma em cada mês seguinte,
// distribuindo o resultado orçamentário mensal uniformemente pelos dias.
function criarCalendarioEstimadoCompra({ resultado, projecao, saldoInicial, dataBase = new Date() }) {
  if (!resultado || !Array.isArray(projecao) || !projecao.length) return null
  if (resultado.fonte === 'VR' || resultado.fonte === 'VA') return null

  const anoBase = dataBase.getFullYear()
  const mesBase = dataBase.getMonth()
  const diaBase = dataBase.getDate()
  const serieAtual = []
  const serieSimulada = []
  let acumuladoAtual = saldoInicial
  let acumuladoSimulado = saldoInicial

  const iso = (ano, mes, dia) => `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  for (let m = 0; m < 12; m++) {
    const ano = anoBase + Math.floor((mesBase + m) / 12)
    const mes = (mesBase + m) % 12
    const dias = new Date(ano, mes + 1, 0).getDate()
    // O saldo atual informado já é a posição de hoje: não soma de novo o mês atual.
    const fluxoMes = m === 0 ? 0 : Number(projecao[m]?.disponivel)
    // Para meses sem projeção disponível, deixa as células sem valores.
    if (m > 0 && !Number.isFinite(fluxoMes)) break
    const parcelaAtiva = resultado.tipo === 'parcelado' && m < resultado.parcelas
    const impactoMes = parcelaAtiva ? Number(resultado.valorParcela) || 0 : 0
    const impactoVista = resultado.tipo === 'avista' && m === 0 ? Number(resultado.valor) || 0 : 0
    // A simulação de cartão usa o orçamento projetado, não o saldo bancário.
    // Sem fechamento/vencimento não é possível posicionar uma fatura real.
    for (let d = 1; d <= dias; d++) {
      if (m === 0 && d < diaBase) continue
      const data = iso(ano, mes, d)
      if (m === 0 && d === diaBase) {
        acumuladoSimulado -= impactoVista + impactoMes
      } else if (m > 0) {
        acumuladoAtual += fluxoMes / dias
        acumuladoSimulado += (fluxoMes - impactoMes) / dias
      }
      serieAtual.push({data, saldo: Math.round(acumuladoAtual * 100) / 100})
      serieSimulada.push({data, saldo: Math.round(acumuladoSimulado * 100) / 100})
    }
  }
  return { diasAtual: serieAtual, diasSimulado: serieSimulada, dataInicial: iso(anoBase, mesBase, diaBase) }
}

function SimuladorCompra() {

  const navigate = useNavigate()

  const { ocultar } = useOcultarValores()

  const { perfil } = useAuth()

  const { projecao, carregando, resumoMes } = useProjecao()

  const { beneficios, saldoDoBeneficio } = useBeneficios()

  const [form, setForm] = useState({ nome: '', valor: '', tipo: 'avista', parcelas: '12', fonte: 'saldo', beneficio_id: '' })

  const [resultado, setResultado] = useState(null)

  const [erro, setErro] = useState('')

  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)



  const beneficiosFiltrados = (beneficios || []).filter(b => b.tipo === form.fonte)

  const beneficioAtual = beneficiosFiltrados.find(b => String(b.id) === String(form.beneficio_id)) || beneficiosFiltrados[0]

  const fonteAtual = FONTES.find(f => f.id === form.fonte)

  const valor = Number(form.valor) || 0

  const parcelas = Math.max(1, Number(form.parcelas) || 1)

  const previstoPorParcela = parcelas ? valor / parcelas : 0

  const semDados = !carregando && !Number(resumoMes?.receitaTotal) && !Number(resumoMes?.despesaTotal)



  function alterar(campo, valorNovo) {

    setForm(anterior => ({ ...anterior, [campo]: valorNovo, ...(campo === 'fonte' ? { beneficio_id: '', tipo: valorNovo === 'VR' || valorNovo === 'VA' ? 'avista' : anterior.tipo } : {}) }))

    setResultado(null)

    setErro('')

  }



  function simular(e) {

    e.preventDefault()

    setErro('')

    if (!Number.isFinite(valor) || valor <= 0) return setErro('Informe um valor de compra válido.')

    if (!projecao?.length) return setErro('A projeção financeira ainda não está disponível.')



    const ehBeneficio = form.fonte === 'VR' || form.fonte === 'VA'

    if (ehBeneficio && !beneficioAtual) return setErro(`Cadastre um ${form.fonte} na aba Benefícios antes de simular.`)

    if (ehBeneficio && form.tipo === 'parcelado') return setErro('Simule pagamentos com VR/VA somente à vista.')



    const ehParcelado = form.tipo === 'parcelado'

    const dias = diasRestantesNoMes()

    const temSaldoInformado = Boolean(resumoMes?.saldoConfigurado)

    const saldoConta = Number(resumoMes?.saldoDisponivelAgora) || 0

    const saldoBeneficio = ehBeneficio ? Number(saldoDoBeneficio(beneficioAtual.id)) || 0 : null

    const usaSaldo = form.fonte === 'saldo'

    const disponivelProjetado = Number(projecao[0]?.disponivel) || 0

    const antes = ehBeneficio ? saldoBeneficio : usaSaldo && temSaldoInformado ? saldoConta : disponivelProjetado

    const reservaAtual = Number(perfil?.reserva_atual) || 0



    if (!ehParcelado) {

      const depois = antes - valor

      setResultado({

        tipo: 'avista', nome: form.nome.trim(), fonte: form.fonte, fonteLabel: fonteAtual?.label,

        antes, depois, valor, classificacao: classificar(antes, depois),

        dias, limiteAntes: antes > 0 ? antes / dias : 0, limiteDepois: depois > 0 ? depois / dias : 0,

        falta: Math.max(0, -depois), reservaAtual, beneficio: beneficioAtual?.nome || '',

        nota: form.fonte === 'cartao'

          ? 'Simulação sobre o orçamento projetado; não consulta limite disponível nem data de fechamento do cartão. O saldo bancário imediato não foi reduzido.'

          : ehBeneficio

            ? 'Este cálculo considera somente o saldo do benefício selecionado, sem alterar o saldo bancário.'

            : 'O saldo informado é usado como referência. A compra não foi registrada.'

      })

      return

    }



    const limite = Math.min(parcelas, projecao.length)

    const meses = Array.from({ length: limite }, (_, i) => {

      const disponivelAntes = Number(projecao[i]?.disponivel) || 0

      const disponivelDepois = disponivelAntes - previstoPorParcela

      return {

        mes: projecao[i]?.mes || `Mês ${i + 1}`,

        antes: disponivelAntes, depois: disponivelDepois,

        classificacao: classificar(disponivelAntes, disponivelDepois)

      }

    })

    const ordem = { verde: 0, amarelo: 1, vermelho: 2 }

    const geral = meses.reduce((pior, mes) => ordem[mes.classificacao] > ordem[pior] ? mes.classificacao : pior, 'verde')

    setResultado({

      tipo: 'parcelado', nome: form.nome.trim(), fonte: form.fonte, fonteLabel: fonteAtual?.label,

      valor, parcelas, valorParcela: previstoPorParcela, meses,

      classificacao: geral,

      nota: `Projeção simplificada: parcelas a partir deste mês, sem juros. Foram analisados ${limite} de ${parcelas} meses; não verifica fechamento da fatura ou limite do cartão.`

    })

  }



  function registrar() {

    // Mantém o fluxo de cadastro existente. Não grava a simulação nem promete pré-preenchimento.

    navigate(resultado?.tipo === 'parcelado' ? '/despesas?novo=parcelado' : '/despesas?novo=1')

  }



  const cfg = resultado ? CORES[resultado.classificacao] : null

  const descontoAtual = Number(resumoMes?.despesaTotal || 0) + Number(resumoMes?.parcelasTotal || 0)

  const calendarioCompra = useMemo(() => {
    const saldoBase = resultado?.fonte === 'saldo'
      ? Number(resultado?.antes) || 0
      : Number(projecao?.[0]?.disponivel) || 0
    return criarCalendarioEstimadoCompra({ resultado, projecao, saldoInicial: saldoBase })
  }, [resultado, projecao])




  return (

    <div className="space-y-4 sm:space-y-5">

      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 border border-blue-100 px-3 py-3">

        <Info size={17} className="shrink-0 text-blue-600 mt-0.5" />

        <p className="text-xs text-blue-800">Simulação baseada nos dados financeiros cadastrados. Não realiza pagamentos nem substitui aconselhamento financeiro profissional.</p>

      </div>



      {semDados && (

        <p className="p-3 text-sm rounded-xl bg-amber-50 text-amber-800 border border-amber-200">Cadastre suas receitas e despesas para obter uma simulação mais útil.</p>

      )}



      {!carregando && (

        <section className="card !p-4 sm:!p-5">

          <h2 className="text-sm font-semibold text-gray-900 mb-3">Seu orçamento atual</h2>

          <div className="grid grid-cols-3 gap-2">

            <Indicador titulo="Receitas" valor={Number(resumoMes?.receitaTotal) || 0} cor="text-green-600" />

            <Indicador titulo="Despesas" valor={descontoAtual} cor="text-red-600" />

            <Indicador titulo="Sobra prevista" valor={Number(resumoMes?.sobraPrevista) || 0} cor="text-blue-600" />

          </div>

        </section>

      )}



      <section className="card !p-4 sm:!p-5">

        <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mb-4">

          <Calculator size={18} className="text-marca" /> Dados da compra

        </h2>

        {carregando ? (

          <div className="py-8 flex items-center justify-center gap-2 text-gray-500 text-sm"><Loader2 size={19} className="animate-spin" /> Carregando...</div>

        ) : (

          <form onSubmit={simular} className="space-y-4">

            <div>

              <label className="label">Nome da compra <span className="text-gray-400">(opcional)</span></label>

              <input className="input" value={form.nome} onChange={e => alterar('nome', e.target.value)} placeholder="Ex.: Notebook, geladeira, viagem..." />

            </div>

            <div>

              <label className="label">Valor total (R$)</label>

              <InputMoeda className="input" valor={form.valor} onChangeValor={v => alterar('valor', v)} />

            </div>

            <div>

              <p className="label">De onde sairia o pagamento?</p>

              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">

                {FONTES.map(op => (

                  <button type="button" key={op.id} onClick={() => alterar('fonte', op.id)}

                    className={`flex flex-col min-w-0 items-center justify-center gap-1 rounded-xl p-2 min-h-[75px] border text-[10px] sm:text-xs transition-colors ${form.fonte === op.id ? 'bg-marca-100 border-marca text-marca font-semibold' : 'border-gray-200 text-gray-600 bg-gray-50 hover:border-gray-300'}`}>

                    <op.Icon size={19} /><span className="text-center leading-tight">{op.label}</span>

                  </button>

                ))}

              </div>

            </div>

            {(form.fonte === 'VR' || form.fonte === 'VA') && (

              <div>

                <label className="label">Qual benefício?</label>

                <select className="input" value={beneficioAtual?.id || ''} onChange={e => alterar('beneficio_id', e.target.value)}>

                  {beneficiosFiltrados.length === 0 && <option value="">Nenhum {form.fonte} cadastrado</option>}

                  {beneficiosFiltrados.map(b => <option key={b.id} value={b.id}>{b.nome}</option>)}

                </select>

              </div>

            )}

            <div>

              <p className="label">Como deseja pagar?</p>

              <div className="grid grid-cols-2 gap-2">

                {[['avista', 'À vista'], ['parcelado', 'Parcelado']].map(([id, titulo]) => (

                  <button key={id} type="button" disabled={(form.fonte === 'VR' || form.fonte === 'VA') && id === 'parcelado'}

                    onClick={() => alterar('tipo', id)} className={`rounded-xl py-3 text-sm font-semibold border transition-colors ${form.tipo === id ? 'bg-marca-100 text-marca border-marca' : 'bg-gray-50 text-gray-600 border-gray-200'} disabled:opacity-40`}>{titulo}</button>

                ))}

              </div>

            </div>

            {form.tipo === 'parcelado' && (

              <div>

                <label className="label">Número de parcelas</label>

                <select className="input" value={form.parcelas} onChange={e => alterar('parcelas', e.target.value)}>

                  {[2,3,4,5,6,7,8,9,10,11,12,18,24,36].map(n => <option key={n} value={n}>{n}x</option>)}

                </select>

                {valor > 0 && <p className="text-xs text-gray-500 mt-1">Estimativa sem juros: {parcelas}x de {formatCurrency(previstoPorParcela)}</p>}

              </div>

            )}

            {erro && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{erro}</p>}

            <button type="submit" className="btn-primary w-full py-3 flex items-center justify-center gap-2"><ShoppingCart size={17} /> Simular agora</button>

          </form>

        )}

      </section>



      {resultado && cfg && (

        <section className="card !p-4 sm:!p-5 space-y-4" aria-live="polite">

          <div className={`rounded-xl border p-3.5 flex gap-2.5 ${cfg.fundo}`}>

            <cfg.Icon className={`shrink-0 mt-0.5 ${cfg.texto}`} size={21} />

            <div><h2 className={`font-semibold ${cfg.texto}`}>{cfg.titulo}</h2><p className="text-xs text-gray-700 mt-1">Resultado estimado: confira os valores antes de decidir.</p></div>

          </div>



          <div>

            <div className="flex items-center justify-between gap-2 mb-2">

              <h3 className="font-semibold text-gray-900">Resumo da compra</h3>

              <button type="button" onClick={() => { setResultado(null); setErro('') }} className="text-xs text-marca font-semibold flex items-center gap-1"><Pencil size={13} /> Editar</button>

            </div>

            <div className="rounded-xl border border-gray-100 px-3">

              {[

                ['Compra', resultado.nome || 'Não informada'],

                ['Valor total', formatCurrency(resultado.valor)],

                ['Pagamento', resultado.fonteLabel],

                ['Modalidade', resultado.tipo === 'avista' ? 'À vista' : `${resultado.parcelas}x de ${formatCurrency(resultado.valorParcela)}`]

              ].map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 py-2.5 text-sm border-b border-gray-100 last:border-0"><span className="text-gray-500">{k}</span><strong className="text-gray-900 text-right break-words">{v}</strong></div>)}

            </div>

          </div>



          {resultado.tipo === 'avista' ? (

            <div>

              <h3 className="font-semibold text-gray-900 mb-2">Impacto no valor disponível</h3>

              <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 space-y-2 py-3 text-sm">

                <div className="flex justify-between gap-2"><span className="text-gray-600">Antes</span><strong>{exibirMoeda(resultado.antes, ocultar)}</strong></div>

                <div className="flex justify-between gap-2"><span className="text-gray-600">Compra</span><strong className="text-red-600">− {exibirMoeda(resultado.valor, ocultar)}</strong></div>

                <div className="border-t border-gray-200 pt-2 flex justify-between gap-2"><span className="font-semibold">Depois</span><strong className={resultado.depois < 0 ? 'text-red-600' : 'text-marca'}>{exibirMoeda(resultado.depois, ocultar)}</strong></div>

              </div>

              {resultado.falta > 0 && <p className="mt-2 rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs">Faltariam {exibirMoeda(resultado.falta, ocultar)} para cobrir a compra com a referência escolhida.</p>}

              <p className="text-xs text-gray-500 mt-2">Estimativa de valor por dia: {exibirMoeda(resultado.limiteAntes, ocultar)} antes e {exibirMoeda(resultado.limiteDepois, ocultar)} depois, considerando os dias restantes do mês.</p>

              {resultado.fonte === 'saldo' && resultado.falta > 0 && resultado.reservaAtual > 0 && <p className="mt-1 text-xs text-amber-700">Uma compra acima do saldo informado pode comprometer a reserva de emergência.</p>}

            </div>

          ) : (

            <div className="space-y-2">

              <h3 className="font-semibold text-gray-900">Impacto nas parcelas</h3>

              <p className="text-sm text-gray-600">{resultado.parcelas} parcelas estimadas de <strong>{formatCurrency(resultado.valorParcela)}</strong>.</p>

              {(mostrarDetalhes ? resultado.meses : resultado.meses.slice(0, 3)).map((m, i) => (

                <div key={i} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2 flex items-center justify-between gap-2 text-sm">

                  <span className="text-gray-600 capitalize">{m.mes}</span>

                  <strong className={m.depois < 0 ? 'text-red-600' : 'text-marca'}>{exibirMoeda(m.depois, ocultar)} disponíveis</strong>

                </div>

              ))}

              {resultado.meses.length > 3 && <button type="button" onClick={() => setMostrarDetalhes(v => !v)} className="text-xs font-semibold text-marca">{mostrarDetalhes ? 'Mostrar menos' : 'Mostrar todos os meses'}</button>}

            </div>

          )}

                      {/* Prévia dos próximos meses; não altera o cadastro nem os saldos. */}
            {calendarioCompra && (
              <CalendarioCenario
                titulo="Calendário da compra — próximos 12 meses"
                descricao="Estimativa acumulada de orçamento: antes e depois da compra"
                diasAtual={calendarioCompra.diasAtual}
                diasSimulado={calendarioCompra.diasSimulado}
                dataInicial={calendarioCompra.dataInicial}
              />
            )}
            {calendarioCompra && (
              <p className="text-xs text-amber-700 rounded-lg bg-amber-50 px-3 py-2">
                Simulação aproximada: o mês atual parte do valor de referência e os meses seguintes
                distribuem uniformemente os totais mensais da Projeção. A compra à vista é aplicada
                hoje; nas parcelas, considera-se uma parcela por mês, a primeira neste mês.
                {resultado.fonte === 'cartao' && ' Para cartão, o simulador não conhece fechamento nem vencimento: os valores não representam o saldo bancário ou a data real da fatura.'}
                {' '}Nenhuma compra foi registrada.
              </p>
            )}
            {resultado.fonte !== 'saldo' && resultado.fonte !== 'cartao' && (
              <p className="text-xs text-amber-700 rounded-lg bg-amber-50 px-3 py-2">
                O pagamento foi simulado com VR/VA. Esse saldo é independente da conta bancária;
                para não misturar os saldos, o calendário bancário não é exibido nesta opção.
              </p>
            )}
<p className="text-xs text-gray-500 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 flex gap-2"><Info size={16} className="shrink-0 text-blue-600" /> {resultado.nota}</p>

          <div className="space-y-2">

            <button type="button" onClick={registrar} className="btn-primary w-full flex items-center justify-center gap-2 py-3"><ArrowRight size={16} /> Abrir cadastro desta compra</button>

            <p className="text-xs text-gray-500 text-center">O cadastro existente abrirá para você confirmar e preencher os dados. A simulação não grava nem pré-preenche o lançamento.</p>

            <button type="button" onClick={() => { setResultado(null); alterar('valor', '') }} className="btn-secondary w-full flex items-center justify-center gap-2 py-2.5"><RotateCcw size={15} /> Nova simulação</button>

          </div>

        </section>

      )}

    </div>

  )

}



export default function PossoComprar() {

  const [aba, setAba] = useState('compra')

  const ABAS = [

    { id: 'compra', nome: 'Compra', Icon: ShoppingCart },

    { id: 'imovel', nome: 'Imóvel', Icon: Home },

    { id: 'automovel', nome: 'Automóvel', Icon: Car },

    { id: 'consorcio', nome: 'Consórcio', Icon: Users },

  ]

  const legenda = {

    compra: 'Simule o impacto de uma compra no seu orçamento',

    imovel: 'Simule um financiamento imobiliário',

    automovel: 'Simule o financiamento de um automóvel',

    consorcio: 'Simule um consórcio de imóvel ou automóvel',

  }

  return (

    <div className="w-full max-w-none min-w-0 space-y-5 pb-mobilenav md:pb-0">

      <header><h1 className="text-2xl font-bold text-gray-900">Posso comprar?</h1><p className="text-sm text-gray-500 mt-1">{legenda[aba]}</p></header>

      <nav aria-label="Tipos de simulação" className="grid grid-cols-4 gap-1.5 sm:gap-2">

        {ABAS.map(item => <button type="button" key={item.id} onClick={() => setAba(item.id)}

          className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 px-1 sm:px-3 py-2.5 rounded-xl border text-[11px] sm:text-sm font-medium transition-colors ${aba === item.id ? 'bg-marca text-white border-marca' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}><item.Icon size={16} /><span>{item.nome}</span></button>)}

      </nav>

      {aba === 'compra' && <SimuladorCompra />}

      {aba === 'imovel' && <SimuladorFinanciamento />}

      {aba === 'automovel' && <SimuladorAutomovel />}

      {aba === 'consorcio' && <SimuladorConsorcio />}

    </div>

  )

}