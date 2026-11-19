import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, Users, User } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useDespesas } from '../hooks/useDespesas'
import { useReceitas } from '../hooks/useReceitas'
import { useCartoes } from '../hooks/useCartoes'
import { useFamilyGroups } from '../hooks/useFamilyGroups'
import { useFamilyExpenseSplits } from '../hooks/useFamilyExpenseSplits'
import { useAuth } from '../contexts/AuthContext'
import { useOcultarValores } from '../contexts/OcultarValoresContext'
import { exibirMoeda, partesHojeBrasil } from '../lib/utils'
import { gerarHorizonte } from '../lib/horizonteFinanceiro'
import CalendarioFinanceiroHome from '../components/CalendarioFinanceiroHome'

export default function Calendario() {
  const navigate = useNavigate()
  const { ocultar } = useOcultarValores()
  const { idEfetivo, somenteLeitura, perfil, user } = useAuth()
  
  const hoje = partesHojeBrasil()
  const [mesVisivel, setMesVisivel] = useState(new Date(hoje.ano, hoje.mes - 1, 1, 12))
  const [modoFamilia, setModoFamilia] = useState(false)
  
  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth() + 1
  
  // Dados pessoais
  const { despesas: despesasMes, recorrentes: despesasRecorrentes } = useDespesas(mes, ano)
  const { receitas: receitasMes, recorrentes: receitasRecorrentes } = useReceitas(mes, ano)
  const { cartoes } = useCartoes()
  const { projecao } = useProjecao()
  
  // Dados familiares
  const { grupos } = useFamilyGroups(user?.id)
  const grupoSelecionado = grupos[0]?.id || null
  const { divisoes } = useFamilyExpenseSplits(modoFamilia ? grupoSelecionado : null)
  
  const temAcessoFamilia = perfil?.subscription_plan && perfil.subscription_plan !== 'free' 
    || perfil?.plano_override 
    || false;
  
  const horizonte = useMemo(() => {
    if (!idEfetivo) return []
    
    const inicio = new Date(ano, mes - 1, 1)
    const fim = new Date(ano, mes, 0)
    
    // Se modo família, usar divisões em vez de despesas pessoais
    const despesasCalendario = modoFamilia && divisoes && divisoes.length > 0
      ? divisoes.map(d => {
          // Encontrar quanto o usuário atual deve nesta divisão
          const minhaParte = d.family_split_participants?.find(
            p => p.participant?.id === user?.id
          )
          
          return {
            id: d.id,
            descricao: d.descricao,
            valor: minhaParte ? minhaParte.valor_devido / 100 : 0, // centavos para reais
            data: new Date(d.criado_em).toISOString().slice(0, 10),
            categoria: d.categoria || 'outros',
            familiar: true,
            pago: minhaParte?.pago || false,
            pagoPor: d.pago_por?.nome_completo || 'Desconhecido'
          }
        })
      : despesasMes
    
    return gerarHorizonte({
      dataInicio: inicio.toISOString().slice(0, 10),
      dataFim: fim.toISOString().slice(0, 10),
      despesas: despesasCalendario,
      despesasRecorrentes: modoFamilia ? [] : despesasRecorrentes,
      receitas: modoFamilia ? [] : receitasMes,
      receitasRecorrentes: modoFamilia ? [] : receitasRecorrentes,
      cartoes: modoFamilia ? [] : cartoes,
      perfil: null,
    })
  }, [idEfetivo, ano, mes, modoFamilia, divisoes, despesasMes, despesasRecorrentes, receitasMes, receitasRecorrentes, cartoes, user])
  
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
          
          {/* Toggle Pessoal / Familiar */}
          {temAcessoFamilia && grupos.length > 0 && (
            <div className="flex items-center gap-2 mb-3 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setModoFamilia(false)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  !modoFamilia
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <User size={16} />
                Pessoal
              </button>
              <button
                onClick={() => setModoFamilia(true)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  modoFamilia
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users size={16} />
                {grupos[0]?.nome || 'Família'}
              </button>
            </div>
          )}
          
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
