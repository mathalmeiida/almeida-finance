import React, { useEffect, useState } from 'react'

/**
 * Almeida Finance — onboarding responsivo e independente.
 * Uso: <OnboardingAlmeidaFinance onComplete={async (dados) => { ...salvar no Supabase... }} />
 * ATENÇÃO: onComplete precisa persistir os dados no backend do app.
 * Este componente só guarda um rascunho local durante o preenchimento.
 */
const STORAGE_KEY = 'almeida-finance-onboarding-draft-v2'
const INITIAL = {
  nome: '', objetivo: 'organizar', tipoRenda: 'fixa', receitas: [],
  contas: [], saldoAvulso: '', temInvestimentos: null, investimentosTotal: '',
  temCartao: null, cartoes: [], despesas: [], metas: [],
  tema: 'roxo', ocultarValores: false, lembretes: true,
}
const OBJETIVOS = [
  ['organizar', 'Organizar minhas finanças'], ['dividas', 'Quitar dívidas'],
  ['investir', 'Investir e construir patrimônio'], ['imovel', 'Comprar um imóvel'],
  ['viagem', 'Planejar uma viagem'], ['outro', 'Outro objetivo'],
]
const METAS = [
  ['reserva', '🛡️ Reserva de emergência'], ['imovel', '🏠 Comprar um imóvel'],
  ['investir', '📈 Aumentar investimentos'], ['carro', '🚙 Comprar um carro'],
  ['viagem', '✈️ Fazer uma viagem'], ['outro', '🎯 Outro objetivo'],
]
const CORES = { roxo: '#6d28d9', azul: '#2563eb', rosa: '#db2777', verde: '#16a34a', laranja: '#ea580c', preto: '#18181b' }
const hojeISO = () => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0,10) }
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '')
const formatarEntrada = (v) => {
  const digits = soDigitos(v).slice(0, 13)
  if (!digits) return ''
  return (Number(digits) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const numero = (valor) => Number(soDigitos(valor)) / 100 || 0
const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
function InputDinheiro({ label, value, onChange, placeholder = '0,00', hint }) {
  return <label className="af-field"><span>{label}</span><div className="af-money"><span>R$</span><input inputMode="numeric" placeholder={placeholder} value={value} onChange={e => onChange(formatarEntrada(e.target.value))} /></div>{hint && <small>{hint}</small>}</label>
}
function Campo({ label, value, onChange, placeholder = '', type = 'text', ...props }) {
  return <label className="af-field"><span>{label}</span><input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} {...props} /></label>
}
function Opcao({ active, onClick, children }) {
  return <button type="button" className={`af-option ${active ? 'selected' : ''}`} onClick={onClick}>{children}{active && <span className="af-check">✓</span>}</button>
}
function NovoItem({ onAdd, kind }) {
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [frequencia, setFrequencia] = useState('mensal')
  const [fechamento, setFechamento] = useState('20')
  const [vencimento, setVencimento] = useState('1')
  const titulo = { receita: 'receita', conta: 'conta', cartao: 'cartão', despesa: 'despesa' }[kind]
  const adicionar = () => {
    if (!nome.trim() || (kind !== 'cartao' && !valor)) return
    onAdd({ id: id(), nome: nome.trim(), valor: numero(valor), ...(kind === 'cartao' ? { fechamento: Number(fechamento), vencimento: Number(vencimento) } : {}), ...(kind === 'receita' || kind === 'despesa' ? { frequencia, data: data || hojeISO() } : {}) })
    setNome(''); setValor(''); setData(''); setAberto(false)
  }
  return <div className="af-newitem">
    {!aberto ? <button className="af-add" type="button" onClick={() => setAberto(true)}>＋ Adicionar {titulo}</button> : <div className="af-editor">
      <Campo label={`Nome ${kind === 'conta' ? 'da conta' : kind === 'receita' ? 'da receita' : kind === 'despesa' ? 'da despesa' : 'do cartão'}`} value={nome} onChange={setNome} placeholder={kind === 'receita' ? 'Ex.: Salário' : kind === 'despesa' ? 'Ex.: Aluguel' : kind === 'cartao' ? 'Ex.: Visa Infinite' : 'Ex.: Conta principal'} />
      {kind !== 'cartao' && <InputDinheiro label={kind === 'conta' ? 'Saldo desta conta' : kind === 'receita' ? 'Valor recebido' : 'Valor da despesa'} value={valor} onChange={setValor} />}
      {(kind === 'receita' || kind === 'despesa') && <><label className="af-field"><span>Frequência</span><select value={frequencia} onChange={e => setFrequencia(e.target.value)}><option value="mensal">Mensal</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="a_cada_10_dias">A cada 10 dias</option><option value="a_cada_20_dias">A cada 20 dias</option><option value="unica">Uma vez</option></select></label><Campo label={kind === 'receita' ? 'Data do próximo recebimento' : 'Próximo vencimento'} type="date" value={data} onChange={setData} /></>}
      {kind === 'cartao' && <div className="af-two"><Campo label="Dia do fechamento" type="number" min="1" max="31" value={fechamento} onChange={setFechamento}/><Campo label="Dia do vencimento" type="number" min="1" max="31" value={vencimento} onChange={setVencimento}/></div>}
      <div className="af-actions"><button type="button" className="af-secondary" onClick={() => setAberto(false)}>Cancelar</button><button type="button" className="af-primary" disabled={!nome.trim() || (kind !== 'cartao' && !valor) || (kind === 'cartao' && (![fechamento, vencimento].every(x => Number(x)>=1 && Number(x)<=31)))} onClick={adicionar}>Salvar</button></div>
    </div>}
  </div>
}
function Lista({ items, onRemove, kind }) {
  return items.length ? <div className="af-items">{items.map(item => <div className="af-item" key={item.id}><div><strong>{item.nome}</strong><small>{kind === 'cartao' ? `Fecha dia ${item.fechamento} · Vence dia ${item.vencimento}` : moeda(item.valor)}{item.frequencia ? ` · ${item.frequencia.replaceAll('_', ' ')}` : ''}</small></div><button type="button" aria-label={`Remover ${item.nome}`} className="af-trash" onClick={() => onRemove(item.id)}>✕</button></div>)}</div> : null
}
export default function OnboardingAlmeidaFinance({ onComplete, initialData, onCancel }) {
  const [passo, setPasso] = useState(0)
  const [dados, setDados] = useState(() => {
    try { const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return { ...INITIAL, ...(salvo && typeof salvo === 'object' ? salvo : {}), ...(initialData || {}) } }
    catch { return { ...INITIAL, ...(initialData || {}) } }
  })
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const cor = CORES[dados.tema] || CORES.roxo
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)) } catch {} }, [dados])
  const alterar = (campo, valor) => { setDados(d => ({ ...d, [campo]: valor })); setErro('') }
  const adicionar = (campo, item) => alterar(campo, [...dados[campo], item])
  const remover = (campo, itemId) => alterar(campo, dados[campo].filter(item => item.id !== itemId))
  const avancar = () => {
    if (passo === 1 && !dados.nome.trim()) { setErro('Informe seu nome para continuar.'); return }
    if (passo === 3 && dados.contas.length === 0 && !dados.saldoAvulso) { setErro('Informe seu saldo ou adicione uma conta. Você pode informar zero.'); return }
    if (passo === 4 && dados.temInvestimentos === true && !dados.investimentosTotal) { setErro('Informe seu total investido ou escolha Não.'); return }
    setErro(''); setPasso(p => Math.min(9, p + 1))
  }
  const finalizar = async () => {
    if (salvando) return
    if (typeof onComplete !== 'function') { setErro('A integração de salvamento ainda não foi configurada. Conecte a função onComplete ao Supabase antes de publicar.'); return }
    const saldoContas = dados.contas.reduce((s, c) => s + Number(c.valor || 0), 0)
    const payload = {
      nome: dados.nome.trim(), objetivo: dados.objetivo, tipoRenda: dados.tipoRenda,
      receitas: dados.receitas, contas: dados.contas,
      saldoDisponivel: dados.contas.length ? saldoContas : numero(dados.saldoAvulso),
      temInvestimentos: dados.temInvestimentos === true,
      investimentosTotal: dados.temInvestimentos ? numero(dados.investimentosTotal) : 0,
      cartoes: dados.cartoes, despesas: dados.despesas, metas: dados.metas,
      tema: dados.tema, ocultarValores: dados.ocultarValores, lembretes: dados.lembretes,
      dataReferencia: hojeISO(),
    }
    setSalvando(true); setErro('')
    try {
      await onComplete(payload)
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
    } catch (e) { setErro(e?.message || 'Não foi possível salvar. Tente novamente.') }
    finally { setSalvando(false) }
  }
  const titulos = ['Boas-vindas', 'Seu perfil', 'Suas receitas', 'Saldo nas contas', 'Investimentos', 'Cartões de crédito', 'Despesas', 'Metas', 'Preferências', 'Resumo financeiro']
  const saldo = dados.contas.length ? dados.contas.reduce((s, c) => s + Number(c.valor || 0), 0) : numero(dados.saldoAvulso)
  const invest = dados.temInvestimentos ? numero(dados.investimentosTotal) : 0
  return <div className="af-onboarding" style={{ '--af-main': cor }}>
    <style>{CSS}</style>
    <main className="af-shell">
      {passo > 0 && <div className="af-top"><button type="button" className="af-back" onClick={() => setPasso(p => p - 1)} aria-label="Voltar">←</button><div className="af-progress"><span style={{ width: `${(passo + 1) * 10}%` }} /></div><span>{passo + 1}/10</span></div>}
      {passo === 0 && <section className="af-welcome"><div className="af-logo">▥ <span>Almeida<br/>Finance</span></div><div className="af-hero-icon">◉<span>↗</span></div><h1>Organize sua vida financeira em um só lugar</h1><p>Controle suas contas, acompanhe seus investimentos e planeje seu futuro com clareza.</p><div className="af-benefits"><div>💳 &nbsp; Controle seus gastos</div><div>📈 &nbsp; Planeje seu futuro</div><div>🎯 &nbsp; Alcance seus objetivos</div></div></section>}
      {passo === 1 && <section><div className="af-symbol">👤</div><h1>Vamos conhecer você</h1><p>Personalize sua experiência com algumas informações rápidas.</p><Campo label="Como podemos chamar você?" value={dados.nome} onChange={v => alterar('nome', v)} placeholder="Seu nome" maxLength={80}/><h3>Qual é seu principal objetivo?</h3><div className="af-options">{OBJETIVOS.map(([v,t]) => <Opcao key={v} active={dados.objetivo === v} onClick={() => alterar('objetivo', v)}>{t}</Opcao>)}</div></section>}
      {passo === 2 && <section><div className="af-symbol">💵</div><h1>Como entra dinheiro para você?</h1><p>Cadastre receitas e datas para criar projeções mais confiáveis.</p><div className="af-two"><Opcao active={dados.tipoRenda === 'fixa'} onClick={() => alterar('tipoRenda', 'fixa')}>Renda fixa</Opcao><Opcao active={dados.tipoRenda === 'variavel'} onClick={() => alterar('tipoRenda', 'variavel')}>Renda variável</Opcao></div><h3>Suas fontes de renda</h3><Lista items={dados.receitas} kind="receita" onRemove={v => remover('receitas', v)}/><NovoItem kind="receita" onAdd={item => adicionar('receitas', item)}/><div className="af-note">Você poderá editar e adicionar receitas depois.</div></section>}
      {passo === 3 && <section><div className="af-symbol">👛</div><h1>Qual é o saldo disponível nas suas contas?</h1><p>Informe o dinheiro disponível em bancos e carteiras digitais hoje.</p><div className="af-note"><b>Não inclua</b> investimentos, reserva aplicada ou limite do cartão de crédito.</div><h3>Suas contas (opcional)</h3><Lista items={dados.contas} kind="conta" onRemove={v => remover('contas', v)}/><NovoItem kind="conta" onAdd={item => adicionar('contas', item)}/>{dados.contas.length === 0 && <InputDinheiro label="Ou informe apenas o saldo total disponível" value={dados.saldoAvulso} onChange={v => alterar('saldoAvulso', v)} hint="Digite 0,00 se não houver saldo."/>}<div className="af-summary">Saldo disponível <strong>{moeda(saldo)}</strong></div></section>}
      {passo === 4 && <section><div className="af-symbol">📈</div><h1>Você já tem dinheiro investido?</h1><p>Inclua investimentos e reserva de emergência aplicada para acompanhar seu patrimônio.</p><div className="af-two"><Opcao active={dados.temInvestimentos === true} onClick={() => alterar('temInvestimentos', true)}>Sim, tenho</Opcao><Opcao active={dados.temInvestimentos === false} onClick={() => { alterar('temInvestimentos', false) }}>Ainda não</Opcao></div>{dados.temInvestimentos === true && <InputDinheiro label="Valor total investido" value={dados.investimentosTotal} onChange={v => alterar('investimentosTotal', v)} hint="Inclua CDB, Tesouro Direto, fundos, ações, FIIs e reserva aplicada. Não some a mesma quantia em mais de um lugar."/>}<div className="af-note">Esse valor entra no patrimônio, mas <b>não</b> no saldo disponível para gastos. Você poderá detalhar cada investimento depois.</div></section>}
      {passo === 5 && <section><div className="af-symbol">💳</div><h1>Você utiliza cartões de crédito?</h1><p>Cadastre os cartões para organizar os próximos vencimentos e faturas.</p><div className="af-two"><Opcao active={dados.temCartao === true} onClick={() => alterar('temCartao', true)}>Sim</Opcao><Opcao active={dados.temCartao === false} onClick={() => alterar('temCartao', false)}>Não</Opcao></div>{dados.temCartao === true && <><h3>Seus cartões</h3><Lista items={dados.cartoes} kind="cartao" onRemove={v => remover('cartoes', v)}/><NovoItem kind="cartao" onAdd={item => adicionar('cartoes', item)}/><div className="af-note">Compras e faturas podem ser cadastradas posteriormente. Não desconte a fatura duas vezes.</div></>}</section>}
      {passo === 6 && <section><div className="af-symbol">📅</div><h1>Quais são seus gastos recorrentes?</h1><p>Informe os principais compromissos para montar seu calendário financeiro.</p><Lista items={dados.despesas} kind="despesa" onRemove={v => remover('despesas', v)}/><NovoItem kind="despesa" onAdd={item => adicionar('despesas', item)}/><div className="af-note">Parcelamentos e benefícios VR/VA podem ser configurados no app depois, evitando um cadastro inicial muito longo.</div></section>}
      {passo === 7 && <section><div className="af-symbol">🎯</div><h1>Quais são seus objetivos financeiros?</h1><p>Escolha os que fazem sentido para você. Valores e prazos poderão ser definidos depois.</p><div className="af-options">{METAS.map(([v,t]) => <Opcao key={v} active={dados.metas.includes(v)} onClick={() => alterar('metas', dados.metas.includes(v) ? dados.metas.filter(x => x !== v) : [...dados.metas, v])}>{t}</Opcao>)}</div></section>}
      {passo === 8 && <section><div className="af-symbol">🎨</div><h1>Personalize sua experiência</h1><p>Escolha como o Almeida Finance vai aparecer para você.</p><h3>Cor do aplicativo</h3><div className="af-colors">{Object.entries(CORES).map(([nome,valor]) => <button type="button" key={nome} onClick={() => alterar('tema', nome)} className={dados.tema === nome ? 'active' : ''} style={{ background: valor }} title={nome} aria-label={`Tema ${nome}`}>{dados.tema === nome ? '✓' : ''}</button>)}</div><div className="af-toggle"><span><b>Ocultar valores</b><small>Esconder valores na tela inicial</small></span><input type="checkbox" checked={dados.ocultarValores} onChange={e => alterar('ocultarValores', e.target.checked)}/></div><div className="af-toggle"><span><b>Lembretes</b><small>Preferência para notificações futuras</small></span><input type="checkbox" checked={dados.lembretes} onChange={e => alterar('lembretes', e.target.checked)}/></div><div className="af-note">A preferência de lembretes não ativa notificações por si só; depende da configuração do aplicativo.</div></section>}
      {passo === 9 && <section><div className="af-symbol af-done">✓</div><h1>Tudo pronto, {dados.nome.trim().split(' ')[0] || 'você'}!</h1><p>Revise os dados antes de começar. Você poderá ajustá-los depois.</p><div className="af-recap"><div><span>💵 Receitas cadastradas</span><strong>{dados.receitas.length}</strong></div><div><span>👛 Saldo disponível</span><strong>{moeda(saldo)}</strong></div><div><span>📈 Investimentos</span><strong>{moeda(invest)}</strong></div><div><span>💎 Patrimônio financeiro</span><strong>{moeda(saldo + invest)}</strong></div><div><span>💳 Cartões</span><strong>{dados.cartoes.length}</strong></div><div><span>📅 Despesas recorrentes</span><strong>{dados.despesas.length}</strong></div><div><span>🎯 Metas selecionadas</span><strong>{dados.metas.length}</strong></div></div><div className="af-note">O saldo inicial e o total investido são posições patrimoniais, não novas receitas. O app deverá evitar duplicidade com registros já existentes.</div></section>}
      {erro && <div className="af-error" role="alert">{erro}</div>}
      <footer className="af-footer">{passo > 0 && <button type="button" className="af-secondary" onClick={() => setPasso(p => p - 1)} disabled={salvando}>Voltar</button>}{passo === 0 ? <button type="button" className="af-primary" onClick={avancar}>Começar →</button> : passo === 9 ? <button type="button" className="af-primary" onClick={finalizar} disabled={salvando}>{salvando ? 'Salvando...' : 'Acessar meu painel →'}</button> : <button type="button" className="af-primary" onClick={avancar}>Continuar →</button>}{onCancel && passo === 0 && <button className="af-link" type="button" onClick={onCancel}>Cancelar</button>}</footer>
      {passo > 0 && passo < 9 && <p className="af-subfooter">Você pode deixar as informações opcionais para depois.</p>}
    </main><div className="af-brand">Almeida Finance</div>
  </div>
}
const CSS = `
.af-onboarding{min-height:100dvh;box-sizing:border-box;background:#f6f7fb;color:#141b2b;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px 14px 35px}.af-onboarding *{box-sizing:border-box}.af-shell{background:#fff;border:1px solid #e9ebf2;max-width:470px;min-height:590px;margin:0 auto;border-radius:22px;box-shadow:0 8px 30px #202b4720;padding:24px;display:flex;flex-direction:column}.af-top{display:flex;gap:14px;align-items:center;margin-bottom:29px;font-size:12px;color:#64748b}.af-back{border:0;background:transparent;font-size:25px;cursor:pointer;color:#64748b;padding:0}.af-progress{height:6px;background:#e8eaf1;flex:1;border-radius:99px;overflow:hidden}.af-progress span{height:100%;display:block;background:var(--af-main);border-radius:99px;transition:width .3s}.af-shell section{flex:1}.af-shell h1{font-size:23px;line-height:1.21;letter-spacing:-.55px;margin:12px 0 9px}.af-shell h3{font-size:14px;margin:22px 0 10px}.af-shell p{font-size:13px;color:#667085;line-height:1.55;margin:0 0 20px}.af-symbol{width:52px;height:52px;display:grid;place-items:center;border-radius:17px;background:color-mix(in srgb,var(--af-main) 10%,white);font-size:25px;margin-bottom:14px}.af-done{border-radius:50%;background:var(--af-main);color:#fff;font-size:28px;margin:5px auto 20px}.af-done+h1{text-align:center}.af-done+h1+p{text-align:center}.af-field{display:flex;flex-direction:column;gap:7px;margin:13px 0;font-size:13px;color:#263247;font-weight:600}.af-field input,.af-field select{outline:0;border:1px solid #dce0e9;border-radius:11px;width:100%;height:46px;font-size:15px;padding:10px 12px;background:#fff;color:#1d2738;font-weight:500}.af-field input:focus,.af-field select:focus{border-color:var(--af-main);box-shadow:0 0 0 3px color-mix(in srgb,var(--af-main) 13%,white)}.af-field small{font-size:11px;color:#728094;line-height:1.5;font-weight:400}.af-money{display:flex;align-items:center;border:1px solid #dce0e9;border-radius:11px;overflow:hidden}.af-money>span{padding-left:14px;color:#64748b}.af-money input{border:0;box-shadow:none!important}.af-options{display:grid;gap:8px}.af-option{border:1px solid #e0e4ed;border-radius:12px;padding:13px 14px;min-height:48px;background:#fff;color:#18243a;text-align:left;font-size:13px;font-weight:600;cursor:pointer;position:relative}.af-option.selected{border-color:var(--af-main);background:color-mix(in srgb,var(--af-main) 5%,white);color:var(--af-main)}.af-check{position:absolute;right:13px;font-weight:800}.af-two{display:grid;grid-template-columns:1fr 1fr;gap:9px}.af-two .af-option{text-align:center;padding:13px 8px}.af-note{background:#f0f5ff;color:#425b80;font-size:12px;line-height:1.55;padding:12px 13px;border-radius:12px;margin:15px 0}.af-summary{padding:16px;margin-top:18px;background:#f6f4ff;border-radius:13px;display:flex;justify-content:space-between;gap:10px;font-size:12px}.af-summary strong{font-size:17px;color:var(--af-main)}.af-add{border:0;border-radius:11px;background:color-mix(in srgb,var(--af-main) 10%,white);color:var(--af-main);font-weight:700;padding:13px;width:100%;cursor:pointer}.af-items{display:grid;gap:8px;margin-bottom:10px}.af-item{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:12px;border:1px solid #e9eaf0;border-radius:11px}.af-item strong{display:block;font-size:13px}.af-item small{display:block;font-size:11px;color:#667085;margin-top:4px}.af-trash{border:0;background:#f7f7fa;border-radius:8px;color:#697487;cursor:pointer;padding:8px 10px}.af-editor{border:1px solid #e7e2f5;border-radius:14px;padding:12px;background:#fcfbff}.af-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.af-primary,.af-secondary{border:0;border-radius:11px;padding:13px 16px;cursor:pointer;font-size:13px;font-weight:700}.af-primary{background:var(--af-main);color:white;flex:1}.af-primary:disabled{opacity:.5;cursor:not-allowed}.af-secondary{background:#f0f1f7;color:#344054;flex:0 1 35%}.af-footer{display:flex;gap:10px;margin-top:22px}.af-welcome{background:linear-gradient(155deg,var(--af-main) 0%,#41219b 68%,#7c3aed 100%);margin:-24px -24px 0;padding:30px 24px;border-radius:21px 21px 0 0;color:#fff}.af-welcome h1{font-size:30px;line-height:1.12;margin-top:45px}.af-welcome p{color:#e5dcff}.af-logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:29px}.af-logo span{font-size:15px;line-height:1.1}.af-hero-icon{font-size:46px;text-align:center;padding:15px 0 0}.af-hero-icon span{color:#f6a3fa}.af-benefits{display:grid;gap:14px;margin-top:35px;background:#ffffffef;color:#242b40;border-radius:17px;padding:17px;font-size:13px;font-weight:600}.af-colors{display:flex;flex-wrap:wrap;gap:12px;margin:15px 0 28px}.af-colors button{height:34px;width:34px;border:2px solid white;outline:2px solid transparent;border-radius:50%;color:#fff;font-weight:900;cursor:pointer}.af-colors button.active{outline-color:var(--af-main)}.af-toggle{display:flex;align-items:center;justify-content:space-between;padding:15px 0;border-bottom:1px solid #edf0f4;gap:10px}.af-toggle span{display:flex;flex-direction:column;gap:5px;font-size:13px}.af-toggle small{font-size:11px;color:#738095}.af-toggle input{width:19px;height:19px;accent-color:var(--af-main)}.af-recap{border:1px solid #e7eaf0;border-radius:14px;overflow:hidden}.af-recap>div{display:flex;justify-content:space-between;align-items:center;gap:9px;padding:13px;border-bottom:1px solid #edf0f4;font-size:12px}.af-recap>div:last-child{border:0}.af-recap strong{text-align:right;white-space:nowrap}.af-error{font-size:12px;color:#a32135;background:#fff0f2;padding:11px;border-radius:9px;margin-top:10px}.af-subfooter{text-align:center!important;margin:12px 0 0!important;font-size:11px!important}.af-brand{text-align:center;color:#8d98aa;font-size:12px;margin-top:15px}.af-link{border:0;background:transparent;color:#687386;text-decoration:underline;cursor:pointer}@media(max-width:420px){.af-onboarding{padding:8px 6px 20px}.af-shell{padding:18px 16px;min-height:calc(100dvh - 38px);border-radius:16px}.af-shell h1{font-size:21px}.af-welcome{margin:-18px -16px 0;padding:25px 18px}.af-shell .af-footer{padding-bottom:max(3px,env(safe-area-inset-bottom))}.af-recap>div{font-size:11px}}`
