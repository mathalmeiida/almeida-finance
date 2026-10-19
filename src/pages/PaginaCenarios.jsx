import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useAuth } from '../contexts/AuthContext'
import SimuladorCenarios from '../components/SimuladorCenarios'

// Pagina propria: mesma fonte de dados reais usada no Dashboard.
export default function PaginaCenarios() {
  const { resumoMes, carregando } = useProjecao()
  const { perfil } = useAuth()
  const receitaAtual = Number(resumoMes?.receitaTotal) || 0
  const despesaMensal = (Number(resumoMes?.despesaTotal) || 0) +
    (Number(resumoMes?.parcelasTotal) || 0) +
    (Number(resumoMes?.faturasTotal) || 0)
  const reservaAtual = Number(perfil?.reserva_atual) || 0

  return (
    <main className="mx-auto w-full max-w-7xl min-w-0 space-y-6 px-0 sm:px-2 pb-24">
      <div className="space-y-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-marca hover:underline">
          <ArrowLeft size={17} /> Voltar para a Home
        </Link>
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-marca-100 p-3 text-marca"><Sparkles size={22} /></div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">E se...?</h1>
            <p className="text-sm text-gray-500 mt-1">Explore cenarios e visualize o impacto no seu planejamento financeiro.</p>
          </div>
        </div>
      </div>
      {carregando ? (
        <div className="card text-sm text-gray-500" role="status">Carregando seus dados financeiros...</div>
      ) : (
        <div className="card min-w-0 !p-4 sm:!p-6 lg:!p-7">
          <SimuladorCenarios
            receitaAtual={receitaAtual}
            despesaMensal={despesaMensal}
            reservaAtual={reservaAtual}
          />
        </div>
      )}
    </main>
  )
}