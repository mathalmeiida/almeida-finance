// Testes das regras de personalização dos atalhos da Home — lib PURA (sem React/supabase).
import {
  CATALOGO_ATALHOS, ATALHOS_DESKTOP, atalhosDesktop, configPadraoAtalhos, normalizarConfigAtalhos, atalhosVisiveis,
  moverAtalho, reposicionarAtalho, alternarOcultoAtalho, alternarFavoritoAtalho, configsAtalhosIguais,
} from '../src/lib/atalhosHome.js'

let falhas = 0
function assert(nome, cond, det = '') { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }
const ids = lista => lista.map(a => a.id)

console.log('# Catálogo e padrão')
const padrao = configPadraoAtalhos()
assert('ordem do celular: 10 primeiros conforme especificação', JSON.stringify(padrao.ordem.slice(0, 10)) === JSON.stringify(['receitas', 'despesas', 'registrar-gasto', 'simular-compra', 'calendario', 'gastar-hoje', 'consultoria', 'investimentos', 'metas', 'cartoes']))
assert('Receitas e Despesas abrem páginas próprias', CATALOGO_ATALHOS.find(a => a.id === 'receitas').rota === '/receitas' && CATALOGO_ATALHOS.find(a => a.id === 'despesas').rota === '/despesas')
assert('nenhum destino repetido', new Set(CATALOGO_ATALHOS.map(a => a.rota || `modal:${a.modal}`)).size === CATALOGO_ATALHOS.length)
assert('computador: 5 principais na ordem', ids(atalhosDesktop(padrao)).join() === 'registrar-gasto,simular-compra,calendario,gastar-hoje,consultoria' && ATALHOS_DESKTOP.length === 5)
assert('computador respeita ocultos e favoritos', ids(atalhosDesktop(alternarFavoritoAtalho(alternarOcultoAtalho(padrao, 'calendario'), 'consultoria'))).join() === 'consultoria,registrar-gasto,simular-compra,gastar-hoje')
const v1 = normalizarConfigAtalhos({ versao: 1, ordem: ['metas', 'e-se'], ocultos: ['e-se'], favoritos: [] })
assert('config antiga (v1): Receitas/Despesas no início, ordem e ocultos preservados', v1.ordem.slice(0, 4).join() === 'receitas,despesas,metas,e-se' && v1.ocultos.join() === 'e-se' && v1.versao === 2)
assert('config v2 não é reordenada', normalizarConfigAtalhos({ versao: 2, ordem: ['metas', 'receitas'] }).ordem.slice(0, 2).join() === 'metas,receitas')
assert('ids únicos no catálogo', new Set(CATALOGO_ATALHOS.map(a => a.id)).size === CATALOGO_ATALHOS.length)
assert('todo atalho tem rota OU modal', CATALOGO_ATALHOS.every(a => !!a.rota !== !!a.modal))
assert('Importação Inteligente aponta para a página existente', CATALOGO_ATALHOS.find(a => a.id === 'importacao')?.rota === '/importacao')
assert('padrão mostra todos', atalhosVisiveis(padrao).length === CATALOGO_ATALHOS.length)

console.log('\n# Normalização de dados vindos do banco')
assert('null → padrão', configsAtalhosIguais(normalizarConfigAtalhos(null), padrao))
assert('array/strings inválidos → padrão', configsAtalhosIguais(normalizarConfigAtalhos('x'), padrao) && configsAtalhosIguais(normalizarConfigAtalhos([1, 2]), padrao))
const sujo = normalizarConfigAtalhos({ versao: 2, ordem: ['metas', 'metas', 'inexistente', 42], ocultos: ['nada', 'e-se'], favoritos: ['<script>'] })
assert('remove duplicados e desconhecidos', sujo.ordem[0] === 'metas' && sujo.ordem.filter(i => i === 'metas').length === 1 && !sujo.ordem.includes('inexistente'))
assert('acrescenta atalhos novos do catálogo', sujo.ordem.length === CATALOGO_ATALHOS.length)
assert('ocultos/favoritos filtrados', JSON.stringify(sujo.ocultos) === '["e-se"]' && sujo.favoritos.length === 0)

console.log('\n# Ocultar / favoritar')
let c = alternarOcultoAtalho(padrao, 'consultoria')
assert('ocultar remove da Home', !ids(atalhosVisiveis(c)).includes('consultoria'))
c = alternarOcultoAtalho(c, 'consultoria')
assert('mostrar de novo', ids(atalhosVisiveis(c)).includes('consultoria'))
c = alternarFavoritoAtalho(padrao, 'projecao')
assert('favorito vai para o início', ids(atalhosVisiveis(c))[0] === 'projecao')
c = alternarOcultoAtalho(c, 'projecao')
assert('ocultar favorito remove dos favoritos', !c.favoritos.includes('projecao') && !ids(atalhosVisiveis(c)).includes('projecao'))
c = alternarOcultoAtalho(padrao, 'metas'); c = alternarFavoritoAtalho(c, 'metas')
assert('favoritar oculto torna visível', ids(atalhosVisiveis(c))[0] === 'metas')
let todosOcultos = padrao
for (const a of CATALOGO_ATALHOS) todosOcultos = alternarOcultoAtalho(todosOcultos, a.id)
assert('nunca oculta todos (mínimo 1 visível)', atalhosVisiveis(todosOcultos).length === 1)

console.log('\n# Reordenar')
c = moverAtalho(padrao, 'despesas', 1)
assert('mover para baixo', c.ordem[1] === 'registrar-gasto' && c.ordem[2] === 'despesas')
assert('mover além do limite não altera', configsAtalhosIguais(moverAtalho(padrao, 'receitas', -1), padrao))
c = reposicionarAtalho(padrao, 'gastar-hoje', 'receitas')
assert('arrastar e soltar no topo', c.ordem[0] === 'gastar-hoje' && c.ordem[1] === 'receitas')
assert('reposicionar preserva todos os itens', c.ordem.length === CATALOGO_ATALHOS.length)

console.log('\n# Somente leitura (consultoria)')
assert('oculta "Registrar gasto" e importação', !ids(atalhosVisiveis(padrao, { somenteLeitura: true })).some(i => ['registrar-gasto', 'importacao'].includes(i)))

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
