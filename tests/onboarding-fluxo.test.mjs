// Testes das regras do onboarding (8 etapas) — lib PURA (sem React/supabase).
import {
  TELAS_ONBOARDING, ETAPAS_ONBOARDING, TOTAL_ETAPAS, etapaDaTela, telaParaRetomar, CHAVE_PARA_TELA,
  normalizarObjetivos, alternarObjetivo, validarPerfil,
  acaoPatrimonioInicial, NOME_PATRIMONIO_INICIAL, totalInvestido, validarMeta, itensResumoFinal,
} from '../src/lib/onboardingFluxo.js'

let falhas = 0
function assert(nome, cond, det = '') { if (!cond) falhas++; console.log(`${cond ? 'PASS' : 'FALHA'} — ${nome} ${det}`) }

console.log('# Estrutura das 8 etapas')
assert('8 etapas', TOTAL_ETAPAS === 8 && ETAPAS_ONBOARDING.map(e => e.numero).join() === '1,2,3,4,5,6,7,8')
const telasDasEtapas = ETAPAS_ONBOARDING.flatMap(e => e.telas)
assert('toda tela (exceto final) pertence a uma etapa', TELAS_ONBOARDING.filter(t => t !== 'final').every(t => telasDasEtapas.includes(t)))
assert('ordem das telas respeita a ordem das etapas', TELAS_ONBOARDING.filter(t => t !== 'final').map(etapaDaTela).every((n, i, a) => i === 0 || n >= a[i - 1]))
assert('saldo e investimentos na mesma etapa (2)', etapaDaTela('saldo') === 2)
assert('importação é a etapa 6', etapaDaTela('importacao') === 6)
assert('final não é etapa', etapaDaTela('final') === null)
assert('chaves do card da Home mapeiam para telas válidas', Object.values(CHAVE_PARA_TELA).every(t => TELAS_ONBOARDING.includes(t)))

console.log('\n# Retomada')
assert('retoma tela intermediária', telaParaRetomar('despesas') === 'despesas')
assert('não retoma final', telaParaRetomar('final') === null)
assert('não retoma perfil (início)', telaParaRetomar('perfil') === null)
assert('ignora valor inválido', telaParaRetomar('<x>') === null && telaParaRetomar(null) === null && telaParaRetomar(3) === null)

console.log('\n# Perfil e objetivos')
assert('nome obrigatório', validarPerfil({ nome: '  ' }) !== null)
assert('nome válido', validarPerfil({ nome: 'Matheus' }) === null)
assert('nome longo rejeitado', validarPerfil({ nome: 'x'.repeat(61) }) !== null)
let obj = alternarObjetivo([], 'economizar'); obj = alternarObjetivo(obj, 'reserva')
assert('múltiplos objetivos', obj.length === 2)
assert('alternar remove', alternarObjetivo(obj, 'economizar').join() === 'reserva')
assert('normaliza ids inválidos e duplicados', normalizarObjetivos(['reserva', 'reserva', 'hack', 7]).join() === 'reserva')

console.log('\n# Patrimônio investido (sem duplicar, separado do saldo)')
let a = acaoPatrimonioInicial({ investimentos: [], valor: 15000 })
assert('cria uma posição quando não há investimentos', a.tipo === 'criar' && a.dados.valor_atual === 15000 && a.dados.valor_aplicado === 15000 && a.dados.nome === NOME_PATRIMONIO_INICIAL)
assert('posição na categoria "outro"', a.dados.categoria === 'outro')
assert('vazio não cria nada', acaoPatrimonioInicial({ investimentos: [], valor: '' }).tipo === 'nenhum')
const reg = { id: 'r1', nome: NOME_PATRIMONIO_INICIAL, valor_atual: 15000, valor_aplicado: 15000, reserva_valor: 0 }
assert('voltar à etapa com mesmo valor: nada (sem duplicar)', acaoPatrimonioInicial({ investimentos: [reg], valor: 15000 }).tipo === 'nenhum')
a = acaoPatrimonioInicial({ investimentos: [reg], valor: 18000 })
assert('editar valor atualiza o MESMO registro', a.tipo === 'atualizar' && a.registro.id === 'r1' && a.dados.valor_atual === 18000)
assert('zerar remove o registro do onboarding', acaoPatrimonioInicial({ investimentos: [reg], valor: 0 }).tipo === 'remover')
assert('registro com movimentações não é alterado', acaoPatrimonioInicial({ investimentos: [reg], movimentacoes: [{ investimento_id: 'r1' }], valor: 1 }).tipo === 'controlado_no_modulo')
assert('com investimentos próprios não cria nada', acaoPatrimonioInicial({ investimentos: [{ id: 'x', nome: 'CDB' }], valor: 5000 }).tipo === 'ja_cadastrado')
assert('valor negativo é inválido', acaoPatrimonioInicial({ investimentos: [], valor: -10 }).tipo === 'invalido')
assert('não fica abaixo da parte vinculada à reserva', acaoPatrimonioInicial({ investimentos: [{ ...reg, reserva_valor: 5000 }], valor: 1000 }).tipo === 'invalido')
assert('total investido soma valor_atual', totalInvestido([{ valor_atual: 1000.1 }, { valor_atual: '2000.2' }]) === 3000.3)

console.log('\n# Metas')
const hoje = '2026-11-06'
assert('meta válida', validarMeta({ nome: 'Viagem', valor_desejado: 5000, valor_atual: 500, prazo: '2027-06-01' }, hoje) === null)
assert('sem nome', validarMeta({ nome: '', valor_desejado: 5000 }, hoje) !== null)
assert('sem valor', validarMeta({ nome: 'X', valor_desejado: 0 }, hoje) !== null)
assert('inicial maior que alvo', validarMeta({ nome: 'X', valor_desejado: 100, valor_atual: 200 }, hoje) !== null)
assert('prazo no passado', validarMeta({ nome: 'X', valor_desejado: 100, prazo: '2026-01-01' }, hoje) !== null)

console.log('\n# Resumo final só com o que foi cadastrado')
const vazio = itensResumoFinal({})
assert('nada cadastrado → resumo vazio', vazio.length === 0)
const r = itensResumoFinal({ nome: 'Ana', saldoConfigurado: true, saldo: 0, patrimonio: 0, qtdReceitas: 2, qtdDespesas: 0, qtdCartoes: 1, qtdMetas: 0, tema: 'escuro' })
const ids = r.map(i => i.id)
assert('saldo R$ 0 informado aparece', ids.includes('saldo'))
assert('patrimônio zero não aparece', !ids.includes('patrimonio'))
assert('despesas/metas zeradas não aparecem', !ids.includes('despesas') && !ids.includes('metas'))
assert('plural correto', r.find(i => i.id === 'receitas').valor === '2 cadastradas' && r.find(i => i.id === 'cartoes').valor === '1 cartão')
assert('patrimônio separado do saldo no resumo', itensResumoFinal({ saldoConfigurado: true, saldo: 1000, patrimonio: 5000 }).map(i => i.id).join() === 'saldo,patrimonio')

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
process.exit(falhas === 0 ? 0 : 1)
