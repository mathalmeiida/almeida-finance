import React, { useState, useEffect } from 'react'

import { useSearchParams } from 'react-router-dom'

import { TrendingUp, Plus, RefreshCw, Calendar, Trash2, Loader2, Pencil, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'

import { useReceitas } from '../hooks/useReceitas'

import { useCategorias } from '../hooks/useCategorias'

import Modal from '../components/Modal'

import InputMoeda from '../components/InputMoeda'

import { formatCurrency, formatDate, corCategoria, hojeISO, partesHojeBrasil } from '../lib/utils'



const { ano: anoAtual, mes: mesAtual } = partesHojeBrasil()



function FormReceita({ onSalvar, onCancelar, carregando, receitaInicial, textoBotao, dataPadrao }) {

  const { categorias } = useCategorias('receita')

  // Frequência inicial (retrocompatível): usa a coluna "frequencia" quando
  // existir; senão deriva do booleano "recorrente" (mensal/pontual).
  const freqInicial = receitaInicial?.frequencia

    || (receitaInicial == null ? 'mensal' : (receitaInicial.recorrente ? 'mensal' : 'nao_repete'))

  // Término inicial: por nº de ocorrências, por data, ou sem fim.
  const terminoInicial = receitaInicial?.ocorrencias != null ? 'ocorrencias'

    : receitaInicial?.data_fim ? 'data' : 'sem_fim'



  const [form, setForm] = useState({

    descricao: receitaInicial?.descricao ?? '',

    valor: receitaInicial != null ? String(receitaInicial.valor) : '',

    data: receitaInicial?.data ?? dataPadrao ?? hojeISO(),

    categoria: receitaInicial?.categoria ?? '',

    frequencia: freqInicial,

    // intervalo em meses (só para "personalizado")
    recorrencia_meses: receitaInicial?.recorrencia_meses != null ? String(receitaInicial.recorrencia_meses) : '2',

    termino: terminoInicial,

    ocorrencias: receitaInicial?.ocorrencias != null ? String(receitaInicial.ocorrencias) : '12',

    data_fim: receitaInicial?.data_fim ?? '',

  })



  function handleChange(e) {

    const { name, value, type, checked } = e.target

    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))

  }



  // Opções de frequência — mesmas do onboarding, suportadas pelo banco
  // (CHECK da coluna frequencia). Cálculo via lib recorrenciaReceita.
  const OPCOES_FREQ = [

    { v: 'nao_repete',     t: 'Não repete (só este mês)' },

    { v: 'semanal',        t: 'Semanal' },

    { v: 'a_cada_10_dias', t: 'A cada 10 dias' },

    { v: 'quinzenal',      t: 'Quinzenal (a cada 15 dias)' },

    { v: 'a_cada_20_dias', t: 'A cada 20 dias' },

    { v: 'mensal',         t: 'Mensal' },

    { v: 'por_meses',      t: 'A cada X meses' },

    { v: 'personalizado',  t: 'Personalizado (intervalo em meses)' },

  ]

  const ehRepete = form.frequencia !== 'nao_repete'

  const usaIntervaloMeses = form.frequencia === 'por_meses' || form.frequencia === 'personalizado'



  function handleSubmit(e) {

    e.preventDefault()

    const freq = form.frequencia

    const recorrente = freq !== 'nao_repete'

    // Monta o payload mapeando para as colunas reais da tabela receitas.
    const payload = {

      descricao: form.descricao,

      valor: Number(form.valor) || 0,

      data: form.data,

      categoria: form.categoria,

      recorrente, // mantém compatibilidade com registros/telas antigas

      frequencia: freq,

      recorrencia_meses: usaIntervaloMeses ? (Math.max(1, parseInt(form.recorrencia_meses, 10) || 1)) : null,

      ocorrencias: recorrente && form.termino === 'ocorrencias'

        ? Math.max(1, parseInt(form.ocorrencias, 10) || 1)

        : null,

      data_fim: recorrente && form.termino === 'data' && form.data_fim ? form.data_fim : null,

    }

    onSalvar(payload)

  }



  return (

    <form onSubmit={handleSubmit} className="space-y-4">

      <div>

        <label className="label">Descrição</label>

        <input name="descricao" value={form.descricao} onChange={handleChange}

          className="input" placeholder="Ex: Salário, Freelance..." required />

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

      <div>

        <label className="label">Categoria</label>

        <select name="categoria" value={form.categoria} onChange={handleChange} className="input">

          <option value="">Sem categoria</option>

          {categorias.map(c => <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}

        </select>

      </div>



      {/* Frequência da receita */}

      <div>

        <label className="label">Com que frequência você recebe?</label>

        <select name="frequencia" value={form.frequencia} onChange={handleChange} className="input">

          {OPCOES_FREQ.map(o => <option key={o.v} value={o.v}>{o.t}</option>)}

        </select>



        {/* Intervalo em meses (por_meses / personalizado) */}

        {usaIntervaloMeses && (

          <div className="mt-2">

            <label className="label">A cada quantos meses?</label>

            <input name="recorrencia_meses" value={form.recorrencia_meses} onChange={handleChange}

              type="number" min="1" max="60" inputMode="numeric" className="input" placeholder="Ex: 2" />

          </div>

        )}



        {/* Término da recorrência — só quando repete */}

        {ehRepete && (

          <div className="mt-3">

            <label className="label">Até quando?</label>

            <select name="termino" value={form.termino} onChange={handleChange} className="input">

              <option value="sem_fim">Sem data de término</option>

              <option value="ocorrencias">Durante X ocorrências</option>

              <option value="data">Até uma data específica</option>

            </select>

            {form.termino === 'ocorrencias' && (

              <input name="ocorrencias" value={form.ocorrencias} onChange={handleChange}

                type="number" min="1" max="600" inputMode="numeric" className="input mt-2"

                placeholder="Nº de recebimentos (ex.: 12)" />

            )}

            {form.termino === 'data' && (

              <input name="data_fim" value={form.data_fim} onChange={handleChange}

                type="date" className="input mt-2" />

            )}

          </div>

        )}



        <p className="text-xs text-gray-400 mt-2 flex items-start gap-1">

          <span>ℹ️</span>

          <span>Receitas recorrentes aparecem na projeção dos próximos meses, respeitando a frequência e o término. "Não repete" conta apenas neste mês.</span>

        </p>

      </div>



      <div className="flex gap-3 pt-1">

        <button type="button" onClick={onCancelar} className="btn-secondary flex-1">Cancelar</button>

        <button type="submit" disabled={carregando} className="btn-primary flex-1 flex items-center justify-center gap-2">

          {carregando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : (textoBotao || 'Salvar receita')}

        </button>

      </div>

    </form>

  )

}



export default function Receitas() {

  // Mês/ano navegáveis: permite ver receitas cadastradas para meses futuros
  // (ou passados) sem alterar nenhum dado — apenas o período consultado.
  const [ref, setRef] = useState({ mes: mesAtual, ano: anoAtual })

  const { receitas, recorrentes, total, carregando, erro, criar, atualizar, remover } = useReceitas(ref.mes, ref.ano)

  const [modalAberto, setModalAberto] = useState(false)

  const [salvando, setSalvando] = useState(false)

  const [removendo, setRemovendo] = useState(null)

  const [erroAcao, setErroAcao] = useState('')

  const [receitaEditando, setReceitaEditando] = useState(null) // null = modo criação
  const [detalhesResumo, setDetalhesResumo] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('lancamentos')
  const [receitaExpandida, setReceitaExpandida] = useState(null)
  const [analisesAbertas, setAnalisesAbertas] = useState(false)



  const nomeMes = new Date(ref.ano, ref.mes - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const ehMesCorrente = ref.mes === mesAtual && ref.ano === anoAtual



  // Navega entre meses (−1 / +1), ajustando a virada de ano.
  function navegarMes(delta) {

    setRef(prev => {

      const total = (prev.ano * 12 + (prev.mes - 1)) + delta

      return { ano: Math.floor(total / 12), mes: (total % 12) + 1 }

    })

  }

  // Data padrão de nova receita = dia 1 do mês em visualização.
  const dataPadraoNova = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`



  // ─── Receitas recorrentes projetadas ───
  // Uma receita recorrente mensal (recorrente = true) deve aparecer no mês de
  // início E em todos os meses seguintes. Como existe só UMA linha no banco
  // (com a data do mês de início), projetamos aqui — sem gravar nada — as
  // recorrentes iniciadas em meses ANTERIORES ao visualizado. As do próprio mês
  // (incluindo recorrentes que começam neste mês) já vêm em `receitas`.
  const inicioMesVis = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-01`

  const projetadas = recorrentes

    // começou antes do mês visualizado (data < 1º dia do mês visualizado)
    .filter(r => r.data < inicioMesVis)

    // evita duplicar: se por algum motivo já estiver na lista do mês, ignora
    .filter(r => !receitas.some(x => x.id === r.id))

    .map(r => {

      // Projeta a data para o mês visualizado, mantendo o dia (limitado ao
      // último dia do mês). Sem new Date() sobre r.data para evitar timezone:
      // extrai o dia por fatiamento da string 'YYYY-MM-DD'.
      const diaOriginal = parseInt(r.data.slice(8, 10), 10) || 1

      const ultimoDia = new Date(ref.ano, ref.mes, 0).getDate()

      const dia = Math.min(diaOriginal, ultimoDia)

      const dataProjetada = `${ref.ano}-${String(ref.mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

      // Marca como projeção para a UI (ex.: desabilitar remover de item virtual).
      return { ...r, data: dataProjetada, _projetada: true }

    })



  // Lista exibida = receitas reais do mês + recorrentes projetadas de meses
  // anteriores. Ordena por data desc (mesmo critério da query).
  const receitasExibidas = [...receitas, ...projetadas]

    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0))

  // Total do mês visualizado considerando as recorrentes projetadas.
  const totalExibido = receitasExibidas.reduce((acc, r) => acc + Number(r.valor), 0)



  // Atalho do botão "+" (menu inferior mobile): ?novo=1 abre o modal já existente.
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {

    if (searchParams.get('novo') === '1') {

      setReceitaEditando(null)

      setModalAberto(true)

      searchParams.delete('novo')

      setSearchParams(searchParams, { replace: true })

    }

  }, [searchParams, setSearchParams])



  // Abre o modal em modo criação
  function handleAbrirNova() {

    setReceitaEditando(null)

    setModalAberto(true)

  }



  // Abre o modal em modo edição, preenchido com a receita
  function handleEditar(receita) {

    setReceitaEditando(receita)

    setModalAberto(true)

  }



  function fecharModal() {

    setModalAberto(false)

    setReceitaEditando(null)

  }



  // Salva: cria uma nova OU atualiza a existente (sem duplicar)
  async function handleSalvar(dados) {

    setSalvando(true)

    setErroAcao('')

    try {

      if (receitaEditando) {

        await atualizar(receitaEditando.id, dados)

      } else {

        await criar(dados)

      }

      fecharModal()

    } catch (err) {

      setErroAcao(receitaEditando

        ? 'Erro ao salvar alterações. Tente novamente.'

        : 'Erro ao salvar receita. Tente novamente.')

    } finally {

      setSalvando(false)

    }

  }



  async function handleRemover(id) {

    if (!confirm('Remover esta receita?')) return

    setRemovendo(id)

    try {

      await remover(id)

    } catch {

      setErroAcao('Erro ao remover. Tente novamente.')

    } finally {

      setRemovendo(null)

    }

  }



  // Indicadores de apresentação: usam apenas as receitas já exibidas.
  const totalRecorrente = receitasExibidas
    .filter(r => r.recorrente)
    .reduce((soma, r) => soma + Number(r.valor || 0), 0)
  const totalPontual = totalExibido - totalRecorrente

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Receitas</h1>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={() => navegarMes(-1)} aria-label="Mês anterior"
              className="touch-target rounded-lg text-gray-400 hover:text-marca hover:bg-gray-100"><ChevronLeft size={18} /></button>
            <span className="text-sm text-gray-500 capitalize min-w-[8.5rem] text-center">{nomeMes}</span>
            <button type="button" onClick={() => navegarMes(1)} aria-label="Próximo mês"
              className="touch-target rounded-lg text-gray-400 hover:text-marca hover:bg-gray-100"><ChevronRight size={18} /></button>
            {!ehMesCorrente && <button type="button" onClick={() => setRef({ mes: mesAtual, ano: anoAtual })}
              className="text-xs text-marca font-semibold">Hoje</button>}
          </div>
        </div>
        <button type="button" onClick={handleAbrirNova} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> Nova receita
        </button>
      </div>

      <section className="card !p-4 sm:!p-5" aria-label="Resumo de receitas">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Total de receitas no mês</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-500 mt-1 break-words">{formatCurrency(totalExibido)}</p>
            <p className="text-xs text-gray-400 mt-1">{receitasExibidas.length} {receitasExibidas.length === 1 ? 'receita' : 'receitas'} neste mês</p>
          </div>
          <button type="button" onClick={() => setDetalhesResumo(v => !v)} aria-expanded={detalhesResumo}
            className="flex items-center gap-1 text-xs text-marca shrink-0 hover:underline">
            Detalhes {detalhesResumo ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
        </div>
        {detalhesResumo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-700/40">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Receitas recorrentes</p>
              <p className="font-semibold text-green-500 mt-1">{formatCurrency(totalRecorrente)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">Receitas não recorrentes</p>
              <p className="font-semibold text-green-500 mt-1">{formatCurrency(totalPontual)}</p>
            </div>
          </div>
        )}
      </section>

      {(erro || erroAcao) && <div role="alert" className="rounded-xl bg-red-500/10 text-red-500 p-3 text-sm">{erroAcao || erro}</div>}

      <div className="card !p-2 flex items-center gap-2">
        <button type="button" onClick={() => setAbaAtiva('lancamentos')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${abaAtiva === 'lancamentos' ? 'btn-primary' : 'text-gray-400 hover:bg-gray-50'}`}>
          Lançamentos
        </button>
        <button type="button" onClick={() => { setAbaAtiva('analises'); setAnalisesAbertas(true) }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${abaAtiva === 'analises' ? 'btn-primary' : 'text-gray-400 hover:bg-gray-50'}`}>
          Análises
        </button>
      </div>

      {abaAtiva === 'lancamentos' ? (
        <section className="card !p-4 sm:!p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Receitas do mês <span className="text-sm font-normal text-gray-400">({receitasExibidas.length})</span></h2>
          {carregando ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-marca"/></div>
          ) : receitasExibidas.length === 0 ? (
            <div className="py-10 text-center">
              <TrendingUp size={32} className="text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Nenhuma receita para este mês.</p>
              <button type="button" onClick={handleAbrirNova} className="text-sm text-marca mt-3 hover:underline">Cadastrar receita</button>
            </div>
          ) : (
            <div className="space-y-2">
              {receitasExibidas.map(r => {
                const aberto = receitaExpandida === `${r.id}-${r.data}`
                return (
                  <div key={`${r.id}-${r.data}`} className="rounded-xl bg-gray-50 overflow-hidden">
                    <button type="button" onClick={() => setReceitaExpandida(aberto ? null : `${r.id}-${r.data}`)}
                      aria-expanded={aberto} className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-100 transition-colors">
                      <span className="w-9 h-9 rounded-xl bg-green-500/10 text-green-500 flex items-center justify-center shrink-0"><TrendingUp size={17}/></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 truncate">{r.descricao}</span>
                        <span className="block text-xs text-gray-400 truncate">{r.categoria ? `${r.categoria} · ` : ''}{formatDate(r.data)}</span>
                      </span>
                      <span className="text-sm font-semibold text-green-500 whitespace-nowrap">+{formatCurrency(r.valor)}</span>
                      {aberto ? <ChevronUp size={15} className="text-gray-400 shrink-0"/> : <ChevronDown size={15} className="text-gray-400 shrink-0"/>}
                    </button>
                    {aberto && (
                      <div className="border-t border-gray-700/20 px-3 pb-3 pt-3 space-y-3">
                        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400">
                          <span><span className="font-semibold">Categoria:</span> {r.categoria || 'Sem categoria'}</span>
                          <span><span className="font-semibold">Data:</span> {formatDate(r.data)}</span>
                          <span><span className="font-semibold">Frequência:</span> {r.recorrente ? (r.frequencia || 'mensal').replaceAll('_', ' ') : 'Não repete'}</span>
                          {r.recorrencia_meses != null && <span>Intervalo: {r.recorrencia_meses} meses</span>}
                          {r.ocorrencias != null && <span>Término após {r.ocorrencias} ocorrências</span>}
                          {r.data_fim && <span>Até: {formatDate(r.data_fim)}</span>}
                          {r._projetada && <span className="text-marca">Receita projetada a partir do cadastro original</span>}
                        </div>
                        {r._projetada ? (
                          <p className="text-xs text-gray-400">Para editar ou remover a recorrência, abra o mês em que ela foi cadastrada.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => handleEditar(r)} className="btn-secondary !py-2 !px-3 flex items-center gap-1 text-xs"><Pencil size={14}/> Editar</button>
                            <button type="button" onClick={() => handleRemover(r.id)} disabled={removendo === r.id}
                              className="rounded-lg border border-red-500/25 text-red-500 px-3 py-2 flex items-center gap-1 text-xs hover:bg-red-500/10 disabled:opacity-50">
                              {removendo === r.id ? <Loader2 size={14} className="animate-spin"/> : <Trash2 size={14}/>} Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="card !p-4 sm:!p-5">
          <button type="button" onClick={() => setAnalisesAbertas(v => !v)} className="w-full flex justify-between items-center text-left" aria-expanded={analisesAbertas}>
            <span className="flex items-center gap-2 font-semibold text-gray-900"><BarChart3 size={18} className="text-marca"/> Análises de receitas</span>
            {analisesAbertas ? <ChevronUp size={17} className="text-gray-400"/> : <ChevronDown size={17} className="text-gray-400"/>}
          </button>
          {analisesAbertas && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Total no mês</p><p className="text-green-500 font-semibold mt-1">{formatCurrency(totalExibido)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Recorrentes</p><p className="text-green-500 font-semibold mt-1">{formatCurrency(totalRecorrente)}</p></div>
              <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-400">Não recorrentes</p><p className="text-green-500 font-semibold mt-1">{formatCurrency(totalPontual)}</p></div>
              <p className="text-xs text-gray-400 sm:col-span-3">Valores calculados apenas a partir dos lançamentos exibidos neste mês; não alteram a projeção financeira.</p>
            </div>
          )}
        </section>
      )}

      <Modal aberto={modalAberto} onFechar={fecharModal} titulo={receitaEditando ? 'Editar receita' : 'Nova receita'}>
        <FormReceita key={receitaEditando ? receitaEditando.id : 'nova'} onSalvar={handleSalvar} onCancelar={fecharModal}
          carregando={salvando} receitaInicial={receitaEditando} dataPadrao={dataPadraoNova}
          textoBotao={receitaEditando ? 'Salvar alterações' : 'Salvar receita'}/>
      </Modal>
    </div>
  )
}