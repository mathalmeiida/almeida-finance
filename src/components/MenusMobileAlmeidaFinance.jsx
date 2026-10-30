import React, { useEffect } from 'react'
import {
  X, ReceiptText, TrendingUp, CreditCard, UtensilsCrossed,
  UserRound, Settings, Grid2X2, CircleHelp, Info, LogOut, ChevronRight,
} from 'lucide-react'

/**
 * Menus inferiores para a navegação mobile do Almeida Finance.
 * Monte uma única instância no App.jsx / Layout.jsx.
 *
 * Props:
 *  aberto: 'adicionar' | 'mais' | null
 *  onFechar: função
 *  onNavigate: função que recebe um caminho existente do React Router
 *  onSair: função já existente para encerrar a sessão (não altera autenticação)
 *
 * Não cria lançamentos diretamente; abre as páginas reais do projeto.
 * Não adiciona botões flutuantes: o menu inferior existente chama a abertura.
 */
export default function MenusMobileAlmeidaFinance({ aberto, onFechar, onNavigate, onSair }) {
  useEffect(() => {
    if (!aberto) return
    const onEsc = e => { if (e.key === 'Escape') onFechar?.() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [aberto, onFechar])

  if (!aberto) return null
  const ehAdicionar = aberto === 'adicionar'
  const itens = ehAdicionar
    ? [
        { titulo: 'Despesa', detalhe: 'Registrar um gasto', Icone: ReceiptText, rota: '/?novo=gasto', cor: '#e11d48' },
        { titulo: 'Receita', detalhe: 'Registrar uma entrada', Icone: TrendingUp, rota: '/receitas?novo=1', cor: '#059669' },
        { titulo: 'Compra no cartão', detalhe: 'Adicionar uma compra', Icone: CreditCard, rota: '/cartoes', cor: 'var(--cor-marca, #7c3aed)' },
        { titulo: 'Gasto VR/VA', detalhe: 'Registrar um gasto', Icone: UtensilsCrossed, rota: '/beneficios', cor: 'var(--cor-marca, #7c3aed)' },
      ]
    : [
        { titulo: 'Meu perfil', detalhe: 'Dados pessoais e segurança', Icone: UserRound, rota: '/configuracoes' },
        { titulo: 'Configurações', detalhe: 'Tema e preferências', Icone: Settings, rota: '/configuracoes' },
        { titulo: 'Todas as funcionalidades', detalhe: 'Acessar os recursos do app', Icone: Grid2X2, rota: '/mais' },
        { titulo: 'Ajuda e feedback', detalhe: 'Dúvidas e sugestões', Icone: CircleHelp, rota: '/configuracoes' },
        { titulo: 'Sobre o Almeida Finance', detalhe: 'Informações do aplicativo', Icone: Info, rota: '/configuracoes' },
        { titulo: 'Sair', detalhe: 'Encerrar sessão', Icone: LogOut, sair: true, cor: '#e11d48' },
      ]

  function escolher(item) {
    onFechar?.()
    if (item.sair) onSair?.()
    else onNavigate?.(item.rota)
  }

  return (
    <div className="md:hidden fixed inset-0 z-[100] flex items-end justify-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-slate-950/55" aria-label="Fechar menu" onClick={onFechar} />
      <section role="dialog" aria-modal="true" aria-label={ehAdicionar ? 'Adicionar movimentação' : 'Mais opções'}
        className="relative w-full max-w-xl rounded-t-[28px] bg-white px-4 pt-3 pb-6 shadow-2xl"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <span className="mx-auto mb-3 block h-1 w-11 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">{ehAdicionar ? 'Adicionar' : 'Mais'}</h2>
          <button type="button" aria-label="Fechar" onClick={onFechar} className="rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={20}/></button>
        </div>
        <div className="max-h-[65dvh] space-y-2 overflow-y-auto">
          {itens.map(item => (
            <button key={item.titulo} type="button" onClick={() => escolher(item)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-3 text-left shadow-sm active:bg-slate-50">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'var(--af-home-soft, #f0eaff)', color: item.cor || 'var(--af-home-primary, #7c3aed)' }}>
                <item.Icone size={21}/>
              </span>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-slate-900">{item.titulo}</strong>
                <span className="block text-xs text-slate-500">{item.detalhe}</span></span>
              <ChevronRight size={16} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}