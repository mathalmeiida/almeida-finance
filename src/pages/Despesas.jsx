import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TrendingDown, Plus, RefreshCw, Calendar, Trash2, Loader2, Pencil, CreditCard, CheckCircle2, ChevronDown, ChevronUp, CalendarClock, Zap } from 'lucide-react'
import { useDespesas } from '../hooks/useDespesas'
import { useDespesaTipoExcecoes } from '../hooks/useDespesaTipoExcecoes'
import { useParcelamentos, valorParcelaNoMes, calcularParcelas } from '../hooks/useParcelamentos'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useProjecao } from '../hooks/useProjecao'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency, formatDate, corCategoria, FORMAS_PAGAMENTO, formaPagamentoLabel, hojeISO } from '../lib/utils'
import { classificarDespesa, labelTipoDespesa } from '../lib/classificarDespesa'
import { FormParcelamento, CardParcelamento } from './Parcelamentos'

const mesAtual = new Date().getMonth() + 1
const anoAtual = new Date().getFullYear()

// ─── Formulário de despesa ────────────────────────────────────────────────────
// Fluxo unificado: a diferenciação "1x / Parcelada" aparece apenas quando a
// forma de pagamento é "Cartão de crédito". Internamente, continua usando a
// lógica existente — à vista grava em "despesas" (onSalvarVista) e parcelada
// grava em "parcelamentos" (onSalvarParcelada). Nenhum cálculo/banco muda.
function FormDespesa({ onSalvarVista, onSalvarParcelada, onCancelar, carregando, despesaInicial, textoBotao }) {
  const { categorias } = useCategorias('despesa')
  const { cartoes } = useCartoes()
  const editando = !!despesaInicial

  // Deriva a frequência a partir dos campos salvos (retrocompatível).
  // As opções do form são: nao_repete | diaria | semanal | mensal.
  // Dados salvos como 'por_meses' são exibidos como 'mensal' com duração.
  function freqInicial(d) {
    if (!d) return 'nao_repete'
    const f = d.frequencia || (d.recorrente ? 'mensal' : 'nao_repete')
    return f === 'por_meses' ? 'mensal' : f
  }
  // Modo da duração mensal: 'sem_fim' (repete sempre) ou 'quantidade' (N meses).
  function duracaoInicial(d) {
    if (d && (d.frequencia === 'por_meses') && d.recorrencia_meses != null) return 'quantidade'
    return 'sem_fim'
  }

  const [form, setForm] = useState({
    descricao: despesaInicial?.descricao ?? '',
    valor: despesaInicial != null ? String(despesaInicial.valor) : '',
    data: despesaInicial?.data ?? hojeISO(),
    frequencia: freqInicial(despesaInicial),
    categoria_id: despesaInicial?.categoria_id ?? '',
    forma_pagamento: despesaInicial?.forma_pagamento ?? '',
    // Duração da recorrência mensal (só UI): 'sem_fim' | 'quantidade' + nº meses
    duracaoMensal: duracaoInicial(despesaInicial),
    recorrenciaMeses: despesaInicial?.recorrencia_meses != null ? String(despesaInicial.recorrencia_meses) : '3',
    // Novos (só UI): forma da compra no cartão e nº de parcelas
    comoCompra: 'avista',       // 'avista' | 'parcelada'
    numero_parcelas: '12',
    cartao_id: '',
  })

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  // ─── Tipo manual (Fixa/Variável) — só no modo edição ───
  // Inicia com o tipo atual da despesa. "escopoTipo" define, para recorrentes,
  // se a mudança vale só neste mês (exceção) ou neste e nos próximos (registro).
  const [tipoManual, setTipoManual] = useState(despesaInicial?.tipo_despesa === 'fixa' ? 'fixa' : 'variavel')
  const [escopoTipo, setEscopoTipo] = useState('proximos') // 'mes' | 'proximos'
  const despesaEhRecorrente = !!despesaInicial?.recorrente
  const tipoMudou = editando && tipoManual !== (despesaInicial?.tipo_despesa || 'variavel')

  const ehCartaoCredito = form.forma_pagamento === 'cartao_credito'
  // Parcelada só é possível no cartão de crédito; edição nunca vira parcelamento.
  const ehParcelada = !editando && ehCartaoCredito && form.comoCompra === 'parcelada'

  // "Valor por parcela" usando a MESMA função da lógica de parcelamento.
  const { base: parcelaBase, ultima: parcelaUltima } =
    ehParcelada && Number(form.valor) > 0 && form.numero_parcelas
      ? calcularParcelas(Number(form.valor), parseInt(form.numero_parcelas))
      : { base: 0, ultima: 0 }
  const temAjusteParcela = parcelaBase > 0 && parcelaUltima !== parcelaBase

  function handleSubmit(e) {
    e.preventDefault()

    // ── Caminho PARCELAMENTO (compra parcelada no cartão) ──
    if (ehParcelada) {
      onSalvarParcelada({
        descricao: form.descricao,
        valor_total: Number(form.valor) || 0,
        numero_parcelas: parseInt(form.numero_parcelas),
        // 1ª parcela = mês da data informada (mesmo formato do FormParcelamento)
        primeira_parcela: form.data.slice(0, 7) + '-01',
        categoria_id: form.categoria_id || null,
        forma_pagamento: 'cartao_credito',
        cartao_id: form.cartao_id || null,
      })
      return
    }

    // ── Caminho DESPESA (à vista / 1x no cartão / outras formas) ──
    const catSelecionada = categorias.find(c => c.id === form.categoria_id)
    // Tipo (fixa/variável):
    //  - Criação: classificação automática (regra atual, inalterada).
    //  - Edição: respeita a escolha MANUAL do usuário (não reclassifica, para
    //    não sobrescrever a decisão dele).
    const tipo_despesa = editando
      ? tipoManual
      : classificarDespesa({
          descricao: form.descricao,
          categoria: catSelecionada?.nome || '',
        })
    // Frequência final + duração:
    //  - Mensal "sem data para terminar" → frequencia 'mensal', sem limite.
    //  - Mensal "por quantos meses?"     → frequencia 'por_meses' + recorrencia_meses.
    //    (A projeção já respeita recorrencia_meses para por_meses, contando a
    //     partir da data inicial e parando após N meses.)
    let freq = form.frequencia
    let recorrenciaMeses = null
    if (form.frequencia === 'mensal' && form.duracaoMensal === 'quantidade') {
      const n = parseInt(form.recorrenciaMeses, 10)
      if (n > 0) { freq = 'por_meses'; recorrenciaMeses = n }
    }
    const recorrente = freq !== 'nao_repete'

    onSalvarVista({
      descricao: form.descricao,
      valor: Number(form.valor) || 0,
      data: form.data,
      recorrente,
      frequencia: freq,
      recorrencia_meses: recorrenciaMeses,
      categoria_id: form.categoria_id || null,
      tipo_despesa,
      forma_pagamento: form.forma_pagamento || null,
      // Só na edição: escopo da mudança de tipo para despesas recorrentes.
      // 'mes' = somente este mês (vira exceção mensal); 'proximos' = este e os
      // próximos (altera o registro). Para não-recorrentes é sempre o registro.
      _escopoTipo: editando ? escopoTipo : undefined,
      _tipoAlterado: editando ? (tipoManual !== (despesaInicial?.tipo_despesa || 'variavel')) : false,
    })
  }

  const OPCOES_REPETIR = [
    { value: 'nao_repete', titulo: 'Não',          desc: 'considera somente a ocorrência cadastrada' },
    { value: 'mensal',     titulo: 'Mensalmente',  desc: 'repete o mesmo valor todo mês' },
    { value: 'semanal',    titulo: 'Semanalmente', desc: 'repete o mesmo valor toda semana' },
    { value: 'diaria',     titulo: 'Diariamente',  desc: 'repete o mesmo valor todo dia' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder="Ex: Aluguel, Supermercado, Netflix..." required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor (R$)</label>
          <InputMoeda valor={form.valor}
            onChangeValor={(n) => setForm(prev => ({ ...prev, valor: n }))}
            className="input" />
        </div>
        <div>
          <label className="label">Data</label>
          <input name="data" value={form.data} onChange={handleChange}
            type="date" className="input" required />
        </div>
      </div>

      {/* Dica discreta para contas fixas de valor variável (água, energia...) */}
      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 leading-snug">
        💡 Dica: para despesas fixas que variam de valor, como água e energia, informe
        inicialmente o maior valor de conta que você teve neste ano. Após o pagamento,
        você poderá corrigir manualmente para o valor realmente pago.
      </p>

      <div>
        <label className="label">Categoria</label>
        <select name="categoria_id" value={form.categoria_id} onChange={handleChange} className="input">
          <option value="">Sem categoria</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Forma de pagamento</label>
        <select name="forma_pagamento" value={form.forma_pagamento} onChange={handleChange} className="input">
          <option value="">Não informado</option>
          {FORMAS_PAGAMENTO.map(f => (
            <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
          ))}
        </select>
      </div>

      {/* "Como foi a compra?" — só para cartão de crédito e só na criação */}
      {!editando && ehCartaoCredito && (
        <div className="rounded-xl border border-gray-200 p-3 space-y-3">
          <div>
            <label className="label">Como foi a compra?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => setForm(p => ({ ...p, comoCompra: 'avista' }))}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  form.comoCompra === 'avista' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                }`}>
                1x
              </button>
              <button type="button"
                onClick={() => setForm(p => ({ ...p, comoCompra: 'parcelada' }))}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  form.comoCompra === 'parcelada' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'
                }`}>
                Parcelada
              </button>
            </div>
          </div>

          {ehParcelada && (
            <div>
              <label className="label">Número de parcelas</label>
              <select name="numero_parcelas" value={form.numero_parcelas} onChange={handleChange} className="input">
                {[2,3,4,5,6,7,8,9,10,11,12,18,24,36,48,60].map(n => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
              {parcelaBase > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mt-2">
                  <p className="text-xs text-blue-700">
                    Valor por parcela: <strong>{formatCurrency(parcelaBase)}/mês</strong>
                  </p>
                  {temAjusteParcela && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      Última parcela: <strong>{formatCurrency(parcelaUltima)}</strong> (ajuste de centavos)
                    </p>
                  )}
                </div>
              )}

              {/* Em qual cartão? (opcional, igual ao FormParcelamento) */}
              <label className="label mt-3">Em qual cartão? <span className="text-gray-400">(opcional)</span></label>
              {cartoes.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-500">
                  Você ainda não possui cartões cadastrados.
                  <Link to="/cartoes" className="block mt-2 text-blue-600 font-medium hover:underline">
                    + Cadastrar cartão
                  </Link>
                </div>
              ) : (
                <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input">
                  <option value="">Não vincular a um cartão específico</option>
                  {cartoes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {/* "Essa despesa se repete?" — separada. Oculta quando for compra parcelada
          (parcelamento ≠ recorrência; evita duplicidade — item 8). */}
      {!ehParcelada && (
        <div className="rounded-xl border border-gray-200 p-3">
          <label className="label">Essa despesa se repete?</label>
          <select name="frequencia" value={form.frequencia} onChange={handleChange} className="input">
            {OPCOES_REPETIR.map(o => (
              <option key={o.value} value={o.value}>{o.titulo}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1.5">
            Use para contas recorrentes, como aluguel, internet e assinaturas.
          </p>

          {/* Duração — só para a frequência "Mensalmente" */}
          {form.frequencia === 'mensal' && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <label className="label">Por quanto tempo?</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, duracaoMensal: 'sem_fim' }))}
                  className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.duracaoMensal === 'sem_fim' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}>
                  Sem data para terminar
                </button>
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, duracaoMensal: 'quantidade' }))}
                  className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    form.duracaoMensal === 'quantidade' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}>
                  Por alguns meses
                </button>
              </div>

              {form.duracaoMensal === 'quantidade' && (
                <div className="mt-2">
                  <label className="label">Por quantos meses?</label>
                  <input
                    name="recorrenciaMeses"
                    value={form.recorrenciaMeses}
                    onChange={handleChange}
                    type="number" min="1" max="120" inputMode="numeric"
                    className="input" placeholder="Ex: 3"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    A despesa entra na projeção a partir da data inicial e para após esse número de meses.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Classificação: automática na criação; MANUAL (Fixa/Variável) na edição. */}
      {!editando ? (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <span>✨</span>
          A classificação como <strong>Fixa</strong> ou <strong>Variável</strong> será feita automaticamente ao salvar.
        </p>
      ) : (
        <div className="rounded-xl border border-gray-200 p-3">
          <label className="label">Tipo da despesa</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button"
              onClick={() => setTipoManual('fixa')}
              className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                tipoManual === 'fixa' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}>
              🧱 Fixa
            </button>
            <button type="button"
              onClick={() => setTipoManual('variavel')}
              className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                tipoManual === 'variavel' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
              }`}>
              📊 Variável
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Fixa = valor estável todo mês (aluguel, assinatura). Variável = valor que oscila (mercado, lazer).
          </p>

          {/* Pergunta de escopo — só quando é recorrente E o tipo mudou. */}
          {despesaEhRecorrente && tipoMudou && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <label className="label">Deseja aplicar esta alteração somente neste mês ou neste e nos próximos meses?</label>
              <div className="grid grid-cols-1 gap-2 mt-1">
                <button type="button"
                  onClick={() => setEscopoTipo('mes')}
                  className={`p-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                    escopoTipo === 'mes' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}>
                  Somente este mês
                </button>
                <button type="button"
                  onClick={() => setEscopoTipo('proximos')}
                  className={`p-2.5 rounded-xl border-2 text-sm font-medium text-left transition-all ${
                    escopoTipo === 'proximos' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                  }`}>
                  Este e os próximos meses
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando
            ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
            : (textoBotao || 'Salvar despesa')}
        </button>
      </div>
    </form>
  )
}

// ─── Notificação de classificação automática ──────────────────────────────────
function NotificacaoClassificacao({ despesa, onAlterar, onFechar }) {
  const tipo = despesa?.tipo_despesa || 'variavel'
  const { label, icone, classes } = labelTipoDespesa(tipo)
  const tipoOposto = tipo === 'fixa' ? 'variavel' : 'fixa'
  const labelOposto = tipoOposto === 'fixa' ? 'Fixa' : 'Variável'

  useEffect(() => {
    const timer = setTimeout(onFechar, 6000)
    return () => clearTimeout(timer)
  }, [onFechar])

  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>{icone}</span>
        <span>
          Classificada automaticamente como:{' '}
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${classes}`}>
            Despesa {label}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => onAlterar(despesa.id, tipoOposto)}
          className="text-xs text-blue-600 hover:underline font-medium">
          Alterar para {labelOposto}
        </button>
        <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
      </div>
    </div>
  )
}

// ─── Modal: Nova despesa (À vista / Parcelada) ou Editar despesa ──────────────
function ModalNovaDespesa({
  aberto, onFechar, onSalvarVista, onSalvarParcelada,
  salvandoVista, salvandoParcelada, despesaEmEdicao,
}) {
  const editando = !!despesaEmEdicao

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? 'Editar despesa' : 'Nova despesa'}
    >
      {/* Fluxo unificado: a diferenciação 1x/Parcelada mora dentro do próprio
          formulário e só aparece quando a forma de pagamento é Cartão de crédito.
          Na edição, só o caminho de despesa (não vira parcelamento). */}
      <FormDespesa
        key={editando ? despesaEmEdicao.id : 'nova'}
        onSalvarVista={onSalvarVista}
        onSalvarParcelada={onSalvarParcelada}
        onCancelar={onFechar}
        carregando={editando ? salvandoVista : (salvandoVista || salvandoParcelada)}
        despesaInicial={editando ? despesaEmEdicao : undefined}
        textoBotao={editando ? 'Salvar alterações' : 'Salvar despesa'}
      />
    </Modal>
  )
}

// ─── Modal: confirmar antecipação de pagamento ───────────────────────────────
// Mostra valor, data original (vencimento), data do pagamento (editável, padrão
// hoje) e a forma/conta usada. Ao confirmar, marca a despesa como paga em
// "pago_em" — o saldo reflete a saída sem contar duas vezes (ver useProjecao).
function ModalAnteciparPagamento({ aberto, despesa, onConfirmar, onFechar, salvando }) {
  const hojeStr = hojeISO() // data de hoje no fuso de Brasília
  const [dataPagamento, setDataPagamento] = useState(hojeStr)
  const [forma, setForma] = useState('')

  useEffect(() => {
    if (aberto && despesa) {
      setDataPagamento(hojeStr)
      setForma(despesa.forma_pagamento || '')
    }
  }, [aberto, despesa, hojeStr])

  if (!despesa) return null

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Antecipar pagamento">
      <div className="space-y-4">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Despesa</span>
            <span className="text-sm font-medium text-gray-900 truncate">{despesa.descricao}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Valor</span>
            <span className="text-sm font-bold text-red-500 whitespace-nowrap">-{formatCurrency(despesa.valor)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-500">Vencimento original</span>
            <span className="text-sm font-medium text-gray-900">{formatDate(despesa.data)}</span>
          </div>
        </div>

        <div>
          <label className="label">Data do pagamento</label>
          <input
            type="date" value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className="input"
          />
        </div>

        <div>
          <label className="label">Forma / conta utilizada <span className="text-gray-400">(opcional)</span></label>
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="input">
            <option value="">Não informado</option>
            {FORMAS_PAGAMENTO.map(f => (
              <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-400 leading-snug">
          A despesa será marcada como <strong>paga antecipadamente</strong> e o seu saldo será
          atualizado. O vencimento original é mantido para o histórico.
        </p>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onFechar} className="btn-secondary flex-1">Cancelar</button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => onConfirmar({ pago_em: dataPagamento || hojeISO, forma_pagamento: forma || null })}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Confirmando...</> : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Despesas() {
  const {
    despesas, total, carregando, criar, atualizar, remover, alterarTipo,
    anteciparPagamento, desfazerAntecipacao,
  } = useDespesas(mesAtual, anoAtual)
  const { salvarExcecao, tipoNoMes } = useDespesaTipoExcecoes()
  // Competência do mês exibido (mês fixo atual nesta tela): 'YYYY-MM'.
  const anoMesAtual = `${anoAtual}-${String(mesAtual).padStart(2, '0')}`
  const {
    parcelamentos,
    totalMesAtual,
    carregando: carregandoParc,
    criar: criarParcelamento,
    atualizar: atualizarParcelamento,
    quitar,
    remover: removerParcelamento,
  } = useParcelamentos()
  const { resumoMes } = useProjecao()
  const { cartoes } = useCartoes()

  const [filtro, setFiltro] = useState('Todas')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoParc, setSalvandoParc] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [removendoParc, setRemovendoParc] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const [ultimaDespesa, setUltimaDespesa] = useState(null)
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [despesaEditando, setDespesaEditando] = useState(null) // null = modo criação
  const [parcelamentoEditando, setParcelamentoEditando] = useState(null)
  const [salvandoEdicaoParc, setSalvandoEdicaoParc] = useState(false)
  // Antecipação de pagamento
  const [despesaAntecipar, setDespesaAntecipar] = useState(null)
  const [antecipando, setAntecipando] = useState(false)

  const nomeMes = new Date(anoAtual, mesAtual - 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // ─── Parcelas devidas no mês selecionado (sem duplicar o valor total da compra) ───
  // Cada parcelamento vira uma "linha de parcela" com o valor devido neste mês.
  const parcelasDoMes = parcelamentos
    .map(p => {
      const valor = valorParcelaNoMes(p, anoAtual, mesAtual)
      if (valor <= 0) return null
      return { parcelamento: p, valor, tipo_despesa: p.tipoDespesa }
    })
    .filter(Boolean)

  const totalParcelasMes = parcelasDoMes.reduce((a, x) => a + x.valor, 0)
  const totalParcelasFixasMes = parcelasDoMes
    .filter(x => x.tipo_despesa === 'fixa').reduce((a, x) => a + x.valor, 0)
  const totalParcelasVariaveisMes = parcelasDoMes
    .filter(x => x.tipo_despesa !== 'fixa').reduce((a, x) => a + x.valor, 0)

  // Totais por tipo — despesas à vista + parcela do mês.
  // O tipo das despesas à vista respeita a EXCEÇÃO do mês (tipoNoMes), se houver.
  const totalFixas =
    despesas.filter(d => tipoNoMes(d, anoMesAtual) === 'fixa').reduce((a, d) => a + Number(d.valor), 0)
    + totalParcelasFixasMes
  const totalVariaveis =
    despesas.filter(d => tipoNoMes(d, anoMesAtual) !== 'fixa').reduce((a, d) => a + Number(d.valor), 0)
    + totalParcelasVariaveisMes
  const totalGeral = totalFixas + totalVariaveis

  const receitaBase = resumoMes.receitaTotal || 0
  const pctFixas = receitaBase > 0 ? Math.round((totalFixas / receitaBase) * 100) : 0
  const pctVariaveis = receitaBase > 0 ? Math.round((totalVariaveis / receitaBase) * 100) : 0

  // ─── Próximos vencimentos (para antecipar) ───
  // Despesas à vista do mês com vencimento FUTURO (data > hoje) e ainda NÃO
  // pagas antecipadamente (pago_em vazio). Mostra dias restantes e permite
  // antecipar o pagamento. Ordenado pelo vencimento mais próximo.
  const hojeStrLocal = hojeISO() // data de hoje no fuso de Brasília
  const hojeMeiaNoite = new Date(hojeStrLocal + 'T12:00:00')
  const proximosVencimentos = despesas
    .filter(d => !d.pago_em && d.data > hojeStrLocal)
    .map(d => {
      const dt = new Date(d.data + 'T12:00:00')
      const diasFaltam = Math.round((dt - hojeMeiaNoite) / 86400000)
      return { despesa: d, diasFaltam }
    })
    .sort((a, b) => a.diasFaltam - b.diasFaltam)

  // Despesas já pagas antecipadamente neste mês (para feedback ao usuário).
  const pagasAntecipadamente = despesas.filter(d => d.pago_em)

  // Parcelamentos ativos / concluídos (para a aba Parceladas)
  const parcAtivos = parcelamentos.filter(p => p.ativo)
  const parcConcluidos = parcelamentos.filter(p => !p.ativo)

  // Filtros/abas
  const abas = ['Todas', 'Fixas', 'Variáveis', 'Parceladas']

  // Despesas (à vista) filtradas conforme a aba — usa o tipo do MÊS (exceção
  // mensal quando existir), para o filtro bater com o rótulo exibido.
  const despesasVisiveis = (() => {
    if (filtro === 'Fixas') return despesas.filter(d => tipoNoMes(d, anoMesAtual) === 'fixa')
    if (filtro === 'Variáveis') return despesas.filter(d => tipoNoMes(d, anoMesAtual) !== 'fixa')
    if (filtro === 'Parceladas') return [] // aba parceladas mostra os parcelamentos, não as despesas à vista
    return despesas // Todas
  })()

  // Parcelas do mês exibidas como linhas nas abas Todas/Fixas/Variáveis
  const parcelasVisiveis = (() => {
    if (filtro === 'Parceladas') return [] // na aba Parceladas usamos os cards completos
    if (filtro === 'Fixas') return parcelasDoMes.filter(x => x.tipo_despesa === 'fixa')
    if (filtro === 'Variáveis') return parcelasDoMes.filter(x => x.tipo_despesa !== 'fixa')
    return parcelasDoMes // Todas
  })()

  const mostrarParceladas = filtro === 'Parceladas'
  const totalLinhas = despesasVisiveis.length + parcelasVisiveis.length

  // Atalho do botão "+" (menu inferior mobile): ?novo=1 abre o modal de nova
  // despesa; ?novo=parcelado abre o modal e já posiciona na aba Parceladas.
  // Usa o fluxo/modal JÁ existente — sem formulário novo.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const novo = searchParams.get('novo')
    if (novo === '1' || novo === 'parcelado') {
      setDespesaEditando(null)
      setModalAberto(true)
      if (novo === 'parcelado') setFiltro('Parceladas')
      searchParams.delete('novo')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // ─── Handlers despesa à vista ───
  // Abre o modal em modo criação
  function handleAbrirNova() {
    setDespesaEditando(null)
    setModalAberto(true)
  }

  // Abre o modal em modo edição, preenchido com a despesa
  function handleEditar(despesa) {
    setDespesaEditando(despesa)
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setDespesaEditando(null)
  }

  // Salva: cria uma nova OU atualiza a existente (sem duplicar)
  async function handleSalvar(dados) {
    setSalvando(true)
    setErroAcao('')
    try {
      if (despesaEditando) {
        // Separa os metadados de controle do tipo (não são colunas da despesa).
        const { _escopoTipo, _tipoAlterado, ...payload } = dados

        // Caso ESPECIAL: despesa recorrente + mudança de tipo "somente este mês".
        // Não altera o tipo_despesa do registro base — grava uma EXCEÇÃO mensal.
        // Os demais campos editados seguem no update normal (sem o tipo).
        if (despesaEditando.recorrente && _tipoAlterado && _escopoTipo === 'mes') {
          const { tipo_despesa, ...semTipo } = payload
          await atualizar(despesaEditando.id, semTipo)       // demais campos
          await salvarExcecao(despesaEditando.id, anoMesAtual, tipo_despesa) // só este mês
        } else {
          // Demais casos (não recorrente, ou "este e próximos"): atualiza o
          // registro normalmente — o tipo_despesa do payload já reflete a escolha.
          await atualizar(despesaEditando.id, payload)
        }
      } else {
        // Remove metadados de controle (não são colunas da tabela despesas).
        const { _escopoTipo, _tipoAlterado, ...payload } = dados
        const nova = await criar(payload)
        setUltimaDespesa(nova)
      }
      fecharModal()
    } catch {
      setErroAcao(despesaEditando
        ? 'Erro ao salvar alterações. Tente novamente.'
        : 'Erro ao salvar despesa. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta despesa?')) return
    setRemovendo(id)
    try {
      await remover(id)
      if (ultimaDespesa?.id === id) setUltimaDespesa(null)
    } catch {
      setErroAcao('Erro ao remover. Tente novamente.')
    } finally {
      setRemovendo(null)
    }
  }

  async function handleAlterarTipo(id, novoTipo) {
    try {
      await alterarTipo(id, novoTipo)
      if (ultimaDespesa?.id === id) {
        setUltimaDespesa(prev => ({ ...prev, tipo_despesa: novoTipo }))
      }
    } catch {
      setErroAcao('Erro ao alterar classificação.')
    }
  }

  // ─── Antecipar pagamento ───
  async function handleConfirmarAntecipacao({ pago_em, forma_pagamento }) {
    if (!despesaAntecipar) return
    setAntecipando(true)
    setErroAcao('')
    try {
      await anteciparPagamento(despesaAntecipar.id, { pago_em, forma_pagamento })
      setDespesaAntecipar(null)
    } catch {
      setErroAcao('Erro ao antecipar o pagamento. Tente novamente.')
    } finally {
      setAntecipando(false)
    }
  }

  // Desfaz a antecipação (volta pago_em para NULL). A despesa volta a ser
  // "futura" e deixa de impactar o saldo até o vencimento chegar.
  async function handleDesfazerAntecipacao(id) {
    if (!confirm('Desfazer o pagamento antecipado desta despesa?')) return
    setErroAcao('')
    try {
      await desfazerAntecipacao(id)
    } catch {
      setErroAcao('Erro ao desfazer a antecipação. Tente novamente.')
    }
  }

  // ─── Handlers parcelamento ───
  async function handleSalvarParcelado(dados) {
    setSalvandoParc(true)
    setErroAcao('')
    try {
      await criarParcelamento(dados)
      setModalAberto(false)
      setFiltro('Parceladas') // leva o usuário à aba onde o item aparece
    } catch {
      setErroAcao('Erro ao salvar parcelamento. Tente novamente.')
    } finally {
      setSalvandoParc(false)
    }
  }

  // Edição de parcelamento (modal próprio)
  function handleEditarParc(p) {
    setParcelamentoEditando(p)
  }

  async function handleSalvarEdicaoParc(dados) {
    setSalvandoEdicaoParc(true)
    setErroAcao('')
    try {
      await atualizarParcelamento(parcelamentoEditando.id, dados)
      setParcelamentoEditando(null)
    } catch {
      setErroAcao('Erro ao salvar alterações do parcelamento. Tente novamente.')
    } finally {
      setSalvandoEdicaoParc(false)
    }
  }

  async function handleQuitar(id) {
    if (!confirm('Confirma a quitação antecipada? As parcelas futuras serão removidas da projeção.')) return
    setQuitando(id)
    setErroAcao('')
    try {
      await quitar(id)
    } catch {
      setErroAcao('Erro ao quitar parcelamento. Tente novamente.')
    } finally {
      setQuitando(null)
    }
  }

  async function handleRemoverParc(id) {
    if (!confirm('Remover este parcelamento definitivamente?')) return
    setRemovendoParc(id)
    setErroAcao('')
    try {
      await removerParcelamento(id)
    } catch {
      setErroAcao('Erro ao remover. Tente novamente.')
    } finally {
      setRemovendoParc(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Despesas</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{nomeMes}</p>
        </div>
        <button onClick={handleAbrirNova}
          className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Nova despesa
        </button>
      </div>

      {/* Três cards de resumo */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card min-w-0">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-2">
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Total do mês</p>
          <p className="text-lg font-bold text-gray-900 break-words">{formatCurrency(totalGeral)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {despesas.length} à vista
            {parcelasDoMes.length > 0 ? ` + ${parcelasDoMes.length} parcela${parcelasDoMes.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="card min-w-0">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">📌</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Fixas</p>
          <p className="text-lg font-bold text-blue-700 break-words">{formatCurrency(totalFixas)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-blue-500 mt-0.5">{pctFixas}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
        <div className="card min-w-0">
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">🛒</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Variáveis</p>
          <p className="text-lg font-bold text-gray-700 break-words">{formatCurrency(totalVariaveis)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-gray-500 mt-0.5">{pctVariaveis}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
      </div>

      {/* Notificação de classificação automática */}
      {ultimaDespesa && (
        <NotificacaoClassificacao
          despesa={ultimaDespesa}
          onAlterar={handleAlterarTipo}
          onFechar={() => setUltimaDespesa(null)}
        />
      )}

      {erroAcao && (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-2">{erroAcao}</p>
      )}

      {/* ─── Antecipar próximos vencimentos ─── */}
      {/* Só aparece quando há despesas com vencimento futuro ainda não pagas. */}
      {!carregando && proximosVencimentos.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-blue-500 flex-shrink-0" />
            <h2 className="text-base font-semibold text-gray-900">Próximos vencimentos</h2>
          </div>
          <div className="space-y-2">
            {proximosVencimentos.map(({ despesa: d, diasFaltam }) => (
              <div key={d.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{d.descricao}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Calendar size={11} />{formatDate(d.data)}
                    </span>
                    <span className="text-xs font-medium text-blue-500">
                      {diasFaltam === 1 ? 'Vence amanhã' : `Faltam ${diasFaltam} dias`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold text-red-500 whitespace-nowrap">-{formatCurrency(d.valor)}</span>
                  <button
                    onClick={() => setDespesaAntecipar(d)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Zap size={13} /> Antecipar
                  </button>
                </div>
              </div>
            ))}
          </div>
          {pagasAntecipadamente.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" />
              {pagasAntecipadamente.length} despesa{pagasAntecipadamente.length !== 1 ? 's' : ''} paga{pagasAntecipadamente.length !== 1 ? 's' : ''} antecipadamente neste mês.
            </p>
          )}
        </div>
      )}

      {/* Abas de filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {abas.map(aba => {
          const qtd = aba === 'Parceladas' ? parcAtivos.length : null
          return (
            <button
              key={aba}
              onClick={() => setFiltro(aba)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filtro === aba
                  ? 'bg-marca text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {aba}{qtd !== null && qtd > 0 ? ` (${qtd})` : ''}
            </button>
          )
        })}
      </div>

      {/* ─── Lista de despesas à vista + parcelas do mês ─── */}
      {filtro !== 'Parceladas' && (
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            {filtro === 'Todas' ? 'Despesas do mês' : `Despesas ${filtro.toLowerCase()}`}
            <span className="ml-2 text-sm font-normal text-gray-400">({totalLinhas})</span>
          </h2>

          {(carregando || carregandoParc) ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : totalLinhas === 0 ? (
            <div className="text-center py-12">
              <TrendingDown size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Nenhuma despesa nesta categoria.</p>
              <button onClick={handleAbrirNova} className="mt-3 text-sm text-blue-600 hover:underline">
                Cadastrar despesa
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Linhas de parcela do mês */}
              {parcelasVisiveis.map(({ parcelamento: p, valor, tipo_despesa }) => {
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(tipo_despesa)
                const nomeCategoria = p.categorias?.nome
                return (
                  <div key={`parc-${p.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {p.categorias?.icone
                          ? <span className="text-base">{p.categorias.icone}</span>
                          : <CreditCard size={16} className="text-orange-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.descricao}</p>
                        {p.forma_pagamento && (
                          <p className="text-xs text-gray-400 mt-0.5">{formaPagamentoLabel(p.forma_pagamento)}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-orange-600">
                            <CreditCard size={11} />Parcela {p.parcelaAtual}/{p.numero_parcelas}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipoClasses}`}>
                            {tipoLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {nomeCategoria && (
                        <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(nomeCategoria)}`}>
                          {nomeCategoria}
                        </span>
                      )}
                      <span className="text-sm font-bold text-red-500 ml-1">-{formatCurrency(valor)}</span>
                    </div>
                  </div>
                )
              })}

              {/* Linhas de despesa à vista */}
              {despesasVisiveis.map(d => {
                const nomeCategoria = d.categorias?.nome
                // Tipo exibido respeita a exceção do mês (se houver).
                const tipoExibido = tipoNoMes(d, anoMesAtual)
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(tipoExibido)
                const tipoOposto = tipoExibido === 'fixa' ? 'variavel' : 'fixa'
                const labelOposto = tipoOposto === 'fixa' ? 'Fixa' : 'Variável'
                return (
                  <div key={d.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {d.categorias?.icone
                          ? <span className="text-base">{d.categorias.icone}</span>
                          : <TrendingDown size={16} className="text-red-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{d.descricao}</p>
                        {d.forma_pagamento && (
                          <p className="text-xs text-gray-400 mt-0.5">{formaPagamentoLabel(d.forma_pagamento)}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Calendar size={11} />{formatDate(d.data)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tipoClasses}`}>
                            {tipoLabel}
                          </span>
                          {d.recorrente && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <RefreshCw size={10} />Recorrente
                            </span>
                          )}
                          {d.pago_em && (
                            <>
                              <span className="flex items-center gap-1 text-xs text-green-600">
                                <CheckCircle2 size={11} />Pago antecipadamente
                              </span>
                              <button
                                onClick={() => handleDesfazerAntecipacao(d.id)}
                                className="text-xs text-gray-400 hover:text-blue-600 underline"
                              >
                                Desfazer
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {nomeCategoria && (
                        <span className={`hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${corCategoria(nomeCategoria)}`}>
                          {nomeCategoria}
                        </span>
                      )}
                      <span className="text-sm font-bold text-red-500 ml-1 whitespace-nowrap">-{formatCurrency(d.valor)}</span>
                      <button onClick={() => handleEditar(d)}
                        title="Editar despesa" aria-label="Editar despesa"
                        className="touch-target rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleRemover(d.id)} disabled={removendo === d.id}
                        aria-label="Remover despesa"
                        className="touch-target rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        {removendo === d.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Seção de parcelamentos ─── */}
      {mostrarParceladas && (
        <div className="space-y-4">
          {/* Resumo de parcelamentos */}
          {parcAtivos.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Parcelas este mês</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(totalMesAtual)}</p>
                <p className="text-xs text-gray-400 mt-1">{parcAtivos.length} ativo{parcAtivos.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="card">
                <p className="text-xs text-gray-500 mb-1">Total a pagar</p>
                <p className="text-xl font-bold text-gray-800">
                  {formatCurrency(parcAtivos.reduce((a, p) => a + p.valorRestante, 0))}
                </p>
                <p className="text-xs text-gray-400 mt-1">Em parcelamentos ativos</p>
              </div>
            </div>
          )}

          {carregandoParc ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : parcAtivos.length === 0 && parcConcluidos.length === 0 ? (
            filtro === 'Parceladas' && (
              <div className="card text-center py-12">
                <CreditCard size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Nenhuma compra parcelada cadastrada.</p>
                <button onClick={handleAbrirNova} className="mt-3 text-sm text-blue-600 hover:underline">
                  Cadastrar parcelamento
                </button>
              </div>
            )
          ) : (
            <>
              {parcAtivos.length > 0 && (
                <>
                  {parcAtivos.map(p => (
                    <CardParcelamento key={p.id} p={p}
                      onQuitar={handleQuitar} onRemover={handleRemoverParc}
                      onEditar={handleEditarParc} cartoes={cartoes}
                      quitando={quitando} removendo={removendoParc} />
                  ))}
                </>
              )}

              {/* Concluídos/quitados — colapsável */}
              {parcConcluidos.length > 0 && (
                <div>
                  <button onClick={() => setMostrarConcluidos(v => !v)}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors">
                    {mostrarConcluidos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {mostrarConcluidos ? 'Ocultar' : 'Ver'} concluídos e quitados ({parcConcluidos.length})
                  </button>
                  {mostrarConcluidos && (
                    <div className="space-y-4 mt-4">
                      {parcConcluidos.map(p => (
                        <CardParcelamento key={p.id} p={p}
                          onQuitar={handleQuitar} onRemover={handleRemoverParc}
                          cartoes={cartoes}
                          quitando={quitando} removendo={removendoParc} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal: Nova despesa (criação) ou Editar despesa */}
      <ModalNovaDespesa
        aberto={modalAberto}
        onFechar={fecharModal}
        onSalvarVista={handleSalvar}
        onSalvarParcelada={handleSalvarParcelado}
        salvandoVista={salvando}
        salvandoParcelada={salvandoParc}
        despesaEmEdicao={despesaEditando}
      />

      {/* Modal: Editar parcelamento */}
      <Modal
        aberto={!!parcelamentoEditando}
        onFechar={() => setParcelamentoEditando(null)}
        titulo="Editar parcelamento"
      >
        {parcelamentoEditando && (
          <FormParcelamento
            key={parcelamentoEditando.id}
            onSalvar={handleSalvarEdicaoParc}
            onCancelar={() => setParcelamentoEditando(null)}
            carregando={salvandoEdicaoParc}
            parcelamentoInicial={parcelamentoEditando}
            textoBotao="Salvar alterações"
          />
        )}
      </Modal>

      {/* Modal: confirmar antecipação de pagamento */}
      <ModalAnteciparPagamento
        aberto={!!despesaAntecipar}
        despesa={despesaAntecipar}
        onConfirmar={handleConfirmarAntecipacao}
        onFechar={() => setDespesaAntecipar(null)}
        salvando={antecipando}
      />
    </div>
  )
}
