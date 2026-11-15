import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useDespesas } from '../hooks/useDespesas'
import { useReceitas } from '../hooks/useReceitas'
import { useCartoes } from '../hooks/useCartoes'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import { exibirMoeda, partesHojeBrasil } from '../lib/utils'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'
import CalendarioFinanceiroHome from '../components/CalendarioFinanceiroHome'

export default function Calendario() {
  const navigate = useNavigate()
  const { ocultar } = useOcultarValores()
  const { idEfetivo, somenteLeitura } = useAuth()
  
  const hoje = partesHojeBrasil()
  const [mesVisivel, setMesVisivel] = useState(new Date(hoje.ano, hoje.mes - 1, 1, 12))
  
  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth() + 1
  
  const { despesas: despesasMes, recorrentes: despesasRecorrentes } = useDespesas(mes, ano)
  const { receitas: receitasMes, recorrentes: receitasRecorrentes } = useReceitas(mes, ano)
  const { cartoes } = useCartoes()
  const { projecao } = useProjecao()
  
  const horizonte = useMemo(() => {
    if (!idEfetivo) return []
    
    const inicio = new Date(ano, mes - 1, 1)
    const fim = new Date(ano, mes, 0)
    
    return gerarHorizonte({
      dataInicio: inicio.toISOString().slice(0, 10),
      dataFim: fim.toISOString().slice(0, 10),
      despesas: despesasMes,
      despesasRecorrentes,
      receitas: receitasMes,
      receitasRecorrentes,
      cartoes,
      perfil: null,
    })
  }, [idEfetivo, ano, mes, despesasMes, despesasRecorrentes, receitasMes, receitasRecorrentes, cartoes])
  
  const mesNome = mesVisivel.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  
  function mesAnterior() {
    setMesVisivel(new Date(ano, mes - 2, 1, 12))
  }
  
  function mesSeguinte() {
    setMesVisivel(new Date(ano, mes, 1, 12))
  }
  
  function voltar() {
    navigate(-1)
  }
  
  function adicionarLancamento() {
    navigate('/registrar')
  }
  
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={voltar} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-lg font-bold">Calendário Financeiro</h1>
            <div className="w-9" />
          </div>
          
          <div className="flex items-center justify-between">
            <button onClick={mesAnterior} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft size={20} />
            </button>
            <span className="text-sm font-medium text-gray-700 capitalize min-w-[180px] text-center">
              {mesNome}
            </span>
            <button onClick={mesSeguinte} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto p-4">
        <CalendarioFinanceiroHome
          horizonte={horizonte}
          mesVisivel={mesVisivel}
          onMudarMes={setMesVisivel}
          onAdicionarMovimentacao={adicionarLancamento}
        />
        
        {!somenteLeitura && (
          <button
            onClick={adicionarLancamento}
            className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-marca text-white shadow-lg flex items-center justify-center hover:bg-marca-700 transition-colors z-20"
            aria-label="Adicionar lançamento"
          >
            <Plus size={24} />
          </button>
        )}
      </div>
    </div>
  )
}
