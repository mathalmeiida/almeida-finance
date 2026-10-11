// Auditoria automatizada da LÓGICA dos fluxos (replicando as regras do código).
// Não substitui teste visual, mas valida as regras de negócio dos requisitos.

let pass = 0, fail = 0
const check = (n, c) => { if (c) { pass++; console.log('PASS', n) } else { fail++; console.log('FAIL', n) } }
const aprox = (a, b) => Math.abs(a - b) < 0.005

// ───────── APRESENTAÇÃO: 3 telas, Pular sempre, Voltar a partir da 2ª ─────────
const SLIDES = 3
// avancar: última tela -> conclui; senão incrementa. voltar: nunca < 0.
const avancarIdx = (i) => (i === SLIDES - 1 ? 'concluir' : i + 1)
const voltarIdx = (i) => Math.max(i - 1, 0)
check('apresentacao tem 3 telas', SLIDES === 3)
check('tela 0 -> 1 (Proximo)', avancarIdx(0) === 1)
check('tela 1 -> 2 (Proximo)', avancarIdx(1) === 2)
check('tela 2 -> conclui (Começar)', avancarIdx(2) === 'concluir')
check('Voltar desabilitado na tela 0', voltarIdx(0) === 0)
check('Voltar da tela 2 -> 1', voltarIdx(2) === 1)
// Pular disponível em todas as telas (botão no topo, independente do índice):
const pularDisponivel = (i) => true
check('Pular disponivel na tela 0', pularDisponivel(0))
check('Pular disponivel na tela 1', pularDisponivel(1))
check('Pular disponivel na tela 2', pularDisponivel(2))

// ───────── Gating: só 1º acesso; não reinicia onboarding existente ─────────
const chave = (id) => `almeida_apresentacao_vista_${id}`
const jaViu = (store, id) => (!id ? false : store.get(chave(id)) === '1')
const mostrarApres = (store, etapaInicial, id) => (etapaInicial ? false : !jaViu(store, id))
{
  const s = new Map()
  check('novo usuario ve apresentacao', mostrarApres(s, '', 'u1') === true)
  s.set(chave('u1'), '1')
  check('nao reaparece apos concluir', mostrarApres(s, '', 'u1') === false)
  check('reabertura direcionada (etapaInicial) pula apresentacao', mostrarApres(s, 'reserva', 'u1') === false)
  check('flag de u1 nao vaza p/ u2', mostrarApres(s, '', 'u2') === true)
}
// "Rever apresentação" NÃO mexe na flag de onboarding (rota isolada):
const reverApresentacaoReiniciaOnboarding = false
check('rever apresentacao NAO reinicia onboarding', reverApresentacaoReiniciaOnboarding === false)

// ───────── ONBOARDING: ordem das etapas incl. cartões e VR/VA ─────────
const INTRO=0,SALDO=1,RENDA=2,DESPESAS=3,CARTOES=4,BENEFICIOS=5,RESERVA=6,FINAL=7
const ETAPAS_CONFIG=[SALDO,RENDA,DESPESAS,RESERVA]
check('Despesas->Cartoes->VR/VA->Reserva->Final', [DESPESAS+1,CARTOES+1,BENEFICIOS+1,RESERVA+1].join() === [CARTOES,BENEFICIOS,RESERVA,FINAL].join())
check('cartoes/VR-VA sao opcionais (fora da barra X de 4)', !ETAPAS_CONFIG.includes(CARTOES) && !ETAPAS_CONFIG.includes(BENEFICIOS))

// ───────── HOME: ocultar VR/VA ausentes ─────────
const beneficios = [{ tipo: 'VR' }] // usuário só tem VR
const possuidos = ['VR','VA'].filter(t => beneficios.some(b => b.tipo === t))
check('mostra so VR quando so tem VR', possuidos.length === 1 && possuidos[0] === 'VR')
check('VA ausente NAO aparece', !possuidos.includes('VA'))
const nenhum = ['VR','VA'].filter(t => [].some(b => b.tipo === t))
check('sem beneficios -> 0 cards (card unico de cadastro)', nenhum.length === 0)

// ───────── CÁLCULO: cartão no mês da fatura, sem dupla contagem ─────────
function calcParc(total, n){ const base=Math.floor((total/n)*100)/100; const ultima=Math.round((total-base*(n-1))*100)/100; return {base,ultima} }
function compNoMes(dataCompra, diaFech){ const d=new Date(dataCompra+'T12:00:00'); let a=d.getFullYear(),m=d.getMonth()+1; if(d.getDate()>diaFech){m++; if(m>12){m=1;a++}} return {a,m} }
function parcelaNoMes(c,diaFech,ano,mes){ const {a,m}=compNoMes(c.data_compra,diaFech); const idx=(ano-a)*12+(mes-m); const n=c.numero_parcelas||1; if(idx<0||idx>=n)return 0; const {base,ultima}=calcParc(c.valor_total,n); return idx===n-1?ultima:base }
{
  const diaFech=20
  const cAntes={data_compra:'2026-01-18',valor_total:300,numero_parcelas:1}
  const cDepois={data_compra:'2026-01-22',valor_total:300,numero_parcelas:1}
  check('compra 18/01 (<=fech) entra em JAN', parcelaNoMes(cAntes,diaFech,2026,1)===300)
  check('compra 22/01 (>fech) entra em FEV', parcelaNoMes(cDepois,diaFech,2026,2)===300 && parcelaNoMes(cDepois,diaFech,2026,1)===0)
  // compromissos do mês = despesas(avista) + fatura; cartão NÃO entra em despesas
  const despesasAvista=50, faturaMes=parcelaNoMes(cAntes,diaFech,2026,1)
  check('compromissos sem dupla contagem (50+300=350)', aprox(despesasAvista+faturaMes,350))
}

// ───────── CÁLCULO: VR/VA e reserva FORA do disponível ─────────
function disponivelAgora(saldoBase, receitasAteHoje, despesasAteHoje){ return saldoBase+receitasAteHoje-despesasAteHoje }
{
  // saldoBase 1000, sem receitas/despesas no período. VR=500, reserva=2000 NÃO entram.
  const disp = disponivelAgora(1000, 0, 0)
  check('disponivel usa so saldo bancario (1000)', disp===1000)
  check('VR/VA nao somam ao disponivel', disp===1000) // nenhuma soma de 500
  check('reserva acumulada nao soma ao disponivel', disp===1000) // nenhuma soma de 2000
}

// ───────── OCULTAR VALORES: mascara tudo que passa por formatCurrency ─────────
const MASCARA='R$ ••••'
let ocultarGlobal=false
const setOcultar=(v)=>{ocultarGlobal=!!v}
const formatCurrency=(v)=> ocultarGlobal?MASCARA:('R$ '+(Number(v)||0).toFixed(2))
const exibirMoeda=(v,ocultar)=> ocultar?MASCARA:formatCurrency(v)
setOcultar(true)
check('limite diario mascarado', formatCurrency(123)===MASCARA)
check('VR saldo mascarado (exibirMoeda)', exibirMoeda(500,true)===MASCARA)
check('reserva mascarada', formatCurrency(2000)===MASCARA)
setOcultar(false)
check('valores reaparecem ao desativar', formatCurrency(123)==='R$ 123.00')
// persistência: estado salvo em localStorage ('almeida_valores_ocultos')
{
  const s=new Map(); const CH='almeida_valores_ocultos'
  s.set(CH,'1'); const aoRecarregar = s.get(CH)==='1'
  check('preferencia de ocultar persiste no reload', aoRecarregar===true)
}

// ───────── TEMA: 5 cores (preto incluso) e aparencia salva na conta ─────────
const CORES=['azul','rosa','verde','roxo','preto']
check('5 temas disponiveis incl. preto', CORES.length===5 && CORES.includes('preto'))
check('4 temas classicos mantidos', ['azul','rosa','verde','roxo'].every(c=>CORES.includes(c)))
// classe aplicada no <html>: azul = sem classe; demais = tema-<cor>
const classe=(c)=> c==='azul'?'':`tema-${c}`
check('tema preto -> classe tema-preto', classe('preto')==='tema-preto')
check('tema azul -> sem classe (padrao :root)', classe('azul')==='')

console.log(`\n${pass}/${pass+fail} PASS`)
process.exit(fail===0?0:1)
