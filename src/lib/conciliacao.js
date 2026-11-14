// ─── Conciliação Financeira Inteligente (Fase 3) ────────────────────────────*

// Compara transações importadas com registros existentes, detecta duplicidades,*

// transferências e pagamentos de fatura. Reutiliza funções das Fases 1 e 2.*

//*

// Estados de conciliação:*

//   - conciliado: correspondência exata encontrada*

//   - duplicata_provavel: similaridade ≥ 60%*

//   - duplicata_possivel: similaridade < 60%*

//   - divergente: mesma data/valor, descrição diferente*

//   - novo: nenhuma correspondência*

//   - ja_importado: chave já existe no histórico*

//   - transferencia: movimentação entre contas próprias*

//   - pagamento_fatura: pagamento de cartão de crédito*



import { similaridade, destinoDoTipo, descricaoComparavel, validarItem as validarParaResumo } from './importacaoRegras.js'



const THRESHOLD_DUPLICATA_PROVAVEL = 0.6

const THRESHOLD_DUPLICATA_POSSIVEL = 0.34

const MAX_DIAS_DIVERGENCIA = 3



export const ESTADOS_CONCILIACAO = {

  conciliado: { label: 'Conciliado', cor: 'text-green-600', bg: 'bg-green-50', incluir: false },

  duplicata_provavel: { label: 'Possível duplicata', cor: 'text-amber-600', bg: 'bg-amber-50', incluir: false },

  duplicata_possivel: { label: 'Verificar duplicata', cor: 'text-yellow-600', bg: 'bg-yellow-50', incluir: true },

  divergente: { label: 'Divergente', cor: 'text-orange-600', bg: 'bg-orange-50', incluir: true },

  novo: { label: 'Novo', cor: 'text-blue-600', bg: 'bg-blue-50', incluir: true },

  ja_importado: { label: 'Já importado', cor: 'text-gray-600', bg: 'bg-gray-50', incluir: false },

  transferencia: { label: 'Transferência', cor: 'text-purple-600', bg: 'bg-purple-50', incluir: false },

  pagamento_fatura: { label: 'Pagamento fatura', cor: 'text-indigo-600', bg: 'bg-indigo-50', incluir: false },

}



// Detecta palavras-chave que indicam transferência entre contas próprias*

const PALAVRAS_TRANSFERENCIA = [

  'transfer', 'ted', 'doc', 'pix enviado', 'pix recebido', 'envio', 'recebimento',

  'transf', 'entre contas', 'saque', 'deposito'

]



const PADRAO_PAGAMENTO_FATURA = /\b(pagamento|pgto|pagto|pag) (de |da |do )?(fatura|cartao)\b|\bfatura (do )?cartao\b|\bpagamento recebido\b|\bcredito de pagamento\b/



// ── Funções auxiliares ───────────────────────────────────────────────────────*



function centavos(v) {

  return Math.round(Math.abs(Number(v) || 0) * 100)

}



function diasEntre(a, b) {

  const ms = Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`))

  return Math.floor(ms / 86400000)

}



function indicaTransferencia(descricao) {

  const d = descricaoComparavel(descricao)

  return PALAVRAS_TRANSFERENCIA.some(p => d.includes(p))

}



function indicaPagamentoFatura(descricao) {

  const d = descricaoComparavel(descricao)

  return PADRAO_PAGAMENTO_FATURA.test(d)

}



// ── Detecção de transferências ───────────────────────────────────────────────*

// Transferência = receita + despesa no mesmo dia com mesmo valor.*

// Evita contabilizar como renda e gasto ao mesmo tempo.*



export function detectarTransferencias(itens) {

  const receitas = itens.filter(it => it.tipo === 'receita' && it.incluir)

  const despesas = itens.filter(it => it.tipo === 'despesa' && it.incluir)



  const pares = []

  const usados = new Set()



  for (const r of receitas) {

    if (usados.has(r.uid)) continue



    const cents = centavos(r.valor)



    for (const d of despesas) {

      if (usados.has(d.uid)) continue

      if (centavos(d.valor) !== cents) continue

      if (r.data !== d.data) continue



      // Mesmo dia + mesmo valor: forte candidato*

      const descR = indicaTransferencia(r.descricao)

      const descD = indicaTransferencia(d.descricao)



      if (descR || descD) {

        pares.push({ receita: r.uid, despesa: d.uid })

        usados.add(r.uid)

        usados.add(d.uid)

        break

      }

    }

  }



  return itens.map(it => {

    const par = pares.find(p => p.receita === it.uid || p.despesa === it.uid)

    if (!par) return it



    return {

      ...it,

      estadoConciliacao: 'transferencia',

      incluir: false,

      avisos: [

        ...(it.avisos || []),

        'Detectada como transferência entre contas próprias (não será contabilizada)'

      ],

      parTransferencia: par.receita === it.uid ? par.despesa : par.receita

    }

  })

}



// ── Detecção de pagamentos de fatura ──────────────────────────────────────────*

// Pagamento de fatura no extrato não deve ser contabilizado como despesa,*

// pois as compras já estão no cartão.*



export function detectarPagamentosFatura(itens) {

  return itens.map(it => {

    if (it.tipo !== 'despesa') return it

    if (!indicaPagamentoFatura(it.descricao)) return it



    return {

      ...it,

      tipo: 'pagamento_fatura',

      estadoConciliacao: 'pagamento_fatura',

      incluir: false,

      avisos: [

        ...(it.avisos || []),

        'Detectado como pagamento de fatura (não será contabilizado como despesa)'

      ]

    }

  })

}



// ── Conciliação de parcelamentos ──────────────────────────────────────────────*

// Parcela 2/5 já cadastrada: marca como duplicata*



export function conciliarParcelamentos(itens, existentes) {

  return itens.map(it => {

    if (!it.parcelaAtual || !it.parcelaTotal) return it

    if (it.estadoConciliacao) return it // Já conciliado*



    const cents = centavos(it.valor)

    const destino = destinoDoTipo(it.tipo)

    if (!destino) return it



    // Buscar compra original com mesmas parcelas*

    const original = existentes.find(e =>

      e.tabela === destino &&

      e.valores.includes(cents) &&

      e.descricao === descricaoComparavel(it.descricao) &&

      e.parcelaTotal === it.parcelaTotal

    )



    if (!original) return it



    // Verificar se essa parcela específica já foi lançada*

    const parcelaJaExiste = existentes.some(e =>

      e.tabela === destino &&

      e.valores.includes(cents) &&

      e.descricao === descricaoComparavel(it.descricao) &&

      e.parcelaAtual === it.parcelaAtual

    )



    if (parcelaJaExiste) {

      return {

        ...it,

        estadoConciliacao: 'conciliado',

        incluir: false,

        duplicataDe: original.id,

        avisos: [

          ...(it.avisos || []),

          `Parcela ${it.parcelaAtual}/${it.parcelaTotal} já cadastrada`

        ]

      }

    }



    return it

  })

}



// ── Conciliação principal ─────────────────────────────────────────────────────*



export function conciliarTransacoes(itens, existentes, chavesImportadas = new Set()) {

  const usados = new Set()



  let resultado = itens.map(it => {

    // Já marcado como duplicado por hash*

    if (it.status === 'ja_importado' || chavesImportadas.has(it.chave)) {

      return {

        ...it,

        estadoConciliacao: 'ja_importado',

        incluir: false,

        avisos: [...(it.avisos || []), 'Já importado anteriormente (mesma chave de duplicidade)']

      }

    }



    // Duplicado no próprio arquivo*

    if (it.status === 'duplicado_no_arquivo') {

      return {

        ...it,

        estadoConciliacao: 'duplicata_provavel',

        incluir: false,

        avisos: [...(it.avisos || []), 'Duplicado dentro do mesmo arquivo']

      }

    }



    const destino = destinoDoTipo(it.tipo)

    if (!destino) return { ...it, estadoConciliacao: 'novo' }



    const cents = centavos(it.valor)

    let melhor = null

    let melhorSimilaridade = 0

    let melhorDias = 999



    // Buscar melhor correspondência*

    for (const e of existentes) {

      if (usados.has(e.id)) continue

      if (e.tabela !== destino) continue

      if (!e.valores.includes(cents)) continue



      // Filtrar por cartão/investimento se aplicável*

      if (e.cartaoId && it.cartaoId && e.cartaoId !== it.cartaoId) continue

      if (e.investimentoId && it.investimentoId && e.investimentoId !== it.investimentoId) continue



      const dias = diasEntre(e.data, it.data)

      if (dias > MAX_DIAS_DIVERGENCIA) continue



      const sim = similaridade(e.descricao, descricaoComparavel(it.descricao))



      // Priorizar: dias iguais > similaridade alta > dias próximos*

      const pontos = (dias === 0 ? 10 : 5) + sim * 10



      if (!melhor || pontos > (melhorSimilaridade * 10 + (melhorDias === 0 ? 10 : 5))) {

        melhor = { e, sim, dias }

        melhorSimilaridade = sim

        melhorDias = dias

      }

    }



    if (!melhor) {

      return { ...it, estadoConciliacao: 'novo' }

    }



    usados.add(melhor.e.id)



    // Correspondência exata*

    if (melhor.dias === 0 && melhor.sim >= 0.85) {

      return {

        ...it,

        estadoConciliacao: 'conciliado',

        incluir: false,

        duplicataDe: melhor.e.id,

        registroVinculado: melhor.e,

        similaridadeCalculada: melhor.sim,

        avisos: [...(it.avisos || []), 'Correspondência exata encontrada (mesma data, valor e descrição)']

      }

    }



    // Duplicata provável*

    if (melhor.dias <= 1 && melhor.sim >= THRESHOLD_DUPLICATA_PROVAVEL) {

      return {

        ...it,

        estadoConciliacao: 'duplicata_provavel',

        incluir: false,

        duplicataDe: melhor.e.id,

        registroVinculado: melhor.e,

        similaridadeCalculada: melhor.sim,

        avisos: [

          ...(it.avisos || []),

          `Possível duplicata: similaridade ${Math.round(melhor.sim * 100)}% com registro existente`

        ]

      }

    }



    // Duplicata possível (similaridade baixa)*

    if (melhor.sim >= THRESHOLD_DUPLICATA_POSSIVEL) {

      return {

        ...it,

        estadoConciliacao: 'duplicata_possivel',

        incluir: false, // Requer confirmação explícita

        duplicataDe: melhor.e.id,

        registroVinculado: melhor.e,

        similaridadeCalculada: melhor.sim,

        avisos: [

          ...(it.avisos || []),

          `Registro semelhante encontrado (${Math.round(melhor.sim * 100)}% similaridade) - revise`

        ]

      }

    }



    // Divergente (mesmo valor/data, descrição muito diferente)*

    return {

      ...it,

      estadoConciliacao: 'divergente',

      incluir: false,

      registroVinculado: melhor.e,

      similaridadeCalculada: melhor.sim,

      avisos: [

        ...(it.avisos || []),

        `Valor e data iguais a registro existente, mas descrição diferente`

      ]

    }

  })



  // Aplicar detecções adicionais*

  resultado = detectarTransferencias(resultado)

  resultado = detectarPagamentosFatura(resultado)

  resultado = conciliarParcelamentos(resultado, existentes)



  return resultado

}



// ── Resumo da conciliação ────────────────
export function resumoConciliacao(itens) {
  const resumo = {
    total: itens.length, conciliados: 0, novos: 0,
    duplicatasProvaveis: 0, duplicatasPossiveis: 0, divergentes: 0,
    jaImportados: 0, transferencias: 0, pagamentosFatura: 0,
    selecionados: 0, valorSelecionado: 0, comErro: 0,
    totalImportar: 0, valorImportar: 0,
  }
  for (const it of itens) {
    if (it.incluir) {
      resumo.selecionados++
      resumo.valorSelecionado += Math.abs(Number(it.valor) || 0)
      if (validarParaResumo(it)) resumo.comErro++
      else {
        resumo.totalImportar++
        resumo.valorImportar += Math.abs(Number(it.valor) || 0)
      }
    }
    const estado = it.estadoConciliacao || 'novo'
    switch (estado) {
      case 'conciliado': resumo.conciliados++; break
      case 'novo': resumo.novos++; break
      case 'duplicata_provavel': resumo.duplicatasProvaveis++; break
      case 'duplicata_possivel': resumo.duplicatasPossiveis++; break
      case 'divergente': resumo.divergentes++; break
      case 'ja_importado': resumo.jaImportados++; break
      case 'transferencia': resumo.transferencias++; break
      case 'pagamento_fatura': resumo.pagamentosFatura++; break
    }
  }
  return resumo
}

// ── Utilitários para UI ──────────────────────────────────────────────────────*



export function obterEstadoVisual(estadoConciliacao) {

  return ESTADOS_CONCILIACAO[estadoConciliacao] || ESTADOS_CONCILIACAO.novo

}



export function podeAprovar(item) {

  const naoConciliados = ['novo', 'duplicata_possivel', 'divergente']

  return naoConciliados.includes(item.estadoConciliacao)

}



export function podeVincular(item) {

  return item.registroVinculado && item.estadoConciliacao !== 'conciliado'

}



export function podeEditar(item) {

  return !['ja_importado', 'conciliado'].includes(item.estadoConciliacao)

}



export function podeIgnorar(item) {

  return item.estadoConciliacao !== 'ja_importado'

}
