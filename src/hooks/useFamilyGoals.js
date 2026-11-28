import {useState,useEffect,useCallback,useRef} from 'react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../contexts/AuthContext'
import {mensagemAcesso} from '../lib/afAcessos'
const centavos=valor=>{const n=Math.round(Number(valor)*100);if(!Number.isSafeInteger(n)||n<=0||n>2147483647)throw new Error('Informe um valor positivo válido');return n}
export function useFamilyGoals(groupId){
  const {usuario,somenteLeitura}=useAuth(),gid=!somenteLeitura&&usuario?.id?groupId:null,chave=gid?`${usuario.id}:${gid}`:null
  const [estado,setEstado]=useState({chave:null,metas:[],carregando:!!gid,erro:null}),versao=useRef(0)
  const carregar=useCallback(async()=>{
    const n=++versao.current
    if(!gid){setEstado({chave:null,metas:[],carregando:false,erro:null});return}
    setEstado(s=>({chave,metas:s.chave===chave?s.metas:[],carregando:true,erro:null}))
    try{const {data,error}=await supabase.from('family_goals').select('*,family_goal_contributions(id,valor,criado_em,contributor_id)').eq('group_id',gid).eq('ativo',true).order('criado_em',{ascending:false});if(error)throw error;const metas=(data||[]).map(m=>{const t=(m.family_goal_contributions||[]).reduce((s,c)=>s+Number(c.valor||0),0);return {...m,total_contribuido:t,progresso:m.valor_alvo>0?Math.min(100,t*100/m.valor_alvo):0,concluida:t>=m.valor_alvo}});if(n===versao.current)setEstado({chave,metas,carregando:false,erro:null})}catch(e){if(n===versao.current)setEstado({chave,metas:[],carregando:false,erro:mensagemAcesso(e)})}
  },[gid,chave])
  useEffect(()=>{carregar();return()=>{versao.current++}},[carregar])
  function verificar(){if(!gid)throw new Error('Grupo indisponível ou modo somente leitura')}
  async function criarMeta({nome,descricao,valor_alvo,data_alvo}){verificar();if(!nome?.trim())throw new Error('Informe o nome da meta');const {data,error}=await supabase.from('family_goals').insert({group_id:gid,nome:nome.trim(),descricao:descricao||null,valor_alvo:centavos(valor_alvo),data_alvo:data_alvo||null}).select().single();if(error)throw error;await carregar();return data}
  async function atualizarMeta(id,dados){verificar();const update={};for(const k of ['nome','descricao','data_alvo','ativo'])if(k in dados)update[k]=dados[k];if('valor_alvo' in dados)update.valor_alvo=centavos(dados.valor_alvo);const {error}=await supabase.from('family_goals').update(update).eq('id',id).eq('group_id',gid).select('id').single();if(error)throw error;await carregar()}
  async function contribuir(id,valor){verificar();const {error}=await supabase.from('family_goal_contributions').insert({goal_id:id,contributor_id:usuario.id,valor:centavos(valor)});if(error)throw error;await carregar()}
  return {...(estado.chave===chave?estado:{metas:[],carregando:!!gid,erro:null}),criarMeta,atualizarMeta,desativarMeta:id=>atualizarMeta(id,{ativo:false}),contribuir,calcularDivisao:(meta,n)=>n>0?Math.max(0,meta.valor_alvo-meta.total_contribuido)/n:0,recarregar:carregar}
}
