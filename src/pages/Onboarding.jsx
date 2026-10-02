import React, { useState } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, ShieldCheck,
  CheckCircle2, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, Sparkles
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useReceitas } from '../hooks/useReceitas'
import { useDespesas } from '../hooks/useDespesas'
import { useCartoes } from '../hooks/useCartoes'
import { formatCurrency } from '../lib/utils'

// Converte "1.234,56" ou "1234.56" em número; retorna NaN se inválido
function parseValor(txt) {
  if (txt == null) return NaN
  return parseFloat(String(txt).replace(/\./g, '').replace(',', '.'))
}

const hojeISO = () => new Date().toISOString().split('T')[0]

// Opções de reserva — mesmas do card de reserva do Dashboard. 20% é só sugestão.
const OPCOES_RESERVA = [10, 15, 20, 25, 30]

const TOTAL_ETAPAS = 6

// Barra de progresso enxuta (6 passos)
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

export default function Onboarding({ aoConcluir }) {
  const { atualizarPreferenciasLimite } = useAuth()
  const { criar: criarReceita } = useReceitas()
  const { criar: criarDespesa } = useDespesas()
  const { criar: criarCartao } = useCartoes()

  const [etapa, setEtapa] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Etapa 2 — Renda
  const [renda, setRenda] = useState('')

  // Etapa 3 — Compromissos (lista local; só grava ao avançar)
  const [despesas, setDespesas] = useState([]) // { descricao, valor }
  const [despDesc, setDespDesc] = useState('')
  const [despValor, setDespValor] = useState('')

  // Etapa 4 — Cartão
  const [usaCartao, setUsaCartao] = useState(null) // null | true | false
  const [cartao, setCartao] = useState({
    nome: '', banco: '', limite_total: '', dia_fechamento: '', dia_vencimento: '',
  })

  // Etapa 5 — Reserva
  const [reservaPct, setReservaPct] = useState(20)
  const [reservaCustom, setReservaCustom] = useState('')
  const [modoCustom, setModoCustom] = useState(false)

  const avancar = () => { setErro(''); setEtapa(e => Math.min(e + 1, TOTAL_ETAPAS - 1)) }
  const voltar = () => { setErro(''); setEtapa(e => Math.max(e - 1, 0)) }

  // ── Etapa 2: salvar renda e avançar ──
  async function salvarRenda() {
    const valor = parseValor(renda)
    if (!valor || valor <= 0) { setErro('Informe um valor de renda válido.'); return }
    setSalvando(true); setErro('')
    try {
      await criarReceita({
        descricao: 'Renda mensal',
        valor,
        data: hojeISO(),
        recorrente: true, // entra na projeção de todos os meses
        categoria: 'Salário',
      })
      avancar()
    } catch (e) {
      setErro('Não foi possível salvar a renda. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Etapa 3: adicionar à lista local ──
  function adicionarDespesaLocal() {
    const valor = parseValor(despValor)
    if (!despDesc.trim()) { setErro('Dê um nome ao compromisso.'); return }
    if (!valor || valor <= 0) { setErro('Informe um valor válido.'); return }
    setErro('')
    setDespesas(prev => [...prev, { descricao: despDesc.trim(), valor }])
    setDespDesc(''); setDespValor('')
  }
  function removerDespesaLocal(i) {
    setDespesas(prev => prev.filter((_, idx) => idx !== i))
  }
  // Grava todas as despesas da lista (recorrentes/fixas) e avança
  async function salvarCompromissos() {
    if (despesas.length === 0) { avancar(); return }
    setSalvando(true); setErro('')
    try {
      for (const d of despesas) {
        await criarDespesa({
          descricao: d.descricao,
          valor: d.valor,
          data: hojeISO(),
          recorrente: true,
          frequencia: 'mensal',
          tipo_despesa: 'fixa',
        })
      }
      avancar()
    } catch (e) {
      setErro('Não foi possível salvar os compromissos. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Etapa 4: salvar cartão (se usar) ──
  async function salvarCartao() {
    if (usaCartao !== true) { avancar(); return }
    const limite = parseValor(cartao.limite_total)
    const fech = parseInt(cartao.dia_fechamento, 10)
    const venc = parseInt(cartao.dia_vencimento, 10)
    if (!cartao.nome.trim()) { setErro('Informe o nome do cartão.'); return }
    if (!limite || limite <= 0) { setErro('Informe o limite do cartão.'); return }
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
    } catch (e) {
      setErro('Não foi possível salvar o cartão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // ── Etapa 5: salvar reserva ──
  async function salvarReserva() {
    let pct = reservaPct
    if (modoCustom) {
      pct = parseInt(reservaCustom, 10)
      if (!(pct >= 0 && pct <= 100)) { setErro('Informe um percentual entre 0 e 100.'); return }
    }
    setSalvando(true); setErro('')
    try {
      await atualizarPreferenciasLimite({ reserva_percentual: pct })
      avancar()
    } catch (e) {
      // Não bloqueia o onboarding caso a coluna/preferência falhe
      avancar()
    } finally {
      setSalvando(false)
    }
  }

  function finalizar() {
    aoConcluir?.()
  }

  const cartaoChange = (e) => setCartao(prev => ({ ...prev, [e.target.name]: e.target.value }))

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card">
          <Progresso etapa={etapa} />

          {/* ETAPA 1 — Boas-vindas */}
          {etapa === 0 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Bem-vindo ao Almeida Finance</h1>
              <p className="text-sm text-gray-500 mb-6">
                Vamos organizar sua vida financeira em poucos passos.
              </p>
              <button onClick={avancar} className="btn-primary w-full flex items-center justify-center gap-2">
                Começar <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* ETAPA 2 — Renda */}
          {etapa === 1 && (
            <div className="py-2">
              <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp size={22} className="text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Quanto você recebe por mês?</h2>
              <p className="text-xs text-gray-400 mb-4">
                Usaremos sua renda para calcular quanto você pode gastar.
              </p>
              <label className="label">Renda mensal (R$)</label>
              <input
                className="input" inputMode="decimal" autoFocus
                placeholder="Ex: 3.500,00"
                value={renda}
                onChange={(e) => setRenda(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && salvarRenda()}
              />
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarRenda} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 3 — Compromissos */}
          {etapa === 2 && (
            <div className="py-2">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4">
                <TrendingDown size={22} className="text-red-500" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Você tem despesas fixas?</h2>
              <p className="text-xs text-gray-400 mb-4">
                Aluguel, internet, faculdade, empréstimo... Adicione quantas quiser.
              </p>

              {despesas.length > 0 && (
                <ul className="space-y-2 mb-3">
                  {despesas.map((d, i) => (
                    <li key={i} className="flex items-center justify-between bg-gray-100 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-800">{d.descricao}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-red-500">{formatCurrency(d.valor)}</span>
                        <button onClick={() => removerDespesaLocal(i)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid grid-cols-5 gap-2">
                <input
                  className="input col-span-3" placeholder="Ex: Aluguel"
                  value={despDesc} onChange={(e) => setDespDesc(e.target.value)}
                />
                <input
                  className="input col-span-2" inputMode="decimal" placeholder="R$ 0,00"
                  value={despValor} onChange={(e) => setDespValor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && adicionarDespesaLocal()}
                />
              </div>
              <button onClick={adicionarDespesaLocal}
                className="btn-secondary w-full mt-2 flex items-center justify-center gap-1 text-sm">
                <Plus size={15} /> Adicionar compromisso
              </button>
              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={avancar} className="btn-secondary flex-1 text-sm">
                  Pular por enquanto
                </button>
                <button onClick={salvarCompromissos} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 4 — Cartão */}
          {etapa === 3 && (
            <div className="py-2">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4">
                <CreditCard size={22} className="text-indigo-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Você usa cartão de crédito?</h2>
              <p className="text-xs text-gray-400 mb-4">
                Isso ajuda a prever suas faturas nos próximos meses.
              </p>

              {usaCartao === null && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setUsaCartao(true)} className="btn-secondary py-3">Sim, uso</button>
                  <button onClick={() => { setUsaCartao(false) }} className="btn-secondary py-3">Não uso</button>
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
                    <input name="limite_total" className="input" inputMode="decimal"
                      value={cartao.limite_total} onChange={cartaoChange} placeholder="0,00" />
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
                <p className="text-sm text-gray-500 bg-gray-100 rounded-lg p-3">
                  Sem problemas. Você pode cadastrar cartões depois, na aba Cartões.
                </p>
              )}

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={avancar} className="btn-secondary flex-1 text-sm">
                  Pular por enquanto
                </button>
                <button onClick={salvarCartao} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 5 — Reserva */}
          {etapa === 4 && (
            <div className="py-2">
              <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-4">
                <ShieldCheck size={22} className="text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Quanto quer separar da renda?</h2>
              <p className="text-xs text-gray-400 mb-4">
                Essa reserva de emergência fica protegida no cálculo de quanto você pode gastar.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {OPCOES_RESERVA.map(opt => {
                  const ativo = !modoCustom && reservaPct === opt
                  return (
                    <button key={opt}
                      onClick={() => { setModoCustom(false); setReservaPct(opt) }}
                      className={`relative py-3 rounded-lg text-sm font-semibold border transition-colors ${
                        ativo ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      }`}>
                      {opt}%
                      {opt === 20 && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-amber-500 text-white px-1.5 rounded-full whitespace-nowrap">
                          sugerido
                        </span>
                      )}
                    </button>
                  )
                })}
                <button
                  onClick={() => setModoCustom(true)}
                  className={`py-3 rounded-lg text-sm font-semibold border transition-colors ${
                    modoCustom ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                  }`}>
                  Outro
                </button>
              </div>

              {modoCustom && (
                <div>
                  <label className="label">Percentual personalizado (%)</label>
                  <input className="input" type="number" min="0" max="100" autoFocus
                    value={reservaCustom} onChange={(e) => setReservaCustom(e.target.value)}
                    placeholder="Ex: 12" />
                </div>
              )}

              {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

              <div className="flex gap-2 mt-6">
                <button onClick={voltar} className="btn-secondary flex items-center gap-1">
                  <ArrowLeft size={16} />
                </button>
                <button onClick={salvarReserva} disabled={salvando}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ETAPA 6 — Conclusão */}
          {etapa === 5 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={30} className="text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Tudo pronto!</h1>
              <p className="text-sm text-gray-500 mb-6">
                Agora o Almeida Finance consegue calcular quanto você pode gastar sem comprometer seu planejamento.
              </p>
              <button onClick={finalizar} className="btn-primary w-full flex items-center justify-center gap-2">
                <Wallet size={16} /> Ir para meu Dashboard
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">Almeida Finance</p>
      </div>
    </div>
  )
}
