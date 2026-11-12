// Prévia de Conciliação com Ações por Item (Fase 3)
// Lista transações com estado visual e permite aprovar/editar/ignorar

import React, { useState } from 'react'
import {
  CheckCircle2, AlertCircle, Plus, XCircle, Edit2, Eye, EyeOff,
  ChevronDown, ChevronUp, Repeat, CreditCard, Link as LinkIcon
} from 'lucide-react'
import { obterEstadoVisual, podeAprovar, podeEditar, podeIgnorar, podeVincular } from '../lib/conciliacao'
import { ROTULOS_TIPO } from '../lib/importacaoRegras'
import { formatCurrency } from '../lib/utils'

export default function ConciliacaoPrevia({ 
  itens, 
  categorias = [],
  onAprovar,
  onEditar, 
  onIgnorar,
  onVincular,
  exibirApenasIncluidos = false
}) {
  const [expandido, setExpandido] = useState({})
  const [filtroEstado, setFiltroEstado] = useState('todos')

  if (!itens || itens.length === 0) {
    return (
      <div className="card text-center py-8">
        <AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />
        <p className="text-sm text-gray-500">Nenhuma transação para exibir</p>
      </div>
    )
  }

  // Filtrar itens
  const itensFiltrados = itens.filter(it => {
    if (exibirApenasIncluidos && !it.incluir) return false
    if (filtroEstado === 'todos') return true
    if (filtroEstado === 'incluir' && it.incluir) return true
    if (filtroEstado === 'conciliados' && it.estadoConciliacao === 'conciliado') return true
    if (filtroEstado === 'novos' && it.estadoConciliacao === 'novo') return true
    if (filtroEstado === 'duplicatas' && (it.estadoConciliacao?.includes('duplicata') || it.estadoConciliacao === 'ja_importado')) return true
    return false
  })

  const toggleExpandir = (uid) => {
    setExpandido(prev => ({ ...prev, [uid]: !prev[uid] }))
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      {!exibirApenasIncluidos && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filtroEstado === 'todos'
                ? 'bg-marca text-white border-marca'
                : 'bg-white text-gray-700 border-gray-300 hover:border-marca'
            }`}
          >
            Todos ({itens.length})
          </button>
          <button
            onClick={() => setFiltroEstado('incluir')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filtroEstado === 'incluir'
                ? 'bg-marca text-white border-marca'
                : 'bg-white text-gray-700 border-gray-300 hover:border-marca'
            }`}
          >
            A importar ({itens.filter(it => it.incluir).length})
          </button>
          <button
            onClick={() => setFiltroEstado('novos')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filtroEstado === 'novos'
                ? 'bg-marca text-white border-marca'
                : 'bg-white text-gray-700 border-gray-300 hover:border-marca'
            }`}
          >
            Novos ({itens.filter(it => it.estadoConciliacao === 'novo').length})
          </button>
          <button
            onClick={() => setFiltroEstado('duplicatas')}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              filtroEstado === 'duplicatas'
                ? 'bg-marca text-white border-marca'
                : 'bg-white text-gray-700 border-gray-300 hover:border-marca'
            }`}
          >
            Duplicatas ({itens.filter(it => it.estadoConciliacao?.includes('duplicata') || it.estadoConciliacao === 'ja_importado').length})
          </button>
        </div>
      )}

      {/* Lista de itens */}
      <div className="space-y-2">
        {itensFiltrados.map((item) => (
          <ItemConciliacao
            key={item.uid}
            item={item}
            expandido={expandido[item.uid]}
            onToggle={() => toggleExpandir(item.uid)}
            categorias={categorias}
            onAprovar={() => onAprovar?.(item)}
            onEditar={(campo, valor) => onEditar?.(item, campo, valor)}
            onIgnorar={() => onIgnorar?.(item)}
            onVincular={() => onVincular?.(item)}
          />
        ))}
      </div>

      {itensFiltrados.length === 0 && (
        <div className="card text-center py-8">
          <AlertCircle size={32} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum item com esse filtro</p>
        </div>
      )}
    </div>
  )
}

// ── Item individual da conciliação ──────────────────────────────────────────

function ItemConciliacao({ item, expandido, onToggle, categorias, onAprovar, onEditar, onIgnorar, onVincular }) {
  const estado = obterEstadoVisual(item.estadoConciliacao || 'novo')
  const [editando, setEditando] = useState(false)

  const handleAprovar = () => {
    if (podeAprovar(item)) {
      onAprovar()
    }
  }

  const handleIgnorar = () => {
    if (podeIgnorar(item)) {
      onIgnorar()
    }
  }

  const handleVincular = () => {
    if (podeVincular(item)) {
      onVincular()
    }
  }

  const iconeEstado = {
    conciliado: CheckCircle2,
    novo: Plus,
    duplicata_provavel: AlertCircle,
    duplicata_possivel: AlertCircle,
    divergente: XCircle,
    ja_importado: CheckCircle2,
    transferencia: Repeat,
    pagamento_fatura: CreditCard,
  }[item.estadoConciliacao || 'novo'] || Plus

  const IconeEstado = iconeEstado

  return (
    <div className={`card ${item.incluir ? 'border-l-4 border-l-marca' : 'border-l-4 border-l-gray-300'}`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Checkbox de inclusão */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={item.incluir}
            onChange={(e) => onEditar('incluir', e.target.checked)}
            disabled={!podeEditar(item)}
            className="w-5 h-5 rounded border-gray-300 text-marca focus:ring-marca disabled:opacity-50"
          />
        </div>

        {/* Conteúdo principal */}
        <div className="flex-1 min-w-0">
          {/* Linha 1: Descrição e valor */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.descricao}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${estado.bg} ${estado.cor}`}>
                  <IconeEstado size={12} />
                  {estado.label}
                </span>
                {item.revisar && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                    <AlertCircle size={12} />
                    Revisar
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-base font-bold ${item.entrada ? 'text-green-600' : 'text-red-600'}`}>
                {item.entrada ? '+' : '-'} {formatCurrency(item.valor)}
              </p>
              <p className="text-xs text-gray-500">{ROTULOS_TIPO[item.tipo] || item.tipo}</p>
            </div>
          </div>

          {/* Linha 2: Categoria (se despesa) */}
          {item.tipo === 'despesa' && item.categoriaId && (
            <div className="text-xs text-gray-600 mb-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100">
                📁 {categorias.find(c => c.id === item.categoriaId)?.nome || 'Sem categoria'}
              </span>
            </div>
          )}

          {/* Avisos */}
          {item.avisos && item.avisos.length > 0 && (
            <div className="mt-2 space-y-1">
              {item.avisos.map((aviso, i) => (
                <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <Info size={12} className="mt-0.5 flex-shrink-0" />
                  <span>{aviso}</span>
                </p>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 mt-3">
            {podeAprovar(item) && !item.incluir && (
              <button
                onClick={handleAprovar}
                className="text-xs px-3 py-1.5 bg-marca text-white rounded-lg hover:bg-marca-hover transition-colors"
              >
                ✓ Aprovar
              </button>
            )}
            {podeEditar(item) && (
              <button
                onClick={() => setEditando(!editando)}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                <Edit2 size={12} />
                Editar
              </button>
            )}
            {podeIgnorar(item) && item.incluir && (
              <button
                onClick={handleIgnorar}
                className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
              >
                <EyeOff size={12} />
                Ignorar
              </button>
            )}
            {podeVincular(item) && (
              <button
                onClick={handleVincular}
                className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
              >
                <LinkIcon size={12} />
                Vincular
              </button>
            )}
            <button
              onClick={onToggle}
              className="ml-auto text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
            >
              {expandido ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {expandido ? 'Menos' : 'Mais'}
            </button>
          </div>

          {/* Detalhes expandidos */}
          {expandido && (
            <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
              {/* Comparação com existente */}
              {item.registroVinculado && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-700 mb-2">Registro existente encontrado:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Data:</span>
                      <span className="ml-2 text-gray-900">{new Date(item.registroVinculado.data + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Similaridade:</span>
                      <span className="ml-2 text-gray-900">{Math.round((item.similaridadeCalculada || 0) * 100)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    <span className="text-gray-500">Descrição:</span> {item.registroVinculado.descricao}
                  </p>
                </div>
              )}

              {/* Parcelamento */}
              {item.parcelaAtual && item.parcelaTotal && (
                <div className="text-xs text-gray-600">
                  <span className="text-gray-500">Parcelamento:</span> {item.parcelaAtual}/{item.parcelaTotal}
                </div>
              )}

              {/* Edição */}
              {editando && (
                <div className="bg-blue-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">Editar item:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-600">Tipo</label>
                      <select
                        value={item.tipo}
                        onChange={(e) => onEditar('tipo', e.target.value)}
                        className="mt-1 w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5"
                      >
                        {Object.entries(ROTULOS_TIPO).map(([tipo, label]) => (
                          <option key={tipo} value={tipo}>{label}</option>
                        ))}
                      </select>
                    </div>
                    {item.tipo === 'despesa' && (
                      <div>
                        <label className="text-xs text-gray-600">Categoria</label>
                        <select
                          value={item.categoriaId || ''}
                          onChange={(e) => onEditar('categoriaId', e.target.value)}
                          className="mt-1 w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5"
                        >
                          <option value="">Sem categoria</option>
                          {categorias.filter(c => c.tipo === 'despesa').map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setEditando(false)}
                    className="text-xs px-3 py-1.5 bg-marca text-white rounded-lg hover:bg-marca-hover"
                  >
                    Concluir edição
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
