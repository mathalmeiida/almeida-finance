import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Tv, CheckCircle2, XCircle, Calendar, TrendingUp, Info } from 'lucide-react'
import { useAssinaturas } from '../hooks/useAssinaturas'
import { formatCurrency } from '../lib/utils'

export default function AssinaturasPage() {
  const { ativas, canceladas, inativas, totalMensal, totalAtivas, totalCanceladas, totalInativas, carregando, erro } = useAssinaturas()
  const [aba, setAba] = useState('ativas')
  const lista = aba === 'ativas' ? ativas : aba === 'canceladas' ? canceladas : inativas
  const abas = [{id:'ativas',nome:'Ativas',total:totalAtivas},{id:'inativas',nome:'A revisar',total:totalInativas},{id:'canceladas',nome:'Canceladas',total:totalCanceladas}]
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/" className="text-gray-500 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <div><h1 className="text-2xl font-bold text-gray-900">Assinaturas</h1><p className="text-sm text-gray-500 mt-1">Gerencie seus gastos recorrentes</p></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center"><p className="text-xs text-gray-500 mb-1">Ativas e previstas</p><p className="text-2xl font-bold text-green-600">{totalAtivas}</p></div>
        <div className="card text-center"><p className="text-xs text-gray-500 mb-1">Total mensal estimado</p><p className="text-lg font-bold text-gray-900">{formatCurrency(totalMensal)}</p></div>
        <div className="card text-center"><p className="text-xs text-gray-500 mb-1">A revisar</p><p className="text-2xl font-bold text-amber-600">{totalInativas}</p></div>
        <div className="card text-center"><p className="text-xs text-gray-500 mb-1">Canceladas</p><p className="text-2xl font-bold text-red-600">{totalCanceladas}</p></div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {abas.map(a => <button key={a.id} type="button" onClick={() => setAba(a.id)} className={`px-3 py-2 text-sm font-medium transition-colors relative ${aba === a.id ? 'text-marca' : 'text-gray-500 hover:text-gray-700'}`}>
          {a.nome} ({a.total}){aba === a.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-marca" />}
        </button>)}
      </div>
      {carregando ? <p className="card text-center text-sm">Carregando assinaturas...</p> : erro ? <p className="card text-center text-sm text-red-600">Não foi possível carregar as despesas.</p> : lista.length > 0 ? (
        <div className="space-y-3">
          {lista.map(assinatura => (
            <div key={assinatura.id} className="card">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${assinatura.ativa ? 'bg-green-50' : assinatura.situacao === 'cancelada' ? 'bg-red-50' : 'bg-amber-50'}`}>
                  {assinatura.ativa ? <CheckCircle2 size={20} className="text-green-600" /> : assinatura.situacao === 'cancelada' ? <XCircle size={20} className="text-red-600" /> : <Info size={20} className="text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900 break-words min-w-0">{assinatura.descricao}</h3>
                    <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{formatCurrency(assinatura.valorMensal)}/mês</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    {assinatura.categoria && <span>{assinatura.categoria}</span>}
                    {assinatura.situacao === 'prevista' && <span className="text-marca">Prevista</span>}
                    {assinatura.ativa && assinatura.proximoVencimento && <span className="flex items-center gap-1"><Calendar size={12} /> Próximo: {new Date(assinatura.proximoVencimento + 'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'})}</span>}
                    {assinatura.situacao === 'cancelada' && <span className="text-red-600">Cancelamento registrado</span>}
                    {assinatura.situacao === 'inativa' && <span className="text-amber-600">{assinatura.diasDesdeUltima == null ? 'Sem data válida' : `Última ocorrência há ${assinatura.diasDesdeUltima} dias`}</span>}
                    <span className="text-gray-400">{assinatura.ocorrencias} ocorrência{assinatura.ocorrencias !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="card text-center py-12"><div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4"><Tv size={28} className="text-gray-400" /></div><h2 className="text-lg font-semibold text-gray-900 mb-2">{aba === 'ativas' ? 'Sem assinaturas ativas' : aba === 'canceladas' ? 'Sem assinaturas canceladas' : 'Nenhuma assinatura a revisar'}</h2><p className="text-sm text-gray-500">As informações são identificadas a partir das despesas cadastradas.</p></div>}
      {totalAtivas > 0 && aba === 'ativas' && <div className="card bg-blue-50 border-blue-200"><div className="flex items-start gap-3"><TrendingUp size={20} className="text-blue-600 flex-shrink-0 mt-0.5" /><div><h3 className="text-sm font-semibold text-blue-900 mb-2">Dica de economia</h3><p className="text-sm text-blue-700">Reduzir 30% do valor mensal estimado representaria uma economia de {formatCurrency(totalMensal * 0.3)} por mês.</p></div></div></div>}
      <div className="card bg-gray-50 border-gray-200"><div className="flex items-start gap-2"><Info size={16} className="text-gray-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-gray-600 leading-relaxed">Identificamos possíveis assinaturas por despesas fixas, recorrência e palavras-chave. Despesas sem atividade recente ou sem data válida podem aparecer em A revisar. Ausência de lançamentos não comprova cancelamento. O total mensal é uma estimativa baseada nos registros disponíveis.</p></div></div>
    </div>
  )
}