// ─── Montagem do pacote de gravação (RPC importacao_confirmar) ──────────────
// Só itens SELECIONADOS e válidos entram. Todos os campos são revalidados no
// servidor; aqui a validação serve para dar mensagens claras antes do envio.

import { regrasParaAprender } from './classificar.js'
import { MAXIMO_ITENS_GRAVACAO } from './limites.js'
import { arred2 } from './normalizar.js'

const RE_ISO = /^\d{4}-\d{2}-\d{2}$/

function texto(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function acaoDoItem(it) {
  if (it.natureza === 'posicao') return it.acao === 'conciliar' ? 'conciliar' : 'criar'
  if (it.duplicidade && it.acaoDuplicidade === 'complementar') return 'complementar'
  if (it.duplicidade && it.acaoDuplicidade === 'substituir') return 'substituir'
  return 'criar'
}

function dadosDoItem(it, ctx) {
  const descricao = texto(it.descricao) || texto(it.descricaoOriginal) || 'Lançamento importado'
  switch (it.destino) {
    case 'despesas':
      return {
        descricao, valor: arred2(it.valor), data: it.data, categoria_id: it.categoriaId || null,
        tipo_despesa: it.tipoDespesa === 'fixa' ? 'fixa' : 'variavel',
        forma_pagamento: it.meio || null,
      }
    case 'receitas':
      return { descricao, valor: arred2(it.valor), data: it.data, categoria: it.categoriaNome ? texto(it.categoriaNome, 60) : null }
    case 'compras_cartao': {
      const n = Math.max(1, Math.trunc(it.numeroParcelas || 1))
      return {
        cartao_id: ctx.cartaoId, descricao, data_compra: it.data, numero_parcelas: n,
        valor_total: arred2(n > 1 ? it.valorParcela * n : (it.valorTotal ?? it.valor)),
        categoria_id: it.categoriaId || null,
      }
    }
    case 'investimentos_movimentacoes':
      return {
        investimento_id: it.investimentoId || null,
        investimento_ref: it.investimentoId ? null : it.investimentoRef,
        tipo: it.natureza, valor: arred2(it.valor), data: it.data,
        descricao: texto(it.descricaoOriginal || it.descricao, 200) || null,
      }
    case 'investimentos':
      return it.acao === 'conciliar'
        ? { valor_atual: arred2(it.valor), quantidade: it.quantidade ?? null }
        : null
    default:
      return null
  }
}

/**
 * @returns {{ payload: object|null, erros: string[] }}
 */
export function montarPayload({ tipoDocumento, arquivos, instituicao, periodo, itens, novosInvestimentos = [], cartaoId = null }) {
  const erros = []
  const selecionados = itens.filter(i => i.selecionado)
  if (selecionados.length === 0) erros.push('Selecione ao menos um lançamento para importar.')
  if (selecionados.length > MAXIMO_ITENS_GRAVACAO) erros.push(`Limite de ${MAXIMO_ITENS_GRAVACAO} lançamentos por importação.`)

  const saida = []
  const refsUsadas = new Set()
  selecionados.forEach((it, idx) => {
    const n = idx + 1
    const rotulo = `"${texto(it.descricao, 40)}"`
    if (!(it.valor > 0)) erros.push(`Lançamento ${n} ${rotulo}: informe um valor maior que zero.`)
    if (it.natureza !== 'posicao' && !RE_ISO.test(it.data || '')) erros.push(`Lançamento ${n} ${rotulo}: informe a data.`)
    if (it.destino === 'compras_cartao' && !cartaoId) erros.push('Escolha o cartão desta fatura.')
    if (it.destino === 'investimentos_movimentacoes' && !it.investimentoId && !it.investimentoRef) {
      erros.push(`Lançamento ${n} ${rotulo}: escolha o investimento.`)
    }
    const acao = acaoDoItem(it)
    if (it.destino === 'investimentos' && acao === 'criar') {
      refsUsadas.add(it.investimentoRef)
      return // a posição nova vira o próprio investimento criado (abaixo)
    }
    if (it.investimentoRef && !it.investimentoId) refsUsadas.add(it.investimentoRef)
    const registro = { acao, tabela: it.destino, impressao: it.impressao || null, dados: dadosDoItem(it, { cartaoId }) }
    if (acao === 'conciliar') registro.registro_id = it.investimentoId
    if (acao === 'complementar' || acao === 'substituir') registro.registro_id = it.duplicidade.registroId
    saida.push(registro)
  })

  // Investimentos novos entram ANTES das movimentações que os referenciam.
  const novos = novosInvestimentos.filter(n => refsUsadas.has(n.ref)).map(n => {
    const posicao = itens.find(i => i.selecionado && i.natureza === 'posicao' && i.investimentoRef === n.ref)
    return {
      acao: 'criar',
      tabela: 'investimentos',
      ref: n.ref,
      impressao: posicao?.impressao || null,
      dados: {
        nome: texto(n.nome, 120) || 'Investimento importado',
        instituicao: n.instituicao ? texto(n.instituicao, 80) : null,
        categoria: n.categoria || 'outro',
        valor_atual: arred2(n.valorAtual || 0),
        valor_aplicado: arred2(n.valorAplicado || 0),
        quantidade: n.quantidade ?? null,
        preco_unitario: n.precoUnitario ?? null,
        data_aplicacao: n.dataAplicacao || null,
      },
    }
  })

  if (erros.length) return { payload: null, erros: [...new Set(erros)].slice(0, 8) }

  const regras = regrasParaAprender(selecionados.map(i => ({
    destino: i.destino, descricao: i.descricaoOriginal || i.descricao, categoriaId: i.categoriaId, categoriaNome: i.categoriaNome,
  })))

  return {
    erros: [],
    payload: {
      tipo_documento: tipoDocumento,
      instituicao: instituicao ? texto(instituicao, 80) : null,
      arquivos: arquivos.slice(0, 5).map(a => ({ formato: a.formato, hash: a.arquivoHash, tamanho: a.tamanho })),
      periodo_inicio: periodo?.inicio || null,
      periodo_fim: periodo?.fim || null,
      total_identificados: itens.length,
      total_ignorados: itens.length - selecionados.length,
      total_duplicados: itens.filter(i => i.duplicidade).length,
      itens: [...novos, ...saida],
      regras,
    },
  }
}
