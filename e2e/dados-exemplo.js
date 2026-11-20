// Dados de exemplo para os diagnósticos de layout (nenhum dado real).
import { USUARIO_TESTE } from './apoio.js'

const U = USUARIO_TESTE.id
export const DADOS = {
  receitas: [{ id: 'r1', usuario_id: U, descricao: 'Salário', valor: 5000, data: '2026-11-05', recorrente: true, frequencia: 'mensal' }],
  despesas: [
    { id: 'd1', usuario_id: U, descricao: 'Aluguel do apartamento', valor: 1200, data: '2026-11-05', recorrente: true, frequencia: 'mensal', tipo_despesa: 'fixa', forma_pagamento: 'pix' },
    { id: 'd2', usuario_id: U, descricao: 'Supermercado', valor: 350, data: '2026-11-12', recorrente: false, tipo_despesa: 'variavel', forma_pagamento: 'cartao_debito' },
  ],
  cartoes: [{ id: 'c1', usuario_id: U, nome: 'Visa Platinum', limite_total: 5000, dia_fechamento: 20, dia_vencimento: 28, cor: '#6366f1', criado_em: '2026-11-01T00:00:00Z' }],
  compras_cartao: [{ id: 'k1', usuario_id: U, cartao_id: 'c1', descricao: 'Celular', valor_total: 1200, data_compra: '2026-11-15', numero_parcelas: 3, criado_em: '2026-11-15T10:00:00Z' }],
}
