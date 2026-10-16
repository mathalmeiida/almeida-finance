import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const ORDEM = ['Moradia', 'Mercado', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Assinaturas', 'Moda e Beleza', 'Tecnologia', 'Casa e Decoração', 'Pets', 'Viagens', 'Empréstimos', 'Impostos e Taxas', 'Seguros', 'Presentes e Doações', 'Outros']
const ICONES = { Moradia: '🏠', Mercado: '🛒', 'Alimentação': '🍽️', Transporte: '🚗', 'Saúde': '❤️', 'Educação': '🎓', Lazer: '🎮', Assinaturas: '🔄', 'Moda e Beleza': '👕', Tecnologia: '📱', 'Casa e Decoração': '🛋️', Pets: '🐾', Viagens: '✈️', 'Empréstimos': '💰', 'Impostos e Taxas': '🧾', Seguros: '🛡️', 'Presentes e Doações': '🎁', Outros: '📦' }
const ANTIGAS = { Internet: 'Moradia', 'Móveis': 'Casa e Decoração', 'Eletrônicos': 'Tecnologia', Vestuário: 'Moda e Beleza', 'Serviços': 'Assinaturas' }

// Compatível com a tabela categorias existente. As subcategorias são
// buscadas na tabela public.subcategorias, e NÃO no campo categorias.nome.
// onChange continua recebendo o ID da categoria para preservar o cadastro atual.
// onSubcategoriaChange é opcional: o formulário pai precisa tratar e persistir
// esse ID para que a subcategoria seja salva no banco de dados.
export default function SeletorCategoriaModerno({
  categorias = [], value = '', onChange,
  subcategoriaValue = '', onSubcategoriaChange,
}) {
  const [busca, setBusca] = useState('')
  const [aberta, setAberta] = useState(false)
  const [grupoAberto, setGrupoAberto] = useState('')
  const [subcategorias, setSubcategorias] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      setCarregando(true)
      setErro('')
      const { data, error } = await supabase
        .from('subcategorias')
        .select('id, categoria_id, nome')
        .order('nome')
      if (!ativo) return
      if (error) {
        setErro('Não foi possível carregar as subcategorias. Verifique as permissões no Supabase.')
        setSubcategorias([])
        console.error('Erro ao carregar subcategorias:', error)
      } else {
        setSubcategorias(data || [])
      }
      setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [])

  const selecionada = categorias.find(c => String(c.id) === String(value))
  const grupos = useMemo(() => {
    const mapa = new Map()
    for (const c of categorias) {
      const nome = (c.nome || '').trim()
      const grupo = ANTIGAS[nome] || nome
      if (!mapa.has(grupo)) mapa.set(grupo, [])
      mapa.get(grupo).push(c)
    }
    return [...mapa.entries()].sort((a, b) => {
      const x = ORDEM.indexOf(a[0]), y = ORDEM.indexOf(b[0])
      return (x < 0 ? 1000 : x) - (y < 0 ? 1000 : y) || a[0].localeCompare(b[0], 'pt-BR')
    })
  }, [categorias])

  const filtrados = grupos.filter(([nome, lista]) =>
    !busca || nome.toLowerCase().includes(busca.toLowerCase()) ||
    lista.some(c => (c.nome || '').toLowerCase().includes(busca.toLowerCase()) ||
      subcategorias.some(s => String(s.categoria_id) === String(c.id) && s.nome.toLowerCase().includes(busca.toLowerCase())))
  )
  const atual = filtrados.find(([nome]) => nome === grupoAberto)
  const escolherCategoria = (cat) => {
    onChange?.(String(cat.id))
    onSubcategoriaChange?.('')
  }
  const escolherSubcategoria = (cat, sub) => {
    onChange?.(String(cat.id))
    onSubcategoriaChange?.(String(sub.id))
    setAberta(false)
    setBusca('')
  }
  const selecionarSemCategoria = () => {
    onChange?.('')
    onSubcategoriaChange?.('')
    setAberta(false)
    setBusca('')
  }
  const nomeSubSelecionada = subcategorias.find(s => String(s.id) === String(subcategoriaValue))?.nome

  return (
    <div className="space-y-2">
      <label className="label">Categoria</label>
      <button type="button" aria-expanded={aberta} onClick={() => setAberta(v => !v)}
        className="input w-full flex items-center justify-between gap-3 text-left">
        <span className="truncate">{selecionada?.icone || '📂'} {selecionada?.nome || 'Escolher categoria'}{nomeSubSelecionada ? ` › ${nomeSubSelecionada}` : ''}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {aberta && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-3 shadow-sm">
          <input className="input w-full" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar categoria ou subcategoria" aria-label="Buscar categoria" />
          <button type="button" onClick={selecionarSemCategoria} className="text-xs text-gray-500 underline">Sem categoria</button>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {filtrados.map(([nome, lista]) => (
              <button key={nome} type="button" onClick={() => setGrupoAberto(nome)}
                className={`min-w-0 rounded-xl p-3 text-center border transition-colors ${grupoAberto === nome ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300'}`}>
                <span className="block text-xl mb-1">{ICONES[nome] || lista[0]?.icone || '📂'}</span>
                <span className="block text-xs font-semibold text-gray-800 break-words">{nome}</span>
              </button>
            ))}
          </div>
          {atual && (
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <p className="text-xs font-semibold text-gray-700">{atual[0]} — escolha uma opção</p>
              {carregando && <p className="text-xs text-gray-500">Carregando subcategorias...</p>}
              {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
              <div className="grid grid-cols-2 gap-2">
                {atual[1].map(c => {
                  const subs = subcategorias.filter(s => String(s.categoria_id) === String(c.id))
                  return (
                    <React.Fragment key={c.id}>
                      <button type="button" onClick={() => { escolherCategoria(c); setAberta(false); setBusca('') }}
                        className="rounded-lg border border-gray-200 bg-gray-50 text-gray-800 px-2 py-2 text-left text-xs break-words">
                        Somente {atual[0]}
                      </button>
                      {subs.filter(s => s.nome.toLowerCase() !== 'geral').map(s => (
                        <button type="button" key={s.id} onClick={() => escolherSubcategoria(c, s)}
                          className={`rounded-lg border px-2 py-2 text-left text-xs break-words ${String(subcategoriaValue) === String(s.id) ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>
                          {s.nome}
                        </button>
                      ))}
                      {subs.some(s => s.nome.toLowerCase() === 'geral') && (
                        <button type="button" onClick={() => escolherSubcategoria(c, subs.find(s => s.nome.toLowerCase() === 'geral'))}
                          className="rounded-lg border border-gray-200 bg-gray-50 text-gray-800 px-2 py-2 text-left text-xs">Outros gastos</button>
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
              {!carregando && !erro && atual[1].every(c => !subcategorias.some(s => String(s.categoria_id) === String(c.id))) && (
                <p className="text-xs text-gray-500">Nenhuma subcategoria disponível. Você pode escolher somente a categoria.</p>
              )}
              {!onSubcategoriaChange && (
                <p className="text-xs text-amber-700">A tela ainda não grava subcategorias separadamente. Esta seleção salva apenas a categoria principal.</p>
              )}
            </div>
          )}
          {!filtrados.length && <p className="text-xs text-gray-500">Nenhuma categoria encontrada.</p>}
        </div>
      )}
    </div>
  )
}
