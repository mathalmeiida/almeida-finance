import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, FileText, Shield, ChevronRight } from 'lucide-react'

// Versão lida do package.json via import.meta.env (Vite expõe como string vazia
// se não estiver definido). Como não há campo customizado, usamos a constante
// que o próprio Vite injeta via define em vite.config, ou o fallback fixo.
// Mantenemos uma variável de fácil atualização — sem inventar versões.
const APP_VERSION = '1.4.0'
const APP_NAME    = 'Almeida Finance'
const APP_DESC    = 'Sua vida financeira de forma simples, inteligente e no seu controle.'

export default function SobreApp() {
  const navigate = useNavigate()

  const cardCls = 'card divide-y divide-gray-100 !p-0 overflow-hidden'
  const linhaBtn = 'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 cursor-default'

  return (
    <div className="min-h-[100dvh] bg-gray-50 -mx-4 -mt-1">
      {/* Cabeçalho */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 bg-white border-b border-gray-100 px-4 h-14"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Voltar"
          className="touch-target -ml-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 flex items-center justify-center"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1 text-center">
          Sobre o {APP_NAME}
        </h1>
        <span className="w-9" />
      </header>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Identidade */}
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Logo AF — usa af-icone.png que tem fundo vinho arredondado */}
          <img
            src="/branding/af-icone.png"
            alt={APP_NAME}
            className="w-24 h-auto"
          />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{APP_NAME}</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xs">{APP_DESC}</p>
          </div>
        </div>

        {/* Cards de informação */}
        <section>
          <div className={cardCls}>
            {/* Versão */}
            <div className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
                <Info size={19} className="text-marca" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Versão do aplicativo</p>
              </div>
              <span className="text-sm font-semibold text-marca flex-shrink-0">
                v{APP_VERSION}
              </span>
            </div>

            {/* Política de Privacidade */}
            <div className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Shield size={19} className="text-blue-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Política de Privacidade</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </div>

            {/* Termos de Uso */}
            <div className={linhaBtn}>
              <span className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <FileText size={19} className="text-violet-600" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Termos de Uso</p>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </div>
          </div>
        </section>

        {/* Nota de rodapé */}
        <p className="text-center text-xs text-gray-400">
          © {new Date().getFullYear()} {APP_NAME} · Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
