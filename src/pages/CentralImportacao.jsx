import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, History, FileText, CreditCard, TrendingUp, 
  Calendar, AlertCircle, CheckCircle2, XCircle, ChevronRight,
  ArrowUpCircle, ArrowDownCircle, Filter
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useImportacoes } from '../hooks/useImportacoes'
import ImportacaoInteligente from './ImportacaoInteligente'

const CONTEXTOS = {
  extrato: { label: 'Extrato bancário', icone: FileText, cor: 'text-blue-500', bg: 'bg-blue-100' },
  fatura: { label: 'Fatura de cartão', icone: CreditCard, cor: 'text-purple-500', bg: 'bg-purple-100' },
  investimentos: { label: 'Investimentos', icone: TrendingUp, cor: 'text-green-500', bg: 'bg-green-100' },
}

const STATUS_VISUAL = {
  concluida: { label: 'Concluída', icone: CheckCircle2, cor: 'text-green-600', bg: 'bg-green-50' },
  parcial: { label: 'Parcial', icone: AlertCircle, cor: 'text-amber-600', bg: 'bg-amber-50' },
}

function CardEstatistica({ label, valor, icone: Icone, cor, bgCor }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${cor}`}>{valor}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${bgCor} flex items-center justify-center flex-shrink-0`}>
          <Icone size={24} className={cor} />
        </div>
      </div>
    </div>
  )
}

function CardImportacao({ importacao, onClick }) {
  const ctx = CONTEXTOS[importacao.contexto] || CONTEXTOS.extrato
  const st = STATUS_VISUAL[importacao.status] || STATUS_VISUAL.concluida
  const Icone = ctx.icone
  const IconeStatus = st.icone

  const dataFormatada = new Date(importacao.criado_em).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const periodoFormatado = importacao.periodo_inicio && importacao.periodo_fim
    ? `${new Date(importacao.periodo_inicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${new Date(importacao.periodo_fim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : 'Período não informado'

  return (
    <button
      onClick={() => onClick(importacao)}
      className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-marca hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${ctx.bg} flex items-center justify-center flex-shrink-0`}>
          <Icone size={20} className={ctx.cor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{ctx.label}</p>
              {importacao.origem && <p className="text-xs text-gray-500 truncate">{importacao.origem}</p>}
            </div>
            <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {periodoFormatado}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpCircle size={12} className="text-green-600" />
              {importacao.qtd_importadas}
            </span>
            {importacao.qtd_ignoradas > 0 && (
              <span className="flex items-center gap-1">
                <ArrowDownCircle size={12} className="text-gray-400" />
                {importacao.qtd_ignoradas}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${st.cor} ${st.bg} px-2 py-1 rounded-full`}>
              <IconeStatus size={12} />
              {st.label}
            </span>
            <span className="text-xs text-gray-400">{dataFormatada}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export default function CentralImportacao() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const { listar } = useImportacoes()
  
  const [aba, setAba] = useState('historico') // historico | nova
  const [historico, setHistorico] = useState({ disponivel: false, lista: [] })
  const [carregando, setCarregando] = useState(true)
  const [filtroContexto, setFiltroContexto] = useState('todos')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  useEffect(() => {
    if (!usuario?.id) return
    carregarHistorico()
  }, [usuario?.id])

  async function carregarHistorico() {
    setCarregando(true)
    try {
      const resultado = await listar()
      setHistorico(resultado)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setCarregando(false)
    }
  }

  function abrirDetalhes(importacao) {
    // TODO: Implementar página de detalhes
    console.log('Detalhes da importação:', importacao)
  }

  const listaFiltrada = historico.lista.filter(imp => {
    if (filtroContexto !== 'todos' && imp.contexto !== filtroContexto) return false
    if (filtroStatus !== 'todos' && imp.status !== filtroStatus) return false
    return true
  })

  const estatisticas = historico.lista.reduce((acc, imp) => {
    acc.total++
    acc.importadas += imp.qtd_importadas
    acc.ignoradas += imp.qtd_ignoradas
    if (imp.status === 'concluida') acc.concluidas++
    return acc
  }, { total: 0, importadas: 0, ignoradas: 0, concluidas: 0 })

  return (
    <div className="w-full max-w-none space-y-4 pb-24 md:pb-6" data-testid="central-importacao">
      <header>
        <h1 className="text-xl font-bold text-gray-900">Central de Importação</h1>
        <p className="text-sm text-gray-500">Importe arquivos financeiros e acompanhe todo o histórico.</p>
      </header>

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setAba('historico')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'historico'
              ? 'border-marca text-marca'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <History size={16} />
            Histórico
          </span>
        </button>
        <button
          onClick={() => setAba('nova')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            aba === 'nova'
              ? 'border-marca text-marca'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Upload size={16} />
            Nova Importação
          </span>
        </button>
      </div>

      {/* Aba: Histórico */}
      {aba === 'historico' && (
        <div className="space-y-4">
          {/* Estatísticas */}
          {historico.disponivel && historico.lista.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <CardEstatistica
                label="Total"
                valor={estatisticas.total}
                icone={FileText}
                cor="text-marca"
                bgCor="bg-marca-100"
              />
              <CardEstatistica
                label="Importadas"
                valor={estatisticas.importadas}
                icone={CheckCircle2}
                cor="text-green-600"
                bgCor="bg-green-100"
              />
              <CardEstatistica
                label="Ignoradas"
                valor={estatisticas.ignoradas}
                icone={XCircle}
                cor="text-gray-500"
                bgCor="bg-gray-100"
              />
              <CardEstatistica
                label="Concluídas"
                valor={estatisticas.concluidas}
                icone={CheckCircle2}
                cor="text-blue-600"
                bgCor="bg-blue-100"
              />
            </div>
          )}

          {/* Filtros */}
          {historico.disponivel && historico.lista.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-2">
                <Filter size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Filtros</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={filtroContexto}
                  onChange={(e) => setFiltroContexto(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value="todos">Todos os tipos</option>
                  <option value="extrato">Extrato bancário</option>
                  <option value="fatura">Fatura de cartão</option>
                  <option value="investimentos">Investimentos</option>
                </select>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
                >
                  <option value="todos">Todos os status</option>
                  <option value="concluida">Concluída</option>
                  <option value="parcial">Parcial</option>
                </select>
              </div>
            </div>
          )}

          {/* Lista de importações */}
          {carregando && (
            <div className="card text-center py-8">
              <p className="text-sm text-gray-500">Carregando histórico...</p>
            </div>
          )}

          {!carregando && !historico.disponivel && (
            <div className="card text-center py-8">
              <AlertCircle size={40} className="text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Histórico indisponível</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                O histórico de importações requer uma atualização do banco de dados. 
                A importação continua funcionando normalmente, apenas o histórico não será registrado.
              </p>
            </div>
          )}

          {!carregando && historico.disponivel && historico.lista.length === 0 && (
            <div className="card text-center py-8">
              <History size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma importação ainda</p>
              <p className="text-xs text-gray-500 mb-4">Comece importando seus arquivos financeiros.</p>
              <button
                onClick={() => setAba('nova')}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Upload size={16} />
                Importar agora
              </button>
            </div>
          )}

          {!carregando && historico.disponivel && listaFiltrada.length > 0 && (
            <div className="space-y-2">
              {listaFiltrada.map((imp) => (
                <CardImportacao key={imp.id} importacao={imp} onClick={abrirDetalhes} />
              ))}
            </div>
          )}

          {!carregando && historico.disponivel && historico.lista.length > 0 && listaFiltrada.length === 0 && (
            <div className="card text-center py-8">
              <Filter size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma importação com esses filtros</p>
              <p className="text-xs text-gray-500">Ajuste os filtros para ver mais resultados.</p>
            </div>
          )}
        </div>
      )}

      {/* Aba: Nova Importação */}
      {aba === 'nova' && (
        <div>
          <ImportacaoInteligente
            embutido={false}
            onConcluir={() => {
              setAba('historico')
              carregarHistorico()
            }}
          />
        </div>
      )}
    </div>
  )
}
