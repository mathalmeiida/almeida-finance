import React, { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, ArrowLeft, Users, User } from 'lucide-react'
import { useProjecao } from '../hooks/useProjecao'
import { useDespesas } from '../hooks/useDespesas'
import { useReceitas } from '../hooks/useReceitas'
import { useCartoes } from '../hooks/useCartoes'
import { useParcelamentos } from '../hooks/useParcelamentos'
import { useComprasCartao } from '../hooks/useComprasCartao'
import { useFaturasCartao } from '../hooks/useFaturasCartao'
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
  const { idEfetivo, somenteLeitura, perfil, usuario } = useAuth()
  
  const hoje = partesHojeBrasil()
  const [mesVisivel, setMesVisivel] = useState(new Date(hoje.ano, hoje.mes - 1, 1, 12))
  const [params,setParams]=useSearchParams()
  const modoFamilia=!somenteLeitura&&params.has('familia')
  const setModoFamilia=v=>setParams(v?{familia:grupos[0]?.id||'1'}:{})
  
  const ano = mesVisivel.getFullYear()
  const mes = mesVisivel.getMonth() + 1
  
  // Dados pessoais
  const { despesas: despesasMes, recorrentes: despesasRecorrentes } = useDespesas(mes, ano)
  const { receitas: receitasMes, recorrentes: receitasRecorrentes } = useReceitas(mes, ano)
  const { cartoes } = useCartoes()
  const { parcelamentos } = useParcelamentos()
  const { compras: comprasCartao } = useComprasCartao()
  const { faturas: faturasInformadas } = useFaturasCartao()
  const { projecao } = useProjecao()
  
  const {grupos,erro:erroFamilia,carregando:carregandoFamilia}=useFamilyGroups(somenteLeitura?null:usuario?.id)
  const temAcessoFamilia=grupos.length>0
  const grupoSelecionado=grupos.find(g=>g.id===params.get('familia'))?.id||(params.get('familia')==='1'?grupos[0]?.id:null)
  const {divisoes,erro:erroDivisoes,carregando:carregandoDivisoes}=useFamilyExpenseSplits(modoFamilia?grupoSelecionado:null)

  const horizonte = useMemo(() => {
    if (!idEfetivo) return []
    
    if(modoFamilia){
      const dias=new Map()
      for(const d of divisoes||[]){
        const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(d.criado_em))
        const get=t=>Number(p.find(x=>x.type===t)?.value)
        if(get('year')!==ano||get('month')!==mes)continue
        const dia=get('day'), valor=Number(d.valor_total)/100
        if(!dias.has(dia))dias.set(dia,{dia,entradas:0,saidas:0,eventos:[]})
        const item=dias.get(dia);item.saidas+=valor;item.eventos.push({tipo:'saida',categoria:'variavel',descricao:d.descricao,valor})
      }
      return [{ano,mes,dias:[...dias.values()]}]
    }
    const despesasCalendario=despesasMes
    return gerarHorizonte({
      despesas: despesasCalendario,
      recorrentes: modoFamilia ? [] : despesasRecorrentes,
      receitas: modoFamilia ? [] : receitasMes,
      parcelamentos: modoFamilia ? [] : (parcelamentos || []),
      cartoes: modoFamilia ? [] : cartoes,
      comprasCartao: modoFamilia ? [] : (comprasCartao || []),
      faturasInformadas: modoFamilia ? [] : (faturasInformadas || []),
      meses: 3,
    })
  }, [idEfetivo, ano, mes, modoFamilia, divisoes, despesasMes, despesasRecorrentes,
      receitasMes, receitasRecorrentes, parcelamentos, cartoes, comprasCartao, faturasInformadas, usuario?.id])
  
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
                Família
              </button>
            </div>
          )}
          
          {modoFamilia&&<div className="space-y-2 mb-3"><label className="label">Grupo familiar<select className="input" value={grupoSelecionado||''} onChange={e=>setParams({familia:e.target.value})}><option value="">Selecione um grupo</option>{grupos.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select></label><p className="text-xs text-gray-500">Despesas compartilhadas por data de registro, sem projeção de saldo pessoal.</p>{(erroFamilia||erroDivisoes)&&<p role="alert" className="text-sm text-red-600">{erroFamilia||erroDivisoes}</p>}{(carregandoFamilia||carregandoDivisoes)&&<p className="text-xs">Carregando grupo…</p>}<button className="btn-secondary" onClick={()=>setModoFamilia(false)}>Voltar ao calendário pessoal</button></div>}
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
      
      <div className="max-w-[1200px] mx-auto p-4">
        <CalendarioFinanceiroHome
          horizonte={horizonte}
          mesVisivel={mesVisivel}
          onMudarMes={setMesVisivel}
          onAdicionarMovimentacao={modoFamilia||somenteLeitura?undefined:adicionarLancamento}
        />
        
        {modoFamilia&&grupoSelecionado&&<button className="btn-primary mt-3" onClick={()=>navigate(`/familia/${grupoSelecionado}`)}>Abrir despesas do grupo</button>}
        {!somenteLeitura && !modoFamilia && (
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
