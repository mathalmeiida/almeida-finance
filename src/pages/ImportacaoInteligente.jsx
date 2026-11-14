
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Landmark, CreditCard, TrendingUp, FileText,
  AlertTriangle, CheckCircle2, Loader2, Pencil, Trash2,
  ShieldCheck, ArrowLeft, RotateCcw, Info, X,
} from 'lucide-react'

import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCartoes } from '../hooks/useCartoes'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { useBeneficios } from '../hooks/useBeneficios'
import { useCategorias } from '../hooks/useCategorias'
import { useImportacoes } from '../hooks/useImportacoes'

import InputMoeda from '../components/InputMoeda'
import ResumoConciliacao from '../components/ResumoConciliacao'
import SelectCustomizado from '../components/SelectCustomizado'

import { formatCurrency, hojeISO } from '../lib/utils'
import { lerArquivoImportacao } from '../lib/importacaoArquivos'
import { buscarExistentes, gravarRegistros } from '../lib/importacaoGravar'

import {
  ROTULOS_TIPO,
  TIPOS_POR_CONTEXTO,
  TIPOS_IMPORTAVEIS,
  MOTIVO_NAO_IMPORTAVEL,
  normalizar,
  prepararItens,
  alterarTipo,
  sugerirCategoria,
  validarItem,
  montarRegistros,
  impactoNoSaldo,
  resumoImportacao,
  intervaloDatas,
} from '../lib/importacaoRegras'

import {
  conciliarTransacoes,
  resumoConciliacao,
  obterEstadoVisual,
} from '../lib/conciliacao'

// ALMEIDA FINANCE — IMPORTAÇÃO INTELIGENTE
// A leitura do documento é feita antes da confirmação.
// A gravação depende de ação explícita do usuário.

const CONTEXTOS = [
  {
    id: 'extrato',
    titulo: 'Extrato bancário',
    texto: 'Receitas, despesas e transferências',
    icone: Landmark,
  },
  {
    id: 'fatura',
    titulo: 'Fatura de cartão',
    texto: 'Compras, parcelas e estornos',
    icone: CreditCard,
  },
  {
    id: 'investimentos',
    titulo: 'Investimentos',
    texto: 'Aportes, resgates e rendimentos',
    icone: TrendingUp,
  },
  {
    id: 'beneficios',
    titulo: 'VR/VA Benefícios',
    texto: 'Recargas e compras',
    icone: FileText,
  },
]

const STATUS = {
  possivel_duplicata: {
    texto: 'Possível duplicidade',
    cor: 'bg-amber-100 text-amber-800',
  },
  possivel_duplicata_fraca: {
    texto: 'Conferir duplicidade',
    cor: 'bg-amber-50 text-amber-700',
  },
  ja_importado: {
    texto: 'Já importado',
    cor: 'bg-gray-100 text-gray-600',
  },
  duplicado_no_arquivo: {
    texto: 'Repetido no arquivo',
    cor: 'bg-gray-100 text-gray-600',
  },
}

const ESTADOS_BLOQUEADOS = [
  'conciliado',
  'ja_importado',
  'duplicata_provavel',
  'duplicata_possivel',
  'divergente',
]

const STATUS_BLOQUEADOS = [
  'ja_importado',
  'duplicado_no_arquivo',
  'possivel_duplicata',
  'possivel_duplicata_fraca',
]

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'incluidos', label: 'Selecionados' },
  { id: 'revisar', label: 'Revisar' },
  { id: 'duplicidades', label: 'Duplicidades' },
  { id: 'fora', label: 'Fora da importação' },
]

const PASSOS = ['Tipo e arquivo', 'Revisar', 'Resultado']

function mensagemErro(erro, padrao) {
  const mensagem = String(erro?.message || '')
  if (/failed to fetch|network|load failed|fetch/i.test(mensagem)) {
    return 'Falha de conexão. Confira os registros antes de tentar novamente.'
  }
  return mensagem || padrao
}

function dataBR(iso) {
  if (!iso) return ''
  const data = new Date(`${iso}T12:00:00`)
  return Number.isNaN(data.getTime())
    ? iso
    : data.toLocaleDateString('pt-BR')
}

function Passos({ etapa }) {
  const atual = etapa === 'concluido'
    ? 2
    : ['previa', 'gravando'].includes(etapa)
      ? 1
      : 0

  return (
    <ol
      className="flex items-center gap-2 text-xs"
      aria-label="Progresso da importação"
      data-testid="importacao-passos"
      data-passo={atual + 1}
    >
      {PASSOS.map((passo, indice) => (
        <li
          key={passo}
          className="flex min-w-0 flex-1 items-center gap-2"
          aria-current={indice === atual ? 'step' : undefined}
        >
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${
            indice <= atual
              ? 'bg-marca text-white'
              : 'bg-gray-200 text-gray-500'
          }`}>
            {indice + 1}
          </span>

          <span className={`truncate ${
            indice === atual
              ? 'font-semibold text-gray-900'
              : 'text-gray-500'
          }`}>
            {passo}
          </span>

          {indice < 2 && (
            <span className={`h-0.5 min-w-2 flex-1 rounded ${
              indice < atual ? 'bg-marca' : 'bg-gray-200'
            }`} />
          )}
        </li>
      ))}
    </ol>
  )
}

function precisaRevisar(item) {
  return Boolean(
    item.revisar ||
    item.avisos?.length ||
    (item.incluir && validarItem(item)) ||
    ESTADOS_BLOQUEADOS.includes(item.estadoConciliacao)
  )
}

function duplicidade(item) {
  return Boolean(
    STATUS[item.status] ||
    ESTADOS_BLOQUEADOS.includes(item.estadoConciliacao)
  )
}

function elegivelParaLote(item) {
  return Boolean(
    TIPOS_IMPORTAVEIS.includes(item.tipo) &&
    !STATUS_BLOQUEADOS.includes(item.status) &&
    !ESTADOS_BLOQUEADOS.includes(item.estadoConciliacao)
  )
}

export default function ImportacaoInteligente({
  embutido = false,
  onConcluir,
  onCancelar,
}) {
  const navigate = useNavigate()
  const { usuario, perfilProprio, somenteLeitura } = useAuth()

  const {
    cartoes = [],
    carregando: carregandoCartoes,
  } = useCartoes()

  const {
    investimentos = [],
    criarMovimentacao,
    carregando: carregandoInv,
  } = useInvestimentos()

  const {
    beneficios = [],
    criarMovimentacao: criarMovimentacaoBeneficio,
    carregando: carregandoBeneficios,
  } = useBeneficios()

  const { categorias: catDespesa = [] } = useCategorias('despesa')
  const { categorias: catReceita = [] } = useCategorias('receita')
  const { carregarChaves, registrar } = useImportacoes()

  const [etapa, setEtapa] = useState('configurar')
  const [contexto, setContexto] = useState('')
  const [contextoDetectado, setContextoDetectado] = useState(null)
  const [contextoConfirmado, setContextoConfirmado] = useState(false)

  const [contaNome, setContaNome] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [investimentoId, setInvestimentoId] = useState('')
  const [beneficioId, setBeneficioId] = useState('')

  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState(null)
  const [leitura, setLeitura] = useState(null)
  const [itens, setItens] = useState([])
  const [historicoDisponivel, setHistoricoDisponivel] = useState(false)

  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [resultado, setResultado] = useState(null)

  const [pendenteSenha, setPendenteSenha] = useState(null)
  const [senhaPdf, setSenhaPdf] = useState('')
  const [progressoLeitura, setProgressoLeitura] = useState('')

  const emGravacao = useRef(false)
  const inputRef = useRef(null)
  const canceladoRef = useRef(false)
  const ultimaLeituraRef = useRef(null)

  const todasCategorias = useMemo(
    () => [...catDespesa, ...catReceita],
    [catDespesa, catReceita]
  )

  const categoriasRef = useRef(todasCategorias)
  categoriasRef.current = todasCategorias

  const hoje = hojeISO()

  const contextoAtual =
    contexto ||
    contextoDetectado ||
    leitura?.tipoDocumento ||
    'extrato'

  useEffect(() => {
    if (!todasCategorias.length) return

    setItens(lista => {
      let mudou = false

      const novaLista = lista.map(item => {
        if (
          item.categoriaEditada ||
          item.categoriaId ||
          item.categoriaNome
        ) return item

        const categoria = sugerirCategoria(
          item.descricao,
          item.tipo,
          todasCategorias
        )

        if (!categoria) return item

        mudou = true

        return item.tipo === 'receita'
          ? { ...item, categoriaNome: categoria.nome }
          : { ...item, categoriaId: categoria.id }
      })

      return mudou ? novaLista : lista
    })
  }, [todasCategorias])

  // LEITURA DE ARQUIVOS

  function aoEscolherArquivo(evento) {
    const arquivos = Array.from(evento.target.files || [])
    evento.target.value = ''

    if (!arquivos.length) return

    setPendenteSenha(null)
    setSenhaPdf('')

    if (arquivos.length === 1) {
      processarArquivo(arquivos[0])
    } else {
      processarVarios(arquivos)
    }
  }

  const progressoOcr = progresso => {
    setProgressoLeitura(
      progresso.fase === 'ocr'
        ? `Reconhecendo texto da página ${progresso.pagina} de ${progresso.total}`
        : ''
    )
  }

  async function processarArquivo(file, senha) {
    canceladoRef.current = false
    setErro('')
    setEtapa('lendo')
    setProgressoLeitura('')

    try {
      const dados = await lerArquivoImportacao(file, {
        senha,
        aoProgresso: progressoOcr,
        cancelado: () => canceladoRef.current,
      })

      if (dados.precisaSenha) {
        setPendenteSenha({
          file,
          incorreta: Boolean(dados.senhaIncorreta),
        })
        setSenhaPdf('')
        setEtapa('configurar')
        return
      }

      setPendenteSenha(null)
      setSenhaPdf('')

      if (canceladoRef.current) {
        setEtapa('configurar')
        return
      }

      if (dados.erro) throw new Error(dados.erro)

      if (!dados.transacoes?.length) {
        throw new Error('Nenhum lançamento válido encontrado.')
      }

      const tipoDetectado =
        dados.tipoDocumento ||
        (dados.ehCartao ? 'fatura' : null)

      if (!contexto && tipoDetectado) {
        setContextoDetectado(tipoDetectado)
        setContextoConfirmado(false)
      }

      if (
        dados.ehCartao &&
        contexto &&
        contexto !== 'fatura'
      ) {
        throw new Error(
          'Este documento é uma fatura. Escolha o tipo Fatura de cartão.'
        )
      }

      await montarPrevia(
        dados,
        {
          nome: file.name,
          formato: dados.formato,
        },
        [],
        {
          contexto: contexto || tipoDetectado || 'extrato',
        }
      )
    } catch (falha) {
      setErro(mensagemErro(falha, 'Erro ao ler o documento.'))
      setEtapa('configurar')
    }
  }

  async function processarVarios(arquivos) {
    canceladoRef.current = false
    setErro('')
    setEtapa('lendo')

    const juntas = []
    const descartadas = []
    const puladas = []

    let formato = null
    let ocr = false
    let instituicao = null
    let truncado = false
    let tipoDocumento = null

    try {
      for (const [indice, file] of arquivos.entries()) {
        if (canceladoRef.current) break

        setProgressoLeitura(
          `Lendo ${indice + 1} de ${arquivos.length}: ${file.name}`
        )

        const dados = await lerArquivoImportacao(file, {
          aoProgresso: progressoOcr,
          cancelado: () => canceladoRef.current,
        })

        if (dados.precisaSenha) {
          puladas.push(`${file.name}: protegido por senha`)
          continue
        }

        if (dados.erro || !dados.transacoes?.length) {
          puladas.push(
            `${file.name}: ${dados.erro || 'sem lançamentos'}`
          )
          continue
        }

        const tipoArquivo =
          dados.tipoDocumento ||
          (dados.ehCartao ? 'fatura' : null)

        if (
          contexto &&
          tipoArquivo &&
          contexto !== tipoArquivo
        ) {
          puladas.push(`${file.name}: tipo incompatível`)
          continue
        }

        if (
          tipoDocumento &&
          tipoArquivo &&
          tipoDocumento !== tipoArquivo
        ) {
          puladas.push(
            `${file.name}: tipo diferente dos outros documentos`
          )
          continue
        }

        // Mantém as repetições legítimas dentro do
        // mesmo arquivo e verifica sobreposição.
        const chave = item =>
          `${item.data}|${item.valor}|${normalizar(item.descricao || '')}`

        const contagemAnterior = new Map()

        for (const item of juntas) {
          const k = chave(item)
          contagemAnterior.set(
            k,
            (contagemAnterior.get(k) || 0) + 1
          )
        }

        const novas = dados.transacoes.filter(item => {
          const k = chave(item)
          const quantidade = contagemAnterior.get(k) || 0

          if (quantidade > 0) {
            contagemAnterior.set(k, quantidade - 1)
            return false
          }

          return true
        })

        if (novas.length < dados.transacoes.length) {
          puladas.push(
            `${file.name}: ${dados.transacoes.length - novas.length} sobreposição(ões) ignorada(s)`
          )
        }

        juntas.push(...novas)
        descartadas.push(...(dados.descartadas || []))

        formato = formato || dados.formato
        ocr = ocr || Boolean(dados.ocr)
        truncado = truncado || Boolean(dados.truncado)
        instituicao = instituicao || dados.instituicao || null
        tipoDocumento = tipoDocumento || tipoArquivo
      }

      if (canceladoRef.current) {
        setEtapa('configurar')
        return
      }

      if (!juntas.length) {
        throw new Error('Nenhuma movimentação válida encontrada.')
      }

      await montarPrevia(
        {
          transacoes: juntas,
          descartadas,
          truncado,
          instituicao,
          ocr,
          tipoDocumento,
        },
        {
          nome: `${arquivos.length} arquivos`,
          formato,
        },
        puladas,
        {
          contexto: contexto || tipoDocumento || 'extrato',
        }
      )
    } catch (falha) {
      setErro(mensagemErro(falha, 'Erro ao processar arquivos.'))
      setEtapa('configurar')
    }
  }

  // CONCILIAÇÃO E PRÉVIA

  async function montarPrevia(
    dados,
    informacoes,
    arquivosIgnorados = [],
    substituicoes = {}
  ) {
    if (!usuario?.id) {
      throw new Error('É necessário entrar na conta.')
    }

    const ctx =
      substituicoes.contexto ||
      contexto ||
      dados.tipoDocumento ||
      contextoDetectado ||
      'extrato'

    const cartaoSelecionado =
      substituicoes.cartaoId ?? cartaoId

    const investimentoSelecionado =
      substituicoes.investimentoId ?? investimentoId

    const beneficioSelecionado =
      substituicoes.beneficioId ?? beneficioId

    const intervalo = intervaloDatas(dados.transacoes)

    const origem =
      ctx === 'fatura'
        ? `cartao:${cartaoSelecionado || 'pendente'}`
        : ctx === 'investimentos'
          ? `inv:${investimentoSelecionado || 'pendente'}`
          : ctx === 'beneficios'
            ? `beneficio:${beneficioSelecionado || 'pendente'}`
            : dados.conta?.conta
              ? `extrato:${normalizar(dados.conta.banco || '')}:${normalizar(dados.conta.conta)}`
              : `extrato:${normalizar(contaNome) || 'principal'}`

    const [existentes, historico] = await Promise.all([
      buscarExistentes(supabase, {
        usuarioId: usuario.id,
        contexto: ctx,
        intervalo,
        cartaoId: cartaoSelecionado || null,
        investimentoId: investimentoSelecionado || null,
        beneficioId: beneficioSelecionado || null,
      }),
      carregarChaves(),
    ])

    const chaves = historico?.chaves || new Set()

    let preparados = prepararItens(dados.transacoes, {
      contexto: ctx,
      origem,
      categorias: categoriasRef.current,
      existentes: existentes || [],
      chavesImportadas: chaves,
      cartaoId: ctx === 'fatura'
        ? cartaoSelecionado || null
        : null,
      investimentoId: ctx === 'investimentos'
        ? investimentoSelecionado || null
        : null,
      beneficioId: ctx === 'beneficios'
        ? beneficioSelecionado || null
        : null,
      investimentos,
      beneficios,
    })

    preparados = conciliarTransacoes(
      preparados,
      existentes || [],
      chaves
    )

    ultimaLeituraRef.current = {
      dados,
      informacoes,
      arquivosIgnorados,
    }

    setHistoricoDisponivel(Boolean(historico?.disponivel))
    setItens(preparados)
    setArquivo(informacoes)

    setLeitura({
      descartadas: dados.descartadas || [],
      truncado: Boolean(dados.truncado),
      intervalo,
      instituicao: dados.instituicao || null,
      ocr: Boolean(dados.ocr),
      tipoDocumento: ctx,
      puladas: arquivosIgnorados,
    })

    setContextoDetectado(ctx)
    setFiltro('todos')
    setEditando(null)
    setEtapa('previa')
  }

  async function vincularCartao(id) {
    if (emGravacao.current) return

    const leituraAnterior = ultimaLeituraRef.current
    if (!leituraAnterior) {
      setErro('Leitura não encontrada. Envie o documento novamente.')
      return
    }

    if (!id) {
      setErro('Selecione um cartão.')
      return
    }

    setErro('')
    setEtapa('lendo')

    try {
      await montarPrevia(
        leituraAnterior.dados,
        leituraAnterior.informacoes,
        leituraAnterior.arquivosIgnorados,
        { contexto: 'fatura', cartaoId: id }
      )

      setCartaoId(id)
      setContexto('fatura')
      setErro('')
    } catch (falha) {
      setErro(
        mensagemErro(falha, 'Não foi possível vincular o cartão.')
      )
      setEtapa('previa')
    }
  }

  // SELEÇÃO E EDIÇÃO

  const atualizar = (uid, alteracoes) => {
    if (emGravacao.current) return

    setItens(lista =>
      lista.map(item =>
        item.uid === uid
          ? { ...item, ...alteracoes }
          : item
      )
    )
  }

  const mudarTipo = (uid, tipo) => {
    if (emGravacao.current) return

    setItens(lista =>
      lista.map(item =>
        item.uid === uid
          ? alterarTipo(item, tipo)
          : item
      )
    )
  }

  const removerItem = uid => {
    if (emGravacao.current) return

    setItens(lista =>
      lista.filter(item => item.uid !== uid)
    )

    setEditando(atual => atual === uid ? null : atual)
  }

  const marcarTodos = incluir => {
    if (emGravacao.current) return

    setItens(lista =>
      lista.map(item => ({
        ...item,
        incluir: Boolean(
          incluir && elegivelParaLote(item)
        ),
      }))
    )
  }

  // RESUMO FINANCEIRO

  const resumo = useMemo(
    () => resumoImportacao(itens),
    [itens]
  )

  const resumoConciliacaoData = useMemo(
    () => resumoConciliacao(itens),
    [itens]
  )

  const impacto = useMemo(
    () => impactoNoSaldo(itens, {
      saldoBaseData: perfilProprio?.saldo_base_data || null,
      hoje,
    }),
    [itens, perfilProprio?.saldo_base_data, hoje]
  )

  const selecionados = itens.filter(item => item.incluir)

  const comErro = selecionados.filter(
    item => Boolean(validarItem(item))
  )

  const quantidadeMarcada = selecionados.length
  const quantidadePronta = quantidadeMarcada - comErro.length

  const valorMarcado = selecionados.reduce(
    (soma, item) =>
      soma + Math.abs(Number(item.valor) || 0),
    0
  )

  const quantidadeRevisar = itens.filter(
    precisaRevisar
  ).length

  const visiveis = itens.filter(item => {
    switch (filtro) {
      case 'incluidos':
        return item.incluir
      case 'revisar':
        return precisaRevisar(item)
      case 'duplicidades':
        return duplicidade(item)
      case 'fora':
        return !item.incluir
      default:
        return true
    }
  })

  // GRAVAÇÃO

  async function confirmar() {
    if (
      emGravacao.current ||
      somenteLeitura ||
      !usuario?.id
    ) return

    const registros = montarRegistros(itens, {
      categorias: todasCategorias,
    })

    if (registros.erros.length || comErro.length) {
      setErro(
        'Existem lançamentos selecionados com informações incompletas.'
      )
      setFiltro('revisar')
      return
    }

    const total =
      registros.receitas.length +
      registros.despesas.length +
      registros.compras_cartao.length +
      registros.investimentos_movimentacoes.length +
      registros.beneficios_movimentacoes.length

    if (total === 0) {
      setErro('Nenhum lançamento válido selecionado.')
      return
    }

    if (
      selecionados.some(item =>
        ESTADOS_BLOQUEADOS.includes(item.estadoConciliacao) ||
        STATUS_BLOQUEADOS.includes(item.status)
      )
    ) {
      setErro(
        'Existem possíveis duplicidades selecionadas. Revise antes de continuar.'
      )
      setFiltro('duplicidades')
      return
    }

    emGravacao.current = true
    setErro('')
    setEtapa('gravando')

    try {
      const { gravados, falhas } =
        await gravarRegistros(supabase, {
          usuarioId: usuario.id,
          registros,
          criarMovimentacao,
          criarMovimentacaoBeneficio,
        })

      let historico = { registrado: false }

      if (gravados.length > 0) {
        try {
          const contextoFinal = contextoAtual

          historico = await registrar({
            resumo: {
              contexto: contextoFinal,
              formato: arquivo?.formato || null,
              origem: (
                contextoFinal === 'fatura'
                  ? cartoes.find(c => c.id === cartaoId)?.nome
                  : contextoFinal === 'investimentos'
                    ? investimentos.find(
                        i => i.id === investimentoId
                      )?.nome
                    : contextoFinal === 'beneficios'
                      ? beneficios.find(
                          b => b.id === beneficioId
                        )?.nome
                      : contaNome || 'Conta principal'
              )?.slice(0, 120) || null,
              periodo_inicio: leitura?.intervalo?.inicio || null,
              periodo_fim: leitura?.intervalo?.fim || null,
              qtd_lidas: itens.length,
              qtd_importadas: gravados.length,
              qtd_ignoradas: itens.length - gravados.length,
              status: falhas.length ? 'parcial' : 'concluida',
            },
            gravados,
          })
        } catch {
          historico = { registrado: false }
        }
      }

      const porTabela = gravados.reduce(
        (acumulador, item) => {
          acumulador[item.tabela] =
            (acumulador[item.tabela] || 0) + 1
          return acumulador
        },
        {}
      )

      setResultado({
        gravados: gravados.length,
        porTabela,
        falhas,
        historico: Boolean(historico?.registrado),
        itens: gravados.map(item => ({
          ...item,
          tipo: item.tipo || 'desconhecido',
          descricao: item.descricao || '',
          valor: item.valor || 0,
          data: item.data || hoje,
          incluir: true,
          _importado: true,
          _confirmado: false,
        })),
      })

      setEtapa('concluido')
    } catch (falha) {
      setErro(
        `Importação interrompida: ${mensagemErro(
          falha,
          'Verifique os registros já salvos antes de tentar novamente.'
        )}`
      )
      setEtapa('previa')
    } finally {
      emGravacao.current = false
    }
  }

  function recomecar() {
    if (emGravacao.current) return

    ultimaLeituraRef.current = null
    canceladoRef.current = false

    setEtapa('configurar')
    setItens([])
    setArquivo(null)
    setLeitura(null)
    setResultado(null)
    setErro('')
    setFiltro('todos')
    setEditando(null)
    setContextoDetectado(null)
    setContextoConfirmado(false)
    setPendenteSenha(null)
    setSenhaPdf('')
  }

  const conteiner = embutido
    ? 'w-full min-w-0 space-y-4'
    : 'w-full min-w-0 space-y-4 pb-24 md:pb-6'

  if (somenteLeitura) {
    return (
      <div className={conteiner}>
        <div className="card text-sm text-gray-600">
          Modo Consultoria: apenas o titular pode importar movimentações.
        </div>
      </div>
    )
  }

  return (
    <div className={conteiner} data-testid="importacao">
      {!embutido && (
        <header>
          <h1 className="text-xl font-bold text-gray-900">
            Importação Inteligente
          </h1>
          <p className="text-sm text-gray-500">
            Importe extratos, faturas e movimentações.
            Revise tudo antes de salvar.
          </p>
        </header>
      )}

      <Passos etapa={etapa} />

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertTriangle size={18} className="shrink-0" />
          <span>{erro}</span>
          <button
            type="button"
            onClick={() => setErro('')}
            className="ml-auto"
            aria-label="Fechar aviso"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {/* ETAPA 1 — ARQUIVO */}

      {(etapa === 'configurar' || etapa === 'lendo') && (
        <div className="space-y-4">
          <section className="card space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                O que você deseja importar?
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                A escolha é opcional. Também identificamos
                o tipo automaticamente.
              </p>
            </div>

            {contextoDetectado && !contextoConfirmado && (
              <div className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800">
                Tipo identificado:{' '}
                <strong>
                  {CONTEXTOS.find(
                    item => item.id === contextoDetectado
                  )?.titulo || contextoDetectado}
                </strong>
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {CONTEXTOS.map(item => {
                const Icone = item.icone
                const ativo = contexto === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={etapa === 'lendo'}
                    aria-pressed={ativo}
                    onClick={() => {
                      setContexto(item.id)
                      setContextoConfirmado(true)
                      setErro('')
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left ${
                      ativo
                        ? 'border-[#821C3E] bg-[#821C3E]/5'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <Icone
                      size={20}
                      className={ativo
                        ? 'text-[#821C3E]'
                        : 'text-gray-400'}
                    />

                    <span>
                      <span className="block text-xs font-semibold text-gray-900">
                        {item.titulo}
                      </span>
                      <span className="mt-1 block text-[11px] text-gray-500">
                        {item.texto}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="card space-y-3">
            {contexto === 'extrato' && (
              <div>
                <label className="label" htmlFor="imp-conta">
                  Nome da conta (opcional)
                </label>
                <input
                  id="imp-conta"
                  className="input w-full"
                  value={contaNome}
                  maxLength={60}
                  placeholder="Ex.: Conta Bradesco"
                  onChange={e => setContaNome(e.target.value)}
                />
              </div>
            )}

            {contexto === 'fatura' && (
              <div>
                <label className="label" id="imp-cartao-label">
                  Cartão
                </label>
                <SelectCustomizado
                  id="imp-cartao"
                  value={cartaoId}
                  onChange={setCartaoId}
                  options={cartoes.map(c => ({
                    value: c.id,
                    label: `${c.nome}${c.banco ? ` • ${c.banco}` : ''}`,
                  }))}
                  placeholder="Selecione o cartão"
                  disabled={carregandoCartoes}
                />
                {!carregandoCartoes && !cartoes.length && (
                  <p className="mt-2 text-xs text-amber-700">
                    Cadastre um cartão antes de confirmar
                    a importação da fatura.
                  </p>
                )}
              </div>
            )}

            {contexto === 'investimentos' && (
              <div>
                <label className="label" id="imp-inv-label">
                  Investimento
                </label>
                <SelectCustomizado
                  id="imp-inv"
                  value={investimentoId}
                  onChange={setInvestimentoId}
                  options={investimentos.map(i => ({
                    value: i.id,
                    label: i.nome,
                  }))}
                  placeholder="Selecionar investimento"
                  disabled={carregandoInv}
                />
              </div>
            )}

            {contexto === 'beneficios' && (
              <div>
                <label className="label" id="imp-beneficio-label">
                  Benefício VR/VA
                </label>
                <SelectCustomizado
                  id="imp-beneficio"
                  value={beneficioId}
                  onChange={setBeneficioId}
                  options={beneficios.map(b => ({
                    value: b.id,
                    label: b.nome,
                  }))}
                  placeholder="Selecionar benefício"
                  disabled={carregandoBeneficios}
                />
              </div>
            )}

            {pendenteSenha && (
              <form
                data-testid="importacao-senha"
                className="space-y-3 rounded-xl bg-amber-50 p-3"
                onSubmit={e => {
                  e.preventDefault()
                  if (senhaPdf) {
                    processarArquivo(pendenteSenha.file, senhaPdf)
                  }
                }}
              >
                <label className="label" htmlFor="imp-senha">
                  Senha do PDF
                </label>
                {pendenteSenha.incorreta && (
                  <p className="text-xs text-red-700">
                    Senha incorreta.
                  </p>
                )}
                <input
                  id="imp-senha"
                  type="password"
                  className="input w-full"
                  value={senhaPdf}
                  autoComplete="off"
                  onChange={e => setSenhaPdf(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!senhaPdf}
                  className="btn-primary"
                >
                  Abrir PDF
                </button>
              </form>
            )}
          </section>

          <section className="card space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#821C3E]/10">
              <Upload size={24} className="text-[#821C3E]" />
            </div>

            <div>
              <h2 className="text-base font-semibold">
                Adicione seus documentos
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                PDF, CSV, OFX, XLS ou XLSX.
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              multiple
              className="sr-only"
              accept=".csv,.ofx,.xlsx,.xls,.pdf,.txt"
              data-testid="importacao-arquivo"
              onChange={aoEscolherArquivo}
              disabled={etapa === 'lendo'}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={etapa === 'lendo'}
              className="btn-primary flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
            >
              {etapa === 'lendo' ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Escolher arquivo
                </>
              )}
            </button>

            {progressoLeitura && (
              <p role="status" className="text-xs text-gray-500">
                {progressoLeitura}
              </p>
            )}

            {etapa === 'lendo' && (
              <button
                type="button"
                onClick={() => {
                  canceladoRef.current = true
                }}
                className="text-xs text-[#821C3E] underline"
              >
                Cancelar leitura
              </button>
            )}

            <p className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={16} />
              O arquivo é analisado antes de qualquer gravação.
            </p>
          </section>

          {embutido && onCancelar && (
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={onCancelar}
            >
              Voltar
            </button>
          )}
        </div>
      )}

      {/* ETAPA 2 — REVISÃO */}

      {(etapa === 'previa' || etapa === 'gravando') && (
        <div className="space-y-4">
          <section
            className="card space-y-3"
            data-testid="importacao-resumo"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#821C3E]/10">
                <FileText size={20} className="text-[#821C3E]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-base font-semibold">
                  {itens.length} movimentações identificadas
                </h2>
                <p className="break-words text-xs text-gray-500">
                  {arquivo?.nome}
                  {arquivo?.formato
                    ? ` · ${arquivo.formato.toUpperCase()}`
                    : ''}
                  {leitura?.intervalo
                    ? ` · ${dataBR(leitura.intervalo.inicio)} a ${dataBR(leitura.intervalo.fim)}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(resumo.porTipo).map(
                ([tipo, quantidade]) => (
                  <span
                    key={tipo}
                    className="rounded-full bg-gray-100 px-3 py-1 text-[11px] text-gray-600"
                  >
                    {quantidade}{' '}
                    {(ROTULOS_TIPO[tipo] || tipo).toLowerCase()}
                  </span>
                )
              )}
            </div>

            {contextoAtual === 'fatura' && (
              <p className="text-xs leading-5 text-gray-500">
                As compras serão registradas no cartão,
                não diretamente no saldo bancário.
              </p>
            )}

            {contextoAtual === 'extrato' && (
              <p
                data-testid="importacao-impacto"
                className="rounded-xl bg-sky-50 p-3 text-xs text-sky-800"
              >
                {impacto.saldoConfigurado
                  ? `${impacto.noPeriodo} lançamentos podem alterar o saldo em ${formatCurrency(impacto.delta)}.`
                  : 'Saldo inicial não configurado. Os registros poderão integrar o histórico.'}
              </p>
            )}

            {!historicoDisponivel && (
              <p className="text-xs text-amber-700">
                Histórico de importações indisponível.
                Confira possíveis duplicidades.
              </p>
            )}

            {leitura?.ocr && (
              <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Documento lido por OCR. Confira datas e valores.
              </p>
            )}

            {leitura?.puladas?.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                {leitura.puladas.map((item, indice) => (
                  <p key={indice}>{item}</p>
                ))}
              </div>
            )}

            {leitura?.truncado && (
              <p className="text-xs text-amber-800">
                A leitura foi limitada. Confira se faltam movimentações.
              </p>
            )}

            {leitura?.descartadas?.length > 0 && (
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer">
                  {leitura.descartadas.length} linhas não reconhecidas
                </summary>
                <ul className="mt-2 space-y-1">
                  {leitura.descartadas.slice(0, 40).map(
                    (item, indice) => (
                      <li key={indice}>
                        Linha {item.linha}: {item.motivo}
                      </li>
                    )
                  )}
                </ul>
              </details>
            )}
          </section>

          {/* VINCULAÇÃO DO CARTÃO */}

          {contextoAtual === 'fatura' && (
            <section
              className="rounded-2xl border border-[#821C3E]/20 bg-white p-4 sm:p-5"
              data-testid="vincular-cartao-fatura"
            >
              <div className="mb-3 flex items-start gap-3">
                <CreditCard
                  size={21}
                  className="shrink-0 text-[#821C3E]"
                />
                <div>
                  <h3 className="text-sm font-semibold">
                    Vincular cartão da fatura
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Selecione uma vez para associar
                    as compras deste documento.
                  </p>
                </div>
              </div>

              <select
                id="cartao-revisao"
                className="input w-full"
                value={cartaoId}
                disabled={
                  etapa === 'gravando' ||
                  carregandoCartoes
                }
                onChange={e => vincularCartao(e.target.value)}
              >
                <option value="">Selecione um cartão</option>
                {cartoes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.banco ? ` • ${c.banco}` : ''}
                  </option>
                ))}
              </select>

              {!cartaoId && (
                <p className="mt-2 text-xs text-amber-800">
                  As compras precisam de um cartão vinculado
                  para serem gravadas.
                </p>
              )}

              <p className="mt-2 text-[11px] text-gray-500">
                Alterar o cartão refaz a prévia e descarta
                edições manuais ainda não salvas.
              </p>
            </section>
          )}

          <ResumoConciliacao
            resumo={resumoConciliacaoData}
            itens={itens}
            incluidos={quantidadePronta}
            revisar={quantidadeRevisar}
          />

          {/* FILTROS */}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTROS.map(item => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filtro === item.id}
                onClick={() => setFiltro(item.id)}
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium ${
                  filtro === item.id
                    ? 'bg-[#821C3E] text-white'
                    : 'border border-gray-200 bg-white text-gray-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-gray-500">
              {visiveis.length} neste filtro
            </span>
            <div className="flex gap-4">
              <button
                type="button"
                disabled={etapa === 'gravando'}
                onClick={() => marcarTodos(true)}
                className="text-[#821C3E]"
              >
                Marcar elegíveis
              </button>
              <button
                type="button"
                disabled={etapa === 'gravando'}
                onClick={() => marcarTodos(false)}
                className="text-gray-500"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          {/* LANÇAMENTOS */}

          <ul className="space-y-2" data-testid="importacao-lista">
            {visiveis.length === 0 && (
              <li className="card text-center text-sm text-gray-500">
                Nenhum lançamento neste filtro.
              </li>
            )}

            {visiveis.map(item => {
              const importavel =
                TIPOS_IMPORTAVEIS.includes(item.tipo)

              const problema = item.incluir
                ? validarItem(item)
                : null

              const aberto = editando === item.uid
              const estado = STATUS[item.status]
              const categoriasTipo =
                item.tipo === 'receita'
                  ? catReceita
                  : catDespesa

              return (
                <li
                  key={item.uid}
                  data-item={item.uid}
                  className={`rounded-2xl border bg-white p-3 sm:p-4 ${
                    problema
                      ? 'border-red-300'
                      : item.revisar
                        ? 'border-amber-200'
                        : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[#821C3E]"
                      checked={Boolean(item.incluir)}
                      disabled={
                        !importavel ||
                        etapa === 'gravando' ||
                        STATUS_BLOQUEADOS.includes(item.status) ||
                        ESTADOS_BLOQUEADOS.includes(item.estadoConciliacao)
                      }
                      onChange={e =>
                        atualizar(item.uid, {
                          incluir: e.target.checked,
                        })
                      }
                      aria-label={`Importar ${item.descricao}`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 break-words text-sm font-semibold text-gray-900">
                          {item.descricao}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          {item.entrada ? '+' : '−'}{' '}
                          {formatCurrency(item.valor)}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="text-gray-500">
                          {dataBR(item.data)}
                        </span>

                        <span className="rounded-full bg-[#821C3E]/10 px-2 py-0.5 text-[#821C3E]">
                          {ROTULOS_TIPO[item.tipo] || item.tipo}
                        </span>

                        {item.revisar && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">
                            Revisar
                          </span>
                        )}

                        {estado && (
                          <span className={`rounded-full px-2 py-0.5 ${estado.cor}`}>
                            {estado.texto}
                          </span>
                        )}

                        {item.estadoConciliacao &&
                          item.estadoConciliacao !== 'novo' &&
                          (() => {
                            const visual = obterEstadoVisual(
                              item.estadoConciliacao
                            )
                            return (
                              <span className={`rounded-full px-2 py-0.5 ${visual.bg} ${visual.cor}`}>
                                {visual.label}
                              </span>
                            )
                          })()}
                      </div>

                      {!importavel &&
                        MOTIVO_NAO_IMPORTAVEL[item.tipo] && (
                          <p className="mt-2 text-xs text-gray-500">
                            {MOTIVO_NAO_IMPORTAVEL[item.tipo]}
                          </p>
                        )}

                      {item.avisos?.length > 0 && (
                        <details className="mt-3 rounded-xl bg-amber-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-medium text-amber-800">
                            Precisa revisar · {item.avisos.length}{' '}
                            {item.avisos.length === 1
                              ? 'aviso'
                              : 'avisos'}
                          </summary>
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-amber-800">
                            {item.avisos.map((aviso, indice) => (
                              <li key={indice}>{aviso}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {problema && (
                        <p role="alert" className="mt-2 text-xs text-red-700">
                          {problema}
                        </p>
                      )}

                      {/* FORMULÁRIO DE EDIÇÃO */}

                      {aberto && (
                        <div className="mt-3 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className="label" htmlFor={`d-${item.uid}`}>
                              Descrição
                            </label>
                            <input
                              id={`d-${item.uid}`}
                              className="input w-full"
                              maxLength={200}
                              value={item.descricao}
                              onChange={e =>
                                atualizar(item.uid, {
                                  descricao: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="label" htmlFor={`dt-${item.uid}`}>
                              Data
                            </label>
                            <input
                              id={`dt-${item.uid}`}
                              type="date"
                              className="input w-full"
                              value={item.data}
                              onChange={e =>
                                atualizar(item.uid, {
                                  data: e.target.value,
                                })
                              }
                            />
                          </div>

                          <div>
                            <label className="label" htmlFor={`v-${item.uid}`}>
                              Valor
                            </label>
                            <InputMoeda
                              id={`v-${item.uid}`}
                              valor={item.valor}
                              prefixo={null}
                              className="input"
                              onChangeValor={valor =>
                                atualizar(item.uid, { valor })
                              }
                            />
                          </div>

                          <div>
                            <label className="label" htmlFor={`t-${item.uid}`}>
                              Tipo
                            </label>
                            <select
                              id={`t-${item.uid}`}
                              className="input w-full"
                              value={item.tipo}
                              onChange={e =>
                                mudarTipo(item.uid, e.target.value)
                              }
                            >
                              {(TIPOS_POR_CONTEXTO[contextoAtual] || []).map(tipo => (
                                <option key={tipo} value={tipo}>
                                  {ROTULOS_TIPO[tipo] || tipo}
                                </option>
                              ))}
                            </select>
                          </div>

                          {['receita', 'despesa', 'compra'].includes(item.tipo) && (
                            <div>
                              <label className="label" htmlFor={`c-${item.uid}`}>
                                Categoria
                              </label>
                              <select
                                id={`c-${item.uid}`}
                                className="input w-full"
                                value={
                                  item.tipo === 'receita'
                                    ? item.categoriaNome || ''
                                    : item.categoriaId || ''
                                }
                                onChange={e =>
                                  atualizar(
                                    item.uid,
                                    item.tipo === 'receita'
                                      ? {
                                          categoriaNome: e.target.value || null,
                                          categoriaEditada: true,
                                        }
                                      : {
                                          categoriaId: e.target.value || null,
                                          categoriaEditada: true,
                                        }
                                  )
                                }
                              >
                                <option value="">Sem categoria</option>
                                {categoriasTipo.map(c => (
                                  <option
                                    key={c.id}
                                    value={
                                      item.tipo === 'receita'
                                        ? c.nome
                                        : c.id
                                    }
                                  >
                                    {c.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {item.tipo === 'compra' && (
                            <>
                              <div>
                                <label className="label" htmlFor={`ca-${item.uid}`}>
                                  Cartão
                                </label>
                                <select
                                  id={`ca-${item.uid}`}
                                  className="input w-full"
                                  value={item.cartaoId || ''}
                                  onChange={e =>
                                    atualizar(item.uid, {
                                      cartaoId: e.target.value || null,
                                    })
                                  }
                                >
                                  <option value="">Selecione</option>
                                  {cartoes.map(c => (
                                    <option key={c.id} value={c.id}>
                                      {c.nome}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="label" htmlFor={`p-${item.uid}`}>
                                  Total de parcelas
                                </label>
                                <input
                                  id={`p-${item.uid}`}
                                  type="number"
                                  min="1"
                                  max="72"
                                  className="input w-full"
                                  value={item.parcelaTotal || 1}
                                  onChange={e => {
                                    const n = Math.max(
                                      1,
                                      Math.min(
                                        72,
                                        parseInt(e.target.value, 10) || 1
                                      )
                                    )
                                    atualizar(item.uid, {
                                      parcelaTotal: n > 1 ? n : null,
                                      parcelaAtual: n > 1
                                        ? Math.min(item.parcelaAtual || 1, n)
                                        : null,
                                    })
                                  }}
                                />
                              </div>
                            </>
                          )}

                          {contextoAtual === 'investimentos' && (
                            <div>
                              <label className="label" htmlFor={`i-${item.uid}`}>
                                Investimento
                              </label>
                              <select
                                id={`i-${item.uid}`}
                                className="input w-full"
                                value={item.investimentoId || ''}
                                onChange={e =>
                                  atualizar(item.uid, {
                                    investimentoId: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">Selecione</option>
                                {investimentos.map(i => (
                                  <option key={i.id} value={i.id}>
                                    {i.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {contextoAtual === 'beneficios' && (
                            <div>
                              <label className="label" htmlFor={`b-${item.uid}`}>
                                Benefício
                              </label>
                              <select
                                id={`b-${item.uid}`}
                                className="input w-full"
                                value={item.beneficioId || ''}
                                onChange={e =>
                                  atualizar(item.uid, {
                                    beneficioId: e.target.value || null,
                                  })
                                }
                              >
                                <option value="">Selecione</option>
                                {beneficios.map(b => (
                                  <option key={b.id} value={b.id}>
                                    {b.nome}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        <button
                          type="button"
                          disabled={etapa === 'gravando'}
                          onClick={() =>
                            setEditando(aberto ? null : item.uid)
                          }
                          className="flex items-center gap-1 text-[#821C3E]"
                        >
                          <Pencil size={14} />
                          {aberto ? 'Concluir edição' : 'Editar'}
                        </button>

                        <button
                          type="button"
                          disabled={etapa === 'gravando'}
                          onClick={() => removerItem(item.uid)}
                          className="flex items-center gap-1 text-gray-500 hover:text-red-700"
                        >
                          <Trash2 size={14} />
                          Remover da lista
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* CONFIRMAÇÃO */}

          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Marcados</p>
                <p className="text-lg font-semibold">
                  {quantidadeMarcada}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Prontos</p>
                <p className="text-lg font-semibold text-emerald-700">
                  {quantidadePronta}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Com erro</p>
                <p className="text-lg font-semibold text-red-700">
                  {comErro.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Valor marcado</p>
                <p className="text-base font-semibold text-[#821C3E]">
                  {formatCurrency(valorMarcado)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={etapa === 'gravando'}
                onClick={recomecar}
                className="btn-secondary flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                Trocar arquivo
              </button>

              <button
                type="button"
                disabled={etapa === 'gravando'}
                onClick={() =>
                  embutido && onCancelar
                    ? onCancelar()
                    : recomecar()
                }
                className="btn-secondary"
              >
                Cancelar
              </button>

              <button
                type="button"
                data-testid="importacao-confirmar"
                disabled={
                  etapa === 'gravando' ||
                  quantidadePronta === 0 ||
                  comErro.length > 0
                }
                onClick={confirmar}
                className="btn-primary flex flex-1 items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                {etapa === 'gravando' ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Salvando...
                  </>
                ) : comErro.length > 0 ? (
                  `Corrigir ${comErro.length} lançamento(s)`
                ) : (
                  <>
                    <CheckCircle2 size={17} />
                    Confirmar importação ({quantidadePronta})
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ETAPA 3 — RESULTADO */}

      {etapa === 'concluido' && resultado && (
        <section
          className="card mx-auto max-w-2xl space-y-4 text-center"
          data-testid="importacao-concluida"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
            <CheckCircle2 size={30} className="text-emerald-700" />
          </div>

          <h2 className="text-xl font-semibold text-gray-900">
            {resultado.falhas.length
              ? 'Importação parcialmente concluída'
              : 'Importação concluída'}
          </h2>

          <p className="text-sm text-gray-600">
            {resultado.gravados} lançamentos salvos
          </p>

          <ul className="space-y-2 rounded-xl bg-gray-50 p-4 text-left text-sm">
            {Object.entries(resultado.porTabela).map(
              ([tabela, quantidade]) => (
                <li
                  key={tabela}
                  className="flex items-center justify-between"
                >
                  <span>
                    {{
                      receitas: 'Receitas',
                      despesas: 'Despesas',
                      compras_cartao: 'Compras no cartão',
                      investimentos_movimentacoes: 'Investimentos',
                      beneficios_movimentacoes: 'Benefícios VR/VA',
                    }[tabela] || tabela}
                  </span>
                  <strong>{quantidade}</strong>
                </li>
              )
            )}
          </ul>

          {resultado.falhas.length > 0 && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-left text-xs text-red-700"
            >
              <strong>Alguns registros não foram salvos.</strong>
              {resultado.falhas.map((falha, indice) => (
                <p key={indice} className="mt-2">
                  {falha.quantidade} em {falha.tabela}: {falha.mensagem}
                </p>
              ))}
              <p className="mt-2">
                Confira os registros existentes antes de repetir.
              </p>
            </div>
          )}

          {!resultado.historico && (
            <p className="text-xs text-amber-700">
              O histórico não foi registrado. Confira possíveis
              duplicidades antes de uma nova tentativa.
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={recomecar}
              className="btn-secondary flex-1"
            >
              Importar outro arquivo
            </button>
            <button
              type="button"
              onClick={() =>
                embutido
                  ? onConcluir?.(resultado)
                  : navigate('/')
              }
              className="btn-primary flex-1"
            >
              {embutido ? 'Continuar' : 'Ir para a Home'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
