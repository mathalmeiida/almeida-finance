import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  Landmark, CreditCard, LineChart, FileUp, CheckCircle2, AlertTriangle, Loader2, ShieldCheck,
  Repeat, Copy, Trash2, ChevronDown, X, History, Undo2, CircleDot, Info, FileText,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useImportacoes } from '../hooks/useImportacoes'
import { valorDespesaRecorrenteNoMes } from '../hooks/useDespesas'
import { valorReceitaRecorrenteNoMes } from '../lib/recorrenciaReceita'
import { classificarDespesa } from '../lib/classificarDespesa'
import { formatCurrency, hojeISO } from '../lib/utils'
import { CATEGORIAS_INVESTIMENTO } from '../hooks/useInvestimentos'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { processarArquivo, validarArquivoAntes } from '../lib/importacao/processarArquivo'
import { ETAPAS } from '../lib/importacao/motor'
import {
  analisarItens, aplicarClassificacao, detectarDuplicidades, verificarParcelasCartao,
  itemImportavel, selecaoPadrao, resumir, NIVEIS_DUPLICIDADE,
} from '../lib/importacao/analisar'
import { indexarRegrasUsuario } from '../lib/importacao/classificar'
import { NATUREZAS_BANCO, NATUREZAS_CARTAO, NATUREZAS_INVESTIMENTO } from '../lib/importacao/interpretar'
import { sugerirCartao } from '../lib/importacao/instituicoes'
import { montarPayload } from '../lib/importacao/payload'
import { MAXIMO_ARQUIVOS, EXTENSOES_ACEITAS, TIPOS_DOCUMENTO, RETENCAO_HISTORICO_DIAS } from '../lib/importacao/limites'

// ─── Importação Inteligente ──────────────────────────────────────────────────
// Fluxo: escolher o tipo → anexar arquivos → processamento em etapas (no
// aparelho, em Web Worker) → conferência → confirmação → gravação (RPC).
// Nada é gravado antes da confirmação explícita do usuário.

const OPCOES = [
  {
    tipo: 'extrato_bancario', Icone: Landmark, titulo: 'Extrato bancário',
    detalhe: 'Receitas, despesas, PIX, TED, boletos, tarifas e transferências.',
  },
  {
    tipo: 'fatura_cartao', Icone: CreditCard, titulo: 'Fatura de cartão',
    detalhe: 'Compras, parcelamentos, estornos, encargos e pagamentos.',
  },
  {
    tipo: 'extrato_investimentos', Icone: LineChart, titulo: 'Extrato de investimentos',
    detalhe: 'Aplicações, resgates, dividendos, JCP, rendimentos e posições.',
  },
]

const NATUREZAS = {
  extrato_bancario: NATUREZAS_BANCO,
  fatura_cartao: NATUREZAS_CARTAO,
  extrato_investimentos: NATUREZAS_INVESTIMENTO,
}

const ROTULO_TABELA = {
  despesas: 'Despesa', receitas: 'Receita', compras_cartao: 'Compra no cartão',
  investimentos: 'Investimento', investimentos_movimentacoes: 'Movimentação de investimento',
}
const ROTULO_ACAO = { criado: 'Criado', complementado: 'Complementado', substituido: 'Substituído', conciliado: 'Conciliado' }
const ROTULO_SITUACAO = {
  ativo: { t: 'Ativo', c: 'bg-emerald-50 text-emerald-700' },
  desfeito: { t: 'Desfeito', c: 'bg-gray-100 text-gray-600' },
  mantido_alterado: { t: 'Mantido (alterado depois)', c: 'bg-amber-50 text-amber-700' },
  ja_removido: { t: 'Já removido', c: 'bg-gray-100 text-gray-500' },
}
const ROTULO_STATUS = {
  concluida: { t: 'Concluída', c: 'bg-emerald-50 text-emerald-700' },
  desfeita: { t: 'Desfeita', c: 'bg-gray-100 text-gray-600' },
  desfeita_parcial: { t: 'Desfeita em parte', c: 'bg-amber-50 text-amber-700' },
}

const POR_PAGINA = 100

function dataBR(iso) {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}
function tamanhoLegivel(b) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
}

function destinoDaNatureza(documento, natureza) {
  if (documento === 'extrato_bancario') return natureza === 'receita' ? 'receitas' : natureza === 'despesa' ? 'despesas' : null
  if (documento === 'fatura_cartao') return natureza === 'compra' || natureza === 'encargo' ? 'compras_cartao' : null
  if (natureza === 'posicao') return 'investimentos'
  return ['evento', 'indefinido'].includes(natureza) ? null : 'investimentos_movimentacoes'
}

function Selo({ children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>
}

// ═══ Etapas do processamento ═════════════════════════════════════════════════

function ListaEtapas({ arquivos, etapasFinais }) {
  return (
    <div className="space-y-4">
      {arquivos.map((a, i) => {
        const idxAtual = ETAPAS.findIndex(e => e.id === a.etapa)
        return (
          <div key={i} className="card space-y-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText size={18} className="text-marca flex-shrink-0" />
              <p className="text-sm font-semibold text-gray-900 truncate">{a.nome}</p>
            </div>
            <ol className="space-y-2">
              {ETAPAS.slice(0, 5).map((e, k) => {
                const feito = a.status === 'ok' || k < idxAtual
                const atual = a.status === 'processando' && k === idxAtual
                const erro = a.status === 'erro' && k === Math.max(idxAtual, 0)
                return (
                  <li key={e.id} className="flex items-center gap-2.5 text-sm">
                    {erro ? <X size={16} className="text-red-500" />
                      : feito ? <CheckCircle2 size={16} className="text-emerald-600" />
                        : atual ? <Loader2 size={16} className="text-marca animate-spin" />
                          : <CircleDot size={16} className="text-gray-300" />}
                    <span className={feito || atual ? 'text-gray-800' : 'text-gray-400'}>{e.titulo}</span>
                  </li>
                )
              })}
            </ol>
            {a.status === 'erro' && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">{a.erro}</p>}
          </div>
        )
      })}
      <div className="card">
        <ol className="space-y-2">
          {ETAPAS.slice(5).map(e => {
            const st = etapasFinais[e.id]
            return (
              <li key={e.id} className="flex items-center gap-2.5 text-sm">
                {st === 'ok' ? <CheckCircle2 size={16} className="text-emerald-600" />
                  : st === 'processando' ? <Loader2 size={16} className="text-marca animate-spin" />
                    : st === 'erro' ? <X size={16} className="text-red-500" />
                      : <CircleDot size={16} className="text-gray-300" />}
                <span className={st ? 'text-gray-800' : 'text-gray-400'}>{e.titulo}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// ═══ Resumo ══════════════════════════════════════════════════════════════════

function Resumo({ resumo, tipo }) {
  const itens = tipo === 'extrato_bancario'
    ? [['Identificadas', resumo.identificados], ['Despesas', resumo.despesas], ['Receitas', resumo.receitas], ['Transferências', resumo.transferencias], ['Duplicidades', resumo.duplicidades], ['Pendências', resumo.pendencias]]
    : tipo === 'fatura_cartao'
      ? [['Identificadas', resumo.identificados], ['Compras', resumo.compras], ['Estornos', resumo.estornos], ['Pagamentos', resumo.pagamentos], ['Duplicidades', resumo.duplicidades], ['Pendências', resumo.pendencias]]
      : [['Identificadas', resumo.identificados], ['Movimentações', resumo.investimentos], ['Posições', resumo.posicoes], ['Duplicidades', resumo.duplicidades], ['Pendências', resumo.pendencias], ['Selecionadas', resumo.selecionados]]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {itens.map(([t, v]) => (
        <div key={t} className="rounded-2xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_16px_rgba(16,24,40,0.05)] min-w-0">
          <p className="text-lg font-bold text-gray-900 leading-tight">{v}</p>
          <p className="text-[11px] text-gray-500 truncate">{t}</p>
        </div>
      ))}
    </div>
  )
}

// ═══ Linha + editor de item ══════════════════════════════════════════════════

function OpcoesDuplicidade({ item, onAlterar }) {
  const d = item.duplicidade
  const recorrente = d.recorrente
  const opcoes = [
    { v: 'ignorar', t: 'Ignorar (não importar)' },
    { v: 'manter', t: 'Manter os dois lançamentos' },
    ...(['despesas', 'receitas', 'compras_cartao'].includes(d.tabela) && d.tabela === item.destino
      ? [{ v: 'complementar', t: 'Complementar o existente (preenche categoria vazia)' }] : []),
    ...(!recorrente && ['despesas', 'receitas', 'compras_cartao'].includes(d.tabela) && d.tabela === item.destino && d.nivel !== 'certa'
      ? [{ v: 'substituir', t: 'Substituir o existente pelos dados importados' }] : []),
  ]
  const atual = item.acaoDuplicidade || (item.selecionado ? 'manter' : 'ignorar')
  return (
    <div className="rounded-xl bg-amber-50 px-3 py-3 space-y-2">
      <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5"><Copy size={14} /> {NIVEIS_DUPLICIDADE[d.nivel]}</p>
      <p className="text-xs text-amber-800">{d.motivo}</p>
      {d.resumoExistente && (
        <p className="text-xs text-amber-900/80">
          Já no app: {d.resumoExistente.descricao} · {formatCurrency(d.resumoExistente.valor)}{d.resumoExistente.data ? ` · ${dataBR(d.resumoExistente.data)}` : ''}
        </p>
      )}
      <div className="space-y-1.5 pt-1">
        {opcoes.map(o => (
          <label key={o.v} className="flex items-center gap-2 text-sm text-gray-800">
            <input type="radio" name={`dup-${item.id}`} checked={atual === o.v} onChange={() => onAlterar(o.v)} className="accent-[rgb(var(--marca))]" />
            {o.t}
          </label>
        ))}
      </div>
      {(atual === 'substituir' || atual === 'complementar') && (
        <p className="text-xs text-amber-800">A alteração do registro existente só acontece após você confirmar a importação e pode ser desfeita no histórico.</p>
      )}
    </div>
  )
}

function EditorItem({ item, tipo, categoriasDespesa, categoriasReceita, investimentos, novosInvestimentos, onAlterar, onRemover, onDuplicidade }) {
  const categorias = item.destino === 'receitas' ? categoriasReceita : categoriasDespesa
  const naturezas = NATUREZAS[tipo]
  const ehPosicao = item.natureza === 'posicao'
  return (
    <div className="space-y-3 pt-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <input className="input" value={item.descricao} maxLength={200} onChange={e => onAlterar({ descricao: e.target.value })} />
        </div>
        {!ehPosicao && (
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={item.data || ''} onChange={e => onAlterar({ data: e.target.value || null })} />
          </div>
        )}
        <div>
          <label className="label">{tipo === 'fatura_cartao' && item.numeroParcelas > 1 ? 'Valor da parcela' : ehPosicao ? 'Valor da posição' : 'Valor'}</label>
          <InputMoeda valor={item.valor || 0} onChangeValor={v => onAlterar({ valor: v })} />
        </div>
        {!ehPosicao && (
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={item.natureza} onChange={e => onAlterar({ natureza: e.target.value }, { reclassificar: true })}>
              {Object.entries(naturezas).filter(([k]) => k !== 'posicao').map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </div>
        )}
        {['despesas', 'receitas', 'compras_cartao'].includes(item.destino) && (
          <div>
            <label className="label">Categoria</label>
            <select
              className="input"
              value={item.destino === 'receitas' ? (item.categoriaNome || '') : (item.categoriaId || '')}
              onChange={e => {
                const v = e.target.value
                const c = item.destino === 'receitas' ? categorias.find(x => x.nome === v) : categorias.find(x => x.id === v)
                onAlterar({ categoriaId: c?.id || null, categoriaNome: c?.nome || null, confiancaCategoria: 'alta', origemCategoria: 'usuario' })
              }}
            >
              <option value="">Sem categoria</option>
              {categorias.map(c => <option key={c.id} value={item.destino === 'receitas' ? c.nome : c.id}>{c.icone} {c.nome}</option>)}
            </select>
          </div>
        )}
        {tipo === 'fatura_cartao' && item.destino === 'compras_cartao' && (
          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <div>
              <label className="label">Parcela atual</label>
              <input type="number" inputMode="numeric" min={1} max={120} className="input" value={item.parcelaAtual || ''}
                onChange={e => onAlterar({ parcelaAtual: e.target.value ? Math.max(1, Math.min(120, Number(e.target.value))) : null })} />
            </div>
            <div>
              <label className="label">Total de parcelas</label>
              <input type="number" inputMode="numeric" min={1} max={120} className="input" value={item.numeroParcelas || 1}
                onChange={e => onAlterar({ numeroParcelas: Math.max(1, Math.min(120, Number(e.target.value) || 1)) })} />
            </div>
            {item.numeroParcelas > 1 && (
              <p className="col-span-2 text-xs text-gray-500">
                Será registrada UMA compra de origem: {item.numeroParcelas}x de {formatCurrency(item.valor)} = {formatCurrency(item.valor * item.numeroParcelas)}.
                As parcelas são projetadas pelo app nas faturas seguintes.
              </p>
            )}
            {item.dataCompraSugerida && (
              <button type="button" className="col-span-2 text-left text-sm font-medium text-marca"
                onClick={() => onAlterar({ data: item.dataCompraSugerida, dataCompraSugerida: null, pendencias: item.pendencias.filter(p => !p.startsWith('Pela data informada')) })}>
                Usar {dataBR(item.dataCompraSugerida)} como data da compra original
              </button>
            )}
          </div>
        )}
        {tipo === 'extrato_investimentos' && item.destino && (
          <div className="sm:col-span-2">
            <label className="label">Investimento</label>
            <select className="input"
              value={item.investimentoId || item.investimentoRef || ''}
              onChange={e => {
                const v = e.target.value
                if (v.startsWith('novo:')) {
                  onAlterar({ investimentoId: null, investimentoRef: v, investimentoEscolhido: true, ...(ehPosicao ? { acao: 'criar_posicao' } : {}) })
                } else {
                  const inv = investimentos.find(i => i.id === v)
                  onAlterar({
                    investimentoId: v || null, investimentoRef: null, investimentoEscolhido: true, investimentoNome: inv?.nome,
                    ...(ehPosicao ? { acao: 'conciliar', valorAtualAnterior: inv ? Number(inv.valor_atual) : null } : {}),
                  })
                }
              }}>
              <option value="">Escolha…</option>
              {novosInvestimentos.length > 0 && (
                <optgroup label="Criar novo">
                  {novosInvestimentos.map(n => <option key={n.ref} value={n.ref}>Novo: {n.nome}</option>)}
                </optgroup>
              )}
              {investimentos.length > 0 && (
                <optgroup label="Meus investimentos">
                  {investimentos.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </optgroup>
              )}
            </select>
            {ehPosicao && item.acao === 'conciliar' && (
              <p className="text-xs text-gray-600 mt-2">
                Conciliação: o valor atual cadastrado ({formatCurrency(item.valorAtualAnterior)}) será SUBSTITUÍDO por {formatCurrency(item.valor)}. Nada é somado ao patrimônio.
              </p>
            )}
            {!ehPosicao && (
              <p className="text-xs text-gray-500 mt-2">A movimentação entra no histórico do investimento sem alterar o valor atual. Para atualizar o valor, concilie a posição.</p>
            )}
          </div>
        )}
      </div>

      {item.duplicidade && <OpcoesDuplicidade item={item} onAlterar={onDuplicidade} />}

      {item.motivoNaoImportar && !item.destino && (
        <p className="text-xs text-gray-600 bg-gray-50 rounded-xl px-3 py-2 flex gap-2"><Info size={14} className="flex-shrink-0 mt-0.5" />{item.motivoNaoImportar}</p>
      )}
      {item.pendencias?.length > 0 && (
        <ul className="space-y-1">
          {item.pendencias.map((p, k) => (
            <li key={k} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{p}</li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onRemover} className="text-sm text-red-600 flex items-center gap-1.5">
        <Trash2 size={14} /> Excluir da prévia
      </button>
    </div>
  )
}

function LinhaItem({ item, aberto, onAbrir, onSelecionar, children }) {
  const importavel = itemImportavel(item)
  const entrada = item.natureza === 'receita' || item.natureza === 'resgate_investimento' || item.natureza === 'estorno' ||
    ['dividendo', 'juros', 'rendimento', 'resgate'].includes(item.natureza)
  return (
    <li className={`px-4 py-3 ${item.selecionado ? '' : 'bg-gray-50/60'}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          aria-label="Selecionar lançamento"
          className="mt-1 h-5 w-5 flex-shrink-0 accent-[rgb(var(--marca))]"
          checked={Boolean(item.selecionado)}
          disabled={!importavel}
          onChange={e => onSelecionar(e.target.checked)}
        />
        <button type="button" onClick={onAbrir} className="flex-1 min-w-0 text-left">
          <div className="flex items-start justify-between gap-3">
            <p className={`text-sm font-medium truncate ${item.selecionado ? 'text-gray-900' : 'text-gray-500'}`}>{item.descricao || '—'}</p>
            <p className={`text-sm font-semibold whitespace-nowrap ${entrada ? 'text-emerald-700' : 'text-gray-900'}`}>
              {item.valor > 0 ? `${entrada ? '+' : ''}${formatCurrency(item.valor)}` : '—'}
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500">{item.natureza === 'posicao' ? 'Posição' : dataBR(item.data)}</span>
            <Selo className="bg-marca-50 text-marca">{NATUREZAS[item.documento][item.natureza] || item.natureza}</Selo>
            {item.categoriaNome && <Selo className="bg-gray-100 text-gray-600">{item.categoriaNome}</Selo>}
            {item.numeroParcelas > 1 && <Selo className="bg-sky-50 text-sky-700">{item.parcelaAtual ? `${item.parcelaAtual}/` : ''}{item.numeroParcelas}x</Selo>}
            {item.recorrente && <Selo className="bg-violet-50 text-violet-700"><Repeat size={11} /> Recorrente</Selo>}
            {item.duplicidade && <Selo className="bg-amber-50 text-amber-700"><Copy size={11} /> {NIVEIS_DUPLICIDADE[item.duplicidade.nivel]}</Selo>}
            {item.pendencias?.length > 0 && <Selo className="bg-amber-50 text-amber-700"><AlertTriangle size={11} /> Conferir</Selo>}
            {item.acao === 'conciliar' && <Selo className="bg-sky-50 text-sky-700">Conciliação</Selo>}
          </div>
        </button>
        <ChevronDown size={16} className={`mt-1 text-gray-400 flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </div>
      {aberto && <div className="pl-8">{children}</div>}
    </li>
  )
}

// ═══ Novos investimentos ═════════════════════════════════════════════════════

function NovosInvestimentos({ lista, usados, onAlterar }) {
  const visiveis = lista.filter(n => usados.has(n.ref))
  if (visiveis.length === 0) return null
  return (
    <div className="card space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Investimentos que serão criados</h2>
        <p className="text-xs text-gray-500 mt-0.5">Ativos do extrato que ainda não existem no app. Confira os valores antes de importar.</p>
      </div>
      <ul className="divide-y divide-gray-100">
        {visiveis.map(n => (
          <li key={n.ref} className="py-3 space-y-3 first:pt-0 last:pb-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="label">Nome</label>
                <input className="input" value={n.nome} maxLength={120} onChange={e => onAlterar(n.ref, { nome: e.target.value })} />
              </div>
              <div>
                <label className="label">Categoria</label>
                <select className="input" value={n.categoria} onChange={e => onAlterar(n.ref, { categoria: e.target.value })}>
                  {CATEGORIAS_INVESTIMENTO.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Valor atual</label>
                <InputMoeda valor={n.valorAtual || 0} onChangeValor={v => onAlterar(n.ref, { valorAtual: v })} />
              </div>
              <div>
                <label className="label">Valor aplicado</label>
                <InputMoeda valor={n.valorAplicado || 0} onChangeValor={v => onAlterar(n.ref, { valorAplicado: v })} />
              </div>
              {n.precoUnitario != null && (
                <p className="text-xs text-gray-500 self-end">Preço médio calculado: {formatCurrency(n.precoUnitario)} ({n.quantidade} cotas)</p>
              )}
            </div>
            {n.pendencias.length > 0 && (
              <ul className="space-y-1">
                {n.pendencias.map((p, k) => <li key={k} className="text-xs text-amber-800 flex gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{p}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ═══ Histórico ═══════════════════════════════════════════════════════════════

function Historico({ hook, somenteLeitura }) {
  const { historico, carregandoHistorico, erroHistorico, carregarHistorico, carregarItens, desfazer, removerDoHistorico } = hook
  const [aberto, setAberto] = useState(null)
  const [itens, setItens] = useState({})
  const [carregandoItens, setCarregandoItens] = useState(false)
  const [confirmar, setConfirmar] = useState(null) // { tipo: 'desfazer'|'remover', imp }
  const [processando, setProcessando] = useState(false)
  const [mensagem, setMensagem] = useState(null)

  useEffect(() => { carregarHistorico() }, [carregarHistorico])

  async function abrir(imp) {
    if (aberto === imp.id) { setAberto(null); return }
    setAberto(imp.id)
    setCarregandoItens(true)
    try {
      const lista = await carregarItens(imp.id)
      setItens(prev => ({ ...prev, [imp.id]: lista }))
    } catch (e) {
      setMensagem({ erro: true, texto: e.message })
    } finally {
      setCarregandoItens(false)
    }
  }

  async function executar() {
    const { tipo, imp } = confirmar
    setProcessando(true)
    try {
      if (tipo === 'desfazer') {
        const r = await desfazer(imp.id)
        const partes = [`${r.desfeitos} registro(s) desfeito(s)`]
        if (r.mantidos) partes.push(`${r.mantidos} mantido(s) porque foram alterados depois ou têm vínculos`)
        if (r.ja_removidos) partes.push(`${r.ja_removidos} já tinham sido removidos`)
        setMensagem({ erro: false, texto: partes.join(' · ') + '.' })
        setItens(prev => ({ ...prev, [imp.id]: undefined }))
        if (aberto === imp.id) setAberto(null)
      } else {
        await removerDoHistorico(imp.id)
        setMensagem({ erro: false, texto: 'Registro removido do histórico. Os lançamentos importados continuam no app.' })
      }
    } catch (e) {
      setMensagem({ erro: true, texto: e.message })
    } finally {
      setProcessando(false)
      setConfirmar(null)
    }
  }

  if (carregandoHistorico && historico.length === 0) {
    return <div className="card flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Carregando histórico…</div>
  }
  return (
    <div className="space-y-3">
      {erroHistorico && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">{erroHistorico}</p>}
      {mensagem && (
        <p className={`text-sm rounded-xl px-4 py-3 ${mensagem.erro ? 'text-red-700 bg-red-50' : 'text-emerald-800 bg-emerald-50'}`}>{mensagem.texto}</p>
      )}
      {!erroHistorico && historico.length === 0 && (
        <div className="card text-center py-10">
          <History size={28} className="mx-auto text-gray-300" />
          <p className="text-sm text-gray-500 mt-2">Nenhuma importação ainda.</p>
        </div>
      )}
      {historico.map(imp => {
        const st = ROTULO_STATUS[imp.status] || ROTULO_STATUS.concluida
        const lista = itens[imp.id]
        return (
          <div key={imp.id} className="card !p-0 overflow-hidden">
            <button type="button" onClick={() => abrir(imp)} className="w-full text-left px-4 py-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{TIPOS_DOCUMENTO[imp.tipo_documento]}</p>
                  <Selo className={st.c}>{st.t}</Selo>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(imp.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {imp.instituicao ? ` · ${imp.instituicao}` : ''}
                  {imp.periodo_inicio ? ` · ${dataBR(imp.periodo_inicio)} a ${dataBR(imp.periodo_fim)}` : ''}
                </p>
                <p className="text-xs text-gray-600 mt-1">{imp.total_aceitos} aceito(s) · {imp.total_ignorados} ignorado(s){imp.total_duplicados ? ` · ${imp.total_duplicados} possível(is) duplicidade(s)` : ''}</p>
              </div>
              <ChevronDown size={16} className={`mt-1 text-gray-400 transition-transform ${aberto === imp.id ? 'rotate-180' : ''}`} />
            </button>
            {aberto === imp.id && (
              <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                {carregandoItens && !lista && <p className="text-sm text-gray-500 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</p>}
                {lista && (
                  <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                    {lista.map(it => {
                      const s = ROTULO_SITUACAO[it.situacao]
                      const r = it.registro
                      return (
                        <li key={it.id} className="py-2 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm text-gray-900 truncate">{r ? (r.descricao || r.nome || r.tipo) : 'Registro não encontrado'}</p>
                            <p className="text-xs text-gray-500">{ROTULO_TABELA[it.tabela]} · {ROTULO_ACAO[it.acao]}{r?.data || r?.data_compra ? ` · ${dataBR(r.data || r.data_compra)}` : ''}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {r && <p className="text-sm font-medium text-gray-900">{formatCurrency(r.valor ?? r.valor_total ?? r.valor_atual)}</p>}
                            <Selo className={s.c}>{s.t}</Selo>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
                {!somenteLeitura && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {imp.status === 'concluida' && (
                      <button type="button" className="btn-secondary text-sm flex items-center gap-1.5" onClick={() => setConfirmar({ tipo: 'desfazer', imp })}>
                        <Undo2 size={15} /> Desfazer importação
                      </button>
                    )}
                    <button type="button" className="text-sm text-red-600 px-3 py-2 flex items-center gap-1.5" onClick={() => setConfirmar({ tipo: 'remover', imp })}>
                      <Trash2 size={15} /> Remover do histórico
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
      <p className="text-xs text-gray-400 px-1">O histórico é mantido por {RETENCAO_HISTORICO_DIAS} dias e depois apagado automaticamente. Os lançamentos importados continuam no app.</p>

      <Modal aberto={Boolean(confirmar)} onFechar={() => !processando && setConfirmar(null)}
        titulo={confirmar?.tipo === 'desfazer' ? 'Desfazer importação?' : 'Remover do histórico?'}>
        {confirmar?.tipo === 'desfazer' ? (
          <div className="space-y-3 text-sm text-gray-600">
            <p>Os lançamentos criados por esta importação serão removidos e os dados complementados, substituídos ou conciliados voltarão ao estado anterior.</p>
            <p>Por segurança, registros que você <strong>alterou depois</strong> da importação e investimentos com novas movimentações ou metas vinculadas serão <strong>mantidos</strong>.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Apenas o registro do histórico será apagado. Os lançamentos continuam no app, mas não será mais possível desfazer esta importação nem reconhecê-la em importações futuras.</p>
        )}
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn-secondary flex-1" disabled={processando} onClick={() => setConfirmar(null)}>Cancelar</button>
          <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={processando} onClick={executar}>
            {processando && <Loader2 size={16} className="animate-spin" />} Confirmar
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ═══ Página ══════════════════════════════════════════════════════════════════

export default function ImportacaoInteligente() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { perfil, somenteLeitura } = useAuth()
  const { categorias: categoriasDespesa, carregando: carregandoCatD } = useCategorias('despesa')
  const { categorias: categoriasReceita, carregando: carregandoCatR } = useCategorias('receita')
  const { cartoes } = useCartoes()
  const hook = useImportacoes()

  const tipoParam = params.get('tipo')
  const [aba, setAba] = useState(params.get('aba') === 'historico' ? 'historico' : 'nova')
  const [tipo, setTipo] = useState(TIPOS_DOCUMENTO[tipoParam] ? tipoParam : null)
  const [etapa, setEtapa] = useState(TIPOS_DOCUMENTO[tipoParam] ? 'arquivos' : 'escolha')
  const [arquivos, setArquivos] = useState([])
  const [erroArquivos, setErroArquivos] = useState(null)
  const [progresso, setProgresso] = useState([])
  const [etapasFinais, setEtapasFinais] = useState({})
  const [documentos, setDocumentos] = useState([])
  const [itens, setItens] = useState([])
  const [novosInvestimentos, setNovosInvestimentos] = useState([])
  const [avisos, setAvisos] = useState([])
  const [contexto, setContexto] = useState(null)
  const [cartaoId, setCartaoId] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [aberto, setAberto] = useState(null)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [confirmando, setConfirmando] = useState(false)
  const [gravando, setGravando] = useState(false)
  const [errosGravacao, setErrosGravacao] = useState([])
  const [resultado, setResultado] = useState(null)
  const inputRef = useRef(null)

  // Investimentos existentes (para escolher o destino das movimentações).
  const investimentos = contexto?.existentes?.investimentos || []
  const cartao = cartoes.find(c => c.id === cartaoId) || null

  const ctxClassificacao = useMemo(() => ({
    categoriasDespesa, categoriasReceita, regrasUsuario: indexarRegrasUsuario(contexto?.regras || []),
  }), [categoriasDespesa, categoriasReceita, contexto])

  const ctxDuplicidade = useMemo(() => ({
    existentes: contexto?.existentes || {},
    ocorrenciaDespesa: valorDespesaRecorrenteNoMes,
    ocorrenciaReceita: valorReceitaRecorrenteNoMes,
  }), [contexto])

  function reiniciar() {
    setEtapa(tipo ? 'arquivos' : 'escolha')
    setArquivos([]); setErroArquivos(null); setProgresso([]); setEtapasFinais({})
    setDocumentos([]); setItens([]); setNovosInvestimentos([]); setAvisos([])
    setContexto(null); setFiltro('todos'); setAberto(null); setLimite(POR_PAGINA)
    setErrosGravacao([]); setResultado(null); setCartaoId('')
  }

  function escolherTipo(t) {
    setTipo(t)
    setEtapa('arquivos')
    setArquivos([]); setErroArquivos(null)
    setParams(p => { const n = new URLSearchParams(p); n.set('tipo', t); return n }, { replace: true })
  }

  function adicionarArquivos(lista) {
    setErroArquivos(null)
    const novos = []
    for (const f of lista) {
      const erro = validarArquivoAntes(f)
      if (erro) { setErroArquivos(`${f.name}: ${erro}`); continue }
      novos.push(f)
    }
    setArquivos(prev => {
      const todos = [...prev, ...novos].filter((f, i, arr) => arr.findIndex(x => x.name === f.name && x.size === f.size) === i)
      if (todos.length > MAXIMO_ARQUIVOS) setErroArquivos(`Envie no máximo ${MAXIMO_ARQUIVOS} arquivos por importação.`)
      return todos.slice(0, MAXIMO_ARQUIVOS)
    })
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Processamento ──────────────────────────────────────────────────────────
  async function processar() {
    if (arquivos.length === 0) return
    setEtapa('processando')
    const estado = arquivos.map(f => ({ nome: f.name, status: 'aguardando', etapa: null, erro: null }))
    setProgresso(estado.map(e => ({ ...e })))
    setEtapasFinais({})
    const hoje = hojeISO()
    const docs = []
    for (let i = 0; i < arquivos.length; i++) {
      estado[i].status = 'processando'
      estado[i].etapa = 'identificar'
      setProgresso(estado.map(e => ({ ...e })))
      try {
        const doc = await processarArquivo(arquivos[i], {
          tipoDocumento: tipo, nomeTitular: perfil?.nome || '', hoje,
          aoProgresso: etapaId => { estado[i].etapa = etapaId; setProgresso(estado.map(e => ({ ...e }))) },
        })
        estado[i].status = 'ok'
        docs.push({ ...doc, indice: i })
      } catch (e) {
        estado[i].status = 'erro'
        estado[i].erro = e.message || 'Não foi possível processar o arquivo.'
      }
      setProgresso(estado.map(e => ({ ...e })))
    }
    if (docs.length === 0) { setEtapasFinais({ classificar: 'erro' }); return }

    try {
      setEtapasFinais({ classificar: 'processando' })
      const todosItens = docs.flatMap(d => d.itens.map(it => ({
        ...it, id: `${d.indice}-${it.id}`, instituicaoDoc: d.instituicao, metaDoc: d.meta,
      })))
      const datas = todosItens.map(i => i.data).filter(Boolean).sort()
      const ctx = await hook.carregarContexto({ tipoDocumento: tipo, inicio: datas[0], fim: datas[datas.length - 1] })
      setContexto(ctx)
      setEtapasFinais({ classificar: 'ok', duplicidades: 'processando' })

      const instituicao = docs.find(d => d.instituicao)?.instituicao || null
      const idCartao = tipo === 'fatura_cartao' ? (sugerirCartao(cartoes, instituicao) || '') : ''
      setCartaoId(idCartao)
      const an = analisarItens(todosItens, {
        tipoDocumento: tipo, instituicao, meta: docs[0].meta,
        existentes: ctx.existentes, regrasUsuario: ctx.regras,
        categoriasDespesa, categoriasReceita,
        cartao: cartoes.find(c => c.id === idCartao) || null,
        ocorrenciaDespesa: valorDespesaRecorrenteNoMes,
        ocorrenciaReceita: valorReceitaRecorrenteNoMes,
      })
      setEtapasFinais({ classificar: 'ok', duplicidades: 'ok', previa: 'processando' })
      setDocumentos(docs)
      setItens(an.itens)
      setNovosInvestimentos(an.novosInvestimentos)
      setAvisos([...new Set([...docs.flatMap(d => d.avisos.map(a => (docs.length > 1 ? `${d.nome}: ${a}` : a))), ...an.avisos])])
      setEtapasFinais({ classificar: 'ok', duplicidades: 'ok', previa: 'ok' })
      setEtapa('revisao')
    } catch (e) {
      setEtapasFinais(prev => ({ ...prev, duplicidades: 'erro' }))
      setErroArquivos(e.message || 'Não foi possível consultar seus lançamentos existentes.')
    }
  }

  // ── Edição na prévia ───────────────────────────────────────────────────────
  const alterarItem = useCallback((id, patch, opcoes = {}) => {
    setItens(prev => prev.map(it => {
      if (it.id !== id) return it
      let novo = { ...it, ...patch, tocado: true }
      if ('valor' in patch && it.documento === 'fatura_cartao') {
        novo.valorParcela = patch.valor
        novo.valorTotal = patch.valor * (novo.numeroParcelas || 1)
      }
      if ('numeroParcelas' in patch) novo.valorTotal = (novo.valorParcela || novo.valor) * patch.numeroParcelas
      if (opcoes.reclassificar) {
        novo.destino = destinoDaNatureza(it.documento, novo.natureza)
        novo.motivoNaoImportar = novo.destino ? null : it.motivoNaoImportar || 'Este tipo não gera lançamento no app.'
        novo = aplicarClassificacao(novo, ctxClassificacao)
        if (novo.destino === 'investimentos_movimentacoes' && !novo.investimentoId && !novo.investimentoRef && it.ativo) {
          novo.investimentoRef = `novo:${it.ativo.chave}`
        }
      }
      if ('categoriaNome' in patch && novo.destino === 'despesas') {
        novo.tipoDespesa = classificarDespesa({ descricao: novo.descricao, categoria: novo.categoriaNome || '' })
      }
      if (!itemImportavel(novo)) novo.selecionado = false
      else if (opcoes.reclassificar) novo.selecionado = true
      return novo
    }))
  }, [ctxClassificacao])

  function alterarDuplicidade(id, acao) {
    setItens(prev => prev.map(it => it.id !== id ? it : {
      ...it, acaoDuplicidade: acao, editadoDuplicidade: true, tocado: true,
      selecionado: acao !== 'ignorar' && itemImportavel(it),
    }))
  }

  function removerItem(id) {
    setItens(prev => prev.filter(i => i.id !== id))
    setAberto(null)
  }

  function trocarCartao(id) {
    setCartaoId(id)
    const c = cartoes.find(x => x.id === id) || null
    setItens(prev => {
      const copia = prev.map(i => ({ ...i, pendencias: [...(i.pendencias || [])] }))
      verificarParcelasCartao(copia, documentos[0]?.meta, c)
      detectarDuplicidades(copia, { ...ctxDuplicidade, cartaoId: id || null })
      for (const it of copia) if (!it.tocado) it.selecionado = selecaoPadrao(it)
      return copia
    })
  }

  function selecionarTodos(valor) {
    setItens(prev => prev.map(it => ({
      ...it,
      // "Sugeridos" = seleção padrão, respeitando decisões já tomadas sobre duplicidades.
      selecionado: valor
        ? (it.editadoDuplicidade ? it.acaoDuplicidade !== 'ignorar' && itemImportavel(it) : selecaoPadrao(it))
        : false,
    })))
  }

  const resumo = useMemo(() => resumir(itens), [itens])
  const refsUsadas = useMemo(() => new Set(itens.filter(i => i.selecionado && i.investimentoRef && !i.investimentoId).map(i => i.investimentoRef)), [itens])
  const filtrados = useMemo(() => itens.filter(i => {
    if (filtro === 'selecionados') return i.selecionado
    if (filtro === 'duplicidades') return Boolean(i.duplicidade)
    if (filtro === 'pendencias') return i.pendencias?.length > 0
    if (filtro === 'nao_importaveis') return !i.destino
    return true
  }), [itens, filtro])
  const totalSelecionado = useMemo(() => itens.filter(i => i.selecionado).reduce((s, i) => s + (i.valor || 0), 0), [itens])

  // ── Confirmação e gravação ─────────────────────────────────────────────────
  const pacote = useMemo(() => {
    if (etapa !== 'revisao') return null
    return montarPayload({
      tipoDocumento: tipo,
      arquivos: documentos,
      instituicao: documentos.find(d => d.instituicao)?.instituicao || null,
      periodo: {
        inicio: documentos.map(d => d.periodo.inicio).filter(Boolean).sort()[0] || null,
        fim: documentos.map(d => d.periodo.fim).filter(Boolean).sort().slice(-1)[0] || null,
      },
      itens, novosInvestimentos, cartaoId: cartaoId || null,
    })
  }, [etapa, tipo, documentos, itens, novosInvestimentos, cartaoId])

  function abrirConfirmacao() {
    setErrosGravacao(pacote?.erros || [])
    if (pacote?.payload) setConfirmando(true)
  }

  async function gravar() {
    setGravando(true)
    setErrosGravacao([])
    try {
      const r = await hook.confirmar(pacote.payload)
      setResultado(r)
      setConfirmando(false)
      setEtapa('concluido')
    } catch (e) {
      setErrosGravacao([e.message])
    } finally {
      setGravando(false)
    }
  }

  const contagemGravacao = useMemo(() => {
    const c = { despesas: 0, receitas: 0, compras_cartao: 0, investimentos: 0, investimentos_movimentacoes: 0, conciliar: 0, alterar: 0 }
    for (const i of pacote?.payload?.itens || []) {
      if (i.acao === 'conciliar') c.conciliar++
      else if (i.acao !== 'criar') c.alterar++
      else c[i.tabela]++
    }
    return c
  }, [pacote])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full min-w-0 max-w-3xl mx-auto space-y-5 pb-mobilenav md:pb-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900">Importação Inteligente</h1>
        <p className="text-sm text-gray-500 mt-1">Traga extratos, faturas e investimentos. Você confere tudo antes de salvar.</p>
      </div>

      <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 w-full sm:w-auto sm:inline-flex">
        {[['nova', 'Nova importação'], ['historico', 'Histórico']].map(([v, t]) => (
          <button key={v} type="button" onClick={() => setAba(v)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-medium transition-colors ${aba === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {somenteLeitura && aba === 'nova' && (
        <p className="text-sm text-amber-800 bg-amber-50 rounded-xl px-4 py-3">Modo Consultoria: a importação fica disponível apenas para o titular da conta.</p>
      )}

      {aba === 'historico' && <Historico hook={hook} somenteLeitura={somenteLeitura} />}

      {aba === 'nova' && !somenteLeitura && (
        <>
          {/* 1. Escolha do tipo */}
          {etapa === 'escolha' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {OPCOES.map(o => (
                <button key={o.tipo} type="button" onClick={() => escolherTipo(o.tipo)}
                  className="card text-left transition-transform active:scale-[0.99] hover:shadow-md">
                  <span className="w-11 h-11 rounded-xl bg-marca-50 text-marca flex items-center justify-center"><o.Icone size={22} /></span>
                  <p className="text-base font-semibold text-gray-900 mt-3">{o.titulo}</p>
                  <p className="text-xs text-gray-500 mt-1">{o.detalhe}</p>
                </button>
              ))}
            </div>
          )}

          {/* 2. Arquivos */}
          {etapa === 'arquivos' && (
            <div className="space-y-4">
              <div className="card space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Tipo de documento</p>
                    <p className="text-base font-semibold text-gray-900">{TIPOS_DOCUMENTO[tipo]}</p>
                  </div>
                  <button type="button" className="text-sm font-medium text-marca" onClick={() => { setTipo(null); setEtapa('escolha') }}>Trocar</button>
                </div>

                <label className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-marca-50 px-4 py-8 text-center cursor-pointer"
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); adicionarArquivos([...e.dataTransfer.files]) }}>
                  <FileUp size={28} className="text-marca" />
                  <span className="text-sm font-semibold text-gray-900">Escolher arquivos</span>
                  <span className="text-xs text-gray-500">PDF com texto, CSV, OFX, XLS ou XLSX · até 10 MB · até {MAXIMO_ARQUIVOS} arquivos</span>
                  <input ref={inputRef} type="file" multiple accept={EXTENSOES_ACEITAS} className="sr-only"
                    onChange={e => adicionarArquivos([...e.target.files])} />
                </label>

                {arquivos.length > 0 && (
                  <ul className="divide-y divide-gray-100">
                    {arquivos.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center gap-3 py-2.5">
                        <FileText size={18} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{f.name}</p>
                          <p className="text-xs text-gray-400">{tamanhoLegivel(f.size)}</p>
                        </div>
                        <button type="button" aria-label="Remover arquivo" className="touch-target text-gray-400" onClick={() => setArquivos(prev => prev.filter((_, k) => k !== i))}>
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {erroArquivos && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">{erroArquivos}</p>}

                <button type="button" className="btn-primary w-full py-3" disabled={arquivos.length === 0 || carregandoCatD || carregandoCatR} onClick={processar}>
                  Processar {arquivos.length > 1 ? `${arquivos.length} arquivos` : 'arquivo'}
                </button>
              </div>

              <div className="flex gap-3 px-1">
                <ShieldCheck size={18} className="text-marca flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">
                  O arquivo é lido no seu aparelho e não é enviado nem armazenado. Nenhum serviço externo de IA é usado.
                  Somente os lançamentos que você confirmar são gravados na sua conta.
                </p>
              </div>
            </div>
          )}

          {/* 3. Processamento */}
          {etapa === 'processando' && (
            <div className="space-y-4">
              <ListaEtapas arquivos={progresso} etapasFinais={etapasFinais} />
              {(progresso.every(p => p.status === 'erro') || etapasFinais.duplicidades === 'erro') && (
                <div className="space-y-3">
                  {erroArquivos && <p className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2">{erroArquivos}</p>}
                  <button type="button" className="btn-secondary w-full" onClick={reiniciar}>Voltar e escolher outro arquivo</button>
                </div>
              )}
            </div>
          )}

          {/* 4. Conferência */}
          {etapa === 'revisao' && (
            <div className="space-y-4">
              <div className="card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-gray-900">{TIPOS_DOCUMENTO[tipo]}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {documentos.find(d => d.instituicao)?.instituicao || 'Instituição não identificada'}
                      {documentos[0]?.periodo?.inicio ? ` · ${dataBR(documentos[0].periodo.inicio)} a ${dataBR(documentos[documentos.length - 1].periodo.fim)}` : ''}
                    </p>
                  </div>
                  <button type="button" className="text-sm font-medium text-marca flex-shrink-0" onClick={reiniciar}>Recomeçar</button>
                </div>
                {progresso.some(p => p.status === 'erro') && (
                  <p className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">
                    {progresso.filter(p => p.status === 'erro').map(p => `${p.nome}: ${p.erro}`).join(' · ')}
                  </p>
                )}
                {tipo === 'extrato_bancario' && documentos.some(d => d.meta?.saldoFinal?.valor != null) && (
                  <p className="text-xs text-gray-600 flex gap-1.5">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    Saldo final no extrato: {formatCurrency(documentos.find(d => d.meta?.saldoFinal?.valor != null).meta.saldoFinal.valor)}.
                    Apenas informativo: seu saldo no app não é sobrescrito.
                  </p>
                )}
                {tipo === 'fatura_cartao' && (
                  <div>
                    <label className="label">Cartão desta fatura</label>
                    {cartoes.length === 0 ? (
                      <p className="text-sm text-gray-600">Você ainda não tem cartões. <Link to="/cartoes" className="text-marca font-medium">Cadastre o cartão</Link> e depois importe a fatura.</p>
                    ) : (
                      <select className="input" value={cartaoId} onChange={e => trocarCartao(e.target.value)}>
                        <option value="">Escolha o cartão…</option>
                        {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` · ${c.banco}` : ''}</option>)}
                      </select>
                    )}
                    {documentos[0]?.meta?.vencimento && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        Vencimento no documento: {dataBR(documentos[0].meta.vencimento)}
                        {documentos[0].meta.fechamento ? ` · fechamento ${dataBR(documentos[0].meta.fechamento)}` : ''}
                        {documentos[0].meta.totalFatura != null ? ` · total ${formatCurrency(documentos[0].meta.totalFatura)}` : ''}
                      </p>
                    )}
                  </div>
                )}
                {avisos.length > 0 && (
                  <ul className="space-y-1.5">
                    {avisos.map((a, k) => <li key={k} className="text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2 flex gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{a}</li>)}
                  </ul>
                )}
              </div>

              <Resumo resumo={resumo} tipo={tipo} />

              {tipo === 'extrato_investimentos' && (
                <NovosInvestimentos lista={novosInvestimentos} usados={refsUsadas}
                  onAlterar={(ref, patch) => setNovosInvestimentos(prev => prev.map(n => n.ref === ref ? { ...n, ...patch } : n))} />
              )}

              <div className="card !p-0 overflow-hidden">
                <div className="px-4 pt-4 pb-3 space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
                    {[['todos', 'Todos', itens.length], ['selecionados', 'Selecionados', resumo.selecionados], ['duplicidades', 'Duplicidades', resumo.duplicidades], ['pendencias', 'Conferir', resumo.pendencias], ['nao_importaveis', 'Não importáveis', itens.filter(i => !i.destino).length]].map(([v, t, n]) => (
                      <button key={v} type="button" onClick={() => { setFiltro(v); setLimite(POR_PAGINA) }}
                        className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filtro === v ? 'bg-marca text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {t} · {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 text-sm">
                    <button type="button" className="text-marca font-medium" onClick={() => selecionarTodos(true)}>Selecionar sugeridos</button>
                    <button type="button" className="text-gray-500" onClick={() => selecionarTodos(false)}>Limpar seleção</button>
                  </div>
                </div>
                {filtrados.length === 0 ? (
                  <p className="px-4 pb-6 text-sm text-gray-500">Nenhum lançamento neste filtro.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {filtrados.slice(0, limite).map(item => (
                      <LinhaItem key={item.id} item={item} aberto={aberto === item.id}
                        onAbrir={() => setAberto(aberto === item.id ? null : item.id)}
                        onSelecionar={v => alterarItem(item.id, { selecionado: v })}>
                        <EditorItem item={item} tipo={tipo}
                          categoriasDespesa={categoriasDespesa} categoriasReceita={categoriasReceita}
                          investimentos={investimentos} novosInvestimentos={novosInvestimentos}
                          onAlterar={(patch, op) => alterarItem(item.id, patch, op)}
                          onRemover={() => removerItem(item.id)}
                          onDuplicidade={acao => alterarDuplicidade(item.id, acao)} />
                      </LinhaItem>
                    ))}
                  </ul>
                )}
                {filtrados.length > limite && (
                  <button type="button" className="w-full py-3 text-sm font-medium text-marca border-t border-gray-100" onClick={() => setLimite(l => l + POR_PAGINA)}>
                    Mostrar mais ({filtrados.length - limite})
                  </button>
                )}
              </div>

              {errosGravacao.length > 0 && !confirmando && (
                <ul className="space-y-1 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-3">
                  {errosGravacao.map((e, k) => <li key={k}>{e}</li>)}
                </ul>
              )}

              {/* Barra de ação (acima da navegação inferior no celular) */}
              <div className="sticky bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-4 z-30">
                <div className="rounded-2xl bg-white/95 backdrop-blur px-4 py-3 shadow-[0_8px_30px_rgba(16,24,40,0.12)] flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{resumo.selecionados} selecionado(s)</p>
                    <p className="text-xs text-gray-500 truncate">{formatCurrency(totalSelecionado)} em lançamentos</p>
                  </div>
                  <button type="button" className="btn-primary px-5 py-2.5" disabled={resumo.selecionados === 0} onClick={abrirConfirmacao}>
                    Importar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. Concluído */}
          {etapa === 'concluido' && resultado && (
            <div className="card text-center space-y-4 py-8">
              <CheckCircle2 size={40} className="mx-auto text-emerald-600" />
              <div>
                <p className="text-lg font-bold text-gray-900">Importação concluída</p>
                <p className="text-sm text-gray-500 mt-1">
                  {resultado.criados} lançamento(s) criado(s){resultado.alterados ? ` e ${resultado.alterados} atualizado(s)` : ''}.
                  Início, calendário{tipo === 'fatura_cartao' ? ', cartões' : ''}{tipo === 'extrato_investimentos' ? ', investimentos' : ''} e metas já refletem os dados.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <button type="button" className="btn-primary" onClick={() => navigate(tipo === 'fatura_cartao' ? '/cartoes' : tipo === 'extrato_investimentos' ? '/investimentos' : '/')}>
                  {tipo === 'fatura_cartao' ? 'Ver cartões' : tipo === 'extrato_investimentos' ? 'Ver investimentos' : 'Ver Início'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setAba('historico'); reiniciar() }}>Ver histórico</button>
                <button type="button" className="btn-secondary" onClick={reiniciar}>Nova importação</button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal aberto={confirmando} onFechar={() => !gravando && setConfirmando(false)} titulo="Confirmar importação">
        <div className="space-y-3 text-sm text-gray-700">
          <ul className="space-y-1.5">
            {contagemGravacao.despesas > 0 && <li>{contagemGravacao.despesas} despesa(s)</li>}
            {contagemGravacao.receitas > 0 && <li>{contagemGravacao.receitas} receita(s)</li>}
            {contagemGravacao.compras_cartao > 0 && <li>{contagemGravacao.compras_cartao} compra(s) no cartão {cartao ? `"${cartao.nome}"` : ''}</li>}
            {contagemGravacao.investimentos > 0 && <li>{contagemGravacao.investimentos} investimento(s) novo(s)</li>}
            {contagemGravacao.investimentos_movimentacoes > 0 && <li>{contagemGravacao.investimentos_movimentacoes} movimentação(ões) de investimento (só histórico)</li>}
            {contagemGravacao.conciliar > 0 && <li>{contagemGravacao.conciliar} posição(ões) conciliada(s): o valor atual será substituído</li>}
            {contagemGravacao.alterar > 0 && <li>{contagemGravacao.alterar} lançamento(s) existente(s) complementado(s) ou substituído(s)</li>}
          </ul>
          <p className="text-xs text-gray-500">
            Seu saldo disponível não é sobrescrito: os lançamentos entram nos cálculos pelas regras normais do app.
            Você pode desfazer esta importação no histórico.
          </p>
          {errosGravacao.length > 0 && (
            <ul className="text-sm text-red-700 bg-red-50 rounded-xl px-3 py-2 space-y-1">{errosGravacao.map((e, k) => <li key={k}>{e}</li>)}</ul>
          )}
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" className="btn-secondary flex-1" disabled={gravando} onClick={() => setConfirmando(false)}>Voltar</button>
          <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={gravando} onClick={gravar}>
            {gravando && <Loader2 size={16} className="animate-spin" />} Confirmar e salvar
          </button>
        </div>
      </Modal>
    </div>
  )
}
