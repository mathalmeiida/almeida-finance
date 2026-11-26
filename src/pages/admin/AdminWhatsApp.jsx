import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { 
  MessageSquare, 
  Send, 
  ArrowLeft, 
  Info, 
  Edit2, 
  X, 
  Check,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Save,
  Database,
  TestTube
} from 'lucide-react'
import { parseWhatsAppMessage, validarMensagem } from '../../lib/whatsappParser'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminWhatsApp() {
  const { usuario } = useAuth()
  const [mensagemInput, setMensagemInput] = useState('')
  const [mensagens, setMensagens] = useState([])
  const [previewTransacao, setPreviewTransacao] = useState(null)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [valoresEditados, setValoresEditados] = useState({})
  const [modoSimulacao, setModoSimulacao] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, previewTransacao])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const exemplos = [
    { texto: 'Recebi 3000 de salário', descricao: 'Receita simples' },
    { texto: 'Gastei 150 no mercado categoria alimentação', descricao: 'Despesa com categoria' },
    { texto: 'Paguei 50 de luz', descricao: 'Despesa curta' },
    { texto: 'Entrada de 500 freelance categoria renda extra', descricao: 'Receita com categoria' }
  ]

  const handleEnviarMensagem = () => {
    const textoMensagem = mensagemInput.trim()
    if (!textoMensagem) return

    const validacao = validarMensagem(textoMensagem)
    if (!validacao.valida) {
      setMensagens(prev => [...prev, {
        id: Date.now(),
        tipo: 'erro',
        texto: textoMensagem,
        erro: validacao.erro,
        timestamp: new Date()
      }])
      setMensagemInput('')
      return
    }

    const resultado = parseWhatsAppMessage(textoMensagem)
    if (!resultado.sucesso) {
      setMensagens(prev => [...prev, {
        id: Date.now(),
        tipo: 'erro',
        texto: textoMensagem,
        erro: resultado.erro,
        timestamp: new Date()
      }])
      setMensagemInput('')
      return
    }

    const novaMensagem = {
      id: Date.now(),
      tipo: 'usuario',
      texto: textoMensagem,
      timestamp: new Date()
    }

    setMensagens(prev => [...prev, novaMensagem])
    setPreviewTransacao({
      id: Date.now(),
      mensagemOriginal: textoMensagem,
      ...resultado.transacao
    })
    setValoresEditados({
      descricao: resultado.transacao.descricao,
      valor: resultado.transacao.valor,
      categoria: resultado.transacao.categoria || ''
    })
    setMensagemInput('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEnviarMensagem()
    }
  }

  const handleUsarExemplo = (exemplo) => {
    setMensagemInput(exemplo)
    inputRef.current?.focus()
  }

  const handleCancelarPreview = () => {
    setPreviewTransacao(null)
    setModoEdicao(false)
    setValoresEditados({})
  }

  const handleEditarPreview = () => {
    setModoEdicao(true)
  }

  const handleSalvarEdicao = () => {
    setPreviewTransacao(prev => ({
      ...prev,
      descricao: valoresEditados.descricao,
      valor: valoresEditados.valor,
      categoria: valoresEditados.categoria
    }))
    setModoEdicao(false)
  }

  const handleCancelarEdicao = () => {
    setValoresEditados({
      descricao: previewTransacao.descricao,
      valor: previewTransacao.valor,
      categoria: previewTransacao.categoria || ''
    })
    setModoEdicao(false)
  }

  const handleConfirmarTransacao = async () => {
    if (modoSimulacao) {
      // Modo simulação - apenas feedback visual
      const mensagemConfirmacao = {
        id: Date.now(),
        tipo: 'sistema',
        texto: `✅ Transação registrada com sucesso!\n\n` +
              `${previewTransacao.tipo === 'receita' ? '📈' : '📉'} ${previewTransacao.descricao}\n` +
              `Valor: R$ ${previewTransacao.valor.toFixed(2)}\n` +
              (previewTransacao.categoria ? `Categoria: ${previewTransacao.categoria}\n` : '') +
              `\n⚠️ Modo simulação - não foi gravado no banco de dados`,
        timestamp: new Date()
      }
      setMensagens(prev => [...prev, mensagemConfirmacao])
      setPreviewTransacao(null)
      setModoEdicao(false)
      setValoresEditados({})
    } else {
      // Modo real - gravar no banco
      setSalvando(true)
      try {
        const dataTransacao = {
          usuario_id: usuario.id,
          descricao: previewTransacao.descricao,
          valor: previewTransacao.valor,
          data: new Date().toISOString().split('T')[0],
          categoria: previewTransacao.categoria || null,
          origem: 'whatsapp'
        }

        let erro = null
        if (previewTransacao.tipo === 'receita') {
          const { error } = await supabase.from('receitas').insert([dataTransacao])
          erro = error
        } else {
          const { error } = await supabase.from('despesas').insert([dataTransacao])
          erro = error
        }

        if (erro) throw erro

        const mensagemConfirmacao = {
          id: Date.now(),
          tipo: 'sistema',
          texto: `✅ Transação salva no banco de dados!\n\n` +
                `${previewTransacao.tipo === 'receita' ? '📈' : '📉'} ${previewTransacao.descricao}\n` +
                `Valor: R$ ${previewTransacao.valor.toFixed(2)}\n` +
                (previewTransacao.categoria ? `Categoria: ${previewTransacao.categoria}\n` : '') +
                `\n💾 Gravado com sucesso`,
          timestamp: new Date()
        }
        setMensagens(prev => [...prev, mensagemConfirmacao])
        setPreviewTransacao(null)
        setModoEdicao(false)
        setValoresEditados({})
      } catch (erro) {
        const mensagemErro = {
          id: Date.now(),
          tipo: 'erro',
          texto: 'Erro ao salvar',
          erro: erro.message || 'Não foi possível gravar a transação no banco de dados',
          timestamp: new Date()
        }
        setMensagens(prev => [...prev, mensagemErro])
      } finally {
        setSalvando(false)
      }
    }
  }

  const formatarData = (data) => {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-marca text-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/admin" className="p-2 hover:bg-white/10 rounded-lg transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <MessageSquare className="w-6 h-6" />
          <div className="flex-1">
            <h1 className="text-lg font-semibold">WhatsApp Financeiro</h1>
            <p className="text-xs text-white/80">Simulador de chat</p>
          </div>
          <button
            onClick={() => setModoSimulacao(!modoSimulacao)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              modoSimulacao 
                ? 'bg-white/20 hover:bg-white/30' 
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {modoSimulacao ? (
              <>
                <TestTube className="w-4 h-4" />
                Simulação
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                Real
              </>
            )}
          </button>
        </div>
      </header>

      {/* Info banner */}
      <div className={`border-b ${modoSimulacao ? 'bg-blue-50 border-blue-100' : 'bg-green-50 border-green-100'}`}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-start gap-3">
          <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${modoSimulacao ? 'text-blue-600' : 'text-green-600'}`} />
          <div className="text-sm">
            <p className={`font-medium ${modoSimulacao ? 'text-blue-900' : 'text-green-900'}`}>
              {modoSimulacao ? 'Modo Simulação Ativo' : 'Modo Real Ativo'}
            </p>
            <p className={modoSimulacao ? 'text-blue-700' : 'text-green-700'}>
              {modoSimulacao 
                ? 'As transações são processadas localmente e não são salvas no banco de dados. Use para testar o formato das mensagens.'
                : 'As transações confirmadas serão gravadas no banco de dados como transações reais. Use com cuidado.'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Exemplos iniciais */}
          {mensagens.length === 0 && !previewTransacao && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-marca" />
                Exemplos de Mensagens
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Clique em um exemplo para testar ou digite sua própria mensagem:
              </p>
              <div className="space-y-2">
                {exemplos.map((exemplo, index) => (
                  <button
                    key={index}
                    onClick={() => handleUsarExemplo(exemplo.texto)}
                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-marca hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{exemplo.texto}</p>
                        <p className="text-xs text-gray-500 mt-1">{exemplo.descricao}</p>
                      </div>
                      <Send className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mensagens do chat */}
          {mensagens.map((msg) => (
            <div key={msg.id} className={`flex ${msg.tipo === 'usuario' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.tipo === 'usuario' ? 'bg-marca text-white' :
                  msg.tipo === 'erro' ? 'bg-red-50 border border-red-200' :
                  'bg-green-50 border border-green-200'
                }`}>
                {msg.tipo === 'erro' && (
                  <div className="flex items-start gap-2 mb-1">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-red-900">Erro ao processar</p>
                  </div>
                )}
                <p className={`text-sm whitespace-pre-wrap ${
                  msg.tipo === 'usuario' ? 'text-white' : 
                  msg.tipo === 'erro' ? 'text-red-900' : 'text-green-900'
                }`}>
                  {msg.tipo === 'erro' ? msg.erro : msg.texto}
                </p>
                <p className={`text-xs mt-1 ${msg.tipo === 'usuario' ? 'text-white/70' : 'text-gray-500'}`}>
                  {formatarData(msg.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {/* Preview da transação */}
          {previewTransacao && (
            <div className="bg-white rounded-lg shadow-md border-2 border-marca p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {previewTransacao.tipo === 'receita' ? (
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                  <h3 className="font-semibold text-gray-900">
                    {previewTransacao.tipo === 'receita' ? 'Nova Receita' : 'Nova Despesa'}
                  </h3>
                </div>
                {!modoEdicao && (
                  <button onClick={handleEditarPreview} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Editar">
                    <Edit2 className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>

              {modoEdicao ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <input
                      type="text"
                      value={valoresEditados.descricao}
                      onChange={(e) => setValoresEditados(prev => ({ ...prev, descricao: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-marca focus:border-marca"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={valoresEditados.valor}
                      onChange={(e) => setValoresEditados(prev => ({ ...prev, valor: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-marca focus:border-marca"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (opcional)</label>
                    <input
                      type="text"
                      value={valoresEditados.categoria}
                      onChange={(e) => setValoresEditados(prev => ({ ...prev, categoria: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-marca focus:border-marca"
                      placeholder="Ex: Alimentação, Salário, etc."
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={handleSalvarEdicao} className="flex-1 px-4 py-2 bg-marca text-white rounded-lg hover:bg-marca-hover transition-colors flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      Salvar
                    </button>
                    <button onClick={handleCancelarEdicao} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Descrição:</span>
                      <span className="text-sm font-medium text-gray-900">{previewTransacao.descricao}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Valor:</span>
                      <span className={`text-lg font-bold ${previewTransacao.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        R$ {previewTransacao.valor.toFixed(2)}
                      </span>
                    </div>
                    {previewTransacao.categoria && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Categoria:</span>
                        <span className="text-sm font-medium text-gray-900">{previewTransacao.categoria}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-xs text-blue-900">
                      <strong>Mensagem original:</strong> "{previewTransacao.mensagemOriginal}"
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={handleConfirmarTransacao} 
                      disabled={salvando}
                      className="flex-1 px-4 py-2.5 bg-marca text-white rounded-lg hover:bg-marca-hover transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {salvando ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Confirmar
                        </>
                      )}
                    </button>
                    <button onClick={handleCancelarPreview} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                      <X className="w-5 h-5" />
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 sticky bottom-0">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={mensagemInput}
              onChange={(e) => setMensagemInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem financeira..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-marca focus:border-marca"
              disabled={!!previewTransacao}
            />
            <button
              onClick={handleEnviarMensagem}
              disabled={!mensagemInput.trim() || !!previewTransacao}
              className="px-6 py-3 bg-marca text-white rounded-lg hover:bg-marca-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
          {previewTransacao && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Confirme ou cancele a transação acima para continuar
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
