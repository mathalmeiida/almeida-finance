import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight, 
  Loader2, AlertCircle, BarChart2, PieChart, Info, ArrowLeft
} from 'lucide-react'
import { useCustoDeVida } from '../hooks/useCustoDeVida'
import { formatCurrency, partesHojeBrasil } from '../lib/utils'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend 
} from 'recharts'

const { ano: anoAtual, mes: mesAtual } = partesHojeBrasil()

// Cores para o gráfico de pizza
const CORES_CATEGORIAS = [
  '#6366f1', // índigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
]

// ──────────────────────────────────────────────────────────────
// Componente: Card de Categoria
// ──────────────────────────────────────────────────────────────
function CardCategoria({ categoria, onClick }) {
  if (categoria.total === 0) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className="card text-left hover:ring-2 hover:ring-marca/30 transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
          {categoria.icone}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {categoria.nome}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {categoria.itens.length} {categoria.itens.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-lg font-bold text-gray-900">
          {formatCurrency(categoria.total)}
        </span>
        <span className="text-xs font-medium text-marca">
          {categoria.percentual}%
        </span>
      </div>
      {/* Barra de percentual */}
      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
        <div 
          className="h-1.5 rounded-full bg-marca transition-all" 
          style={{ width: `${categoria.percentual}%` }}
        />
      </div>
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
// Componente: Modal de Detalhes da Categoria
// ──────────────────────────────────────────────────────────────
function ModalDetalhesCategoria({ categoria, onFechar }) {
  if (!categoria) return null

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onFechar}
    >
      <div 
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{categoria.icone}</span>
            <h2 className="text-xl font-bold text-gray-900">{categoria.nome}</h2>
          </div>
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-2xl font-bold text-marca">
              {formatCurrency(categoria.total)}
            </span>
            <span className="text-sm text-gray-500">
              {categoria.itens.length} {categoria.itens.length === 1 ? 'lançamento' : 'lançamentos'}
            </span>
          </div>
        </div>

        {/* Lista de itens */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {categoria.itens.map((item, idx) => (
              <div key={`${item.id}-${idx}`} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {item.descricao}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      {item.tipo === 'cartao' && (
                        <>
                          <span>•</span>
                          <span>{item.cartao}</span>
                          {item.totalParcelas > 1 && (
                            <>
                              <span>•</span>
                              <span className="text-marca font-medium">
                                {item.parcela}/{item.totalParcelas}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {item.categoriaOriginal}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                    {formatCurrency(item.valor)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={onFechar}
            className="btn-secondary w-full"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// Componente Principal: Custo de Vida
// ──────────────────────────────────────────────────────────────
export default function CustoDeVida() {
  const [anoSelecionado, setAnoSelecionado] = useState(anoAtual)
  const [mesSelecionado, setMesSelecionado] = useState(mesAtual)
  const [categoriaAberta, setCategoriaAberta] = useState(null)
  const [periodoComparacao, setPeriodoComparacao] = useState(3) // 3, 6 ou 12 meses

  const {
    custoMesAtual,
    porCategoria,
    historicoMeses,
    carregando,
    calcularMediaPeriodo,
    temDados
  } = useCustoDeVida(anoSelecionado, mesSelecionado)

  // Navegação de mês
  function mesAnterior() {
    if (mesSelecionado === 1) {
      setMesSelecionado(12)
      setAnoSelecionado(prev => prev - 1)
    } else {
      setMesSelecionado(prev => prev - 1)
    }
  }

  function proximoMes() {
    if (mesSelecionado === 12) {
      setMesSelecionado(1)
      setAnoSelecionado(prev => prev + 1)
    } else {
      setMesSelecionado(prev => prev + 1)
    }
  }

  // Comparação com média histórica
  const mediaHistorica = calcularMediaPeriodo(periodoComparacao)
  const diferencaMedia = mediaHistorica 
    ? custoMesAtual?.total - mediaHistorica.media 
    : null
  const percentualDiferenca = mediaHistorica && mediaHistorica.media > 0
    ? ((diferencaMedia / mediaHistorica.media) * 100).toFixed(1)
    : null

  // Dados para o gráfico de pizza
  const dadosPizza = porCategoria
    .filter(cat => cat.total > 0)
    .map(cat => ({
      name: cat.nome,
      value: cat.total,
      percentual: cat.percentual
    }))

  // Dados para o gráfico de linha (histórico)
  const dadosLinha = historicoMeses.map(h => ({
    mes: h.label,
    valor: h.total,
    temDados: h.temDados
  }))

  const nomeMes = new Date(anoSelecionado, mesSelecionado - 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const ehMesAtual = anoSelecionado === anoAtual && mesSelecionado === mesAtual

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft size={16} />
          Voltar ao Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Custo de Vida</h1>
        <p className="text-sm text-gray-500 mt-1">
          Análise das suas despesas essenciais mensais
        </p>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={mesAnterior}
          className="btn-secondary p-2"
          aria-label="Mês anterior"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="text-center">
          <p className="text-lg font-bold text-gray-900 capitalize">{nomeMes}</p>
          {ehMesAtual && (
            <span className="text-xs text-marca font-medium">Mês atual</span>
          )}
        </div>

        <button
          type="button"
          onClick={proximoMes}
          className="btn-secondary p-2"
          aria-label="Próximo mês"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Loading */}
      {carregando && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-marca" />
        </div>
      )}

      {/* Sem dados */}
      {!carregando && !temDados && (
        <div className="card text-center py-12">
          <AlertCircle size={48} className="text-gray-200 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Dados insuficientes
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Não há despesas ou compras registradas para este mês. 
            Comece a lançar suas despesas para acompanhar seu custo de vida.
          </p>
          <Link to="/despesas" className="btn-primary mt-4 inline-flex items-center gap-2">
            Registrar despesa
          </Link>
        </div>
      )}

      {/* Conteúdo principal */}
      {!carregando && temDados && (
        <>
          {/* Card resumo principal */}
          <div className="card bg-gradient-to-br from-marca to-marca-hover text-white">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-sm opacity-90">Custo de vida total</p>
                <p className="text-3xl font-bold mt-1">
                  {formatCurrency(custoMesAtual.total)}
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <BarChart2 size={28} />
              </div>
            </div>

            {/* Comparação com média histórica */}
            {mediaHistorica && mediaHistorica.mesesComDados >= 2 && (
              <div className="flex items-center gap-2 pt-4 border-t border-white/20">
                <div className="flex items-center gap-1.5">
                  {diferencaMedia > 0 ? (
                    <TrendingUp size={16} className="text-red-200" />
                  ) : diferencaMedia < 0 ? (
                    <TrendingDown size={16} className="text-emerald-200" />
                  ) : null}
                  <span className="text-sm opacity-90">
                    {diferencaMedia > 0 ? '+' : ''}
                    {formatCurrency(Math.abs(diferencaMedia))}
                  </span>
                  <span className="text-xs opacity-75">
                    ({percentualDiferenca}%)
                  </span>
                </div>
                <span className="text-xs opacity-75">
                  vs média de {periodoComparacao} meses
                </span>
              </div>
            )}
          </div>

          {/* Seletor de período de comparação */}
          {mediaHistorica && (
            <div className="flex gap-2">
              {[3, 6, 12].map(meses => (
                <button
                  key={meses}
                  type="button"
                  onClick={() => setPeriodoComparacao(meses)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    periodoComparacao === meses
                      ? 'bg-marca text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Últimos {meses} meses
                </button>
              ))}
            </div>
          )}

          {/* Grid de categorias */}
          <div>
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Por categoria
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {porCategoria
                .filter(cat => cat.total > 0)
                .map(cat => (
                  <CardCategoria
                    key={cat.id}
                    categoria={cat}
                    onClick={() => setCategoriaAberta(cat)}
                  />
                ))}
            </div>
          </div>

          {/* Gráfico de pizza */}
          {dadosPizza.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Distribuição por categoria
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPie>
                  <Pie
                    data={dadosPizza}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name} (${entry.percentual}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosPizza.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={CORES_CATEGORIAS[index % CORES_CATEGORIAS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                  />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de evolução (linha) */}
          {dadosLinha.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Evolução (últimos 12 meses)
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dadosLinha}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelStyle={{ color: '#1f2937' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Aviso sobre dados reais */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              O custo de vida é calculado <strong>apenas com dados reais</strong> já cadastrados 
              (despesas e compras no cartão). Para análises mais precisas, mantenha seus 
              lançamentos atualizados.
            </p>
          </div>
        </>
      )}

      {/* Modal de detalhes da categoria */}
      {categoriaAberta && (
        <ModalDetalhesCategoria
          categoria={categoriaAberta}
          onFechar={() => setCategoriaAberta(null)}
        />
      )}
    </div>
  )
}
