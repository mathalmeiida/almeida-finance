import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { familiaAcao, mensagemAcesso } from '../lib/afAcessos'
export function useFamilyGroups(userId) {
  const [estado,setEstado]=useState({ chave:null, grupos:[], carregando:!!userId, erro:null })
  const versao=useRef(0)
  const carregarGrupos=useCallback(async()=>{
    const n=++versao.current
    if(!userId){setEstado({chave:null,grupos:[],carregando:false,erro:null});return}
    setEstado(s=>({chave:userId,grupos:s.chave===userId?s.grupos:[],carregando:true,erro:null}))
    try {
      const {data,error}=await supabase.from('family_members').select('papel,family_groups(id,nome,descricao,criado_em,ativo,af_titular_id)').eq('user_id',userId).eq('ativo',true)
      if(error)throw error
      if(n===versao.current)setEstado({chave:userId,grupos:(data||[]).filter(m=>m.family_groups?.ativo).map(m=>({...m.family_groups,papel:m.papel})),carregando:false,erro:null})
    }catch(e){if(n===versao.current)setEstado({chave:userId,grupos:[],carregando:false,erro:mensagemAcesso(e)})}
  },[userId])
  useEffect(()=>{carregarGrupos();return()=>{versao.current++}},[carregarGrupos])
  async function executar(acao,args){if(!userId)throw new Error('Sessão indisponível');const data=await familiaAcao(acao,args);await carregarGrupos();return data}
  const visivel=estado.chave===userId?estado:{grupos:[],carregando:!!userId,erro:null}
  return {...visivel,criarGrupo:(nome,descricao=null)=>executar('criar',{p_nome:nome,p_descricao:descricao}),atualizarGrupo:(id,dados)=>executar('editar',{p_group:id,p_nome:dados.nome,p_descricao:dados.descricao}),desativarGrupo:id=>executar('desativar',{p_group:id}),sairDoGrupo:id=>executar('sair',{p_group:id}),recarregar:carregarGrupos}
}
