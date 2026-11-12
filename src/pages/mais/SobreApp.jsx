import React from 'react'
import { Info, ShieldCheck, Sparkles } from 'lucide-react'
import PaginaInterna from '../../components/PaginaInterna'

// Valores injetados no build (vite.config.js): versão do package.json e, na
// Vercel, o commit publicado. Nada aqui é inventado.
const VERSAO = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''
const BUILD = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : ''

const DESTAQUES = [
  'Saldo, receitas e despesas em um só lugar',
  'Limite diário e saldo seguro até a próxima receita',
  'Calendário financeiro e projeção dos próximos meses',
  'Cartões, faturas e compras parceladas',
  'Benefícios VR/VA e investimentos',
  'Metas, simulações "Posso comprar?" e "E se...?"',
  'Consultoria com acesso autorizado por você',
]

export default function SobreApp() {
  return (
    <PaginaInterna largo titulo="Sobre o Almeida Finance">
      {/* Identidade — logo AF original (af-icone.png, fundo vinho) */}
      <div className="flex flex-col items-center gap-4 text-center py-2 md:flex-row md:text-left md:card md:gap-6" data-testid="sobre-cabecalho">
        <img src="/branding/af-icone.png" alt="Almeida Finance" className="w-24 h-auto md:w-20 md:flex-shrink-0" />
        <div className="md:flex-1 md:min-w-0">
          <h2 className="text-lg font-bold text-gray-900">Almeida Finance</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto md:max-w-none md:mx-0">
            Organize, planeje e invista: controle financeiro pessoal simples e no seu controle.
          </p>
        </div>
        <span className="hidden md:inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-marca-100 px-4 py-2 text-sm font-semibold text-marca" data-testid="sobre-versao-desktop">
          <Info size={16} /> {VERSAO ? `v${VERSAO}` : 'versão não informada'}{BUILD ? ` · ${BUILD}` : ''}
        </span>
      </div>

      <section className="card !p-0 divide-y divide-gray-100 overflow-hidden md:hidden" aria-label="Informações do aplicativo">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="w-10 h-10 rounded-xl bg-marca-100 flex items-center justify-center flex-shrink-0">
            <Info size={19} className="text-marca" />
          </span>
          <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900">Versão do aplicativo</p>
          <span className="text-sm font-semibold text-marca flex-shrink-0">
            {VERSAO ? `v${VERSAO}` : 'não informada'}{BUILD ? ` · ${BUILD}` : ''}
          </span>
        </div>
      </section>

      <div className="space-y-5 md:space-y-0 md:grid md:grid-cols-2 md:gap-5 md:items-start">
      <section className="card" aria-label="Principais funcionalidades">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3">
          <Sparkles size={16} className="text-marca" /> Principais funcionalidades
        </h2>
        <ul className="space-y-2">
          {DESTAQUES.map(t => (
            <li key={t} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-marca flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-label="Privacidade">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
          <ShieldCheck size={16} className="text-marca" /> Privacidade e segurança
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed">
          Seus dados ficam protegidos por autenticação e por regras de acesso no banco de dados
          (RLS): cada usuário acessa somente as próprias informações. Você só compartilha seus
          dados com um consultor se autorizar, e pode revogar o acesso em Configurações.
        </p>
      </section>
      </div>

      <p className="text-center text-xs text-gray-400">
        © {new Date().getFullYear()} Almeida Finance · Todos os direitos reservados
      </p>
    </PaginaInterna>
  )
}
