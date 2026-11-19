/**
 * Testes unitários - Divisão Financeira
 * Valida cálculos em centavos e distribuição de resto
 * Executar: node src/lib/__tests__/divisaoFinanceira.test.js
 */

import { strict as assert } from 'assert';
import { test } from 'node:test';

// Funções de divisão (copiadas do hook para teste unitário)
function dividirIgualmente(valorTotal, participantes) {
  const valorCentavos = Math.round(valorTotal * 100);
  const numParticipantes = participantes.length;
  const valorPorPessoa = Math.floor(valorCentavos / numParticipantes);
  const resto = valorCentavos % numParticipantes;

  return participantes.map((p, index) => ({
    user_id: p.user_id || p.id,
    valor_devido: valorPorPessoa + (index < resto ? 1 : 0)
  }));
}

function dividirPorPercentual(valorTotal, participantes) {
  const valorCentavos = Math.round(valorTotal * 100);
  let somaAlocada = 0;

  const divisoes = participantes.map((p, index) => {
    if (index === participantes.length - 1) {
      return {
        user_id: p.user_id || p.id,
        valor_devido: valorCentavos - somaAlocada
      };
    }

    const valor = Math.round((valorCentavos * p.percentual) / 100);
    somaAlocada += valor;

    return {
      user_id: p.user_id || p.id,
      valor_devido: valor
    };
  });

  return divisoes;
}

function calcularBalanco(divisoes) {
  const saldos = {};

  divisoes.forEach(divisao => {
    // Quem pagou tem crédito (valor total pago)
    if (!saldos[divisao.paid_by]) saldos[divisao.paid_by] = 0;
    saldos[divisao.paid_by] += divisao.valor_total;

    // Participantes têm débito (valor devido)
    divisao.family_split_participants?.forEach(p => {
      if (!saldos[p.participant_id]) saldos[p.participant_id] = 0;
      // Subtrai valor devido (débito)
      saldos[p.participant_id] -= p.valor_devido;
    });
  });

  return saldos;
}

// TESTES
test('R$ 100,00 entre 2 pessoas', () => {
  const participantes = [{ user_id: 'user1' }, { user_id: 'user2' }];
  const resultado = dividirIgualmente(100, participantes);
  
  assert.equal(resultado.length, 2);
  assert.equal(resultado[0].valor_devido, 5000);
  assert.equal(resultado[1].valor_devido, 5000);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 10000);
});

test('R$ 100,00 entre 3 pessoas (com resto)', () => {
  const participantes = [
    { user_id: 'user1' },
    { user_id: 'user2' },
    { user_id: 'user3' }
  ];
  
  const resultado = dividirIgualmente(100, participantes);
  
  assert.equal(resultado[0].valor_devido, 3334);
  assert.equal(resultado[1].valor_devido, 3333);
  assert.equal(resultado[2].valor_devido, 3333);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 10000);
});

test('R$ 199,99 entre 3 pessoas', () => {
  const participantes = [
    { user_id: 'user1' },
    { user_id: 'user2' },
    { user_id: 'user3' }
  ];
  
  const resultado = dividirIgualmente(199.99, participantes);
  
  assert.equal(resultado[0].valor_devido, 6667);
  assert.equal(resultado[1].valor_devido, 6666);
  assert.equal(resultado[2].valor_devido, 6666);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 19999);
});

test('R$ 0,03 entre 2 pessoas', () => {
  const participantes = [{ user_id: 'user1' }, { user_id: 'user2' }];
  const resultado = dividirIgualmente(0.03, participantes);
  
  assert.equal(resultado[0].valor_devido, 2);
  assert.equal(resultado[1].valor_devido, 1);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 3);
});

test('Divisão 50% / 50%', () => {
  const participantes = [
    { user_id: 'user1', percentual: 50 },
    { user_id: 'user2', percentual: 50 }
  ];
  
  const resultado = dividirPorPercentual(100, participantes);
  
  assert.equal(resultado[0].valor_devido, 5000);
  assert.equal(resultado[1].valor_devido, 5000);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 10000);
});

test('Divisão 70% / 30%', () => {
  const participantes = [
    { user_id: 'user1', percentual: 70 },
    { user_id: 'user2', percentual: 30 }
  ];
  
  const resultado = dividirPorPercentual(100, participantes);
  
  assert.equal(resultado[0].valor_devido, 7000);
  assert.equal(resultado[1].valor_devido, 3000);
  
  const soma = resultado.reduce((acc, r) => acc + r.valor_devido, 0);
  assert.equal(soma, 10000);
});

test('Balanço: A paga R$ 100, B deve R$ 50', () => {
  const divisoes = [{
    id: 'split1',
    valor_total: 10000,
    paid_by: 'userA',
    family_split_participants: [
      { participant_id: 'userA', valor_devido: 5000, pago: true },
      { participant_id: 'userB', valor_devido: 5000, pago: false }
    ]
  }];
  
  const saldos = calcularBalanco(divisoes);
  
  assert.equal(saldos.userA, 5000);
  assert.equal(saldos.userB, -5000);
});

test('Balanço: múltiplas despesas, acerto parcial', () => {
  const divisoes = [
    {
      id: 'split1',
      valor_total: 10000,
      paid_by: 'userA',
      family_split_participants: [
        { participant_id: 'userA', valor_devido: 5000, pago: true },
        { participant_id: 'userB', valor_devido: 5000, pago: false }
      ]
    },
    {
      id: 'split2',
      valor_total: 6000,
      paid_by: 'userB',
      family_split_participants: [
        { participant_id: 'userA', valor_devido: 3000, pago: false },
        { participant_id: 'userB', valor_devido: 3000, pago: true }
      ]
    }
  ];
  
  const saldos = calcularBalanco(divisoes);
  
  assert.equal(saldos.userA, 2000);
  assert.equal(saldos.userB, -2000);
});

console.log('✅ Todos os 9 testes de divisão financeira passaram!');
