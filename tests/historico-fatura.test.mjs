// Caminho controlado de histórico de fatura (src/lib/historicoFatura.js).
// Cliente supabase FALSO, em memória: NÃO é teste contra Supabase DEV nem contra PostgreSQL.
import {
  ehErroFaturaQuitada, validarMotivo, montarParametrosHistorico,
  alterarHistoricoFatura, creditoVigente, filtrarCamposEditaveis,
} from '../src/lib/historicoFatura.js'

let falhas = 0
function assert(nome, cond, det = '') {
  if (!cond) falhas++
  console.log(`${cond ? 'PASS' : 'FALHA'} - ${nome} ${det}`)
}
async function lanca(fn) { try { await fn(); return null } catch (e) { return e } }

// 1. Detecção de FP001
assert('FP001 por code', ehErroFaturaQuitada({ code: 'FP001', message: 'x' }))
assert('FP001 por hint da RPC', ehErroFaturaQuitada({ message: 'Fatura quitada', hint: 'Use alterar_historico_fatura' }))
assert('outro código não é FP001', !ehErroFaturaQuitada({ code: '23505', message: 'duplicado' }))
assert('sem erro', !ehErroFaturaQuitada(null))

// 2. Motivo
assert('motivo curto rejeitado', (await lanca(() => validarMotivo('abc'))) !== null)
assert('motivo vazio rejeitado', (await lanca(() => validarMotivo('    '))) !== null)
assert('motivo longo rejeitado', (await lanca(() => validarMotivo('a'.repeat(301)))) !== null)
assert('motivo válido com trim', validarMotivo('  erro de digitação  ') === 'erro de digitação')

// 3. Parâmetros da RPC
const p = montarParametrosHistorico({ tabela: 'compras_cartao', id: 'u1', acao: 'editar', dados: { valor_total: 10 }, motivo: 'corrigir valor' })
assert('params editar', p.p_tabela === 'compras_cartao' && p.p_id === 'u1' && p.p_acao === 'editar' && p.p_dados.valor_total === 10 && p.p_motivo === 'corrigir valor')
const q = montarParametrosHistorico({ tabela: 'parcelamentos', id: 'u2', acao: 'excluir', dados: { x: 1 }, motivo: 'lançamento duplicado' })
assert('params excluir ignora dados', q.p_acao === 'excluir' && Object.keys(q.p_dados).length === 0)
assert('tabela fora da lista', (await lanca(() => montarParametrosHistorico({ tabela: 'perfis', id: '1', acao: 'excluir', motivo: 'motivo ok' }))) !== null)
assert('ação inválida', (await lanca(() => montarParametrosHistorico({ tabela: 'compras_cartao', id: '1', acao: 'inserir', motivo: 'motivo ok' }))) !== null)
assert('editar sem dados', (await lanca(() => montarParametrosHistorico({ tabela: 'compras_cartao', id: '1', acao: 'editar', motivo: 'motivo ok' }))) !== null)

// 4. Chamada com cliente falso
const chamadas = []
const fake = { rpc: async (nome, params) => { chamadas.push({ nome, params }); return { data: { ok: true, ajustes: 1 }, error: null } } }
const r = await alterarHistoricoFatura(fake, { tabela: 'compras_cartao', id: 'u1', acao: 'excluir', motivo: 'compra duplicada' })
assert('chama a RPC correta', chamadas.length === 1 && chamadas[0].nome === 'alterar_historico_fatura' && chamadas[0].params.p_motivo === 'compra duplicada')
assert('devolve o jsonb', r.ok === true && r.ajustes === 1)
const falso = { rpc: async () => ({ data: null, error: { code: '42501', message: 'sem permissão' } }) }
const e1 = await lanca(() => alterarHistoricoFatura(falso, { tabela: 'compras_cartao', id: 'u1', acao: 'excluir', motivo: 'compra duplicada' }))
assert('propaga erro da RPC com code', e1 && e1.code === '42501' && e1.message === 'sem permissão')
chamadas.length = 0
await lanca(() => alterarHistoricoFatura(fake, { tabela: 'compras_cartao', id: 'u1', acao: 'excluir', motivo: 'x' }))
assert('motivo curto não chega à RPC', chamadas.length === 0)

// 5. Whitelist de campos
const f = filtrarCamposEditaveis('compras_cartao', { descricao: 'a', valor_total: 5, usuario_id: 'z', forma: 'x' })
assert('filtra campos fora da whitelist', Object.keys(f).sort().join() === 'descricao,valor_total')
assert('faturas_cartao só valor_total', Object.keys(filtrarCamposEditaveis('faturas_cartao', { valor_total: 1, pago: true })).join() === 'valor_total')

// 6. Crédito vigente
assert('sem lançamentos = 0', creditoVigente([]) === 0 && creditoVigente(null) === 0)
assert('soma créditos', creditoVigente([{ tipo: 'credito', valor: '30.10' }, { tipo: 'credito', valor: 20 }, { tipo: 'edicao', valor: 999 }]) === 50.1)
assert('estorno reduz via lançamento credito negativo', creditoVigente([{ tipo: 'credito', valor: 50 }, { tipo: 'credito', valor: -50 }]) === 0)
assert('nunca negativo', creditoVigente([{ tipo: 'credito', valor: -5 }]) === 0)
assert('centavos sem erro de ponto flutuante', creditoVigente([{ tipo: 'credito', valor: 0.1 }, { tipo: 'credito', valor: 0.2 }]) === 0.3)

console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTodos os testes passaram')
process.exit(falhas ? 1 : 0)
