
import { useMemo } from 'react'
import { useDespesas } from './useDespesas'
import { useCartoes } from './useCartoes'
import { useComprasCartao } from './useComprasCartao'
import { useFaturasCartao } from './useFaturasCartao'
import { useParcelamentos } from './useParcelamentos'

import {
  linhasFaturaCompleta,
  totalFaturaComOverride
} from '../lib/faturaCartao'

const CATEGORIAS_ESSENCIAIS = [
  { id: 'moradia', nome: 'Moradia', icone: '🏠' },
  { id: 'condominio', nome: 'Condomínio e IPTU', icone: '🏢' },
  { id: 'utilidades', nome: 'Água, energia e gás', icone: '💡' },
  { id: 'alimentacao', nome: 'Alimentação', icone: '🍽️' },
  { id: 'transporte', nome: 'Transporte', icone: '🚗' },
  { id: 'saude', nome: 'Saúde', icone: '🏥' },
  { id: 'internet', nome: 'Internet e telefone', icone: '📱' },
  { id: 'assinaturas', nome: 'Assinaturas e streaming', icone: '📺' },
  { id: 'educacao', nome: 'Educação', icone: '📚' },
  { id: 'seguros', nome: 'Seguros', icone: '🛡️' },
  { id: 'dividas', nome: 'Dívidas e empréstimos', icone: '💳' },
  { id: 'lazer', nome: 'Lazer e entretenimento', icone: '🎮' },
  { id: 'outros', nome: 'Outros', icone: '📦' }
]

function normalizar(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function lista(valor) {
  return Array.isArray(valor) ? valor : []
}

function centavos(valor) {
  const numero = Number(valor)

  return Number.isFinite(numero)
    ? Math.round(numero * 100)
    : 0
}

function categoriaNome(item) {
  return (
    item?.categorias?.nome ||
    item?.categoria?.nome ||
    (
      typeof item?.categoria === 'string'
        ? item.categoria
        : ''
    ) ||
    'Sem categoria'
  )
}

function possui(texto, palavras) {
  const limpo = normalizar(texto)
    .replace(/[^a-z0-9]+/g, ' ')

  return palavras.some(palavra =>
    (` ${limpo} `).includes(
      ` ${normalizar(palavra)} `
    )
  )
}

export function mapearCategoria(
  nomeCategoria,
  descricao = ''
) {
  const texto = normalizar(descricao)
  const categoria = normalizar(nomeCategoria)

  // A descrição específica tem prioridade.
  // Evita classificar celular como aluguel.

  if (possui(texto, [
    'internet', 'celular', 'telefonia',
    'telefone', 'banda larga'
  ])) return 'internet'

  if (possui(texto, [
    'netflix', 'spotify', 'disney',
    'hbo', 'youcine', 'streaming',
    'amazon prime', 'youtube premium',
    'apple music', 'icloud', 'tv',
    'assinatura'
  ])) return 'assinaturas'

  if (possui(texto, [
    'gasolina', 'combustivel', 'etanol',
    'diesel', 'uber', 'taxi',
    'estacionamento', 'onibus', 'metro'
  ])) return 'transporte'

  if (possui(texto, [
    'emprestimo', 'divida', 'consorcio'
  ])) return 'dividas'

  if (possui(texto, [
    'seguro', 'seguros'
  ])) return 'seguros'

  if (possui(texto, [
    'aluguel', 'prestacao do imovel',
    'financiamento imobiliario'
  ])) return 'moradia'

  if (possui(texto, [
    'condominio', 'iptu'
  ])) return 'condominio'

  if (possui(texto, [
    'agua', 'energia', 'luz',
    'gas', 'eletricidade'
  ])) return 'utilidades'

  if (possui(texto, [
    'mercado', 'supermercado',
    'alimentacao', 'restaurante',
    'lanche', 'padaria'
  ])) return 'alimentacao'

  if (possui(texto, [
    'farmacia', 'medico', 'remedio',
    'plano de saude', 'consulta',
    'exame', 'dentista'
  ])) return 'saude'

  // Classificação pela categoria cadastrada.

  if (/internet|telefon|celular/.test(categoria)) {
    return 'internet'
  }

  if (/assinatura|streaming/.test(categoria)) {
    return 'assinaturas'
  }

  if (/emprestimo|divida|consorcio|financiamento/.test(categoria)) {
    return 'dividas'
  }

  if (/seguro/.test(categoria)) {
    return 'seguros'
  }

  if (/condominio|iptu/.test(categoria)) {
    return 'condominio'
  }

  if (/agua|energia|eletricidade|gas|luz/.test(categoria)) {
    return 'utilidades'
  }

  if (/moradia|aluguel|habitacao/.test(categoria)) {
    return 'moradia'
  }

  if (/alimenta|mercado|comida|restaurante/.test(categoria)) {
    return 'alimentacao'
  }

  if (/transporte|combustivel|gasolina/.test(categoria)) {
    return 'transporte'
  }

  if (/saude|medico|farmacia|odontolog/.test(categoria)) {
    return 'saude'
  }

  if (/educacao|escola|faculdade|curso/.test(categoria)) {
    return 'educacao'
  }

  if (/lazer|entretenimento|cinema|jogos/.test(categoria)) {
    return 'lazer'
  }

  return 'outros'
}

function dataValida(valor) {
  if (typeof valor !== 'string') return null

  const partes = /^(\d{4})-(\d{2})-(\d{2})(?:$|T| )/
    .exec(valor)

  if (!partes) return null

  const [, ano, mes, dia] = partes

  const data = new Date(
    Date.UTC(+ano, +mes - 1, +dia)
  )

  if (
    data.getUTCFullYear() !== +ano ||
    data.getUTCMonth() !== +mes - 1 ||
    data.getUTCDate() !== +dia
  ) return null

  return {
    ano: +ano,
    mes: +mes,
    dia: +dia,
    iso: `${ano}-${mes}-${dia}`
  }
}

function chaveMes(ano, mes) {
  return ano * 12 + mes - 1
}

function dataDoMes(ano, mes, dia) {
  const ultimoDia = new Date(
    Date.UTC(ano, mes, 0)
  ).getUTCDate()

  return [
    ano,
    String(mes).padStart(2, '0'),
    String(
      Math.max(1, Math.min(dia, ultimoDia))
    ).padStart(2, '0')
  ].join('-')
}

function registroValido(item) {
  if (!item) return false

  if (
    item.deleted_at ||
    item.excluido_em ||
    item.excluido === true ||
    item.is_deleted === true ||
    item.cancelado === true ||
    item.cancelada === true
  ) return false

  return ![
    'cancelado',
    'cancelada',
    'excluido',
    'excluida',
    'deleted',
    'canceled',
    'cancelled'
  ].includes(normalizar(item.status))
}

function pagamentoDeFatura(item) {
  const descricao = normalizar(item.descricao)
  const tipo = normalizar(item.tipo)
  const origem = normalizar(item.origem)

  return (
    tipo === 'pagamento_fatura' ||
    origem === 'pagamento_fatura' ||
    /pagamento\s+(de\s+|da\s+)?fatura/.test(
      descricao
    )
  )
}

export function useCustoDeVida(ano, mes) {
  const hoje = new Date()

  const anoAtual = hoje.getFullYear()
  const mesAtual = hoje.getMonth() + 1

  const anoRef = Number(ano) || anoAtual
  const mesRef = Number(mes) || mesAtual

  const hookDespesas = useDespesas()
  const hookCartoes = useCartoes()
  const hookCompras = useComprasCartao()
  const hookFaturas = useFaturasCartao()
  const hookParcelamentos = useParcelamentos()

  const despesas = hookDespesas.despesas
  const cartoes = hookCartoes.cartoes
  const compras = hookCompras.compras
  const faturas = hookFaturas.faturas
  const parcelamentos = hookParcelamentos.parcelamentos

  const carregando = Boolean(
    hookDespesas.carregando ||
    hookCartoes.carregando ||
    hookCompras.carregando ||
    hookFaturas.carregando ||
    hookParcelamentos.carregando
  )

  const erro =
    hookDespesas.erro ||
    hookCartoes.erro ||
    hookCompras.erro ||
    hookFaturas.erro ||
    hookParcelamentos.erro ||
    null

  const calcularCustoMes = useMemo(() => {

    const despesasValidas = lista(despesas)
      .filter(registroValido)
      .filter(d => !pagamentoDeFatura(d))

    const cartoesValidos = lista(cartoes)
      .filter(registroValido)

    const comprasValidas = lista(compras)
      .filter(registroValido)

    const faturasValidas = lista(faturas)
      .filter(registroValido)

    const parcelasValidas = lista(parcelamentos)
      .filter(registroValido)

    return (anoCalculo, mesCalculo) => {

      const categoriasMap = new Map()

      const futuro =
        chaveMes(anoCalculo, mesCalculo) >
        chaveMes(anoAtual, mesAtual)

      CATEGORIAS_ESSENCIAIS.forEach(cat => {
        categoriasMap.set(cat.id, {
          ...cat,
          totalCentavos: 0,
          itens: []
        })
      })

      let totalRegistradoCentavos = 0

      function adicionarItem(categoriaId, item) {

        const valorCentavos = centavos(item.valor)

        if (valorCentavos <= 0) return

        const categoria =
          categoriasMap.get(categoriaId) ||
          categoriasMap.get('outros')

        categoria.totalCentavos += valorCentavos

        categoria.itens.push({
          ...item,
          valor: valorCentavos / 100,
          projetado: futuro
        })

        totalRegistradoCentavos += valorCentavos
      }

      // 1. Despesas cadastradas para o mês.

      despesasValidas.forEach(despesa => {

        const data =
          dataValida(despesa.data) ||
          dataValida(despesa.data_vencimento)

        if (
          !data ||
          data.ano !== anoCalculo ||
          data.mes !== mesCalculo
        ) return

        const nome = categoriaNome(despesa)

        const categoriaId = mapearCategoria(
          nome,
          despesa.descricao
        )

        adicionarItem(categoriaId, {
          id: despesa.id,
          descricao: despesa.descricao,
          valor: despesa.valor,
          data: data.iso,
          tipo: 'despesa',
          categoriaOriginal: nome
        })
      })

      // 2. Compras, parcelas e faturas de cartões.
      // O total informado substitui o detalhamento.

      cartoesValidos.forEach(cartao => {

        const comprasCartao = comprasValidas.filter(
          c => String(c.cartao_id) === String(cartao.id)
        )

        const parcelasCartao = parcelasValidas.filter(
          p => String(p.cartao_id) === String(cartao.id)
        )

        const linhas = lista(
          linhasFaturaCompleta(
            comprasCartao,
            parcelasCartao,
            cartao.dia_fechamento,
            anoCalculo,
            mesCalculo
          )
        ).filter(linha =>
          centavos(linha.valor) > 0
        )

        const totalDetalhado = linhas.reduce(
          (soma, linha) =>
            soma + centavos(linha.valor),
          0
        )

        const totalFatura = Math.max(
          0,
          centavos(
            totalFaturaComOverride(
              comprasCartao,
              parcelasCartao,
              faturasValidas,
              cartao.id,
              cartao.dia_fechamento,
              anoCalculo,
              mesCalculo
            )
          )
        )

        let restante = totalFatura

        // Caso o total informado seja inferior
        // ao detalhamento, distribui proporcionalmente
        // sem ultrapassar o valor oficial da fatura.

        linhas.forEach((linha, indice) => {

          if (restante <= 0) return

          const original = centavos(linha.valor)

          let valor = original

          if (
            totalDetalhado > totalFatura &&
            totalDetalhado > 0
          ) {
            valor =
              indice === linhas.length - 1
                ? restante
                : Math.round(
                    original *
                    totalFatura /
                    totalDetalhado
                  )
          }

          valor = Math.max(
            0,
            Math.min(restante, valor)
          )

          restante -= valor

          const nome = categoriaNome(linha)

          const categoriaId = mapearCategoria(
            nome,
            linha.descricao
          )

          adicionarItem(categoriaId, {
            id: `cartao-${cartao.id}-${linha.id}-${indice}`,
            descricao: linha.descricao,
            valor: valor / 100,
            data:
              dataValida(linha.data)?.iso ||
              dataDoMes(anoCalculo, mesCalculo, 1),
            tipo: 'cartao',
            cartao: cartao.nome,
            parcela: linha.parcela,
            totalParcelas: linha.totalParcelas,
            categoriaOriginal: nome
          })
        })

        // Inclui o valor da fatura que ainda
        // não possui compras detalhadas.

        if (restante > 0) {
          adicionarItem('outros', {
            id: `fatura-${cartao.id}-${anoCalculo}-${mesCalculo}`,
            descricao:
              `Fatura ${cartao.nome} — não detalhada`,
            valor: restante / 100,
            data: dataDoMes(
              anoCalculo,
              mesCalculo,
              Number(cartao.dia_vencimento) || 1
            ),
            tipo: 'cartao',
            cartao: cartao.nome,
            categoriaOriginal: 'Fatura não detalhada'
          })
        }
      })

      // 3. Total consolidado em centavos.

      const totalGeralCentavos = Array
        .from(categoriasMap.values())
        .reduce(
          (soma, categoria) =>
            soma + categoria.totalCentavos,
          0
        )

      const categorias = Array
        .from(categoriasMap.values())
        .map(cat => ({
          id: cat.id,
          nome: cat.nome,
          icone: cat.icone,
          itens: cat.itens,
          total: cat.totalCentavos / 100,

          percentual:
            totalGeralCentavos > 0
              ? Math.round(
                  cat.totalCentavos /
                  totalGeralCentavos * 100
                )
              : 0
        }))
        .sort((a, b) => b.total - a.total)

      return {
        ano: anoCalculo,
        mes: mesCalculo,
        total: totalGeralCentavos / 100,
        totalRegistrado: totalRegistradoCentavos / 100,
        categorias,
        projetado: futuro,
        temDados: categorias.some(
          cat => cat.itens.length > 0
        )
      }
    }

  }, [
    despesas,
    cartoes,
    compras,
    faturas,
    parcelamentos,
    anoAtual,
    mesAtual
  ])

  // Custo do mês selecionado.

  const custoMesAtual = useMemo(() => {
    return calcularCustoMes(anoRef, mesRef)
  }, [
    calcularCustoMes,
    anoRef,
    mesRef
  ])

  // Média dos meses anteriores com dados.
  // Não utiliza meses futuros como histórico.

  const calcularMediaPeriodo = useMemo(() => {

    return (mesesAtras = 3) => {

      const custos = []

      const referencia = Math.min(
        chaveMes(anoRef, mesRef),
        chaveMes(anoAtual, mesAtual)
      )

      for (let i = 1; i <= mesesAtras; i++) {

        const chave = referencia - i
        const anoHistorico = Math.floor(chave / 12)
        const mesHistorico = chave % 12 + 1

        const custo = calcularCustoMes(
          anoHistorico,
          mesHistorico
        )

        if (custo.temDados) {
          custos.push(custo.total)
        }
      }

      if (!custos.length) return null

      return {
        media: custos.reduce(
          (soma, valor) => soma + valor,
          0
        ) / custos.length,

        mesesComDados: custos.length,
        mesesAnalisados: mesesAtras
      }
    }

  }, [
    anoRef,
    mesRef,
    anoAtual,
    mesAtual,
    calcularCustoMes
  ])

  // Histórico dos últimos meses.

  const calcularHistorico = useMemo(() => {

    return (numeroMeses = 12) => {

      const historico = []

      const referencia = Math.min(
        chaveMes(anoRef, mesRef),
        chaveMes(anoAtual, mesAtual)
      )

      for (let i = numeroMeses - 1; i >= 0; i--) {

        const chave = referencia - i

        const anoHistorico = Math.floor(chave / 12)
        const mesHistorico = chave % 12 + 1

        const custo = calcularCustoMes(
          anoHistorico,
          mesHistorico
        )

        historico.push({
          ano: anoHistorico,
          mes: mesHistorico,

          label: new Date(
            anoHistorico,
            mesHistorico - 1,
            1
          ).toLocaleDateString('pt-BR', {
            month: 'short',
            year: '2-digit'
          }),

          total: custo.total,
          temDados: custo.temDados
        })
      }

      return historico
    }

  }, [
    anoRef,
    mesRef,
    anoAtual,
    mesAtual,
    calcularCustoMes
  ])

  const historicoMeses = useMemo(() => {
    return calcularHistorico(12)
  }, [calcularHistorico])

  // Projeção do mês atual e dos próximos 12 meses,
  // com base nos compromissos já cadastrados.

  const projecaoMeses = useMemo(() => {

    return Array.from({ length: 13 }, (_, i) => {

      const chave =
        chaveMes(anoAtual, mesAtual) + i

      const anoProjecao = Math.floor(chave / 12)
      const mesProjecao = chave % 12 + 1

      const custo = calcularCustoMes(
        anoProjecao,
        mesProjecao
      )

      return {
        ...custo,

        label: new Date(
          anoProjecao,
          mesProjecao - 1,
          1
        ).toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric'
        })
      }
    })

  }, [
    calcularCustoMes,
    anoAtual,
    mesAtual
  ])

  return {
    custoMesAtual,

    porCategoria:
      custoMesAtual?.categorias || [],

    historicoMeses,
    projecaoMeses,
    carregando,
    erro,
    calcularCustoMes,
    calcularMediaPeriodo,
    calcularHistorico,

    temDados:
      custoMesAtual?.temDados || false
  }
}
