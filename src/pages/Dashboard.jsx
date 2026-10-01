import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, TrendingDown, CreditCard, Wallet, ArrowRight, ShoppingCart, Loader2, Zap, Sun, Plus
} from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useMetas } from '../hooks/useMetas'
import { useCategorias } from '../hooks/useCategorias'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, calcularLimiteDiario, diasRestantesNoMes } from '../lib/utils'
import { valorParcelaNoMes } from '../hooks/useParcelamentos'
import { classificarDespesa } from '../lib/classificarDespesa'
import Modal from '../components/Modal'

// ─── Modal de Gasto rápido ────────────────────────────────────────────────────
function FormGastoRapido({ onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('despesa')
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    categoria_id: '',
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    // Gasto rápido: à vista, não recorrente. Classificação automática (padrão variável).
    const tipo_despesa = classificarDespesa({
      descricao: form.descricao,
      categoria: catSelecionada?.nome || '',
    })
    onSalvar({
      descricao: form.descricao,
      valor: parseFloat(form.valor.replace(',', '.')),
      data: form.data,
      recorrente: false,
      categoria_id: form.categoria_id || null,
      tipo_despesa,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Café, Almoço, Uber..." required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor (R$)</label>
          <input name="valor" value={form.valor} onChange={handleChange}
            type="number" min="0.01" step="0.01" className="input" placeholder="0,00" required />
        </div>
        <div>
          <label className="label">Data</label>
          <input name="data" value={form.data} onChange={handleChange}
            type="date" className="input" required />
        </div>
      </div>
      <div>
        <label className="label">Categoria</label>
        <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input">
          <option value="">Sem categoria</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1">
        <Zap size={12} /> Registrado como despesa à vista no dia selecionado.
      </p>
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando
            ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            : 'Salvar gasto'}
        </button>
      </div>
    </form>
  )
}

function SummaryCard({ title, value, icon: Icon, color, bgColor, subtitle, carregando }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`w-9 h-9 rounded-xl ${bgColor} flex items-center justify-center`}>
          <Icon size={18} className={color} />
        </div>
      </div>
      <div>
        {carregando ? (
          <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(value)}</p>
        )}
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

// ─── Resumo da projeção em números (substitui o gráfico) ──────────────────────
function ResumoProjecao({ projecao }) {
  // Próximo mês = índice 1 (índice 0 é o mês atual). Fallback para o atual se só houver 1.
  const proximo = projecao[1] || projecao[0]
  const saldoProx = proximo?.saldo ?? 0
  const saldoPositivo = saldoProx >= 0

  return (
    <div className="space-y-5">
      {/* Resumo do próximo mês */}
      <div className={`rounded-2xl p-4 border ${saldoPositivo ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
        <p className="text-xs font-medium text-gray-500 mb-3">
          Resumo de <span className="capitalize font-semibold text-gray-700">{proximo?.mes}</span> (próximo mês)
        </p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-xs text-gray-400">Receitas previstas</p>
            <p className="text-sm font-bold text-green-600">{formatCurrency(proximo?.receitas ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Despesas previstas</p>
            <p className="text-sm font-bold text-red-500">{formatCurrency(proximo?.despesas ?? 0)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Disponível</p>
            <p className={`text-sm font-bold ${saldoPositivo ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(saldoProx)}
            </p>
          </div>
        </div>
        <p className={`text-sm font-semibold ${saldoPositivo ? 'text-blue-700' : 'text-red-700'}`}>
          {saldoPositivo
            ? `Você terá ${formatCurrency(saldoProx)} livres`
            : `Você ficará ${formatCurrency(Math.abs(saldoProx))} no negativo`}
        </p>
      </div>

      {/* Tabela dos 12 meses */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-gray-100">
              <th className="pb-2 text-xs font-medium text-gray-500">Mês</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Receitas</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Despesas</th>
              <th className="pb-2 text-xs font-medium text-gray-500 text-right">Disponível</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {projecao.map((m, i) => {
              const positivo = m.saldo >= 0
              return (
                <tr key={i} className={m.ehMesAtual ? 'bg-blue-50/40' : ''}>
                  <td className="py-2.5 text-gray-700">
                    <span className="capitalize">{m.mes}</span>
                    {m.ehMesAtual && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right text-green-600">{formatCurrency(m.receitas)}</td>
                  <td className="py-2.5 text-right text-red-500">{formatCurrency(m.despesas)}</td>
                  <td className="py-2.5 text-right">
                    {positivo ? (
                      <span className="font-semibold text-blue-600">{formatCurrency(m.saldo)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg">
                        ⚠️ {formatCurrency(m.saldo)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Card "Quanto posso gastar hoje?" ─────────────────────────────────────────
function CardQuantoPossoGastar({ limite, carregando }) {
  if (carregando) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 text-white/90 mb-3">
          <Sun size={18} />
          <span className="text-sm font-medium">Quanto posso gastar hoje?</span>
        </div>
        <div className="h-9 w-40 bg-black/20 rounded-lg animate-pulse" />
      </div>
    )
  }

  // Faltam dados para calcular com segurança — card compacto
  if (limite.indisponivel) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white">
          <Sun size={16} className="flex-shrink-0" />
          <span className="text-sm">{limite.motivo}</span>
        </div>
        <Link to="/receitas"
          className="inline-flex items-center gap-1.5 bg-white text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors self-start sm:self-auto flex-shrink-0">
          <Plus size={14} /> Cadastrar receita
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white">
      <div className="flex items-center gap-2 mb-2">
        <Sun size={18} />
        <span className="text-sm font-medium text-white/90">Quanto posso gastar hoje?</span>
      </div>

      {/* Mensagem principal em destaque */}
      <p className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
        Você pode gastar <span className="whitespace-nowrap">{formatCurrency(limite.limiteDiario)}</span> hoje
      </p>

      {/* Indicadores compactos */}
      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-black/15 rounded-xl px-3 py-2">
          <p className="text-xs text-white/70">Gastou hoje</p>
          <p className="text-sm font-bold">{formatCurrency(limite.gastosVariaveisHoje)}</p>
        </div>
        <div className="bg-black/15 rounded-xl px-3 py-2">
          <p className="text-xs text-white/70">Disponível no mês</p>
          <p className="text-sm font-bold">{formatCurrency(limite.saldoVariavelRestante)}</p>
        </div>
        <div className="bg-black/15 rounded-xl px-3 py-2">
          <p className="text-xs text-white/70">Dias restantes</p>
          <p className="text-sm font-bold">{limite.diasRestantes}</p>
        </div>
      </div>

      {limite.saldoVariavelRestanteReal < 0 && (
        <p className="text-xs text-white/90 mt-3 bg-black/15 rounded-lg px-3 py-2">
          ⚠️ Seus gastos variáveis já ultrapassaram o orçamento disponível do mês.
        </p>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { perfil } = useAuth()
  const {
    resumoMes, projecao, carregando, receitas, despesas, parcelamentos,
    mesAtual, anoAtual, criarDespesa,
  } = useProjecao()
  const { metas, carregando: carregandoMetas } = useMetas()

  const [modalGasto, setModalGasto] = useState(false)
  const [salvandoGasto, setSalvandoGasto] = useState(false)
  const [erroGasto, setErroGasto] = useState('')

  const sobraPositiva = resumoMes.sobraPrevista >= 0
  const hoje = new Date()
  const nomeMes = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const saudacao = perfil?.nome ? `Olá, ${perfil.nome.split(' ')[0]}` : 'Olá'
  const hojeISO = hoje.toISOString().split('T')[0]

  // Aviso de projeção zerada: há dados mas nenhum é recorrente
  const temReceitas = receitas.length > 0
  const temReceitasRecorrentes = receitas.some(r => r.recorrente)
  const temDespesas = despesas.length > 0
  const temDespesasRecorrentes = despesas.some(d => d.recorrente)
  const mostrarAvisoProjecao = !carregando && (
    (temReceitas && !temReceitasRecorrentes) ||
    (temDespesas && !temDespesasRecorrentes)
  )

  // ─── Cálculo "Quanto posso gastar hoje?" ───
  // Despesas à vista fixas (compromissos) — não inclui parcelas (evita duplicação)
  const despesasFixas = despesas
    .filter(d => d.tipo_despesa === 'fixa')
    .reduce((a, d) => a + Number(d.valor), 0)

  // Gastos variáveis à vista já realizados no mês
  const gastosVariaveisRealizados = despesas
    .filter(d => d.tipo_despesa !== 'fixa')
    .reduce((a, d) => a + Number(d.valor), 0)

  // Gastos variáveis à vista lançados hoje
  const gastosVariaveisHoje = despesas
    .filter(d => d.tipo_despesa !== 'fixa' && d.data === hojeISO)
    .reduce((a, d) => a + Number(d.valor), 0)

  // Parcelas devidas neste mês (fonte separada — não duplica despesas)
  const parcelasMes = parcelamentos
    .reduce((a, p) => a + valorParcelaNoMes(p, anoAtual, mesAtual), 0)

  // Reserva/meta do mês: soma dos aportes mensais sugeridos das metas com prazo futuro
  const reservaMes = metas.reduce((acc, m) => {
    if (!m.prazo) return acc
    const fim = new Date(m.prazo)
    const meses = Math.max(0, (fim.getFullYear() - hoje.getFullYear()) * 12 + (fim.getMonth() - hoje.getMonth()))
    const faltante = Number(m.valor_desejado) - Number(m.valor_atual)
    if (meses <= 0 || faltante <= 0) return acc
    return acc + (faltante / meses)
  }, 0)

  const limite = calcularLimiteDiario({
    receitaTotal: resumoMes.receitaTotal,
    despesasFixas,
    parcelasMes,
    reservaMes,
    gastosVariaveisRealizados,
    gastosVariaveisHoje,
    dataRef: hoje,
  })

  const carregandoLimite = carregando || carregandoMetas

  // ─── Handler do Gasto rápido ───
  async function handleSalvarGasto(dados) {
    setSalvandoGasto(true)
    setErroGasto('')
    try {
      await criarDespesa(dados)   // atualiza o estado interno → indicadores recalculam
      setModalGasto(false)
    } catch {
      setErroGasto('Erro ao salvar o gasto. Tente novamente.')
    } finally {
      setSalvandoGasto(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{saudacao} 👋</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">Resumo financeiro de {nomeMes}</p>
        </div>
        <button
          onClick={() => setModalGasto(true)}
          className="btn-primary flex items-center gap-2 flex-shrink-0"
        >
          <Zap size={16} /> <span className="hidden sm:inline">Gasto rápido</span><span className="sm:hidden">Gasto</span>
        </button>
      </div>

      {erroGasto && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroGasto}</p>
      )}

      {/* Card: Quanto posso gastar hoje? */}
      <CardQuantoPossoGastar limite={limite} carregando={carregandoLimite} />

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Receitas do mês"
          value={resumoMes.receitaTotal}
          icon={TrendingUp}
          color="text-green-600"
          bgColor="bg-green-50"
          subtitle={carregando ? '' : `${resumoMes.qtdReceitas} receita${resumoMes.qtdReceitas !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Despesas do mês"
          value={resumoMes.despesaTotal}
          icon={TrendingDown}
          color="text-red-500"
          bgColor="bg-red-50"
          subtitle={carregando ? '' : `${resumoMes.qtdDespesas} despesa${resumoMes.qtdDespesas !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Parcelas do mês"
          value={resumoMes.parcelasTotal}
          icon={CreditCard}
          color="text-orange-500"
          bgColor="bg-orange-50"
          subtitle={carregando ? '' : `${resumoMes.qtdParcelamentos} ativo${resumoMes.qtdParcelamentos !== 1 ? 's' : ''}`}
          carregando={carregando}
        />
        <SummaryCard
          title="Dinheiro disponível"
          value={resumoMes.sobraPrevista}
          icon={Wallet}
          color={sobraPositiva ? 'text-blue-600' : 'text-red-600'}
          bgColor={sobraPositiva ? 'bg-blue-50' : 'bg-red-50'}
          subtitle={carregando ? '' : sobraPositiva ? 'Situação saudável ✓' : '⚠️ Atenção: saldo negativo'}
          carregando={carregando}
        />
      </div>

      {/* Banner "Posso Comprar?" */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center">
            <ShoppingCart size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold">Vai fazer uma compra?</p>
            <p className="text-blue-200 text-sm">Simule o impacto no seu orçamento antes de decidir.</p>
          </div>
        </div>
        <Link
          to="/posso-comprar"
          className="flex items-center gap-2 bg-white text-blue-600 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors whitespace-nowrap"
        >
          Simular agora <ArrowRight size={16} />
        </Link>
      </div>

      {/* Gráfico de projeção */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Projeção dos próximos 12 meses</h2>
            <p className="text-xs text-gray-400 mt-0.5">Baseada em receitas e despesas recorrentes</p>
          </div>
          <Link
            to="/projecao"
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver detalhes <ArrowRight size={14} />
          </Link>
        </div>

        {/* Aviso quando não há itens recorrentes cadastrados */}
        {mostrarAvisoProjecao && (
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <span className="text-amber-500 text-base leading-none flex-shrink-0">⚠️</span>
            <div className="text-xs text-amber-800">
              <p className="font-semibold mb-0.5">A projeção dos próximos meses pode estar zerada.</p>
              <p>
                {!temReceitasRecorrentes && temReceitas && 'Nenhuma receita marcada como recorrente. '}
                {!temDespesasRecorrentes && temDespesas && 'Nenhuma despesa marcada como recorrente. '}
                Ao cadastrar, indique se o lançamento <strong>se repete todo mês</strong> para que apareça na projeção futura.
              </p>
              <div className="flex gap-3 mt-2">
                {!temReceitasRecorrentes && temReceitas && (
                  <Link to="/receitas" className="font-semibold underline hover:text-amber-900">
                    Revisar receitas →
                  </Link>
                )}
                {!temDespesasRecorrentes && temDespesas && (
                  <Link to="/despesas" className="font-semibold underline hover:text-amber-900">
                    Revisar despesas →
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {carregando ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : projecao.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-sm text-gray-500">Cadastre receitas e despesas para ver a projeção.</p>
            <Link to="/receitas" className="mt-2 text-sm text-blue-600 hover:underline">Cadastrar receitas</Link>
          </div>
        ) : (
          <ResumoProjecao projecao={projecao} />
        )}
      </div>

      {/* Modal de Gasto rápido */}
      <Modal aberto={modalGasto} onFechar={() => setModalGasto(false)} titulo="Gasto rápido">
        <FormGastoRapido
          onSalvar={handleSalvarGasto}
          onCancelar={() => setModalGasto(false)}
          carregando={salvandoGasto}
        />
      </Modal>
    </div>
  )
}
