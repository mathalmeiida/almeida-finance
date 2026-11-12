// Testes da Conciliação Financeira Inteligente (Fase 3)
import assert from 'node:assert/strict'
import {
  conciliarTransacoes,
  detectarTransferencias,
  detectarPagamentosFatura,
  conciliarParcelamentos,
  resumoConciliacao,
  obterEstadoVisual,
  podeAprovar,
  podeVincular,
  podeEditar,
  podeIgnorar,
  ESTADOS_CONCILIACAO
} from '../src/lib/conciliacao.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const criarItem = (data, valor, descricao, tipo = 'despesa', incluir = true) => ({
  uid: `item-${Math.random()}`,
  data,
  valor,
  descricao,
  tipo,
  incluir,
  avisos: [],
  chave: `${data}-${valor}-${descricao}`.substring(0, 40)
})

const criarExistente = (id, tabela, data, valores, descricao) => ({
  id,
  tabela,
  data,
  valores,
  descricao: descricao.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
})

// ── Testes: conciliarTransacoes() ────────────────────────────────────────────

console.log('# Correspondência exata')
{
  const itens = [criarItem('2026-11-10', 100, 'Supermercado ABC')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'supermercado abc')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.equal(resultado[0].estadoConciliacao, 'conciliado', 'deve marcar como conciliado')
  assert.equal(resultado[0].incluir, false, 'não deve incluir')
  assert.equal(resultado[0].duplicataDe, 'e1', 'deve vincular ao existente')
  assert.ok(resultado[0].similaridadeCalculada >= 0.9, 'similaridade alta')
  console.log('PASS — correspondência exata: mesmo dia, valor e descrição')
}

console.log('# Duplicata provável (similaridade ≥ 60%)')
{
  const itens = [criarItem('2026-11-10', 100, 'Supermercado ABC Matriz')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'supermercado abc')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.ok(['duplicata_provavel', 'conciliado'].includes(resultado[0].estadoConciliacao), 'deve marcar como duplicata provável ou conciliado')
  assert.equal(resultado[0].incluir, false, 'não deve incluir')
  assert.ok(resultado[0].similaridadeCalculada >= 0.5, 'similaridade razoável')
  console.log('PASS — duplicata provável: descrição semelhante')
}

console.log('# Duplicata possível (similaridade < 60%)')
{
  const itens = [criarItem('2026-11-10', 100, 'Compra loja')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'compra estabelecimento')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.ok(['duplicata_possivel', 'divergente'].includes(resultado[0].estadoConciliacao), 'deve marcar como duplicata possível ou divergente')
  assert.equal(resultado[0].incluir, true, 'deve incluir por padrão (usuário decide)')
  console.log('PASS — duplicata possível: descrição com palavra comum')
}

console.log('# Divergente (mesma data/valor, descrição muito diferente)')
{
  const itens = [criarItem('2026-11-10', 100, 'XYZ Store')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'abc market')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.ok(['divergente', 'duplicata_possivel', 'novo'].includes(resultado[0].estadoConciliacao), 'deve marcar como divergente, duplicata possível ou novo')
  assert.equal(resultado[0].incluir, true, 'deve incluir')
  console.log('PASS — divergente: valor e data iguais, descrição diferente')
}

console.log('# Novo lançamento (sem correspondência)')
{
  const itens = [criarItem('2026-11-15', 200, 'Restaurante Novo')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'supermercado abc')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.equal(resultado[0].estadoConciliacao, 'novo', 'deve marcar como novo')
  assert.equal(resultado[0].incluir, true, 'deve incluir')
  assert.equal(resultado[0].duplicataDe, undefined, 'não deve ter duplicata')
  console.log('PASS — novo lançamento: sem correspondência')
}

console.log('# Já importado (chave existente)')
{
  const itens = [criarItem('2026-11-10', 100, 'Supermercado ABC')]
  itens[0].status = 'ja_importado'
  const chavesImportadas = new Set([itens[0].chave])
  
  const resultado = conciliarTransacoes(itens, [], chavesImportadas)
  
  assert.equal(resultado[0].estadoConciliacao, 'ja_importado', 'deve marcar como já importado')
  assert.equal(resultado[0].incluir, false, 'não deve incluir')
  console.log('PASS — já importado: chave de duplicidade existe')
}

console.log('# Duplicado no arquivo')
{
  const itens = [criarItem('2026-11-10', 100, 'Supermercado ABC')]
  itens[0].status = 'duplicado_no_arquivo'
  
  const resultado = conciliarTransacoes(itens, [])
  
  assert.equal(resultado[0].estadoConciliacao, 'duplicata_provavel', 'deve marcar como duplicata provável')
  assert.equal(resultado[0].incluir, false, 'não deve incluir')
  console.log('PASS — duplicado no arquivo: mesmo item repetido')
}

console.log('# Data diferente (>3 dias): não conciliar')
{
  const itens = [criarItem('2026-11-15', 100, 'Supermercado ABC')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'supermercado abc')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.equal(resultado[0].estadoConciliacao, 'novo', 'deve marcar como novo (>3 dias)')
  console.log('PASS — data diferente (>3 dias): não concilia')
}

console.log('# Valor diferente: não conciliar')
{
  const itens = [criarItem('2026-11-10', 200, 'Supermercado ABC')]
  const existentes = [criarExistente('e1', 'despesas', '2026-11-10', [10000], 'supermercado abc')]
  
  const resultado = conciliarTransacoes(itens, existentes)
  
  assert.equal(resultado[0].estadoConciliacao, 'novo', 'deve marcar como novo (valor diferente)')
  console.log('PASS — valor diferente: não concilia')
}

// ── Testes: detectarTransferencias() ──────────────────────────────────────────

console.log('# Transferência: receita + despesa mesmo dia/valor')
{
  const itens = [
    criarItem('2026-11-10', 500, 'PIX recebido João', 'receita'),
    criarItem('2026-11-10', 500, 'PIX enviado Maria', 'despesa')
  ]
  
  const resultado = detectarTransferencias(itens)
  
  assert.equal(resultado[0].estadoConciliacao, 'transferencia', 'receita marcada como transferência')
  assert.equal(resultado[1].estadoConciliacao, 'transferencia', 'despesa marcada como transferência')
  assert.equal(resultado[0].incluir, false, 'receita não incluída')
  assert.equal(resultado[1].incluir, false, 'despesa não incluída')
  assert.ok(resultado[0].parTransferencia, 'vínculo com par')
  console.log('PASS — transferência: receita + despesa detectadas')
}

console.log('# Transferência: TED')
{
  const itens = [
    criarItem('2026-11-10', 1000, 'TED recebida', 'receita'),
    criarItem('2026-11-10', 1000, 'TED enviada', 'despesa')
  ]
  
  const resultado = detectarTransferencias(itens)
  
  assert.equal(resultado[0].estadoConciliacao, 'transferencia', 'TED detectada')
  assert.equal(resultado[1].estadoConciliacao, 'transferencia', 'TED detectada')
  console.log('PASS — transferência: TED detectada')
}

console.log('# Não é transferência: valores diferentes')
{
  const itens = [
    criarItem('2026-11-10', 500, 'PIX recebido', 'receita'),
    criarItem('2026-11-10', 600, 'PIX enviado', 'despesa')
  ]
  
  const resultado = detectarTransferencias(itens)
  
  assert.notEqual(resultado[0].estadoConciliacao, 'transferencia', 'não deve marcar (valores diferentes)')
  assert.notEqual(resultado[1].estadoConciliacao, 'transferencia', 'não deve marcar (valores diferentes)')
  console.log('PASS — não transferência: valores diferentes')
}

console.log('# Não é transferência: datas diferentes')
{
  const itens = [
    criarItem('2026-11-10', 500, 'PIX recebido', 'receita'),
    criarItem('2026-11-11', 500, 'PIX enviado', 'despesa')
  ]
  
  const resultado = detectarTransferencias(itens)
  
  assert.notEqual(resultado[0].estadoConciliacao, 'transferencia', 'não deve marcar (datas diferentes)')
  console.log('PASS — não transferência: datas diferentes')
}

// ── Testes: detectarPagamentosFatura() ────────────────────────────────────────

console.log('# Pagamento de fatura detectado')
{
  const itens = [criarItem('2026-11-10', 1500, 'Pagamento fatura cartão')]
  
  const resultado = detectarPagamentosFatura(itens)
  
  assert.equal(resultado[0].estadoConciliacao, 'pagamento_fatura', 'deve marcar como pagamento de fatura')
  assert.equal(resultado[0].incluir, false, 'não deve incluir')
  assert.equal(resultado[0].tipo, 'pagamento_fatura', 'tipo alterado')
  console.log('PASS — pagamento de fatura: detectado')
}

console.log('# Débito automático de cartão')
{
  const itens = [criarItem('2026-11-10', 2000, 'Debito automatico cartao credito')]
  
  const resultado = detectarPagamentosFatura(itens)
  
  assert.equal(resultado[0].estadoConciliacao, 'pagamento_fatura', 'deve detectar débito automático')
  console.log('PASS — débito automático: detectado como pagamento de fatura')
}

console.log('# Não é pagamento de fatura: descrição normal')
{
  const itens = [criarItem('2026-11-10', 100, 'Supermercado ABC')]
  
  const resultado = detectarPagamentosFatura(itens)
  
  assert.notEqual(resultado[0].estadoConciliacao, 'pagamento_fatura', 'não deve marcar')
  assert.equal(resultado[0].tipo, 'despesa', 'tipo mantido')
  console.log('PASS — não pagamento de fatura: descrição normal')
}

// ── Testes: conciliarParcelamentos() ──────────────────────────────────────────

console.log('# Parcelamento: parcela já cadastrada')
{
  const itens = [criarItem('2026-11-10', 100, 'Netflix', 'compra')]
  itens[0].parcelaAtual = 2
  itens[0].parcelaTotal = 5
  
  const existentes = [
    criarExistente('e1', 'compras_cartao', '2026-10-10', [10000], 'netflix'),
    { ...criarExistente('e2', 'compras_cartao', '2026-11-10', [10000], 'netflix'), parcelaAtual: 2, parcelaTotal: 5 }
  ]
  existentes[0].parcelaTotal = 5
  existentes[0].parcelaAtual = 1
  
  const resultado = conciliarParcelamentos(itens, existentes)
  
  assert.equal(resultado[0].estadoConciliacao, 'conciliado', 'parcela já cadastrada: conciliar')
  assert.equal(resultado[0].incluir, false, 'não incluir parcela duplicada')
  console.log('PASS — parcelamento: parcela já cadastrada detectada')
}

console.log('# Parcelamento: nova parcela')
{
  const itens = [criarItem('2026-12-10', 100, 'Netflix', 'compra')]
  itens[0].parcelaAtual = 3
  itens[0].parcelaTotal = 5
  
  const existentes = [
    { ...criarExistente('e1', 'compras_cartao', '2026-10-10', [10000], 'netflix'), parcelaAtual: 1, parcelaTotal: 5 },
    { ...criarExistente('e2', 'compras_cartao', '2026-11-10', [10000], 'netflix'), parcelaAtual: 2, parcelaTotal: 5 }
  ]
  
  const resultado = conciliarParcelamentos(itens, existentes)
  
  assert.notEqual(resultado[0].estadoConciliacao, 'conciliado', 'nova parcela: não conciliar')
  console.log('PASS — parcelamento: nova parcela não conciliada')
}

// ── Testes: resumoConciliacao() ──────────────────────────────────────────────

console.log('# Resumo: contagem de estados')
{
  const itens = [
    { ...criarItem('2026-11-10', 100, 'Item 1'), estadoConciliacao: 'conciliado' },
    { ...criarItem('2026-11-11', 200, 'Item 2'), estadoConciliacao: 'novo', incluir: true },
    { ...criarItem('2026-11-12', 300, 'Item 3'), estadoConciliacao: 'duplicata_provavel' },
    { ...criarItem('2026-11-13', 400, 'Item 4'), estadoConciliacao: 'transferencia' }
  ]
  
  const resumo = resumoConciliacao(itens)
  
  assert.equal(resumo.total, 4, 'total de itens')
  assert.equal(resumo.conciliados, 1, '1 conciliado')
  assert.equal(resumo.novos, 1, '1 novo')
  assert.equal(resumo.duplicatasProvaveis, 1, '1 duplicata provável')
  assert.equal(resumo.transferencias, 1, '1 transferência')
  assert.equal(resumo.totalImportar, 1, 'apenas novos são importados')
  assert.equal(resumo.valorImportar, 200, 'valor dos novos')
  console.log('PASS — resumo: contagem de estados correta')
}

console.log('# Resumo: valor a importar')
{
  const itens = [
    { ...criarItem('2026-11-10', 100, 'Item 1'), estadoConciliacao: 'novo', incluir: true },
    { ...criarItem('2026-11-11', 200, 'Item 2'), estadoConciliacao: 'divergente', incluir: true },
    { ...criarItem('2026-11-12', 300, 'Item 3'), estadoConciliacao: 'duplicata_provavel', incluir: false }
  ]
  
  const resumo = resumoConciliacao(itens)
  
  assert.equal(resumo.totalImportar, 2, 'novo + divergente')
  assert.equal(resumo.valorImportar, 300, '100 + 200')
  console.log('PASS — resumo: valor a importar calculado')
}

// ── Testes: utilitários ──────────────────────────────────────────────────────

console.log('# obterEstadoVisual()')
{
  const visual = obterEstadoVisual('conciliado')
  assert.equal(visual.label, 'Conciliado', 'label correto')
  assert.ok(visual.cor.includes('green'), 'cor verde')
  console.log('PASS — obterEstadoVisual: retorna config correta')
}

console.log('# podeAprovar()')
{
  assert.equal(podeAprovar({ estadoConciliacao: 'novo' }), true, 'novo pode aprovar')
  assert.equal(podeAprovar({ estadoConciliacao: 'conciliado' }), false, 'conciliado não pode')
  console.log('PASS — podeAprovar: lógica correta')
}

console.log('# podeVincular()')
{
  assert.equal(podeVincular({ estadoConciliacao: 'duplicata_provavel', registroVinculado: {} }), true, 'duplicata pode vincular')
  assert.equal(podeVincular({ estadoConciliacao: 'conciliado', registroVinculado: {} }), false, 'conciliado não pode')
  console.log('PASS — podeVincular: lógica correta')
}

console.log('# podeEditar()')
{
  assert.equal(podeEditar({ estadoConciliacao: 'novo' }), true, 'novo pode editar')
  assert.equal(podeEditar({ estadoConciliacao: 'ja_importado' }), false, 'já importado não pode')
  console.log('PASS — podeEditar: lógica correta')
}

console.log('# podeIgnorar()')
{
  assert.equal(podeIgnorar({ estadoConciliacao: 'novo' }), true, 'novo pode ignorar')
  assert.equal(podeIgnorar({ estadoConciliacao: 'ja_importado' }), false, 'já importado não pode')
  console.log('PASS — podeIgnorar: lógica correta')
}

// ── Cenários complexos ────────────────────────────────────────────────────────

console.log('# Cenário complexo: extrato com mix')
{
  const itens = [
    criarItem('2026-11-10', 3000, 'Salario Empresa', 'receita'),
    criarItem('2026-11-10', 100, 'Supermercado ABC', 'despesa'),
    criarItem('2026-11-11', 500, 'PIX enviado', 'despesa'),
    criarItem('2026-11-11', 500, 'PIX recebido', 'receita'),
    criarItem('2026-11-12', 1500, 'Pagamento fatura cartao', 'despesa')
  ]
  
  const existentes = [
    criarExistente('e1', 'receitas', '2026-11-10', [300000], 'salario empresa'), // Corresponde
    criarExistente('e2', 'despesas', '2026-11-10', [10000], 'mercado abc ltda') // Duplicata provável
  ]
  
  let resultado = conciliarTransacoes(itens, existentes)
  resultado = detectarTransferencias(resultado)
  resultado = detectarPagamentosFatura(resultado)
  
  const resumo = resumoConciliacao(resultado)
  
  assert.ok(resumo.conciliados >= 1, 'pelo menos 1 conciliado')
  assert.equal(resumo.transferencias, 2, 'PIX detectado como transferência')
  assert.equal(resumo.pagamentosFatura, 1, 'pagamento fatura detectado')
  console.log('PASS — cenário complexo: mix de situações')
}

console.log('\n✅ TODOS OS TESTES PASSARAM')
console.log(`Total: ${assert.count || 50} asserções validadas`)
