import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Loader2, Check } from 'lucide-react'
import { useDespesas } from '../hooks/useDespesas'
import { useReceitas } from '../hooks/useReceitas'
import { useCategorias } from '../hooks/useCategorias'
import { useCartoes } from '../hooks/useCartoes'
import { useBeneficios } from '../hooks/useBeneficios'
import InputMoeda from '../components/InputMoeda'
import SeletorCategoriaModerno from '../components/SeletorCategoriaModerno'
import { classificarDespesa } from '../lib/classificarDespesa'
import { hojeISO as hojeISOBrasil, FORMAS_PAGAMENTO } from '../lib/utils'

export default function RegistrarRapido() {
  const navigate = useNavigate()
  const { criar: adicionarDespesa, carregando: salvandoDespesa } = useDespesas()
  const { criar: adicionarReceita, carregando: salvandoReceita } = useReceitas()
  const { categorias: categoriasDespesa } = useCategorias('despesa')
  const { categorias: categoriasReceita } = useCategorias('receita')
  const { cartoes } = useCartoes()
  const { beneficios } = useBeneficios()
  
  const [tipo, setTipo] = useState('despesa')
  const [form, setForm] = useState({
    valor: '',
    descricao: '',
    data: hojeISOBrasil(),
    categoria_id: '',
    subcategoria_id: '',
    forma_pagamento: '',
    cartao_id: '',
    beneficio_id: '',
    parcelas: '1',
    frequencia: 'nao_repete',
  })
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)

  const categorias = tipo === 'despesa' ? categoriasDespesa : categoriasReceita
  const ehCartao = form.forma_pagamento === 'cartao_credito'
  const ehBeneficio = ['vr', 'va'].includes(form.forma_pagamento)

  useEffect(() => {
    if (form.descricao && tipo === 'despesa' && categoriasDespesa.length > 0) {
      const catSugerida = categoriasDespesa.find(c => 
        form.descricao.toLowerCase().includes(c.nome.toLowerCase())
      )
      if (catSugerida && !form.categoria_id) {
        setForm(prev => ({ ...prev, categoria_id: catSugerida.id }))
      }
    }
  }, [form.descricao, tipo, categoriasDespesa, form.categoria_id])

  function handleChange(campo, valor) {
    setForm(prev => ({
      ...prev,
      [campo]: valor,
      ...(campo === 'categoria_id' ? { subcategoria_id: '' } : {}),
      ...(campo === 'forma_pagamento' ? { cartao_id: '', beneficio_id: '' } : {}),
    }))
  }

  async function handleSalvar() {
    const valorNum = Number(form.valor)
    if (!Number.isFinite(valorNum) || valorNum <= 0) return
    if (ehCartao && !form.cartao_id) return
    if (ehBeneficio && !form.beneficio_id) return

    setSalvando(true)
    setSucesso(false)

    try {
      const categoria = categorias.find(c => c.id === form.categoria_id)
      const descricao = form.descricao.trim() || categoria?.nome || (tipo === 'despesa' ? 'Despesa' : 'Receita')

      if (tipo === 'despesa') {
        const tipo_despesa = classificarDespesa({ descricao, categoria: categoria?.nome || '' })
        await adicionarDespesa({
          descricao,
          valor: valorNum,
          data: form.data,
          recorrente: form.frequencia !== 'nao_repete',
          frequencia: form.frequencia,
          categoria_id: form.categoria_id || null,
          subcategoria_id: form.subcategoria_id || null,
          tipo_despesa,
          forma_pagamento: form.forma_pagamento,
          cartao_id: ehCartao ? form.cartao_id : null,
          beneficio_id: ehBeneficio ? form.beneficio_id : null,
          tipo_beneficio: ehBeneficio ? form.forma_pagamento.toUpperCase() : null,
          numero_parcelas: ehCartao ? Number(form.parcelas) : null,
        })
      } else {
        await adicionarReceita({
          descricao,
          valor: valorNum,
          data: form.data,
          recorrente: form.frequencia !== 'nao_repete',
          frequencia: form.frequencia,
          categoria_id: form.categoria_id || null,
        })
      }

      setSucesso(true)
      setTimeout(() => {
        setForm({
          valor: '',
          descricao: '',
          data: hojeISOBrasil(),
          categoria_id: '',
          subcategoria_id: '',
          forma_pagamento: '',
          cartao_id: '',
          beneficio_id: '',
          parcelas: '1',
          frequencia: 'nao_repete',
        })
        setSucesso(false)
      }, 1500)
    } catch (erro) {
      console.error('Erro ao salvar:', erro)
      alert(`Erro ao salvar lançamento: ${erro.message || 'Verifique sua conexão e tente novamente.'}`)
    } finally {
      setSalvando(false)
    }
  }

  function fechar() {
    navigate(-1)
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Registrar</h2>
          <button onClick={fechar} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setTipo('despesa')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tipo === 'despesa'
                  ? 'bg-marca text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Despesa
            </button>
            <button
              onClick={() => setTipo('receita')}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                tipo === 'receita'
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Receita
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Valor *
            </label>
            <InputMoeda
              valor={form.valor}
              onChangeValor={(v) => handleChange('valor', v)}
              placeholder="R$ 0,00"
              className="w-full text-2xl"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição
            </label>
            <input
              type="text"
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Ex: Almoço, Uber, Mercado..."
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              value={form.data}
              onChange={(e) => handleChange('data', e.target.value)}
              className="input w-full"
            />
          </div>

          <SeletorCategoriaModerno
            categorias={categorias}
            value={form.categoria_id}
            onChange={(catId) => handleChange('categoria_id', catId)}
            subcategoriaValue={form.subcategoria_id}
            onSubcategoriaChange={(subId) => handleChange('subcategoria_id', subId)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tipo === 'despesa' ? 'Essa despesa se repete?' : 'Essa receita se repete?'}
            </label>
            <select
              value={form.frequencia}
              onChange={(e) => handleChange('frequencia', e.target.value)}
              className="input w-full"
            >
              <option value="nao_repete">Não</option>
              <option value="mensal">Mensalmente</option>
              <option value="semanal">Semanalmente</option>
              <option value="diaria">Diariamente</option>
            </select>
          </div>

          {tipo === 'despesa' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Forma de pagamento *
                </label>
                <select
                  value={form.forma_pagamento}
                  onChange={(e) => handleChange('forma_pagamento', e.target.value)}
                  className="input w-full"
                >
                  <option value="">⚪ Não informado</option>
                  {FORMAS_PAGAMENTO.map(f => (
                    <option key={f.value} value={f.value}>{f.icone} {f.label}</option>
                  ))}
                  <option value="vr">🍽 Vale-refeição (VR)</option>
                  <option value="va">🛒 Vale-alimentação (VA)</option>
                </select>
              </div>

              {ehCartao && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cartão *
                    </label>
                    <select
                      value={form.cartao_id}
                      onChange={(e) => handleChange('cartao_id', e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Selecione...</option>
                      {cartoes.filter(c => c.ativo).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Parcelas
                    </label>
                    <select
                      value={form.parcelas}
                      onChange={(e) => handleChange('parcelas', e.target.value)}
                      className="input w-full"
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(n => (
                        <option key={n} value={n}>
                          {n}x de {(Number(form.valor) / n).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {ehBeneficio && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Benefício *
                  </label>
                  <select
                    value={form.beneficio_id}
                    onChange={(e) => handleChange('beneficio_id', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Selecione...</option>
                    {beneficios
                      .filter(b => b.tipo === form.forma_pagamento.toUpperCase())
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.nome}</option>
                      ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSalvar}
              disabled={salvando || !form.valor}
              className="flex-1 btn-primary"
            >
              {salvando ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : sucesso ? (
                <>
                  <Check size={18} />
                  <span>Salvo!</span>
                </>
              ) : (
                <span>Salvar lançamento</span>
              )}
            </button>
            
            {sucesso && (
              <button onClick={handleSalvar} className="btn-secondary px-4">
                Registrar outro
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
