// Testes do saldo disponível (regra única da Home) — lib PURA, dados fictícios.
import { calcularSaldoDisponivel, precisaBuscarAnteriores, inicioDoMes, divergenciaSaldo } from '../src/lib/saldoDisponivel.js'
import { prepararItens, montarRegistros, impactoNoSaldo } from '../src/lib/importacaoRegras.js'

let falhas = 0
function eq(nome, obtido, esperado) { const ok = Math.abs(obtido - esperado) < 0.005; if (!ok) falhas++; console.log(`${ok ? 'PASS' : 'FALHA'} — ${nome} (obtido ${obtido}, esperado ${esperado})`) }
function assert(nome, c) { if (!c) falhas++; console.log(`${c ? 'PASS' : 'FALHA'} — ${nome}`) }

const hoje = '2026-11-09'
const s = (o) => calcularSaldoDisponivel({ saldoBase: 1000, hoje, ...o }).saldo

console.log('# Básico')
assert('sem saldo informado: não configurado e zero', calcularSaldoDisponivel({ saldoBase: null, hoje }).configurado === false)
eq('marco hoje: só o saldo informado', s({ marco: hoje, despesas: [{ id: 1, data: hoje, valor: 50 }] }), 1000)
eq('mês atual após o marco', s({ marco: '2026-11-02', receitas: [{ id: 1, data: '2026-11-05', valor: 200 }], despesas: [{ id: 2, data: '2026-11-08', valor: 80 }] }), 1120)
eq('no dia do marco não desconta de novo', s({ marco: '2026-11-05', despesas: [{ id: 1, data: '2026-11-05', valor: 80 }] }), 1000)

console.log('\n# Extratos antigos e virada de mês')
const outubro = { receitas: [{ id: 'r1', data: '2026-10-20', valor: 300 }], despesas: [{ id: 'd1', data: '2026-10-31', valor: 100 }] }
const novembro = { receitas: [{ id: 'r2', data: '2026-11-01', valor: 50 }], despesas: [{ id: 'd2', data: '2026-11-03', valor: 25 }] }
eq('marco em outubro: conta outubro e novembro', s({ marco: '2026-10-05', receitas: [novembro.receitas, outubro.receitas], despesas: [novembro.despesas, outubro.despesas] }), 1225)
eq('virada: 31/10 e 01/11 contam uma vez cada', s({ marco: '2026-10-30', receitas: [novembro.receitas, outubro.receitas], despesas: [novembro.despesas, outubro.despesas] }), 925)
eq('lançamentos antes do marco são histórico', s({ marco: '2026-10-31', receitas: [outubro.receitas], despesas: [outubro.despesas] }), 1000)
eq('marco em ano anterior', s({ marco: '2025-12-31', receitas: [[{ id: 'a', data: '2026-01-02', valor: 10 }]] }), 1010)
assert('busca anteriores só quando o marco é de mês anterior', precisaBuscarAnteriores('2026-10-31', hoje) && !precisaBuscarAnteriores('2026-11-01', hoje) && !precisaBuscarAnteriores(null, hoje))
assert('início do mês', inicioDoMes(hoje) === '2026-11-01')

console.log('\n# Futuros e duplicidade')
eq('lançamento futuro não altera o saldo', s({ marco: '2026-11-01', despesas: [{ id: 1, data: '2026-11-20', valor: 500 }] }), 1000)
const dup = { id: 'x', data: '2026-11-04', valor: 40 }
eq('mesmo registro em duas listas conta uma vez', s({ marco: '2026-11-01', despesas: [[dup], [dup]] }), 960)

console.log('\n# Importação: impacto da prévia = mudança real do saldo')
const extrato = [
  { linha: 1, data: '2026-10-02', descricao: 'PAGTO SALARIO', valor: 4800, idOrigem: 'a' },
  { linha: 2, data: '2026-10-10', descricao: 'SUPERMERCADO', valor: -182.4, idOrigem: 'b' },
  { linha: 3, data: '2026-10-12', descricao: 'TRANSF MESMA TITULARIDADE', valor: -500, idOrigem: 'c' },
  { linha: 4, data: '2026-10-15', descricao: 'PAGAMENTO FATURA CARTAO', valor: -900, idOrigem: 'd' },
  { linha: 5, data: '2026-10-16', descricao: 'APLICACAO CDB', valor: -1000, idOrigem: 'e' },
  { linha: 6, data: '2026-11-03', descricao: 'FARMACIA', valor: -45, idOrigem: 'f' },
]
const itens = prepararItens(extrato, { contexto: 'extrato', origem: 'extrato:x' })
const reg = montarRegistros(itens)
const gravadas = { receitas: reg.receitas.map((r, i) => ({ id: `R${i}`, ...r.dados })), despesas: reg.despesas.map((d, i) => ({ id: `D${i}`, ...d.dados })) }
const marco = '2026-10-05'
const depois = calcularSaldoDisponivel({ saldoBase: 1000, marco, hoje, receitas: gravadas.receitas, despesas: gravadas.despesas })
const impacto = impactoNoSaldo(itens, { saldoBaseData: marco, hoje })
eq('saldo depois = saldo informado + impacto mostrado', depois.saldo, 1000 + impacto.delta)
eq('transferência própria, fatura e aplicação não mexem no saldo', depois.saldo, 1000 - 182.4 - 45)
const reimport = prepararItens(extrato, { contexto: 'extrato', origem: 'extrato:x', chavesImportadas: new Set(itens.map(i => i.chave)) })
assert('reimportação não gera novos registros', montarRegistros(reimport).despesas.length === 0 && montarRegistros(reimport).receitas.length === 0)
eq('saldo igual após reimportar', calcularSaldoDisponivel({ saldoBase: 1000, marco, hoje, ...gravadas }).saldo, depois.saldo)

console.log('\n# Divergência com o banco')
assert('confere', divergenciaSaldo(772.6, 772.6).confere)
assert('diferença calculada', divergenciaSaldo(772.6, 800).diferenca === 27.4 && !divergenciaSaldo(772.6, 800).confere)

console.log(falhas === 0 ? '\nOK — todos os testes passaram' : `\n${falhas} FALHA(S)`)
if (falhas) process.exitCode = 1
