import {useState,useEffect,useCallback,useRef} from 'react'
import {familiaAcao,mensagemAcesso} from '../lib/afAcessos'
export function useFamilyInvitations(userId,groupId=null){
  const chave=userId?`${userId}:${groupId||'recebidos'}`:null
  const [estado,setEstado]=useState({chave:null,convites:[],carregando:!!userId,erro:null})
  const versao=useRef(0)
  const carregar=useCallback(async()=>{
    const n=++versao.current
    if(!userId){setEstado({chave:null,convites:[],carregando:false,erro:null});return}
    setEstado(s=>({chave,convites:s.chave===chave?s.convites:[],carregando:true,erro:null}))
    try{const r=await familiaAcao('listar_convites',{p_group:groupId});if(n===versao.current)setEstado({chave,convites:r||[],carregando:false,erro:null})}
    catch(e){if(n===versao.current)setEstado({chave,convites:[],carregando:false,erro:mensagemAcesso(e)})}
  },[userId,groupId,chave])
  useEffect(()=>{carregar();return()=>{versao.current++}},[carregar])
  async function executar(acao,args){if(!userId)throw new Error('Sessão indisponível');const r=await familiaAcao(acao,args);await carregar();return r}
  return {...(estado.chave===chave?estado:{convites:[],carregando:!!userId,erro:null}),criarConvite:(id,email)=>executar('convidar',{p_group:id,p_email:email}),aceitarConvite:id=>executar('responder',{p_id:id,p_papel:'aceito'}),recusarConvite:id=>executar('responder',{p_id:id,p_papel:'recusado'}),cancelarConvite:id=>executar('cancelar',{p_group:groupId,p_id:id}),recarregar:carregar}
}
