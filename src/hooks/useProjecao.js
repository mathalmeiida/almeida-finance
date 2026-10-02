import { useMemo } from 'react'
import { useReceitas } from './useReceitas'
import { useDespesas, valorDespesaRecorrenteNoMes } from './useDespesas'
import { useParcelamentos, valorParcelaNoMes } from './useParcelamentos'
import { useCartoes } from './useCartoes'
import { useComprasCartao } from './useComprasCartao'
import { totalFaturaCompleta } from '../lib/faturaCartao'
import { useAuth } from '../contexts/AuthContext'
import { labelMes } from '../lib/utils'

/**
 * Hook central de projeção financeira.
 * Gera os dados dos próximos 12 meses a partir dos dados reais do usuário.
 *
 * Lógica por mês:
 *   receitas  = receitas recorrentes + receitas não-recorrentes do mês atual (se for o mês atual)
 *   despesas  = despesas recorrentes + despesas não-recorrentes do mês atual (se for o mês atual)
 *   parcelas  = soma das parcelas ainda ativas naquele mês
 *   saldo     = receitas - despesas - parcelas
 */
export function useProjecao() {
  // Busca dados do mês atual (para não-recorrentes)
  const mesAtual = new Date().getMonth() + 1
  const anoAtual = new Date().getFullYear()

  const { receitas, carregando: carregandoR } = useReceitas(mesAtual, anoAtual)
  const { despesas, recorrentes, carregando: carregandoD, criar: criarDespesa, recarregar: recarregarDespesas } = useDespesas(mesAtual, anoAtual)
  const { parcelamentos, carregando: carregandoP } = useParcelamentos()
  const { cartoes, carregando: carregandoCartoes } = useCartoes()
  const { compras: comprasCartao, carregando: carregandoCompras } = useComprasCartao()
  const { perfil } = useAuth()

  // Percentual de reserva de emergência escolhido no Dashboard (padrão 20%).
  // Mesma fonte usada no card de reserva — projeção e Dashboard nunca divergem.
  const reservaPct = perfil?.reserva_percentual != null
    ? Number(perfil.reserva_percentual)
    : 20

  const carregando = carregandoR || carregandoD || carregandoP || carregandoCartoes || carregandoCompras

  // Soma das faturas de todos os cartões em um mês/ano específico.
  // USA A MESMA FONTE da tela Cartões → "Ver fatura"/"Próximas faturas"
  // (totalFaturaCompleta). Isso garante que a projeção e a tela de Cartões
  // nunca divirjam para nenhum cartão, nº de parcelas, data de compra,
  // fechamento ou vencimento.
  //
  // totalFaturaCompleta já consolida, por cartão:
  //   (1) compras de compras_cartao — competência pela regra de FECHAMENTO
  //   (2) parcelamentos vinculados por cartao_id — competência pela 1ª parcela
  // Nada é duplicado: parcelamentos COM cartao_id entram SÓ aqui; os sem
  // cartão entram em parcelasAvulsasNoMes.
  function faturasNoMes(ano, mes) {
    return cartoes.reduce((acc, c) => {
      const comprasDoCartao = comprasCartao.filter(cp => cp.cartao_id === c.id)
      const parcelamentosDoCartao = parcelamentos.filter(p => p.cartao_id === c.id)
      const total = totalFaturaCompleta(
        comprasDoCartao, parcelamentosDoCartao, c.dia_fechamento, ano, mes
      )
      return acc + total
    }, 0)
  }

  // FONTE ÚNICA das parcelas avulsas (SEM cartão) devidas em um mês/ano.
  // Usada tanto no total do mês (Dashboard) quanto na projeção de 12 meses,
  // garantindo o MESMO cálculo nos dois lugares. Parcelamentos COM cartão
  // entram via faturasNoMes (evita dupla contagem). valorParcelaNoMes já
  // respeita início, quantidade de parcelas e término do parcelamento.
  function parcelasAvulsasNoMes(ano, mes) {
    return parcelamentos
      .filter(p => !p.quitado_em && !p.cartao_id)
      .reduce((acc, p) => acc + valorParcelaNoMes(p, ano, mes), 0)
  }

  // SOMENTE PARA EXIBIÇÃO no card "Parcelas do mês": soma TODAS as parcelas
  // devidas no mês — avulsas + vinculadas a cartão. NÃO é usada em nenhum
  // total de compromisso/disponível (as de cartão já entram via faturasNoMes).
  function todasParcelasNoMes(ano, mes) {
    return parcelamentos
      .filter(p => !p.quitado_em)
      .reduce((acc, p) => acc + valorParcelaNoMes(p, ano, mes), 0)
  }
  // Quantidade de parcelamentos com parcela devida neste mês (avulsos + cartão)
  function qtdParcelamentosNoMes(ano, mes) {
    return parcelamentos
      .filter(p => !p.quitado_em && valorParcelaNoMes(p, ano, mes) > 0)
      .length
  }

  // Totais do mês corrente (para o Dashboard)
  const totalReceitas = receitas.reduce((acc, r) => acc + Number(r.valor), 0)
  const totalDespesas = despesas.reduce((acc, r) => acc + Number(r.valor), 0)
  const totalParcelas = parcelasAvulsasNoMes(anoAtual, mesAtual)
  const totalFaturasCartao = faturasNoMes(anoAtual, mesAtual)
  const sobraMes = totalReceitas - totalDespesas - totalParcelas - totalFaturasCartao
  // Valores apenas de exibição (não entram no cálculo de sobra/compromissos)
  const totalParcelasExibicao = todasParcelasNoMes(anoAtual, mesAtual)
  const qtdParcelasExibicao = qtdParcelamentosNoMes(anoAtual, mesAtual)

  // Totais por tipo de despesa (fixa / variavel)
  const totalDespesasFixas = despesas
    .filter(d => d.tipo_despesa === 'fixa')
    .reduce((acc, d) => acc + Number(d.valor), 0)
  const totalDespesasVariaveis = despesas
    .filter(d => d.tipo_despesa !== 'fixa')
    .reduce((acc, d) => acc + Number(d.valor), 0)
  const percentualRendaFixa = totalReceitas > 0
    ? Math.round((totalDespesasFixas / totalReceitas) * 100)
    : 0

  // Base mensal de receitas recorrentes
  const receitasRecorrentes = receitas
    .filter(r => r.recorrente)
    .reduce((acc, r) => acc + Number(r.valor), 0)

  // Projeção dos próximos 12 meses
  const projecao = useMemo(() => {
    if (carregando) return []

    const meses = []
    const hoje = new Date()

    for (let i = 0; i < 12; i++) {
      const data = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1)
      const ano = data.getFullYear()
      const mes = data.getMonth() + 1
      const ehMesAtual = i === 0

      // Receitas: recorrentes sempre + não-recorrentes só no mês atual
      const receitasMes = ehMesAtual
        ? totalReceitas
        : receitasRecorrentes

      // Despesas recorrentes NESTE mês — valor convertido conforme a frequência
      // (mensal, semanal × ocorrências, diária × dias do mês, por_meses dentro do prazo)
      const recorrentesMes = recorrentes
        .reduce((acc, d) => acc + valorDespesaRecorrenteNoMes(d, ano, mes), 0)

      // No mês atual, soma também as despesas pontuais (não-recorrentes) do mês.
      // As recorrentes do mês atual já entram em recorrentesMes.
      const pontuaisMesAtual = ehMesAtual
        ? despesas.filter(d => !d.recorrente).reduce((acc, d) => acc + Number(d.valor), 0)
        : 0

      const despesasFixas = recorrentesMes + pontuaisMesAtual

      // Parcelas avulsas (SEM cartão) devidas neste mês — MESMA função do total
      // do mês, para projeção e Dashboard nunca divergirem. Parcelamentos com
      // cartão entram via faturaMesCartao (evita dupla contagem).
      const parcelasMes = parcelasAvulsasNoMes(ano, mes)

      // Fatura dos cartões neste mês (compromisso do mês, sem duplicar despesas)
      const faturaMesCartao = faturasNoMes(ano, mes)

      const despesasTotais = despesasFixas + parcelasMes + faturaMesCartao
      // saldo = sobra ANTES da reserva (mantido para compatibilidade com o
      // simulador "Posso Comprar?" e a página de Projeção).
      const saldo = receitasMes - despesasTotais

      // Reserva de emergência prevista do mês: % sobre a RECEITA prevista
      // daquele mês. Mesma regra do card de reserva no Dashboard.
      const reserva = receitasMes > 0 ? receitasMes * (reservaPct / 100) : 0
      // Disponível para gastar = Receita − Compromissos − Reserva
      const disponivel = saldo - reserva

      meses.push({
        mes: labelMes(data),
        ano,
        mesNum: mes,
        receitas: receitasMes,
        despesas: despesasTotais,
        parcelas: parcelasMes,
        faturaCartao: faturaMesCartao,
        saldo,          // sobra antes da reserva (compat.)
        reserva,        // reserva de emergência prevista do mês
        disponivel,     // Receita − Compromissos − Reserva
        ehMesAtual,
      })
    }

    return meses
  }, [carregando, totalReceitas, totalDespesas, totalParcelas, totalFaturasCartao,
      receitasRecorrentes, despesas, recorrentes, parcelamentos, cartoes, comprasCartao,
      reservaPct])

  return {
    carregando,
    projecao,
    // resumo do mês atual
    resumoMes: {
      receitaTotal: totalReceitas,
      despesaTotal: totalDespesas,
      parcelasTotal: totalParcelas,          // só avulsas — usado nos cálculos de sobra/compromissos
      faturasTotal: totalFaturasCartao,      // fatura de cartões do mês (compromisso)
      sobraPrevista: sobraMes,
      // APENAS EXIBIÇÃO no card "Parcelas do mês" (avulsas + cartão):
      parcelasTotalExibicao: totalParcelasExibicao,
      qtdParcelasExibicao,
      qtdReceitas: receitas.length,
      qtdDespesas: despesas.length,
      qtdParcelamentos: parcelamentos.filter(p => p.ativo).length,
      // totais por tipo de despesa
      totalDespesasFixas,
      totalDespesasVariaveis,
      percentualRendaFixa,
    },
    // dados brutos para o simulador
    receitas,
    despesas,
    recorrentes,
    parcelamentos,
    // mês/ano de referência
    mesAtual,
    anoAtual,
    // ações reaproveitáveis (ex: gasto rápido no Dashboard)
    criarDespesa,
    recarregarDespesas,
  }
}
