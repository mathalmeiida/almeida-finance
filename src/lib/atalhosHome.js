// ─── Atalhos da Home: catálogo e regras de personalização ────────────────────
// Fonte ÚNICA dos atalhos (Home e, na Parte B, o onboarding usam este módulo).
// Funções puras, sem React nem ícones, para poderem ser testadas em Node.
//
// Cada atalho executa uma ação JÁ existente no app:
//   { rota }  → navega para a página existente
//   { modal } → abre um modal existente da Home ('calendario' | 'gasto' | 'planejamento')
// Só entram atalhos de funções que existem (Importação: página /importacao).

export const VERSAO_CONFIG_ATALHOS = 2

// Ordem padrão = ordem do celular. No computador a Home mostra só os 5
// ATALHOS_DESKTOP (o restante fica no menu lateral), na ordem do usuário.
export const CATALOGO_ATALHOS = [
  { id: 'receitas', label: 'Receitas', rota: '/receitas' },
  { id: 'despesas', label: 'Despesas', rota: '/despesas' },
  { id: 'registrar-gasto', label: 'Registrar gasto', modal: 'gasto', exigeEscrita: true },
  { id: 'simular-compra', label: 'Simular compra', rota: '/posso-comprar' },
  { id: 'calendario', label: 'Calendário', modal: 'calendario' },
  { id: 'gastar-hoje', label: 'Quanto posso gastar hoje?', modal: 'planejamento' },
  { id: 'consultoria', label: 'Consultoria', rota: '/consultoria' },
  { id: 'investimentos', label: 'Investimentos', rota: '/investimentos' },
  { id: 'metas', label: 'Metas', rota: '/metas' },
  { id: 'cartoes', label: 'Cartões', rota: '/cartoes' },
  { id: 'e-se', label: 'E se...?', rota: '/e-se' },
  { id: 'importacao', label: 'Importação Inteligente', rota: '/importacao', exigeEscrita: true },
  { id: 'parcelamentos', label: 'Parcelamentos', rota: '/despesas?aba=parceladas' },
  { id: 'projecao', label: 'Projeção financeira', rota: '/projecao' },
]

export const ATALHOS_DESKTOP = ['registrar-gasto', 'simular-compra', 'calendario', 'gastar-hoje', 'consultoria']

const IDS_VALIDOS = new Set(CATALOGO_ATALHOS.map(a => a.id))

export function configPadraoAtalhos() {
  return {
    versao: VERSAO_CONFIG_ATALHOS,
    ordem: CATALOGO_ATALHOS.map(a => a.id),
    ocultos: [],
    favoritos: [],
  }
}

function listaIdsValidos(lista) {
  if (!Array.isArray(lista)) return []
  const vistos = new Set()
  const saida = []
  for (const id of lista) {
    if (typeof id === 'string' && IDS_VALIDOS.has(id) && !vistos.has(id)) {
      vistos.add(id)
      saida.push(id)
    }
  }
  return saida
}

// Aceita qualquer valor vindo do banco/localStorage e devolve uma config válida:
// remove ids desconhecidos e duplicados e acrescenta, ao final e visíveis,
// atalhos novos do catálogo que o usuário ainda não conhecia.
export function normalizarConfigAtalhos(bruto) {
  const base = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {}
  let ordem = listaIdsValidos(base.ordem)
  // Versão 1 (antes de Receitas/Despesas): mantém a ordem do usuário e
  // coloca os dois atalhos novos no início, como no padrão.
  if (ordem.length && (Number(base.versao) || 1) < 2) ordem = ['receitas', 'despesas', ...ordem.filter(id => id !== 'receitas' && id !== 'despesas')]
  for (const a of CATALOGO_ATALHOS) if (!ordem.includes(a.id)) ordem.push(a.id)
  return {
    versao: VERSAO_CONFIG_ATALHOS,
    ordem,
    ocultos: listaIdsValidos(base.ocultos),
    favoritos: listaIdsValidos(base.favoritos),
  }
}

// Lista final exibida na Home: favoritos primeiro (na ordem definida), depois
// os demais; ocultos ficam de fora. Em modo somente leitura, remove atalhos
// que criam dados.
export function atalhosVisiveis(config, { somenteLeitura = false } = {}) {
  const c = normalizarConfigAtalhos(config)
  const porId = Object.fromEntries(CATALOGO_ATALHOS.map(a => [a.id, a]))
  const ocultos = new Set(c.ocultos)
  const favoritos = new Set(c.favoritos)
  const visiveis = c.ordem.filter(id => !ocultos.has(id) && !(somenteLeitura && porId[id].exigeEscrita))
  const ordenados = [
    ...visiveis.filter(id => favoritos.has(id)),
    ...visiveis.filter(id => !favoritos.has(id)),
  ]
  return ordenados.map(id => ({ ...porId[id], favorito: favoritos.has(id) }))
}

// Faixa do computador: só os 5 principais, respeitando ocultos/favoritos/ordem.
export function atalhosDesktop(config, opcoes) {
  return atalhosVisiveis(config, opcoes).filter(a => ATALHOS_DESKTOP.includes(a.id))
}

export function moverAtalho(config, id, delta) {
  const c = normalizarConfigAtalhos(config)
  const i = c.ordem.indexOf(id)
  const j = i + delta
  if (i < 0 || j < 0 || j >= c.ordem.length) return c
  const ordem = [...c.ordem]
  ;[ordem[i], ordem[j]] = [ordem[j], ordem[i]]
  return { ...c, ordem }
}

// Move o item `id` para a posição atualmente ocupada por `alvoId` (arrastar e soltar).
export function reposicionarAtalho(config, id, alvoId) {
  const c = normalizarConfigAtalhos(config)
  const de = c.ordem.indexOf(id)
  const para = c.ordem.indexOf(alvoId)
  if (de < 0 || para < 0 || de === para) return c
  const ordem = [...c.ordem]
  ordem.splice(de, 1)
  ordem.splice(para, 0, id)
  return { ...c, ordem }
}

function alternarNaLista(lista, id) {
  return lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id]
}

export function alternarOcultoAtalho(config, id) {
  const c = normalizarConfigAtalhos(config)
  if (!IDS_VALIDOS.has(id)) return c
  const ocultos = alternarNaLista(c.ocultos, id)
  // Nunca deixar a Home sem nenhum atalho visível.
  if (ocultos.length >= CATALOGO_ATALHOS.length) return c
  // Atalho oculto deixa de ser favorito.
  const favoritos = ocultos.includes(id) ? c.favoritos.filter(x => x !== id) : c.favoritos
  return { ...c, ocultos, favoritos }
}

export function alternarFavoritoAtalho(config, id) {
  const c = normalizarConfigAtalhos(config)
  if (!IDS_VALIDOS.has(id)) return c
  const favoritos = alternarNaLista(c.favoritos, id)
  // Favoritar um atalho oculto também o torna visível.
  const ocultos = favoritos.includes(id) ? c.ocultos.filter(x => x !== id) : c.ocultos
  return { ...c, favoritos, ocultos }
}

export function configsAtalhosIguais(a, b) {
  return JSON.stringify(normalizarConfigAtalhos(a)) === JSON.stringify(normalizarConfigAtalhos(b))
}
