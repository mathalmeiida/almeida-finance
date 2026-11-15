// ─── Teste de Detecção Automática de Contexto ───────────────────────────────
// Valida que a função detectarTipoDocumento identifica corretamente
// extratos, faturas e investimentos com base no conteúdo do documento

import { detectarTipoDocumento, detectarInstituicao } from '../src/lib/importacaoLeitura.js'

const testes = [
  {
    nome: 'Extrato bancário Nubank',
    linhas: [
      'Nubank',
      'EXTRATO DE CONTA CORRENTE',
      'Período: 01/01/2024 a 31/01/2024',
      'Agência: 0001 Conta: 123456-7',
      '01/01/2024 PIX RECEBIDO 1.500,00',
      '05/01/2024 TED BANCO X -200,00',
    ],
    esperado: { tipo: 'extrato', instituicao: 'Nubank' }
  },
  {
    nome: 'Fatura de cartão Itaú',
    linhas: [
      'Itaú Unibanco',
      'FATURA DO CARTÃO DE CRÉDITO',
      'Vencimento: 15/02/2024',
      'Limite disponível: R$ 3.000,00',
      'Fechamento: 08/02/2024',
      '10/01/2024 SUPERMERCADO XYZ 150,00',
      '15/01/2024 UBER 25,00',
    ],
    esperado: { tipo: 'fatura', instituicao: 'Itaú' }
  },
  {
    nome: 'Extrato de investimentos XP',
    linhas: [
      'XP Investimentos',
      'POSIÇÃO CONSOLIDADA',
      'Carteira de Investimentos',
      'Extrato de Investimentos - Janeiro 2024',
      'Renda Fixa',
      '01/01/2024 APORTE CDB 1.000,00',
      '15/01/2024 RENDIMENTO 12,34',
    ],
    esperado: { tipo: 'investimentos', instituicao: 'XP Investimentos' }
  },
  {
    nome: 'Extrato genérico (sem palavras-chave)',
    linhas: [
      'Banco Digital',
      'Movimentações do período',
      '01/01/2024 Compra 100,00',
      '02/01/2024 Pagamento 50,00',
    ],
    esperado: { tipo: null, instituicao: null }
  },
  {
    nome: 'Fatura com palavras ambíguas',
    linhas: [
      'Santander',
      'FATURA CARTÃO',
      'Vencimento: 20/03/2024',
      'Limite: R$ 5.000,00',
      'Fechamento: 13/03/2024',
      'PAGAMENTO FATURA ANTERIOR -500,00', // palavra "fatura" na movimentação
      'SUPERMERCADO ABC 80,00',
    ],
    esperado: { tipo: 'fatura', instituicao: 'Santander' }
  },
  {
    nome: 'Extrato com menção a investimento (deve ser extrato)',
    linhas: [
      'Banco do Brasil',
      'Extrato de Conta Corrente',
      'Período: 01/02/2024 a 28/02/2024',
      '05/02/2024 PIX RECEBIDO 2.000,00',
      '10/02/2024 APLICACAO CDB -1.000,00', // operação de investimento no extrato
      '15/02/2024 TED ENVIADA -300,00',
    ],
    esperado: { tipo: 'extrato', instituicao: 'Banco do Brasil' }
  },
  {
    nome: 'Nota de negociação (investimentos)',
    linhas: [
      'BTG Pactual',
      'Nota de Negociação',
      'Extrato de Investimentos',
      'Posição de Ativos',
      'Renda Fixa e Variável',
      '01/03/2024 COMPRA PETR4 500,00',
      '05/03/2024 DIVIDENDO 25,00',
    ],
    esperado: { tipo: 'investimentos', instituicao: 'BTG Pactual' }
  }
]

console.log('🧪 Testando detecção automática de contexto...\n')

let passaram = 0
let falharam = 0

for (const teste of testes) {
  const tipoDetectado = detectarTipoDocumento(teste.linhas)
  const instituicaoDetectada = detectarInstituicao(teste.linhas)
  
  const tipoOk = tipoDetectado === teste.esperado.tipo
  const instOk = instituicaoDetectada === teste.esperado.instituicao
  
  if (tipoOk && instOk) {
    console.log(`✅ ${teste.nome}`)
    console.log(`   Tipo: ${tipoDetectado || 'não detectado'} | Instituição: ${instituicaoDetectada || 'não detectada'}`)
    passaram++
  } else {
    console.log(`❌ ${teste.nome}`)
    console.log(`   Esperado: tipo=${teste.esperado.tipo}, instituição=${teste.esperado.instituicao}`)
    console.log(`   Recebido: tipo=${tipoDetectado}, instituição=${instituicaoDetectada}`)
    falharam++
  }
  console.log('')
}

console.log('─'.repeat(60))
console.log(`Total: ${testes.length} testes`)
console.log(`✅ Passaram: ${passaram}`)
console.log(`❌ Falharam: ${falharam}`)
console.log('─'.repeat(60))

if (falharam > 0) {
  process.exit(1)
}
