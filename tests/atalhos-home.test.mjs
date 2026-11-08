// Testes das regras de personalização dos atalhos da Home — lib PURA (sem React/supabase).
import {
  CATALOGO_ATALHOS, configPadraoAtalhos, normalizarConfigAtalhos, atalhosVisiveis,
  moverAtalho, reposicionarAtalho, alternarOcultoAtalho, alternarFavoritoAtalho, configsAtalhosIguais,
} from '../src/lib/atalhosHome.js'

let falhas = 0
function assert(nome, cond, det = '') { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }
const ids = lista => lista.map(a => a.id)

console.log('# Catálogo e padrão')
const padrao = configPadraoAtalhos()
assert('4 originais primeiro, na ordem', JSON.stringify(padrao.ordem.slice(0, 4)) === JSON.stringify(['simular-compra', 'e-se', 'investimentos', 'metas']))
assert('ids únicos no catálogo', new Set(CATALOGO_ATALHOS.map(a => a.id)).size === CATALOGO_ATALHOS.length)
assert('todo atalho tem rota OU modal', CATALOGO_ATALHOS.every(a => !!a.rota !== !!a.modal))
assert('Importação Inteligente ausente até existir (Parte C)', !CATALOGO_ATALHOS.some(a => /import/i.test(a.id)))
assert('padrão mostra todos', atalhosVisiveis(padrao).length === CATALOGO_ATALHOS.length)

console.log('\n# Normalização de dados vindos do banco')
assert('null → padrão', configsAtalhosIguais(normalizarConfigAtalhos(null), padrao))
assert('array/strings inválidos → padrão', configsAtalhosIguais(normalizarConfigAtalhos('x'), padrao) && configsAtalhosIguais(normalizarConfigAtalhos([1, 2]), padrao))
const sujo = normalizarConfigAtalhos({ ordem: ['metas', 'metas', 'inexistente', 42], ocultos: ['nada', 'e-se'], favoritos: ['<script>'] })
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
c = moverAtalho(padrao, 'e-se', 1)
assert('mover para baixo', c.ordem[1] === 'investimentos' && c.ordem[2] === 'e-se')
assert('mover além do limite não altera', configsAtalhosIguais(moverAtalho(padrao, 'simular-compra', -1), padrao))
c = reposicionarAtalho(padrao, 'gastar-hoje', 'simular-compra')
assert('arrastar e soltar no topo', c.ordem[0] === 'gastar-hoje' && c.ordem[1] === 'simular-compra')
assert('reposicionar preserva todos os itens', c.ordem.length === CATALOGO_ATALHOS.length)

console.log('\n# Somente leitura (consultoria)')
assert('oculta "Registrar gasto"', !ids(atalhosVisiveis(padrao, { somenteLeitura: true })).includes('registrar-gasto'))

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
