import React, { useState } from 'react'
import { Download, FileText, Database, Calendar, Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificacao } from '../contexts/NotificacaoContext'
import { supabase } from '../lib/supabase'
import { hojeISO, partesHojeBrasil } from '../lib/utils'
import FiltroPeriodo from '../components/FiltroPeriodo'

/**
 * Página de exportação de dados
 * Permite exportar dados financeiros em CSV ou JSON
 */

export default function ExportarDados() {
  const { usuario } = useAuth()
  const { notificar } = useNotificacao()
  const [exportando, setExportando] = useState(false)
  const [formato, setFormato] = useState('csv') // 'csv' | 'json'
  const [periodo, setPeriodo] = useState({
    tipo: 'mes-atual',
    inicio: '',
    fim: ''
  })

  // Calcula período inicial
  React.useEffect(() => {
    const { ano, mes } = partesHojeBrasil()
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    setPeriodo(prev => ({ ...prev, inicio, fim }))
  }, [])

  // Busca dados do período
  const buscarDados = async () => {
    if (!usuario?.id) throw new Error('Usuário não autenticado')

    const { inicio, fim } = periodo

    // Buscar todas as tabelas em paralelo
    const [
      receitas,
      despesas,
      comprasCartao,
      cartoes,
      parcelamentos,
      metas,
      investimentos,
      beneficios,
      contas
    ] = await Promise.all([
      supabase
        .from('receitas')
        .select('*, categorias(nome, icone)')
        .eq('usuario_id', usuario.id)
        .gte('data_recebimento', inicio)
        .lte('data_recebimento', fim)
        .order('data_recebimento', { ascending: false }),

      supabase
        .from('despesas')
        .select('*, categorias(nome, icone)')
        .eq('usuario_id', usuario.id)
        .gte('data_vencimento', inicio)
        .lte('data_vencimento', fim)
        .order('data_vencimento', { ascending: false }),

      supabase
        .from('compras_cartao')
        .select('*, categorias(nome, icone), cartoes(nome)')
        .eq('usuario_id', usuario.id)
        .gte('data_compra', inicio)
        .lte('data_compra', fim)
        .order('data_compra', { ascending: false }),

      supabase
        .from('cartoes')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('nome'),

      supabase
        .from('parcelamentos')
        .select('*, categorias(nome, icone)')
        .eq('usuario_id', usuario.id)
        .order('primeira_parcela', { ascending: false }),

      supabase
        .from('metas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('criado_em', { ascending: false }),

      supabase
        .from('investimentos')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('data_aplicacao', { ascending: false }),

      supabase
        .from('beneficios')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('tipo'),

      supabase
        .from('contas')
        .select('*')
        .eq('usuario_id', usuario.id)
        .order('nome')
    ])

    // Verificar erros
    const erros = [
      receitas.error,
      despesas.error,
      comprasCartao.error,
      cartoes.error,
      parcelamentos.error,
      metas.error,
      investimentos.error,
      beneficios.error,
      contas.error
    ].filter(Boolean)

    if (erros.length > 0) {
      throw new Error(`Erro ao buscar dados: ${erros[0].message}`)
    }

    return {
      receitas: receitas.data || [],
      despesas: despesas.data || [],
      compras_cartao: comprasCartao.data || [],
      cartoes: cartoes.data || [],
      parcelamentos: parcelamentos.data || [],
      metas: metas.data || [],
      investimentos: investimentos.data || [],
      beneficios: beneficios.data || [],
      contas: contas.data || []
    }
  }

  // Exportar CSV
  const exportarCSV = (dados, nomeArquivo) => {
    if (dados.length === 0) return ''

    const colunas = Object.keys(dados[0])
    const cabecalho = colunas.join(',')
    
    const linhas = dados.map(item => {
      return colunas.map(col => {
        let valor = item[col]
        
        // Trata objetos aninhados (categorias, cartoes)
        if (typeof valor === 'object' && valor !== null) {
          valor = valor.nome || JSON.stringify(valor)
        }
        
        // Escapa aspas e vírgulas
        if (typeof valor === 'string') {
          valor = `"${valor.replace(/"/g, '""')}"`
        }
        
        return valor
      }).join(',')
    })

    return cabecalho + '\n' + linhas.join('\n')
  }

  // Baixar arquivo
  const baixarArquivo = (conteudo, nomeArquivo, tipo) => {
    const blob = new Blob([conteudo], { type: tipo })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nomeArquivo
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Handler de exportação
  const handleExportar = async () => {
    setExportando(true)

    try {
      const dados = await buscarDados()
      const dataHoje = hojeISO()

      if (formato === 'csv') {
        // Exporta cada tabela em um CSV separado
        Object.entries(dados).forEach(([tabela, registros]) => {
          if (registros.length === 0) return

          const csv = exportarCSV(registros, tabela)
          baixarArquivo(
            csv,
            `almeida-finance-${tabela}-${dataHoje}.csv`,
            'text/csv;charset=utf-8;'
          )
        })

        notificar.sucesso(`${Object.keys(dados).length} arquivos CSV exportados`)
      } else {
        // Exporta tudo em um JSON único
        const json = JSON.stringify({
          exportado_em: new Date().toISOString(),
          periodo: {
            inicio: periodo.inicio,
            fim: periodo.fim
          },
          dados
        }, null, 2)

        baixarArquivo(
          json,
          `almeida-finance-backup-${dataHoje}.json`,
          'application/json'
        )

        notificar.sucesso('Backup JSON exportado')
      }
    } catch (err) {
      console.error('[ExportarDados] Erro:', err)
      notificar.erro('Não conseguimos exportar. Tente novamente')
    } finally {
      setExportando(false)
    }
  }

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Exportar Dados
        </h1>
        <p className="text-sm text-gray-600">
          Baixe seus dados financeiros em CSV ou JSON para backup ou análise externa
        </p>
      </div>

      {/* Formato */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Formato do arquivo
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormato('csv')}
            className={`
              p-4 rounded-xl border-2 transition-all text-left
              ${formato === 'csv'
                ? 'border-marca bg-marca-100'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <FileText size={24} className="text-marca mb-2" />
            <div className="font-semibold text-gray-900 mb-1">CSV</div>
            <div className="text-xs text-gray-600">
              Para análise em planilhas (Excel, Google Sheets)
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFormato('json')}
            className={`
              p-4 rounded-xl border-2 transition-all text-left
              ${formato === 'json'
                ? 'border-marca bg-marca-100'
                : 'border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <Database size={24} className="text-marca mb-2" />
            <div className="font-semibold text-gray-900 mb-1">JSON</div>
            <div className="text-xs text-gray-600">
              Backup completo estruturado
            </div>
          </button>
        </div>
      </div>

      {/* Período */}
      <div className="card">
        <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar size={18} />
          Período
        </h2>
        <FiltroPeriodo
          valor={periodo}
          onChange={setPeriodo}
          opcoes={['mes-atual', 'mes-anterior', 'ultimos-3-meses', 'ultimos-6-meses', 'este-ano', 'personalizado']}
          mostrarNavegacao={false}
        />
      </div>

      {/* Informações */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">
          O que será exportado?
        </h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Receitas e despesas do período</li>
          <li>• Compras e cartões de crédito</li>
          <li>• Parcelamentos ativos</li>
          <li>• Metas e investimentos</li>
          <li>• Benefícios (VR/VA)</li>
          <li>• Contas bancárias</li>
        </ul>
        <p className="text-xs text-blue-700 mt-3">
          ⚠️ Senhas, tokens e dados de outros usuários <strong>não</strong> são incluídos
        </p>
      </div>

      {/* Botão de exportar */}
      <button
        type="button"
        onClick={handleExportar}
        disabled={exportando || !periodo.inicio || !periodo.fim}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {exportando ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Exportando...
          </>
        ) : (
          <>
            <Download size={18} />
            Exportar {formato.toUpperCase()}
          </>
        )}
      </button>
    </div>
  )
}
