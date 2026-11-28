import {useState,useEffect,useCallback,useRef} from 'react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../contexts/AuthContext'
import {familiaAcao,mensagemAcesso} from '../lib/afAcessos'
export function dividirIgualmente(valorTotal,participantes){
  const centavos=Math.round(Number(valorTotal)*100)
  const ids=participantes.map(p=>p.user_id||p.user?.id||p.id)
  if(!Number.isSafeInteger(centavos)||centavos<=0||centavos>2147483647||!ids.length||ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new Error('Valor ou participantes inválidos')
  const base=Math.floor(centavos/ids.length),resto=centavos%ids.length
  return ids.map((id,i)=>({user_id:id,valor_devido:base+(i<resto?1:0)}))
}
export function dividirPorPercentual(valorTotal,participantes){
  const centavos=Math.round(Number(valorTotal)*100)
  if(!Number.isSafeInteger(centavos)||centavos<=0||centavos>2147483647||!participantes.length||participantes.some(p=>!Number.isFinite(Number(p.percentual))||Number(p.percentual)<0)||Math.abs(participantes.reduce((s,p)=>s+Number(p.percentual),0)-100)>0.00001)throw new Error('Percentuais devem somar 100%')
  const partes=participantes.map(p=>({user_id:p.user_id||p.user?.id||p.id,exato:centavos*Number(p.percentual)/100}))
  if(partes.some(p=>!p.user_id)||new Set(partes.map(p=>p.user_id)).size!==partes.length)throw new Error('Participantes inválidos')
  const bases=partes.map(p=>Math.floor(p.exato)),resto=centavos-bases.reduce((s,v)=>s+v,0)
  if(resto<0||resto>partes.length)throw new Error('Percentuais inválidos para o valor informado')
  const ordem=partes.map((p,i)=>({i,f:p.exato-bases[i]})).sort((a,b)=>b.f-a.f||a.i-b.i)
  for(let i=0;i<resto;i++)bases[ordem[i].i]++
  return partes.map((p,i)=>({user_id:p.user_id,valor_devido:bases[i]}))
}
export function calcularBalanco(divisoes){
  const saldos={}
  for(const d of divisoes||[]){
    if(!d.paid_by)continue
    saldos[d.paid_by]??=0
    for(const p of d.family_split_participants||[]){
      if(!p.participant_id||p.pago||p.participant_id===d.paid_by)continue
      const valor=Number(p.valor_devido)||0
      saldos[d.paid_by]+=valor;saldos[p.participant_id]=(saldos[p.participant_id]||0)-valor
    }
  }
  return saldos
}
export function useFamilyExpenseSplits(groupId){
  const {usuario,somenteLeitura}=useAuth()
  const gid=!somenteLeitura&&usuario?.id?groupId:null
  const chave=gid?`${usuario.id}:${gid}`:null
  const [estado,setEstado]=useState({chave:null,divisoes:[],carregando:!!gid,erro:null})
  const versao=useRef(0)
  const carregar=useCallback(async()=>{
    const n=++versao.current
    if(!gid){setEstado({chave:null,divisoes:[],carregando:false,erro:null});return}
    setEstado(s=>({chave,divisoes:s.chave===chave?s.divisoes:[],carregando:true,erro:null}))
    try{
      const [resp,dir]=await Promise.all([supabase.from('family_expense_splits').select('*,family_split_participants(id,participant_id,valor_devido,pago,pago_em)').eq('group_id',gid).order('criado_em',{ascending:false}),familiaAcao('listar_membros',{p_group:gid})])
      if(resp.error)throw resp.error
      const nomes=new Map((dir.membros||[]).map(m=>[m.user_id,m.user]))
      const pessoa=id=>nomes.get(id)||{id,nome_completo:'Ex-membro'}
      const dados=(resp.data||[]).map(d=>({...d,pago_por:pessoa(d.paid_by),family_split_participants:(d.family_split_participants||[]).map(p=>({...p,participant:pessoa(p.participant_id)}))}))
      if(n===versao.current)setEstado({chave,divisoes:dados,carregando:false,erro:null})
    }catch(e){if(n===versao.current)setEstado({chave,divisoes:[],carregando:false,erro:mensagemAcesso(e)})}
  },[gid,chave])
  useEffect(()=>{carregar();return()=>{versao.current++}},[carregar])
  function verificar(){if(!gid)throw new Error('Grupo indisponível ou modo somente leitura')}
  async function criarDivisao({descricao,valor_total,paid_by,categoria,participantes}){verificar();const {data,error}=await supabase.rpc('af_familia_criar_divisao',{p_group:gid,p_descricao:descricao,p_valor_total:valor_total,p_paid_by:paid_by,p_categoria:categoria||null,p_participantes:participantes});if(error)throw error;await carregar();return data}
  async function marcar(id,pago){verificar();const {error}=await supabase.rpc('af_familia_marcar_pagamento',{p_group:gid,p_id:id,p_pago:pago});if(error)throw error;await carregar()}
  return {...(estado.chave===chave?estado:{divisoes:[],carregando:!!gid,erro:null}),criarDivisao,dividirIgualmente,dividirPorPercentual,marcarPago:id=>marcar(id,true),desmarcarPago:id=>marcar(id,false),calcularBalanco,recarregar:carregar}
}
