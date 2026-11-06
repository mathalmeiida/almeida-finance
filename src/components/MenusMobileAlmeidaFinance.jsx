import React, { useEffect } from 'react'
import {
  X, ReceiptText, TrendingUp, CreditCard, UtensilsCrossed,
  UserRound, Settings, Grid2X2, CircleHelp, Info, LogOut, ChevronRight,
} from 'lucide-react'

/**
 * Menus inferiores para a navegação mobile do Almeida Finance.
 * Instância única no Layout.jsx.
 *
 * Props:
 *  aberto   — 'adicionar' | 'mais' | null
 *  onFechar — fecha o sheet
 *  onNavigate — navega para uma rota existente do React Router
 *  onSair   — encerra a sessão (já implementado no Layout)
 */
export default function MenusMobileAlmeidaFinance({ aberto, onFechar, onNavigate, onSair }) {
  // Fecha com Escape
  useEffect(() => {
    if (!aberto) return
    const onEsc = e => { if (e.key === 'Escape') onFechar?.() }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [aberto, onFechar])

  if (!aberto) return null

  const ehAdicionar = aberto === 'adicionar'

  // ── Itens do menu "Adicionar" ────────────────────────────────────────────
  const itensAdicionar = [
    { titulo: 'Despesa',         detalhe: 'Registrar um gasto',    Icone: ReceiptText, rota: '/?novo=gasto',   cor: '#e11d48' },
    { titulo: 'Receita',         detalhe: 'Registrar uma entrada', Icone: TrendingUp,  rota: '/receitas?novo=1', cor: '#059669' },
    { titulo: 'Compra no cartão',detalhe: 'Adicionar uma compra',  Icone: CreditCard,  rota: '/cartoes',        cor: '#0ea5e9' },
    { titulo: 'Gasto VR/VA',     detalhe: 'Registrar um gasto',    Icone: UtensilsCrossed, rota: '/beneficios', cor: '#d97706' },
  ]

  // ── Itens do menu "Mais" — cada opção tem rota própria ──────────────────
  const itensMais = [
    {
      titulo: 'Meu perfil',
      detalhe: 'Dados pessoais e segurança',
      Icone: UserRound,
      rota: '/mais/perfil',
    },
    {
      titulo: 'Configurações',
      detalhe: 'Tema, notificações e preferências',
      Icone: Settings,
      rota: '/configuracoes',
    },
    {
      titulo: 'Todas as funcionalidades',
      detalhe: 'Acessar os recursos do app',
      Icone: Grid2X2,
      rota: '/mais/funcionalidades',
    },
    {
      titulo: 'Ajuda & feedback',
      detalhe: 'Dúvidas, suporte e sugestões',
      Icone: CircleHelp,
      rota: '/mais/ajuda',
    },
    {
      titulo: 'Sobre o Almeida Finance',
      detalhe: 'Informações do aplicativo',
      Icone: Info,
      rota: '/mais/sobre',
    },
  ]

  const itens = ehAdicionar ? itensAdicionar : itensMais

  function escolher(item) {
    onFechar?.()
    if (item.sair) { onSair?.(); return }
    onNavigate?.(item.rota)
  }

  // ── Paleta: "Mais" = vinho premium | "Adicionar" = branco ───────────────
  const ehMais = !ehAdicionar
  const bgSheet  = ehMais ? '#21121F' : '#FFFFFF'
  const txtTit   = ehMais ? '#FAF7F8' : '#0f172a'
  const txtClose = ehMais ? 'rgba(212,168,182,0.7)' : '#64748b'
  const barCor   = ehMais ? 'rgba(80,40,56,0.6)'   : '#cbd5e1'

  return (
    <div
      className="md:hidden fixed inset-0 z-[100] flex items-end justify-center"
      role="presentation"
    >
      {/* Overlay */}
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: 'rgba(14,4,10,0.65)' }}
        aria-label="Fechar menu"
        onClick={onFechar}
      />

      {/* Sheet */}
      <section
        role="dialog"
        aria-modal="true"
        aria-label={ehAdicionar ? 'Adicionar movimentação' : 'Mais opções'}
        className="relative w-full max-w-xl rounded-t-[28px] shadow-2xl"
        style={{
          background: bgSheet,
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
        }}
      >
        {/* Indicador de arraste */}
        <span
          className="mx-auto mt-3 mb-2 block h-1 w-11 rounded-full"
          style={{ background: barCor }}
        />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2
            className="text-xl font-bold"
            style={{ color: txtTit }}
          >
            {ehAdicionar ? 'Adicionar' : 'Mais'}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            style={{ color: txtClose }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de itens */}
        <div className="max-h-[65dvh] overflow-y-auto px-4 pb-2 space-y-2">
          {itens.map(item => (
            <ItemMenu
              key={item.titulo}
              item={item}
              ehMais={ehMais}
              onClick={() => escolher(item)}
            />
          ))}

          {/* Sair — só no menu Mais */}
          {ehMais && (
            <button
              type="button"
              onClick={() => { onFechar?.(); onSair?.() }}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors mt-1"
              style={{ background: 'rgba(225,29,72,0.12)', border: '1px solid rgba(225,29,72,0.2)' }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: 'rgba(225,29,72,0.15)', color: '#f87171' }}
              >
                <LogOut size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-sm font-semibold" style={{ color: '#f87171' }}>Sair</strong>
                <span className="block text-xs" style={{ color: 'rgba(248,113,113,0.7)' }}>Encerrar sessão</span>
              </span>
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

// ── Item individual ────────────────────────────────────────────────────────
function ItemMenu({ item, ehMais, onClick }) {
  // Visual vinho (menu Mais) vs branco (menu Adicionar)
  const bgItem   = ehMais ? 'rgba(255,255,255,0.05)' : '#ffffff'
  const border   = ehMais ? '1px solid rgba(80,40,56,0.5)' : '1px solid #f1f5f9'
  const bgIcon   = ehMais ? 'rgba(160,80,120,0.18)'  : '#f0eaff'
  const corIcon  = item.cor || (ehMais ? '#C4507A' : '#7c3aed')
  const txtMain  = ehMais ? '#FAF7F8' : '#0f172a'
  const txtSub   = ehMais ? '#D4A8B6' : '#64748b'
  const chevron  = ehMais ? 'rgba(212,168,182,0.5)' : '#94a3b8'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-all active:opacity-80"
      style={{ background: bgItem, border }}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
        style={{ background: bgIcon, color: corIcon }}
      >
        <item.Icone size={21} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm font-semibold" style={{ color: txtMain }}>
          {item.titulo}
        </strong>
        <span className="block text-xs" style={{ color: txtSub }}>
          {item.detalhe}
        </span>
      </span>
      <ChevronRight size={16} style={{ color: chevron, flexShrink: 0 }} />
    </button>
  )
}
