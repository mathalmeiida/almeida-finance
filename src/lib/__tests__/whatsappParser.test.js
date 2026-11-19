/**
 * Testes do parser de mensagens WhatsApp
 * Execute com: npm test (ou framework de teste configurado)
 */

import { parseWhatsAppMessage, formatConfirmacao, validarMensagem } from '../whatsappParser';

describe('WhatsApp Parser', () => {
  describe('parseWhatsAppMessage', () => {
    test('deve parsear despesa simples', () => {
      const resultado = parseWhatsAppMessage('gastei R$ 50 no mercado');
      
      expect(resultado).not.toBeNull();
      expect(resultado.valor).toBe(50);
      expect(resultado.tipo).toBe('despesa');
      expect(resultado.categoria).toBe('alimentacao');
      expect(resultado.familiar).toBe(false);
    });

    test('deve identificar receita', () => {
      const resultado = parseWhatsAppMessage('recebi R$ 1500 de salário');
      
      expect(resultado).not.toBeNull();
      expect(resultado.valor).toBe(1500);
      expect(resultado.tipo).toBe('receita');
    });

    test('deve detectar despesa familiar', () => {
      const resultado = parseWhatsAppMessage('gastei 200 reais no mercado familiar');
      
      expect(resultado).not.toBeNull();
      expect(resultado.familiar).toBe(true);
      expect(resultado.categoria).toBe('alimentacao');
    });

    test('deve extrair parcelas', () => {
      const resultado = parseWhatsAppMessage('comprei uma TV por R$ 2000 em 10x');
      
      expect(resultado).not.toBeNull();
      expect(resultado.valor).toBe(2000);
      expect(resultado.parcelas).toBe(10);
    });

    test('deve identificar categoria transporte', () => {
      const resultado = parseWhatsAppMessage('paguei R$ 25 de uber');
      
      expect(resultado).not.toBeNull();
      expect(resultado.categoria).toBe('transporte');
    });

    test('deve retornar null para mensagem sem valor', () => {
      const resultado = parseWhatsAppMessage('oi tudo bem?');
      
      expect(resultado).toBeNull();
    });

    test('deve parsear diferentes formatos de valor', () => {
      const casos = [
        'gastei R$ 50,00',
        'gastei R$50',
        'gastei 50 reais',
        'gastei 50.00',
        'gastei R$ 50.50'
      ];

      casos.forEach(mensagem => {
        const resultado = parseWhatsAppMessage(mensagem);
        expect(resultado).not.toBeNull();
        expect(resultado.valor).toBeGreaterThan(0);
      });
    });

    test('deve ter confiança alta para mensagem bem formatada', () => {
      const resultado = parseWhatsAppMessage('gastei R$ 50,00 no mercado São Pedro');
      
      expect(resultado).not.toBeNull();
      expect(resultado.confianca).toBeGreaterThan(0.7);
    });

    test('deve categorizar como outros quando não identificar', () => {
      const resultado = parseWhatsAppMessage('gastei R$ 100 em coisas');
      
      expect(resultado).not.toBeNull();
      expect(resultado.categoria).toBe('outros');
    });
  });

  describe('formatConfirmacao', () => {
    test('deve formatar confirmação de despesa', () => {
      const dados = {
        tipo: 'despesa',
        descricao: 'Mercado',
        valor: 150,
        categoria: 'alimentacao',
        familiar: false,
        parcelas: null
      };

      const confirmacao = formatConfirmacao(dados);
      
      expect(confirmacao).toContain('💸');
      expect(confirmacao).toContain('Despesa registrada');
      expect(confirmacao).toContain('R$ 150.00');
      expect(confirmacao).toContain('Mercado');
    });

    test('deve incluir informação de parcelas', () => {
      const dados = {
        tipo: 'despesa',
        descricao: 'TV',
        valor: 2000,
        categoria: 'outros',
        familiar: false,
        parcelas: 10
      };

      const confirmacao = formatConfirmacao(dados);
      
      expect(confirmacao).toContain('10x');
      expect(confirmacao).toContain('R$ 200.00'); // 2000/10
    });

    test('deve indicar despesa familiar', () => {
      const dados = {
        tipo: 'despesa',
        descricao: 'Conta de luz',
        valor: 200,
        categoria: 'moradia',
        familiar: true,
        parcelas: null
      };

      const confirmacao = formatConfirmacao(dados);
      
      expect(confirmacao).toContain('familiar');
      expect(confirmacao).toContain('👨‍👩‍👧‍👦');
    });

    test('deve formatar receita com emoji correto', () => {
      const dados = {
        tipo: 'receita',
        descricao: 'Salário',
        valor: 5000,
        categoria: null,
        familiar: false,
        parcelas: null
      };

      const confirmacao = formatConfirmacao(dados);
      
      expect(confirmacao).toContain('💰');
      expect(confirmacao).toContain('Receita registrada');
    });
  });

  describe('validarMensagem', () => {
    test('deve aceitar mensagem válida', () => {
      const resultado = validarMensagem('gastei R$ 50 no mercado');
      
      expect(resultado.valida).toBe(true);
    });

    test('deve rejeitar mensagem muito curta', () => {
      const resultado = validarMensagem('oi');
      
      expect(resultado.valida).toBe(false);
      expect(resultado.erro).toContain('muito curta');
    });

    test('deve rejeitar mensagem muito longa', () => {
      const mensagemLonga = 'a'.repeat(501);
      const resultado = validarMensagem(mensagemLonga);
      
      expect(resultado.valida).toBe(false);
      expect(resultado.erro).toContain('muito longa');
    });

    test('deve rejeitar null', () => {
      const resultado = validarMensagem(null);
      
      expect(resultado.valida).toBe(false);
    });

    test('deve rejeitar undefined', () => {
      const resultado = validarMensagem(undefined);
      
      expect(resultado.valida).toBe(false);
    });
  });

  describe('Casos reais', () => {
    const casosReais = [
      {
        mensagem: 'Gastei 87 reais no posto',
        esperado: { valor: 87, tipo: 'despesa', categoria: 'transporte' }
      },
      {
        mensagem: 'Comprei remédio R$ 45,50',
        esperado: { valor: 45.5, tipo: 'despesa', categoria: 'saude' }
      },
      {
        mensagem: 'Recebi 150 de freela',
        esperado: { valor: 150, tipo: 'receita' }
      },
      {
        mensagem: 'Almoço família R$ 120',
        esperado: { valor: 120, tipo: 'despesa', familiar: true }
      },
      {
        mensagem: 'Paguei 1200 de aluguel',
        esperado: { valor: 1200, tipo: 'despesa', categoria: 'moradia' }
      }
    ];

    casosReais.forEach(({ mensagem, esperado }) => {
      test(`deve parsear: "${mensagem}"`, () => {
        const resultado = parseWhatsAppMessage(mensagem);
        
        expect(resultado).not.toBeNull();
        expect(resultado.valor).toBe(esperado.valor);
        expect(resultado.tipo).toBe(esperado.tipo);
        
        if (esperado.categoria) {
          expect(resultado.categoria).toBe(esperado.categoria);
        }
        
        if (esperado.familiar !== undefined) {
          expect(resultado.familiar).toBe(esperado.familiar);
        }
      });
    });
  });
});
