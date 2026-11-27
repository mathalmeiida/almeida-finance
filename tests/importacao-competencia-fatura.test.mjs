import assert from 'node:assert/strict'
import { prepararItens, montarRegistros, normalizarExistentes, impactoNoSaldo } from '../src/lib/importacaoRegras.js'
import { normalizarComprasExistentesFatura } from '../src/lib/importacaoGravar.js'
import { conciliarTransacoes } from '../src/lib/conciliacao.js'
import { valorFaturaCartaoNoMes, limiteComprometido, totalParcelasFuturas } from '../src/lib/faturaCartao.js'
const tx = [
 { descricao:'LOJA 03/10', data:'2026-08-10', valor:100, parcelaAtual:3, parcelaTotal:10 },
 { descricao:'MERCADO', data:'2026-11-14', valor:50 },
 { descricao:'ESTORNO MERCADO', data:'2026-11-15', valor:-20, ehEstorno:true },
 { descricao:'PAGAMENTO DE FATURA', data:'2026-11-16', valor:-50 },
]
const opts = { contexto:'fatura', origem:'cartao:c1:2026-11', cartaoId:'c1', competenciaFatura:'2026-11' }
const items=prepararItens(tx,opts)
assert.equal(items.filter(x=>x.incluir).length,3)
assert.equal(items[2].tipo,'credito_fatura')
assert.equal(items[3].tipo,'pagamento_fatura')
const r=montarRegistros(items)
assert.equal(r.erros.length,0)
assert.equal(r.compras_cartao.length,3)
assert.equal(r.receitas.length+r.despesas.length,0)
const compras=r.compras_cartao.map((x,i)=>({...x.dados,id:`id${i}`}))
assert.equal(compras[0].data_compra,'2026-08-10')
assert.equal(compras[0].competencia_fatura,'2026-11')
assert.equal(compras[0].numero_parcelas,1)
assert.equal(compras[0].valor_total,100)
assert.equal(compras[2].credito_fatura,true)
assert.equal(valorFaturaCartaoNoMes(compras,20,2026,8),0)
assert.equal(valorFaturaCartaoNoMes(compras,20,2026,11),130)
assert.equal(valorFaturaCartaoNoMes(compras,20,2026,12),0)
assert.equal(totalParcelasFuturas(compras,[],20,2026,11),0)
assert.equal(limiteComprometido(compras,20,new Date('2026-11-27'),{cartaoId:'c1'}),130)
assert.equal(limiteComprometido(compras,20,new Date('2026-11-27'),{cartaoId:'c1',faturasInformadas:[{cartao_id:'c1',ano_mes:'2026-11',valor_total:130,pago:true}]}),0)
assert.equal(impactoNoSaldo(items,{hoje:'2026-11-27'}).delta,0)
const hist=new Set(items.filter(x=>x.incluir).map(x=>x.chave))
assert.equal(prepararItens(tx, {...opts,chavesImportadas:hist}).filter(x=>x.incluir).length,0)
const outro=prepararItens(tx,{...opts,origem:'cartao:c1:2026-12',competenciaFatura:'2026-12',chavesImportadas:hist})
assert.equal(outro.filter(x=>x.incluir).length,3)
const credito=normalizarExistentes('compras_cartao',[{id:'x',cartao_id:'c1',data_compra:'2026-11-14',valor_total:50,descricao:'MERCADO',credito_fatura:true}])
assert.equal(conciliarTransacoes(prepararItens(tx.slice(1,2),{...opts,existentes:credito}),credito)[0].incluir,true)
const manual = {id:'manual',cartao_id:'c1',data_compra:'2026-08-10',valor_total:300,numero_parcelas:3,descricao:'LOJA'}
assert.equal(normalizarComprasExistentesFatura([manual], '2026-11',20).length,0)
assert.deepEqual(normalizarComprasExistentesFatura([manual], '2026-10',20)[0].valores,[10000])
assert.equal(normalizarComprasExistentesFatura(compras,'2026-12',20).length,0)
console.log('OK — 24 asserções: competência, parcela, crédito, pagamento, limite, histórico e deduplicação por sinal e mês')
