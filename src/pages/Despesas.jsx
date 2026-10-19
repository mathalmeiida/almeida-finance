import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { TrendingDown, Plus, RefreshCw, Calendar, Trash2, Loader2, Pencil, CreditCard, CheckCircle2, ChevronDown, ChevronUp, CalendarClock, Zap, Lightbulb, Target, Wallet, ArrowDownRight } from 'lucide-react'
import { useDespesas } from '../hooks/useDespesas'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDespesaTipoExcecoes } from '../hooks/useDespesaTipoExcecoes'
import { useParcelamentos, valorParcelaNoMes, calcularParcelas } from '../hooks/useParcelamentos'
import { useCategorias } from '../hooks/useCategorias'
import SeletorCategoriaModerno from '../components/SeletorCategoriaModerno'
import { useCartoes } from '../hooks/useCartoes'
import { useProjecao } from '../hooks/useProjecao'
import Modal from '../components/Modal'
import InputMoeda from '../components/InputMoeda'
import ModalAnteciparPagamento from '../components/ModalAnteciparPagamento'
import { formatCurrency, formatDate, corCategoria, FORMAS_PAGAMENTO, formaPagamentoLabel, hojeISO } from '../lib/utils'
import { classificarDespesa, labelTipoDespesa } from '../lib/classificarDespesa'
import { FormParcelamento, CardParcelamento } from './Parcelamentos'
import SimuladorAmortizacao from '../components/SimuladorAmortizacao'
import { taxaAnualParaMensal, amortizarSaldoDevedor } from '../lib/financiamento'

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
    subcategoria_id: despesaInicial?.subcategoria_id ?? '',
    forma_pagamento: despesaInicial?.forma_pagamento ?? '',
    // Duração da recorrência mensal (só UI): 'sem_fim' | 'quantidade' + nº meses
    duracaoMensal: duracaoInicial(despesaInicial),
    recorrenciaMeses: despesaInicial?.recorrencia_meses != null ? String(despesaInicial.recorrencia_meses) : '3',
    // Novos (só UI): forma da compra no cartão e nº de parcelas
    comoCompra: 'avista',       // 'avista' | 'parcelada'
    numero_parcelas: '12',
    // Cartão vinculado: na edição, pré-preenche com o que já estava salvo
    // (metadado). Na criação à vista também é persistido quando houver.
    cartao_id: despesaInicial?.cartao_id ?? '',
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

  // Se a despesa foi salva com uma forma que não está no seletor atual
  // (ex.: dinheiro, VR, VA vindos do onboarding), inclui uma opção extra para
  // que ela apareça selecionada e permaneça editável, sem se perder ao salvar.
  const formaForaDaLista =
    form.forma_pagamento &&
    !FORMAS_PAGAMENTO.some(f => f.value === form.forma_pagamento)

  // "Valor por parcela" usando a MESMA função da lógica de parcelamento.
  const { base: parcelaBase, ultima: parcelaUltima } =
    ehParcelada && Number(form.valor) > 0 && form.numero_parcelas
      ? calcularParcelas(Number(form.valor), parseInt(form.numero_parcelas))
      : { base: 0, ultima: 0 }
  const temAjusteParcela = parcelaBase > 0 && parcelaUltima !== parcelaBase

  function handleSubmit(e) {
    e.preventDefault()

    if (!form.descricao.trim() || !form.data || !(Number(form.valor) > 0)) {
      window.alert('Informe descrição, data e um valor maior que zero.');
      return
    }
    if (form.frequencia === 'mensal' && form.duracaoMensal === 'quantidade' &&
        (!Number.isInteger(Number(form.recorrenciaMeses)) || Number(form.recorrenciaMeses) < 1 || Number(form.recorrenciaMeses) > 120)) {
      window.alert('Informe uma duração válida de 1 a 120 meses.');
      return
    }

    // ── Caminho PARCELAMENTO (compra parcelada no cartão) ──
    if (ehParcelada) {
      onSalvarParcelada({
        descricao: form.descricao,
        valor_total: Number(form.valor) || 0,
        numero_parcelas: parseInt(form.numero_parcelas),
        // 1ª parcela = mês da data informada (mesmo formato do FormParcelamento)
        primeira_parcela: form.data.slice(0, 7) + '-01',
        categoria_id: form.categoria_id || null,
        // A tabela parcelamentos não tem subcategoria_id; preservar cadastro parcelado.
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
      subcategoria_id: form.subcategoria_id || null,
      tipo_despesa,
      forma_pagamento: form.forma_pagamento || null,
      // Vínculo de cartão (metadado): só quando a forma é cartão de crédito e um
      // cartão do PRÓPRIO usuário foi escolhido; caso contrário null (desvincula).
      // A validação de propriedade (cartão está na lista do usuário) é a 1ª linha
      // de defesa; a RLS do banco faz a checagem final. Não gera fatura nem
      // compra — a despesa continua sendo uma única linha em despesas.
      cartao_id:
        ehCartaoCredito && form.cartao_id && cartoes.some(c => c.id === form.cartao_id)
          ? form.cartao_id
          : null,
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

      <SeletorCategoriaModerno
        categorias={categorias}
        value={form.categoria_id}
        onChange={(categoria_id) => setForm(prev => ({ ...prev, categoria_id, subcategoria_id: '' }))}
        subcategoriaValue={form.subcategoria_id}
        onSubcategoriaChange={(subcategoria_id) => setForm(prev => ({ ...prev, subcategoria_id }))}
      />

      <div>
        <label className="label">Forma de pagamento</label>
        <select name="forma_pagamento" value={form.forma_pagamento} onChange={handleChange} className="input">
          <option value="">Não informado</option>
          {FORMAS_PAGAMENTO.map(f => (
            <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
          ))}
          {/* Mantém selecionável a forma salva fora da lista (dinheiro/VR/VA). */}
          {formaForaDaLista && (
            <option value={form.forma_pagamento}>{formaPagamentoLabel(form.forma_pagamento) || form.forma_pagamento}</option>
          )}
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

      {/* Edição: vincular/editar o cartão de uma despesa no crédito (metadado).
          Na edição não oferecemos parcelamento, só o vínculo do cartão. */}
      {editando && ehCartaoCredito && cartoes.length > 0 && (
        <div>
          <label className="label">Em qual cartão? <span className="text-gray-400">(opcional)</span></label>
          <select name="cartao_id" value={form.cartao_id} onChange={handleChange} className="input">
            <option value="">Não vincular a um cartão específico</option>
            {cartoes.map(c => (
              <option key={c.id} value={c.id}>{c.nome}{c.banco ? ` • ${c.banco}` : ''}</option>
            ))}
          </select>
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
// ─── Formulário: Financiamento / Consórcio ────────────────────────────────────
// Reaproveita a tabela "parcelamentos" (não cria tabela nova). Grava:
//   valor_total     = valor da parcela × quantidade total de parcelas
//   numero_parcelas = quantidade total
//   primeira_parcela= derivada do 1º vencimento recuando "parcelas decorridas"
//                     meses, para que o hook calcule a quantidade já decorrida
//                     corretamente — sem exigir marcação de pagamento e sem
//                     duplicar valores (parcelas futuras entram na projeção).
//   tipo            = 'financiamento' | 'consorcio'
// Conta quantas parcelas MENSAIS já venceram entre a data do 1º vencimento e
// hoje (inclui a 1ª se já venceu). Compara ano/mês e, no mês atual, o dia —
// lidando com meses de 28..31 dias. Limitada ao total de parcelas.
function decorridasDesde(primeiroVencISO, totalParcelas, hoje = new Date()) {
  if (!primeiroVencISO) return 0
  const ini = new Date(primeiroVencISO + 'T12:00:00')
  if (isNaN(ini)) return 0
  const meses = (hoje.getFullYear() - ini.getFullYear()) * 12 + (hoje.getMonth() - ini.getMonth())
  // Só conta a parcela do mês corrente se o dia de vencimento já passou.
  const decorridas = hoje.getDate() >= ini.getDate() ? meses + 1 : meses
  return Math.min(Math.max(0, decorridas), totalParcelas)
}

const TIPO_LABELS = {
  financiamento: { titulo: 'Financiamento', placeholder: 'Ex: Financiamento do carro' },
  emprestimo:    { titulo: 'Empréstimo',    placeholder: 'Ex: Empréstimo pessoal' },
  consorcio:     { titulo: 'Consórcio',     placeholder: 'Ex: Consórcio apartamento' },
}

// Nº de meses ativos de uma despesa recorrente desde a 1ª ocorrência ("data").
function mesesAtiva(dataISO, hoje = new Date()) {
  if (!dataISO) return 0
  const ini = new Date(dataISO + 'T12:00:00')
  if (isNaN(ini)) return 0
  const m = (hoje.getFullYear() - ini.getFullYear()) * 12 + (hoje.getMonth() - ini.getMonth())
  return Math.max(0, m)
}

function FormFinanciamentoConsorcio({ tipo, onSalvar, onCancelar, carregando }) {
  const { categorias } = useCategorias('ambos')
  const meta = TIPO_LABELS[tipo] || TIPO_LABELS.financiamento

  // Consórcio não tem juros SAC/PRICE → sem dados de contrato p/ amortização.
  const ehFinanciavel = tipo === 'financiamento' || tipo === 'emprestimo'

  const [form, setForm] = useState({
    descricao: '',
    categoriaTipo: (tipo === 'consorcio' || tipo === 'financiamento') ? 'imovel' : 'outros',
    valorParcela: '',
    numeroParcelas: tipo === 'consorcio' ? '80' : tipo === 'emprestimo' ? '48' : '360',
    primeiroVencimento: hojeISO(),
    // Dados do contrato (opcionais) — habilitam o registro de amortizações.
    temContrato: false,
    saldoDevedor: '',
    taxa: '',
    taxaPeriodo: 'mensal', // mensal | anual
    sistema: 'price',      // sac | price
    prazoRestante: '',
    saldoData: hojeISO(),
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // Mapeia a categoria "amigável" (imóvel/veículo/outros) para uma categoria
  // existente do usuário/sistema, por nome. Fallback: sem categoria.
  function resolverCategoriaId() {
    const alvo = form.categoriaTipo === 'imovel' ? ['moradia', 'imóvel', 'imovel']
      : form.categoriaTipo === 'veiculo' ? ['transporte', 'veículo', 'veiculo', 'carro']
      : ['outros']
    const achada = categorias.find(c => alvo.includes((c.nome || '').toLowerCase()))
    return achada?.id || null
  }

  const valorParcelaNum = Number(form.valorParcela) || 0
  const totalParcelas = Math.max(1, parseInt(form.numeroParcelas, 10) || 1)
  // Parcelas decorridas calculadas AUTOMATICAMENTE a partir da data do 1º
  // vencimento (contratos antigos informam a data original). Sem campo extra.
  const decorridas = decorridasDesde(form.primeiroVencimento, totalParcelas)
  const restantes = totalParcelas - decorridas
  const valorTotal = valorParcelaNum * totalParcelas

  function handleSubmit(e) {
    e.preventDefault()
    if (valorParcelaNum <= 0) return

    // Grava a DATA ORIGINAL do 1º vencimento. O hook deriva as parcelas
    // decorridas pela diferença até hoje — nenhuma despesa retroativa é criada
    // e o histórico não é somado duas vezes.
    const payload = {
      descricao: form.descricao || meta.titulo,
      valor_total: valorTotal,
      numero_parcelas: totalParcelas,
      primeira_parcela: form.primeiroVencimento,
      categoria_id: resolverCategoriaId(),
      forma_pagamento: null,
      cartao_id: null,
      // 'emprestimo' é gravado como 'financiamento' (mesmo CHECK/selo), evitando
      // migração extra; o acompanhamento é idêntico.
      tipo: tipo === 'emprestimo' ? 'financiamento' : tipo,
    }

    // Dados do contrato (opcionais) — habilitam o registro de amortizações.
    if (ehFinanciavel && form.temContrato) {
      const taxaN = parseFloat(String(form.taxa).replace(',', '.')) || 0
      const iMensal = form.taxaPeriodo === 'anual' ? taxaAnualParaMensal(taxaN) : taxaN / 100
      const saldoN = Number(form.saldoDevedor) || 0
      const prazoN = Math.max(0, parseInt(form.prazoRestante, 10) || restantes)
      if (saldoN > 0 && iMensal > 0 && prazoN > 0) {
        payload.saldo_devedor = saldoN
        payload.taxa_mensal = iMensal
        payload.sistema = form.sistema
        payload.prazo_restante = prazoN
        payload.valor_prestacao = valorParcelaNum
        payload.saldo_data = form.saldoData
      }
    }

    onSalvar(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Descrição</label>
        <input name="descricao" value={form.descricao} onChange={handleChange}
          className="input" placeholder={meta.placeholder} required />
      </div>

      <div>
        <label className="label">Categoria</label>
        <div className="grid grid-cols-3 gap-2">
          {[{ id: 'imovel', nome: '🏠 Imóvel' }, { id: 'veiculo', nome: '🚗 Veículo' }, { id: 'outros', nome: '📦 Outros' }].map(op => (
            <button key={op.id} type="button" onClick={() => setForm(p => ({ ...p, categoriaTipo: op.id }))}
              className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                form.categoriaTipo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
              }`}>
              {op.nome}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Valor da parcela (R$)</label>
          <InputMoeda valor={form.valorParcela}
            onChangeValor={(n) => setForm(p => ({ ...p, valorParcela: n }))}
            className="input" />
        </div>
        <div>
          <label className="label">Qtd. total de parcelas</label>
          <input name="numeroParcelas" value={form.numeroParcelas} onChange={handleChange}
            type="number" min="1" max="600" inputMode="numeric" className="input" />
        </div>
      </div>

      <div>
        <label className="label">Data do 1º vencimento</label>
        <input name="primeiroVencimento" value={form.primeiroVencimento} onChange={handleChange}
          type="date" className="input" required />
        <p className="text-xs text-gray-400 mt-1">
          Para contratos já em andamento, informe a data original — as parcelas decorridas são calculadas automaticamente, sem lançar valores retroativos.
        </p>
      </div>

      {/* Dados do contrato (opcional) — habilitam registrar amortizações.
          Apenas para financiamento/empréstimo (consórcio não tem SAC/PRICE). */}
      {ehFinanciavel && (
        <div className="rounded-xl border border-gray-200 p-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" name="temContrato" checked={form.temContrato}
              onChange={(e) => setForm(p => ({ ...p, temContrato: e.target.checked }))} className="mt-0.5" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900">Dados do contrato (para amortização)</span>
              <span className="block text-xs text-gray-500 mt-0.5">
                Opcional. Informe o saldo devedor e a taxa atuais para registrar amortizações e recalcular o cronograma.
              </span>
            </span>
          </label>

          {form.temContrato && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Saldo devedor atual (R$)</label>
                  <InputMoeda valor={form.saldoDevedor}
                    onChangeValor={(n) => setForm(p => ({ ...p, saldoDevedor: n }))} className="input" prefixo={null} />
                </div>
                <div>
                  <label className="label">Prazo restante (meses)</label>
                  <input name="prazoRestante" value={form.prazoRestante} onChange={handleChange}
                    type="number" min="1" inputMode="numeric" className="input" placeholder={String(restantes)} />
                </div>
              </div>
              <div>
                <label className="label">Taxa de juros do contrato</label>
                <div className="flex gap-2">
                  <input name="taxa" value={form.taxa} onChange={handleChange}
                    type="text" inputMode="decimal" className="input flex-1" placeholder={form.taxaPeriodo === 'mensal' ? 'Ex: 0,9' : 'Ex: 11,5'} />
                  <div className="flex gap-1 flex-shrink-0">
                    {[{ id: 'mensal', nome: 'a.m.' }, { id: 'anual', nome: 'a.a.' }].map(op => (
                      <button key={op.id} type="button" onClick={() => setForm(p => ({ ...p, taxaPeriodo: op.id }))}
                        className={`px-3 rounded-xl text-sm font-medium border-2 transition-all ${
                          form.taxaPeriodo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                        }`}>
                        {op.nome}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Sistema</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[{ id: 'sac', nome: 'SAC' }, { id: 'price', nome: 'PRICE' }].map(op => (
                      <button key={op.id} type="button" onClick={() => setForm(p => ({ ...p, sistema: op.id }))}
                        className={`p-2 rounded-xl border-2 text-sm font-medium transition-all ${
                          form.sistema === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                        }`}>
                        {op.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Data de referência</label>
                  <input name="saldoData" value={form.saldoData} onChange={handleChange} type="date" className="input" />
                </div>
              </div>
              <p className="text-xs text-gray-400">
                A prestação atual usada será o valor da parcela informado acima.
              </p>
            </div>
          )}
        </div>
      )}

      {valorTotal > 0 && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-600 space-y-0.5">
          <div className="flex justify-between"><span>Parcela</span><strong>{formatCurrency(valorParcelaNum)}/mês</strong></div>
          <div className="flex justify-between"><span>Decorridas</span><strong>{decorridas} de {totalParcelas}</strong></div>
          <div className="flex justify-between"><span>Restantes</span><strong>{restantes}</strong></div>
          <div className="flex justify-between"><span>Valor total</span><strong>{formatCurrency(valorTotal)}</strong></div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
        <button type="submit" disabled={carregando}
          className="btn-primary flex-1 flex items-center justify-center gap-2">
          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

// ─── Modal: Nova despesa (seletor de tipo) ou Editar despesa ──────────────────
function ModalNovaDespesa({
  aberto, onFechar, onSalvarVista, onSalvarParcelada,
  salvandoVista, salvandoParcelada, despesaEmEdicao,
}) {
  const editando = !!despesaEmEdicao
  // Tipo de cadastro escolhido (só na criação). 'despesa' cobre comum,
  // parcelada e recorrente (diferenciadas dentro do FormDespesa, como já era).
  const [tipoCad, setTipoCad] = useState('despesa') // despesa | financiamento | emprestimo | consorcio

  // Reseta o seletor ao reabrir o modal de criação.
  useEffect(() => { if (aberto && !editando) setTipoCad('despesa') }, [aberto, editando])

  const ehParcelamentoEspecial = tipoCad === 'financiamento' || tipoCad === 'emprestimo' || tipoCad === 'consorcio'

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={editando ? 'Editar despesa' : 'Nova despesa'}
    >
      {/* Seletor dos tipos de cadastro — só na criação. Comum/Parcelada/
          Recorrente continuam no FormDespesa (sem mudar o fluxo existente);
          Financiamento/Consórcio usam o formulário dedicado. */}
      {!editando && (
        <div className="mb-4">
          <label className="label">Tipo de cadastro</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { id: 'despesa', nome: 'Despesa' },
              { id: 'financiamento', nome: 'Financiamento' },
              { id: 'emprestimo', nome: 'Empréstimo' },
              { id: 'consorcio', nome: 'Consórcio' },
            ].map(op => (
              <button key={op.id} type="button" onClick={() => setTipoCad(op.id)}
                className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  tipoCad === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                }`}>
                {op.nome}
              </button>
            ))}
          </div>
          {tipoCad === 'despesa' && (
            <p className="text-xs text-gray-400 mt-1.5">
              Comum, parcelada (no cartão) ou recorrente — escolha dentro do formulário abaixo.
            </p>
          )}
        </div>
      )}

      {!editando && ehParcelamentoEspecial ? (
        <FormFinanciamentoConsorcio
          key={tipoCad}
          tipo={tipoCad}
          onSalvar={onSalvarParcelada}
          onCancelar={onFechar}
          carregando={salvandoParcelada}
        />
      ) : (
        <FormDespesa
          key={editando ? despesaEmEdicao.id : 'nova'}
          onSalvarVista={onSalvarVista}
          onSalvarParcelada={onSalvarParcelada}
          onCancelar={onFechar}
          carregando={editando ? salvandoVista : (salvandoVista || salvandoParcelada)}
          despesaInicial={editando ? despesaEmEdicao : undefined}
          textoBotao={editando ? 'Salvar alterações' : 'Salvar despesa'}
        />
      )}
    </Modal>
  )
}

// ─── Formulário: Registrar amortização realizada ──────────────────────────────
// Não altera dados ao abrir — só grava após confirmação explícita. Mostra uma
// prévia do recálculo (SAC/PRICE) e a origem do recurso (FGTS não deduz saldo).
function FormRegistrarAmortizacao({ parcelamento, onConfirmar, onCancelar, salvando }) {
  const p = parcelamento
  const ehImovel = (p.categorias?.nome || '').toLowerCase().includes('morad')
  const [data, setData] = useState(hojeISO())
  const [valor, setValor] = useState('')
  const [modo, setModo] = useState('prazo')     // prazo | parcela
  const [origem, setOrigem] = useState('saldo') // saldo | reserva | fgts
  const [confirmando, setConfirmando] = useState(false)

  const valorNum = Number(valor) || 0
  // Prévia do recálculo (pura; não grava nada).
  const previa = valorNum > 0
    ? amortizarSaldoDevedor({
        sistema: p.sistema, saldo: Number(p.saldo_devedor), i: Number(p.taxa_mensal),
        n: Number(p.prazo_restante), extra: valorNum, modo,
      })
    : null

  const ORIGENS = [
    { id: 'saldo', nome: '💳 Saldo em conta' },
    { id: 'reserva', nome: '🛟 Reserva' },
    ...(ehImovel ? [{ id: 'fgts', nome: '🏦 FGTS' }] : []),
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {p.descricao} — saldo devedor atual <strong>{formatCurrency(p.saldo_devedor)}</strong> ({p.sistema?.toUpperCase()}, {p.prazo_restante} parcelas)
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Data da amortização</label>
          <input type="date" value={data} onChange={(e) => { setData(e.target.value); setConfirmando(false) }} className="input" />
        </div>
        <div>
          <label className="label">Valor amortizado (R$)</label>
          <InputMoeda valor={valor} onChangeValor={(n) => { setValor(n); setConfirmando(false) }} className="input" prefixo={null} />
        </div>
      </div>

      <div>
        <label className="label">Estratégia</label>
        <div className="grid grid-cols-2 gap-2">
          {[{ id: 'prazo', nome: 'Reduzir prazo' }, { id: 'parcela', nome: 'Reduzir parcela' }].map(op => (
            <button key={op.id} type="button" onClick={() => { setModo(op.id); setConfirmando(false) }}
              className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                modo === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
              }`}>
              {op.nome}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Origem do recurso</label>
        <div className="grid grid-cols-3 gap-2">
          {ORIGENS.map(op => (
            <button key={op.id} type="button" onClick={() => setOrigem(op.id)}
              className={`p-2 rounded-xl border-2 text-xs font-medium transition-all ${
                origem === op.id ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
              }`}>
              {op.nome}
            </button>
          ))}
        </div>
        {origem === 'fgts' && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
            FGTS depende de elegibilidade. Não será descontado do seu saldo bancário.
          </p>
        )}
      </div>

      {/* Prévia do recálculo */}
      {previa && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-gray-500">Saldo depois</span><strong>{formatCurrency(previa.saldoDepois)}</strong></div>
          {previa.quitacaoTotal ? (
            <p className="text-emerald-600 font-medium">Quita o contrato por completo.</p>
          ) : modo === 'prazo' ? (
            <div className="flex justify-between"><span className="text-gray-500">Novo prazo</span><strong>{previa.prazoDepois} meses (−{previa.mesesEconomizados})</strong></div>
          ) : (
            <div className="flex justify-between"><span className="text-gray-500">Nova prestação</span><strong>{formatCurrency(previa.prestacaoDepois)}</strong></div>
          )}
          <div className="flex justify-between"><span className="text-gray-500">Economia de juros</span><strong className="text-emerald-600">{formatCurrency(previa.economiaJuros)}</strong></div>
        </div>
      )}

      {!confirmando ? (
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>
          <button type="button" disabled={valorNum <= 0} onClick={() => setConfirmando(true)}
            className="btn-primary flex-1 disabled:opacity-60">Revisar e registrar</button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Confirmar o registro de {formatCurrency(valorNum)} em {formatDate(data)}? Isso atualiza o saldo devedor e o cronograma. Esta ação pode ser revertida apenas por edição.
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmando(false)} className="btn-secondary flex-1">Voltar</button>
            <button type="button" disabled={salvando}
              onClick={() => onConfirmar({ data, valor: valorNum, modo, origem })}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
              {salvando ? <><Loader2 size={15} className="animate-spin" /> Registrando...</> : 'Confirmar registro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inteligência financeira: somente leitura, nenhum dado é alterado ───────
const CATEGORIAS_REVISAVEIS = /lazer|entretenimento|restaurante|delivery|assinatura|streaming|compras|vestuário|vestuario|shopping|viagem|supérfluo|superfluo|beleza/i
const DESPESAS_PROTEGIDAS = /aluguel|moradia|condom[ií]nio|financiamento|empr[eé]stimo|cons[oó]rcio|escola|faculdade|educa[cç][aã]o|energia|[aá]gua|g[aá]s|sa[uú]de|rem[eé]dio|seguro|imposto|ipva|transporte|mercado|supermercado|alimenta[cç][aã]o/i

function ResumoInteligenteDespesas({ despesas, parcelasDoMes, tipoNoMes, anoMesAtual, totalFixas, totalVariaveis, totalGeral, carregando }) {
  const [mostrarDetalhes, setMostrarDetalhes] = useState(false)
  const [mostrarSimulador, setMostrarSimulador] = useState(false)
  const { usuario } = useAuth()
  const [meta, setMeta] = useState(null)
  const [metaValor, setMetaValor] = useState('')
  const [referenciaValor, setReferenciaValor] = useState('')
  const [salvandoMeta, setSalvandoMeta] = useState(false)
  const [carregandoMeta, setCarregandoMeta] = useState(true)
  const [erroMeta, setErroMeta] = useState('')
  const [avisoMeta, setAvisoMeta] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregarMeta() {
      setCarregandoMeta(true)
      setErroMeta('')
      setMeta(null)
      setMetaValor('')
      setReferenciaValor('')
      if (!usuario?.id) { setCarregandoMeta(false); return }
      const { data, error } = await supabase
        .from('metas_economia_mensal')
        .select('meta_valor, referencia_valor')
        .eq('usuario_id', usuario.id)
        .eq('competencia', anoMesAtual)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        console.error('[Meta economia] Erro ao carregar', error)
        setErroMeta('Não foi possível carregar a meta. Confira a tabela no Supabase.')
      } else if (data) {
        setMeta(data)
        setMetaValor(String(data.meta_valor))
        setReferenciaValor(String(data.referencia_valor))
      }
      setCarregandoMeta(false)
    }
    carregarMeta()
    return () => { ativo = false }
  }, [usuario?.id, anoMesAtual])

  async function salvarMeta(e) {
    e.preventDefault()
    if (!usuario?.id) { setErroMeta('Faça login para salvar a meta.'); return }
    const alvo = Number(metaValor)
    const base = Number(referenciaValor)
    if (!metaValor.trim() || !referenciaValor.trim() || !Number.isFinite(alvo) || !Number.isFinite(base) || alvo <= 0 || base <= 0 || alvo > base) {
      setErroMeta('Informe uma referência maior que zero e uma meta de economia entre R$ 0,01 e a referência.')
      return
    }
    setSalvandoMeta(true)
    setErroMeta('')
    setAvisoMeta('')
    const payload = {
      usuario_id: usuario.id,
      competencia: anoMesAtual,
      meta_valor: alvo,
      referencia_valor: base,
    }
    const { data, error } = await supabase
      .from('metas_economia_mensal')
      .upsert(payload, { onConflict: 'usuario_id,competencia' })
      .select('meta_valor, referencia_valor')
      .single()
    setSalvandoMeta(false)
    if (error) {
      console.error('[Meta economia] Erro ao salvar', error)
      setErroMeta(`Não foi possível salvar: ${error.message}`)
      return
    }
    setMeta(data)
    setAvisoMeta('Meta salva para este mês.')
    setMostrarSimulador(false)
  }

  if (carregando) return null

  const pctF = totalGeral > 0 ? (totalFixas / totalGeral) * 100 : 0
  const pctV = totalGeral > 0 ? (totalVariaveis / totalGeral) * 100 : 0
  const grupos = new Map()
  const adicionar = (nome, valor) => {
    const chave = nome?.trim() || 'Sem categoria'
    grupos.set(chave, (grupos.get(chave) || 0) + (Number(valor) || 0))
  }
  despesas.forEach(d => adicionar(d.categorias?.nome, d.valor))
  parcelasDoMes.forEach(({ parcelamento: p, valor }) => adicionar(p.categorias?.nome, valor))
  const maiorCategoria = [...grupos.entries()].sort((a,b) => b[1] - a[1])[0]

  // Uma despesa variável NÃO é necessariamente dispensável. Só usamos itens
  // com categoria/nome explicitamente revisável e excluímos obrigações.
  const revisaveis = despesas.filter(d => {
    if (tipoNoMes(d, anoMesAtual) === 'fixa') return false
    const categoria = String(d.categorias?.nome || '')
    const nome = String(d.descricao || '')
    return CATEGORIAS_REVISAVEIS.test(categoria + ' ' + nome) &&
      !DESPESAS_PROTEGIDAS.test(categoria + ' ' + nome)
  })
  const totalRevisavel = revisaveis.reduce((s, d) => s + Math.max(0, Number(d.valor) || 0), 0)
  const economiaEstimada = Math.round(totalRevisavel * 0.20 * 100) / 100
  // Não contabilizar gastos essenciais como passíveis de corte.
  // O valor abaixo considera apenas despesas à vista e categorias revisáveis;
  // parcelas são omitidas intencionalmente para evitar prometer economia fictícia.
  const baseSalva = Number(meta?.referencia_valor || 0)
  const alvoSalvo = Number(meta?.meta_valor || 0)
  const tetoGastos = Math.max(0, baseSalva - alvoSalvo)
  const diferencaComparativa = baseSalva > 0 ? baseSalva - totalRevisavel : 0
  const dentroDoLimite = !!meta && totalRevisavel <= tetoGastos
  const progressoOrcamento = meta && tetoGastos > 0
    ? Math.min(100, (totalRevisavel / tetoGastos) * 100)
    : 0
  const nomesRevisaveis = [...new Set(revisaveis.map(d => d.categorias?.nome || d.descricao))].slice(0, 2)
  const sugestoes = [
    ...nomesRevisaveis.map(nome => `Revise seus gastos com ${nome.toLowerCase()}.`),
    ...(parcelasDoMes.some(x => /empr[eé]stimo|financiamento/i.test(x.parcelamento?.descricao || '')) || despesas.some(d => /empr[eé]stimo|financiamento/i.test(d.descricao || ''))
      ? ['Considere comparar condições de renegociação dos empréstimos; verifique juros e custo total.'] : []),
    'Antecipe pagamentos apenas quando houver benefício real e dinheiro disponível.'
  ].slice(0, 3)

  return (
    <section className="card min-w-0 overflow-hidden !p-4 sm:!p-5 border border-marca/25" aria-label="Resumo inteligente do mês">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-marca-100 flex items-center justify-center"><Lightbulb size={19} className="text-marca" /></div>
          <div><h2 className="text-base sm:text-lg font-bold text-gray-900">Resumo inteligente do mês</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Entenda seus gastos e descubra oportunidades de economia.</p></div>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 md:min-w-60">
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold"><Target size={16} /> Meta de economia mensal</div>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">{meta ? formatCurrency(alvoSalvo) : 'Ainda não definida'}</p>
          <p className="text-xs text-emerald-800 mt-1">{meta ? `Limite para gastos revisáveis: ${formatCurrency(tetoGastos)}` : 'Defina uma meta personalizada em reais.'}</p>
          <button type="button" onClick={() => setMostrarSimulador(v => !v)}
            aria-expanded={mostrarSimulador}
            className="mt-2 rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-800">
            {mostrarSimulador ? 'Fechar' : meta ? 'Editar meta' : 'Criar meta'}
          </button>
        {mostrarSimulador && (
          <form onSubmit={salvarMeta} className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Definir meta para {anoMesAtual}</h3>
            <p className="text-xs text-gray-600">Use como referência quanto costuma gastar por mês com lazer, delivery, compras e outras despesas opcionais. Não inclua saúde, alimentação necessária ou contas obrigatórias.</p>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-xs font-medium text-gray-700">Referência mensal (R$)
                <input type="number" min="0.01" step="0.01" value={referenciaValor} onChange={e => setReferenciaValor(e.target.value)} required placeholder="Ex.: 500" className="input mt-1 w-full" />
              </label>
              <label className="text-xs font-medium text-gray-700">Quero economizar (R$)
                <input type="number" min="0.01" step="0.01" value={metaValor} onChange={e => setMetaValor(e.target.value)} required placeholder="Ex.: 100" className="input mt-1 w-full" />
              </label>
            </div>
            <p className="text-xs text-gray-600">Limite de gastos proposto: <strong>{formatCurrency(Math.max(0, (Number(referenciaValor) || 0) - (Number(metaValor) || 0)))}</strong></p>
            <button type="submit" disabled={salvandoMeta} className="btn-primary disabled:opacity-50">{salvandoMeta ? 'Salvando...' : 'Salvar meta do mês'}</button>
          </form>
        )}
        </div>
      </div>
      {erroMeta && <p role="alert" className="text-xs text-red-700 mt-3">{erroMeta}</p>}
      {avisoMeta && <p role="status" className="text-xs text-emerald-700 mt-3">{avisoMeta}</p>}
      {carregandoMeta && <p className="text-xs text-gray-500 mt-3">Carregando meta salva...</p>}
      {!!meta && !carregandoMeta && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2">
          <div className="flex justify-between text-sm gap-2"><span>Gastos revisáveis registrados neste mês</span><strong>{formatCurrency(totalRevisavel)}</strong></div>
          <div className="flex justify-between text-sm gap-2"><span>Limite mensal definido</span><strong>{formatCurrency(tetoGastos)}</strong></div>
          <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden"><div className={dentroDoLimite ? 'h-full bg-emerald-600' : 'h-full bg-amber-500'} style={{ width: `${tetoGastos === 0 ? 100 : progressoOrcamento}%` }} /></div>
          <p className={`text-xs font-medium ${dentroDoLimite ? 'text-emerald-700' : 'text-amber-700'}`}>
            {dentroDoLimite ? `Restam ${formatCurrency(tetoGastos - totalRevisavel)} no limite de gastos revisáveis.` : `Limite excedido em ${formatCurrency(totalRevisavel - tetoGastos)}.`}
          </p>
          <p className="text-xs text-gray-500">Diferença em relação à referência: {formatCurrency(diferencaComparativa)}. Comparação parcial do mês, não representa dinheiro guardado. Confira também despesas recorrentes e parcelas antes de avaliar sua economia real.</p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-4 mt-5">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-gray-50 px-5 py-4">
          <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(var(--cor-marca, #3b82f6) 0% ${pctF}%, #a78bfa ${pctF}% 100%)` }}>
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white flex flex-col items-center justify-center text-center p-1">
              <strong className="text-sm text-gray-900 break-words">{formatCurrency(totalGeral)}</strong>
              <span className="text-xs text-gray-500">total do mês</span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">Proporção entre despesas fixas e variáveis</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 content-center">
          <div className="rounded-xl bg-gray-50 p-3 min-w-0"><p className="text-xs text-gray-500">Fixas</p><p className="text-xl font-bold text-gray-900">{Math.round(pctF)}%</p><p className="text-xs text-gray-500 break-words">{formatCurrency(totalFixas)}</p><div className="h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden"><div className="h-full bg-marca rounded-full" style={{ width: `${pctF}%` }} /></div></div>
          <div className="rounded-xl bg-gray-50 p-3 min-w-0"><p className="text-xs text-gray-500">Variáveis</p><p className="text-xl font-bold text-gray-900">{Math.round(pctV)}%</p><p className="text-xs text-gray-500 break-words">{formatCurrency(totalVariaveis)}</p><div className="h-1.5 bg-gray-200 rounded-full mt-3 overflow-hidden"><div className="h-full bg-purple-400 rounded-full" style={{ width: `${pctV}%` }} /></div></div>
          <div className="rounded-xl bg-gray-50 p-3 min-w-0"><p className="text-xs text-gray-500">Maior categoria</p><p className="text-sm font-bold text-gray-900 break-words mt-2">{maiorCategoria?.[0] || 'Não identificada'}</p><p className="text-xs text-gray-500 mt-1">{formatCurrency(maiorCategoria?.[1] || 0)}</p></div>
        </div>
      </div>
      <div className="mt-5 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between gap-2"><h3 className="font-semibold text-sm text-gray-900">Onde economizar</h3>
          <button type="button" onClick={() => setMostrarDetalhes(x => !x)} className="text-xs font-semibold text-marca hover:underline">{mostrarDetalhes ? 'Menos detalhes' : 'Como calculamos?'}</button></div>
        {totalGeral <= 0 ? <p className="text-sm text-gray-500 mt-2">Cadastre despesas para receber orientações.</p> : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
            {(sugestoes.length ? sugestoes : ['Acompanhe seus gastos para encontrar oportunidades de redução.']).map((s,i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex gap-2 items-start"><ArrowDownRight size={17} className="text-marca shrink-0 mt-0.5" /><p className="text-xs text-gray-700 leading-relaxed">{s}</p></div>
            ))}
          </div>
        )}
        {totalRevisavel === 0 && totalGeral > 0 && <p className="text-xs text-gray-500 mt-3">Ainda não identificamos gastos discricionários suficientes para estimar uma economia. Zero não significa ausência de oportunidades.</p>}
        {mostrarDetalhes && <p className="text-xs text-gray-500 mt-3 leading-relaxed">A identificação automática de oportunidades usa despesas variáveis à vista de categorias potencialmente revisáveis e aplica 20% sobre elas. A meta salva compara esses gastos com uma referência definida por você; não mede saldo guardado. Despesas recorrentes e parcelas podem não estar incluídas nessa comparação. Obrigações, empréstimos, financiamentos e parcelas não são tratados como cortes disponíveis. Os percentuais do gráfico são calculados sobre o total de despesas deste mês, não sobre a renda.</p>}
      </div>
    </section>
  )
}

// Resumo somente leitura da meta salva. O formulário continua na aba Análises.
function ResumoMetaEconomia({ competencia, onAbrir }) {
  const { usuario } = useAuth()
  const [meta, setMeta] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro(false)
      setMeta(null)
      if (!usuario?.id) {
        if (ativo) setCarregando(false)
        return
      }
      const { data, error } = await supabase
        .from('metas_economia_mensal')
        .select('meta_valor, referencia_valor')
        .eq('usuario_id', usuario.id)
        .eq('competencia', competencia)
        .maybeSingle()
      if (!ativo) return
      if (error) {
        console.error('[Despesas] Falha ao carregar resumo da meta:', error)
        setErro(true)
      } else {
        setMeta(data)
      }
      setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [usuario?.id, competencia])

  const alvo = Number(meta?.meta_valor) || 0
  const referencia = Number(meta?.referencia_valor) || 0
  const limite = Math.max(0, referencia - alvo)

  return (
    <section className="card !p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Target size={17} className="text-emerald-600" />
        <h2 className="text-sm font-semibold text-gray-900">Meta de economia mensal</h2>
      </div>
      {carregando ? (
        <p className="text-xs text-gray-500">Carregando meta...</p>
      ) : erro ? (
        <p className="text-xs text-amber-700">Não foi possível consultar a meta. Confira em Análises.</p>
      ) : meta ? (
        <>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(alvo)}</p>
          <p className="text-xs text-gray-600">Referência: {formatCurrency(referencia)}</p>
          <p className="text-xs text-gray-600">Limite proposto de gastos revisáveis: <strong>{formatCurrency(limite)}</strong></p>
        </>
      ) : (
        <p className="text-xs text-gray-500">Nenhuma meta cadastrada para este mês.</p>
      )}
      <button type="button" onClick={onAbrir} className="text-sm font-semibold text-marca hover:underline">
        {meta ? 'Consultar ou editar meta →' : 'Criar minha meta →'}
      </button>
    </section>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Despesas() {
  const {
    despesas, total, carregando, criar, atualizar, remover, alterarTipo,
    anteciparPagamento, desfazerAntecipacao,
  } = useDespesas(mesAtual, anoAtual)
  // Consulta independente: permite conferir despesas salvas em qualquer mês.
  const { despesas: todosCadastros, carregando: carregandoTodos, recarregar: recarregarTodos } = useDespesas()
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
    registrarAmortizacao,
  } = useParcelamentos()
  const { resumoMes } = useProjecao()
  const { cartoes } = useCartoes()

  const [filtro, setFiltro] = useState('Todas')
  const [pagina, setPagina] = useState('visao')
  const [ordemDespesas, setOrdemDespesas] = useState('maior')
  const [ordemParceladas, setOrdemParceladas] = useState('maior_saldo')
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [salvandoParc, setSalvandoParc] = useState(false)
  const [removendo, setRemovendo] = useState(null)
  const [removendoParc, setRemovendoParc] = useState(null)
  const [quitando, setQuitando] = useState(null)
  const [erroAcao, setErroAcao] = useState('')
  const [avisoSalvo, setAvisoSalvo] = useState('')
  const [mostrarTodosCadastros, setMostrarTodosCadastros] = useState(false)
  const [ultimaDespesa, setUltimaDespesa] = useState(null)
  const [mostrarConcluidos, setMostrarConcluidos] = useState(false)
  const [despesaEditando, setDespesaEditando] = useState(null) // null = modo criação
  const [parcelamentoEditando, setParcelamentoEditando] = useState(null)
  const [parcelamentoAmortizar, setParcelamentoAmortizar] = useState(null)
  const [parcelamentoRegistrar, setParcelamentoRegistrar] = useState(null)
  const [registrandoAmort, setRegistrandoAmort] = useState(false)
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
  const abas = ['Todas', 'Fixas', 'Variáveis']

  // Registros originais com data em mês posterior ao mês do resumo.
  // Não cria ocorrências de recorrência e não altera os totais do mês.
  const fimMesAtual = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-${String(new Date(anoAtual, mesAtual, 0).getDate()).padStart(2, '0')}`
  const despesasFuturas = todosCadastros
    .filter(d => d.data && d.data > fimMesAtual)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR'))

  // Despesas (à vista) filtradas conforme a aba — usa o tipo do MÊS (exceção
  // mensal quando existir), para o filtro bater com o rótulo exibido.
  const despesasVisiveis = (() => {
    if (filtro === 'Fixas') return despesas.filter(d => tipoNoMes(d, anoMesAtual) === 'fixa')
    if (filtro === 'Variáveis') return despesas.filter(d => tipoNoMes(d, anoMesAtual) !== 'fixa')
    if (filtro === 'Parceladas' || filtro === 'Futuras') return [] // abas dedicadas
    return despesas // Todas
  })()

  // Parcelas do mês exibidas como linhas nas abas Todas/Fixas/Variáveis
  const parcelasVisiveis = (() => {
    if (filtro === 'Parceladas' || filtro === 'Futuras') return [] // abas dedicadas
    if (filtro === 'Fixas') return parcelasDoMes.filter(x => x.tipo_despesa === 'fixa')
    if (filtro === 'Variáveis') return parcelasDoMes.filter(x => x.tipo_despesa !== 'fixa')
    return parcelasDoMes // Todas
  })()

  const mostrarParceladas = filtro === 'Parceladas'
  const totalLinhas = despesasVisiveis.length + parcelasVisiveis.length
  // Unifica as linhas para que a ordenação funcione entre despesas e parcelas.
  // Os valores abaixo são apenas de exibição; não alteram os hooks nem o banco.
  const linhasOrdenadas = [
    ...despesasVisiveis.map(d => ({ chave: `desp-${d.id}`, tipo: 'despesa', dados: d, valor: Number(d.valor) || 0, data: d.data || '' })),
    ...parcelasVisiveis.map(x => ({ chave: `parc-${x.parcelamento.id}`, tipo: 'parcela', dados: x, valor: Number(x.valor) || 0, data: x.parcelamento.primeira_parcela || '' })),
  ].sort((a, b) => {
    if (ordemDespesas === 'maior') return b.valor - a.valor
    if (ordemDespesas === 'menor') return a.valor - b.valor
    if (ordemDespesas === 'vencimento') return (a.data || '9999').localeCompare(b.data || '9999')
    if (ordemDespesas === 'vencimento_desc') return (b.data || '').localeCompare(a.data || '')
    return 0
  })
  const totalFiltrado = linhasOrdenadas.reduce((s, linha) => s + linha.valor, 0)
  const parcelamentosOrdenados = [...parcAtivos].sort((a, b) => {
    if (ordemParceladas === 'maior_saldo') return (Number(b.valorRestante) || 0) - (Number(a.valorRestante) || 0)
    if (ordemParceladas === 'menor_saldo') return (Number(a.valorRestante) || 0) - (Number(b.valorRestante) || 0)
    if (ordemParceladas === 'maior_parcela') return (Number(valorParcelaNoMes(b, anoAtual, mesAtual)) || 0) - (Number(valorParcelaNoMes(a, anoAtual, mesAtual)) || 0)
    return (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR')
  })

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
    setAvisoSalvo('')
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
      await recarregarTodos().catch(e => console.warn('Falha ao atualizar histórico:', e))
      const mesRegistro = dados.data?.slice(0, 7)
      setAvisoSalvo(mesRegistro && mesRegistro !== anoMesAtual
        ? `Despesa salva. A data é ${dados.data}; este resumo exibe apenas ${nomeMes}. Confira em "Próximas despesas" abaixo.`
        : 'Despesa salva no banco. Você pode conferir em "Todos os cadastros" abaixo.')
      fecharModal()
    } catch (e) {
      console.error('[Despesas] Erro ao salvar:', e)
      setErroAcao(`Não foi possível salvar: ${e?.message || 'erro desconhecido'}`)
    } finally {
      setSalvando(false)
    }
  }

  async function handleRemover(id) {
    if (!confirm('Remover esta despesa?')) return
    setRemovendo(id)
    try {
      await remover(id)
      await recarregarTodos().catch(e => console.warn('Falha ao atualizar histórico:', e))
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
    } catch (e) {
      console.error('[Despesas] Erro ao salvar parcelamento:', e)
      setErroAcao(`Erro ao salvar parcelamento: ${e?.message || 'erro desconhecido'}`)
    } finally {
      setSalvandoParc(false)
    }
  }

  // Edição de parcelamento (modal próprio)
  function handleEditarParc(p) {
    setParcelamentoEditando(p)
  }

  // Registrar amortização realizada (atualiza contrato + histórico).
  async function handleConfirmarRegistroAmort(dados) {
    if (!parcelamentoRegistrar) return
    setRegistrandoAmort(true)
    setErroAcao('')
    try {
      await registrarAmortizacao(parcelamentoRegistrar, dados)
      setParcelamentoRegistrar(null)
    } catch (e) {
      setErroAcao(e?.message === 'DADOS_INSUFICIENTES'
        ? 'Faltam dados do contrato (saldo, taxa, sistema e prazo). Edite o financiamento e informe-os.'
        : 'Erro ao registrar a amortização. Tente novamente.')
    } finally {
      setRegistrandoAmort(false)
    }
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
    <div className="space-y-6 pb-mobilenav md:pb-0">
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

      {/* Três cards de resumo. No celular: 2 colunas + "Total do mês" ocupando a
          linha inteira (evita apertar valores grandes e transbordar). A partir de
          sm: os três lado a lado. break-words + padding menor no mobile. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card min-w-0 !p-4 sm:!p-5 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center mb-2">
            <TrendingDown size={16} className="text-red-500" />
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Total do mês</p>
          <p className="text-lg font-bold text-gray-900 leading-tight break-words">{formatCurrency(totalGeral)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {despesas.length} à vista
            {parcelasDoMes.length > 0 ? ` + ${parcelasDoMes.length} parcela${parcelasDoMes.length !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="card min-w-0 !p-4 sm:!p-5">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">📌</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Fixas</p>
          <p className="text-lg font-bold text-blue-700 leading-tight break-words">{formatCurrency(totalFixas)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-blue-500 mt-0.5">{pctFixas}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
        <div className="card min-w-0 !p-4 sm:!p-5">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center mb-2">
            <span className="text-sm">🛒</span>
          </div>
          <p className="text-xs text-gray-500 mb-0.5">Variáveis</p>
          <p className="text-lg font-bold text-gray-700 leading-tight break-words">{formatCurrency(totalVariaveis)}</p>
          {receitaBase > 0
            ? <p className="text-xs text-gray-500 mt-0.5">{pctVariaveis}% da renda</p>
            : <p className="text-xs text-gray-400 mt-0.5">—</p>}
        </div>
      </div>

      {/* Navegação compacta por áreas. Os valores e as operações permanecem nos hooks existentes. */}
      <nav aria-label="Seções de despesas" className="card !p-2 flex items-center gap-1.5 overflow-x-auto">
        {[
          ['visao', 'Visão geral'], ['mes', 'Despesas do mês'],
          ['futuras', 'Futuras'], ['parceladas', 'Parceladas'], ['analises', 'Análises'],
        ].map(([id, rotulo]) => (
          <button key={id} type="button" onClick={() => setPagina(id)}
            aria-current={pagina === id ? 'page' : undefined}
            className={`shrink-0 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors ${pagina === id ? 'bg-marca text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
            {rotulo}{id === 'futuras' && despesasFuturas.length ? ` (${despesasFuturas.length})` : ''}
          </button>
        ))}
      </nav>

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

      {avisoSalvo && (
        <p role="status" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">{avisoSalvo}</p>
      )}

      {(pagina === 'visao' || pagina === 'mes') && (
        <div className={pagina === 'visao' ? 'grid grid-cols-1 xl:grid-cols-3 gap-4 items-start' : 'space-y-4'}>
          <div className={pagina === 'visao' ? 'xl:col-span-2 space-y-4' : 'space-y-4'}>
      {/* Abas de filtro */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {abas.map(aba => {
          const qtd = aba === 'Parceladas' ? parcAtivos.length : aba === 'Futuras' ? despesasFuturas.length : null
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
      {filtro !== 'Parceladas' && filtro !== 'Futuras' && (
        <div className="card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                {filtro === 'Todas' ? 'Despesas do mês' : `Despesas ${filtro.toLowerCase()}`}
                <span className="ml-2 text-sm font-normal text-gray-400">({totalLinhas})</span>
              </h2>
              <p className="text-xs text-gray-500 mt-1">Total selecionado: <strong className="text-gray-900">{formatCurrency(totalFiltrado)}</strong></p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Ordenar por
              <select className="input !w-auto !py-2 !text-xs min-w-0" value={ordemDespesas} onChange={e => setOrdemDespesas(e.target.value)} aria-label="Ordenar despesas">
                <option value="maior">Maior valor primeiro</option>
                <option value="menor">Menor valor primeiro</option>
                <option value="vencimento">Vencimento mais próximo</option>
                <option value="vencimento_desc">Vencimento mais distante</option>
              </select>
            </label>
          </div>

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
            <div className="space-y-2">
              {(pagina === 'visao' ? linhasOrdenadas.slice(0, 5) : linhasOrdenadas).map(linha => {
                if (linha.tipo === 'parcela') {
                  const { parcelamento: p, valor, tipo_despesa } = linha.dados
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(tipo_despesa)
                const nomeCategoria = p.categorias?.nome
                return (
                  <div key={`parc-${p.id}`}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-orange-50/50 border border-orange-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
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
                }
                const d = linha.dados
                const nomeCategoria = d.categorias?.nome
                // Tipo exibido respeita a exceção do mês (se houver).
                const tipoExibido = tipoNoMes(d, anoMesAtual)
                const { label: tipoLabel, classes: tipoClasses } = labelTipoDespesa(tipoExibido)
                const tipoOposto = tipoExibido === 'fixa' ? 'variavel' : 'fixa'
                const labelOposto = tipoOposto === 'fixa' ? 'Fixa' : 'Variável'
                return (
                  <div key={d.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group">
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
                          {totalGeral > 0 && (
                            <span className="text-xs text-gray-500" title="Participação desta despesa no total mensal">
                              {Math.round((Number(d.valor) || 0) / totalGeral * 100)}% do total
                            </span>
                          )}
                          {d.recorrente && (
                            <span className="flex items-center gap-1 text-xs text-blue-500">
                              <RefreshCw size={10} />
                              {/* Sem prazo (frequencia 'mensal' sem recorrencia_meses) → "Ativa há X meses".
                                  Com prazo ('por_meses') segue como "Recorrente". */}
                              {(!d.recorrencia_meses && mesesAtiva(d.data) > 0)
                                ? `Ativa há ${mesesAtiva(d.data)} ${mesesAtiva(d.data) === 1 ? 'mês' : 'meses'}`
                                : 'Recorrente'}
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

            {pagina === 'visao' && linhasOrdenadas.length > 5 && (
              <button type="button" onClick={() => setPagina('mes')} className="text-sm font-semibold text-marca hover:underline">
                Ver todas as {linhasOrdenadas.length} despesas do mês →
              </button>
            )}
          </div>
          {pagina === 'visao' && (
            <aside className="space-y-4 min-w-0">
      {/* ─── Antecipar próximos vencimentos ─── */}
      {/* Só aparece quando há despesas com vencimento futuro ainda não pagas. */}
      {!carregando && (proximosVencimentos.length > 0 || despesasFuturas.length > 0) && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={18} className="text-blue-500 flex-shrink-0" />
            <h2 className="text-base font-semibold text-gray-900">Próximos vencimentos</h2>
          </div>
          <div className="space-y-2">
            {proximosVencimentos.slice(0, 5).map(({ despesa: d, diasFaltam }) => (
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
                <div className="flex flex-col items-end gap-1 flex-shrink-0 sm:flex-row sm:items-center sm:gap-2">
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
          {despesasFuturas.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-gray-700">Cadastros de meses seguintes</h3>
                <button type="button" onClick={() => setPagina('futuras')}
                  className="text-xs font-semibold text-marca hover:underline">Ver todos →</button>
              </div>
              {despesasFuturas.slice(0, 2).map(d => (
                <div key={`preview-${d.id}`} className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{d.descricao}</p>
                    <p className="text-xs text-gray-500">{formatDate(d.data)} · Cadastro futuro</p>
                  </div>
                  <span className="text-xs font-semibold text-red-600 whitespace-nowrap">-{formatCurrency(d.valor)}</span>
                </div>
              ))}
              <p className="text-[11px] text-gray-500">Valores de meses seguintes não entram no total atual. Recorrências futuras são projetadas separadamente.</p>
            </div>
          )}
          {pagasAntecipadamente.length > 0 && (
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <CheckCircle2 size={12} className="text-green-500" />
              {pagasAntecipadamente.length} despesa{pagasAntecipadamente.length !== 1 ? 's' : ''} paga{pagasAntecipadamente.length !== 1 ? 's' : ''} antecipadamente neste mês.
            </p>
          )}
        </div>
      )}

              <ResumoMetaEconomia competencia={anoMesAtual} onAbrir={() => setPagina('analises')} />
            </aside>
          )}
        </div>
      )}

      {pagina === 'visao' && (
        <section className="card !p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><Lightbulb size={19} className="text-emerald-600" /></div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Resumo inteligente do mês</h2>
              <p className="text-xs text-gray-500">Confira a distribuição dos gastos e a meta de economia.</p>
            </div>
          </div>
          <button type="button" onClick={() => setPagina('analises')} className="text-sm font-semibold text-marca hover:underline">Ver análises →</button>
        </section>
      )}

      {pagina === 'futuras' && (
        <div className="space-y-4">
      {/* Despesas cadastradas para meses seguintes: visíveis sem afetar o resumo atual. */}
      {true && (
        <section className="card" aria-label="Próximas despesas cadastradas">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={18} className="text-blue-600 flex-shrink-0" />
            <h2 className="text-base font-semibold text-gray-900">
              Próximas despesas <span className="text-sm font-normal text-gray-400">({despesasFuturas.length})</span>
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Lançamentos originais de meses futuros. Não entram no total de {nomeMes}.
            Despesas recorrentes são projetadas separadamente, sem gerar novos cadastros.
          </p>
          {carregandoTodos ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 size={16} className="animate-spin" /> Carregando próximas despesas...
            </div>
          ) : despesasFuturas.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">Nenhuma despesa cadastrada para os próximos meses.</p>
          ) : (
            <div className="space-y-2">
              {despesasFuturas.map(d => (
                <div key={`futura-${d.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-50 flex items-center justify-center">
                      {d.categorias?.icone || <CalendarClock size={16} className="text-blue-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 break-words">{d.descricao}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                        <span><Calendar size={11} className="inline mr-1" />{formatDate(d.data)}</span>
                        <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5">Vence em {new Date(`${d.data}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                        {d.recorrente && <span className="text-blue-600 flex items-center gap-1"><RefreshCw size={11} />Recorrente</span>}
                        {d.categorias?.nome && <span>{d.categorias.nome}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                    <strong className="text-sm text-red-500 whitespace-nowrap">-{formatCurrency(d.valor)}</strong>
                    <button type="button" onClick={() => handleEditar(d)}
                      title="Editar despesa futura" aria-label={`Editar ${d.descricao}`}
                      className="touch-target rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => handleRemover(d.id)} disabled={removendo === d.id}
                      title="Excluir despesa futura" aria-label={`Excluir ${d.descricao}`}
                      className="touch-target rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                      {removendo === d.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

        </div>
      )}

      {pagina === 'parceladas' && (
        <div>
      {/* ─── Seção de parcelamentos ─── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Acompanhamento de parcelas</h2>
              <p className="text-xs text-gray-500 mt-1">Veja compromissos ativos, parcelas restantes e valores futuros.</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              Ordenar por
              <select className="input !w-auto !py-2 !text-xs" value={ordemParceladas} onChange={e => setOrdemParceladas(e.target.value)} aria-label="Ordenar parcelamentos">
                <option value="maior_saldo">Maior saldo restante</option>
                <option value="menor_saldo">Menor saldo restante</option>
                <option value="maior_parcela">Maior parcela neste mês</option>
                <option value="nome">Nome (A–Z)</option>
              </select>
            </label>
          </div>
          {/* Resumo de parcelamentos */}
          {parcAtivos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  {parcelamentosOrdenados.map(p => (
                    <CardParcelamento key={p.id} p={p}
                      onQuitar={handleQuitar} onRemover={handleRemoverParc}
                      onEditar={handleEditarParc} onAmortizar={setParcelamentoAmortizar}
                      onRegistrarAmort={setParcelamentoRegistrar}
                      cartoes={cartoes}
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
        </div>
      )}

      {pagina === 'analises' && (
        <div className="space-y-4">
      {/* Painel inteligente: leitura dos valores existentes, sem persistência */}
      <ResumoInteligenteDespesas
        despesas={despesas}
        parcelasDoMes={parcelasDoMes}
        tipoNoMes={tipoNoMes}
        anoMesAtual={anoMesAtual}
        totalFixas={totalFixas}
        totalVariaveis={totalVariaveis}
        totalGeral={totalGeral}
        carregando={carregando || carregandoParc}
      />

      {/* Conferência de registros originais, inclusive lançamentos de outros meses. */}
      <section className="card">
        <button type="button" onClick={() => setMostrarTodosCadastros(v => !v)}
          className="w-full flex items-center justify-between gap-3 text-left">
          <span className="font-semibold text-gray-900">Todos os cadastros de despesas ({todosCadastros.length})</span>
          {mostrarTodosCadastros ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        <p className="text-xs text-gray-500 mt-1">Consulte registros originais de qualquer mês. Recorrências futuras são calculadas na projeção, não são novos registros.</p>
        {mostrarTodosCadastros && (
          <div className="mt-3 max-h-80 overflow-y-auto space-y-2">
            {carregandoTodos ? <p className="text-sm text-gray-500">Carregando cadastros...</p>
              : todosCadastros.length === 0 ? <p className="text-sm text-gray-500">Nenhum registro encontrado.</p>
              : todosCadastros.map(d => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{d.descricao}</p>
                    <p className="text-xs text-gray-500">{formatDate(d.data)} • {d.frequencia === 'por_meses' ? `Mensal por ${d.recorrencia_meses} meses` : d.recorrente ? (d.frequencia || 'Mensal') : 'Não repete'}</p>
                  </div>
                  <strong className="text-sm shrink-0">{formatCurrency(d.valor)}</strong>
                </div>
              ))}
          </div>
        )}
      </section>

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

      {/* Modal: Simular amortização de um contrato (financiamento/empréstimo) */}
      <Modal
        aberto={!!parcelamentoAmortizar}
        onFechar={() => setParcelamentoAmortizar(null)}
        titulo="Simular amortização"
      >
        {parcelamentoAmortizar && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {parcelamentoAmortizar.descricao} — {parcelamentoAmortizar.parcelasRestantes} parcelas restantes
            </p>
            <SimuladorAmortizacao
              estimado
              mostrarFgts={(parcelamentoAmortizar.categorias?.nome || '').toLowerCase().includes('morad')}
              inicial={{
                // Dados já conhecidos do contrato; a taxa é solicitada (não é
                // armazenada). O saldo devedor parte do saldo restante estimado.
                saldo: Math.round(parcelamentoAmortizar.valorRestante),
                parcelasRestantes: parcelamentoAmortizar.parcelasRestantes,
                prestacao: Math.round(parcelamentoAmortizar.valorParcelaBase || 0),
                sistema: 'price',
              }}
            />
          </div>
        )}
      </Modal>

      {/* Modal: Registrar amortização realizada */}
      <Modal
        aberto={!!parcelamentoRegistrar}
        onFechar={() => setParcelamentoRegistrar(null)}
        titulo="Registrar amortização realizada"
      >
        {parcelamentoRegistrar && (
          <FormRegistrarAmortizacao
            parcelamento={parcelamentoRegistrar}
            onConfirmar={handleConfirmarRegistroAmort}
            onCancelar={() => setParcelamentoRegistrar(null)}
            salvando={registrandoAmort}
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