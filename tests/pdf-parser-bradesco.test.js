// Teste específico para PDF Bradesco
import { describe, it, expect } from 'vitest'
import { textoPDFParaTransacoes, detectarInstituicao, detectarTipoDocumento } from '../src/lib/importacaoLeitura.js'

describe('Parser PDF - Bradesco Fatura', () => {
  // Simulação de linhas extraídas de PDF Bradesco
  const linhasBradesco = [
    'BRADESCO',
    'CARTÕES',
    'FATURA DO CARTÃO DE CRÉDITO',
    'Vencimento: 10/01/2026',
    'Data de Fechamento: 05/01/2026',
    'Limite de Crédito: R$ 10.000,00',
    'Saldo anterior: R$ 1.234,56',
    '',
    'LANÇAMENTOS NACIONAIS',
    '15/12 | NETFLIX SERVICOS DE STREAMIN | 39,90',
    '16/12 | POSTO SHELL | 200,00',
    '17/12 | IFOOD *IFOOD | 85,50',
    '18/12 | MERCADO LIVRE | 150,00',
    '19/12 | UBER *UBER | 45,30',
    '20/12 | AMAZON.COM.BR | 125,99',
    '21/12 | SPOTIFY | 21,90',
    '22/12 | MAGAZINE LUIZA | 399,80',
    '23/12 | AMERICANAS | 78,50',
    '24/12 | UBER EATS | 67,80',
    '25/12 | FARMACIA DROGASIL | 156,40',
    '26/12 | PADARIA CENTRAL | 34,20',
    '27/12 | SUPERMERCADO EXTRA | 432,10',
    '28/12 | LOJAS RENNER | 289,50',
    '29/12 | ESTORNO IFOOD | -85,50',
    '30/12 | ZARA BRASIL | 567,30',
    '31/12 | CINEMA KINOPLEX | 89,40',
    '',
    'LANÇAMENTOS INTERNACIONAIS',
    '20/12 | APPLE.COM/BILL | USD 4,99 | 25,40',
    '22/12 | STEAM GAMES | USD 19,99 | 102,00',
    '',
    'TOTAL NACIONAL: R$ 3.977,49',
    'TOTAL INTERNACIONAL: R$ 127,40',
    'TOTAL DA FATURA: R$ 4.104,89',
    'Pagamento mínimo: R$ 205,24',
  ]

  it('deve detectar instituição como Bradesco', () => {
    const instituicao = detectarInstituicao(linhasBradesco)
    expect(instituicao).toBe('Bradesco')
  })

  it('deve detectar tipo de documento como fatura', () => {
    const tipo = detectarTipoDocumento(linhasBradesco)
    expect(tipo).toBe('fatura')
  })

  it('deve extrair todas as transações (incluindo estornos)', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    expect(resultado.transacoes).toHaveLength(19) // 17 compras + 1 estorno + 2 internacionais
    expect(resultado.descartadas.length).toBeLessThan(5) // Poucas linhas descartadas
  })

  it('deve reconhecer valores corretamente', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    const netflix = resultado.transacoes.find(t => t.descricao.includes('NETFLIX'))
    expect(netflix).toBeDefined()
    expect(netflix.valor).toBe(39.90)
    
    const uber = resultado.transacoes.find(t => t.descricao.includes('UBER *UBER'))
    expect(uber).toBeDefined()
    expect(uber.valor).toBe(45.30)
  })

  it('deve reconhecer estornos com valor negativo', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    const estorno = resultado.transacoes.find(t => t.descricao.includes('ESTORNO'))
    expect(estorno).toBeDefined()
    expect(estorno.valor).toBeLessThan(0)
    expect(Math.abs(estorno.valor)).toBe(85.50)
  })

  it('deve processar compras internacionais', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    const apple = resultado.transacoes.find(t => t.descricao.includes('APPLE'))
    expect(apple).toBeDefined()
    expect(apple.valor).toBe(25.40) // Valor em reais
    
    const steam = resultado.transacoes.find(t => t.descricao.includes('STEAM'))
    expect(steam).toBeDefined()
    expect(steam.valor).toBe(102.00)
  })

  it('deve calcular total correto das transações', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    const total = resultado.transacoes.reduce((soma, t) => soma + t.valor, 0)
    const totalEsperado = 4104.89
    
    // Permitir pequena diferença por arredondamento
    expect(Math.abs(total - totalEsperado)).toBeLessThan(1.00)
  })

  it('deve marcar todas transações PDF para revisão', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    resultado.transacoes.forEach(t => {
      expect(t.revisar).toBe(true)
      expect(t.avisos.length).toBeGreaterThan(0)
    })
  })

  it('deve extrair datas corretamente', () => {
    const resultado = textoPDFParaTransacoes(linhasBradesco, { anoPadrao: 2025 })
    
    const netflix = resultado.transacoes.find(t => t.descricao.includes('NETFLIX'))
    expect(netflix.data).toBe('2025-12-15') // Ano deduzido do vencimento
    
    const cinema = resultado.transacoes.find(t => t.descricao.includes('CINEMA'))
    expect(cinema.data).toBe('2025-12-31')
  })
})

describe('Parser PDF - Formatos Alternativos', () => {
  it('deve processar formato com mais espaçamento', () => {
    const linhas = [
      'BANCO TESTE',
      'EXTRATO',
      '01/01/2026    COMPRA SUPERMERCADO         150,00    5.850,00',
      '02/01/2026    TRANSFERENCIA PIX           -200,00   5.650,00',
      '03/01/2026    SALARIO                     3.000,00  8.650,00',
    ]
    
    const resultado = textoPDFParaTransacoes(linhas, { anoPadrao: 2026 })
    
    expect(resultado.transacoes).toHaveLength(3)
    expect(resultado.transacoes[0].valor).toBe(150.00)
    expect(resultado.transacoes[1].valor).toBe(-200.00)
    expect(resultado.transacoes[2].valor).toBe(3000.00)
  })

  it('deve processar formato com pipe separador (Bradesco style)', () => {
    const linhas = [
      'BRADESCO',
      '15/12 | NETFLIX | 39,90',
      '16/12 | UBER | 45,30',
    ]
    
    const resultado = textoPDFParaTransacoes(linhas, { anoPadrao: 2025 })
    
    expect(resultado.transacoes).toHaveLength(2)
    expect(resultado.transacoes[0].descricao).toContain('NETFLIX')
    expect(resultado.transacoes[0].valor).toBe(39.90)
  })
})
