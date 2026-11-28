import React, { useState } from 'react'
import { Check, Users, MessageCircle, Sparkles, ChevronRight, Building2, Lock, ShieldCheck, Crown, UserRound, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import './PlanosAcessos.css'

const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const planos = [
  { id: 'premium', nome: 'Almeida Premium', mensal: 29.90, anual: 299, Icone: UserRound, descricao: 'Organize sua vida financeira em um só lugar.', recursos: ['Gestão financeira pessoal completa', 'Calendário financeiro', 'Receitas, despesas e cartões', 'Investimentos, metas e parcelamentos', 'Simuladores e central de importação', 'Almeida Família: titular + 1 membro', 'WhatsApp: até 100 respostas/mês¹'] },
  { id: 'plus', nome: 'Almeida Plus', mensal: 49.90, anual: 499, Icone: Crown, destaque: true, descricao: 'Mais capacidade para você e sua família.', recursos: ['Tudo do Premium', 'Almeida Família: até 5 pessoas no total', 'WhatsApp: até 300 respostas/mês¹', 'Automações financeiras avançadas¹', 'Relatórios avançados¹', 'Suporte prioritário¹'] },
  { id: 'empresas', nome: 'Almeida Empresas', mensal: 79.90, anual: 799, Icone: Building2, emBreve: true, descricao: 'Ambiente independente para a gestão do seu negócio.', recursos: ['Até 5 usuários no total, incluindo titular', 'Administrador, gestor e colaborador', 'Fluxo de caixa e faturamento¹', 'Contas a pagar e receber¹', 'Lucro, prejuízo e pró-labore¹', 'Relatórios empresariais¹'] },
]

export default function Planos() {
  const { perfil, somenteLeitura } = useAuth()
  const navigate = useNavigate()
  const [anual, setAnual] = useState(false)
  const atual = perfil?.subscription_plan
  return (
    <div className="af-comercial max-w-7xl mx-auto space-y-7 pb-mobilenav md:pb-8">
      <header className="af-comercial-header">
        <span className="af-comercial-icon"><Sparkles size={25} /></span>
        <h1>Planos Almeida Finance</h1>
        <p>Escolha como organizar suas finanças pessoais, familiares ou empresariais.</p>
      </header>
      <div className="af-comercial-toggle" role="group" aria-label="Periodicidade dos preços">
        <button type="button" aria-pressed={!anual} onClick={() => setAnual(false)}>Mensal</button>
        <button type="button" aria-pressed={anual} onClick={() => setAnual(true)}>Anual <small>~17% menos</small></button>
      </div>
      <div className="af-comercial-notice" role="status"><Sparkles size={22} className="shrink-0" /><div><strong>Prévia dos planos de assinatura</strong><p>O teste de 7 dias sem cartão está previsto para o lançamento. A contratação e a cobrança ainda não estão habilitadas.</p></div></div>
      <div className="af-comercial-grid">
        {planos.map(p => <article key={p.id} className={`af-comercial-plan ${p.destaque ? 'is-featured' : ''} ${p.emBreve ? 'is-future' : ''}`}>
          <div className="af-comercial-ribbon">{p.destaque ? <><Crown size={15}/> Mais recomendado</> : p.emBreve ? <><Lock size={14}/> Em desenvolvimento</> : 'Para você'}</div>
          <div className="af-comercial-plan-head">
            <span className="af-comercial-icon"><p.Icone size={23}/></span>
            <h2>{p.nome}</h2><p>{p.descricao}</p>
            <div className="af-comercial-price"><strong>{moeda(anual ? p.anual : p.mensal)}</strong><span>/{anual ? 'ano' : 'mês'}</span></div>
            <div className="af-comercial-saving">{anual ? `Economia de ${moeda(Math.round((p.mensal * 12 - p.anual) * 100) / 100)} por ano` : 'Preço mensal previsto'}</div>
          </div>
          <ul>{p.recursos.map(r => <li key={r}><Check size={17} className="shrink-0"/><span>{r}</span></li>)}</ul>
          <div className="af-comercial-plan-foot"><button type="button" disabled className="af-comercial-cta">{p.emBreve ? 'Em breve' : atual === p.id ? 'Plano atual' : 'Contratação em breve'} <Lock size={15}/></button></div>
        </article>)}
      </div>
      <p className="af-comercial-footnote">¹ Recursos previstos, sujeitos à implementação e à liberação. As franquias do WhatsApp ainda não estão disponíveis para contratação. Os preços anuais são uma prévia, não uma cobrança ativa.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <article className="af-acesso-card"><div className="af-acesso-title"><span className="af-comercial-icon"><Users size={24}/></span><div><h2>Almeida Família</h2><p>Contas individuais, objetivos em conjunto.</p></div></div><p>Cada pessoa entra com seu próprio e-mail. O titular convida familiares e os dados pessoais não são incluídos automaticamente no grupo.</p><button type="button" className="af-acesso-link" onClick={() => navigate('/acessos?aba=familia')} disabled={somenteLeitura}>Conhecer e gerenciar acessos <ArrowRight size={16}/></button></article>
        <article className="af-acesso-card"><div className="af-acesso-title"><span className="af-comercial-icon"><Building2 size={24}/></span><div><h2>Almeida Empresas</h2><p>Equipe com permissões independentes.</p></div></div><p>O ambiente empresarial terá usuários próprios, sem misturar finanças pessoais. O cadastro empresarial fica restrito ao piloto autorizado.</p><button type="button" className="af-acesso-link" onClick={() => navigate('/acessos?aba=empresas')} disabled={somenteLeitura}>Conhecer o ambiente <ArrowRight size={16}/></button></article>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[{Icone: ShieldCheck,t:'Privacidade por ambiente',d:'Compartilhe apenas o que pertence ao grupo.'},{Icone: Users,t:'Login individual',d:'Não é necessário compartilhar sua senha.'},{Icone: MessageCircle,t:'Canal de suporte',d:'Ajuda pelo menu Mais.'}].map(({Icone,t,d}) => <div className="af-comercial-trust" key={t}><Icone size={22}/><div><strong>{t}</strong><p>{d}</p></div></div>)}
      </div>
      <article className="af-acesso-card"><div className="af-acesso-title"><span className="af-comercial-icon"><MessageCircle size={23}/></span><div><h2>Consultoria Almeida</h2><p>Serviço profissional contratado separadamente.</p></div></div><button type="button" className="af-acesso-link" onClick={() => navigate('/consultoria')}>Saiba mais <ChevronRight size={16}/></button></article>
      <section className="max-w-3xl mx-auto space-y-3"><h2 className="text-xl font-bold text-gray-900">Perguntas frequentes</h2>{[
        ['Como funciona a assinatura?','Os preços mensal e anual são propostas comerciais. A cobrança ainda está desabilitada.'],
        ['Os membros precisam pagar outra assinatura?','Não para participar do grupo convidado. A capacidade do grupo depende do plano do titular. A gestão pessoal de cada membro segue seu próprio plano.'],
        ['Meus dados pessoais são compartilhados?','A proposta separa a conta pessoal dos grupos familiares e empresariais. Saldo pessoal, cartões e investimentos não devem ser copiados para o grupo.'],
        ['Como funciona o acesso empresarial?','O piloto permite gerenciar empresas, membros e convites autorizados. Os módulos financeiros empresariais ainda estão em desenvolvimento.'],
        ['A consultoria está incluída?','Não. A consultoria tem contratação e preço próprios.'],
      ].map(([q,a]) => <details className="af-acesso-card" key={q}><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-3">{a}</p></details>)}</section>
    </div>
  )
}
