import {useState,useEffect,useCallback,useRef} from 'react'
import {familiaAcao,mensagemAcesso} from '../lib/afAcessos'
export function useFamilyMembers(groupId){
  const [estado,setEstado]=useState({chave:null,membros:[],limite:0,titular_id:null,carregando:!!groupId,erro:null})
  const versao=useRef(0)
  const carregar=useCallback(async()=>{
    const n=++versao.current
    if(!groupId){setEstado({chave:null,membros:[],limite:0,titular_id:null,carregando:false,erro:null});return}
    setEstado(s=>({...s,chave:groupId,membros:s.chave===groupId?s.membros:[],carregando:true,erro:null}))
    try{const r=await familiaAcao('listar_membros',{p_group:groupId});if(n===versao.current)setEstado({chave:groupId,...r,carregando:false,erro:null})}
    catch(e){if(n===versao.current)setEstado({chave:groupId,membros:[],limite:0,titular_id:null,carregando:false,erro:mensagemAcesso(e)})}
  },[groupId])
  useEffect(()=>{carregar();return()=>{versao.current++}},[carregar])
  const visivel=estado.chave===groupId?estado:{membros:[],limite:0,titular_id:null,carregando:!!groupId,erro:null}
  const membros=visivel.membros
  async function executar(acao,id,papel){await familiaAcao(acao,{p_group:groupId,p_id:id,p_papel:papel||null});await carregar()}
  return {...visivel,alterarPapel:(id,papel)=>executar('papel',id,papel),removerMembro:id=>executar('remover',id),ehAdmin:uid=>membros.some(m=>m.user_id===uid&&m.papel==='admin'),temAdmin:()=>membros.some(m=>m.papel==='admin'),quantidadeAdmins:()=>membros.filter(m=>m.papel==='admin').length,recarregar:carregar}
}
