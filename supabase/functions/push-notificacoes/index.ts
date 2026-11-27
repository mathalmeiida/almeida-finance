import {createClient} from 'npm:@supabase/supabase-js@2.49.4'
import webpush from 'npm:web-push@3.6.7'
import {timingSafeEqual} from 'node:crypto'
const encoder = new TextEncoder()
function autorizado(req:Request){
 const esperado=Deno.env.get('AF_PUSH_CRON_SECRET')||'', recebido=req.headers.get('x-af-cron')||''
 const a=encoder.encode(esperado),b=encoder.encode(recebido)
 return a.length>=32 && a.length===b.length && timingSafeEqual(a,b)
}
function endpointSeguro(s:any){
 try {const u=new URL(s.endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com'))&&typeof s.keys?.p256dh==='string'&&typeof s.keys?.auth==='string'}catch{return false}
}
Deno.serve(async req=>{
 if(req.method!=='POST'||!autorizado(req))return new Response('Não autorizado',{status:401})
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
 try{
 const pub=Deno.env.get('VAPID_PUBLIC_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY'),subject=Deno.env.get('VAPID_SUBJECT')
 if(!pub||!priv||!subject)throw new Error('Configuração VAPID incompleta')
 webpush.setVapidDetails(subject,pub,priv)
 const {data:config,error:configError}=await db.from('af_push_config').select('public_key').eq('id',1).single()
 if(configError||config.public_key!==pub)throw new Error('Chave pública não corresponde ao banco')
 const {data,error}=await db.rpc('af_push_reservar');if(error)throw error
 let enviados=0, falhas=0
 const rows=data||[]
 for(let i=0;i<rows.length;i+=10) await Promise.all(rows.slice(i,i+10).map(async (r:any)=>{
 let status='falha'
 try{
 const {data:s,error:e}=await db.from('push_subscriptions').select('ativo,af_diario,subscription').eq('id',r.sub_id).eq('usuario_id',r.uid).maybeSingle()
 if(e)throw e
 if(!s?.ativo||!s.af_diario){status='cancelado';return}
 if(!endpointSeguro(s.subscription)){status='endpoint_invalido';return}
 const manha=r.periodo==='manha'
 const payload={title:manha?'Bom dia! Vamos planejar?':'Como foram suas finanças hoje?',body:manha?'Confira quanto você pode gastar hoje no Almeida Finance.':'Registre suas receitas e despesas do dia e mantenha seu planejamento atualizado.',url:manha?'/':'/registrar',tag:manha?'af-diario-manha':'af-diario-noite'}
 await webpush.sendNotification(s.subscription,JSON.stringify(payload),{TTL:3600,urgency:'normal',timeout:8000})
 status='aceito';enviados++
 }catch(e:any){falhas++;if([404,410].includes(e?.statusCode)){status='expirado';await db.from('push_subscriptions').update({ativo:false,af_diario:false}).eq('id',r.sub_id)} }
 finally{await db.from('af_push_diario_log').update({status}).eq('usuario_id',r.uid).eq('dia',r.dia).eq('periodo',r.periodo)}
 }))
 return Response.json({reservados:rows.length,enviados,falhas})
 }catch{return Response.json({erro:'Falha no processamento. Confira configuração e migrations.'},{status:500})}
})
