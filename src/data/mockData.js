// Dados fictícios para visualização da interface

export const resumoMes = {
  receitaTotal: 6500.00,
  despesaTotal: 3200.00,
  parcelasTotal: 890.00,
  sobraPrevista: 2410.00,
}

export const receitas = [
  { id: 1, descricao: 'Salário', valor: 5500.00, data: '2026-10-05', recorrente: true, categoria: 'Salário' },
  { id: 2, descricao: 'Freelance Design', valor: 800.00, data: '2026-10-12', recorrente: false, categoria: 'Freelance' },
  { id: 3, descricao: 'Aluguel de imóvel', valor: 200.00, data: '2026-10-10', recorrente: true, categoria: 'Renda extra' },
]

export const despesas = [
  { id: 1, descricao: 'Aluguel', valor: 1200.00, data: '2026-10-05', recorrente: true, categoria: 'Moradia' },
  { id: 2, descricao: 'Supermercado', valor: 650.00, data: '2026-10-08', recorrente: false, categoria: 'Alimentação' },
  { id: 3, descricao: 'Internet', valor: 99.90, data: '2026-10-10', recorrente: true, categoria: 'Serviços' },
  { id: 4, descricao: 'Academia', valor: 89.00, data: '2026-10-01', recorrente: true, categoria: 'Saúde' },
  { id: 5, descricao: 'Gasolina', valor: 350.00, data: '2026-10-15', recorrente: false, categoria: 'Transporte' },
  { id: 6, descricao: 'Plano de saúde', valor: 320.00, data: '2026-10-01', recorrente: true, categoria: 'Saúde' },
  { id: 7, descricao: 'Streaming (Netflix, Spotify)', valor: 75.90, data: '2026-10-05', recorrente: true, categoria: 'Lazer' },
  { id: 8, descricao: 'Restaurante', valor: 210.00, data: '2026-10-20', recorrente: false, categoria: 'Alimentação' },
  { id: 9, descricao: 'Farmácia', valor: 85.20, data: '2026-10-18', recorrente: false, categoria: 'Saúde' },
  { id: 10, descricao: 'Energia elétrica', valor: 120.00, data: '2026-10-12', recorrente: true, categoria: 'Moradia' },
]

export const parcelamentos = [
  {
    id: 1,
    descricao: 'Notebook Dell',
    valorTotal: 4500.00,
    parcelas: 12,
    valorParcela: 375.00,
    primeiraParcela: '2026-05-10',
    parcelasPagas: 5,
    categoria: 'Eletrônicos',
  },
  {
    id: 2,
    descricao: 'Celular Samsung',
    valorTotal: 2400.00,
    parcelas: 10,
    valorParcela: 240.00,
    primeiraParcela: '2026-07-15',
    parcelasPagas: 3,
    categoria: 'Eletrônicos',
  },
  {
    id: 3,
    descricao: 'Sofá',
    valorTotal: 1750.00,
    parcelas: 5,
    valorParcela: 275.00,
    primeiraParcela: '2026-09-01',
    parcelasPagas: 1,
    categoria: 'Móveis',
  },
  {
    id: 4,
    descricao: 'Curso Online',
    valorTotal: 897.00,
    parcelas: 3,
    valorParcela: 299.00,
    primeiraParcela: '2026-10-01',
    parcelasPagas: 0,
    categoria: 'Educação',
  },
]

export const projecao12Meses = [
  { mes: 'Out/26', receitas: 6500, despesas: 4090, saldo: 2410 },
  { mes: 'Nov/26', receitas: 6500, despesas: 4090, saldo: 2410 },
  { mes: 'Dez/26', receitas: 7000, despesas: 5200, saldo: 1800 },
  { mes: 'Jan/27', receitas: 6500, despesas: 3900, saldo: 2600 },
  { mes: 'Fev/27', receitas: 6500, despesas: 3750, saldo: 2750 },
  { mes: 'Mar/27', receitas: 6500, despesas: 3600, saldo: 2900 },
  { mes: 'Abr/27', receitas: 6500, despesas: 3600, saldo: 2900 },
  { mes: 'Mai/27', receitas: 6800, despesas: 3600, saldo: 3200 },
  { mes: 'Jun/27', receitas: 6800, despesas: 3750, saldo: 3050 },
  { mes: 'Jul/27', receitas: 6800, despesas: 3600, saldo: 3200 },
  { mes: 'Ago/27', receitas: 6800, despesas: 3600, saldo: 3200 },
  { mes: 'Set/27', receitas: 6800, despesas: 3600, saldo: 3200 },
]

export const metas = [
  {
    id: 1,
    nome: 'Reserva de emergência',
    valorDesejado: 20000.00,
    valorAtual: 8500.00,
    prazo: '2027-12-01',
    cor: '#2563eb',
  },
  {
    id: 2,
    nome: 'Viagem para Europa',
    valorDesejado: 15000.00,
    valorAtual: 3200.00,
    prazo: '2028-06-01',
    cor: '#7c3aed',
  },
  {
    id: 3,
    nome: 'Troca de carro',
    valorDesejado: 35000.00,
    valorAtual: 12000.00,
    prazo: '2029-01-01',
    cor: '#059669',
  },
]

export const categoriasDespesa = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Serviços',
  'Vestuário',
  'Eletrônicos',
  'Móveis',
  'Outros',
]

// Observação: utilitários de formatação (formatCurrency/formatDate) foram
// removidos daqui — a formatação oficial do app vive em src/lib/utils.js, que
// respeita o "Ocultar valores". Mantê-los aqui era código morto (nenhum import)
// e um risco de, por engano, burlar a máscara de privacidade.
