/**
 * Testes unitários - Divisão Financeira
 * Valida cálculos em centavos e distribuição de resto
 */

import { useFamilyExpenseSplits } from '../../hooks/useFamilyExpenseSplits';

describe('Divisão Financeira - Centavos', () => {
  // Mock do hook (apenas testando lógica de divisão)
  const { dividirIgualmente, dividirPorPercentual } = useFamilyExpenseSplits(null);

  describe('dividirIgualmente', () => {
    test('R$ 100,00 entre 2 pessoas', () => {
      const participantes = [
        { user_id: 'user1' },
        { user_id: 'user2' }
      ];
      
      const resultado = dividirIgualmente(100, participantes);
      
      expect(resultado).toHaveLength(2);
      expect(resultado[0].valor_devido).toBe(5000); // 50.00 em centavos
      expect(resultado[1].valor_devido).toBe(5000);
      
      // Soma = total
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(10000);
    });

    test('R$ 100,00 entre 3 pessoas (com resto)', () => {
      const participantes = [
        { user_id: 'user1' },
        { user_id: 'user2' },
        { user_id: 'user3' }
      ];
      
      const resultado = dividirIgualmente(100, participantes);
      
      expect(resultado).toHaveLength(3);
      
      // 10000 / 3 = 3333.33...
      // Distribuição: 3334, 3333, 3333 (resto de 1 centavo para primeiro)
      expect(resultado[0].valor_devido).toBe(3334);
      expect(resultado[1].valor_devido).toBe(3333);
      expect(resultado[2].valor_devido).toBe(3333);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(10000);
    });

    test('R$ 199,99 entre 3 pessoas', () => {
      const participantes = [
        { user_id: 'user1' },
        { user_id: 'user2' },
        { user_id: 'user3' }
      ];
      
      const resultado = dividirIgualmente(199.99, participantes);
      
      // 19999 / 3 = 6666.33...
      // Distribuição: 6667, 6666, 6666
      expect(resultado[0].valor_devido).toBe(6667);
      expect(resultado[1].valor_devido).toBe(6666);
      expect(resultado[2].valor_devido).toBe(6666);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(19999);
    });

    test('R$ 0,03 entre 2 pessoas', () => {
      const participantes = [
        { user_id: 'user1' },
        { user_id: 'user2' }
      ];
      
      const resultado = dividirIgualmente(0.03, participantes);
      
      // 3 / 2 = 1.5 -> 1 + 1 + resto 1
      expect(resultado[0].valor_devido).toBe(2); // primeiro leva resto
      expect(resultado[1].valor_devido).toBe(1);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(3);
    });

    test('R$ 1.000.000,00 entre 7 pessoas', () => {
      const participantes = Array.from({ length: 7 }, (_, i) => ({
        user_id: `user${i + 1}`
      }));
      
      const resultado = dividirIgualmente(1000000, participantes);
      
      // 100000000 / 7 = 14285714.28...
      // Distribuição: 6x 14285714 + 1x 14285716 (resto de 2)
      const valores = resultado.map(r => r.valor_devido);
      const soma = valores.reduce((acc, v) => acc + v, 0);
      
      expect(soma).toBe(100000000);
      expect(Math.max(...valores) - Math.min(...valores)).toBeLessThanOrEqual(1);
    });
  });

  describe('dividirPorPercentual', () => {
    test('50% / 50%', () => {
      const participantes = [
        { user_id: 'user1', percentual: 50 },
        { user_id: 'user2', percentual: 50 }
      ];
      
      const resultado = dividirPorPercentual(100, participantes);
      
      expect(resultado[0].valor_devido).toBe(5000);
      expect(resultado[1].valor_devido).toBe(5000);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(10000);
    });

    test('33.33% / 33.33% / 33.34% (último leva resto)', () => {
      const participantes = [
        { user_id: 'user1', percentual: 33.33 },
        { user_id: 'user2', percentual: 33.33 },
        { user_id: 'user3', percentual: 33.34 }
      ];
      
      const resultado = dividirPorPercentual(100, participantes);
      
      // Primeiro e segundo: 33.33% de 10000 = 3333
      // Último recebe resto: 10000 - 3333 - 3333 = 3334
      expect(resultado[0].valor_devido).toBe(3333);
      expect(resultado[1].valor_devido).toBe(3333);
      expect(resultado[2].valor_devido).toBe(3334);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(10000);
    });

    test('70% / 30%', () => {
      const participantes = [
        { user_id: 'user1', percentual: 70 },
        { user_id: 'user2', percentual: 30 }
      ];
      
      const resultado = dividirPorPercentual(100, participantes);
      
      expect(resultado[0].valor_devido).toBe(7000);
      expect(resultado[1].valor_devido).toBe(3000);
      
      const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
      expect(soma).toBe(10000);
    });

    test('Uma pessoa paga tudo (100%)', () => {
      const participantes = [
        { user_id: 'user1', percentual: 100 }
      ];
      
      const resultado = dividirPorPercentual(100, participantes);
      
      expect(resultado[0].valor_devido).toBe(10000);
    });
  });

  describe('calcularBalanco', () => {
    test('A paga R$ 100, B deve R$ 50', () => {
      const divisoes = [
        {
          id: 'split1',
          valor_total: 10000,
          paid_by: 'userA',
          family_split_participants: [
            { participant_id: 'userA', valor_devido: 5000, pago: true },
            { participant_id: 'userB', valor_devido: 5000, pago: false }
          ]
        }
      ];
      
      const { calcularBalanco } = useFamilyExpenseSplits(null);
      const saldos = calcularBalanco(divisoes);
      
      // A pagou 10000, deve 5000 = crédito de 5000
      expect(saldos.userA).toBe(5000);
      // B não pagou, deve 5000 = débito de -5000
      expect(saldos.userB).toBe(-5000);
    });

    test('A paga R$ 100, B paga sua parte', () => {
      const divisoes = [
        {
          id: 'split1',
          valor_total: 10000,
          paid_by: 'userA',
          family_split_participants: [
            { participant_id: 'userA', valor_devido: 5000, pago: true },
            { participant_id: 'userB', valor_devido: 5000, pago: true }
          ]
        }
      ];
      
      const { calcularBalanco } = useFamilyExpenseSplits(null);
      const saldos = calcularBalanco(divisoes);
      
      // Ambos quitados
      expect(saldos.userA).toBe(5000); // pagou 10000, devia 5000
      expect(saldos.userB).toBe(0); // pagou 5000, devia 5000
    });

    test('Múltiplas despesas, acerto parcial', () => {
      const divisoes = [
        {
          id: 'split1',
          valor_total: 10000, // A paga mercado R$ 100
          paid_by: 'userA',
          family_split_participants: [
            { participant_id: 'userA', valor_devido: 5000, pago: true },
            { participant_id: 'userB', valor_devido: 5000, pago: false }
          ]
        },
        {
          id: 'split2',
          valor_total: 6000, // B paga luz R$ 60
          paid_by: 'userB',
          family_split_participants: [
            { participant_id: 'userA', valor_devido: 3000, pago: false },
            { participant_id: 'userB', valor_devido: 3000, pago: true }
          ]
        }
      ];
      
      const { calcularBalanco } = useFamilyExpenseSplits(null);
      const saldos = calcularBalanco(divisoes);
      
      // A: pagou 10000, deve 8000 (5000 + 3000) = crédito 2000
      expect(saldos.userA).toBe(2000);
      // B: pagou 6000, deve 8000 (5000 + 3000) = débito -2000
      expect(saldos.userB).toBe(-2000);
    });
  });
});
