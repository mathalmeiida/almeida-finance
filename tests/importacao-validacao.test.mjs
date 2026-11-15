/**
 * Testes de validação da Importação Inteligente
 * Reproduz cenário real de 80 lançamentos
 */

import { validarItem } from '../src/lib/importacaoRegras.js'

console.log('# Testes de Validação - Importação Inteligente\n')

// Cenário 1: Receita sem categoria (deve ser válida)
const receitaSemCategoria = {
  uid: '1',
  incluir: true,
  tipo: 'receita',
  data: '2026-11-15',
  valor: 3000,
  descricao: 'Salário',
  categoriaId: null,
}

const erroReceita = validarItem(receitaSemCategoria)
console.log(`✓ Receita sem categoria: ${erroReceita ? 'BLOQUEADA ❌' : 'VÁLIDA ✅'}`)
if (erroReceita) console.log(`  Erro: ${erroReceita}`)

// Cenário 2: Despesa sem categoria (deve ser válida)
const despesaSemCategoria = {
  uid: '2',
  incluir: true,
  tipo: 'despesa',
  data: '2026-11-15',
  valor: 150,
  descricao: 'Mercado',
  categoriaId: null,
}

const erroDespesa = validarItem(despesaSemCategoria)
console.log(`✓ Despesa sem categoria: ${erroDespesa ? 'BLOQUEADA ❌' : 'VÁLIDA ✅'}`)
if (erroDespesa) console.log(`  Erro: ${erroDespesa}`)

// Cenário 3: Compra sem cartão (deve bloquear)
const compraSemCartao = {
  uid: '3',
  incluir: true,
  tipo: 'compra',
  data: '2026-11-15',
  valor: 89.90,
  descricao: 'Netflix',
  categoriaId: 'cat-123',
  cartaoId: null,
}

const erroCompra = validarItem(compraSemCartao)
console.log(`✓ Compra sem cartão: ${erroCompra ? 'BLOQUEADA ✅' : 'VÁLIDA ❌'}`)
if (erroCompra) console.log(`  Erro esperado: "${erroCompra}"`)

// Cenário 4: Compra com cartão (deve ser válida)
const compraComCartao = {
  uid: '4',
  incluir: true,
  tipo: 'compra',
  data: '2026-11-15',
  valor: 89.90,
  descricao: 'Netflix',
  categoriaId: 'cat-123',
  cartaoId: 'card-456',
}

const erroCompraValida = validarItem(compraComCartao)
console.log(`✓ Compra com cartão: ${erroCompraValida ? 'BLOQUEADA ❌' : 'VÁLIDA ✅'}`)
if (erroCompraValida) console.log(`  Erro: ${erroCompraValida}`)

// Cenário 5: Item não marcado (deve retornar null)
const itemNaoMarcado = {
  uid: '5',
  incluir: false,
  tipo: 'receita',
  data: '2026-11-15',
  valor: 1000,
  descricao: 'Freelance',
}

const erroNaoMarcado = validarItem(itemNaoMarcado)
console.log(`✓ Item não marcado: ${erroNaoMarcado === null ? 'IGNORADO ✅' : 'PROCESSADO ❌'}`)

// Cenário 6: Data inválida (deve bloquear)
const dataInvalida = {
  uid: '6',
  incluir: true,
  tipo: 'receita',
  data: '15/11/2026',
  valor: 100,
  descricao: 'Teste',
}

const erroData = validarItem(dataInvalida)
console.log(`✓ Data inválida: ${erroData ? 'BLOQUEADA ✅' : 'VÁLIDA ❌'}`)
if (erroData) console.log(`  Erro esperado: "${erroData}"`)

// Cenário 7: Valor zero (deve bloquear)
const valorZero = {
  uid: '7',
  incluir: true,
  tipo: 'despesa',
  data: '2026-11-15',
  valor: 0,
  descricao: 'Teste',
}

const erroValor = validarItem(valorZero)
console.log(`✓ Valor zero: ${erroValor ? 'BLOQUEADA ✅' : 'VÁLIDA ❌'}`)
if (erroValor) console.log(`  Erro esperado: "${erroValor}"`)

// Cenário 8: Descrição vazia (deve bloquear)
const descricaoVazia = {
  uid: '8',
  incluir: true,
  tipo: 'receita',
  data: '2026-11-15',
  valor: 100,
  descricao: '   ',
}

const erroDescricao = validarItem(descricaoVazia)
console.log(`✓ Descrição vazia: ${erroDescricao ? 'BLOQUEADA ✅' : 'VÁLIDA ❌'}`)
if (erroDescricao) console.log(`  Erro esperado: "${erroDescricao}"`)

// Cenário 9: Tipo não importável (deve bloquear)
const tipoInvalido = {
  uid: '9',
  incluir: true,
  tipo: 'transferencia',
  data: '2026-11-15',
  valor: 500,
  descricao: 'Transferência entre contas',
}

const erroTipo = validarItem(tipoInvalido)
console.log(`✓ Tipo não importável: ${erroTipo ? 'BLOQUEADA ✅' : 'VÁLIDA ❌'}`)
if (erroTipo) console.log(`  Erro esperado: "${erroTipo}"`)

// Resumo
console.log('\n📊 RESUMO DOS TESTES:')
const testes = [
  { nome: 'Receita sem categoria', passou: !erroReceita },
  { nome: 'Despesa sem categoria', passou: !erroDespesa },
  { nome: 'Compra sem cartão bloqueada', passou: !!erroCompra },
  { nome: 'Compra com cartão válida', passou: !erroCompraValida },
  { nome: 'Item não marcado ignorado', passou: erroNaoMarcado === null },
  { nome: 'Data inválida bloqueada', passou: !!erroData },
  { nome: 'Valor zero bloqueado', passou: !!erroValor },
  { nome: 'Descrição vazia bloqueada', passou: !!erroDescricao },
  { nome: 'Tipo inválido bloqueado', passou: !!erroTipo },
]

const passaram = testes.filter(t => t.passou).length
const falharam = testes.filter(t => !t.passou).length

console.log(`✅ Passaram: ${passaram}/${testes.length}`)
console.log(`❌ Falharam: ${falharam}/${testes.length}`)

if (falharam > 0) {
  console.log('\nTestes que falharam:')
  testes.filter(t => !t.passou).forEach(t => {
    console.log(`  ❌ ${t.nome}`)
  })
  process.exit(1)
} else {
  console.log('\n✅ Todos os testes de validação passaram!')
}
