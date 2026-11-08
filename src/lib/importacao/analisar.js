// ─── Análise: classificação, duplicidades, recorrência e vínculos ───────────
// Recebe os itens interpretados + dados JÁ cadastrados (lidos com RLS) e
// prepara a prévia. Função pura: não grava nada.

import {
  normalizarDescricao, similaridadeDescricao, diferencaDias, chaveAprendizado, arred2, adicionarMeses,
} from './normalizar.js'
import { classificarItem, indexarRegrasUsuario } from './classificar.js'
import { classificarDespesa } from '../classificarDespesa.js'

// Mesma regra de competenciaPrimeiraParcela (src/lib/faturaCartao.js), copiada
// aqui porque aquele módulo importa hooks com Supabase e não roda nos testes
// em Node. Compra até o dia de fechamento entra no ciclo do próprio mês.
function competenciaPrimeiraParcela(dataCompra, diaFechamento) {
  const [ano0, mes0, dia] = dataCompra.split('-').map(Number)
  let ano = ano0, mes = mes0
  const fechamento = Math.max(1, Math.min(31, Number(diaFechamento) || 20))
  const diaEfetivo = Math.min(fechamento, new Date(ano, mes, 0).getDate())
  if (dia > diaEfetivo) {
    mes += 1
    if (mes > 12) { mes = 1; ano += 1 }
  }
  return { ano, mes }
}

// ─── Impressão digital (identifica o mesmo lançamento em importações futuras)

function fnv1a64(texto) {
  let h = 0xcbf29ce484222325n
  const p = 0x100000001b3n
  for (let i = 0; i < texto.length; i++) {
    h ^= BigInt(texto.charCodeAt(i))
    h = (h * p) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

export function impressaoDigital(item, instituicao, ordinal = 0) {
  const base = [
    item.documento,
    normalizarDescricao(instituicao || ''),
    item.idExterno || '',
    item.data || '',
    Number(item.valor || 0).toFixed(2),
    normalizarDescricao(item.descricaoOriginal || item.descricao),
    item.natureza,
  ].join('|')
  return `${fnv1a64(base)}${ordinal ? `-${ordinal}` : ''}`
}

function atribuirImpressoes(itens, instituicao) {
  const vistos = new Map()
  for (const it of itens) {
    const semOrdinal = impressaoDigital(it, it.instituicaoDoc ?? instituicao)
    const n = vistos.get(semOrdinal) || 0
    vistos.set(semOrdinal, n + 1)
    it.impressao = n === 0 ? semOrdinal : `${semOrdinal}-${n}`
  }
}

// ─── Classificação ───────────────────────────────────────────────────────────

export function aplicarClassificacao(item, ctx) {
  if (!['despesas', 'receitas', 'compras_cartao'].includes(item.destino)) {
    item.categoriaId = null; item.categoriaNome = null; item.confiancaCategoria = null
    return item
  }
  const c = classificarItem({ descricao: item.descricao, destino: item.destino }, ctx)
  item.categoriaId = c.categoriaId
  item.categoriaNome = c.categoriaNome
  item.confiancaCategoria = c.confianca
  item.origemCategoria = c.origem
  item.categoriaSugeridaId = c.categoriaId
  item.categoriaSugeridaNome = c.categoriaNome
  if (item.destino === 'despesas') {
    item.tipoDespesa = c.fixa ? 'fixa' : classificarDespesa({ descricao: item.descricao, categoria: c.categoriaNome || '' })
  }
  return item
}

// ─── Duplicidades ────────────────────────────────────────────────────────────

export const NIVEIS_DUPLICIDADE = {
  certa: 'Já importado',
  provavel: 'Provável duplicidade',
  possivel: 'Possível duplicidade',
}

function pontuarSimples(item, ex, campos) {
  const valorEx = Number(ex[campos.valor])
  const dataEx = ex[campos.data]
  if (!item.data || !dataEx || !Number.isFinite(valorEx)) return null
  const mesmoValor = Math.abs(valorEx - item.valor) < 0.005
  if (!mesmoValor) return null
  const dd = Math.abs(diferencaDias(item.data, dataEx))
  const sim = similaridadeDescricao(item.descricao, ex.descricao)
  if (dd === 0 && sim >= 0.5) return { nivel: 'provavel', pontos: 0.9 + sim / 100, motivo: 'Mesma data, valor e descrição semelhante' }
  if (dd <= 3 && sim >= 0.5) return { nivel: 'possivel', pontos: 0.7 + sim / 100, motivo: `Mesmo valor e descrição semelhante, ${dd} dia(s) de diferença` }
  // Mesmo valor e data com descrição diferente NÃO é tratado como o mesmo
  // lançamento: apenas sinalizamos para conferência.
  if (dd === 0) return { nivel: 'possivel', pontos: 0.5, motivo: 'Mesmo valor e data, descrição diferente' }
  return null
}

function competencia(iso) { return iso ? iso.slice(0, 7) : '' }

/**
 * Marca duplicidades com pareamento 1-para-1: cada registro existente só
 * pode "explicar" um item importado. Assim, duas compras iguais no mesmo dia
 * no arquivo e uma no app → só uma é marcada.
 */
export function detectarDuplicidades(itens, ctx) {
  const ex = ctx.existentes || {}
  const impressoes = new Map()
  for (const i of ex.impressoes || []) {
    const lista = impressoes.get(i.impressao_digital) || []
    lista.push(i)
    impressoes.set(i.impressao_digital, lista)
  }
  const usados = new Set()
  const recorrentesUsados = new Set()

  for (const it of itens) {
    if (it.editadoDuplicidade) continue
    it.duplicidade = null
    if (!it.destino) continue

    const anteriores = impressoes.get(it.impressao)
    if (anteriores && anteriores.length) {
      const reg = anteriores.shift()
      it.duplicidade = { nivel: 'certa', motivo: 'Este lançamento já foi importado antes.', tabela: reg.tabela, registroId: reg.registro_id, pontos: 1 }
      usados.add(`${reg.tabela}:${reg.registro_id}`)
      continue
    }

    let melhor = null
    const considerar = (tabela, registro, resultado) => {
      if (!resultado) return
      const chave = `${tabela}:${registro.id}`
      if (usados.has(chave)) return
      if (!melhor || resultado.pontos > melhor.pontos) melhor = { ...resultado, tabela, registroId: registro.id, registro }
    }

    if (it.destino === 'despesas' || it.destino === 'receitas') {
      const lista = it.destino === 'despesas' ? ex.despesas || [] : ex.receitas || []
      const ocorre = it.destino === 'despesas' ? ctx.ocorrenciaDespesa : ctx.ocorrenciaReceita
      for (const r of lista) {
        const recorrente = r.recorrente || (r.frequencia && r.frequencia !== 'nao_repete')
        if (recorrente && ocorre && it.data) {
          const [a, m] = it.data.split('-').map(Number)
          const chaveRec = `${r.id}:${competencia(it.data)}`
          if (recorrentesUsados.has(chaveRec)) continue
          const valorMes = Number(r.valor)
          const ativa = ocorre(r, a, m) > 0
          const sim = similaridadeDescricao(it.descricao, r.descricao)
          const proximo = Math.abs(valorMes - it.valor) <= Math.max(1, valorMes * 0.1)
          if (ativa && proximo && sim >= 0.4) {
            const res = { nivel: 'provavel', pontos: 0.85 + sim / 100, motivo: `Já prevista como ${it.destino === 'despesas' ? 'despesa' : 'receita'} recorrente "${r.descricao}"`, recorrenteChave: chaveRec }
            if (!melhor || res.pontos > melhor.pontos) melhor = { ...res, tabela: it.destino, registroId: r.id, registro: r }
          }
          continue
        }
        considerar(it.destino, r, pontuarSimples(it, r, { valor: 'valor', data: 'data' }))
      }
    } else if (it.destino === 'compras_cartao') {
      for (const c of ex.compras || []) {
        if (ctx.cartaoId && c.cartao_id !== ctx.cartaoId) continue
        const n = Number(c.numero_parcelas) || 1
        if ((it.numeroParcelas || 1) > 1 && n === it.numeroParcelas) {
          const parcelaEx = Number(c.valor_total) / n
          const sim = similaridadeDescricao(it.descricao, c.descricao)
          if (Math.abs(parcelaEx - it.valorParcela) <= 0.02 && sim >= 0.5 && it.data && c.data_compra &&
              Math.abs(diferencaDias(it.data, c.data_compra)) <= 31 * n) {
            considerar('compras_cartao', c, {
              nivel: Math.abs(diferencaDias(it.data, c.data_compra)) <= 3 ? 'provavel' : 'possivel',
              pontos: 0.88 + sim / 100,
              motivo: `Compra parcelada já cadastrada (${n}x de ${parcelaEx.toFixed(2).replace('.', ',')})`,
            })
          }
          continue
        }
        if (n === 1) considerar('compras_cartao', c, pontuarSimples({ ...it, valor: it.valorTotal }, c, { valor: 'valor_total', data: 'data_compra' }))
      }
    } else if (it.destino === 'investimentos_movimentacoes' && it.investimentoId) {
      for (const m of ex.movimentacoes || []) {
        if (m.investimento_id !== it.investimentoId || m.tipo !== it.natureza) continue
        if (!it.data || Math.abs(diferencaDias(it.data, m.data)) > 1) continue
        if (Math.abs(Number(m.valor) - it.valor) > 0.01) continue
        considerar('investimentos_movimentacoes', m, { nivel: 'provavel', pontos: 0.9, motivo: 'Movimentação igual já registrada neste investimento' })
      }
    }

    if (melhor) {
      if (melhor.recorrenteChave) recorrentesUsados.add(melhor.recorrenteChave)
      else usados.add(`${melhor.tabela}:${melhor.registroId}`)
      const { registro, recorrenteChave, ...dup } = melhor
      dup.resumoExistente = registro ? {
        descricao: registro.descricao || registro.nome || '',
        valor: Number(registro.valor ?? registro.valor_total ?? 0),
        data: registro.data || registro.data_compra || null,
        categoriaId: registro.categoria_id || null,
        categoria: registro.categoria || null,
      } : null
      dup.recorrente = Boolean(recorrenteChave)
      it.duplicidade = dup
    }
  }
  return itens
}

// ─── Recorrência ─────────────────────────────────────────────────────────────

function marcarRecorrentes(itens, existentes) {
  const grupos = new Map()
  for (const it of itens) {
    if (!['despesas', 'receitas', 'compras_cartao'].includes(it.destino) || !it.data) continue
    const chave = `${it.destino}|${chaveAprendizado(it.descricao)}`
    if (chave.endsWith('|')) continue
    const g = grupos.get(chave) || []
    g.push(it)
    grupos.set(chave, g)
  }
  const historico = new Map()
  for (const [tabela, lista] of [['despesas', existentes.despesas || []], ['receitas', existentes.receitas || []]]) {
    for (const r of lista) {
      const chave = `${tabela}|${chaveAprendizado(r.descricao)}`
      const meses = historico.get(chave) || new Set()
      if (r.data) meses.add(competencia(r.data))
      if (r.recorrente || (r.frequencia && r.frequencia !== 'nao_repete')) meses.add('recorrente')
      historico.set(chave, meses)
    }
  }
  for (const [chave, g] of grupos) {
    const meses = new Set(g.map(i => competencia(i.data)))
    const valores = g.map(i => i.valor).sort((a, b) => a - b)
    const mediana = valores[Math.floor(valores.length / 2)]
    const estavel = valores.every(v => Math.abs(v - mediana) <= Math.max(1, mediana * 0.15))
    const hist = historico.get(chave)
    for (const it of g) {
      const mesesAnteriores = hist ? [...hist].filter(m => m === 'recorrente' || m < competencia(it.data)) : []
      it.recorrente = (meses.size >= 2 && estavel) || mesesAnteriores.length > 0
    }
  }
}

// ─── Cartão: coerência das parcelas com a fatura ────────────────────────────

export function competenciaDaFatura(meta, cartao) {
  if (meta?.fechamento) {
    const [a, m] = meta.fechamento.split('-').map(Number)
    return { ano: a, mes: m }
  }
  if (meta?.vencimento && cartao?.dia_fechamento) {
    const [a, m, d] = meta.vencimento.split('-').map(Number)
    // O fechamento que antecede o vencimento: mesmo mês se o dia de
    // fechamento é anterior ao dia do vencimento; senão, mês anterior.
    if (Number(cartao.dia_fechamento) < d) return { ano: a, mes: m }
    return m === 1 ? { ano: a - 1, mes: 12 } : { ano: a, mes: m - 1 }
  }
  return null
}

export function verificarParcelasCartao(itens, meta, cartao) {
  for (const it of itens) {
    // Com várias faturas na mesma importação, cada item usa a do seu arquivo.
    const comp = competenciaDaFatura(it.metaDoc || meta, cartao)
    it.dataCompraSugerida = null
    it.pendencias = (it.pendencias || []).filter(p => !p.startsWith('Pela data informada'))
    if (it.destino !== 'compras_cartao' || !it.parcelaAtual || (it.numeroParcelas || 1) < 2) continue
    if (!comp || !cartao?.dia_fechamento || !it.data) continue
    const inicio = competenciaPrimeiraParcela(it.data, cartao.dia_fechamento)
    const calculada = (comp.ano * 12 + comp.mes) - (inicio.ano * 12 + inicio.mes) + 1
    if (calculada !== it.parcelaAtual) {
      it.dataCompraSugerida = adicionarMeses(it.data, -(it.parcelaAtual - calculada))
      it.pendencias.push(
        `Pela data informada, esta fatura teria a parcela ${calculada}/${it.numeroParcelas}, mas o documento indica ${it.parcelaAtual}/${it.numeroParcelas}. Confira a data da compra original.`
      )
    }
  }
}

// ─── Investimentos: vínculo com posições existentes ─────────────────────────

function acharInvestimento(ativo, investimentos) {
  if (!ativo) return null
  if (ativo.codigo) {
    const re = new RegExp(`\\b${ativo.codigo}\\b`)
    const porCodigo = investimentos.find(i => re.test(normalizarDescricao(i.nome)))
    if (porCodigo) return porCodigo
  }
  let melhor = null, melhorSim = 0
  for (const i of investimentos) {
    const sim = similaridadeDescricao(ativo.nome, i.nome)
    if (sim > melhorSim) { melhor = i; melhorSim = sim }
  }
  return melhorSim >= 0.8 ? melhor : null
}

// Preço médio e valor aplicado só com histórico COMPLETO: a quantidade final
// da posição precisa bater com compras − vendas do próprio arquivo, e toda
// compra/venda precisa ter quantidade e preço (ou valor).
export function calcularPrecoMedio(movimentos, quantidadePosicao) {
  if (quantidadePosicao == null || !(quantidadePosicao > 0)) return null
  const ordenados = [...movimentos].filter(m => m.natureza === 'aporte' || m.natureza === 'resgate')
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''))
  if (ordenados.length === 0) return null
  let qtd = 0, custo = 0
  for (const m of ordenados) {
    if (m.quantidade == null || !(m.quantidade > 0)) return null
    if (m.natureza === 'aporte') {
      const valor = m.valor ?? (m.preco != null ? m.quantidade * m.preco : null)
      if (valor == null) return null
      qtd += m.quantidade; custo += valor
    } else {
      if (qtd <= 0) return null
      const pm = custo / qtd
      custo -= pm * m.quantidade; qtd -= m.quantidade
    }
  }
  if (Math.abs(qtd - quantidadePosicao) > 1e-6 || qtd <= 0) return null
  return {
    precoMedio: Math.round((custo / qtd) * 10000) / 10000,
    valorAplicado: arred2(custo),
    dataAplicacao: ordenados.find(m => m.natureza === 'aporte')?.data || null,
  }
}

function vincularInvestimentos(itens, ctx) {
  const investimentos = ctx.existentes?.investimentos || []
  const novos = new Map()
  for (const it of itens) {
    if (it.documento !== 'extrato_investimentos' || !it.ativo) continue
    if (it.investimentoEscolhido) continue // escolha manual do usuário prevalece
    const existente = acharInvestimento(it.ativo, investimentos)
    if (existente) {
      it.investimentoId = existente.id
      it.investimentoRef = null
      it.investimentoNome = existente.nome
    } else {
      const ref = `novo:${it.ativo.chave}`
      it.investimentoId = null
      it.investimentoRef = ref
      it.investimentoNome = it.ativo.nome
      if (!novos.has(ref)) {
        novos.set(ref, {
          ref,
          nome: it.ativo.nome.slice(0, 120),
          categoria: it.categoriaAtivo || 'outro',
          instituicao: it.instituicaoLinha || ctx.instituicao || null,
          valorAtual: null,
          valorAplicado: null,
          quantidade: null,
          precoUnitario: null,
          dataAplicacao: null,
          pendencias: [],
        })
      }
    }
  }
  // Consolida dados dos novos investimentos a partir das posições e movimentos.
  for (const novo of novos.values()) {
    const doAtivo = itens.filter(i => i.investimentoRef === novo.ref)
    const posicao = doAtivo.find(i => i.natureza === 'posicao')
    const movimentos = doAtivo.filter(i => i.natureza !== 'posicao')
    if (posicao) {
      novo.valorAtual = posicao.valor
      novo.quantidade = posicao.quantidade
      if (posicao.valorAplicadoDoc != null) novo.valorAplicado = posicao.valorAplicadoDoc
    }
    const pm = calcularPrecoMedio(movimentos, posicao?.quantidade)
    if (pm) {
      novo.precoUnitario = pm.precoMedio
      if (novo.valorAplicado == null) novo.valorAplicado = pm.valorAplicado
      novo.dataAplicacao = pm.dataAplicacao
    }
    if (novo.valorAtual == null) novo.pendencias.push('Valor atual não informado no documento. Informe para o patrimônio ficar correto.')
    if (novo.valorAplicado == null) novo.pendencias.push('Valor aplicado não informado e histórico insuficiente para calcular. Ficará como R$ 0,00 até você ajustar.')
    if (novo.precoUnitario == null && ['acoes', 'fii', 'etf'].includes(novo.categoria)) {
      novo.pendencias.push('Preço médio não calculado: o histórico do arquivo não cobre toda a posição.')
    }
  }
  // Posições de investimentos existentes = CONCILIAÇÃO explícita (substituir
  // o valor atual), desmarcada por padrão. Nunca soma ao patrimônio.
  for (const it of itens) {
    if (it.natureza !== 'posicao') continue
    if (it.investimentoId) {
      const inv = investimentos.find(i => i.id === it.investimentoId)
      it.acao = 'conciliar'
      it.valorAtualAnterior = inv ? Number(inv.valor_atual) : null
      it.quantidadeAnterior = inv?.quantidade != null ? Number(inv.quantidade) : null
    } else {
      it.acao = 'criar_posicao'
    }
  }
  return [...novos.values()]
}

// ─── Seleção padrão ──────────────────────────────────────────────────────────

export function itemImportavel(it) {
  if (!it.destino) return false
  if (!(it.valor > 0)) return false
  if (it.natureza !== 'posicao' && !it.data) return false
  if (it.destino === 'investimentos_movimentacoes' && !it.investimentoId && !it.investimentoRef) return false
  return true
}

export function selecaoPadrao(it) {
  if (!itemImportavel(it)) return false
  if (it.duplicidade && ['certa', 'provavel'].includes(it.duplicidade.nivel)) return false
  if (it.acao === 'conciliar') return false
  return true
}

// ─── Resumo ──────────────────────────────────────────────────────────────────

export function resumir(itens) {
  const r = { identificados: itens.length, despesas: 0, receitas: 0, transferencias: 0, compras: 0, estornos: 0, pagamentos: 0, investimentos: 0, posicoes: 0, duplicidades: 0, pendencias: 0, selecionados: 0, valorDespesas: 0, valorReceitas: 0 }
  for (const it of itens) {
    if (it.natureza === 'despesa') { r.despesas++; r.valorDespesas += it.valor || 0 }
    else if (it.natureza === 'receita') { r.receitas++; r.valorReceitas += it.valor || 0 }
    else if (['transferencia', 'pagamento_fatura', 'aplicacao', 'resgate_investimento'].includes(it.natureza)) r.transferencias++
    else if (it.natureza === 'compra' || it.natureza === 'encargo') { r.compras++; r.valorDespesas += it.valorTotal || it.valor || 0 }
    else if (it.natureza === 'estorno') r.estornos++
    else if (it.natureza === 'pagamento') r.pagamentos++
    else if (it.natureza === 'posicao') r.posicoes++
    else if (it.documento === 'extrato_investimentos') r.investimentos++
    if (it.duplicidade) r.duplicidades++
    if (it.pendencias?.length) r.pendencias++
    if (it.selecionado) r.selecionados++
  }
  r.valorDespesas = arred2(r.valorDespesas)
  r.valorReceitas = arred2(r.valorReceitas)
  return r
}

// ─── Entrada principal ───────────────────────────────────────────────────────

/**
 * @param {object[]} itens  saída de interpretarRegistros
 * @param {object} ctx      { tipoDocumento, instituicao, meta, existentes, categoriasDespesa,
 *                            categoriasReceita, regrasUsuario, cartao, ocorrenciaDespesa, ocorrenciaReceita }
 */
export function analisarItens(itensEntrada, ctx) {
  const itens = itensEntrada.map(i => ({ ...i, pendencias: [...(i.pendencias || [])] }))
  const regras = indexarRegrasUsuario(ctx.regrasUsuario || [])
  const ctxClass = { categoriasDespesa: ctx.categoriasDespesa, categoriasReceita: ctx.categoriasReceita, regrasUsuario: regras }

  atribuirImpressoes(itens, ctx.instituicao)
  for (const it of itens) aplicarClassificacao(it, ctxClass)

  let novosInvestimentos = []
  const avisos = []
  if (ctx.tipoDocumento === 'extrato_investimentos') {
    novosInvestimentos = vincularInvestimentos(itens, ctx)
  }
  if (ctx.tipoDocumento === 'fatura_cartao') {
    verificarParcelasCartao(itens, ctx.meta, ctx.cartao)
    if (ctx.meta?.vencimento && ctx.cartao?.dia_vencimento) {
      const dia = Number(ctx.meta.vencimento.slice(8, 10))
      if (dia !== Number(ctx.cartao.dia_vencimento)) {
        avisos.push(`O vencimento do documento (dia ${dia}) difere do cadastrado no cartão (dia ${ctx.cartao.dia_vencimento}). O cadastro do cartão não será alterado.`)
      }
    }
    if (ctx.meta?.totalFatura != null) {
      const soma = arred2(itens.reduce((s, i) => s + (i.natureza === 'compra' || i.natureza === 'encargo' ? i.valorParcela || i.valor : i.natureza === 'estorno' ? -i.valor : 0), 0))
      if (Math.abs(soma - ctx.meta.totalFatura) > 0.05) {
        avisos.push(`A soma dos lançamentos lidos (R$ ${soma.toFixed(2).replace('.', ',')}) difere do total da fatura (R$ ${ctx.meta.totalFatura.toFixed(2).replace('.', ',')}). Pode haver saldo anterior, pagamentos ou linhas não reconhecidas.`)
      }
    }
  }

  detectarDuplicidades(itens, { ...ctx, cartaoId: ctx.cartao?.id || null })
  marcarRecorrentes(itens, ctx.existentes || {})
  for (const it of itens) it.selecionado = selecaoPadrao(it)

  return { itens, novosInvestimentos, avisos, resumo: resumir(itens) }
}
