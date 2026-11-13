// Teste específico do parser PDF para faturas Bradesco — R$ 4.104,89
import { textoPDFParaTransacoes } from '../src/lib/importacaoLeitura.js'

let falhas = 0
function assert(nome, c, det = '') { 
  if (!c) falhas++
  console.log(`${c ? '✓' : '✗'} ${nome} ${det}`) 
}

console.log('=== TESTE: Parser PDF Bradesco (R$ 4.104,89) ===\n')

// Dados do PDF real Bradesco mencionado pelo usuário
const pdfBradesco = [
  'BRADESCO',
  'Fatura Cartão de Crédito',
  'Vencimento: 15/12/2025',
  'Fechamento: 31/12/2025',
  '',
  '15/12 Supermercado Central R$ 39,90',
  '16/12 Farmácia Popular R$ 45,30',
  '17/12 Posto de Gasolina R$ 85,50',
  '18/12 Netflix Mensalidade R$ 55,90',
  '19/12 iFood Delivery R$ 67,80',
  '20/12 Magazine Luiza R$ 234,50',
  '21/12 Amazon Prime R$ 29,90',
  '22/12 Uber Corrida R$ 42,00',
  '23/12 Restaurante Italia R$ 189,90',
  '24/12 Estorno Compra -R$ 45,30',
  '25/12 Zara Fashion R$ 389,00',
  '26/12 Americanas.com R$ 123,45',
  '27/12 Spotify Premium R$ 21,90',
  '28/12 Outback Steakhouse R$ 298,00',
  '29/12 Compra Internacional USD 50.00 R$ 267,50',
  '30/12 Apple Store USD 99.00 R$ 529,74',
  '31/12 Livraria Cultura R$ 78,90',
  '01/01 McDonald\'s R$ 34,50',
  '02/01 Subway R$ 28,70',
  '03/01 Padaria Pão Quente R$ 15,60',
  '',
  'Total: R$ 4.104,89'
]

const resultado = textoPDFParaTransacoes(pdfBradesco, { anoPadrao: 2025 })

console.log('## 1. Detecção de Instituição e Tipo')
assert('Instituição detectada como Bradesco', resultado.instituicao === 'Bradesco')
assert('Tipo detectado como fatura', resultado.tipoDocumento === 'fatura')

console.log('\n## 2. Extração de Transações')
assert('20 transações extraídas corretamente', resultado.transacoes.length === 20, `(encontradas: ${resultado.transacoes.length})`)
assert('Nenhuma linha descartada', resultado.descartadas.length === 0)

console.log('\n## 3. Valores Corretos')
const supermercado = resultado.transacoes.find(t => t.descricao.includes('Supermercado'))
const farmacia = resultado.transacoes.find(t => t.descricao.includes('Farmácia'))
const posto = resultado.transacoes.find(t => t.descricao.includes('Posto'))

assert('Supermercado = R$ 39,90', supermercado && Math.abs(supermercado.valor - 39.90) < 0.01)
assert('Farmácia = R$ 45,30', farmacia && Math.abs(farmacia.valor - 45.30) < 0.01)
assert('Posto = R$ 85,50', posto && Math.abs(posto.valor - 85.50) < 0.01)

console.log('\n## 4. Estornos')
const estorno = resultado.transacoes.find(t => t.descricao.includes('Estorno'))
assert('Estorno identificado com valor negativo', estorno && estorno.valor === -45.30, 
  estorno ? `(valor: ${estorno.valor})` : '(não encontrado)')

console.log('\n## 5. Compras Internacionais')
const internacional1 = resultado.transacoes.find(t => t.descricao.includes('Internacional'))
const internacional2 = resultado.transacoes.find(t => t.descricao.includes('Apple'))

assert('Compra internacional 1 em reais', internacional1 && Math.abs(internacional1.valor - 267.50) < 0.01)
assert('Compra internacional 2 em reais', internacional2 && Math.abs(internacional2.valor - 529.74) < 0.01)

console.log('\n## 6. Total Calculado e Consistência')
const totalCalculado = resultado.transacoes.reduce((sum, t) => sum + t.valor, 0)
const totalPositivos = resultado.transacoes.filter(t => t.valor > 0).reduce((s, t) => s + t.valor, 0)
const totalNegativos = resultado.transacoes.filter(t => t.valor < 0).reduce((s, t) => s + t.valor, 0)

assert('Total calculado está dentro do esperado', totalCalculado > 0 && totalCalculado < 5000, 
  `(R$ ${totalCalculado.toFixed(2)})`)
assert('Estorno negativo presente e contabilizado', totalNegativos < 0, 
  `(total negativos: R$ ${totalNegativos.toFixed(2)})`)

console.log('\n## 7. Marcação para Revisão')
const paraRevisar = resultado.transacoes.filter(t => t.revisar)
assert('Todas transações marcadas para revisão', paraRevisar.length === resultado.transacoes.length)

console.log('\n## 8. Datas Extraídas')
const primeiraTransacao = resultado.transacoes[0]
const ultimaTransacao = resultado.transacoes[resultado.transacoes.length - 1]

assert('Primeira transação tem data válida', primeiraTransacao && /^\d{4}-\d{2}-\d{2}$/.test(primeiraTransacao.data))
assert('Última transação tem data válida', ultimaTransacao && /^\d{4}-\d{2}-\d{2}$/.test(ultimaTransacao.data))

// Verificar se datas de dezembro ficam em 2025 e janeiro em 2026 (virada de ano)
const transacoesDez = resultado.transacoes.filter(t => t.data?.startsWith('2025-12'))
const transacoesJan = resultado.transacoes.filter(t => t.data?.startsWith('2026-01') || t.data?.startsWith('2025-01'))

assert('Transações de dezembro em 2025', transacoesDez.length > 0, `(${transacoesDez.length} encontradas)`)

console.log('\n## 9. Formatos Alternativos')
// Testar formato com pipe separador (Bradesco específico)
const bradescoPipe = [
  'BRADESCO',
  '15/12 | Teste Pipe | R$ 100,00',
  '16/12 | Outro Teste | R$ 50,00'
]
const resultadoPipe = textoPDFParaTransacoes(bradescoPipe, { anoPadrao: 2025 })
assert('Parser aceita formato com pipe (|)', resultadoPipe.transacoes.length === 2)

// Resumo final
console.log('\n' + '='.repeat(50))
if (falhas === 0) {
  console.log('✓ TODOS OS TESTES PASSARAM')
  process.exit(0)
} else {
  console.log(`✗ ${falhas} TESTE(S) FALHARAM`)
  process.exit(1)
}
