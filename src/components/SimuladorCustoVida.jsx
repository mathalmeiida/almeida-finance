/**
 * SimuladorCustoVida — Calculadora isolada de custo de vida.
 *
 * ISOLAMENTO TOTAL: nenhuma gravação, nenhuma leitura do banco,
 * nenhuma alteração de saldo. Tudo fica em estado local React.
 *
 * Modos:
 *   'real'  → importa os totais reais do mês (passados via props)
 *             e permite ajustes APENAS dentro da simulação.
 *   'livre' → o usuário preenche os valores do zero.
 *
 * Cálculos:
 *   custoMensal    = soma de todos os itens
 *   reserva        = custoMensal × mesesReserva  (padrão 6)
 *   rendaIdeal     = custoMensal / (1 − folga/100) (padrão 20%)
 *
 * Props:
 *   despesasReais       number   total fixas + variáveis do mês atual
 *   categoriasTotais    array    [{ nome, valor }]  agrupamento já calculado
 *   compact             bool     layout reduzido para sidebar
 */

import React, { useState, useMemo } from 'react'
import { Calculator, ChevronDown, ChevronUp, RefreshCw, Info } from 'lucide-react'
import InputMoeda from './InputMoeda'

// Categorias padrão do simulador
const CATS_PADRAO = [
  { id: 'moradia',       nome: 'Moradia (aluguel/prestação)' },
  { id: 'condominio',    nome: 'Condomínio e IPTU' },
  { id: 'agua_energia',  nome: 'Água, energia e gás' },
  { id: 'alimentacao',   nome: 'Alimentação' },
  { id: 'transporte',    nome: 'Transporte' },
  { id: 'saude',         nome: 'Saúde e plano' },
  { id: 'internet',      nome: 'Internet e telefone' },
  { id: 'assinaturas',   nome: 'Assinaturas e streaming' },
  { id: 'lazer',         nome: 'Lazer e entretenimento' },
  { id: 'outros',        nome: 'Outros' },
]

// Formata número como BRL sem símbolo (para inputs)
const fmtBRL = v =>
  Number.isFinite(v) && v > 0
    ? v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : ''

// Converte string BRL para número
const parseBRL = s => {
  if (!s) return 0
  const limpo = String(s).replace(/\s/g, '').replace(/^R\$/, '')
  const n = Number(limpo.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export default function SimuladorCustoVida({
  despesasReais = 0,
  categoriasTotais = [],
  compact = false,
}) {
  const [aberto, setAberto] = useState(false)
  const [modo, setModo] = useState('real')   // 'real' | 'livre'
  const [mesesReserva, setMesesReserva] = useState(6)
  const [folga, setFolga] = useState(20)

  // Estado dos valores simulados: Map<id, valor number>
  // No modo 'real' inicia com os totais por categoria passados via props.
  // No modo 'livre' inicia zerado.
  const valoresIniciais = () => {
    const m = {}
    CATS_PADRAO.forEach(c => { m[c.id] = 0 })
    if (modo === 'real' && categoriasTotais.length > 0) {
      // Mapeia categorias reais para as categorias do simulador pelo nome (parcial)
      categoriasTotais.forEach(({ nome, valor }) => {
        const n = String(nome || '').toLowerCase()
        if (/morad|aluguel|financiamento|hipot/.test(n))   m.moradia     += valor
        else if (/cond|condom|iptu/.test(n))               m.condominio  += valor
        else if (/água|agua|energ|luz|gás|gas/.test(n))    m.agua_energia += valor
        else if (/aliment|mercado|supermerc|comida|refeic/.test(n)) m.alimentacao += valor
        else if (/transport|comb|gasolina|onibus|metrô/.test(n)) m.transporte += valor
        else if (/saúde|saude|médic|plano|farmac/.test(n)) m.saude       += valor
        else if (/internet|telefone|celular|claro|vivo|tim|oi/.test(n)) m.internet += valor
        else if (/assina|stream|netflix|spotify/.test(n))  m.assinaturas += valor
        else if (/lazer|entret|cinema|viagem/.test(n))     m.lazer       += valor
        else                                                m.outros      += valor
      })
    } else if (modo === 'real' && despesasReais > 0) {
      // Sem breakdown por categoria: coloca tudo em "outros"
      m.outros = despesasReais
    }
    return m
  }

  const [valores, setValores] = useState(valoresIniciais)

  function aplicarModo(novoModo) {
    setModo(novoModo)
    // Reinicia os valores para o novo modo
    const m = {}
    CATS_PADRAO.forEach(c => { m[c.id] = 0 })
    if (novoModo === 'real') {
      if (categoriasTotais.length > 0) {
        categoriasTotais.forEach(({ nome, valor }) => {
          const n = String(nome || '').toLowerCase()
          if (/morad|aluguel|financiamento|hipot/.test(n))     m.moradia     += valor
          else if (/cond|condom|iptu/.test(n))                 m.condominio  += valor
          else if (/água|agua|energ|luz|gás|gas/.test(n))      m.agua_energia += valor
          else if (/aliment|mercado|supermerc|comida|refeic/.test(n)) m.alimentacao += valor
          else if (/transport|comb|gasolina|onibus|metrô/.test(n)) m.transporte += valor
          else if (/saúde|saude|médic|plano|farmac/.test(n))   m.saude       += valor
          else if (/internet|telefone|celular|claro|vivo|tim|oi/.test(n)) m.internet += valor
          else if (/assina|stream|netflix|spotify/.test(n))    m.assinaturas += valor
          else if (/lazer|entret|cinema|viagem/.test(n))       m.lazer       += valor
          else                                                  m.outros      += valor
        })
      } else if (despesasReais > 0) {
        m.outros = despesasReais
      }
    }
    setValores(m)
  }

  function setValor(id, v) {
    setValores(prev => ({ ...prev, [id]: v }))
  }

  // Cálculos — sempre derivados do estado, sem side effects
  const { custoMensal, reserva, rendaIdeal, folgas } = useMemo(() => {
    const custo = Object.values(valores).reduce((s, v) => s + (Number(v) || 0), 0)
    const pctFolga = Math.min(99, Math.max(0, Number(folga) || 20)) / 100
    const meses    = Math.max(1, Math.round(Number(mesesReserva) || 6))
    const res      = custo * meses
    const renda    = pctFolga < 1 ? custo / (1 - pctFolga) : custo * 5
    return {
      custoMensal: custo,
      reserva:     res,
      rendaIdeal:  renda,
      folgas:      { pct: pctFolga * 100, meses },
    }
  }, [valores, folga, mesesReserva])

  const fmtR = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  // ── Renderização ────────────────────────────────────────────────────────────
  return (
    <div className="card !p-0 overflow-hidden">
      {/* Cabeçalho — sempre visível */}
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        aria-expanded={aberto}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 bg-marca-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Calculator size={17} className="text-marca" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Simulador de Custo de Vida</p>
          {!aberto && custoMensal > 0 && (
            <p className="text-xs text-gray-500 truncate">
              {fmtR(custoMensal)}/mês · reserva {fmtR(reserva)}
            </p>
          )}
          {!aberto && custoMensal === 0 && (
            <p className="text-xs text-gray-500">Calcule sua renda ideal e reserva de emergência</p>
          )}
        </div>
        {aberto ? <ChevronUp size={16} className="text-gray-400 shrink-0"/> : <ChevronDown size={16} className="text-gray-400 shrink-0"/>}
      </button>

      {!aberto && null}

      {aberto && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">

          {/* Seletor de modo */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'real',  label: 'Usar minhas despesas', desc: 'Importa do mês atual' },
              { id: 'livre', label: 'Simular do zero',      desc: 'Preencha livremente' },
            ].map(op => (
              <button key={op.id} type="button" onClick={() => aplicarModo(op.id)}
                className={`rounded-xl border p-2.5 text-left transition-colors ${
                  modo === op.id
                    ? 'border-marca bg-marca-100/40 text-marca'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <p className="text-xs font-semibold">{op.label}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">{op.desc}</p>
              </button>
            ))}
          </div>

          {modo === 'real' && despesasReais === 0 && categoriasTotais.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5">
              <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                Sem despesas no mês atual. Cadastre despesas ou use o modo "Simular do zero".
              </p>
            </div>
          )}

          {/* Categorias — sliders + valores */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">Despesas mensais</p>
            {CATS_PADRAO.map(cat => (
              <CatRow
                key={cat.id}
                nome={cat.nome}
                valor={valores[cat.id] || 0}
                onChange={v => setValor(cat.id, v)}
                compact={compact}
              />
            ))}
          </div>

          {/* Parâmetros */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Meses de reserva
              </label>
              <div className="flex items-center gap-2">
                {[3, 6, 12].map(m => (
                  <button key={m} type="button"
                    onClick={() => setMesesReserva(m)}
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                      mesesReserva === m ? 'border-marca bg-marca-100 text-marca' : 'border-gray-200 text-gray-600'
                    }`}>
                    {m}x
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Folga na renda ({folga}%)
              </label>
              <input type="range" min={5} max={50} step={5} value={folga}
                onChange={e => setFolga(Number(e.target.value))}
                className="w-full accent-marca" />
            </div>
          </div>

          {/* Resultados */}
          {custoMensal > 0 ? (
            <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
              <ResultRow
                label="Custo mensal total"
                valor={fmtR(custoMensal)}
                destaque
              />
              <ResultRow
                label={`Reserva de emergência (${folgas.meses} meses)`}
                valor={fmtR(reserva)}
              />
              <ResultRow
                label={`Renda líquida ideal (${folgas.pct}% de folga)`}
                valor={fmtR(rendaIdeal)}
              />
              <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200">
                Simulação isolada — não altera seu saldo, receitas nem despesas cadastradas.
              </p>
            </div>
          ) : (
            <p className="text-xs text-center text-gray-400 py-2">
              Informe ao menos um valor para ver os resultados.
            </p>
          )}

          {/* Botão limpar */}
          <button type="button"
            onClick={() => { const m = {}; CATS_PADRAO.forEach(c => { m[c.id] = 0 }); setValores(m) }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw size={12} /> Limpar valores
          </button>

        </div>
      )}
    </div>
  )
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function CatRow({ nome, valor, onChange, compact }) {
  const fmtR = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">{nome}</span>
      <div className="shrink-0 w-28">
        <InputMoeda
          valor={valor > 0 ? String(valor) : ''}
          onChangeValor={v => onChange(Number(v) || 0)}
          className="input !py-1.5 !text-xs text-right"
          prefixo={null}
          placeholder="R$ 0,00"
        />
      </div>
    </div>
  )
}

function ResultRow({ label, valor, destaque = false }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`text-xs ${destaque ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
        {label}
      </span>
      <span className={`text-sm font-bold tabular-nums ${destaque ? 'text-marca' : 'text-gray-900'}`}>
        {valor}
      </span>
    </div>
  )
}
