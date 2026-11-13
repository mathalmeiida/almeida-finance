import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, Landmark, CreditCard, TrendingUp, FileText, AlertTriangle, CheckCircle2, Loader2,
  Pencil, Trash2, ShieldCheck, ArrowLeft, RotateCcw, Info, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCartoes } from '../hooks/useCartoes'
import { useInvestimentos } from '../hooks/useInvestimentos'
import { useCategorias } from '../hooks/useCategorias'
import { useImportacoes } from '../hooks/useImportacoes'
import InputMoeda from '../components/InputMoeda'
import ResumoConciliacao from '../components/ResumoConciliacao'
import ConciliacaoPrevia from '../components/ConciliacaoPrevia'
import { formatCurrency, hojeISO } from '../lib/utils'
import { lerArquivoImportacao } from '../lib/importacaoArquivos'
import { buscarExistentes, gravarRegistros } from '../lib/importacaoGravar'
import {
  ROTULOS_TIPO, TIPOS_POR_CONTEXTO, TIPOS_IMPORTAVEIS, MOTIVO_NAO_IMPORTAVEL, normalizar,
  prepararItens, alterarTipo, sugerirCategoria, validarItem, montarRegistros, impactoNoSaldo, resumoImportacao, intervaloDatas,
} from '../lib/importacaoRegras'
import { conciliarTransacoes, resumoConciliacao, obterEstadoVisual } from '../lib/conciliacao'

// ─── Importação Inteligente ──────────────────────────────────────────────────
// 1) Escolher o tipo de documento e a origem  2) anexar o arquivo (lido NO
// NAVEGADOR, nunca enviado)  3) conferir, corrigir e confirmar  4) gravar
// nas tabelas existentes. Nada é gravado antes da confirmação explícita.
// Props (uso dentro do onboarding): embutido, onConcluir, onCancelar.

const CONTEXTOS = [
  { id: 'extrato', titulo: 'Extrato bancário', texto: 'Receitas, despesas e transferências', icone: Landmark },
  { id: 'fatura', titulo: 'Fatura de cartão', texto: 'Compras, parcelas e estornos', icone: CreditCard },
  { id: 'investimentos', titulo: 'Investimentos', texto: 'Aportes, resgates, rendimentos', icone: TrendingUp },
]

const STATUS = {
  possivel_duplicata: { texto: 'Possível duplicidade', cor: 'bg-amber-100 text-amber-800' },
  possivel_duplicata_fraca: { texto: 'Confira duplicidade', cor: 'bg-amber-50 text-amber-700' },
  ja_importado: { texto: 'Já importado', cor: 'bg-gray-100 text-gray-600' },
  duplicado_no_arquivo: { texto: 'Repetido no arquivo', cor: 'bg-gray-100 text-gray-600' },
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'incluidos', label: 'Serão importados' },
  { id: 'revisar', label: 'Revisar' },
  { id: 'duplicidades', label: 'Duplicidades' },
  { id: 'fora', label: 'Fora da importação' },
]

// Falha de rede vira mensagem clara (sem expor detalhes técnicos).
function mensagemErro(err, padrao) {
  const m = String(err?.message || '')
  if (/failed to fetch|network|load failed|fetch/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo. Nada foi gravado nesta tentativa.'
  return m || padrao
}

const PASSOS = ['Tipo e arquivo', 'Revisar', 'Resultado']
function Passos({ etapa }) {
  const atual = etapa === 'concluido' ? 2 : (etapa === 'previa' || etapa === 'gravando') ? 1 : 0
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Progresso da importação" data-testid="importacao-passos" data-passo={atual + 1}>
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-2 flex-1 min-w-0" aria-current={i === atual ? 'step' : undefined}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-semibold ${i <= atual ? 'bg-marca text-white' : 'bg-gray-200 text-gray-500'}`}>{i + 1}</span>
          <span className={`truncate ${i === atual ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{p}</span>
          {i < PASSOS.length - 1 && <span className={`h-0.5 flex-1 rounded ${i < atual ? 'bg-marca' : 'bg-gray-200'}`} />}
        </li>
      ))}
    </ol>
  )
}

const dataBR = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '')

export default function ImportacaoInteligente({ embutido = false, onConcluir, onCancelar }) {
  const navigate = useNavigate()
  const { usuario, perfilProprio, somenteLeitura } = useAuth()
  const { cartoes, carregando: carregandoCartoes } = useCartoes()
  const { investimentos, criarMovimentacao, carregando: carregandoInv } = useInvestimentos()
  const { categorias: catDespesa } = useCategorias('despesa')
  const { categorias: catReceita } = useCategorias('receita')
  const { carregarChaves, registrar } = useImportacoes()

  const [etapa, setEtapa] = useState('configurar') // configurar | lendo | previa | gravando | concluido
  const [contexto, setContexto] = useState('extrato')
  const [contaNome, setContaNome] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [investimentoId, setInvestimentoId] = useState('')
  const [erro, setErro] = useState('')
  const [arquivo, setArquivo] = useState(null) // { nome, formato }
  const [leitura, setLeitura] = useState(null) // { descartadas, truncado }
  const [itens, setItens] = useState([])
  const [historicoDisponivel, setHistoricoDisponivel] = useState(false)
  const [filtro, setFiltro] = useState('todos')
  const [editando, setEditando] = useState(null)
  const [resultado, setResultado] = useState(null)
  const emGravacao = useRef(false)
  const inputRef = useRef(null)

  const todasCategorias = useMemo(() => [...catDespesa, ...catReceita], [catDespesa, catReceita])
  const hoje = hojeISO()
  // Lista atual de categorias (evita usar a lista vazia se elas terminarem
  // de carregar durante a leitura do arquivo).
  const categoriasRef = useRef(todasCategorias)
  categoriasRef.current = todasCategorias

  // Se as categorias terminarem de carregar depois da leitura do arquivo,
  // completa as sugestões, sem sobrescrever o que o usuário escolheu.
  useEffect(() => {
    if (!todasCategorias.length) return
    setItens(lista => {
      let mudou = false
      const nova = lista.map(i => {
        if (i.categoriaEditada || i.categoriaId || i.categoriaNome) return i
        const cat = sugerirCategoria(i.descricao, i.tipo, todasCategorias)
        if (!cat) return i
        mudou = true
        return i.tipo === 'receita' ? { ...i, categoriaNome: cat.nome } : { ...i, categoriaId: cat.id }
      })
      return mudou ? nova : lista
    })
  }, [todasCategorias])

  const origemValida = contexto === 'extrato' || (contexto === 'fatura' ? !!cartaoId : !!investimentoId)

  // PDF protegido: a senha fica só neste estado, é usada na leitura e descartada.
  const [pendenteSenha, setPendenteSenha] = useState(null) // { file, incorreta }
  const [senhaPdf, setSenhaPdf] = useState('')
  const [progressoLeitura, setProgressoLeitura] = useState('')
  const canceladoRef = useRef(false)

  function aoEscolherArquivo(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!files.length || !origemValida) return
    setPendenteSenha(null); setSenhaPdf('')
    if (files.length === 1) processarArquivo(files[0])
    else processarVarios(files)
  }

  const progressoOcr = p => setProgressoLeitura(p.fase === 'ocr' ? `Reconhecendo o texto da imagem (OCR)... página ${p.pagina} de ${p.total}` : '')

  // Vários documentos de uma vez: lê um a um e junta numa única conferência.
  // Duplicidades entre arquivos são detectadas pelo mesmo mecanismo. PDFs com
  // senha ou com erro ficam de fora (listados) para serem enviados à parte.
  async function processarVarios(files) {
    canceladoRef.current = false
    setErro(''); setEtapa('lendo'); setProgressoLeitura('')
    const juntas = []; const descartadas = []; const puladas = []
    let formato = null; let ocr = false; let instituicao = null; let truncado = false; let tipoDocumento = null; let ehCartao = false
    try {
      for (const [i, file] of files.entries()) {
        if (canceladoRef.current) break
        setProgressoLeitura(`Lendo ${i + 1} de ${files.length}: ${file.name}`)
        const r = await lerArquivoImportacao(file, { aoProgresso: progressoOcr, cancelado: () => canceladoRef.current })
        if (r.precisaSenha) { puladas.push(`${file.name} (protegido por senha; envie-o sozinho)`); continue }
        if (r.erro || !r.transacoes?.length) { puladas.push(`${file.name} (${r.erro || 'nenhum lançamento encontrado'})`); continue }
        if (r.ehCartao && contexto !== 'fatura') { puladas.push(`${file.name} (é fatura de cartão; escolha "Fatura de cartão")`); continue }
        // Períodos sobrepostos entre arquivos: o que já veio de um arquivo anterior
        // (mesma data, valor e descrição) não entra de novo. Repetições legítimas
        // dentro do mesmo arquivo são mantidas.
        const chave = t => `${t.data}|${t.valor}|${normalizar(t.descricao || '')}`
        const disponiveis = new Map()
        for (const t of juntas) disponiveis.set(chave(t), (disponiveis.get(chave(t)) || 0) + 1)
        const novas = r.transacoes.filter(t => {
          const k = chave(t); const n = disponiveis.get(k) || 0
          if (n > 0) { disponiveis.set(k, n - 1); return false }
          return true
        })
        if (novas.length < r.transacoes.length) puladas.push(`${file.name}: ${r.transacoes.length - novas.length} lançamento(s) já presentes em outro arquivo foram ignorados`)
        formato = formato || r.formato; juntas.push(...novas); descartadas.push(...(r.descartadas || []))
        ocr = ocr || !!r.ocr; truncado = truncado || !!r.truncado
        instituicao = instituicao || r.instituicao || null; tipoDocumento = tipoDocumento || r.tipoDocumento || null; ehCartao = ehCartao || !!r.ehCartao
      }
      if (canceladoRef.current) { setEtapa('configurar'); return }
      if (!juntas.length) throw new Error(`Nenhum lançamento válido encontrado. ${puladas.join('; ')}`)
      await montarPrevia({ transacoes: juntas, descartadas, truncado, instituicao, ocr, tipoDocumento }, { nome: `${files.length} arquivos`, formato }, puladas)
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível ler os arquivos.'))
      setEtapa('configurar')
    }
  }

  async function processarArquivo(file, senha) {
    canceladoRef.current = false
    setErro(''); setEtapa('lendo'); setProgressoLeitura('')
    try {
      const r = await lerArquivoImportacao(file, {
        senha,
        aoProgresso: progressoOcr,
        cancelado: () => canceladoRef.current,
      })
      if (r.precisaSenha) { setPendenteSenha({ file, incorreta: !!r.senhaIncorreta }); setSenhaPdf(''); setEtapa('configurar'); return }
      setPendenteSenha(null); setSenhaPdf('')
      if (canceladoRef.current) { setEtapa('configurar'); return }
      if (r.erro) throw new Error(r.erro)
      if (r.ehCartao && contexto !== 'fatura') throw new Error('Este OFX é de cartão de crédito. Escolha "Fatura de cartão" e o cartão correspondente.')
      if (!r.transacoes.length) throw new Error('Nenhum lançamento válido encontrado no arquivo.')
      await montarPrevia(r, { nome: file.name, formato: r.formato }, [])
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível ler o arquivo.'))
      setEtapa('configurar')
    }
  }

  async function montarPrevia(r, info, puladas) {
    {
      const intervalo = intervaloDatas(r.transacoes)
      const origem = contexto === 'fatura' ? `cartao:${cartaoId}`
        : contexto === 'investimentos' ? `inv:${investimentoId}`
        : r.conta?.conta ? `extrato:${normalizar(r.conta.banco || '')}:${normalizar(r.conta.conta)}`
        : `extrato:${normalizar(contaNome) || 'principal'}`
      const [existentes, hist] = await Promise.all([
        buscarExistentes(supabase, { usuarioId: usuario?.id, contexto, intervalo, cartaoId, investimentoId }),
        carregarChaves(),
      ])
      setHistoricoDisponivel(hist.disponivel)
      
      // Preparar itens com regras existentes
      let itensPreparados = prepararItens(r.transacoes, {
        contexto, origem, categorias: categoriasRef.current, existentes, chavesImportadas: hist.chaves,
        cartaoId: contexto === 'fatura' ? cartaoId : null,
        investimentoId: contexto === 'investimentos' ? investimentoId : null,
        investimentos,
      })
      
      // Aplicar conciliação inteligente (Fase 3)
      itensPreparados = conciliarTransacoes(itensPreparados, existentes, hist.chaves)
      
      setItens(itensPreparados)
      setArquivo(info)
      setLeitura({ descartadas: r.descartadas || [], truncado: !!r.truncado, intervalo, instituicao: r.instituicao || null, ocr: !!r.ocr, tipoDocumento: r.tipoDocumento || null, puladas })
      setFiltro('todos'); setEditando(null)
      setEtapa('previa')
    }
  }

  const atualizar = (uid, mudanca) => setItens(lista => lista.map(i => (i.uid === uid ? { ...i, ...mudanca } : i)))
  const mudarTipo = (uid, tipo) => setItens(lista => lista.map(i => (i.uid === uid ? alterarTipo(i, tipo) : i)))
  const removerItem = uid => { setItens(lista => lista.filter(i => i.uid !== uid)); if (editando === uid) setEditando(null) }
  const marcarTodos = valor => setItens(lista => lista.map(i => (TIPOS_IMPORTAVEIS.includes(i.tipo) ? { ...i, incluir: valor } : i)))

  const resumo = useMemo(() => resumoImportacao(itens), [itens])
  const resumoConciliacaoData = useMemo(() => resumoConciliacao(itens), [itens])
  const impacto = useMemo(() => impactoNoSaldo(itens, { saldoBaseData: perfilProprio?.saldo_base_data || null, hoje }), [itens, perfilProprio?.saldo_base_data, hoje])
  const comErro = itens.filter(i => i.incluir && validarItem(i))

  const visiveis = itens.filter(i => {
    if (filtro === 'incluidos') return i.incluir
    if (filtro === 'revisar') return i.revisar || (i.incluir && validarItem(i))
    if (filtro === 'duplicidades') return !!STATUS[i.status]
    if (filtro === 'fora') return !i.incluir
    return true
  })

  async function confirmar() {
    if (emGravacao.current || somenteLeitura) return
    const registros = montarRegistros(itens, { categorias: todasCategorias })
    if (registros.erros.length) { setErro('Corrija os lançamentos marcados antes de confirmar.'); setFiltro('revisar'); return }
    const total = registros.receitas.length + registros.despesas.length + registros.compras_cartao.length + registros.investimentos_movimentacoes.length
    if (!total) return
    emGravacao.current = true
    setErro(''); setEtapa('gravando')
    try {
      const { gravados, falhas } = await gravarRegistros(supabase, { usuarioId: usuario.id, registros, criarMovimentacao })
      let hist = { registrado: false }
      if (gravados.length) {
        hist = await registrar({
          resumo: {
            contexto, formato: arquivo.formato,
            origem: (contexto === 'fatura' ? cartoes.find(c => c.id === cartaoId)?.nome
              : contexto === 'investimentos' ? investimentos.find(i => i.id === investimentoId)?.nome
              : contaNome || 'Conta principal')?.slice(0, 120) || null,
            periodo_inicio: leitura.intervalo?.inicio || null, periodo_fim: leitura.intervalo?.fim || null,
            qtd_lidas: itens.length, qtd_importadas: gravados.length, qtd_ignoradas: itens.length - gravados.length,
            status: falhas.length ? 'parcial' : 'concluida',
          },
          gravados,
        })
      }
      const porTabela = gravados.reduce((a, g) => ({ ...a, [g.tabela]: (a[g.tabela] || 0) + 1 }), {})
      setResultado({ gravados: gravados.length, porTabela, falhas, historico: hist.registrado })
      setEtapa('concluido')
    } catch (err) {
      setErro(`A importação foi interrompida. ${mensagemErro(err, '')} Confira em Receitas/Despesas o que já foi salvo antes de tentar de novo.`)
      setEtapa('previa')
    } finally {
      emGravacao.current = false
    }
  }

  function recomecar() {
    setEtapa('configurar'); setItens([]); setArquivo(null); setLeitura(null); setResultado(null); setErro('')
  }

  const conteiner = embutido ? 'space-y-4' : 'w-full max-w-none space-y-4 pb-24 md:pb-6'

  if (somenteLeitura) {
    return <div className={conteiner}><div className="card text-sm text-gray-600">Modo Consultoria: a importação fica disponível apenas para o titular da conta.</div></div>
  }

  return (
    <div className={conteiner} data-testid="importacao">
      {!embutido && (
        <header>
          <h1 className="text-xl font-bold text-gray-900">Importação Inteligente</h1>
          <p className="text-sm text-gray-500">Importe extratos, faturas e movimentações de investimento e confira tudo antes de salvar.</p>
        </header>
      )}

      <Passos etapa={etapa} />

      {erro && (
        <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl p-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{erro}
            {!embutido && /manualmente/.test(erro) && (
              <span className="flex gap-3 mt-2">
                <button type="button" className="underline font-medium" onClick={() => navigate('/despesas?novo=1')}>Cadastrar despesa</button>
                <button type="button" className="underline font-medium" onClick={() => navigate('/receitas?novo=1')}>Cadastrar receita</button>
              </span>
            )}
          </span>
        </div>
      )}

      {/* ─── 1. Tipo e origem + arquivo ─── */}
      {(etapa === 'configurar' || etapa === 'lendo') && (
        <div className="card space-y-4">
          <div>
            <p className="label">O que você vai importar?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de documento">
              {CONTEXTOS.map(c => (
                <button key={c.id} type="button" role="radio" aria-checked={contexto === c.id}
                  onClick={() => { setContexto(c.id); setErro('') }}
                  className={`flex items-center sm:flex-col sm:items-start gap-2 rounded-xl border p-3 text-left transition-colors ${
                    contexto === c.id ? 'border-marca bg-marca-100' : 'border-gray-200 hover:border-gray-300'}`}>
                  <c.icone size={18} className="text-marca flex-shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-900">{c.titulo}</span>
                    <span className="block text-xs text-gray-500">{c.texto}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6 md:items-start" data-testid="importacao-colunas">
          <div className="space-y-4">
          {contexto === 'extrato' && (
            <div>
              <label className="label" htmlFor="imp-conta">Conta <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input id="imp-conta" className="input" maxLength={60} placeholder="Ex.: Conta corrente Banco X"
                value={contaNome} onChange={e => setContaNome(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Para separar duplicidades entre contas.</p>
            </div>
          )}
          {contexto === 'fatura' && (
            <div>
              <label className="label" htmlFor="imp-cartao">Cartão</label>
              <select id="imp-cartao" className="input" value={cartaoId} onChange={e => setCartaoId(e.target.value)}>
                <option value="">Escolha o cartão da fatura</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>)}
              </select>
              {!carregandoCartoes && cartoes.length === 0 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {embutido ? 'Nenhum cartão. Pule e cadastre depois.' : <><button type="button" className="text-marca underline font-medium" onClick={() => navigate('/cartoes?novo=1')}>Cadastrar cartão</button> ou pule esta etapa.</>}
                </p>
              )}
            </div>
          )}
          {contexto === 'investimentos' && (
            <div>
              <label className="label" htmlFor="imp-inv">Investimento</label>
              <select id="imp-inv" className="input" value={investimentoId} onChange={e => setInvestimentoId(e.target.value)}>
                <option value="">Escolha o investimento</option>
                {investimentos.map(i => <option key={i.id} value={i.id}>{i.nome}{i.instituicao ? ` • ${i.instituicao}` : ''}</option>)}
              </select>
              {!carregandoInv && investimentos.length === 0 && (
                <p className="text-xs text-gray-500 mt-1.5">
                  {embutido ? 'Nenhum investimento. Pule e cadastre depois.' : <><button type="button" className="text-marca underline font-medium" onClick={() => navigate('/investimentos?novo=1')}>Cadastrar investimento</button> ou pule esta etapa.</>}
                </p>
              )}
            </div>
          )}

          {pendenteSenha && (
            <form data-testid="importacao-senha" className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2"
              onSubmit={e => { e.preventDefault(); if (senhaPdf) processarArquivo(pendenteSenha.file, senhaPdf) }}>
              <label className="label" htmlFor="imp-senha">Este PDF é protegido por senha</label>
              {pendenteSenha.incorreta && <p className="text-xs text-red-600" role="alert">Senha incorreta. Tente novamente.</p>}
              <input id="imp-senha" type="password" className="input" autoComplete="off" autoFocus value={senhaPdf} onChange={e => setSenhaPdf(e.target.value)} placeholder="Senha do PDF" />
              <p className="text-[11px] text-gray-500">A senha é usada só para abrir o arquivo neste aparelho e não é guardada.</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => { setPendenteSenha(null); setSenhaPdf('') }}>Cancelar</button>
                <button type="submit" disabled={!senhaPdf || etapa === 'lendo'} className="btn-primary flex-1 disabled:opacity-50">Abrir PDF</button>
              </div>
            </form>
          )}

          </div>
          <div className="space-y-4">
          <div>
            <input ref={inputRef} type="file" className="sr-only" multiple data-testid="importacao-arquivo"
              accept=".csv,.ofx,.xlsx,.xls,.pdf,.txt,text/csv,application/pdf"
              onChange={aoEscolherArquivo} disabled={!origemValida || etapa === 'lendo'} />
            <button type="button" onClick={() => inputRef.current?.click()} disabled={!origemValida || etapa === 'lendo'}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-50">
              {etapa === 'lendo' ? <><Loader2 size={16} className="animate-spin" /> {progressoLeitura || 'Lendo arquivo...'}</> : <><Upload size={16} /> Escolher arquivo</>}
            </button>
            <p className="text-xs text-gray-500 mt-2">CSV, OFX, XLSX/XLS ou PDF até 5 MB. PDFs digitalizados são lidos por OCR (pode levar alguns segundos). PDFs com senha pedem a senha na hora (não é guardada).</p>
            {etapa === 'lendo' && progressoLeitura && (
              <button type="button" className="text-xs text-marca underline mt-1" data-testid="importacao-cancelar-leitura" onClick={() => { canceladoRef.current = true }}>Cancelar leitura</button>
            )}
          </div>

          <p className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
            <ShieldCheck size={15} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            Lido localmente (não enviado a servidor). Só dados confirmados são salvos.
          </p>
          {embutido && onCancelar && (
            <button type="button" onClick={onCancelar} className="btn-secondary w-full flex items-center justify-center gap-1.5">
              <ArrowLeft size={15} /> Voltar
            </button>
          )}
          </div>
          </div>
        </div>
      )}

      {/* ─── 2. Conferência ─── */}
      {(etapa === 'previa' || etapa === 'gravando') && (
        <>
          <div className="card space-y-3" data-testid="importacao-resumo">
            <div className="flex items-start gap-3">
              <span className="w-10 h-10 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0"><FileText size={18} className="text-marca" /></span>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900">{itens.length} movimentações identificadas</p>
                <p className="text-xs text-gray-500 truncate">{arquivo?.nome} · {arquivo?.formato?.toUpperCase()}{leitura?.instituicao ? ` · ${leitura.instituicao}` : ''}{leitura?.intervalo ? ` · ${dataBR(leitura.intervalo.inicio)} a ${dataBR(leitura.intervalo.fim)}` : ''}</p>
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5 text-xs" aria-label="Resumo por tipo">
              {Object.entries(resumo.porTipo).map(([t, n]) => (
                <li key={t} className="rounded-full bg-gray-100 text-gray-700 px-2.5 py-1">{n} {ROTULOS_TIPO[t].toLowerCase()}</li>
              ))}
              {resumo.duplicidades > 0 && <li className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">{resumo.duplicidades} possíveis duplicidades</li>}
              {resumo.revisar > 0 && <li className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-1">{resumo.revisar} para revisar</li>}
            </ul>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Serão importados</p><p className="text-sm font-bold text-gray-900" data-testid="importacao-qtd-incluidos">{resumo.incluidos}</p></div>
              <div className="rounded-xl bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Entradas</p><p className="text-sm font-bold text-emerald-600">{formatCurrency(resumo.entradas)}</p></div>
              <div className="rounded-xl bg-gray-50 p-2"><p className="text-[11px] text-gray-500">Saídas</p><p className="text-sm font-bold text-rose-600">{formatCurrency(resumo.saidas)}</p></div>
            </div>
            {contexto === 'extrato' && (
              <p className="flex items-start gap-2 text-xs text-gray-600 bg-sky-50 rounded-xl p-3" data-testid="importacao-impacto">
                <Info size={15} className="text-sky-600 flex-shrink-0 mt-0.5" />
                <span>
                  {!impacto.saldoConfigurado
                    ? 'Seu saldo ainda não foi configurado: os lançamentos entram no histórico e nas análises.'
                    : impacto.noPeriodo > 0
                      ? <>Os {impacto.noPeriodo} lançamentos depois de {dataBR(perfilProprio.saldo_base_data)} (data do seu saldo) mudam o saldo disponível em <strong>{formatCurrency(impacto.delta)}</strong>. Se o saldo do app já está igual ao do banco, revise as duplicidades antes de confirmar.</>
                      : `Nenhum lançamento é posterior a ${dataBR(perfilProprio.saldo_base_data)} (data do seu saldo): o saldo disponível não muda.`}
                  {impacto.saldoConfigurado && impacto.antesDaBase > 0 && ` ${impacto.antesDaBase} lançamentos anteriores entram só como histórico.`}
                  {' '}Transferências, pagamentos de fatura e aplicações ficam fora por padrão.
                </span>
              </p>
            )}
            {contexto === 'fatura' && <p className="text-xs text-gray-500">As compras entram na fatura do cartão (não no saldo disponível). Pagamentos e estornos ficam fora para não contar em dobro.</p>}
            {contexto === 'investimentos' && <p className="text-xs text-gray-500">As movimentações atualizam o patrimônio investido; o saldo disponível não muda.</p>}
            {!historicoDisponivel && <p className="text-[11px] text-gray-400">Histórico de importações indisponível no momento: a duplicidade é verificada pelos lançamentos já cadastrados.</p>}
            {leitura?.ocr && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3" data-testid="importacao-aviso-ocr">Este PDF é uma imagem e foi lido por OCR no seu aparelho. O reconhecimento pode errar números e datas: confira cada lançamento antes de confirmar.</p>}
            {leitura?.tipoDocumento && leitura.tipoDocumento !== contexto && <p className="text-xs text-sky-800 bg-sky-50 rounded-xl p-3" data-testid="importacao-aviso-tipo">Este documento parece ser {{ fatura: 'uma fatura de cartão', extrato: 'um extrato bancário', investimentos: 'um extrato de investimentos' }[leitura.tipoDocumento]}, mas você escolheu "{CONTEXTOS.find(c => c.id === contexto)?.titulo}". Se estiver errado, use Trocar arquivo.</p>}
            {leitura?.puladas?.length > 0 && <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-3" data-testid="importacao-puladas">Avisos da leitura: {leitura.puladas.join('; ')}.</p>}
            {leitura?.truncado && <p className="text-xs text-amber-700">O arquivo tem mais de 2.000 lançamentos; só os primeiros 2.000 foram lidos. Exporte um período menor.</p>}
            {leitura?.descartadas?.length > 0 && (
              <details className="text-xs text-gray-500">
                <summary className="cursor-pointer">{leitura.descartadas.length} linhas não reconhecidas ou ignoradas</summary>
                <ul className="mt-1 space-y-0.5" data-testid="importacao-nao-reconhecidas">{leitura.descartadas.slice(0, 40).map((d, i) => <li key={i}>Linha {d.linha}: {d.motivo}{d.trecho ? <span className="block text-gray-400 break-words">“{d.trecho}”</span> : null}</li>)}</ul>
              </details>
            )}
          </div>

          {/* Resumo de Conciliação (Fase 3) */}
          {itens.length > 0 && <ResumoConciliacao resumo={resumoConciliacaoData} />}

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Filtrar lançamentos">
            {FILTROS.map(f => (
              <button key={f.id} type="button" role="tab" aria-selected={filtro === f.id} onClick={() => setFiltro(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${filtro === f.id ? 'bg-marca text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-end gap-3 text-xs">
            <button type="button" className="text-marca hover:underline" onClick={() => marcarTodos(true)}>Marcar todos</button>
            <button type="button" className="text-gray-500 hover:underline" onClick={() => marcarTodos(false)}>Desmarcar todos</button>
          </div>

          <ul className="space-y-2" data-testid="importacao-lista">
            {visiveis.length === 0 && <li className="card text-sm text-gray-500 text-center">Nenhum lançamento neste filtro.</li>}
            {visiveis.map(it => {
              const importavel = TIPOS_IMPORTAVEIS.includes(it.tipo)
              const problema = it.incluir ? validarItem(it) : null
              const st = STATUS[it.status]
              const aberto = editando === it.uid
              const catsDoTipo = it.tipo === 'receita' ? catReceita : catDespesa
              const nomeCategoria = it.tipo === 'receita' ? it.categoriaNome : catDespesa.find(c => c.id === it.categoriaId)?.nome
              return (
                <li key={it.uid} data-item={it.uid} className={`card !p-3 ${problema ? 'ring-1 ring-red-300' : ''} ${!it.incluir ? 'opacity-80' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" className="mt-1 w-5 h-5 accent-current text-marca flex-shrink-0" checked={it.incluir}
                      disabled={!importavel || etapa === 'gravando'}
                      onChange={e => atualizar(it.uid, { incluir: e.target.checked })}
                      aria-label={`Importar ${it.descricao}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 break-words min-w-0">{it.descricao}</p>
                        <p className={`text-sm font-semibold flex-shrink-0 ${it.entrada ? 'text-emerald-600' : 'text-gray-900'}`}>{it.entrada ? '+' : '−'} {formatCurrency(it.valor)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                        <span className="text-gray-500">{dataBR(it.data)}</span>
                        <span className="rounded-full bg-marca-100 text-marca px-2 py-0.5" data-tipo={it.tipo}>{ROTULOS_TIPO[it.tipo]}</span>
                        {nomeCategoria && <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">{nomeCategoria}</span>}
                        {it.parcelaTotal && <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5">Parcela {it.parcelaAtual}/{it.parcelaTotal}</span>}
                        {it.estadoConciliacao && it.estadoConciliacao !== 'novo' && (() => {
                          const estadoVisual = obterEstadoVisual(it.estadoConciliacao)
                          return <span className={`rounded-full px-2 py-0.5 ${estadoVisual.bg} ${estadoVisual.cor}`} data-estado={it.estadoConciliacao}>{estadoVisual.label}</span>
                        })()}
                        {st && <span className={`rounded-full px-2 py-0.5 ${st.cor}`} data-status={it.status}>{st.texto}</span>}
                        {it.revisar && <span className="rounded-full bg-sky-100 text-sky-800 px-2 py-0.5">Revisar</span>}
                      </div>
                      {!importavel && MOTIVO_NAO_IMPORTAVEL[it.tipo] && <p className="text-[11px] text-gray-500 mt-1">{MOTIVO_NAO_IMPORTAVEL[it.tipo]}</p>}
                      {it.avisos?.map((a, i) => <p key={i} className="text-[11px] text-amber-700 mt-0.5">{a}</p>)}
                      {problema && <p className="text-[11px] text-red-600 mt-0.5" role="alert">{problema}</p>}

                      {aberto && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3" data-testid="importacao-edicao">
                          <div className="sm:col-span-2">
                            <label className="label" htmlFor={`d-${it.uid}`}>Descrição</label>
                            <input id={`d-${it.uid}`} className="input" maxLength={200} value={it.descricao} onChange={e => atualizar(it.uid, { descricao: e.target.value })} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`dt-${it.uid}`}>Data</label>
                            <input id={`dt-${it.uid}`} type="date" className="input" value={it.data} onChange={e => atualizar(it.uid, { data: e.target.value })} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`v-${it.uid}`}>Valor</label>
                            <InputMoeda id={`v-${it.uid}`} valor={it.valor} prefixo={null} className="input" onChangeValor={n => atualizar(it.uid, { valor: n })} />
                          </div>
                          <div>
                            <label className="label" htmlFor={`t-${it.uid}`}>Tipo</label>
                            <select id={`t-${it.uid}`} className="input" value={it.tipo} onChange={e => mudarTipo(it.uid, e.target.value)}>
                              {TIPOS_POR_CONTEXTO[contexto].map(t => <option key={t} value={t}>{ROTULOS_TIPO[t]}</option>)}
                            </select>
                          </div>
                          {['receita', 'despesa', 'compra'].includes(it.tipo) && (
                            <div>
                              <label className="label" htmlFor={`c-${it.uid}`}>Categoria</label>
                              <select id={`c-${it.uid}`} className="input"
                                value={(it.tipo === 'receita' ? it.categoriaNome : it.categoriaId) || ''}
                                onChange={e => atualizar(it.uid, it.tipo === 'receita' ? { categoriaNome: e.target.value || null, categoriaEditada: true } : { categoriaId: e.target.value || null, categoriaEditada: true })}>
                                <option value="">Sem categoria</option>
                                {catsDoTipo.map(c => <option key={c.id} value={it.tipo === 'receita' ? c.nome : c.id}>{c.icone} {c.nome}</option>)}
                              </select>
                            </div>
                          )}
                          {it.tipo === 'compra' && (
                            <div>
                              <label className="label" htmlFor={`p-${it.uid}`}>Total de parcelas</label>
                              <input id={`p-${it.uid}`} type="number" min="1" max="72" inputMode="numeric" className="input"
                                value={it.parcelaTotal || 1}
                                onChange={e => { const n = Math.max(1, Math.min(72, parseInt(e.target.value, 10) || 1)); atualizar(it.uid, { parcelaTotal: n > 1 ? n : null, parcelaAtual: n > 1 ? Math.min(it.parcelaAtual || 1, n) : null }) }} />
                              {it.parcelaTotal > 1 && <p className="text-[11px] text-gray-400 mt-1">Total da compra: {formatCurrency(it.valor * it.parcelaTotal)} ({it.parcelaTotal}× {formatCurrency(it.valor)})</p>}
                            </div>
                          )}
                          {contexto === 'investimentos' && (
                            <div>
                              <label className="label" htmlFor={`i-${it.uid}`}>Investimento</label>
                              <select id={`i-${it.uid}`} className="input" value={it.investimentoId || ''} onChange={e => atualizar(it.uid, { investimentoId: e.target.value || null })}>
                                <option value="">Escolha</option>
                                {investimentos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <button type="button" disabled={etapa === 'gravando'} onClick={() => setEditando(aberto ? null : it.uid)}
                          className="flex items-center gap-1 text-marca hover:underline" aria-expanded={aberto}>
                          <Pencil size={12} /> {aberto ? 'Concluir edição' : 'Editar'}
                        </button>
                        <button type="button" disabled={etapa === 'gravando'} onClick={() => removerItem(it.uid)}
                          className="flex items-center gap-1 text-gray-500 hover:text-red-600" aria-label={`Remover ${it.descricao} da lista`}>
                          <Trash2 size={12} /> Remover da lista
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="sticky bottom-20 md:bottom-4 z-10">
            <div className="card !p-3 shadow-lg flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={recomecar} disabled={etapa === 'gravando'} className="btn-secondary flex items-center justify-center gap-1.5">
                <RotateCcw size={15} /> Trocar arquivo
              </button>
              <button type="button" onClick={() => (embutido && onCancelar ? onCancelar() : recomecar())} disabled={etapa === 'gravando'}
                className="btn-secondary flex items-center justify-center gap-1.5" data-testid="importacao-cancelar">
                <X size={15} /> Cancelar importação
              </button>
              <button type="button" onClick={confirmar} disabled={etapa === 'gravando' || resumo.incluidos === 0 || comErro.length > 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 disabled:opacity-50" data-testid="importacao-confirmar">
                {etapa === 'gravando'
                  ? <><Loader2 size={16} className="animate-spin" /> Gravando...</>
                  : comErro.length > 0 ? `Corrija ${comErro.length} lançamento(s)` : `Confirmar importação (${resumo.incluidos})`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── 3. Resultado ─── */}
      {etapa === 'concluido' && resultado && (
        <div className="card text-center space-y-3" data-testid="importacao-concluida">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-green-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">{resultado.gravados} lançamentos importados</h2>
          <ul className="text-sm text-gray-600 space-y-0.5">
            {resultado.porTabela.receitas && <li>{resultado.porTabela.receitas} em Receitas</li>}
            {resultado.porTabela.despesas && <li>{resultado.porTabela.despesas} em Despesas</li>}
            {resultado.porTabela.compras_cartao && <li>{resultado.porTabela.compras_cartao} compras no cartão</li>}
            {resultado.porTabela.investimentos_movimentacoes && <li>{resultado.porTabela.investimentos_movimentacoes} movimentações de investimento</li>}
          </ul>
          {resultado.falhas.length > 0 && (
            <div className="text-left text-xs text-red-700 bg-red-50 rounded-xl p-3" role="alert">
              <p className="font-semibold mb-1">Alguns lançamentos não foram gravados:</p>
              {resultado.falhas.map((f, i) => <p key={i}>{f.quantidade} em {f.tabela.replace('_', ' ')}: {f.mensagem}</p>)}
            </div>
          )}
          {!resultado.historico && <p className="text-xs text-gray-400">O histórico desta importação não foi salvo (recurso ainda não ativado no banco).</p>}
          {resultado.historico && !embutido && (
            <p className="text-xs text-gray-500">
              <button
                type="button"
                onClick={() => navigate('/central-importacao')}
                className="text-marca underline font-medium hover:text-marca-hover"
              >
                Ver histórico completo
              </button>{' '}
              na Central de Importação
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button type="button" onClick={recomecar} className="btn-secondary flex-1">Importar outro arquivo</button>
            <button type="button" onClick={() => (embutido ? onConcluir?.(resultado) : navigate('/'))} className="btn-primary flex-1">
              {embutido ? 'Continuar' : 'Ir para a Home'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
