import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend
} from 'recharts'
import { BarChart2, TrendingUp, TrendingDown, Wallet, Loader2 } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { formatCurrency } from '../lib/utils'

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-sm min-w-[180px]">
        <p className="font-semibold text-gray-700 mb-2">{label}</p>
        {payload.map((entry) => (
          <div key={entry.name} className="flex justify-between items-center gap-4 text-xs py-0.5">
            <span style={{ color: entry.fill || entry.color }}>{entry.name}</span>
            <span className="font-medium text-gray-800">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function Projecao() {
  const [modo, setModo] = useState('barras')
  const { projecao, carregando } = useProjecao()

  const mediaSaldo = projecao.length
    ? projecao.reduce((acc, m) => acc + m.saldo, 0) / projecao.length
    : 0
  const piorMes = projecao.length
    ? projecao.reduce((prev, curr) => curr.saldo < prev.saldo ? curr : prev)
    : null
  const melhorMes = projecao.length
    ? projecao.reduce((prev, curr) => curr.saldo > prev.saldo ? curr : prev)
    : null
  const mesesNegativos = projecao.filter(m => m.saldo < 0).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Projeção financeira</h1>
        <p className="text-sm text-gray-500 mt-1">Previsão para os próximos 12 meses</p>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      ) : projecao.length === 0 ? (
        <div className="card text-center py-16">
          <BarChart2 size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cadastre receitas e despesas para gerar a projeção.</p>
        </div>
      ) : (
        <>
          {/* Alerta se há meses negativos */}
          {mesesNegativos > 0 && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
              <span className="text-red-500 text-lg leading-none">⚠️</span>
              <p className="text-sm text-red-700">
                <strong>{mesesNegativos} mês{mesesNegativos > 1 ? 'es' : ''} com saldo negativo</strong> na projeção.
                Considere revisar suas despesas ou parcelamentos.
              </p>
            </div>
          )}

          {/* Cards de destaque */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Wallet size={18} className="text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Sobra média mensal</p>
              <p className={`text-xl font-bold ${mediaSaldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                {formatCurrency(mediaSaldo)}
              </p>
            </div>
            <div className="card text-center">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <TrendingUp size={18} className="text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Melhor mês</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(melhorMes.saldo)}</p>
              <p className="text-xs text-gray-400">{melhorMes.mes}</p>
            </div>
            <div className="card text-center">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                <TrendingDown size={18} className="text-red-500" />
              </div>
              <p className="text-xs text-gray-500 mb-1">Mês mais apertado</p>
              <p className={`text-xl font-bold ${piorMes.saldo >= 0 ? 'text-red-500' : 'text-red-700'}`}>
                {formatCurrency(piorMes.saldo)}
              </p>
              <p className="text-xs text-gray-400">{piorMes.mes}</p>
            </div>
          </div>

          {/* Gráfico */}
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-blue-600" />
                <h2 className="text-base font-semibold text-gray-900">Receitas vs. Despesas vs. Sobra</h2>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModo('barras')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${modo === 'barras' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Barras
                </button>
                <button onClick={() => setModo('saldo')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${modo === 'saldo' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Só sobra
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projecao} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                <ReferenceLine y={0} stroke="#e5e7eb" />
                {modo === 'barras' ? (
                  <>
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="receitas" name="Receitas" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="despesas" name="Despesas" fill="#f87171" radius={[4,4,0,0]} />
                    <Bar dataKey="saldo" name="Sobra" fill="#3b82f6" radius={[4,4,0,0]} />
                  </>
                ) : (
                  <Bar dataKey="saldo" name="Sobra" radius={[4,4,0,0]}>
                    {projecao.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.saldo >= 0 ? '#3b82f6' : '#ef4444'} />
                    ))}
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detalhamento mensal — tabela no desktop, cards no mobile */}
          <div className="card overflow-hidden">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Detalhamento mensal</h2>

            {/* Desktop (md+): tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-3 text-xs font-medium text-gray-500">Mês</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Receitas</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Despesas</th>
                    <th className="pb-3 text-xs font-medium text-gray-500 text-right">Sobra</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {projecao.map((m, i) => (
                    <tr key={i} className={m.ehMesAtual ? 'font-semibold bg-blue-50/50' : ''}>
                      <td className="py-2.5 text-gray-700">
                        {m.mes}
                        {m.ehMesAtual && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-green-600">{formatCurrency(m.receitas)}</td>
                      <td className="py-2.5 text-right text-red-500">{formatCurrency(m.despesas)}</td>
                      <td className={`py-2.5 text-right font-semibold ${m.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                        {formatCurrency(m.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile (<md): cada mês como card vertical, sem scroll horizontal */}
            <div className="md:hidden space-y-2.5">
              {projecao.map((m, i) => {
                const positivo = m.saldo >= 0
                return (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 ${m.ehMesAtual ? 'border-blue-200 bg-blue-50/40' : 'border-gray-100 bg-white'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="capitalize font-semibold text-gray-800 text-sm">{m.mes}</span>
                      {m.ehMesAtual && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">atual</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-x-3">
                      <div>
                        <p className="text-[11px] text-gray-400">Receitas</p>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(m.receitas)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Despesas</p>
                        <p className="text-sm font-semibold text-red-500">{formatCurrency(m.despesas)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Sobra</p>
                        <p className={`text-sm font-bold ${positivo ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCurrency(m.saldo)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
