// Resumo da Conciliação Financeira (Fase 3)
// Mostra estatísticas e totais da conciliação de forma visual

import React from 'react'
import { CheckCircle2, AlertCircle, Plus, Repeat, CreditCard, XCircle } from 'lucide-react'

export default function ResumoConciliacao({ resumo }) {
  if (!resumo) return null

  const cards = [
    {
      label: 'Conciliados',
      valor: resumo.conciliados,
      icone: CheckCircle2,
      cor: 'text-green-600',
      bg: 'bg-green-50',
      descricao: 'Correspondências exatas'
    },
    {
      label: 'Novos',
      valor: resumo.novos,
      icone: Plus,
      cor: 'text-blue-600',
      bg: 'bg-blue-50',
      descricao: 'Lançamentos inéditos',
      destaque: true
    },
    {
      label: 'Possíveis duplicatas',
      valor: resumo.duplicatasProvaveis + resumo.duplicatasPossiveis,
      icone: AlertCircle,
      cor: 'text-amber-600',
      bg: 'bg-amber-50',
      descricao: 'Revisar antes de importar'
    },
    {
      label: 'Divergentes',
      valor: resumo.divergentes,
      icone: XCircle,
      cor: 'text-orange-600',
      bg: 'bg-orange-50',
      descricao: 'Mesmo valor, descrição diferente'
    }
  ]

  const excluidos = [
    {
      label: 'Transferências',
      valor: resumo.transferencias,
      icone: Repeat,
      descricao: 'Entre suas contas'
    },
    {
      label: 'Pagamentos fatura',
      valor: resumo.pagamentosFatura,
      icone: CreditCard,
      descricao: 'Já contabilizados'
    },
    {
      label: 'Já importados',
      valor: resumo.jaImportados,
      icone: CheckCircle2,
      descricao: 'Anteriormente'
    }
  ]

  const temExcluidos = excluidos.some(e => e.valor > 0)

  return (
    <div className="space-y-4">
      {/* Cards principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl border ${card.destaque ? 'border-marca bg-marca-50' : 'border-gray-200 bg-white'} p-4`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icone size={20} className={card.cor} />
              </div>
              <p className={`text-2xl font-bold ${card.destaque ? 'text-marca' : card.cor}`}>
                {card.valor}
              </p>
            </div>
            <p className="text-xs font-medium text-gray-700">{card.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.descricao}</p>
          </div>
        ))}
      </div>

      {/* Resumo de importação */}
      {resumo.totalImportar > 0 && (
        <div className="card bg-marca-50 border-marca">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Total a importar</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {resumo.totalImportar} {resumo.totalImportar === 1 ? 'lançamento' : 'lançamentos'}
              </p>
            </div>
            <p className="text-2xl font-bold text-marca">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(resumo.valorImportar)}
            </p>
          </div>
        </div>
      )}

      {/* Itens excluídos (não contabilizados) */}
      {temExcluidos && (
        <div className="card bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-3">
            Não serão contabilizados (evita duplicidade)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {excluidos.filter(e => e.valor > 0).map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                <item.icone size={16} className="text-gray-400" />
                <span className="text-gray-600">
                  <span className="font-medium">{item.valor}</span> {item.label.toLowerCase()}
                </span>
                <span className="text-xs text-gray-400">({item.descricao})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
