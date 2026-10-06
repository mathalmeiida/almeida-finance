import React, { useState } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, ShieldCheck,
  CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useCartoes } from '../hooks/useCartoes'
import { useCategorias } from '../hooks/useCategorias'
import InputMoeda from '../components/InputMoeda'
import { formatCurrency } from '../lib/utils'
import { classificarDespesa } from '../lib/classificarDespesa'

const hojeISO = () => new Date().toISOString().split('T')[0]

// Opções de reserva — MESMAS do card de reserva do Dashboard. 20% é o padrão.
const OPCOES_RESERVA = [10, 15, 20, 25, 30]

// 6 telas: Saldo, Receitas, Despesas, Cartão, Reserva, Final.
const TOTAL_ETAPAS = 6

// Barra de progresso enxuta.
function Progresso({ etapa }) {
  return (
    <div className="flex items-center gap-1.5 mb-6">
      {Array.from({ length: TOTAL_ETAPAS }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= etapa ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

// Cabeçalho padrão de cada etapa (ícone + título + subtítulo).
function CabecalhoEtapa({ icone: Icone, cor, bg, titulo, subtitulo }) {
  return (
    <>
      <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-4`}>
        <Icone size={22} className={cor} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-1">{titulo}</h2>
      {subtitulo && <p className="text-sm text-gray-500 mb-4">{subtitulo}</p>}
    </>
  )
}

export default function Onboarding({ aoConcluir }) {
  const { atualizarPreferenciasLimite } = useAuth()
  const { criar: criarReceita } = useReceitas()
  const { criar: criarDespesa } = useDespesas()
  const { criar: criarCartao } = useCartoes()
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { categorias: categoriasDespesa } = useCategorias('despesa')

  const [etapa, setEtapa] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // ETAPA 1 — Saldo atual
  const [saldo, setSaldo] = useState('')

  // ETAPA 2 — Receitas (lista local; grava só ao avançar)
  const [receitas, setReceitas] = useState([]) // { descricao, valor, categoria, data, recorrente }
  const [recForm, setRecForm] = useState({
    descricao: '', valor: '', categoria: '', data: hojeISO(), recorrente: true,
  })

  // ETAPA 3 — Despesas (lista local)
  const [despesas, setDespesas] = useState([]) // { descricao, valor, categoria_id, data, frequencia, recorrencia_meses }
  const [despForm, setDespForm] = useState({
    descricao: '', valor: '', categoria_id: '', data: hojeISO(),
    frequencia: 'mensal', recorrenciaMeses: '',
  })

  // ETAPA 4 — Cartão
  const [usaCartao, setUsaCartao] = useState(null) // null | true | false
  const [cartao, setCartao] = useState({
    nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '',
  })

  // ETAPA 5 — Reserva
  const [reservaAtual, setReservaAtual] = useState('')
  const [reservaPct, setReservaPct] = useState(20)
  const [reservaCustom, setReservaCustom] = useState('')
  const [modoCustom, setModoCustom] = useState(false)

  const avancar = () => { setErro(''); setEtapa(e => Math.min(e + 1, TOTAL_ETAPAS - 1)) }
  const voltar = () => { setErro(''); setEtapa(e => Math.max(e - 1, 0)) }

  // ─── ETAPA 1: Saldo ───
  async function salvarSaldo() {
    const valor = Number(saldo) || 0
    if (valor <= 0) { setErro('Informe um valor de saldo válido.'); return }
    setSalvando(true); setErro('')
    try {
      await atualizarPreferenciasLimite({ saldo_base: valor, saldo_base_data: hojeISO() })
      avancar()
    } catch {
      setErro('Não foi possível salvar o saldo. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ─── ETAPA 2: Receitas (lista local) ───
  function adicionarReceitaLocal() {
    const valor = Number(recForm.valor) || 0
    if (!recForm.descricao.trim()) { setErro('Dê uma descrição à receita.'); return }
    if (valor <= 0) { setErro('Informe um valor de receita válido.'); return }
    setErro('')
    setReceitas(prev => [...prev, {
      descricao: recForm.descricao.trim(),
      valor,
      categoria: recForm.categoria || null,
      data: recForm.data || hojeISO(),
      recorrente: !!recForm.recorrente,
    }])
    setRecForm({ descricao: '', valor: '', categoria: '', data: hojeISO(), recorrente: true })
  }
  function removerReceitaLocal(i) {
    setReceitas(prev => prev.filter((_, idx) => idx !== i))
  }
  async function salvarReceitas() {
    if (receitas.length === 0) { avancar(); return }
    setSalvando(true); setErro('')
    try {
      // Grava cada receita usando a MESMA função/estrutura da tela Receitas.
      for (const r of receitas) {
        await criarReceita({
          descricao: r.descricao,
          valor: r.valor,
          data: r.data,
          recorrente: r.recorrente,
          categoria: r.categoria,
        })
      }
      avancar()
    } catch {
      setErro('Não foi possível salvar as receitas. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ─── ETAPA 3: Despesas (lista local) ───
  function adicionarDespesaLocal() {
    const valor = Number(despForm.valor) || 0
    if (!despForm.descricao.trim()) { setErro('Dê uma descrição à despesa.'); return }
    if (valor <= 0) { setErro('Informe um valor de despesa válido.'); return }
    setErro('')
    setDespesas(prev => [...prev, {
      descricao: despForm.descricao.trim(),
      valor,
      categoria_id: despForm.categoria_id || null,
      data: despForm.data || hojeISO(),
      frequencia: despForm.frequencia,
      recorrenciaMeses: despForm.recorrenciaMeses,
    }])
    setDespForm({ descricao: '', valor: '', categoria_id: '', data: hojeISO(), frequencia: 'mensal', recorrenciaMeses: '' })
  }
  function removerDespesaLocal(i) {
    setDespesas(prev => prev.filter((_, idx) => idx !== i))
  }
  async function salvarDespesas() {
    if (despesas.length === 0) { avancar(); return }
    setSalvando(true); setErro('')
    try {
      for (const d of despesas) {
        const cat = categoriasDespesa.find(c => c.id === d.categoria_id)
        // Classificação automática fixa/variável — MESMA lógica do app.
        const tipo_despesa = classificarDespesa({
          descricao: d.descricao,
          categoria: cat?.nome || '',
        })
        // Frequência: mensal (sem fim) ou por_meses (duração definida).
        let freq = d.frequencia
        let recorrencia_meses = null
        if (d.frequencia === 'mensal' && Number(d.recorrenciaMeses) > 0) {
          freq = 'por_meses'
          recorrencia_meses = Number(d.recorrenciaMeses)
        }
        const recorrente = freq !== 'nao_repete'
        await criarDespesa({
          descricao: d.descricao,
          valor: d.valor,
          data: d.data,
          recorrente,
          frequencia: freq,
          recorrencia_meses,
          categoria_id: d.categoria_id,
          tipo_despesa,
        })
      }
      avancar()
    } catch {
      setErro('Não foi possível salvar as despesas. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ─── ETAPA 4: Cartão ───
  async function salvarCartao() {
    if (usaCartao !== true) { avancar(); return }
    const limite = Number(cartao.limite_total) || 0
    const fech = parseInt(cartao.dia_fechamento, 10)
    const venc = parseInt(cartao.dia_vencimento, 10)
    if (!cartao.nome.trim()) { setErro('Informe o nome do cartão.'); return }
    if (limite <= 0) { setErro('Informe o limite do cartão.'); return }
    if (!(fech >= 1 && fech <= 31)) { setErro('Dia de fechamento inválido (1 a 31).'); return }
    if (!(venc >= 1 && venc <= 31)) { setErro('Dia de vencimento inválido (1 a 31).'); return }
    setSalvando(true); setErro('')
    try {
      await criarCartao({
        nome: cartao.nome.trim(),
        banco: cartao.banco.trim() || null,
        limite_total: limite,
        dia_fechamento: fech,
        dia_vencimento: venc,
      })
      avancar()
    } catch {
      setErro('Não foi possível salvar o cartão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ─── ETAPA 5: Reserva ───
  async function salvarReserva() {
    let pct = reservaPct
    if (modoCustom) {
      pct = parseInt(reservaCustom, 10)
      if (!(pct >= 0 && pct <= 100)) { setErro('Informe um percentual entre 0 e 100.'); return }
    }
    const valorReserva = Number(reservaAtual) || 0
    setSalvando(true); setErro('')
    try {
      await atualizarPreferenciasLimite({
        reserva_percentual: pct,
        reserva_atual: valorReserva,
      })
      avancar()
    } catch {
      // Não bloqueia a conclusão do onboarding se a preferência falhar.
      avancar()
    } finally {
      setSalvando(false)
    }
  }

  function finalizar() {
    aoConcluir?.()
  }

  const cartaoChange = (e) => setCartao(prev => ({ ...prev, [e.target.name]: e.target.value }))

  // Botão "Pular por enquanto" reutilizável.
  function BotaoPular({ onClick }) {
    return (
      <button type="button" onClick={onClick} className="btn-secondary flex-1 text-sm">
        Pular por enquanto
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <Progresso etapa={etapa} />

          {/* ETAPA 1 — Saldo atual */}
          {etapa === 0 && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={Wallet} cor="text-blue-600" bg="bg-blue-50"
                titulo="Quanto você tem disponível hoje?"
                subtitulo="Informe seu saldo atual para o app calcular seu dinheiro em tempo real."
              />
              <label className="label">Saldo atual (R$)</label>
              <InputMoeda
                valor={saldo} onChangeValor={setSaldo}
                className="input text-2xl font-bold text-center py-3" prefixo={null} autoFocus
              />
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <BotaoPular onClick={avancar} />
                <button onClick={salvarSaldo} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 2 — Receitas */}
          {etapa === 1 && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={TrendingUp} cor="text-green-600" bg="bg-green-50"
                titulo="Quais são suas receitas?"
                subtitulo="Salário, freelance, renda extra... Adicione quantas quiser."
              />

              {receitas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {receitas.map((r, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">
                        {r.descricao}{r.recorrente && <span className="text-xs text-blue-500 ml-1">• mensal</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-green-600">{formatCurrency(r.valor)}</span>
                        <button onClick={() => removerReceitaLocal(i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <input className="input" placeholder="Descrição (ex.: Salário)"
                  value={recForm.descricao}
                  onChange={(e) => setRecForm(p => ({ ...p, descricao: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <InputMoeda valor={recForm.valor}
                    onChangeValor={(n) => setRecForm(p => ({ ...p, valor: n }))}
                    className="input" prefixo={null} />
                  <input type="date" className="input" value={recForm.data}
                    onChange={(e) => setRecForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <select className="input" value={recForm.categoria}
                  onChange={(e) => setRecForm(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categoriasReceita.map(c => <option key={c.id} value={c.nome}>{c.icone} {c.nome}</option>)}
                </select>
                {/* Se repete todo mês */}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button"
                    onClick={() => setRecForm(p => ({ ...p, recorrente: true }))}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      recForm.recorrente ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}>
                    Repete todo mês
                  </button>
                  <button type="button"
                    onClick={() => setRecForm(p => ({ ...p, recorrente: false }))}
                    className={`p-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                      !recForm.recorrente ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'
                    }`}>
                    Só uma vez
                  </button>
                </div>
              </div>
              <button onClick={adicionarReceitaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> Adicionar outra receita
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <BotaoPular onClick={avancar} />
                <button onClick={salvarReceitas} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3 — Despesas */}
          {etapa === 2 && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={TrendingDown} cor="text-red-500" bg="bg-red-50"
                titulo="Quais são suas principais despesas?"
                subtitulo="Aluguel, contas, assinaturas... A classificação fixa/variável é automática."
              />

              {despesas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {despesas.map((d, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800 truncate min-w-0">{d.descricao}</span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-red-500">{formatCurrency(d.valor)}</span>
                        <button onClick={() => removerDespesaLocal(i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="space-y-2">
                <input className="input" placeholder="Descrição (ex.: Aluguel)"
                  value={despForm.descricao}
                  onChange={(e) => setDespForm(p => ({ ...p, descricao: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <InputMoeda valor={despForm.valor}
                    onChangeValor={(n) => setDespForm(p => ({ ...p, valor: n }))}
                    className="input" prefixo={null} />
                  <input type="date" className="input" value={despForm.data}
                    onChange={(e) => setDespForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <select className="input" value={despForm.categoria_id}
                  onChange={(e) => setDespForm(p => ({ ...p, categoria_id: e.target.value }))}>
                  <option value="">Sem categoria</option>
                  {categoriasDespesa.map(c => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                </select>
                {/* Recorrência */}
                <select className="input" value={despForm.frequencia}
                  onChange={(e) => setDespForm(p => ({ ...p, frequencia: e.target.value }))}>
                  <option value="nao_repete">Não repete (só uma vez)</option>
                  <option value="mensal">Repete todo mês</option>
                  <option value="semanal">Toda semana</option>
                  <option value="diaria">Todo dia</option>
                </select>
                {/* Por quantos meses — só quando mensal */}
                {despForm.frequencia === 'mensal' && (
                  <input className="input" type="number" min="1" max="120" inputMode="numeric"
                    placeholder="Por quantos meses? (deixe vazio p/ sem fim)"
                    value={despForm.recorrenciaMeses}
                    onChange={(e) => setDespForm(p => ({ ...p, recorrenciaMeses: e.target.value }))} />
                )}
              </div>
              <button onClick={adicionarDespesaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> Adicionar outra despesa
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <BotaoPular onClick={avancar} />
                <button onClick={salvarDespesas} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 4 — Cartão */}
          {etapa === 3 && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={CreditCard} cor="text-indigo-600" bg="bg-indigo-50"
                titulo="Quer cadastrar seus gastos no cartão?"
                subtitulo="Isso ajuda a prever suas faturas nos próximos meses."
              />

              {usaCartao === null && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setUsaCartao(true)} className="btn-secondary py-3">Sim, cadastrar</button>
                  <button onClick={() => setUsaCartao(false)} className="btn-secondary py-3">Agora não</button>
                </div>
              )}

              {usaCartao === true && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Nome do cartão</label>
                    <input name="nome" className="input" value={cartao.nome} onChange={cartaoChange}
                      placeholder="Ex: Bradesco Visa, Nubank" />
                  </div>
                  <div>
                    <label className="label">Banco <span className="text-gray-400">(opcional)</span></label>
                    <input name="banco" className="input" value={cartao.banco} onChange={cartaoChange}
                      placeholder="Ex: Bradesco" />
                  </div>
                  <div>
                    <label className="label">Limite total (R$)</label>
                    <InputMoeda valor={cartao.limite_total}
                      onChangeValor={(n) => setCartao(p => ({ ...p, limite_total: n }))}
                      className="input" prefixo={null} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Fechamento</label>
                      <input name="dia_fechamento" className="input" type="number" min="1" max="31"
                        value={cartao.dia_fechamento} onChange={cartaoChange} placeholder="Ex: 20" />
                    </div>
                    <div>
                      <label className="label">Vencimento</label>
                      <input name="dia_vencimento" className="input" type="number" min="1" max="31"
                        value={cartao.dia_vencimento} onChange={cartaoChange} placeholder="Ex: 28" />
                    </div>
                  </div>
                </div>
              )}

              {usaCartao === false && (
                <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  Sem problemas. Você pode cadastrar cartões depois, na aba Cartões.
                </p>
              )}

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <BotaoPular onClick={avancar} />
                <button onClick={salvarCartao} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 5 — Reserva de emergência */}
          {etapa === 4 && (
            <div className="py-2">
              <CabecalhoEtapa
                icone={ShieldCheck} cor="text-amber-600" bg="bg-amber-50"
                titulo="Você já possui uma reserva de emergência?"
                subtitulo="Informe quanto já tem guardado e quanto quer separar da renda por mês."
              />

              <label className="label">Reserva atual (R$) <span className="text-gray-400">(opcional)</span></label>
              <InputMoeda valor={reservaAtual} onChangeValor={setReservaAtual}
                className="input mb-4" prefixo={null} />

              <label className="label">Percentual a reservar por mês</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {OPCOES_RESERVA.map(opt => {
                  const ativo = !modoCustom && reservaPct === opt
                  return (
                    <button key={opt}
                      onClick={() => { setModoCustom(false); setReservaPct(opt) }}
                      className={`relative py-3 rounded-lg text-sm font-semibold border transition-colors ${
                        ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}>
                      {opt}%
                      {opt === 20 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-amber-500 text-white px-1.5 rounded-full whitespace-nowrap">
                          padrão
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  onClick={() => setModoCustom(true)}
                  className={`py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    modoCustom ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                  }`}>
                  Outro
                </button>
              </div>

              {modoCustom && (
                <input className="input" type="number" min="0" max="100" autoFocus
                  value={reservaCustom} onChange={(e) => setReservaCustom(e.target.value)}
                  placeholder="Percentual personalizado (%)" />
              )}

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1 px-3">
                  <ArrowLeft size={16} />
                </button>
                <BotaoPular onClick={avancar} />
                <button onClick={salvarReserva} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA FINAL */}
          {etapa === 5 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={30} className="text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Tudo pronto!</h1>
              <p className="text-sm text-gray-500 mb-6">
                Agora vamos organizar sua vida financeira.
              </p>
              <button onClick={finalizar} className="btn-primary w-full flex items-center justify-center gap-2">
                Entrar no Almeida Finance <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
      </div>
    </div>
  )
}
