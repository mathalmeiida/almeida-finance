import React from 'react'

// Captura erros de renderização em qualquer parte do app e mostra uma tela
// amigável em vez de uma PÁGINA EM BRANCO (comportamento padrão do React quando
// um erro não é capturado). Oferece recarregar e ir para a Home.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { erro: null }
  }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    // Log para depuração (não interrompe o usuário).
    console.error('[ErrorBoundary] erro de render:', erro, info)
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm text-center bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Algo deu errado</h1>
            <p className="text-sm text-gray-500 mb-6">
              Tivemos um problema ao exibir esta tela. Tente recarregar — seus dados estão salvos.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary w-full"
              >
                Recarregar
              </button>
              <button
                onClick={() => window.location.assign('/')}
                className="btn-secondary w-full"
              >
                Ir para o início
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
