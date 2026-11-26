import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, CalendarDays, Wallet, CreditCard, Target, TrendingUp, ShieldCheck, ShoppingCart, Sparkles, CheckCircle2, PiggyBank } from 'lucide-react'

const TELAS = [
  { id: 'capa', titulo: 'Seu dinheiro. Seu controle.', destaque: 'Seu futuro.', texto: 'Organize suas finanças, acompanhe seu patrimônio e planeje suas próximas conquistas em um só lugar.', beneficios: [[Wallet,'Controle completo','Receitas, despesas, cartões e investimentos.'],[Target,'Planejamento inteligente','Calendário, metas e orçamento.'],[ShieldCheck,'Mais tranquilidade','Acompanhe suas decisões com clareza.']] },
  { id: 'quanto-posso', titulo: 'Saiba quanto você', destaque: 'pode gastar hoje.', texto: 'Conheça seu limite diário considerando seu saldo e compromissos financeiros.', imagem: 'limite.webp', beneficios: [[Wallet,'Limite diário','Acompanhe o orçamento disponível.'],[CalendarDays,'Agenda financeira','Consulte seus próximos vencimentos.'],[Target,'Planejamento','Organize seus gastos e objetivos.']] },
  { id: 'simular-compra', titulo: 'Compre com consciência,', destaque: 'planeje seu futuro.', texto: 'Simule uma compra e avalie o impacto de cada opção de pagamento no orçamento.', imagem: 'compra.webp', beneficios: [[ShoppingCart,'Simulação de compra','Compare opções à vista e parceladas.'],[TrendingUp,'Impacto no orçamento','Entenda os compromissos futuros.'],[CheckCircle2,'Decisões conscientes','Avalie antes de comprar.']] },
  { id: 'controle', titulo: 'Organize suas contas e', destaque: 'acompanhe seu patrimônio.', texto: 'Cartões, investimentos, metas e gastos em um só lugar.', imagem: 'patrimonio.webp', beneficios: [[CreditCard,'Cartões e faturas','Acompanhe limites e vencimentos.'],[PiggyBank,'Investimentos e metas','Organize suas aplicações e objetivos.'],[CalendarDays,'Visão completa','Consulte compromissos e projeções.']] },
  { id: 'inicio', titulo: 'Comece a transformar', destaque: 'sua vida financeira.', texto: 'Monte seu plano, acompanhe seus resultados e tome decisões com mais confiança.', beneficios: [[Sparkles,'Mais clareza','Entenda suas finanças.'],[Wallet,'Mais controle','Organize seus gastos e investimentos.'],[Target,'Mais evolução','Acompanhe suas conquistas.']] }
]

function Demonstracao({ final }) {
  return <div className="af-tour-scene" aria-hidden="true">
    <div className="af-tour-orbit" />
    <div className="af-tour-phone af-tour-phone-back">
      <div className="af-tour-phone-top">12:30 <span>•••</span></div>
      <div className="af-tour-phone-label">{final ? 'Minhas metas' : 'Calendário financeiro'}</div>
      {final ? <>{[['Reserva de emergência','62%'],['Viagem','38%'],['Casa própria','24%']].map(([nome,pct]) => <div className="af-tour-mini" key={nome}>{nome}<strong>{pct}</strong><div className="af-tour-bar"><i style={{width:pct}} /></div></div>)}</> : <><div className="af-tour-days">{Array.from({length:28},(_,i)=><span key={i} className={[2,8,15,21].includes(i)?'marked':''}>{i+1}</span>)}</div><div className="af-tour-mini">Próximos compromissos<strong>R$ 850,00</strong></div></>}
    </div>
    <div className="af-tour-phone af-tour-phone-front">
      <div className="af-tour-phone-top">12:30 <span>•••</span></div>
      <div className="af-tour-phone-brand"><img src="/branding/af-icone.png" alt="" /> Almeida Finance</div>
      <div className="af-tour-phone-label">{final ? 'Seu planejamento' : 'Olá! Bem-vindo'}</div>
      <div className="af-tour-balance"><small>Saldo em contas</small><strong>R$ 8.450,00</strong></div>
      <div className="af-tour-mini-grid"><div className="af-tour-mini"><small>Receitas</small><strong style={{color:'#86efac'}}>R$ 6.000</strong></div><div className="af-tour-mini"><small>Despesas</small><strong style={{color:'#fda4af'}}>R$ 3.250</strong></div></div>
      <div className="af-tour-mini">Cartões <strong>R$ 1.200,00</strong><small>Fatura do ciclo</small></div>
      <div className="af-tour-mini">Meta: reserva<strong>62%</strong><div className="af-tour-bar"><i style={{width:'62%'}} /></div></div>
      <div className="af-tour-phone-nav"><Wallet size={17}/><CreditCard size={17}/><CalendarDays size={17}/><Target size={17}/></div>
    </div>
    <div className="af-tour-glow" />
  </div>
}

function Visual({ tela }) {
  const [falhou,setFalhou] = useState(false)
  return <figure className="af-tour-figure">
    {tela.imagem && !falhou ? <img className="af-tour-art" src={`/branding/apresentacao/${tela.imagem}`} alt="Ilustração demonstrativa do aplicativo" onError={()=>setFalhou(true)} loading="lazy" /> : <Demonstracao final={tela.id==='inicio'} />}
    <figcaption>Interface ilustrativa • valores de exemplo</figcaption>
  </figure>
}

export default function Apresentacao({ aoConcluir, rodapeCustom = null, onComecar, onEntrar }) {
  const publico = typeof onComecar === 'function' && typeof onEntrar === 'function'
  const [idx,setIdx] = useState(0)
  const trilhoRef = useRef(null)
  const alvoRef = useRef(null)
  const [reduz,setReduz] = useState(()=>typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  const total = TELAS.length
  const ehUltimo = idx === total - 1
  useEffect(()=>{
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if(!mq) return
    const atualizar=()=>setReduz(mq.matches)
    mq.addEventListener?.('change',atualizar)
    return ()=>mq.removeEventListener?.('change',atualizar)
  },[])
  const irPara = useCallback(i=>{
    const el=trilhoRef.current
    if(!el) return
    const destino=Math.max(0,Math.min(total-1,i))
    alvoRef.current=destino
    el.scrollTo({left:destino*el.clientWidth,behavior:reduz?'auto':'smooth'})
  },[total,reduz])
  const passo = useCallback(delta=>{
    const el=trilhoRef.current
    if(el) irPara((alvoRef.current ?? Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))+delta)
  },[irPara])
  useEffect(()=>{
    const el=trilhoRef.current
    if(!el) return
    let fim
    const ler=()=>{
      setIdx(Math.max(0,Math.min(total-1,Math.round(el.scrollLeft/Math.max(1,el.clientWidth)))))
      clearTimeout(fim)
      fim=setTimeout(()=>{alvoRef.current=null},160)
    }
    el.addEventListener('scroll',ler,{passive:true})
    return ()=>{el.removeEventListener('scroll',ler);clearTimeout(fim)}
  },[total])
  useEffect(()=>{
    const ajustar=()=>{ const el=trilhoRef.current; if(el){alvoRef.current=null;el.scrollTo({left:idx*el.clientWidth,behavior:'auto'})} }
    window.addEventListener('resize',ajustar)
    return ()=>window.removeEventListener('resize',ajustar)
  },[idx])
  useEffect(()=>{
    const tecla=e=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.target?.isContentEditable) return
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();passo(e.key==='ArrowRight'?1:-1)}
    }
    window.addEventListener('keydown',tecla)
    return ()=>window.removeEventListener('keydown',tecla)
  },[passo])
  const pular=()=>publico?onEntrar():aoConcluir?.()
  return <div className="af-tour" data-testid="apresentacao">
    <style>{CSS}</style>
    <header className="af-tour-header"><div className="af-tour-brand"><img src="/branding/af-icone.png" alt=""/><span>Almeida Finance</span></div>{!ehUltimo&&<button type="button" className="af-tour-skip" onClick={pular} data-testid="apresentacao-pular">Pular</button>}</header>
    <div ref={trilhoRef} className="af-tour-track" aria-roledescription="carrossel" aria-label="Apresentação do Almeida Finance" data-testid="apresentacao-trilho" onPointerDown={()=>{alvoRef.current=null}}>
      {TELAS.map((t,i)=><section key={t.id} className="af-tour-slide" aria-roledescription="slide" aria-label={`${i+1} de ${total}`} data-tela={t.id}>
        <div className="af-tour-layout"><div className="af-tour-copy"><span className="af-tour-kicker">{String(i+1).padStart(2,'0')} / {String(total).padStart(2,'0')}</span><h2>{t.titulo} <span>{t.destaque}</span></h2><p className="af-tour-subtitle">{t.texto}</p><div className="af-tour-benefits">{t.beneficios.map(([Icone,titulo,texto])=><div key={titulo} className="af-tour-benefit"><span className="af-tour-icon"><Icone size={23}/></span><div><strong>{titulo}</strong><p>{texto}</p></div></div>)}</div></div><Visual tela={t}/></div>
      </section>)}
    </div>
    <footer className="af-tour-footer">
      <div className="af-tour-navigation"><button type="button" disabled={idx===0} onClick={()=>passo(-1)} aria-label="Tela anterior" data-testid="apresentacao-voltar"><ChevronLeft size={22}/></button><div className="af-tour-dots" aria-label="Progresso da apresentação">{TELAS.map((t,i)=><button type="button" key={t.id} aria-label={`Ir para a tela ${i+1} de ${total}`} aria-current={i===idx?'step':undefined} data-testid="apresentacao-indicador" onClick={()=>irPara(i)}><span className={i===idx?'current':''}/></button>)}</div><button type="button" disabled={ehUltimo} onClick={()=>passo(1)} aria-label="Próxima tela" data-testid="apresentacao-avancar"><ChevronRight size={22}/></button></div>
      {publico ? <div className="af-tour-actions"><button type="button" className="af-tour-primary" onClick={onComecar} data-testid="apresentacao-comecar">Começar agora <ArrowRight size={18}/></button><button type="button" className="af-tour-secondary" onClick={onEntrar} data-testid="apresentacao-entrar">Já tenho uma conta</button></div> : ehUltimo ? (rodapeCustom || <button type="button" className="af-tour-primary" onClick={()=>aoConcluir?.()}>Começar agora <ArrowRight size={18}/></button>) : <button type="button" className="af-tour-primary" onClick={()=>passo(1)}>Próximo <ChevronRight size={18}/></button>}
    </footer>
  </div>
}

const CSS = `
.af-tour{height:100vh;height:100dvh;min-height:0;display:flex;flex-direction:column;overflow:hidden;color:#fff;background:radial-gradient(ellipse at 78% 62%,#76102e 0%,transparent 46%),linear-gradient(145deg,#43091b,#20050d 72%);font-family:inherit;color-scheme:dark}
.af-tour *{box-sizing:border-box}.af-tour button{font:inherit;cursor:pointer}.af-tour button:focus-visible{outline:2px solid #fda4af;outline-offset:3px}.af-tour-header{flex:none;display:flex;align-items:center;justify-content:space-between;width:100%;max-width:1440px;margin:0 auto;padding: max(12px,env(safe-area-inset-top)) 5% 8px;min-height:60px}.af-tour-brand{display:flex;gap:10px;align-items:center;font-weight:700;font-size:14px}.af-tour-brand img{width:40px;height:40px;object-fit:contain;border-radius:10px}.af-tour-skip{border:0;background:transparent;color:#f4dce4;padding:12px}.af-tour-track{display:flex;flex:1;min-height:0;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain}.af-tour-track::-webkit-scrollbar{display:none}.af-tour-slide{flex:0 0 100%;width:100%;min-width:0;scroll-snap-align:center;scroll-snap-stop:always;overflow-y:auto;scrollbar-width:thin}.af-tour-layout{min-height:100%;max-width:1320px;margin:auto;padding:24px 5%;display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:clamp(24px,5vw,80px)}.af-tour-copy{min-width:0}.af-tour-kicker{font-size:12px;letter-spacing:.18em;color:#f7a9bf;font-weight:700}.af-tour h2{font-size:clamp(30px,4vw,61px);line-height:1.08;letter-spacing:-.035em;margin:14px 0;color:#fff;font-weight:800}.af-tour h2 span{color:#f58ba9;display:block}.af-tour-subtitle{font-size:clamp(15px,1.5vw,21px);line-height:1.5;color:#efd1db;margin:0 0 24px}.af-tour-benefits{display:grid;gap:16px}.af-tour-benefit{display:flex;align-items:center;gap:13px}.af-tour-icon{display:grid;place-items:center;width:48px;height:48px;flex:none;border-radius:14px;color:#fda4bf;background:linear-gradient(145deg,#a51b49aa,#3a071c);border:1px solid #ed71935c}.af-tour-benefit strong{font-size:16px;color:#fff}.af-tour-benefit p{margin:3px 0 0;font-size:13px;color:#e7bdca;line-height:1.4}.af-tour-figure{margin:0;min-width:0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}.af-tour-figure figcaption{font-size:11px;color:#e8b8c8}.af-tour-art{display:block;width:auto;max-width:100%;max-height:min(54vh,530px);object-fit:contain;border-radius:24px;box-shadow:0 18px 55px #15020a66}.af-tour-footer{flex:none;width:min(100%,530px);margin:0 auto;padding:4px 20px max(14px,env(safe-area-inset-bottom))}.af-tour-navigation{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.af-tour-navigation>button{display:grid;place-items:center;border:1px solid #f5b6ca55;background:#ffffff08;border-radius:50%;color:#fff;width:40px;height:40px}.af-tour-navigation>button:disabled{opacity:.25;cursor:default}.af-tour-dots{display:flex;align-items:center;gap:2px}.af-tour-dots button{background:none;border:0;padding:10px 5px;min-height:32px}.af-tour-dots span{display:block;border-radius:99px;background:#ffffff55;width:8px;height:8px}.af-tour-dots .current{width:24px;background:#fff}.af-tour-actions{display:grid;gap:8px}.af-tour-primary,.af-tour-secondary{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:47px;border-radius:16px;font-weight:700!important;color:#fff}.af-tour-primary{background:linear-gradient(120deg,#cb2356,#87082c);border:1px solid #f078a0;box-shadow:0 8px 24px #14020a55}.af-tour-secondary{background:#ffffff0d;border:1px solid #ffffff32}.af-tour-scene{position:relative;width:min(100%,510px);aspect-ratio:1.05;isolation:isolate;display:flex;align-items:center;justify-content:center}.af-tour-orbit{position:absolute;inset:18% 6% 7%;border-radius:50%;background:radial-gradient(ellipse,#e3316f38,transparent 70%)}.af-tour-phone{position:absolute;width:46%;height:88%;border-radius:12%/6%;padding:5% 3% 3%;border:3px solid #ae7c8f;background:linear-gradient(150deg,#3b0c1e,#210711);box-shadow:0 16px 30px #120007b3;display:flex;flex-direction:column;gap:3%;overflow:hidden;text-align:left;font-size:clamp(8px,1vw,13px)}.af-tour-phone-front{left:16%;top:3%;transform:rotate(-8deg);z-index:2}.af-tour-phone-back{right:5%;top:10%;transform:rotate(10deg);height:79%;z-index:1}.af-tour-phone-top{display:flex;justify-content:space-between;font-size:10px;color:#e9c7d2}.af-tour-phone-brand{display:flex;gap:5px;align-items:center;font-weight:700;font-size:.9em}.af-tour-phone-brand img{width:22px;height:22px;border-radius:5px}.af-tour-phone-label{font-size:1.15em;font-weight:700}.af-tour-balance{background:linear-gradient(135deg,#c51950,#820c2d);padding:9%;border-radius:12px;display:grid;gap:4px}.af-tour-balance strong{font-size:1.65em;white-space:nowrap}.af-tour-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.af-tour-mini{display:grid;gap:4px;background:#ffffff0e;border:1px solid #ffffff1d;border-radius:10px;padding:8%;font-size:.88em;min-width:0}.af-tour-mini strong{font-size:1.1em;white-space:nowrap}.af-tour-mini small,.af-tour-balance small{color:#f0c7d4;font-size:.85em}.af-tour-bar{height:5px;background:#ffffff20;border-radius:10px;overflow:hidden}.af-tour-bar i{height:100%;display:block;background:#61d99b;border-radius:10px}.af-tour-phone-nav{margin-top:auto;display:flex;justify-content:space-around;color:#f8a0bb}.af-tour-days{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}.af-tour-days span{padding:5px 0;text-align:center;border-radius:4px;background:#ffffff0d;font-size:.75em}.af-tour-days .marked{background:#b92b58}.af-tour-glow{position:absolute;z-index:-1;bottom:4%;left:4%;right:3%;height:13%;border:2px solid #ff91b4;border-radius:50%;box-shadow:0 0 24px #fa4481,inset 0 0 25px #fa4481}
@media(max-width:767px){.af-tour-header{padding-left:20px;padding-right:20px}.af-tour-layout{display:flex;flex-direction:column;justify-content:center;gap:16px;padding:10px 20px 18px}.af-tour-copy{text-align:center;width:100%}.af-tour h2{font-size:clamp(25px,7vw,38px);margin:8px 0}.af-tour-subtitle{font-size:14px;margin:0 auto;max-width:480px}.af-tour-benefits{display:none}.af-tour-figure{width:100%;gap:4px}.af-tour-art{max-height:38vh;max-height:38dvh;border-radius:15px}.af-tour-scene{width:min(100%,310px,38vh);width:min(100%,310px,38dvh)}.af-tour-phone{font-size:8px;gap:2%;border-width:2px}.af-tour-phone-brand img{width:15px;height:15px}.af-tour-phone-nav svg{width:13px;height:13px}.af-tour-mini{padding:5%}.af-tour-balance{padding:6%}.af-tour-footer{padding-top:0}.af-tour-primary,.af-tour-secondary{min-height:44px}}
@media(prefers-reduced-motion:reduce){.af-tour *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
`
