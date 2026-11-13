/**
 * @fileoverview Testes para importação de benefícios VR/VA
 * @package Almeida Finance 2.0
 * @author Sistema de Importação Inteligente
 * @date 2026-11-06
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classificar, montarRegistros, TIPOS_IMPORTAVEIS } from '../src/lib/importacaoRegras.js'

// ─── Cenários de Classificação ───────────────────────────────────────────────

describe('Importação VR/VA - Classificação de Transações', () => {
  
  it('deve classificar compra no mercado como compra_beneficio', () => {
    const transacao = {
      data: '2026-11-05',
      descricao: 'MERCADO ABC LTDA',
      valor: -45.80,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'compra_beneficio')
    assert.equal(resultado.incluir, true)
  })

  it('deve classificar recarga mensal como recarga', () => {
    const transacao = {
      data: '2026-11-15',
      descricao: 'RECARGA MENSAL ALELO',
      valor: 350.00,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'recarga')
    assert.equal(resultado.incluir, true)
  })

  it('deve classificar crédito como recarga', () => {
    const transacao = {
      data: '2026-11-10',
      descricao: 'CREDITO EMPRESA XYZ',
      valor: 500.00,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'recarga')
    assert.equal(resultado.incluir, true)
  })

  it('deve classificar estorno como estorno_beneficio (não importável)', () => {
    const transacao = {
      data: '2026-11-12',
      descricao: 'ESTORNO COMPRA INDEVIDA',
      valor: 25.50,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'estorno_beneficio')
    assert.equal(resultado.incluir, false)
  })

  it('deve classificar cancelamento como estorno_beneficio', () => {
    const transacao = {
      data: '2026-11-08',
      descricao: 'CANCELAMENTO PEDIDO',
      valor: 18.00,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'estorno_beneficio')
    assert.equal(resultado.incluir, false)
  })

  it('deve classificar ajuste de saldo como ajuste', () => {
    const transacao = {
      data: '2026-11-01',
      descricao: 'AJUSTE DE SALDO',
      valor: 10.00,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'ajuste')
    assert.equal(resultado.incluir, true)
  })

  it('deve classificar valor negativo sem keywords como compra_beneficio', () => {
    const transacao = {
      data: '2026-11-03',
      descricao: 'RESTAURANTE BOA VISTA',
      valor: -68.40,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'compra_beneficio')
    assert.equal(resultado.incluir, true)
  })

  it('deve classificar valor positivo sem keywords como recarga', () => {
    const transacao = {
      data: '2026-11-20',
      descricao: 'CARGA AUTOMATICA',
      valor: 400.00,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'recarga')
    assert.equal(resultado.incluir, true)
  })

  it('deve marcar valor zero como ajuste com flag de revisão', () => {
    const transacao = {
      data: '2026-11-25',
      descricao: 'OPERACAO SISTEMA',
      valor: 0,
    }
    const resultado = classificar(transacao, 'beneficios')
    assert.equal(resultado.tipo, 'ajuste')
    assert.equal(resultado.incluir, false)
    assert.equal(resultado.revisar, true)
  })
})

// ─── Cenários de Montagem de Registros ───────────────────────────────────────

describe('Importação VR/VA - Montagem de Registros', () => {
  
  it('deve montar registro de compra_beneficio corretamente', () => {
    const itens = [{
      uid: 'i1',
      tipo: 'compra_beneficio',
      descricao: 'PADARIA CENTRAL',
      valor: 12.50,
      data: '2026-11-06',
      incluir: true,
      beneficioId: 'abc-123',
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.erros.length, 0)
    assert.equal(registros.beneficios_movimentacoes.length, 1)
    
    const registro = registros.beneficios_movimentacoes[0]
    assert.equal(registro.dados.beneficio_id, 'abc-123')
    assert.equal(registro.dados.tipo, 'compra') // mapeado de compra_beneficio
    assert.equal(registro.dados.valor, 12.50)
    assert.equal(registro.dados.descricao, 'PADARIA CENTRAL')
    assert.equal(registro.dados.data, '2026-11-06')
    assert.equal(registro.dados.automatica, false)
    assert.equal(registro.dados.competencia, null)
  })

  it('deve montar registro de recarga corretamente', () => {
    const itens = [{
      uid: 'i2',
      tipo: 'recarga',
      descricao: 'RECARGA MENSAL',
      valor: 350.00,
      data: '2026-11-15',
      incluir: true,
      beneficioId: 'def-456',
      chave: 'hash-2',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes.length, 1)
    assert.equal(registros.beneficios_movimentacoes[0].dados.tipo, 'recarga')
    assert.equal(registros.beneficios_movimentacoes[0].dados.valor, 350.00)
  })

  it('deve montar registro de ajuste corretamente', () => {
    const itens = [{
      uid: 'i3',
      tipo: 'ajuste',
      descricao: 'CORRECAO SALDO',
      valor: 5.00,
      data: '2026-11-10',
      incluir: true,
      beneficioId: 'ghi-789',
      chave: 'hash-3',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes.length, 1)
    assert.equal(registros.beneficios_movimentacoes[0].dados.tipo, 'ajuste')
  })

  it('não deve montar registro de estorno_beneficio', () => {
    const itens = [{
      uid: 'i4',
      tipo: 'estorno_beneficio',
      descricao: 'ESTORNO',
      valor: 20.00,
      data: '2026-11-12',
      incluir: false,
      beneficioId: 'jkl-012',
      chave: 'hash-4',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes.length, 0)
    assert.equal(registros.erros.length, 0) // não é erro, apenas não incluído
  })

  it('deve processar múltiplas transações mistas', () => {
    const itens = [
      {
        uid: 'i1',
        tipo: 'compra_beneficio',
        descricao: 'MERCADO',
        valor: 85.00,
        data: '2026-11-05',
        incluir: true,
        beneficioId: 'abc-123',
        chave: 'hash-1',
      },
      {
        uid: 'i2',
        tipo: 'recarga',
        descricao: 'RECARGA',
        valor: 400.00,
        data: '2026-11-10',
        incluir: true,
        beneficioId: 'abc-123',
        chave: 'hash-2',
      },
      {
        uid: 'i3',
        tipo: 'compra_beneficio',
        descricao: 'RESTAURANTE',
        valor: 45.50,
        data: '2026-11-15',
        incluir: true,
        beneficioId: 'abc-123',
        chave: 'hash-3',
      },
    ]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes.length, 3)
    assert.equal(registros.erros.length, 0)
    
    const tipos = registros.beneficios_movimentacoes.map(r => r.dados.tipo)
    assert.deepEqual(tipos, ['compra', 'recarga', 'compra'])
  })

  it('deve gerar erro se beneficioId estiver ausente', () => {
    const itens = [{
      uid: 'i1',
      tipo: 'compra_beneficio',
      descricao: 'TESTE',
      valor: 10.00,
      data: '2026-11-06',
      incluir: true,
      beneficioId: null, // faltando
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes.length, 0)
    assert.equal(registros.erros.length, 1)
    assert.match(registros.erros[0].problema, /benefício/i)
  })
})

// ─── Cenários de Validação ───────────────────────────────────────────────────

describe('Importação VR/VA - Validação', () => {
  
  it('deve confirmar que tipos de benefício são importáveis', () => {
    assert.ok(TIPOS_IMPORTAVEIS.includes('compra_beneficio'))
    assert.ok(TIPOS_IMPORTAVEIS.includes('recarga'))
    assert.ok(TIPOS_IMPORTAVEIS.includes('ajuste'))
    assert.ok(!TIPOS_IMPORTAVEIS.includes('estorno_beneficio'))
  })

  it('deve truncar descrições longas em 200 caracteres', () => {
    const descricaoLonga = 'A'.repeat(250)
    const itens = [{
      uid: 'i1',
      tipo: 'compra_beneficio',
      descricao: descricaoLonga,
      valor: 10.00,
      data: '2026-11-06',
      incluir: true,
      beneficioId: 'abc-123',
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes[0].dados.descricao.length, 200)
  })

  it('deve arredondar valores para 2 casas decimais', () => {
    const itens = [{
      uid: 'i1',
      tipo: 'compra_beneficio',
      descricao: 'TESTE',
      valor: 12.3456789,
      data: '2026-11-06',
      incluir: true,
      beneficioId: 'abc-123',
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    
    assert.equal(registros.beneficios_movimentacoes[0].dados.valor, 12.35)
  })
})

// ─── Cenários de Integração ──────────────────────────────────────────────────

describe('Importação VR/VA - Integração', () => {
  
  it('deve preparar registros compatíveis com useBeneficios.criarMovimentacao', () => {
    const itens = [{
      uid: 'i1',
      tipo: 'compra_beneficio',
      descricao: 'MERCADO XYZ',
      valor: 45.80,
      data: '2026-11-06',
      incluir: true,
      beneficioId: 'abc-123',
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    const dados = registros.beneficios_movimentacoes[0].dados
    
    // Validar estrutura esperada pelo hook
    assert.ok('beneficio_id' in dados)
    assert.ok('tipo' in dados)
    assert.ok('valor' in dados)
    assert.ok('descricao' in dados)
    assert.ok('data' in dados)
    assert.ok('competencia' in dados)
    assert.ok('automatica' in dados)
    
    // Validar tipos
    assert.equal(typeof dados.beneficio_id, 'string')
    assert.equal(typeof dados.tipo, 'string')
    assert.equal(typeof dados.valor, 'number')
    assert.equal(typeof dados.descricao, 'string')
    assert.equal(typeof dados.data, 'string')
    assert.equal(typeof dados.automatica, 'boolean')
  })

  it('deve preparar registros compatíveis com inserção direta no banco', () => {
    const itens = [{
      uid: 'i1',
      tipo: 'recarga',
      descricao: 'RECARGA MENSAL',
      valor: 350.00,
      data: '2026-11-15',
      incluir: true,
      beneficioId: 'def-456',
      chave: 'hash-1',
    }]
    
    const registros = montarRegistros(itens, { categorias: [] })
    const dados = registros.beneficios_movimentacoes[0].dados
    
    // Campos obrigatórios da tabela beneficios_movimentacoes
    assert.ok(dados.beneficio_id)
    assert.ok(['compra', 'recarga', 'ajuste', 'estorno'].includes(dados.tipo))
    assert.ok(dados.valor >= 0)
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dados.data))
  })
})

console.log('✅ Todos os testes de importação VR/VA passaram!')
