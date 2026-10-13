import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { bloquearSeConsultoria } from '../lib/consultoriaGuard'
import { labelMes, hojeISO } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'
import { amortizarSaldoDevedor } from '../lib/financiamento'

/**
 * Distribui o valor total em parcelas em centavos, ajustando a diferença
 * de arredondamento na ÚLTIMA parcela, de modo que a soma seja exatamente
 * igual ao valor total.
 * Ex: 1000 / 9 → 8x de 111,11 + 1x de 111,12 (soma = 1000,00)
 *
 * @returns {{ base: number, ultima: number }} valores em reais
 */
export function calcularParcelas(valorTotal, numeroParcelas) {
  const totalCentavos = Math.round(Number(valorTotal) * 100)
  const n = Number(numeroParcelas)
  if (!n || n <= 0) return { base: 0, ultima: 0 }
  const baseCentavos = Math.floor(totalCentavos / n)
  const ultimaCentavos = totalCentavos - baseCentavos * (n - 1)
  return {
    base: baseCentavos / 100,
    ultima: ultimaCentavos / 100,
  }
}

/**
 * Retorna o valor da parcela de um parcelamento devida em um mês/ano específico.
 * Retorna 0 se o parcelamento não tiver parcela nesse mês ou se já foi quitado.
 * A última parcela usa o valor ajustado (arredondamento).
 *
 * @param {object} p    parcelamento (com valor_total, numero_parcelas, primeira_parcela, quitado_em)
 * @param {number} ano
 * @param {number} mes  1-12
 */
export function valorParcelaNoMes(p, ano, mes) {
  if (p.quitado_em) {
    // Se quitado, só conta parcelas de meses anteriores à quitação
    const quit = new Date(p.quitado_em + 'T12:00:00')
    const alvo = new Date(ano, mes - 1, 1)
    const quitMesInicio = new Date(quit.getFullYear(), quit.getMonth(), 1)
    if (alvo >= quitMesInicio) return 0
  }

  // ── Contrato de financiamento COM acompanhamento (saldo + prazo + prestação
  // + data de referência) ──
  // A projeção dos meses A PARTIR da data de referência usa a prestação ATUAL
  // do contrato pelo prazo restante — refletindo amortizações já registradas,
  // SEM alterar os meses anteriores (que seguem o cálculo original abaixo).
  if (p.valor_prestacao != null && p.saldo_data && p.prazo_restante != null) {
    const ref = new Date(p.saldo_data + 'T12:00:00')
    // 1º mês projetado = mês seguinte ao da data de referência.
    const refMesNum = ref.getFullYear() * 12 + ref.getMonth()
    const alvoMesNum = ano * 12 + (mes - 1)
    const idx = alvoMesNum - refMesNum
    if (alvoMesNum > refMesNum) {
      return idx <= Number(p.prazo_restante) ? Number(p.valor_prestacao) : 0
    }
    // Meses até a data de referência (inclusive): mantêm o cálculo histórico.
  }

  const inicio = new Date(p.primeira_parcela + 'T12:00:00')
  const indice =
    (ano - inicio.getFullYear()) * 12 + ((mes - 1) - inicio.getMonth())

  if (indice < 0 || indice >= p.numero_parcelas) return 0

  const { base, ultima } = calcularParcelas(p.valor_total, p.numero_parcelas)
  const ehUltima = indice === p.numero_parcelas - 1
  return ehUltima ? ultima : base
}

export function useParcelamentos() {
  // LEITURAS usam idEfetivo (cliente no modo consultoria); ESCRITAS usam usuario.id.
  const { usuario, idEfetivo, modoConsultoria } = useAuth()
  const [parcelamentos, setParcelamentos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    if (!idEfetivo) return
    buscar()
  }, [idEfetivo])

  async function buscar() {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('parcelamentos')
        .select(`*, categorias (id, nome, icone, cor)`)
        .eq('usuario_id', idEfetivo)
        .order('criado_em', { ascending: false })
      if (error) throw error

      const hoje = new Date()

      const enriquecidos = (data || []).map(p => {
        const inicio = new Date(p.primeira_parcela + 'T12:00:00')

        // Parcelas pagas por diferença de meses desde a primeira parcela
        const mesesPassados =
          (hoje.getFullYear() - inicio.getFullYear()) * 12 +
          (hoje.getMonth() - inicio.getMonth())
        const parcelasPagas = Math.max(0, Math.min(mesesPassados, p.numero_parcelas))
        const parcelasRestantes = p.numero_parcelas - parcelasPagas

        // Parcela atual exibida como "X/Y" (mínimo 1 se já iniciou)
        const parcelaAtual = parcelasPagas < p.numero_parcelas
          ? parcelasPagas + 1
          : p.numero_parcelas

        // Mês de término
        const dataTermino = new Date(
          inicio.getFullYear(),
          inicio.getMonth() + p.numero_parcelas - 1,
          1
        )
        const mesTermino = labelMes(dataTermino)

        // Ativo: tem parcelas restantes E não foi quitado antecipadamente
        const ativo = parcelasRestantes > 0 && !p.quitado_em

        // Valores de parcela com arredondamento correto (soma = valor total)
        const { base: valorParcelaBase, ultima: valorUltimaParcela } =
          calcularParcelas(p.valor_total, p.numero_parcelas)

        // Valor restante real = valor total - soma das parcelas já pagas
        // (as pagas usam base; se a última já tiver sido paga, usa o ajuste)
        let valorPagoReal = 0
        for (let i = 0; i < parcelasPagas; i++) {
          valorPagoReal += (i === p.numero_parcelas - 1) ? valorUltimaParcela : valorParcelaBase
        }
        valorPagoReal = Math.round(valorPagoReal * 100) / 100
        const valorRestante = ativo
          ? Math.round((Number(p.valor_total) - valorPagoReal) * 100) / 100
          : 0

        // Classificação fixa/variável (parcelamentos não têm tipo_despesa no banco)
        const tipoDespesa = classificarDespesa({
          descricao: p.descricao,
          categoria: p.categorias?.nome || '',
        })

        // Próximo vencimento (data real da próxima parcela a decorrer).
        // Mantém o dia da primeira_parcela e avança parcelasPagas meses.
        const proximoVencimento = ativo
          ? (() => {
              const d = new Date(inicio.getFullYear(), inicio.getMonth() + parcelasPagas, inicio.getDate())
              return d.toISOString().slice(0, 10)
            })()
          : null

        return {
          ...p,
          // Tipo da obrigação: 'parcelado' | 'financiamento' | 'consorcio'.
          // Default 'parcelado' p/ registros sem a coluna (retrocompatível).
          tipo: p.tipo || 'parcelado',
          parcelasPagas,
          parcelasRestantes,
          parcelaAtual,
          mesTermino,
          proximoVencimento,
          ativo,
          valorParcelaBase,
          valorUltimaParcela,
          valorPagoReal,
          valorRestante,
          tipoDespesa,
        }
      })

      setParcelamentos(enriquecidos)
    } catch (err) {
      setErro(err.message)
    } finally {
      setCarregando(false)
    }
  }

  async function criar(dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('parcelamentos')
      .insert([{ ...dados, usuario_id: usuario.id }])
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) throw error
    await buscar()
    return data
  }

  // Atualiza um parcelamento existente pelo ID (UPDATE, sem duplicar)
  async function atualizar(id, dados) {
    bloquearSeConsultoria(modoConsultoria)
    const { data, error } = await supabase
      .from('parcelamentos')
      .update(dados)
      .eq('id', id)
      .select(`*, categorias (id, nome, icone, cor)`)
      .single()
    if (error) {
      console.error('[atualizar parcelamento] erro Supabase:', {
        message: error.message, details: error.details, hint: error.hint, code: error.code,
      })
      throw error
    }
    await buscar() // recalcula parcela atual, término, valores etc.
    return data
  }

  // ─── Registrar amortização REALIZADA ───────────────────────────────────────
  // Recalcula o cronograma (SAC/PRICE) sobre o saldo devedor atual do contrato,
  // grava o histórico em "amortizacoes" e atualiza o estado do contrato
  // (saldo_devedor, prazo_restante, valor_prestacao, saldo_data). Se o saldo
  // zerar, marca quitado_em. NÃO cria despesas retroativas nem duplica nada; a
  // origem do recurso é informativa (FGTS não afeta saldo bancário).
  //
  // Requer que o contrato tenha os dados mínimos (saldo_devedor, taxa_mensal,
  // sistema, prazo_restante). Caso contrário, lança erro (o chamador pede os
  // dados em vez de inventar valores).
  async function registrarAmortizacao(parcelamento, { data, valor, modo, origem }) {
    bloquearSeConsultoria(modoConsultoria)
    const p = parcelamento
    const saldo = Number(p.saldo_devedor)
    const i = Number(p.taxa_mensal)
    const n = Number(p.prazo_restante)
    const sistema = p.sistema
    if (!(saldo > 0) || !(i >= 0) || !(n > 0) || !sistema) {
      throw new Error('DADOS_INSUFICIENTES')
    }
    const valorNum = Number(valor) || 0
    if (valorNum <= 0) throw new Error('VALOR_INVALIDO')

    const r = amortizarSaldoDevedor({ sistema, saldo, i, n, extra: valorNum, modo })
    if (!r) throw new Error('CALCULO_INVALIDO')

    // 1) Histórico (fotos antes/depois para auditoria).
    const { error: errHist } = await supabase.from('amortizacoes').insert([{
      usuario_id: usuario.id,
      parcelamento_id: p.id,
      data: data || hojeISO(),
      valor: valorNum,
      modo,
      origem,
      saldo_antes: r.saldoAntes,
      saldo_depois: r.saldoDepois,
    }])
    if (errHist) throw errHist

    // 2) Novo estado do contrato.
    const novoSaldo = r.saldoDepois
    const quitou = r.quitacaoTotal || novoSaldo <= 0.005
    const update = {
      saldo_devedor: quitou ? 0 : novoSaldo,
      saldo_data: data || hojeISO(),
      prazo_restante: quitou ? 0 : r.prazoDepois,
      valor_prestacao: quitou ? 0 : r.prestacaoDepois,
    }
    if (quitou) update.quitado_em = data || hojeISO()

    const { error: errUpd } = await supabase
      .from('parcelamentos').update(update).eq('id', p.id)
    if (errUpd) throw errUpd

    await buscar()
    return r
  }

  // Lista o histórico de amortizações de um parcelamento (ordenado por data).
  async function listarAmortizacoes(parcelamentoId) {
    const { data, error } = await supabase
      .from('amortizacoes')
      .select('*')
      .eq('parcelamento_id', parcelamentoId)
      .order('data', { ascending: false })
    if (error) throw error
    return data || []
  }

  // Quitação antecipada: registra a data de hoje, preserva o histórico
  async function quitar(id) {
    bloquearSeConsultoria(modoConsultoria)
    const hoje = hojeISO() // data de hoje no fuso de Brasília
    const { error } = await supabase
      .from('parcelamentos')
      .update({ quitado_em: hoje })
      .eq('id', id)
    if (error) throw error
    // Atualiza estado local: marca como quitado e zera parcelas restantes
    setParcelamentos(prev => prev.map(p =>
      p.id === id
        ? { ...p, quitado_em: hoje, ativo: false, parcelasRestantes: 0, valorRestante: 0 }
        : p
    ))
  }

  async function remover(id) {
    bloquearSeConsultoria(modoConsultoria)
    const { error } = await supabase
      .from('parcelamentos')
      .delete()
      .eq('id', id)
    if (error) throw error
    setParcelamentos(prev => prev.filter(p => p.id !== id))
  }

  // Total das parcelas devidas no mês atual (com arredondamento correto)
  const _hoje = new Date()
  const totalMesAtual = parcelamentos
    .reduce((acc, p) => acc + valorParcelaNoMes(p, _hoje.getFullYear(), _hoje.getMonth() + 1), 0)

  return {
    parcelamentos,
    totalMesAtual,
    carregando,
    erro,
    criar,
    atualizar,
    quitar,
    remover,
    registrarAmortizacao,
    listarAmortizacoes,
    recarregar: buscar,
  }
}
