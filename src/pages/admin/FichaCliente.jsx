import React, { useEffect, useState } from 'react'
import { ArrowLeft, Eye, RefreshCw, ShieldCheck, Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { resumirFicha } from '../../lib/resumoConsultoria.mjs'

const moeda = v => v == null ? 'Não informado' : Number(v).toLocaleString('pt-BR', {style:'currency',currency:'BRL'})
const mesAtual = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).format(new Date())

export function MeusClientes({ usuarios, statusPorCliente, carregando, erro, analisar, solicitar }) {
  const [busca,setBusca] = useState('')
  const clientes = usuarios.filter(u => u.ativo !== false && statusPorCliente[u.id]?.status === 'autorizado')
  const visiveis = clientes.filter(u => `${u.nome || ''} ${u.email || ''}`.toLowerCase().includes(busca.toLowerCase().trim()))
  return <section className="card space-y-4">
    <div className="af-admin-section-title"><h2>Meus clientes ({carregando || erro ? '—' : clientes.length})</h2><button onClick={solicitar}>Gerenciar autorizações</button></div>
    <input className="input" placeholder="Buscar cliente autorizado" aria-label="Buscar cliente autorizado" value={busca} onChange={e=>setBusca(e.target.value)}/>
    {carregando ? <p>Carregando…</p> : erro ? <p role="alert">Não foi possível verificar as autorizações.</p> : !visiveis.length ? <p>Nenhum cliente autorizado encontrado.</p> : visiveis.map(u=><div key={u.id} className="flex items-center gap-3 flex-wrap border-b border-gray-100 py-3"><span className="af-admin-avatar">{(u.nome || '?').slice(0,2).toUpperCase()}</span><div className="flex-1 min-w-0"><p className="font-semibold">{u.nome || u.email}</p><p className="text-xs text-gray-500 break-all">{u.email}</p></div><button className="btn-primary" onClick={()=>analisar(u)}>Abrir ficha</button></div>)}
  </section>
}

export default function FichaCliente({ cliente, voltar, visualizar }) {
  const { usuario, ehAdmin } = useAuth()
  const [mes,setMes] = useState(mesAtual)
  const [dados,setDados] = useState(null)
  const [erro,setErro] = useState('')
  const [versao,setVersao] = useState(0)
  const [carregando,setCarregando] = useState(true)
  const [texto,setTexto] = useState('')
  const [tipo,setTipo] = useState('nota')
  const [salvando,setSalvando] = useState(false)
  const [erroSalvar,setErroSalvar] = useState('')
  useEffect(()=>{
    let ativo=true, ocupado=false
    setDados(null);setErro('');setCarregando(true)
    async function buscar(){
      if(ocupado || !ativo) return
      ocupado=true
      try {
        if(!ehAdmin || !usuario?.id) throw new Error('Acesso indisponível')
        const {data,error}=await supabase.rpc('af_pro_ficha_cliente',{p_cliente:cliente.id,p_mes:`${mes}-01`})
        if(error || !data || data.cliente_id!==cliente.id) throw new Error('Não foi possível consultar a ficha. Confirme a autorização e a instalação do SQL no DEV.')
        if(ativo){setDados(data);setErro('')}
      } catch(e){if(ativo){setDados(null);setErro(e.message)}} finally{ocupado=false;if(ativo)setCarregando(false)}
    }
    buscar()
    const timer=setInterval(buscar,15000)
    const foco=()=>{if(document.visibilityState==='visible') buscar()}
    window.addEventListener('focus',foco);document.addEventListener('visibilitychange',foco)
    return ()=>{ativo=false;clearInterval(timer);window.removeEventListener('focus',foco);document.removeEventListener('visibilitychange',foco)}
  },[cliente.id,mes,versao,ehAdmin,usuario?.id])
  async function salvar(e){
    e.preventDefault(); if(!dados || salvando || !texto.trim())return
    setSalvando(true);setErroSalvar('')
    try{
      const {error}=await supabase.from('af_pro_registros').insert({cliente_id:cliente.id,consultor_id:usuario.id,tipo,conteudo:texto.trim()})
      if(error)throw error
      setTexto('');setVersao(v=>v+1)
    }catch{setErroSalvar('Não foi possível salvar. Confirme se a autorização continua ativa.')}
    finally{setSalvando(false)}
  }
  const r=dados?resumirFicha(dados):null
  return <div className="space-y-4">
    <div className="flex gap-3 flex-wrap items-center"><button className="btn-secondary inline-flex gap-2 items-center" onClick={voltar}><ArrowLeft size={18}/> Meus clientes</button><button className="btn-secondary inline-flex gap-2 items-center" onClick={()=>setVersao(v=>v+1)}><RefreshCw size={16}/> Atualizar ficha</button></div>
    {carregando ? <section className="card">Verificando autorização e carregando ficha…</section> : erro || !r ? <section role="alert" className="card text-red-700">{erro || 'Ficha indisponível.'}</section> : <>
      <section className="card flex flex-wrap items-center gap-4"><span className="af-admin-avatar">{(dados.nome||'?').slice(0,2).toUpperCase()}</span><div className="flex-1"><h2 className="text-xl font-bold">{dados.nome || 'Cliente'}</h2><p className="text-sm text-gray-500">{dados.email}</p><span className="text-xs text-green-700 inline-flex items-center gap-1"><ShieldCheck size={14}/> Acesso autorizado · somente leitura financeira</span></div><button className="btn-primary inline-flex gap-2 items-center" onClick={()=>visualizar(cliente)}><Eye size={17}/> Visualizar aplicativo</button></section>
      <div className="flex items-center gap-3 flex-wrap"><label htmlFor="af-ficha-mes">Mês de referência</label><input id="af-ficha-mes" type="month" className="input max-w-xs" min="2000-01" max="2100-12" value={mes} onChange={e=>{if(/^\d{4}-\d{2}$/.test(e.target.value))setMes(e.target.value)}}/></div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">{[{l:'Saldo-base informado',v:dados.saldo_base,I:Wallet},{l:'Receitas registradas',v:dados.receitas,I:TrendingUp},{l:'Despesas registradas',v:dados.despesas,I:TrendingDown},{l:'Diferença dos lançamentos',v:r.diferenca,I:PiggyBank}].map(({l,v,I})=><div className="card" key={l}><I size={20} className="text-marca"/><p className="text-sm text-gray-500 mt-2">{l}</p><p className="text-xl font-bold">{moeda(v)}</p></div>)}</div>
      <p className="text-xs text-gray-500">Valores de lançamentos cadastrados no mês, não equivalem a fluxo de caixa realizado ou projeção. Não incluem recorrências futuras, faturas ou parcelas separadas. O saldo-base não é o patrimônio total.</p>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="card space-y-3"><h2 className="font-bold text-lg">Raio-X financeiro</h2><p>{r.diagnostico}</p><p>Margem dos lançamentos: <strong>{r.margem==null?'Dados insuficientes':`${r.margem.toFixed(1)}%`}</strong></p><p>Registros no mês: {dados.qtd_receitas} receitas · {dados.qtd_despesas} despesas</p><p>Saúde financeira: <strong>Avaliação preliminar</strong></p><p className="text-xs text-gray-500">Sem pontuação automática ou capacidade de poupança definitiva enquanto não houver conciliação dos compromissos e confirmação de completude.</p></section>
        <section className="card space-y-3"><h2 className="font-bold text-lg">Reserva e endividamento</h2><p>Reserva manual informada: <strong>{moeda(dados.reserva_atual)}</strong></p><p>Meta de reserva informada: <strong>{moeda(dados.meta_reserva)}</strong></p><p>Cobertura pelas despesas registradas: <strong>{r.cobertura==null?'Dados insuficientes':`${r.cobertura.toFixed(1)} meses`}</strong></p><p>Faturas registradas em aberto no mês: <strong>{moeda(dados.faturas_abertas)}</strong></p><p className="text-xs text-gray-500">Não representa dívida total: compras sem fatura consolidada, empréstimos e parcelamentos podem estar ausentes. A cobertura da reserva é apenas indicativa.</p></section>
      </div>
      <section className="card space-y-4"><h2 className="font-bold text-lg">Anotações privadas e rascunhos do plano de ação</h2><p className="text-sm text-gray-500">Registros internos do consultor. Ainda não são enviados ao cliente.</p><form className="space-y-3" onSubmit={salvar}><select className="input" aria-label="Tipo de registro" value={tipo} onChange={e=>setTipo(e.target.value)}><option value="nota">Anotação privada</option><option value="plano">Rascunho de plano de ação</option></select><textarea className="input" aria-label="Conteúdo do registro" value={texto} onChange={e=>setTexto(e.target.value)} maxLength={4000} required rows={4} placeholder="Escreva sua análise ou orientação…"/><button className="btn-primary" disabled={salvando || !texto.trim()}>{salvando?'Salvando…':'Salvar registro privado'}</button>{erroSalvar&&<p role="alert" className="text-red-700">{erroSalvar}</p>}</form>{dados.registros.length===0?<p className="text-sm text-gray-500">Nenhum registro.</p>:dados.registros.map(n=><article key={n.id} className="border-t border-gray-100 pt-3"><strong>{n.tipo==='nota'?'Anotação':'Rascunho de plano'}</strong><p className="text-xs text-gray-500">{new Date(n.criado_em).toLocaleString('pt-BR')}</p><p className="whitespace-pre-wrap break-words mt-2">{n.conteudo}</p></article>)}</section>
    </>}
  </div>
}
